import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { BarChart3, Edit2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  Skeleton,
  TextInput,
} from '../components/ui';

interface Tenant {
  id: string;
  name: string;
  email: string;
}

interface ResourceQuota {
  id: string;
  tenantId: string;
  maxRooms: number;
  maxUsers: number;
  maxReservations: number;
  maxStorageGB: number;
  maxApiCallsPerDay: number;
}

interface ResourceUsage {
  roomsUsed: number;
  usersUsed: number;
  reservationsUsed: number;
  storageUsedGB: number;
  apiCallsUsedToday: number;
}

const QUOTA_FIELDS: { key: keyof Omit<ResourceQuota, 'id' | 'tenantId'>; label: string }[] = [
  { key: 'maxRooms', label: 'Max rooms' },
  { key: 'maxUsers', label: 'Max users' },
  { key: 'maxReservations', label: 'Max reservations' },
  { key: 'maxStorageGB', label: 'Max storage (GB)' },
  { key: 'maxApiCallsPerDay', label: 'Max API calls/day' },
];

const usageTone = (pct: number) =>
  pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning, #d97706)' : 'var(--success, #2f8f5b)';

export default function TenantQuotasPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [quotas, setQuotas] = useState<ResourceQuota | null>(null);
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<ResourceQuota>>({});

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/tenants');
      setTenants(response.data?.data || []);
    } catch {
      toast.error('Failed to load tenants');
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
    fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const fetchTenantQuotas = async (tenantId: string) => {
    try {
      setDetailLoading(true);
      const [quotasRes, usageRes] = await Promise.all([
        api.get(`/superadmin/tenant-quotas/${tenantId}`),
        api.get(`/superadmin/tenant-quotas/${tenantId}/usage`),
      ]);
      setQuotas(quotasRes.data?.data);
      setUsage(usageRes.data?.data);
      setFormData(quotasRes.data?.data || {});
    } catch {
      toast.error('Failed to load quotas');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditing(false);
    fetchTenantQuotas(tenant.id);
  };

  const handleSaveQuotas = async () => {
    if (!selectedTenant) return;
    try {
      setSaving(true);
      await api.patch(`/superadmin/tenant-quotas/${selectedTenant.id}`, formData);
      toast.success('Quotas updated');
      setEditing(false);
      fetchTenantQuotas(selectedTenant.id);
    } catch {
      toast.error('Failed to update quotas');
    } finally {
      setSaving(false);
    }
  };

  const usageRows = quotas && usage ? [
    { label: 'Rooms', used: usage.roomsUsed, max: quotas.maxRooms },
    { label: 'Users', used: usage.usersUsed, max: quotas.maxUsers },
    { label: 'Reservations', used: usage.reservationsUsed, max: quotas.maxReservations },
    { label: 'Storage (GB)', used: usage.storageUsedGB, max: quotas.maxStorageGB },
    { label: 'API calls today', used: usage.apiCallsUsedToday, max: quotas.maxApiCallsPerDay },
  ] : [];

  return (
    <Layout>
      <PageHeader
        title="Resource quotas"
        subtitle="Per-tenant limits and current usage"
        actions={
          <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchTenants} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="grid2" style={{ gridTemplateColumns: 'minmax(260px, 340px) 1fr', alignItems: 'start' }}>
        <Panel title="Tenants" flush>
          {loading ? (
            <div style={{ padding: 'var(--space-4)' }}><Skeleton height="200px" /></div>
          ) : (
            <div className="stack" style={{ gap: 'var(--space-1)', maxHeight: 480, overflowY: 'auto', padding: 'var(--space-2)' }}>
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelectTenant(tenant)}
                  style={{
                    textAlign: 'left',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedTenant?.id === tenant.id ? 'var(--teal-100)' : 'transparent',
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>{tenant.name}</div>
                  <div className="text-xs muted">{tenant.email}</div>
                </button>
              ))}
            </div>
          )}
        </Panel>

        {!selectedTenant ? (
          <Panel>
            <EmptyState
              icon={<BarChart3 size={28} strokeWidth={1.6} />}
              title="Select a tenant"
              description="Choose a tenant to view and edit its resource quotas."
            />
          </Panel>
        ) : detailLoading ? (
          <Skeleton height="320px" />
        ) : quotas && usage ? (
          <div className="stack">
            <Panel
              title={`Quotas — ${selectedTenant.name}`}
              actions={
                !editing && (
                  <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                )
              }
            >
              {editing ? (
                <>
                  <div className="grid2">
                    {QUOTA_FIELDS.map((field) => (
                      <Field key={field.key} label={field.label}>
                        <TextInput
                          type="number"
                          min={0}
                          value={formData[field.key] ?? ''}
                          onChange={(e) =>
                            setFormData({ ...formData, [field.key]: parseInt(e.target.value, 10) })
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="row" style={{ marginTop: 'var(--space-4)' }}>
                    <Button variant="primary" onClick={handleSaveQuotas} loading={saving}>
                      Save quotas
                    </Button>
                    <Button variant="ghost" onClick={() => { setEditing(false); setFormData(quotas); }}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <div className="grid2">
                  {QUOTA_FIELDS.map((field) => (
                    <div key={field.key}>
                      <p className="text-sm muted" style={{ margin: 0 }}>{field.label}</p>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>
                        {quotas[field.key].toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Current usage">
              <div className="stack" style={{ gap: 'var(--space-4)' }}>
                {usageRows.map((item) => {
                  const pct = item.max > 0 ? Math.round((item.used / item.max) * 100) : 0;
                  return (
                    <div key={item.label}>
                      <div className="row-between" style={{ marginBottom: 4 }}>
                        <span className="text-sm" style={{ fontWeight: 500 }}>{item.label}</span>
                        <span className="text-sm" style={{ fontWeight: 700, color: usageTone(pct) }}>
                          {item.used.toLocaleString()} / {item.max.toLocaleString()} ({pct}%)
                        </span>
                      </div>
                      <div style={{ width: '100%', background: 'var(--line)', borderRadius: 99, height: 8 }}>
                        <div
                          style={{
                            width: `${Math.min(pct, 100)}%`,
                            height: '100%',
                            borderRadius: 99,
                            background: usageTone(pct),
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        ) : (
          <Panel>
            <EmptyState title="No quota data" description="This tenant has no quota record yet." />
          </Panel>
        )}
      </div>
    </Layout>
  );
}
