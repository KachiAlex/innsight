import { Router } from 'express';
import { prisma } from '../utils/prisma';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';

export const auditRouter = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/audits
auditRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const { userId, action, entityType, entityId, startDate, endDate, limit = '100' } = req.query;

    const where: any = { tenantId };
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const audits = await prisma.audit.findMany({
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
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({
      success: true,
      data: audits,
    });
  }
);
