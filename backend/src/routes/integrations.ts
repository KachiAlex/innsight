import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import {
  createIntegration,
  getAllIntegrations,
  getTenantIntegrations,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
  getIntegrationStats,
} from '../utils/integrationManagement';
import { prisma } from '../utils/prisma';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// List all integrations (superadmin platform view)
router.get('/', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const integrations = await getAllIntegrations();
    res.json({ success: true, data: integrations });
    return;
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Get all integrations for a tenant
router.get('/tenant/:tenantId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const integrations = await getTenantIntegrations(tenantId);
    res.json({ success: true, data: integrations });
  } catch (error: any) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a new integration
router.post('/', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const integration = await createIntegration(
      req.body.tenantId ?? null,
      req.body,
      (req as AuthRequest).user?.id
    );
    res.json({ success: true, data: integration });
    return;
  } catch (error: any) {
    console.error('Error creating integration:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Update integration
router.patch('/:integrationId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const integration = await updateIntegration(integrationId, req.body);
    res.json({ success: true, data: integration });
  } catch (error: any) {
    console.error('Error updating integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test integration connection
router.post('/:integrationId/test', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const result = await testIntegrationConnection(integrationId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Error testing integration connection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get integration statistics (scoped to the integration's tenant)
router.get('/:integrationId/stats', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const integration = await prisma.integration.findUnique({ where: { id: integrationId } });
    if (!integration) {
      res.status(404).json({ success: false, error: { message: 'Integration not found' } });
      return;
    }
    const stats = integration.tenantId
      ? await getIntegrationStats(integration.tenantId)
      : { total: 1, active: integration.status === 'active' ? 1 : 0, inactive: 0, errors: 0, byType: {} };
    res.json({ success: true, data: stats });
    return;
  } catch (error: any) {
    console.error('Error fetching integration stats:', error);
    res.status(500).json({ success: false, error: error.message });
    return;
  }
});

// Delete integration
router.delete('/:integrationId', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    await deleteIntegration(integrationId);
    res.json({ success: true, message: 'Integration deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting integration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
