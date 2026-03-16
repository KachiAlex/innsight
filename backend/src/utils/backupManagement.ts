import { createAuditLog } from './audit';

export type BackupType = 'full' | 'incremental' | 'differential';
export type BackupStatus = 'pending' | 'in-progress' | 'completed' | 'failed';
export type RestoreStatus = 'pending' | 'in-progress' | 'completed' | 'failed';

export interface Backup {
  id: string;
  tenantId?: string; // if empty, it's a platform backup
  name: string;
  type: BackupType;
  status: BackupStatus;
  size: number; // in bytes
  fileLocation: string; // S3 path or storage location
  itemsBackedUp: {
    rooms: number;
    reservations: number;
    users: number;
    settings: number;
    transactions?: number;
  };
  scheduledBackup: boolean;
  createdAt: string;
  completedAt?: string;
  expiresAt: string; // when it will be deleted
  retentionDays: number;
  errorMessage?: string;
}

export interface BackupSchedule {
  id: string;
  tenantId?: string;
  name: string;
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:mm format
  backupType: BackupType;
  retentionDays: number;
  maxBackups: number;
  notifyOnFailure: boolean;
  notifyEmail?: string;
  createdAt: string;
  lastRun?: string;
}

export interface RestorePoint {
  id: string;
  backupId: string;
  tenantId?: string;
  timestamp: string;
  description?: string;
  verified: boolean;
  estimatedRestoreTime: number; // minutes
}

export interface RestoreRequest {
  id: string;
  backupId: string;
  tenantId?: string;
  requestedBy: string;
  status: RestoreStatus;
  startedAt?: string;
  completedAt?: string;
  itemsRestored?: {
    rooms: number;
    reservations: number;
    users: number;
    settings: number;
  };
  errorMessage?: string;
  createdAt: string;
}

// Mock storage
const backupsStorage = new Map<string, Backup>();
const schedulesStorage = new Map<string, BackupSchedule>();
const restoresStorage = new Map<string, RestoreRequest>();

// Initialize mock data
const initializeMockData = () => {
  if (backupsStorage.size === 0) {
    const now = Date.now();
    const mockBackups: Backup[] = [
      {
        id: 'bak-001',
        name: 'Platform Full Backup 2026-03-16',
        type: 'full',
        status: 'completed',
        size: 5368709120, // 5 GB
        fileLocation: 's3://innsight-backups/platform/2026-03-16-full.tar.gz',
        itemsBackedUp: { rooms: 850, reservations: 12500, users: 200, settings: 45, transactions: 25000 },
        scheduledBackup: true,
        createdAt: new Date(now - 86400000).toISOString(),
        completedAt: new Date(now - 82800000).toISOString(),
        expiresAt: new Date(now + 7776000000).toISOString(), // 90 days
        retentionDays: 90,
      },
      {
        id: 'bak-002',
        tenantId: 'tenant-1',
        name: 'Tenant 1 Full Backup 2026-03-16',
        type: 'full',
        status: 'completed',
        size: 536870912, // 512 MB
        fileLocation: 's3://innsight-backups/tenants/tenant-1/2026-03-16-full.tar.gz',
        itemsBackedUp: { rooms: 150, reservations: 3200, users: 45, settings: 12 },
        scheduledBackup: true,
        createdAt: new Date(now - 43200000).toISOString(),
        completedAt: new Date(now - 39600000).toISOString(),
        expiresAt: new Date(now + 2592000000).toISOString(), // 30 days
        retentionDays: 30,
      },
      {
        id: 'bak-003',
        tenantId: 'tenant-2',
        name: 'Tenant 2 Incremental Backup 2026-03-16',
        type: 'incremental',
        status: 'in-progress',
        size: 0,
        fileLocation: 's3://innsight-backups/tenants/tenant-2/2026-03-16-incr-in-progress.tar.gz',
        itemsBackedUp: { rooms: 0, reservations: 0, users: 0, settings: 0 },
        scheduledBackup: true,
        createdAt: new Date(now - 1800000).toISOString(),
        expiresAt: new Date(now + 2592000000).toISOString(),
        retentionDays: 30,
      },
    ];

    mockBackups.forEach(backup => {
      backupsStorage.set(backup.id, backup);
    });

    const mockSchedules: BackupSchedule[] = [
      {
        id: 'sched-001',
        name: 'Platform Daily Full Backup',
        enabled: true,
        frequency: 'daily',
        time: '02:00',
        backupType: 'full',
        retentionDays: 90,
        maxBackups: 30,
        notifyOnFailure: true,
        notifyEmail: 'ops@innsight.com',
        createdAt: new Date(now - 2592000000).toISOString(),
        lastRun: new Date(now - 86400000).toISOString(),
      },
      {
        id: 'sched-002',
        tenantId: 'tenant-1',
        name: 'Tenant 1 Daily Backup',
        enabled: true,
        frequency: 'daily',
        time: '03:00',
        backupType: 'differential',
        retentionDays: 30,
        maxBackups: 15,
        notifyOnFailure: true,
        notifyEmail: 'admin@tenant1.com',
        createdAt: new Date(now - 1296000000).toISOString(),
        lastRun: new Date(now - 43200000).toISOString(),
      },
    ];

    mockSchedules.forEach(schedule => {
      schedulesStorage.set(schedule.id, schedule);
    });
  }
};

export async function getBackups(
  tenantId?: string,
  limit: number = 50,
  offset: number = 0
): Promise<Backup[]> {
  initializeMockData();
  
  let backups = Array.from(backupsStorage.values());

  if (tenantId !== undefined) {
    backups = backups.filter(b => b.tenantId === tenantId);
  }

  backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return backups.slice(offset, offset + limit);
}

