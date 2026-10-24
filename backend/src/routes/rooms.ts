import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import { createRoomLog } from '../utils/roomLogs';

export const roomRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializeRoom = (room: any) => ({
  ...room,
  customRate: toNumber(room.customRate),
  ratePlan: room.ratePlan
    ? { ...room.ratePlan, baseRate: toNumber(room.ratePlan.baseRate) }
    : room.ratePlan,
});

const roomInclude = {
  category: { select: { id: true, name: true, color: true } },
  ratePlan: { select: { id: true, name: true, baseRate: true, currency: true } },
};

const roomSchema = z.object({
  roomNumber: z.string().min(1),
  roomType: z.string().min(1),
  floor: z.number().int().nullable().optional(),
  status: z.string().optional(),
  maxOccupancy: z.number().int().min(1).default(2),
  amenities: z.any().optional(),
  ratePlanId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().nullable().optional(),
  customRate: z.number().nonnegative().nullable().optional(),
});

const roomUpdateSchema = roomSchema.partial().extend({
  roomNumber: z.string().min(1).optional(),
  roomType: z.string().min(1).optional(),
});

const inventorySchema = z.object({
  inheritTemplate: z.boolean().optional(),
  customItems: z.array(z.any()).optional(),
  overwriteCustom: z.boolean().optional(),
  primaryImageUrl: z.string().nullable().optional(),
});

