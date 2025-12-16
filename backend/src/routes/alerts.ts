import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate } from '../utils/firestore';

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

      // Build query - Firestore doesn't support multiple orderBy without composite indexes
      // So we'll fetch all and sort in memory
      let query: FirebaseFirestore.Query = db.collection('alerts')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }

      if (alertType) {
        query = query.where('alertType', '==', alertType);
      }

      if (severity) {
        query = query.where('severity', '==', severity);
      }

      const snapshot = await query.get();
      
      // Transform and filter alerts
      let alerts = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          tenantId: data.tenantId,
          alertType: data.alertType,
          severity: data.severity,
          status: data.status || 'active',
          title: data.title,
          message: data.message,
          metadata: data.metadata || null,
          resolvedBy: data.resolvedBy || null,
          resolvedAt: data.resolvedAt ? toDate(data.resolvedAt) : null,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });

      // Sort by severity (desc) then createdAt (desc)
      alerts.sort((a, b) => {
        const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
        if (severityDiff !== 0) return severityDiff;
        
        const aTime = a.createdAt?.getTime() || 0;
        const bTime = b.createdAt?.getTime() || 0;
        return bTime - aTime;
      });

      // Get resolver information for resolved alerts
      const alertsWithResolvers = await Promise.all(
        alerts.map(async (alert) => {
          if (alert.resolvedBy) {
            try {
              const resolverDoc = await db.collection('users').doc(alert.resolvedBy).get();
              if (resolverDoc.exists) {
                const resolverData = resolverDoc.data();
                return {
                  ...alert,
                  resolver: {
                    id: resolverDoc.id,
                    firstName: resolverData?.firstName || null,
                    lastName: resolverData?.lastName || null,
                  },
                };
              }
            } catch (error) {
              console.warn('Error fetching resolver:', error);
            }
          }
          return {
            ...alert,
            resolver: null,
          };
        })
      );

      // Apply pagination
      const total = alertsWithResolvers.length;
      const paginatedAlerts = alertsWithResolvers.slice(skip, skip + take);

      const result = createPaginationResult(paginatedAlerts, total, page, limit);

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

      const alertDoc = await db.collection('alerts').doc(alertId).get();

      if (!alertDoc.exists) {
        throw new AppError('Alert not found', 404);
      }

      const alertData = alertDoc.data();
      if (alertData?.tenantId !== tenantId) {
        throw new AppError('Alert not found', 404);
      }

      const beforeState = {
        id: alertDoc.id,
        ...alertData,
        resolvedBy: alertData?.resolvedBy || null,
        resolvedAt: alertData?.resolvedAt ? toDate(alertData.resolvedAt) : null,
        createdAt: toDate(alertData?.createdAt),
        updatedAt: toDate(alertData?.updatedAt),
      };

      // Update alert
      await alertDoc.ref.update({
        status: 'resolved',
        resolvedBy: req.user!.id,
        resolvedAt: now(),
        updatedAt: now(),
      });

      // Get updated alert
      const updatedDoc = await db.collection('alerts').doc(alertId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        resolvedBy: updatedData?.resolvedBy || null,
        resolvedAt: updatedData?.resolvedAt ? toDate(updatedData.resolvedAt) : null,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'resolve_alert',
        entityType: 'alert',
        entityId: alertId,
        beforeState,
        afterState: updated,
      });

      res.json({
        success: true,
        data: updated,
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
