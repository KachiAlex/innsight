/**
 * System Health Routes
 */

import { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import { getSystemHealth } from '../utils/systemHealth';

export const systemHealthRouter = Router();

// Middleware to ensure admin access
systemHealthRouter.use(requireRole('iitech_admin'));

// Get current system health
systemHealthRouter.get('/', async (req: Request, res: Response) => {
  try {
    const health = await getSystemHealth();
    res.json({ data: health });
  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(500).json({ error: 'Failed to get system health' });
  }
});
