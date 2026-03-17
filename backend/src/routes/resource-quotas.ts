import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import {
  getTenantQuotas,
  updateTenantQuotas,
  getTenantResourceUsage,
  checkQuotaWarnings,
  getQuotaUsagePercentages,
} from '../utils/tenantResourceQuotas';

const router = Router();

// Get quotas for a specific tenant
router.get('/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const quotas = await getTenantQuotas(tenantId);
    res.json({ success: true, data: quotas });
  } catch (error: any) {
    console.error('Error fetching tenant quotas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update quotas for a tenant
router.patch('/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const updatedQuotas = await updateTenantQuotas(tenantId, req.body);
    res.json({ success: true, data: updatedQuotas });
  } catch (error: any) {
    console.error('Error updating tenant quotas:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get resource usage for a tenant
router.get('/:tenantId/usage', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const usage = await getTenantResourceUsage(tenantId);
    res.json({ success: true, data: usage });
  } catch (error: any) {
    console.error('Error fetching resource usage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check for quota warnings
router.get('/:tenantId/warnings', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const warnings = await checkQuotaWarnings(tenantId);
    res.json({ success: true, data: warnings });
  } catch (error: any) {
    console.error('Error checking quota warnings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get quota usage percentages
router.get('/:tenantId/percentages', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const percentages = await getQuotaUsagePercentages(tenantId);
    res.json({ success: true, data: percentages });
  } catch (error: any) {
    console.error('Error calculating quota percentages:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
