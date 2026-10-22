import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { HardDrive, Download, Plus, RotateCcw, Trash2, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  Modal,
  PageHeader,
  Panel,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface Backup {
  id: string;
  name: string;
  timestamp: string;
  size: number;
  status: 'completed' | 'in_progress' | 'failed';
  dataTypes: string[];
  tenantId?: string;
}

interface BackupSchedule {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  retentionDays: number;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

interface BackupMetrics {
  totalBackups: number;
  totalSize: number;
  lastBackupTime?: string;
  successRate: number;
  failedBackups: number;
  schedules: number;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

const emptySchedule = { name: '', frequency: 'daily' as const, time: '02:00', retentionDays: 30 };

export default function BackupRestorePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
  const [metrics, setMetrics] = useState<BackupMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [confirm, setConfirm] = useState<
    | { kind: 'restore'; backup: Backup }
    | { kind: 'delete-backup'; backup: Backup }
    | { kind: 'delete-schedule'; schedule: BackupSchedule }
    | null
  >(null);
  const [newSchedule, setNewSchedule] = useState(emptySchedule);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [backupsRes, schedulesRes, metricsRes] = await Promise.all([
        api.get('/superadmin/backups'),
        api.get('/superadmin/backup-schedules'),
        api.get('/superadmin/backup-metrics'),
      ]);
      setBackups(backupsRes.data.data || []);
      setSchedules(schedulesRes.data.data || []);
      setMetrics(metricsRes.data.data || null);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load backup data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      await api.post('/superadmin/backups', {
        name: `Manual backup ${new Date().toLocaleString()}`,
        dataTypes: ['database', 'files', 'configuration'],
      });
      toast.success('Backup started');
      fetchData();
    } catch {
      toast.error('Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!newSchedule.name.trim()) {
      toast.error('Please enter a schedule name');
      return;
    }
    try {
      setSaving(true);
      await api.post('/superadmin/backup-schedules', newSchedule);
      toast.success('Schedule created');
      setNewSchedule(emptySchedule);
      setShowScheduleModal(false);
      fetchData();
    } catch {
      toast.error('Failed to create schedule');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    try {
      setSaving(true);
      if (confirm.kind === 'restore') {
        await api.post(`/superadmin/backups/${confirm.backup.id}/restore`);
        toast.success('Restore started — this may take a few minutes');
      } else if (confirm.kind === 'delete-backup') {
        await api.delete(`/superadmin/backups/${confirm.backup.id}`);
        toast.success('Backup deleted');
      } else {
        await api.delete(`/superadmin/backup-schedules/${confirm.schedule.id}`);
        toast.success('Schedule deleted');
      }
      setConfirm(null);
      fetchData();
    } catch {
      toast.error('Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadBackup = async (backupId: string) => {
    try {
      const response = await api.get(`/superadmin/backups/${backupId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup-${backupId}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download backup');
    }
  };

  const handleToggleSchedule = async (schedule: BackupSchedule) => {
    try {
      await api.patch(`/superadmin/backup-schedules/${schedule.id}`, { enabled: !schedule.enabled });
      toast.success(`Schedule ${!schedule.enabled ? 'enabled' : 'disabled'}`);
      fetchData();
    } catch {
      toast.error('Failed to update schedule');
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Backups & restore"
        subtitle="Platform data protection"
        actions={
          <>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchData} loading={loading}>Refresh</Button>
            <Button variant="secondary" icon={<Calendar size={15} />} onClick={() => setShowScheduleModal(true)}>New schedule</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={handleCreateBackup} loading={creating}>Backup now</Button>
          </>
        }
      />

      {metrics && (
        <div className="stats-grid">
          <StatCard label="Total backups" value={metrics.totalBackups} icon={<HardDrive size={18} />} />
          <StatCard label="Total size" value={formatBytes(metrics.totalSize)} />
          <StatCard label="Success rate" value={`${metrics.successRate}%`} tone={metrics.successRate >= 95 ? 'good' : 'warning'} />
          <StatCard label="Failed" value={metrics.failedBackups} tone={metrics.failedBackups > 0 ? 'critical' : 'neutral'} />
          <StatCard label="Schedules" value={metrics.schedules} icon={<Calendar size={18} />} />
        </div>
      )}

      <Panel title="Backups" subtitle={`${backups.length} snapshots`} style={{ marginBottom: 'var(--space-5)' }}>
        <DataTable
          data={backups}
          rowKey={(row) => row.id}
          loading={loading}
          error={error}
          onRetry={fetchData}
          empty={{
            title: 'No backups yet',
            description: 'Create a manual backup or set a schedule.',
            action: <Button variant="primary" size="sm" onClick={handleCreateBackup}>Create first backup</Button>,
          }}
          columns={[
            { key: 'name', header: 'Name', render: (b: Backup) => <span style={{ fontWeight: 600 }}>{b.name}</span> },
            { key: 'status', header: 'Status', render: (b: Backup) => <StatusBadge status={b.status} dot={false}>{b.status.replace(/_/g, ' ')}</StatusBadge> },
            { key: 'size', header: 'Size', align: 'right', render: (b: Backup) => formatBytes(b.size) },
            { key: 'dataTypes', header: 'Data', render: (b: Backup) => (
              <span className="row wrap" style={{ gap: 4 }}>
                {b.dataTypes.map((t) => (
                  <span key={t} className="text-xs" style={{ background: 'var(--surface-sunken)', padding: '2px 8px', borderRadius: 99 }}>{t}</span>
                ))}
              </span>
            ) },
            { key: 'timestamp', header: 'Created', render: (b: Backup) => <span className="text-sm muted">{new Date(b.timestamp).toLocaleString()}</span> },
            { key: 'actions', header: '', align: 'right', render: (b: Backup) => (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                {b.status === 'completed' && (
                  <>
                    <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => setConfirm({ kind: 'restore', backup: b })}>Restore</Button>
                    <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => handleDownloadBackup(b.id)}>Download</Button>
                  </>
                )}
                <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirm({ kind: 'delete-backup', backup: b })}>Delete</Button>
              </div>
            ) },
          ]}
        />
      </Panel>

      <Panel title="Backup schedules" subtitle={`${schedules.length} configured`}>
        <DataTable
          data={schedules}
          rowKey={(row) => row.id}
          empty={{
            title: 'No schedules',
            description: 'Automate backups with a recurring schedule.',
            action: <Button variant="secondary" size="sm" onClick={() => setShowScheduleModal(true)}>Create schedule</Button>,
          }}
          columns={[
            { key: 'name', header: 'Name', render: (s: BackupSchedule) => <span style={{ fontWeight: 600 }}>{s.name}</span> },
            { key: 'frequency', header: 'Frequency', render: (s: BackupSchedule) => <span style={{ textTransform: 'capitalize' }}>{s.frequency} at {s.time}</span> },
            { key: 'retentionDays', header: 'Retention', align: 'center', render: (s: BackupSchedule) => `${s.retentionDays}d` },
            { key: 'enabled', header: 'Status', render: (s: BackupSchedule) => (
              <Button variant="ghost" size="sm" onClick={() => handleToggleSchedule(s)}>
                <StatusBadge status={s.enabled ? 'active' : 'inactive'} dot={false}>{s.enabled ? 'Enabled' : 'Disabled'}</StatusBadge>
              </Button>
            ) },
            { key: 'lastRun', header: 'Last run', render: (s: BackupSchedule) => <span className="text-sm muted">{s.lastRun ? new Date(s.lastRun).toLocaleDateString() : 'Never'}</span> },
            { key: 'nextRun', header: 'Next run', render: (s: BackupSchedule) => <span className="text-sm muted">{s.nextRun ? new Date(s.nextRun).toLocaleDateString() : '—'}</span> },
            { key: 'actions', header: '', align: 'right', render: (s: BackupSchedule) => (
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirm({ kind: 'delete-schedule', schedule: s })}>Delete</Button>
            ) },
          ]}
        />
      </Panel>

      <Modal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Create backup schedule"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateSchedule} loading={saving} disabled={!newSchedule.name.trim()}>
              Create schedule
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Schedule name" required>
            <TextInput placeholder="e.g. Nightly backup" value={newSchedule.name} onChange={(e) => setNewSchedule((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <div className="grid2">
            <Field label="Frequency">
              <Select value={newSchedule.frequency} onChange={(e) => setNewSchedule((p) => ({ ...p, frequency: e.target.value as any }))}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
            <Field label="Time">
              <TextInput type="time" value={newSchedule.time} onChange={(e) => setNewSchedule((p) => ({ ...p, time: e.target.value }))} />
            </Field>
          </div>
          <Field label="Retention (days)">
            <TextInput type="number" min={1} value={newSchedule.retentionDays} onChange={(e) => setNewSchedule((p) => ({ ...p, retentionDays: parseInt(e.target.value, 10) }))} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirm?.kind === 'restore'}
        title="Restore from backup?"
        destructive
        confirmLabel="Start restore"
        loading={saving}
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      >
        <p>
          Restoring <strong>{confirm?.kind === 'restore' ? confirm.backup.name : ''}</strong> will overwrite current platform data.
          This is irreversible — make sure a recent backup exists first.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'delete-backup'}
        title="Delete backup?"
        destructive
        confirmLabel="Delete backup"
        loading={saving}
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      >
        <p><strong>{confirm?.kind === 'delete-backup' ? confirm.backup.name : ''}</strong> will be permanently deleted and cannot be restored.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm?.kind === 'delete-schedule'}
        title="Delete schedule?"
        destructive
        confirmLabel="Delete schedule"
        loading={saving}
        onConfirm={handleConfirm}
        onClose={() => setConfirm(null)}
      >
        <p><strong>{confirm?.kind === 'delete-schedule' ? confirm.schedule.name : ''}</strong> will stop running. Existing backups are kept.</p>
      </ConfirmDialog>
    </Layout>
  );
}
