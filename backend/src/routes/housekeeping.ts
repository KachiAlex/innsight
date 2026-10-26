import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import { createRoomLog } from '../utils/roomLogs';

export const housekeepingRouter = Router({ mergeParams: true });

const staffSelect = {
  select: { id: true, firstName: true, lastName: true, email: true },
};

const taskInclude = {
  room: { select: { id: true, roomNumber: true, roomType: true, floor: true, status: true } },
  assignedStaff: staffSelect,
  completedStaff: staffSelect,
};

const taskSchema = z.object({
  roomId: z.string().uuid(),
  taskType: z.string().min(1),
  status: z.string().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  notes: z.string().nullable().optional(),
  checklist: z.any().optional(),
});

// GET /api/tenants/:tenantId/housekeeping
housekeepingRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, roomId, assignedTo, taskType } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (roomId) where.roomId = roomId;
      if (assignedTo) where.assignedTo = assignedTo;
      if (taskType) where.taskType = taskType;

      const [tasks, total] = await Promise.all([
        prisma.housekeepingTask.findMany({
          where,
          include: taskInclude,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.housekeepingTask.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(tasks, total, page, limit) });
      return;
    } catch (error: any) {
      throw new AppError(`Failed to fetch housekeeping tasks: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/housekeeping
housekeepingRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = taskSchema.parse(req.body);

      const room = await prisma.room.findFirst({
        where: { id: data.roomId, tenantId },
      });
      if (!room) throw new AppError('Room not found', 404);

      const task = await prisma.housekeepingTask.create({
        data: {
          tenantId,
          roomId: data.roomId,
          taskType: data.taskType,
          status: data.status || 'pending',
          assignedTo: data.assignedTo ?? null,
          notes: data.notes ?? null,
          checklist: data.checklist ?? undefined,
        },
        include: taskInclude,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_housekeeping_task',
        entityType: 'housekeeping_task',
        entityId: task.id,
        afterState: task,
      });

      res.status(201).json({ success: true, data: task });
      return;
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to create housekeeping task: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/housekeeping/:id
housekeepingRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const task = await prisma.housekeepingTask.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!task) throw new AppError('Task not found', 404);

      const data = taskSchema.partial().parse(req.body);
      const updated = await prisma.housekeepingTask.update({
        where: { id: task.id },
        data: {
          ...(data.taskType !== undefined && { taskType: data.taskType }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.checklist !== undefined && { checklist: data.checklist }),
          ...(data.roomId !== undefined && { roomId: data.roomId }),
        },
        include: taskInclude,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_housekeeping_task',
        entityType: 'housekeeping_task',
        entityId: task.id,
        beforeState: task,
        afterState: updated,
      });

      res.json({ success: true, data: updated });
      return;
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to update housekeeping task: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/housekeeping/:id/complete
housekeepingRouter.post(
  '/:id/complete',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const task = await prisma.housekeepingTask.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!task) throw new AppError('Task not found', 404);
      if (task.status === 'completed') {
        res.json({ success: true, data: task });
        return;
      }

      const { notes, checklist } = req.body || {};

      const updated = await prisma.housekeepingTask.update({
        where: { id: task.id },
        data: {
          status: 'completed',
          completedBy: req.user!.id,
          completedAt: new Date(),
          ...(notes !== undefined && { notes }),
          ...(checklist !== undefined && { checklist }),
        },
        include: taskInclude,
      });

      // Mark the room clean once its housekeeping finishes
      await prisma.room.updateMany({
        where: { id: task.roomId, status: { in: ['dirty', 'cleaning', 'inspection'] } },
        data: { status: 'available', lastStatusUpdate: new Date(), lastStatusUpdateBy: req.user!.id },
      });

      await createRoomLog({
        tenantId,
        roomId: task.roomId,
        type: 'housekeeping',
        summary: `Housekeeping task completed: ${task.taskType}`,
        user: { id: req.user!.id, name: req.user!.email },
      }).catch(() => undefined);

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'complete_housekeeping_task',
        entityType: 'housekeeping_task',
        entityId: task.id,
        beforeState: task,
        afterState: updated,
      });

      res.json({ success: true, data: updated });
      return;
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to complete housekeeping task: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/housekeeping/:id
housekeepingRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const task = await prisma.housekeepingTask.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!task) throw new AppError('Task not found', 404);

      await prisma.housekeepingTask.delete({ where: { id: task.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_housekeeping_task',
        entityType: 'housekeeping_task',
        entityId: task.id,
        beforeState: task,
      });

      res.json({ success: true, message: 'Task deleted' });
      return;
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to delete housekeeping task: ${error.message}`, 500);
    }
  }
);
