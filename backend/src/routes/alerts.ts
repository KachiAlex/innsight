import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';

export const alertRouter = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/alerts
alertRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, alertType, severity } = req.query;

      const { skip, take, page, limit } = getPaginationParams(req);

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Build where clause
      const where: any = { tenantId };

      if (status) {
        where.status = status;
      }

      if (alertType) {
        where.alertType = alertType;
      }

      if (severity) {
        where.severity = severity;
      }

      // Get alerts with resolver information
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

      // Transform alerts to match expected format
      const transformedAlerts = alerts.map(alert => ({
        id: alert.id,
        tenantId: alert.tenantId,
        alertType: alert.alertType,
        severity: alert.severity,
        status: alert.status,
        title: alert.title,
        message: alert.message,
        metadata: alert.metadata,
        resolvedBy: alert.resolvedBy,
        resolvedAt: alert.resolvedAt,
        createdAt: alert.createdAt,
        updatedAt: alert.updatedAt,
        resolver: alert.resolver,
      }));

      const result = createPaginationResult(transformedAlerts, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      throw new AppError(
        `Failed to fetch alerts: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/alerts/:id/resolve
alertRouter.post(
  '/:id/resolve',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const alertId = req.params.id;

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Get the alert
      const alert = await prisma.alert.findUnique({
        where: { id: alertId },
        include: {
          resolver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!alert || alert.tenantId !== tenantId) {
        throw new AppError('Alert not found', 404);
      }

      const beforeState = {
        id: alert.id,
        ...alert,
        resolver: alert.resolver,
      };

      // Update alert
      const updatedAlert = await prisma.alert.update({
        where: { id: alertId },
        data: {
          status: 'resolved',
          resolvedBy: req.user!.id,
          resolvedAt: new Date(),
        },
        include: {
          resolver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      const afterState = {
        id: updatedAlert.id,
        ...updatedAlert,
        resolver: updatedAlert.resolver,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'resolve_alert',
        entityType: 'alert',
        entityId: alertId,
        beforeState,
        afterState,
      });

      res.json({
        success: true,
        data: afterState,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error resolving alert:', error);
      throw new AppError(
        `Failed to resolve alert: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);
