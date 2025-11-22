import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';

export const housekeepingRouter = Router({ mergeParams: true });

const createTaskSchema = z.object({
  roomId: z.string().uuid(),
  taskType: z.enum(['cleaning', 'inspection', 'maintenance_prep']),
  assignedTo: z.string().uuid().optional(),
});

const completeTaskSchema = z.object({
  photos: z.array(z.string()).optional(),
  checklist: z.any().optional(),
  notes: z.string().optional(),
});

// GET /api/tenants/:tenantId/housekeeping
housekeepingRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const { status, roomId, assignedTo } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (roomId) where.roomId = roomId;
    if (assignedTo) where.assignedTo = assignedTo;

    const { skip, take, page, limit } = getPaginationParams(req);

    const [tasks, total] = await Promise.all([
      prisma.housekeepingTask.findMany({
        where,
        include: {
          room: {
            select: {
              id: true,
              roomNumber: true,
              roomType: true,
            },
          },
          assignedStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          completedStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.housekeepingTask.count({ where }),
    ]);

    const result = createPaginationResult(tasks, total, page, limit);

    res.json({
      success: true,
      ...result,
    });
  }
);

// POST /api/tenants/:tenantId/housekeeping
housekeepingRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const data = createTaskSchema.parse(req.body);

    const room = await prisma.room.findFirst({
      where: {
        id: data.roomId,
        tenantId,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404);
    }

    const task = await prisma.housekeepingTask.create({
      data: {
        tenantId,
        roomId: data.roomId,
        taskType: data.taskType,
        assignedTo: data.assignedTo,
      },
      include: {
        room: true,
      },
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'create_housekeeping_task',
      entityType: 'housekeeping_task',
      entityId: task.id,
      afterState: task,
    });

    res.status(201).json({
      success: true,
      data: task,
    });
  }
);

// POST /api/tenants/:tenantId/rooms/:roomId/housekeeping/complete
housekeepingRouter.post(
  '/:id/complete',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const taskId = req.params.id;
    const data = completeTaskSchema.parse(req.body);

    const task = await prisma.housekeepingTask.findFirst({
      where: {
        id: taskId,
        tenantId,
      },
      include: {
        room: true,
      },
    });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    const beforeState = { ...task };

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTask = await tx.housekeepingTask.update({
        where: { id: taskId },
        data: {
          status: 'completed',
          completedBy: req.user!.id,
          completedAt: new Date(),
          photos: data.photos || undefined,
          checklist: data.checklist || undefined,
          notes: data.notes,
        },
      });

      // Update room status
      await tx.room.update({
        where: { id: task.roomId },
        data: { status: 'clean' },
      });

      return updatedTask;
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'complete_housekeeping_task',
      entityType: 'housekeeping_task',
      entityId: taskId,
      beforeState,
      afterState: updated,
      metadata: {
        photos: data.photos,
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  }
);
