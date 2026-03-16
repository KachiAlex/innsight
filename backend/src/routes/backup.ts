import express, { Router, Request, Response } from 'express';
import { requireRole } from '../middleware/auth';
import * as backupManagement from '../utils/backupManagement';

const router = Router();

// Middleware to verify superadmin
router.use(requireRole('iitech_admin'));

// Get backups
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = 50, offset = 0 } = req.query;

    const backups = await backupManagement.getBackups(
      tenantId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: backups,
      count: backups.length,
    });
  } catch (error: any) {
    console.error('Error fetching backups:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get single backup
router.get('/:backupId', async (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    const backup = await backupManagement.getBackup(backupId);

    if (!backup) {
      return res.status(404).json({ success: false, error: { message: 'Backup not found' } });
    }

    res.json({ success: true, data: backup });
  } catch (error: any) {
    console.error('Error fetching backup:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create backup
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, tenantId, type, retentionDays = 30, expiresAt } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        success: false,
        error: { message: 'name and type are required' },
      });
    }

    const backup = await backupManagement.createBackup({
      name,
      tenantId,
      type: type as backupManagement.BackupType,
      scheduledBackup: false,
      retentionDays,
      expiresAt: expiresAt || new Date(Date.now() + retentionDays * 86400000).toISOString(),
      fileLocation: `s3://innsight-backups/${tenantId ? `tenants/${tenantId}` : 'platform'}/${Date.now()}-${type}.tar.gz`,
    });

    res.status(201).json({ success: true, data: backup });
  } catch (error: any) {
    console.error('Error creating backup:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Delete backup
router.delete('/:backupId', async (req: Request, res: Response) => {
  try {
    const { backupId } = req.params;
    const deleted = await backupManagement.deleteBackup(backupId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: { message: 'Backup not found' } });
    }

    res.json({ success: true, data: { message: 'Backup deleted successfully' } });
  } catch (error: any) {
    console.error('Error deleting backup:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get backup schedules
router.get('/schedules/list', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const schedules = await backupManagement.getBackupSchedules(tenantId as string);

    res.json({ success: true, data: schedules });
  } catch (error: any) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get single backup schedule
router.get('/schedules/:scheduleId', async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const schedule = await backupManagement.getBackupSchedule(scheduleId);

    if (!schedule) {
      return res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
    }

    res.json({ success: true, data: schedule });
  } catch (error: any) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create backup schedule
router.post('/schedules', async (req: Request, res: Response) => {
  try {
    const { name, tenantId, frequency, time, backupType, retentionDays = 30 } = req.body;

    if (!name || !frequency || !time || !backupType) {
      return res.status(400).json({
        success: false,
        error: { message: 'name, frequency, time, and backupType are required' },
      });
    }

    const schedule = await backupManagement.createBackupSchedule({
      name,
      tenantId,
      enabled: true,
      frequency: frequency as backupManagement.BackupSchedule['frequency'],
      time,
      backupType: backupType as backupManagement.BackupType,
      retentionDays,
      maxBackups: 30,
      notifyOnFailure: true,
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (error: any) {
    console.error('Error creating schedule:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Update backup schedule
router.patch('/schedules/:scheduleId', async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const updates = req.body;

    const updated = await backupManagement.updateBackupSchedule(scheduleId, updates);

    if (!updated) {
      return res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
    }

    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Error updating schedule:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Delete backup schedule
router.delete('/schedules/:scheduleId', async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const deleted = await backupManagement.deleteBackupSchedule(scheduleId);

    if (!deleted) {
      return res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
    }

    res.json({ success: true, data: { message: 'Schedule deleted successfully' } });
  } catch (error: any) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Create restore request
router.post('/restore', async (req: Request, res: Response) => {
  try {
    const { backupId, tenantId } = req.body;
    const userId = (req as any).user?.id;

    if (!backupId) {
      return res.status(400).json({
        success: false,
        error: { message: 'backupId is required' },
      });
    }

    const restoreRequest = await backupManagement.createRestoreRequest({
      backupId,
      tenantId,
      requestedBy: userId || 'system',
    });

    res.status(201).json({ success: true, data: restoreRequest });
  } catch (error: any) {
    console.error('Error creating restore request:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get restore requests
router.get('/restore/history', async (req: Request, res: Response) => {
  try {
    const { tenantId, limit = 50, offset = 0 } = req.query;

    const requests = await backupManagement.getRestoreRequests(
      tenantId as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error: any) {
    console.error('Error fetching restore requests:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

// Get backup statistics
router.get('/stats/overview', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const stats = await backupManagement.getBackupStats(tenantId as string);

    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: { message: error.message } });
  }
});

export default router;
