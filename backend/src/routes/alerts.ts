import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';

export const alertRouter = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/alerts
alertRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const { status, alertType, severity } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (alertType) where.alertType = alertType;
    if (severity) where.severity = severity;

    const { skip, take, page, limit } = getPaginationParams(req);

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          resolver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { severity: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      prisma.alert.count({ where }),
    ]);

    const result = createPaginationResult(alerts, total, page, limit);

    res.json({
      success: true,
      ...result,
    });
  }
);

// POST /api/tenants/:tenantId/alerts/:id/resolve
alertRouter.post(
  '/:id/resolve',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const alertId = req.params.id;

    const alert = await prisma.alert.findFirst({
      where: {
        id: alertId,
        tenantId,
      },
    });

    if (!alert) {
      throw new AppError('Alert not found', 404);
    }

    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        status: 'resolved',
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
      },
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'resolve_alert',
      entityType: 'alert',
      entityId: alertId,
      afterState: updated,
    });

    res.json({
      success: true,
      data: updated,
    });
  }
);
