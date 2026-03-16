/**
 * Billing & Subscriptions API Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  getSubscriptionPlans,
  getTenantSubscription,
  updateTenantSubscription,
  suspendTenantSubscription,
  resumeTenantSubscription,
  getTenantInvoices,
  generateInvoice,
  getBillingMetrics,
} from '../utils/billingManagement';
import { createAuditLog } from '../utils/audit';

export const billingRouter = Router();

const updateSubscriptionSchema = z.object({
  planId: z.string(),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
});

/**
 * GET /api/superadmin/billing/plans - List all subscription plans
 */
billingRouter.get(
  '/plans',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const plans = await getSubscriptionPlans();
      res.json({
        success: true,
        data: plans,
      });
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      throw new AppError('Failed to fetch subscription plans', 500);
    }
  }
);

/**
 * GET /api/superadmin/billing/metrics - Get billing metrics
 */
billingRouter.get(
  '/metrics',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const metrics = await getBillingMetrics();
      res.json({
        success: true,
        data: metrics,
      });
    } catch (error: any) {
      console.error('Error fetching billing metrics:', error);
      throw new AppError('Failed to fetch billing metrics', 500);
    }
  }
);

/**
 * GET /api/superadmin/billing/tenants/:tenantId/subscription - Get tenant subscription
 */
billingRouter.get(
  '/tenants/:tenantId/subscription',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const subscription = await getTenantSubscription(req.params.tenantId);
      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }
      res.json({
        success: true,
        data: subscription,
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error fetching subscription:', error);
      throw new AppError('Failed to fetch subscription', 500);
    }
  }
);

/**
 * PATCH /api/superadmin/billing/tenants/:tenantId/subscription - Update subscription
 */
billingRouter.patch(
  '/tenants/:tenantId/subscription',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const data = updateSubscriptionSchema.parse(req.body);
      const subscription = await updateTenantSubscription(
        req.params.tenantId,
        data.planId,
        data.billingCycle
      );

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'update_subscription',
          entityType: 'subscription',
          entityId: req.params.tenantId,
          metadata: { planId: data.planId },
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        data: subscription,
        message: 'Subscription updated successfully',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new AppError(`Validation error: ${error.errors[0].message}`, 400);
      }
      if (error instanceof AppError) throw error;
      console.error('Error updating subscription:', error);
      throw new AppError(error.message || 'Failed to update subscription', 400);
    }
  }
);

/**
 * POST /api/superadmin/billing/tenants/:tenantId/suspend - Suspend subscription
 */
billingRouter.post(
  '/tenants/:tenantId/suspend',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      await suspendTenantSubscription(req.params.tenantId);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'suspend_subscription',
          entityType: 'subscription',
          entityId: req.params.tenantId,
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'Subscription suspended successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error suspending subscription:', error);
      throw new AppError('Failed to suspend subscription', 500);
    }
  }
);

/**
 * POST /api/superadmin/billing/tenants/:tenantId/resume - Resume subscription
 */
billingRouter.post(
  '/tenants/:tenantId/resume',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      await resumeTenantSubscription(req.params.tenantId);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'resume_subscription',
          entityType: 'subscription',
          entityId: req.params.tenantId,
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'Subscription resumed successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error resuming subscription:', error);
      throw new AppError('Failed to resume subscription', 500);
    }
  }
);

/**
 * GET /api/superadmin/billing/tenants/:tenantId/invoices - Get tenant invoices
 */
billingRouter.get(
  '/tenants/:tenantId/invoices',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
      const invoices = await getTenantInvoices(req.params.tenantId, limit);
      res.json({
        success: true,
        data: invoices,
      });
    } catch (error: any) {
      console.error('Error fetching invoices:', error);
      throw new AppError('Failed to fetch invoices', 500);
    }
  }
);
