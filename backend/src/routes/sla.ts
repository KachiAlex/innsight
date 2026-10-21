import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  getPlatformUptimeMetrics,
  getTenantSLACompliance,
  upsertSLAAgreement,
  getAllSLAAgreements,
  checkSLAViolations,
  getSLADashboardSummary,
} from '../utils/slaManagement';
import { prisma } from '../utils/prisma';

const router = Router();

router.use(authenticate);

// Get platform uptime metrics
router.get('/metrics/uptime', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const metrics = await getPlatformUptimeMetrics();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error('Error fetching uptime metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get SLA compliance for a tenant
router.get('/compliance/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const compliance = await getTenantSLACompliance(tenantId);
    res.json({ success: true, data: compliance });
  } catch (error: any) {
    console.error('Error fetching SLA compliance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all SLA agreements
router.get('/agreements', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const agreements = await getAllSLAAgreements();
    res.json({ success: true, data: agreements });
  } catch (error: any) {
    console.error('Error fetching SLA agreements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create or update SLA agreement
router.post('/agreements', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const tenantId = req.body.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: { message: 'tenantId is required' } });
      return;
    }
    const agreement = await upsertSLAAgreement(tenantId, req.body);
    res.json({ success: true, data: agreement });
    return;
  } catch (error: any) {
    console.error('Error creating/updating SLA agreement:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Update SLA agreement
router.patch('/agreements/:agreementId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { agreementId } = req.params;
    const existing = await prisma.sLAAgreement.findUnique({ where: { id: agreementId } });
    if (!existing) {
      res.status(404).json({ success: false, error: { message: 'SLA agreement not found' } });
      return;
    }
    const agreement = await upsertSLAAgreement(existing.tenantId, req.body);
    res.json({ success: true, data: agreement });
    return;
  } catch (error: any) {
    console.error('Error updating SLA agreement:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Check SLA violations for a tenant
router.get('/violations/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const violations = await checkSLAViolations(req.params.tenantId);
    res.json({ success: true, data: violations });
    return;
  } catch (error: any) {
    console.error('Error checking SLA violations:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Get SLA dashboard summary
router.get('/summary', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const summary = await getSLADashboardSummary();
    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('Error fetching SLA summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
