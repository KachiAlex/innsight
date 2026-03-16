/**
 * Platform Analytics API Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  getPlatformAnalytics,
  getTenantComparison,
  getRevenueTrends,
  getOccupancyTrends,
  generateCustomReport,
} from '../utils/platformAnalytics';

export const platformAnalyticsRouter = Router();

const customReportSchema = z.object({
  metrics: z.array(z.string()),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

/**
 * GET /api/superadmin/analytics - Get comprehensive platform analytics
 */
platformAnalyticsRouter.get(
  '/',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const daysBack = Math.min(parseInt(req.query.days as string) || 30, 365);
      const analytics = await getPlatformAnalytics(daysBack);
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      throw new AppError('Failed to fetch analytics', 500);
    }
  }
);

/**
 * GET /api/superadmin/analytics/tenants/comparison - Compare tenant performance
 */
platformAnalyticsRouter.get(
  '/tenants/comparison',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 500);
      const comparison = await getTenantComparison(limit);
      res.json({
        success: true,
        data: comparison,
      });
    } catch (error: any) {
      console.error('Error fetching tenant comparison:', error);
      throw new AppError('Failed to fetch tenant comparison', 500);
    }
  }
);

/**
 * GET /api/superadmin/analytics/revenue-trends - Get revenue trends
 */
platformAnalyticsRouter.get(
  '/revenue-trends',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const daysBack = Math.min(parseInt(req.query.days as string) || 90, 365);
      const trends = await getRevenueTrends(daysBack);
      res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      console.error('Error fetching revenue trends:', error);
      throw new AppError('Failed to fetch revenue trends', 500);
    }
  }
);

/**
 * GET /api/superadmin/analytics/occupancy-trends - Get occupancy trends
 */
platformAnalyticsRouter.get(
  '/occupancy-trends',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const daysBack = Math.min(parseInt(req.query.days as string) || 90, 365);
      const trends = await getOccupancyTrends(daysBack);
      res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      console.error('Error fetching occupancy trends:', error);
      throw new AppError('Failed to fetch occupancy trends', 500);
    }
  }
);

/**
 * POST /api/superadmin/analytics/custom-report - Generate custom report
 */
platformAnalyticsRouter.post(
  '/custom-report',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const data = customReportSchema.parse(req.body);
      const report = await generateCustomReport(data.metrics, new Date(data.startDate), new Date(data.endDate));
      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new AppError(`Validation error: ${error.errors[0].message}`, 400);
      }
      console.error('Error generating report:', error);
      throw new AppError('Failed to generate report', 500);
    }
  }
);

export default platformAnalyticsRouter;
