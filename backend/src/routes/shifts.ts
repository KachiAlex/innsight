import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';

export const shiftRouter = Router({ mergeParams: true });

const createShiftSchema = z.object({
  userId: z.string().uuid(),
  shiftType: z.enum(['morning', 'afternoon', 'night']),
  cashFloat: z.number().nonnegative().optional(),
});

const closeShiftSchema = z.object({
  cashReceived: z.number().nonnegative().optional(),
  cashCounted: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

// GET /api/tenants/:tenantId/shifts
shiftRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const { status, userId, startDate, endDate } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate as string);
      if (endDate) where.startTime.lte = new Date(endDate as string);
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    res.json({
      success: true,
      data: shifts,
    });
  }
);

// POST /api/tenants/:tenantId/shifts
shiftRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const data = createShiftSchema.parse(req.body);

    const shift = await prisma.shift.create({
      data: {
        tenantId,
        userId: data.userId,
        shiftType: data.shiftType,
        cashFloat: data.cashFloat,
        startTime: new Date(),
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'create_shift',
      entityType: 'shift',
      entityId: shift.id,
      afterState: shift,
    });

    res.status(201).json({
      success: true,
      data: shift,
    });
  }
);

// POST /api/tenants/:tenantId/shifts/:id/close
shiftRouter.post(
  '/:id/close',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const shiftId = req.params.id;
    const data = closeShiftSchema.parse(req.body);

    const shift = await prisma.shift.findFirst({
      where: {
        id: shiftId,
        tenantId,
      },
    });

    if (!shift) {
      throw new AppError('Shift not found', 404);
    }

    if (shift.status === 'closed') {
      throw new AppError('Shift is already closed', 400);
    }

    const variance = data.cashCounted && shift.cashFloat
      ? data.cashCounted - (Number(shift.cashFloat) + (data.cashReceived || 0))
      : null;

    const beforeState = { ...shift };
    const updated = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: 'closed',
        endTime: new Date(),
        cashReceived: data.cashReceived,
        cashCounted: data.cashCounted,
        variance,
        notes: data.notes,
        closedAt: new Date(),
        closedBy: req.user!.id,
      },
    });

    // Create alert if variance is significant
    if (variance && Math.abs(variance) > 1000) {
      await createAlert({
        tenantId,
        alertType: 'cash_variance',
        severity: Math.abs(variance) > 5000 ? 'high' : 'medium',
        title: 'Cash Variance Detected',
        message: `Shift ${shiftId} has a cash variance of ₦${Math.abs(variance).toFixed(2)}`,
        metadata: {
          shiftId,
          variance,
          cashFloat: shift.cashFloat,
          cashReceived: data.cashReceived,
          cashCounted: data.cashCounted,
        },
      });
    }

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'close_shift',
      entityType: 'shift',
      entityId: shiftId,
      beforeState,
      afterState: updated,
    });

    res.json({
      success: true,
      data: updated,
    });
  }
);
