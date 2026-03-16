import express, { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import * as apiManagement from '../utils/apiManagement';

const router = Router();

// Middleware to verify superadmin
router.use(requireRole('iitech_admin'));

// Get API keys
router.get('/keys', async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = 50, offset = 0 } = req.query;

    const keys = await apiManagement.getApiKeys(
      tenantId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: keys,
      count: keys.length,
    });
  } catch (error: any) {
    console.error('Error fetching keys:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get single API key
router.get('/keys/:keyId', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const key = await apiManagement.getApiKey(keyId);

    if (!key) {
      return res.status(404).json({ success: false, error: { message: 'API key not found' } });
    }

    res.json({ success: true, data: key });
  } catch (error: any) {
    console.error('Error fetching key:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create API key
router.post('/keys', async (req: Request, res: Response) => {
  try {
    const { name, tenantId, scopes, rateLimit, allowedIPs } = req.body;
    const userId = (req as any).user?.id;

    if (!name || !scopes || !rateLimit) {
      return res.status(400).json({
        success: false,
        error: { message: 'Missing required fields' },
      });
    }

    const key = await apiManagement.createApiKey({
      name,
      secret: `sk_secret_${Math.random().toString(36).substr(2, 30)}`,
      key: `sk_${Math.random().toString(36).substr(2, 20)}`,
      tenantId,
      scopes,
      rateLimit,
      allowedIPs,
      status: 'active',
      createdBy: userId || 'system',
    });

    res.status(201).json({ success: true, data: key, warning: 'Secret will only be shown once' });
  } catch (error: any) {
    console.error('Error creating key:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Revoke API key
router.post('/keys/:keyId/revoke', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const updated = await apiManagement.revokeApiKey(keyId);

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'API key not found' } });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error revoking key:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update API key
router.patch('/keys/:keyId', async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    const updates = req.body;

    const updated = await apiManagement.updateApiKey(keyId, updates);

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'API key not found' } });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating key:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get API metrics
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    const metrics = await apiManagement.getApiMetrics(
      from && to ? { from: from as string, to: to as string } : undefined
    );

    res.json({ success: true, data: metrics });
  } catch (error: any) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

export default router;
