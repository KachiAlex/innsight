/**
 * Tenant Quick Actions Routes
 * Quick admin actions for tenant management
 */

import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import {
  suspendTenant,
  reactivateTenant,
  deleteTenant,
  getTenantQuickStatus,
  batchSuspendTenants,
  batchReactivateTenants,
} from '../utils/tenantQuickActions';

export const tenantQuickActionsRouter = Router();

// Middleware to ensure admin access
tenantQuickActionsRouter.use(requireRole('iitech_admin'));

// Get tenant quick status (UI indicator)
tenantQuickActionsRouter.get('/:tenantId/status', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const status = await getTenantQuickStatus(tenantId);
    res.json({ data: status });
  } catch (error) {
    console.error('Error getting tenant status:', error);
    res.status(500).json({ error: 'Failed to get tenant status' });
  }
});

// Suspend a tenant
tenantQuickActionsRouter.post('/:tenantId/suspend', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { reason } = req.body;
    const userId = (req as any).user?.id;

    const tenant = await suspendTenant(tenantId, reason, userId);
    res.json({
      data: tenant,
      message: 'Tenant suspended successfully',
    });
  } catch (error) {
    console.error('Error suspending tenant:', error);
    res.status(500).json({ error: 'Failed to suspend tenant' });
  }
});

// Reactivate a suspended tenant
tenantQuickActionsRouter.post('/:tenantId/reactivate', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.id;

    const tenant = await reactivateTenant(tenantId, userId);
    res.json({
      data: tenant,
      message: 'Tenant reactivated successfully',
    });
  } catch (error) {
    console.error('Error reactivating tenant:', error);
    res.status(500).json({ error: 'Failed to reactivate tenant' });
  }
});

// Delete a tenant (soft delete)
tenantQuickActionsRouter.post('/:tenantId/delete', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const userId = (req as any).user?.id;

    // Confirmation check
    const { confirm } = req.body;
    if (!confirm) {
      return res.status(400).json({ error: 'Must confirm deletion' });
    }

    const tenant = await deleteTenant(tenantId, userId);
    res.json({
      data: tenant,
      message: 'Tenant deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// Batch suspend tenants
tenantQuickActionsRouter.post('/batch/suspend', async (req: Request, res: Response) => {
  try {
    const { tenantIds, reason } = req.body;
    const userId = (req as any).user?.id;

    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: 'Invalid tenant IDs' });
    }

    const results = await batchSuspendTenants(tenantIds, reason, userId);
    const succeeded = results.filter((r) => r.success).length;

    res.json({
      data: results,
      summary: {
        total: tenantIds.length,
        succeeded,
        failed: tenantIds.length - succeeded,
      },
    });
  } catch (error) {
    console.error('Error batch suspending tenants:', error);
    res.status(500).json({ error: 'Failed to batch suspend tenants' });
  }
});

// Batch reactivate tenants
tenantQuickActionsRouter.post('/batch/reactivate', async (req: Request, res: Response) => {
  try {
    const { tenantIds } = req.body;
    const userId = (req as any).user?.id;

    if (!Array.isArray(tenantIds) || tenantIds.length === 0) {
      return res.status(400).json({ error: 'Invalid tenant IDs' });
    }

    const results = await batchReactivateTenants(tenantIds, userId);
    const succeeded = results.filter((r) => r.success).length;

    res.json({
      data: results,
      summary: {
        total: tenantIds.length,
        succeeded,
        failed: tenantIds.length - succeeded,
      },
    });
  } catch (error) {
    console.error('Error batch reactivating tenants:', error);
    res.status(500).json({ error: 'Failed to batch reactivate tenants' });
  }
});
