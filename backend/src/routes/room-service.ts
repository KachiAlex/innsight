import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import { createRoomLog } from '../utils/roomLogs';
import { Prisma } from '@prisma/client';

export const roomServiceRouter = Router({ mergeParams: true });
export const menuRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializeOrder = (o: any) => ({
  ...o,
  subtotal: toNumber(o.subtotal),
  taxAmount: toNumber(o.taxAmount),
  serviceCharge: toNumber(o.serviceCharge),
  totalAmount: toNumber(o.totalAmount),
  items: (o.items ?? []).map((i: any) => ({
    ...i,
    unitPrice: toNumber(i.unitPrice),
    totalPrice: toNumber(i.totalPrice),
    menuItem: i.menuItem
      ? { ...i.menuItem, price: toNumber(i.menuItem.price) }
      : i.menuItem,
  })),
});

const serializeMenuItem = (i: any) => ({ ...i, price: toNumber(i.price) });

const staffSelect = {
  select: { id: true, firstName: true, lastName: true },
};

const orderInclude = {
  items: { include: { menuItem: true } },
  assignedStaff: staffSelect,
  deliveryStaff: staffSelect,
};

const orderSchema = z.object({
  guestName: z.string().min(1),
  roomNumber: z.string().min(1),
  guestId: z.string().uuid().nullable().optional(),
  guestPhone: z.string().nullable().optional(),
  orderType: z.string().optional(),
  specialInstructions: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid(),
        quantity: z.number().int().min(1),
        specialRequests: z.string().optional(),
      })
    )
    .min(1),
});

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
  'cancelled',
];

// --- Room service orders ---

