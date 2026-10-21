import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  upsertRetentionPolicy,
  getTenantRetentionPolicies,
  getAllRetentionPolicies,
  getRetentionStats,
  cleanupOldData,
  deleteRetentionPolicy,
} from '../utils/dataRetentionPolicies';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// List all retention policies (superadmin platform view)
router.get('/', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const policies = await getAllRetentionPolicies();
    res.json({ success: true, data: policies });
    return;
  } catch (error: any) {
    console.error('Error fetching retention policies:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Get all retention policies for a tenant
router.get('/tenant/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const policies = await getTenantRetentionPolicies(tenantId);
    res.json({ success: true, data: policies });
  } catch (error: any) {
    console.error('Error fetching retention policies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update a retention policy
router.post('/', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const policy = await upsertRetentionPolicy(
      req.body.tenantId ?? null,
      req.body,
      (req as AuthRequest).user?.id
    );
    res.json({ success: true, data: policy });
    return;
  } catch (error: any) {
    console.error('Error upserting retention policy:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Update retention policy
router.patch('/:policyId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { policyId } = req.params;
    const existing = await prisma.retentionPolicy.findUnique({ where: { id: policyId } });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'Policy not found' } });
      return;
    }
    const policy = await upsertRetentionPolicy(
      req.body.tenantId ?? existing.tenantId,
      { id: policyId, ...req.body },
      (req as AuthRequest).user?.id
    );
    res.json({ success: true, data: policy });
    return;
  } catch (error: any) {
    console.error('Error updating retention policy:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Get retention statistics
router.get('/stats/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const stats = await getRetentionStats(tenantId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching retention stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Execute cleanup for old data
router.post('/cleanup/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const result = await cleanupOldData(tenantId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error executing cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete retention policy
router.delete('/:policyId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { policyId } = req.params;
    await deleteRetentionPolicy(policyId);
    res.json({ success: true, message: 'Policy deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting retention policy:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