// GET /api/tenants/:tenantId/rooms
roomRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, categoryId, floor, search } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (categoryId === 'none') where.categoryId = null;
      else if (categoryId) where.categoryId = categoryId;
      if (floor) where.floor = parseInt(floor as string, 10);
      if (search) {
        where.OR = [
          { roomNumber: { contains: search as string, mode: 'insensitive' } },
          { roomType: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [rooms, total] = await Promise.all([
        prisma.room.findMany({
          where,
          include: roomInclude,
          orderBy: { roomNumber: 'asc' },
          skip,
          take,
        }),
        prisma.room.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(rooms.map(serializeRoom), total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch rooms: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/rooms/accountability-report/latest
roomRouter.get(
  '/accountability-report/latest',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const report = await prisma.accountabilityReport.findFirst({
        where: { tenantId: req.params.tenantId },
        orderBy: { lastReportAt: 'desc' },
      });
      res.json({ success: true, data: report });
    } catch (error: any) {
      throw new AppError(`Failed to fetch accountability report: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/rooms/:id
roomRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const room = await prisma.room.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        include: {
          ...roomInclude,
          reservations: {
            where: { status: { in: ['confirmed', 'checked_in'] } },
            orderBy: { checkInDate: 'desc' },
            take: 5,
          },
        },
      });
      if (!room) throw new AppError('Room not found', 404);
      res.json({ success: true, data: serializeRoom(room) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch room: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/rooms
roomRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = roomSchema.parse(req.body);

      const existing = await prisma.room.findUnique({
        where: { tenantId_roomNumber: { tenantId, roomNumber: data.roomNumber } },
      });
      if (existing) throw new AppError('Room number already exists', 409);

      const room = await prisma.room.create({
        data: {
          tenantId,
          roomNumber: data.roomNumber,
          roomType: data.roomType,
          floor: data.floor ?? null,
          status: data.status || 'available',
          maxOccupancy: data.maxOccupancy,
          amenities: data.amenities ?? undefined,
          ratePlanId: data.ratePlanId ?? null,
          categoryId: data.categoryId ?? null,
          description: data.description ?? null,
          customRate: data.customRate ?? null,
        },
        include: roomInclude,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_room',
        entityType: 'room',
        entityId: room.id,
        afterState: serializeRoom(room),
      });

      res.status(201).json({ success: true, data: serializeRoom(room) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create room: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/rooms/bulk
roomRouter.post(
  '/bulk',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const schema = z.object({
        roomNumbers: z.array(z.string().min(1)).min(1).max(500),
        roomType: z.string().min(1),
        floor: z.number().int().nullable().optional(),
        maxOccupancy: z.number().int().min(1).default(2),
        ratePlanId: z.string().uuid().nullable().optional(),
        categoryId: z.string().uuid().nullable().optional(),
        description: z.string().nullable().optional(),
        customRate: z.number().nonnegative().nullable().optional(),
      });
      const data = schema.parse(req.body);

      const existing = await prisma.room.findMany({
        where: { tenantId, roomNumber: { in: data.roomNumbers } },
        select: { roomNumber: true },
      });
      const existingNumbers = new Set(existing.map((r) => r.roomNumber));
      const toCreate = data.roomNumbers.filter((n) => !existingNumbers.has(n));

      // When no explicit floor is given, derive it from 3+-digit room numbers
      // (e.g. 101 -> 1, 1001 -> 10) so generated rooms stay on the floor board.
      const floorFor = (roomNumber: string) => {
        if (data.floor !== null && data.floor !== undefined) return data.floor;
        const num = parseInt(roomNumber, 10);
        return !isNaN(num) && num >= 100 ? Math.floor(num / 100) : null;
      };

      const result = await prisma.room.createMany({
        data: toCreate.map((roomNumber) => ({
          tenantId,
          roomNumber,
          roomType: data.roomType,
          floor: floorFor(roomNumber),
          status: 'available',
          maxOccupancy: data.maxOccupancy,
          ratePlanId: data.ratePlanId ?? null,
          categoryId: data.categoryId ?? null,
          description: data.description ?? null,
          customRate: data.customRate ?? null,
        })),
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'bulk_create_rooms',
        entityType: 'room',
        entityId: tenantId,
        afterState: { created: result.count, skipped: existingNumbers.size },
      });

      res.status(201).json({
        success: true,
        data: {
          created: result.count,
          skipped: data.roomNumbers.length - toCreate.length,
          skippedRoomNumbers: Array.from(existingNumbers),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create rooms: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/rooms/:id
roomRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const room = await prisma.room.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!room) throw new AppError('Room not found', 404);

      const data = roomUpdateSchema.parse(req.body);

      if (data.roomNumber !== undefined && data.roomNumber !== room.roomNumber) {
        const duplicate = await prisma.room.findFirst({
          where: { tenantId, roomNumber: data.roomNumber, id: { not: room.id } },
          select: { id: true },
        });
        if (duplicate) throw new AppError(`Room number ${data.roomNumber} is already in use`, 409);
      }

      const updated = await prisma.room.update({
        where: { id: room.id },
        data: {
          ...(data.roomNumber !== undefined && { roomNumber: data.roomNumber }),
          ...(data.roomType !== undefined && { roomType: data.roomType }),
          ...(data.floor !== undefined && { floor: data.floor }),
          ...(data.status !== undefined && {
            status: data.status,
            lastStatusUpdate: new Date(),
            lastStatusUpdateBy: req.user!.id,
          }),
          ...(data.maxOccupancy !== undefined && { maxOccupancy: data.maxOccupancy }),
          ...(data.amenities !== undefined && { amenities: data.amenities }),
          ...(data.ratePlanId !== undefined && { ratePlanId: data.ratePlanId }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.customRate !== undefined && { customRate: data.customRate }),
        },
        include: roomInclude,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_room',
        entityType: 'room',
        entityId: room.id,
        beforeState: serializeRoom(room),
        afterState: serializeRoom(updated),
      });

      if (data.status && data.status !== room.status) {
        await createRoomLog({
          tenantId,
          roomId: room.id,
          type: 'status_change',
          summary: `Status changed from ${room.status} to ${data.status}`,
          user: { id: req.user!.id, name: req.user!.email },
        }).catch(() => undefined);
      }

      res.json({ success: true, data: serializeRoom(updated) });
    } catch (error: any) {
      if (error instanceof AppError || error instanceof z.ZodError) throw error;
      throw new AppError(`Failed to update room: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/rooms/:id
roomRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const room = await prisma.room.findFirst({
        where: { id: req.params.id, tenantId },
        include: {
          reservations: {
            where: { status: { in: ['confirmed', 'checked_in'] } },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!room) throw new AppError('Room not found', 404);
      if (room.reservations.length > 0) {
        throw new AppError('Cannot delete room with active reservations', 400);
      }

      await prisma.room.delete({ where: { id: room.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_room',
        entityType: 'room',
        entityId: room.id,
        beforeState: serializeRoom(room),
      });

      res.json({ success: true, message: 'Room deleted' });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete room: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/rooms/:id/logs
roomRouter.get(
  '/:id/logs',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const room = await prisma.room.findFirst({
        where: { id: req.params.id, tenantId },
        select: { id: true },
      });
      if (!room) throw new AppError('Room not found', 404);

      const { skip, take, page, limit } = getPaginationParams(req);
      const where = { tenantId, roomId: room.id };

      const [logs, total] = await Promise.all([
        prisma.roomLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
        prisma.roomLog.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(logs, total, page, limit) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch room logs: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/rooms/:id/inventory
// Inventory is stored on the room's amenities JSON column.
roomRouter.get(
  '/:id/inventory',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const room = await prisma.room.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        include: { category: true },
      });
      if (!room) throw new AppError('Room not found', 404);

      const inventory = (room.amenities as any)?.inventory || {};
      res.json({
        success: true,
        data: {
          roomId: room.id,
          roomNumber: room.roomNumber,
          inventoryInheritsTemplate: inventory.inheritsTemplate ?? true,
          customItems: inventory.customItems ?? [],
          primaryImageUrl: inventory.primaryImageUrl ?? null,
          amenities: room.amenities,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch room inventory: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/rooms/:id/inventory
roomRouter.post(
  '/:id/inventory',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const room = await prisma.room.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!room) throw new AppError('Room not found', 404);

      const data = inventorySchema.parse(req.body);
      const current = (room.amenities as any) || {};
      const currentInventory = current.inventory || {};

      const nextInventory = {
        ...currentInventory,
        ...(data.inheritTemplate !== undefined && { inheritsTemplate: data.inheritTemplate }),
        ...(data.customItems !== undefined && {
          customItems: data.overwriteCustom
            ? data.customItems
            : [...(currentInventory.customItems || []), ...data.customItems],
        }),
        ...(data.primaryImageUrl !== undefined && { primaryImageUrl: data.primaryImageUrl }),
      };

      const updated = await prisma.room.update({
        where: { id: room.id },
        data: { amenities: { ...current, inventory: nextInventory } },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_room_inventory',
        entityType: 'room',
        entityId: room.id,
        afterState: nextInventory,
      });

      res.json({ success: true, data: { roomId: room.id, ...nextInventory } });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update room inventory: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/rooms/bulk-inventory
roomRouter.post(
  '/bulk-inventory',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const schema = inventorySchema.extend({
        roomIds: z.array(z.string().uuid()).min(1),
      });
      const data = schema.parse(req.body);

      const rooms = await prisma.room.findMany({
        where: { id: { in: data.roomIds }, tenantId },
        select: { id: true, amenities: true },
      });

      let updated = 0;
      for (const room of rooms) {
        const current = (room.amenities as any) || {};
        const currentInventory = current.inventory || {};
        const nextInventory = {
          ...currentInventory,
          ...(data.inheritTemplate !== undefined && { inheritsTemplate: data.inheritTemplate }),
          ...(data.customItems !== undefined && {
            customItems: data.overwriteCustom
              ? data.customItems
              : [...(currentInventory.customItems || []), ...data.customItems],
          }),
          ...(data.primaryImageUrl !== undefined && { primaryImageUrl: data.primaryImageUrl }),
        };
        await prisma.room.update({
          where: { id: room.id },
          data: { amenities: { ...current, inventory: nextInventory } },
        });
        updated++;
      }

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'bulk_update_room_inventory',
        entityType: 'room',
        entityId: tenantId,
        afterState: { requested: data.roomIds.length, updated },
      });

      res.json({ success: true, data: { requested: data.roomIds.length, updated } });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to bulk update inventory: ${error.message}`, 500);
    }
  }
);
