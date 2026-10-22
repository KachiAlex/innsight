import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Trash2, Plus, RefreshCw, Calendar, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface RetentionPolicy {
  id: string;
  tenantId: string;
  policyName: string;
  dataType: 'reservations' | 'audits' | 'analytics' | 'all';
  retentionDays: number;
  autoDelete: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

const emptyForm = { policyName: '', dataType: 'all' as const, retentionDays: 90, autoDelete: true };

export default function DataRetentionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<RetentionPolicy | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchPolicies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/superadmin/retention-policies');
      setPolicies(response.data?.data || []);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load retention policies'));
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
    fetchPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const handleAddPolicy = async () => {
    if (!formData.policyName.trim()) {
      toast.error('Enter a policy name');
      return;
    }
    try {
      setSaving(true);
      await api.post('/superadmin/retention-policies', formData);
      toast.success('Policy created');
      setFormData(emptyForm);
      setShowForm(false);
      fetchPolicies();
    } catch {
      toast.error('Failed to create policy');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!deleting) return;
    try {
      setSaving(true);
      await api.delete(`/superadmin/retention-policies/${deleting.id}`);
      toast.success('Policy deleted');
      setDeleting(null);
      fetchPolicies();
    } catch {
      toast.error('Failed to delete policy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Data retention"
        subtitle="How long platform data is kept before purge"
        actions={
          <>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchPolicies} loading={loading}>Refresh</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowForm(true)}>New policy</Button>
          </>
        }
      />

      <DataTable
        data={policies}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchPolicies}
        empty={{ title: 'No retention policies', description: 'Define how long each data type is retained.' }}
        columns={[
          { key: 'policyName', header: 'Policy', render: (p: RetentionPolicy) => <span style={{ fontWeight: 600 }}>{p.policyName}</span> },
          { key: 'dataType', header: 'Data type', render: (p: RetentionPolicy) => <StatusBadge status={p.dataType} dot={false}>{p.dataType}</StatusBadge> },
          { key: 'retentionDays', header: 'Retention', align: 'center', render: (p: RetentionPolicy) => (
            <span className="text-sm row"><Calendar size={13} /> {p.retentionDays} days</span>
          ) },
          { key: 'autoDelete', header: 'Auto-delete', render: (p: RetentionPolicy) => (
            <StatusBadge status={p.autoDelete ? 'active' : 'inactive'} dot={false}>{p.autoDelete ? 'Enabled' : 'Off'}</StatusBadge>
          ) },
          { key: 'lastRunAt', header: 'Last run', render: (p: RetentionPolicy) => (
            <span className="text-sm muted row"><Clock size={13} /> {p.lastRunAt ? new Date(p.lastRunAt).toLocaleDateString() : 'Never'}</span>
          ) },
          { key: 'actions', header: '', align: 'right', render: (p: RetentionPolicy) => (
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleting(p)}>Delete</Button>
          ) },
        ]}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Create retention policy"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleAddPolicy} loading={saving} disabled={!formData.policyName.trim()}>
              Create policy
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Policy name" required>
            <TextInput placeholder="e.g. Purge old reservations" value={formData.policyName} onChange={(e) => setFormData({ ...formData, policyName: e.target.value })} />
          </Field>
          <Field label="Data type">
            <Select value={formData.dataType} onChange={(e) => setFormData({ ...formData, dataType: e.target.value as any })}>
              <option value="all">All data</option>
              <option value="reservations">Reservations</option>
              <option value="audits">Audit logs</option>
              <option value="analytics">Analytics</option>
            </Select>
          </Field>
          <Field label="Retention period (days)">
            <TextInput type="number" min={1} value={formData.retentionDays} onChange={(e) => setFormData({ ...formData, retentionDays: parseInt(e.target.value, 10) })} />
          </Field>
          <label className="row" style={{ cursor: 'pointer', gap: 8 }}>
            <input type="checkbox" checked={formData.autoDelete} onChange={(e) => setFormData({ ...formData, autoDelete: e.target.checked })} />
            <span className="text-sm">Automatically delete data past the retention period</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete retention policy?"
        destructive
        confirmLabel="Delete policy"
        loading={saving}
        onConfirm={handleDeletePolicy}
        onClose={() => setDeleting(null)}
      >
        <p><strong>{deleting?.policyName}</strong> will stop running. Data already covered by this policy is not restored.</p>
      </ConfirmDialog>
    </Layout>
  );
}
