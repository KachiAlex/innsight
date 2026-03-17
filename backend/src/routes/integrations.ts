import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import {
  createIntegration,
  getTenantIntegrations,
  updateIntegration,
  deleteIntegration,
  testIntegrationConnection,
  getIntegrationStats,
} from '../utils/integrationManagement';

const router = Router();

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
    const integration = await createIntegration(req.body);
    res.json({ success: true, data: integration });
  } catch (error: any) {
    console.error('Error creating integration:', error);
    res.status(500).json({ success: false, error: error.message });
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

// Get integration statistics
router.get('/:integrationId/stats', requireRole('iitech_admin'), async (req: Request, res: Response) => {
  try {
    const { integrationId } = req.params;
    const stats = await getIntegrationStats(integrationId);
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching integration stats:', error);
    res.status(500).json({ success: false, error: error.message });
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