export async function getBackup(backupId: string): Promise<Backup | null> {
  initializeMockData();
  return backupsStorage.get(backupId) || null;
}

export async function createBackup(data: Omit<Backup, 'id' | 'createdAt' | 'status' | 'size' | 'itemsBackedUp' | 'completedAt'>): Promise<Backup> {
  initializeMockData();
  
  const id = `bak-${Date.now()}`;
  const backup: Backup = {
    ...data,
    id,
    status: 'pending',
    size: 0,
    itemsBackedUp: { rooms: 0, reservations: 0, users: 0, settings: 0 },
    createdAt: new Date().toISOString(),
  };

  backupsStorage.set(id, backup);

  await createAuditLog({
    action: 'CREATE_BACKUP',
    entityType: 'Backup',
    resourceId: id,
    changes: backup,
    status: 'success'
  });

  return backup;
}

export async function deleteBackup(backupId: string): Promise<boolean> {
  initializeMockData();
  
  const backup = backupsStorage.get(backupId);
  if (!backup) return false;

  backupsStorage.delete(backupId);

  await createAuditLog({
    action: 'DELETE_BACKUP',
    entityType: 'Backup',
    resourceId: backupId,
    changes: { deleted: true },
    status: 'success'
  });

  return true;
}

export async function getBackupSchedules(tenantId?: string): Promise<BackupSchedule[]> {
  initializeMockData();
  
  let schedules = Array.from(schedulesStorage.values());

  if (tenantId !== undefined) {
    schedules = schedules.filter(s => s.tenantId === tenantId);
  }

  return schedules;
}

export async function getBackupSchedule(scheduleId: string): Promise<BackupSchedule | null> {
  initializeMockData();
  return schedulesStorage.get(scheduleId) || null;
}

export async function createBackupSchedule(data: Omit<BackupSchedule, 'id' | 'createdAt' | 'lastRun'>): Promise<BackupSchedule> {
  initializeMockData();
  
  const id = `sched-${Date.now()}`;
  const schedule: BackupSchedule = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };

  schedulesStorage.set(id, schedule);

  await createAuditLog({
    action: 'CREATE_BACKUP_SCHEDULE',
    entityType: 'BackupSchedule',
    resourceId: id,
    changes: schedule,
    status: 'success'
  });

  return schedule;
}

export async function updateBackupSchedule(
  scheduleId: string,
  updates: Partial<Omit<BackupSchedule, 'id' | 'createdAt'>>
): Promise<BackupSchedule | null> {
  initializeMockData();
  
  const schedule = schedulesStorage.get(scheduleId);
  if (!schedule) return null;

  const updated = { ...schedule, ...updates };
  schedulesStorage.set(scheduleId, updated);

  await createAuditLog({
    action: 'UPDATE_BACKUP_SCHEDULE',
    entityType: 'BackupSchedule',
    resourceId: scheduleId,
    changes: updates,
    status: 'success'
  });

  return updated;
}

export async function deleteBackupSchedule(scheduleId: string): Promise<boolean> {
  initializeMockData();
  
  if (!schedulesStorage.has(scheduleId)) return false;

  schedulesStorage.delete(scheduleId);

  await createAuditLog({
    action: 'DELETE_BACKUP_SCHEDULE',
    entityType: 'BackupSchedule',
    resourceId: scheduleId,
    changes: { deleted: true },
    status: 'success'
  });

  return true;
}

export async function createRestoreRequest(data: Omit<RestoreRequest, 'id' | 'createdAt' | 'status' | 'startedAt' | 'completedAt'>): Promise<RestoreRequest> {
  initializeMockData();
  
  const id = `rest-${Date.now()}`;
  const request: RestoreRequest = {
    ...data,
    id,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  restoresStorage.set(id, request);

  await createAuditLog({
    action: 'CREATE_RESTORE_REQUEST',
    entityType: 'RestoreRequest',
    resourceId: id,
    changes: request,
    status: 'success'
  });

  return request;
}

export async function getRestoreRequests(tenantId?: string, limit: number = 50, offset: number = 0): Promise<RestoreRequest[]> {
  initializeMockData();
  
  let requests = Array.from(restoresStorage.values());

  if (tenantId !== undefined) {
    requests = requests.filter(r => r.tenantId === tenantId);
  }

  requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return requests.slice(offset, offset + limit);
}

export async function getBackupStats(tenantId?: string) {
  initializeMockData();
  
  const backups = await getBackups(tenantId);
  const schedules = await getBackupSchedules(tenantId);

  const completedBackups = backups.filter(b => b.status === 'completed');
  const totalBackupSize = completedBackups.reduce((sum, b) => sum + b.size, 0);

  return {
    totalBackups: backups.length,
    completedBackups: completedBackups.length,
    failedBackups: backups.filter(b => b.status === 'failed').length,
    inProgressBackups: backups.filter(b => b.status === 'in-progress').length,
    totalBackupSize,
    averageBackupSize: completedBackups.length > 0 ? totalBackupSize / completedBackups.length : 0,
    totalSchedules: schedules.length,
    enabledSchedules: schedules.filter(s => s.enabled).length,
    oldestBackup: backups.length > 0 ? new Date(Math.min(...backups.map(b => new Date(b.createdAt).getTime()))).toISOString() : null,
    newestBackup: backups.length > 0 ? backups[0].createdAt : null,
  };
}