// GET /api/tenants/:tenantId/room-service/stats/summary
roomServiceRouter.get(
  '/stats/summary',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

      const [byStatus, todayAgg, totals] = await Promise.all([
        prisma.roomServiceOrder.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: true,
        }),
        prisma.roomServiceOrder.aggregate({
          where: { tenantId, requestedAt: { gte: todayStart }, status: { not: 'cancelled' } },
          _sum: { totalAmount: true },
          _count: true,
        }),
        prisma.roomServiceOrder.aggregate({
          where: { tenantId, status: { not: 'cancelled' } },
          _sum: { totalAmount: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count])),
          todayOrderCount: todayAgg._count,
          todayRevenue: toNumber(todayAgg._sum.totalAmount),
          totalRevenue: toNumber(totals._sum.totalAmount),
        },
      });
    } catch (error: any) {
      throw new AppError(`Failed to fetch room service stats: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/room-service/orders
roomServiceRouter.get(
  '/orders',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, roomNumber, assignedTo } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (roomNumber) where.roomNumber = roomNumber;
      if (assignedTo) where.assignedTo = assignedTo;

      const [orders, total] = await Promise.all([
        prisma.roomServiceOrder.findMany({
          where,
          include: orderInclude,
          orderBy: { requestedAt: 'desc' },
          skip,
          take,
        }),
        prisma.roomServiceOrder.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(orders.map(serializeOrder), total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch orders: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/room-service/orders/:id
roomServiceRouter.get(
  '/orders/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const order = await prisma.roomServiceOrder.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        include: orderInclude,
      });
      if (!order) throw new AppError('Order not found', 404);
      res.json({ success: true, data: serializeOrder(order) });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to fetch order: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/room-service/orders
roomServiceRouter.post(
  '/orders',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = orderSchema.parse(req.body);

      const menuItems = await prisma.menuItem.findMany({
        where: { id: { in: data.items.map((i) => i.menuItemId) }, tenantId, isActive: true },
      });
      if (menuItems.length !== data.items.length) {
        throw new AppError('One or more menu items are invalid or inactive', 400);
      }
      const priceById = new Map<string, number>(
        menuItems.map((m) => [m.id, Number(m.price)])
      );

      const subtotal = data.items.reduce(
        (s, i) => s + (priceById.get(i.menuItemId) || 0) * i.quantity,
        0
      );
      const serviceCharge = Math.round(subtotal * 0.1 * 100) / 100;
      const totalAmount = Math.round((subtotal + serviceCharge) * 100) / 100;

      const orderNumber = `RS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const order = await prisma.$transaction(async (tx) => {
        const created = await tx.roomServiceOrder.create({
          data: {
            tenantId,
            orderNumber,
            guestName: data.guestName,
            roomNumber: data.roomNumber,
            guestId: data.guestId ?? null,
            guestPhone: data.guestPhone ?? null,
            orderType: data.orderType || 'room_service',
            specialInstructions: data.specialInstructions ?? null,
            subtotal: new Prisma.Decimal(subtotal),
            serviceCharge: new Prisma.Decimal(serviceCharge),
            totalAmount: new Prisma.Decimal(totalAmount),
            createdBy: req.user!.id,
          },
        });

        await tx.roomServiceOrderItem.createMany({
          data: data.items.map((i) => ({
            tenantId,
            orderId: created.id,
            menuItemId: i.menuItemId,
            quantity: i.quantity,
            unitPrice: new Prisma.Decimal(priceById.get(i.menuItemId)!),
            totalPrice: new Prisma.Decimal(priceById.get(i.menuItemId)! * i.quantity),
            specialRequests: i.specialRequests ?? null,
          })),
        });

        return created;
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_room_service_order',
        entityType: 'room_service_order',
        entityId: order.id,
        afterState: { orderNumber, totalAmount },
      });

      const full = await prisma.roomServiceOrder.findUnique({
        where: { id: order.id },
        include: orderInclude,
      });
      res.status(201).json({ success: true, data: serializeOrder(full) });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to create order: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/room-service/orders/:id — status transitions + assignment
roomServiceRouter.patch(
  '/orders/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const order = await prisma.roomServiceOrder.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!order) throw new AppError('Order not found', 404);

      const data = z
        .object({
          status: z.enum(ORDER_STATUSES as [string, ...string[]]).optional(),
          assignedTo: z.string().uuid().nullable().optional(),
          estimatedDelivery: z.string().nullable().optional(),
          deliveryNotes: z.string().nullable().optional(),
          specialInstructions: z.string().nullable().optional(),
        })
        .parse(req.body);

      const updated = await prisma.roomServiceOrder.update({
        where: { id: order.id },
        data: {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
          ...(data.estimatedDelivery !== undefined && {
            estimatedDelivery: data.estimatedDelivery ? new Date(data.estimatedDelivery) : null,
          }),
          ...(data.deliveryNotes !== undefined && { deliveryNotes: data.deliveryNotes }),
          ...(data.specialInstructions !== undefined && {
            specialInstructions: data.specialInstructions,
          }),
          ...(data.status === 'confirmed' && !order.confirmedAt && { confirmedAt: new Date() }),
          ...(data.status === 'preparing' && !order.preparedAt && { preparedAt: new Date() }),
          ...(data.status === 'delivered' && {
            deliveredAt: new Date(),
            deliveredBy: req.user!.id,
          }),
        },
        include: orderInclude,
      });

      if (data.status === 'delivered') {
        const room = await prisma.room.findFirst({
          where: { tenantId, roomNumber: order.roomNumber },
          select: { id: true },
        });
        if (room) {
          await createRoomLog({
            tenantId,
            roomId: room.id,
            type: 'room_service',
            summary: `Room service order ${order.orderNumber} delivered to room ${order.roomNumber}`,
            user: { id: req.user!.id, name: req.user!.email },
          }).catch(() => undefined);
        }
      }

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_room_service_order',
        entityType: 'room_service_order',
        entityId: order.id,
        beforeState: serializeOrder(order),
        afterState: serializeOrder(updated),
      });

      res.json({ success: true, data: serializeOrder(updated) });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to update order: ${error.message}`, 500);
    }
  }
);

// --- Menu management ---

// GET /api/tenants/:tenantId/menu/categories
menuRouter.get(
  '/categories',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const categories = await prisma.menuCategory.findMany({
        where: { tenantId: req.params.tenantId },
        include: { _count: { select: { items: true } } },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      });
      res.json({ success: true, data: categories });
    } catch (error: any) {
      throw new AppError(`Failed to fetch menu categories: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/menu/categories
menuRouter.post(
  '/categories',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = z
        .object({
          name: z.string().min(1),
          description: z.string().nullable().optional(),
          displayOrder: z.number().int().optional(),
          imageUrl: z.string().nullable().optional(),
        })
        .parse(req.body);

      const category = await prisma.menuCategory.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description ?? null,
          displayOrder: data.displayOrder ?? 0,
          imageUrl: data.imageUrl ?? null,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_menu_category',
        entityType: 'menu_category',
        entityId: category.id,
        afterState: category,
      });

      res.status(201).json({ success: true, data: category });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to create menu category: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/menu/items
