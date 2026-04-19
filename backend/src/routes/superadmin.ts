import { Router } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
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

/**
 * GET /api/superadmin/tenants
 * List all tenants with pagination and filters
 * Requires: iitech_admin role
 */
superadminRouter.get(
  '/tenants',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const skip = (page - 1) * limit;
      const search = req.query.search as string;
      const status = req.query.status as string;

      const whereClause: any = {};
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { slug: { contains: search, mode: 'insensitive' } },
        ];
      }
      if (status && ['active', 'suspended', 'trial', 'inactive'].includes(status)) {
        whereClause.subscriptionStatus = status;
      }

      const [tenants, total] = await Promise.all([
        prisma?.tenant.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            slug: true,
            subscriptionStatus: true,
            createdAt: true,
            _count: {
              select: {
                users: true,
                rooms: true,
              },
            },
          },
        }) || [],
        prisma?.tenant.count({ where: whereClause }) || 0,
      ]);

      res.json({
        success: true,
        data: {
          tenants,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching tenants:', error);
      throw new AppError('Failed to fetch tenants', 500);
    }
  }
);

/**
 * GET /api/superadmin/tenants/:id
 * Get tenant details with statistics
 * Requires: iitech_admin role
 */
superadminRouter.get(
  '/tenants/:id',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const tenant = await prisma?.tenant.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              users: true,
              rooms: true,
              reservations: true,
            },
          },
        },
      });

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      // Get revenue for this tenant
      const revenueAgg = await prisma?.reservation.aggregate({
        where: { tenantId: id },
        _sum: { totalPrice: true },
        _count: { id: true },
      }) || { _sum: { totalPrice: 0 }, _count: { id: 0 } };

      res.json({
        success: true,
        data: {
          ...tenant,
          statistics: {
            totalRevenue: revenueAgg._sum.totalPrice || 0,
            totalReservations: revenueAgg._count.id,
          },
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching tenant details:', error);
      throw new AppError('Failed to fetch tenant details', 500);
    }
  }
);

/**
 * PATCH /api/superadmin/tenants/:id/status
 * Update tenant subscription status (suspend/activate)
 * Requires: iitech_admin role
 */
superadminRouter.patch(
  '/tenants/:id/status',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['active', 'suspended', 'trial', 'inactive'].includes(status)) {
        throw new AppError('Invalid status value', 400);
      }

      const tenant = await prisma?.tenant.update({
        where: { id },
        data: { subscriptionStatus: status },
      });

      res.json({
        success: true,
        data: tenant,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating tenant status:', error);
      throw new AppError('Failed to update tenant status', 500);
    }
  }
);

/**
 * DELETE /api/superadmin/tenants/:id
 * Delete a tenant
 * Requires: iitech_admin role
 */
superadminRouter.delete(
  '/tenants/:id',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      await prisma?.tenant.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'Tenant deleted successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting tenant:', error);
      throw new AppError('Failed to delete tenant', 500);
    }
  }
);
