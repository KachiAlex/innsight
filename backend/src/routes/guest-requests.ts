import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';

export const guestRequestsRouter = Router({ mergeParams: true });

const staffSelect = {
  select: { id: true, firstName: true, lastName: true, email: true },
};

const requestInclude = {
  assignedStaff: staffSelect,
  creator: staffSelect,
  guest: { select: { id: true, name: true, email: true, phone: true } },
  _count: { select: { messages: true } },
};

const createSchema = z.object({
  requestType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  guestId: z.string().uuid().nullable().optional(),
  reservationId: z.string().uuid().nullable().optional(),
  roomId: z.string().uuid().nullable().optional(),
  guestName: z.string().nullable().optional(),
  guestPhone: z.string().nullable().optional(),
  guestEmail: z.string().nullable().optional(),
  roomNumber: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
  source: z.string().optional(),
  estimatedCompletion: z.string().nullable().optional(),
});

const updateSchema = z.object({
  status: z
    .enum(['pending', 'assigned', 'in_progress', 'completed', 'cancelled'])
    .optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  department: z.string().nullable().optional(),
  estimatedCompletion: z.string().nullable().optional(),
  notes: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

// GET /api/tenants/:tenantId/guest-requests/stats/summary
guestRequestsRouter.get(
  '/stats/summary',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const [byStatus, byPriority, byType, completed] = await Promise.all([
        prisma.guestRequest.groupBy({ by: ['status'], where: { tenantId }, _count: true }),
        prisma.guestRequest.groupBy({ by: ['priority'], where: { tenantId }, _count: true }),
        prisma.guestRequest.groupBy({ by: ['requestType'], where: { tenantId }, _count: true }),
        prisma.guestRequest.findMany({
          where: { tenantId, status: 'completed', actualCompletion: { not: null } },
          select: { createdAt: true, actualCompletion: true },
        }),
      ]);

      const avgResolutionMinutes = completed.length
        ? Math.round(
            completed.reduce(
              (s, r) => s + (r.actualCompletion!.getTime() - r.createdAt.getTime()) / 60000,
              0
            ) / completed.length
          )
        : null;

      res.json({
        success: true,
        data: {
          byStatus: Object.fromEntries(byStatus.map((g) => [g.status, g._count])),
          byPriority: Object.fromEntries(byPriority.map((g) => [g.priority, g._count])),
          byType: Object.fromEntries(byType.map((g) => [g.requestType, g._count])),
          total: byStatus.reduce((s, g) => s + g._count, 0),
          completedCount: completed.length,
          avgResolutionMinutes,
        },
      });
    } catch (error: any) {
      throw new AppError(`Failed to fetch guest request stats: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/guest-requests
guestRequestsRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, priority, requestType, assignedTo, department, search } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (requestType) where.requestType = requestType;
      if (assignedTo) where.assignedTo = assignedTo;
      if (department) where.department = department;
      if (search) {
        where.OR = [
          { title: { contains: search as string, mode: 'insensitive' } },
          { guestName: { contains: search as string, mode: 'insensitive' } },
          { roomNumber: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [requests, total] = await Promise.all([
        prisma.guestRequest.findMany({
          where,
          include: requestInclude,
          orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
          skip,
          take,
        }),
        prisma.guestRequest.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(requests, total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch guest requests: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/guest-requests
guestRequestsRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createSchema.parse(req.body);

      const request = await prisma.guestRequest.create({
        data: {
          tenantId,
          requestType: data.requestType,
          title: data.title,
          description: data.description,
          priority: data.priority || 'normal',
          guestId: data.guestId ?? null,
          reservationId: data.reservationId ?? null,
          roomId: data.roomId ?? null,
          guestName: data.guestName ?? null,
          guestPhone: data.guestPhone ?? null,
          guestEmail: data.guestEmail ?? null,
          roomNumber: data.roomNumber ?? null,
          department: data.department ?? null,
          assignedTo: data.assignedTo ?? null,
          tags: data.tags ?? [],
          source: data.source || 'manual',
          estimatedCompletion: data.estimatedCompletion
            ? new Date(data.estimatedCompletion)
            : null,
          createdBy: req.user!.id,
        },
        include: requestInclude,
      });

      await prisma.guestRequestUpdate.create({
        data: {
          tenantId,
          guestRequestId: request.id,
          previousStatus: 'none',
          newStatus: request.status,
          updateType: 'created',
          performedBy: req.user!.id,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_guest_request',
        entityType: 'guest_request',
        entityId: request.id,
        afterState: request,
      });

      res.status(201).json({ success: true, data: request });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to create guest request: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/guest-requests/:id
guestRequestsRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const request = await prisma.guestRequest.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        include: {
          ...requestInclude,
          messages: { orderBy: { createdAt: 'asc' } },
          updates: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!request) throw new AppError('Guest request not found', 404);
      res.json({ success: true, data: request });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to fetch guest request: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/guest-requests/:id
guestRequestsRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const request = await prisma.guestRequest.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!request) throw new AppError('Guest request not found', 404);

      const data = updateSchema.parse(req.body);
      const completing = data.status === 'completed' && request.status !== 'completed';

      const updated = await prisma.guestRequest.update({
        where: { id: request.id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
          ...(data.department !== undefined && { department: data.department }),
          ...(data.estimatedCompletion !== undefined && {
            estimatedCompletion: data.estimatedCompletion
              ? new Date(data.estimatedCompletion)
              : null,
          }),
          ...(completing && { actualCompletion: new Date() }),
          lastGuestUpdate: new Date(),
        },
        include: requestInclude,
      });

      if (data.status && data.status !== request.status) {
        await prisma.guestRequestUpdate.create({
          data: {
            tenantId,
            guestRequestId: request.id,
            previousStatus: request.status,
            newStatus: data.status,
            updateType: 'status_change',
            notes: data.notes ?? null,
            performedBy: req.user!.id,
          },
        });
      }

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_guest_request',
        entityType: 'guest_request',
        entityId: request.id,
        beforeState: request,
        afterState: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to update guest request: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/guest-requests/:id/messages
guestRequestsRouter.post(
  '/:id/messages',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const request = await prisma.guestRequest.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!request) throw new AppError('Guest request not found', 404);

      const data = z
        .object({
          message: z.string().min(1),
          messageType: z.string().optional(),
          isVisibleToGuest: z.boolean().optional(),
        })
        .parse(req.body);

      const message = await prisma.guestRequestMessage.create({
        data: {
          tenantId,
          guestRequestId: request.id,
          message: data.message,
          messageType: data.messageType || 'note',
          isFromGuest: false,
          isVisibleToGuest: data.isVisibleToGuest ?? false,
          createdBy: req.user!.id,
        },
      });

      res.status(201).json({ success: true, data: message });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to add message: ${error.message}`, 500);
    }
  }
);