menuRouter.get(
  '/items',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { categoryId, isActive, search } = req.query;

      const where: any = { tenantId };
      if (categoryId) where.categoryId = categoryId;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      if (search) where.name = { contains: search as string, mode: 'insensitive' };

      const items = await prisma.menuItem.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: [{ categoryId: 'asc' }, { name: 'asc' }],
      });

      res.json({ success: true, data: items.map(serializeMenuItem) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch menu items: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/menu/items
menuRouter.post(
  '/items',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = z
        .object({
          categoryId: z.string().uuid(),
          name: z.string().min(1),
          description: z.string().nullable().optional(),
          price: z.number().nonnegative(),
          imageUrl: z.string().nullable().optional(),
          isVegetarian: z.boolean().optional(),
          isVegan: z.boolean().optional(),
          isGlutenFree: z.boolean().optional(),
          containsNuts: z.boolean().optional(),
          spiceLevel: z.string().optional(),
          preparationTime: z.number().int().nullable().optional(),
          allergens: z.array(z.string()).optional(),
        })
        .parse(req.body);

      const category = await prisma.menuCategory.findFirst({
        where: { id: data.categoryId, tenantId },
      });
      if (!category) throw new AppError('Menu category not found', 404);

      const item = await prisma.menuItem.create({
        data: {
          tenantId,
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? null,
          price: data.price,
          imageUrl: data.imageUrl ?? null,
          isVegetarian: data.isVegetarian ?? false,
          isVegan: data.isVegan ?? false,
          isGlutenFree: data.isGlutenFree ?? false,
          containsNuts: data.containsNuts ?? false,
          spiceLevel: data.spiceLevel || 'mild',
          preparationTime: data.preparationTime ?? null,
          allergens: data.allergens ?? [],
        },
        include: { category: { select: { id: true, name: true } } },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_menu_item',
        entityType: 'menu_item',
        entityId: item.id,
        afterState: serializeMenuItem(item),
      });

      res.status(201).json({ success: true, data: serializeMenuItem(item) });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to create menu item: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/menu/items/:id
menuRouter.patch(
  '/items/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const item = await prisma.menuItem.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!item) throw new AppError('Menu item not found', 404);

      const data = z
        .object({
          name: z.string().min(1).optional(),
          description: z.string().nullable().optional(),
          price: z.number().nonnegative().optional(),
          imageUrl: z.string().nullable().optional(),
          isActive: z.boolean().optional(),
          categoryId: z.string().uuid().optional(),
          isVegetarian: z.boolean().optional(),
          isVegan: z.boolean().optional(),
          isGlutenFree: z.boolean().optional(),
          containsNuts: z.boolean().optional(),
          spiceLevel: z.string().optional(),
          preparationTime: z.number().int().nullable().optional(),
          allergens: z.array(z.string()).optional(),
        })
        .parse(req.body);

      const updated = await prisma.menuItem.update({
        where: { id: item.id },
        data,
        include: { category: { select: { id: true, name: true } } },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_menu_item',
        entityType: 'menu_item',
        entityId: item.id,
        beforeState: serializeMenuItem(item),
        afterState: serializeMenuItem(updated),
      });

      res.json({ success: true, data: serializeMenuItem(updated) });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to update menu item: ${error.message}`, 500);
    }
  }
);
