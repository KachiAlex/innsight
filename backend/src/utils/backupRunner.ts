import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { prisma } from './prisma';

const execFileAsync = promisify(execFile);

export const BACKUP_DIR =
  process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

const DEFAULT_RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);

export const runPgDump = async (filePath: string) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not configured');
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  await execFileAsync(
    'pg_dump',
    ['--format=custom', '--compress=6', '--file', filePath, databaseUrl],
    { timeout: 10 * 60 * 1000 }
  );
};

export const runPgRestore = async (filePath: string) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL not configured');
  await execFileAsync(
    'pg_restore',
    [
      '--clean',
      '--if-exists',
      '--no-owner',
      '--no-privileges',
      '--exit-on-error',
      '--dbname',
      databaseUrl,
      filePath,
    ],
    { timeout: 10 * 60 * 1000 }
  );
};

const nextRunFor = (frequency: string, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const next = new Date();
  next.setHours(hours || 2, minutes || 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  if (frequency === 'weekly') next.setDate(next.getDate() + 7);
  if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
  return next;
};

export const deleteBackupFile = (storageKey: string | null) => {
  if (!storageKey) return;
  const filePath = path.join(BACKUP_DIR, path.basename(storageKey));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
};

const runBackup = async (recordId: string, fileName: string) => {
  const filePath = path.join(BACKUP_DIR, fileName);
  try {
    await runPgDump(filePath);
    const size = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
    await prisma.backupRecord.update({
      where: { id: recordId },
      data: {
        status: 'completed',
        size,
        storageKey: fileName,
        completedAt: new Date(),
      },
    });
  } catch (err: any) {
    await prisma.backupRecord.update({
      where: { id: recordId },
      data: { status: 'failed', error: String(err?.message || err).slice(0, 500) },
    }).catch(() => {});
  }
};

export const createAndRunBackup = async (params: {
  name?: string;
  dataTypes?: string[];
  tenantId?: string | null;
  scheduleId?: string | null;
  createdBy?: string | null;
}) => {
  const record = await prisma.backupRecord.create({
    data: {
      name: params.name || `Manual Backup ${new Date().toISOString().slice(0, 10)}`,
      status: 'in_progress',
      dataTypes: params.dataTypes?.length ? params.dataTypes : ['database'],
      tenantId: params.tenantId ?? null,
      scheduleId: params.scheduleId ?? null,
      createdBy: params.createdBy ?? null,
    },
  });

  // Fire-and-forget — callers return immediately
  void runBackup(record.id, `${record.id}.dump`);
  return record;
};

// Delete records + files past their retention window.
// Scheduled backups use their schedule's retentionDays; manual backups use
// BACKUP_RETENTION_DAYS (default 30).
export const pruneExpiredBackups = async () => {
  const schedules = await prisma.backupSchedule.findMany({
    select: { id: true, retentionDays: true },
  });
  const now = Date.now();

  const expiredIds = new Set<string>();
  const candidates = await prisma.backupRecord.findMany({
    where: { status: { in: ['completed', 'failed'] } },
    select: { id: true, scheduleId: true, createdAt: true, storageKey: true },
  });

  const retentionFor = (scheduleId: string | null) => {
    if (!scheduleId) return DEFAULT_RETENTION_DAYS;
    return schedules.find((s) => s.id === scheduleId)?.retentionDays ?? DEFAULT_RETENTION_DAYS;
  };

  for (const record of candidates) {
    const ageMs = now - record.createdAt.getTime();
    if (ageMs > retentionFor(record.scheduleId) * 24 * 60 * 60 * 1000) {
      expiredIds.add(record.id);
      deleteBackupFile(record.storageKey);
    }
  }

  if (expiredIds.size > 0) {
    await prisma.backupRecord.deleteMany({
      where: { id: { in: [...expiredIds] } },
    });
    console.log(`[backup] Pruned ${expiredIds.size} expired backup(s)`);
  }

  return expiredIds.size;
};

// Execute enabled schedules whose nextRun has arrived.
export const runDueBackupSchedules = async () => {
  const due = await prisma.backupSchedule.findMany({
    where: { enabled: true, nextRun: { lte: new Date() } },
  });

  for (const schedule of due) {
    // Claim the run before executing so a slow dump can't double-fire
    await prisma.backupSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRun: new Date(),
        nextRun: nextRunFor(schedule.frequency, schedule.time),
      },
    });

    console.log(`[backup] Running scheduled backup "${schedule.name}"`);
    await createAndRunBackup({
      name: `${schedule.name} ${new Date().toISOString().slice(0, 10)}`,
      scheduleId: schedule.id,
    });
  }

  await pruneExpiredBackups();
  return due.length;
};
