import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';
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
  StatCard,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  status: 'active' | 'revoked';
  scopes: string[];
  rateLimit: number;
  lastUsedAt?: string;
  createdAt: string;
}

interface ApiMetrics {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  totalRequests: number;
  totalErrors: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  usageByKey: Array<{ keyName: string; requestCount: number; errorRate: number }>;
}

const AVAILABLE_SCOPES = [
  { value: 'rooms.read', label: 'Read rooms' },
  { value: 'rooms.write', label: 'Manage rooms' },
  { value: 'reservations.read', label: 'Read reservations' },
  { value: 'reservations.write', label: 'Manage reservations' },
  { value: 'guests.read', label: 'Read guests' },
  { value: 'guests.write', label: 'Manage guests' },
  { value: 'payments.read', label: 'Read payments' },
  { value: 'payments.write', label: 'Process payments' },
  { value: 'reports.read', label: 'Read reports' },
  { value: '*', label: 'All scopes' },
];

const maskKey = (key: string) =>
  key.length < 12 ? key : `${key.substring(0, 7)}…${key.substring(key.length - 4)}`;

export default function ApiManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({ name: '', scopes: [] as string[], rateLimit: 1000 });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [keysRes, metricsRes] = await Promise.all([
        api.get('/superadmin/api-keys'),
        api.get('/superadmin/api-metrics'),
      ]);
      setApiKeys(keysRes.data.data || []);
      setMetrics(metricsRes.data.data || null);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load API data'));
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

  const handleCreateKey = async () => {
    if (!newKeyForm.name.trim()) {
      toast.error('Please enter a key name');
      return;
    }
    try {
      setSaving(true);
      await api.post('/superadmin/api-keys', newKeyForm);
      toast.success('API key created — copy it now, it may not be shown again');
      setNewKeyForm({ name: '', scopes: [], rateLimit: 1000 });
      setShowCreateModal(false);
      fetchData();
    } catch {
      toast.error('Failed to create API key');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleScope = (scope: string) => {
    if (scope === '*') {
      setNewKeyForm((prev) => ({ ...prev, scopes: prev.scopes.includes('*') ? [] : ['*'] }));
    } else {
      setNewKeyForm((prev) => ({
        ...prev,
        scopes: prev.scopes.includes(scope) ? prev.scopes.filter((s) => s !== scope) : [...prev.scopes, scope],
      }));
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied');
  };

  const handleToggleVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(keyId)) next.delete(keyId);
      else next.add(keyId);
      return next;
    });
  };

  const handleRevokeKey = async () => {
    if (!revoking) return;
    try {
      setSaving(true);
      await api.post(`/superadmin/api-keys/${revoking.id}/revoke`);
      toast.success('API key revoked');
      setRevoking(null);
      fetchData();
    } catch {
      toast.error('Failed to revoke API key');
    } finally {
      setSaving(false);
    }
  };

  const errorRate = metrics && metrics.totalRequests > 0 ? (metrics.totalErrors / metrics.totalRequests) * 100 : 0;

  return (
    <Layout>
      <PageHeader
        title="API management"
        subtitle="Keys, scopes, and usage across the platform"
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowCreateModal(true)}>
            Generate key
          </Button>
        }
      />

      {metrics && (
        <div className="stats-grid">
          <StatCard label="Total keys" value={metrics.totalKeys} icon={<Key size={18} />} delta={`${metrics.activeKeys} active · ${metrics.revokedKeys} revoked`} />
          <StatCard label="Total requests" value={metrics.totalRequests.toLocaleString()} />
          <StatCard label="Error rate" value={`${errorRate.toFixed(2)}%`} tone={errorRate > 1 ? 'critical' : 'good'} />
          <StatCard label="Top endpoint" value={metrics.topEndpoints[0]?.endpoint?.split('/').pop() || '—'} />
        </div>
      )}

      <Panel title="API keys" subtitle={`${apiKeys.length} keys`}>
        <DataTable
          data={apiKeys}
          rowKey={(row) => row.id}
          loading={loading}
          error={error}
          onRetry={fetchData}
          empty={{
            title: 'No API keys',
            description: 'Generate a key to give external systems scoped access.',
            action: <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>Generate first key</Button>,
          }}
          columns={[
            { key: 'name', header: 'Name', render: (k: ApiKey) => (
              <div>
                <div style={{ fontWeight: 600 }}>{k.name}</div>
                <div className="text-xs muted">{k.scopes.join(', ') || 'no scopes'}</div>
              </div>
            ) },
            { key: 'key', header: 'Key', render: (k: ApiKey) => (
              <span className="row" style={{ gap: 6 }}>
                <code className="text-xs" style={{ background: 'var(--surface-sunken)', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>
                  {visibleKeys.has(k.id) ? k.key : maskKey(k.key)}
                </code>
                <Button variant="ghost" size="sm" onClick={() => handleToggleVisibility(k.id)} aria-label="Toggle key visibility">
                  {visibleKeys.has(k.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleCopyKey(k.key)} aria-label="Copy key">
                  <Copy size={14} />
                </Button>
              </span>
            ) },
            { key: 'status', header: 'Status', render: (k: ApiKey) => <StatusBadge status={k.status} dot={false}>{k.status}</StatusBadge> },
            { key: 'rateLimit', header: 'Rate limit', align: 'center', render: (k: ApiKey) => `${k.rateLimit}/min` },
            { key: 'lastUsedAt', header: 'Last used', render: (k: ApiKey) => <span className="text-sm muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString() : 'Never'}</span> },
            { key: 'actions', header: '', align: 'right', render: (k: ApiKey) => (
              k.status === 'active' ? (
                <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setRevoking(k)}>Revoke</Button>
              ) : null
            ) },
          ]}
        />
      </Panel>

      {metrics && (metrics.topEndpoints.length > 0 || metrics.usageByKey.length > 0) && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          {metrics.topEndpoints.length > 0 && (
            <Panel title="Top endpoints">
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {metrics.topEndpoints.map((ep, idx) => (
                  <div key={idx} className="row-between text-sm">
                    <span className="muted" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{ep.endpoint}</span>
                    <strong>{ep.count.toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </Panel>
          )}
          {metrics.usageByKey.length > 0 && (
            <Panel title="Usage by key">
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                {metrics.usageByKey.map((usage, idx) => (
                  <div key={idx}>
                    <div className="row-between" style={{ marginBottom: 4 }}>
                      <span className="text-sm" style={{ fontWeight: 500 }}>{usage.keyName}</span>
                      <span className="text-xs muted">{usage.requestCount.toLocaleString()} req · {(usage.errorRate * 100).toFixed(1)}% err</span>
                    </div>
                    <div style={{ width: '100%', background: 'var(--line)', borderRadius: 99, height: 6 }}>
                      <div style={{ width: `${Math.min(usage.errorRate * 100, 100)}%`, height: '100%', borderRadius: 99, background: 'var(--danger)' }} />
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      )}

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Generate API key"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreateKey} loading={saving} disabled={!newKeyForm.name.trim()}>
              Generate key
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Key name" required>
            <TextInput placeholder="e.g. Production integration" value={newKeyForm.name} onChange={(e) => setNewKeyForm((p) => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Scopes">
            <div className="stack" style={{ gap: 'var(--space-1)', maxHeight: 200, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)' }}>
              {AVAILABLE_SCOPES.map((scope) => (
                <label key={scope.value} className="row" style={{ cursor: 'pointer', gap: 8 }}>
                  <input type="checkbox" checked={newKeyForm.scopes.includes(scope.value)} onChange={() => handleToggleScope(scope.value)} />
                  <span className="text-sm">{scope.label} <code className="text-xs muted">({scope.value})</code></span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Rate limit (requests/minute)">
            <TextInput type="number" min={10} step={100} value={newKeyForm.rateLimit} onChange={(e) => setNewKeyForm((p) => ({ ...p, rateLimit: parseInt(e.target.value, 10) }))} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!revoking}
        title="Revoke API key?"
        destructive
        confirmLabel="Revoke key"
        loading={saving}
        onConfirm={handleRevokeKey}
        onClose={() => setRevoking(null)}
      >
        <p>
          <strong>{revoking?.name}</strong> will stop working immediately. Any integration using this key will lose access — this cannot be undone.
        </p>
      </ConfirmDialog>
    </Layout>
  );
}
