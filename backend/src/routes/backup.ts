import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import {
  BACKUP_DIR,
  createAndRunBackup,
  deleteBackupFile,
  runPgRestore,
} from '../utils/backupRunner';

const router = Router();

router.use(authenticate, requireRole('iitech_admin'));

const serializeBackup = (b: any) => ({
  id: b.id,
  name: b.name,
  timestamp: b.createdAt.toISOString(),
  size: b.size,
  status: b.status,
  dataTypes: b.dataTypes,
  tenantId: b.tenantId ?? undefined,
});

const serializeSchedule = (s: any) => ({
  id: s.id,
  name: s.name,
  frequency: s.frequency,
  time: s.time,
  retentionDays: s.retentionDays,
  enabled: s.enabled,
  lastRun: s.lastRun?.toISOString(),
  nextRun: s.nextRun?.toISOString(),
});

const nextRunFor = (frequency: string, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date();
  next.setHours(hours || 2, minutes || 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
};

// ===== Backups =====

// GET /api/superadmin/backups
router.get('/backups', async (_req: Request, res: Response) => {
  const backups = await prisma.backupRecord.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ success: true, data: backups.map(serializeBackup) });
});

// POST /api/superadmin/backups — run pg_dump now
router.post('/backups', async (req: Request, res: Response) => {
  const data = z
    .object({
      name: z.string().optional(),
      dataTypes: z.array(z.string()).optional(),
      tenantId: z.string().optional(),
    })
    .parse(req.body);

  const record = await createAndRunBackup({
    name: data.name,
    dataTypes: data.dataTypes,
    tenantId: data.tenantId ?? null,
    createdBy: (req as any).user?.id ?? null,
  });

  res.status(201).json({ success: true, data: serializeBackup(record) });
});

// GET /api/superadmin/backups/:backupId/download
router.get('/backups/:backupId/download', async (req: Request, res: Response) => {
  const backup = await prisma.backupRecord.findUnique({
    where: { id: req.params.backupId },
  });
  if (!backup) {
    res.status(404).json({ success: false, error: { message: 'Backup not found' } });
    return;
  }
  if (backup.status !== 'completed' || !backup.storageKey) {
    res.status(400).json({ success: false, error: { message: 'Backup is not ready' } });
    return;
  }

  const filePath = path.join(BACKUP_DIR, path.basename(backup.storageKey));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      success: false,
      error: { message: 'Backup file is missing from storage' },
    });
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${backup.name.replace(/[^\w.-]+/g, '_')}.dump"`
  );
  fs.createReadStream(filePath).pipe(res);
});

// POST /api/superadmin/backups/:backupId/restore
router.post('/backups/:backupId/restore', async (req: Request, res: Response) => {
  const backup = await prisma.backupRecord.findUnique({
    where: { id: req.params.backupId },
  });
  if (!backup) {
    res.status(404).json({ success: false, error: { message: 'Backup not found' } });
    return;
  }
  if (backup.status !== 'completed' || !backup.storageKey) {
    res.status(400).json({ success: false, error: { message: 'Backup is not restorable' } });
    return;
  }

  const filePath = path.join(BACKUP_DIR, path.basename(backup.storageKey));
  if (!fs.existsSync(filePath)) {
    res.status(404).json({
      success: false,
      error: { message: 'Backup file is missing from storage' },
    });
    return;
  }

  runPgRestore(filePath).catch((err) => {
    console.error(`Restore of backup ${backup.id} failed:`, err);
  });

  res.json({
    success: true,
    data: { message: 'Restore started', backupId: backup.id },
  });
});

// DELETE /api/superadmin/backups/:backupId
router.delete('/backups/:backupId', async (req: Request, res: Response) => {
  const backup = await prisma.backupRecord.findUnique({
    where: { id: req.params.backupId },
  });
  if (!backup) {
    res.status(404).json({ success: false, error: { message: 'Backup not found' } });
    return;
  }

  deleteBackupFile(backup.storageKey);
  await prisma.backupRecord.delete({ where: { id: backup.id } });

  res.json({ success: true, message: 'Backup deleted' });
});

// GET /api/superadmin/backup-metrics
router.get('/backup-metrics', async (_req: Request, res: Response) => {
  const [backups, schedules] = await Promise.all([
    prisma.backupRecord.findMany({
      select: { status: true, size: true, createdAt: true },
    }),
    prisma.backupSchedule.count(),
  ]);

  const completed = backups.filter((b) => b.status === 'completed');
  const failed = backups.filter((b) => b.status === 'failed');
  const lastBackup = [...backups].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  )[0];

  res.json({
    success: true,
    data: {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      lastBackupTime: lastBackup?.createdAt.toISOString(),
      successRate: backups.length ? Math.round((completed.length / backups.length) * 100) : 0,
      failedBackups: failed.length,
      schedules,
    },
  });
});

// ===== Backup schedules =====

// GET /api/superadmin/backup-schedules
router.get('/backup-schedules', async (_req: Request, res: Response) => {
  const schedules = await prisma.backupSchedule.findMany({
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: schedules.map(serializeSchedule) });
});

// POST /api/superadmin/backup-schedules
router.post('/backup-schedules', async (req: Request, res: Response) => {
  const data = z
    .object({
      name: z.string().min(1),
      frequency: z.enum(['daily', 'weekly', 'monthly']),
      time: z.string().regex(/^\d{2}:\d{2}$/).default('02:00'),
      retentionDays: z.number().int().min(1).max(3650).default(30),
      enabled: z.boolean().optional(),
    })
    .parse(req.body);

  const schedule = await prisma.backupSchedule.create({
    data: {
      name: data.name,
      frequency: data.frequency,
      time: data.time,
      retentionDays: data.retentionDays,
      enabled: data.enabled ?? true,
      nextRun: nextRunFor(data.frequency, data.time),
    },
  });

  res.status(201).json({ success: true, data: serializeSchedule(schedule) });
});

// PATCH /api/superadmin/backup-schedules/:scheduleId
router.patch('/backup-schedules/:scheduleId', async (req: Request, res: Response) => {
  const existing = await prisma.backupSchedule.findUnique({
    where: { id: req.params.scheduleId },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
    return;
  }

  const data = z
    .object({
      name: z.string().min(1).optional(),
      frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
      time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      retentionDays: z.number().int().min(1).max(3650).optional(),
      enabled: z.boolean().optional(),
    })
    .parse(req.body);

  const schedule = await prisma.backupSchedule.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...((data.frequency || data.time) && {
        nextRun: nextRunFor(data.frequency || existing.frequency, data.time || existing.time),
      }),
    },
  });

  res.json({ success: true, data: serializeSchedule(schedule) });
});

// DELETE /api/superadmin/backup-schedules/:scheduleId
router.delete('/backup-schedules/:scheduleId', async (req: Request, res: Response) => {
  const existing = await prisma.backupSchedule.findUnique({
    where: { id: req.params.scheduleId },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: { message: 'Schedule not found' } });
    return;
  }

  await prisma.backupSchedule.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Schedule deleted' });
});

export default router;
