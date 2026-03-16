import { Router } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { getSuperadminDashboardMetrics, getTopTenantsByRevenue } from '../utils/superadminMetrics';

export const superadminRouter = Router();

/**
 * GET /api/superadmin/dashboard
 * Get comprehensive superadmin dashboard metrics
 * Requires: iitech_admin role
 */
superadminRouter.get(
  '/dashboard',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const metrics = await getSuperadminDashboardMetrics();
      
      res.json({
        success: true,
        data: metrics,
        lastUpdated: new Date(),
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching superadmin dashboard:', error);
      throw new AppError('Failed to fetch dashboard metrics', 500);
    }
  }
);

/**
 * GET /api/superadmin/top-tenants
 * Get top performing tenants by revenue
 * Requires: iitech_admin role
 */
superadminRouter.get(
  '/top-tenants',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
      const topTenants = await getTopTenantsByRevenue(limit);

      res.json({
        success: true,
        data: topTenants,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching top tenants:', error);
      throw new AppError('Failed to fetch top tenants', 500);
    }
  }
);

/**
 * GET /api/superadmin/health
 * Quick system health check
 * Requires: iitech_admin role
 */
superadminRouter.get(
  '/health',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      };

      res.json({
        success: true,
        data: health,
      });
    } catch (error: any) {
      console.error('Error checking health:', error);
      throw new AppError('Failed to check system health', 500);
    }
  }
);
