import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';

export const lostFoundRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializeItem = (item: any) => ({ ...item, value: toNumber(item.value) });

const itemSchema = z.object({
  itemName: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  color: z.string().nullable().optional(),
  brand: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  value: z.number().nonnegative().nullable().optional(),
  foundLocation: z.string().min(1),
  foundAt: z.string().optional(),
  circumstances: z.string().nullable().optional(),
  reportedByGuestId: z.string().uuid().nullable().optional(),
  reportedByName: z.string().nullable().optional(),
  reportedByPhone: z.string().nullable().optional(),
  reportedByEmail: z.string().nullable().optional(),
  reportedByRoom: z.string().nullable().optional(),
  storageLocation: z.string().nullable().optional(),
  storageNotes: z.string().nullable().optional(),
});

const nextItemNumber = async (tenantId: string) => {
  const count = await prisma.lostItem.count({ where: { tenantId } });
  return `LI-${String(count + 1).padStart(5, '0')}`;
};

// GET /api/tenants/:tenantId/lost-found/stats/summary
lostFoundRouter.get(
  '/stats/summary',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const [byStatus, byCategory, totalValue] = await Promise.all([
        prisma.lostItem.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
        prisma.lostItem.groupBy({ by: ['category'], where: { tenantId }, _count: true }),
        prisma.lostItem.aggregate({
          where: { tenantId, status: 'unclaimed' },
          _sum: { value: true },
        }),
      ]);

      res.json({
        success: true,
        data: {
          byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count])),
          byCategory: Object.fromEntries(byCategory.map((g) => [g.category, g._count])),
          total: byStatus.reduce((s, g) => s + g._count, 0),
          unclaimedValue: toNumber(totalValue._sum.value) ?? 0,
        },
      });
    } catch (error: any) {
      throw new AppError(`Failed to fetch lost & found stats: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/lost-found
lostFoundRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, category, search } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (category) where.category = category;
      if (search) {
        where.OR = [
          { itemName: { contains: search as string, mode: 'insensitive' } },
          { itemNumber: { contains: search as string, mode: 'insensitive' } },
          { foundLocation: { contains: search as string, mode: 'insensitive' } },
          { description: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.lostItem.findMany({
          where,
          include: {
            creator: { select: { id: true, firstName: true, lastName: true } },
            foundStaff: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { foundAt: 'desc' },
          skip,
          take,
        }),
        prisma.lostItem.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(items.map(serializeItem), total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch lost items: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/lost-found
lostFoundRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = itemSchema.parse(req.body);
      const itemNumber = await nextItemNumber(tenantId);

      const item = await prisma.lostItem.create({
        data: {
          tenantId,
          itemNumber,
          itemName: data.itemName,
          description: data.description,
          category: data.category,
          color: data.color ?? null,
          brand: data.brand ?? null,
          serialNumber: data.serialNumber ?? null,
          value: data.value ?? null,
          foundLocation: data.foundLocation,
          foundBy: req.user!.id,
          foundAt: data.foundAt ? new Date(data.foundAt) : new Date(),
          circumstances: data.circumstances ?? null,
          reportedByGuestId: data.reportedByGuestId ?? null,
          reportedByName: data.reportedByName ?? null,
          reportedByPhone: data.reportedByPhone ?? null,
          reportedByEmail: data.reportedByEmail ?? null,
          reportedByRoom: data.reportedByRoom ?? null,
          reportedAt:
            data.reportedByName || data.reportedByGuestId ? new Date() : null,
          storageLocation: data.storageLocation ?? null,
          storageNotes: data.storageNotes ?? null,
          createdBy: req.user!.id,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_lost_item',
        entityType: 'lost_item',
        entityId: item.id,
        afterState: serializeItem(item),
      });

      res.status(201).json({ success: true, data: serializeItem(item) });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to register lost item: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/lost-found/:id — update / claim / return / dispose
lostFoundRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const item = await prisma.lostItem.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!item) throw new AppError('Item not found', 404);

      const data = itemSchema.partial().extend({
        status: z.enum(['unclaimed', 'claimed', 'returned', 'disposed']).optional(),
        claimedBy: z.string().optional(),
        claimMethod: z.string().optional(),
        returnedTo: z.string().optional(),
        returnMethod: z.string().optional(),
        disposalMethod: z.string().optional(),
      }).parse(req.body);

      const updated = await prisma.lostItem.update({
        where: { id: item.id },
        data: {
          ...(data.itemName !== undefined && { itemName: data.itemName }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.brand !== undefined && { brand: data.brand }),
          ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
          ...(data.value !== undefined && { value: data.value }),
          ...(data.foundLocation !== undefined && { foundLocation: data.foundLocation }),
          ...(data.storageLocation !== undefined && { storageLocation: data.storageLocation }),
          ...(data.storageNotes !== undefined && { storageNotes: data.storageNotes }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.status === 'claimed' && {
            claimedBy: data.claimedBy ?? req.user!.email,
            claimedAt: new Date(),
            claimMethod: data.claimMethod ?? null,
          }),
          ...(data.status === 'returned' && {
            returnedTo: data.returnedTo ?? null,
            returnMethod: data.returnMethod ?? null,
          }),
          ...(data.status === 'disposed' && {
            disposedAt: new Date(),
            disposedBy: req.user!.id,
            disposalMethod: data.disposalMethod ?? null,
          }),
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_lost_item',
        entityType: 'lost_item',
        entityId: item.id,
        beforeState: serializeItem(item),
        afterState: serializeItem(updated),
      });

      res.json({ success: true, data: serializeItem(updated) });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to update lost item: ${error.message}`, 500);
    }
  }
);
