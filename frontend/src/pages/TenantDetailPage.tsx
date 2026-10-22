import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  ArrowLeft, Ban, CheckCircle, KeyRound, Edit, RefreshCw,
  Building2, Users, DoorOpen, Calendar, DollarSign, ShieldCheck,
  Gauge, LifeBuoy, ScrollText, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button, ConfirmDialog, DataTable, ErrorState, Field, Modal,
  PageHeader, Panel, Skeleton, StatCard, StatusBadge, TextInput,
} from '../components/ui';

import { formatMoney } from '../lib/money';

const statusTone = (s: string) =>
  s === 'active' ? 'success' : s === 'trial' ? 'info' : s === 'suspended' ? 'danger' : 'neutral';

function UsageBar({ label, used, max }: { label: string; used: number; max?: number }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const tone = pct >= 90 ? 'var(--danger)' : pct >= 70 ? 'var(--warning)' : 'var(--teal-700)';
  return (
    <div>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <span className="text-sm">{label}</span>
        <span className="text-xs muted">{used}{max ? ` / ${max}` : ''} {max ? `(${pct}%)` : ''}</span>
      </div>
      <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${max ? pct : 0}%`, height: '100%', background: tone, borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  );
}

export default function TenantDetailPage() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [tenant, setTenant] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [quotas, setQuotas] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [sla, setSla] = useState<any>(null);
  const [violations, setViolations] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<'active' | 'suspended' | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const safe = (p: Promise<any>) => p.catch(() => ({ data: { data: null } }));
      const [t, a, q, u, c, v, tk, al] = await Promise.all([
        api.get(`/superadmin/tenants/${tenantId}`),
        safe(api.get(`/tenants/${tenantId}/admin`)),
        safe(api.get(`/superadmin/tenant-quotas/${tenantId}`)),
        safe(api.get(`/superadmin/tenant-quotas/${tenantId}/usage`)),
        safe(api.get(`/superadmin/sla/compliance/${tenantId}`)),
        safe(api.get(`/superadmin/sla/violations/${tenantId}`)),
        safe(api.get(`/superadmin/support?tenantId=${tenantId}&limit=10`)),
        safe(api.get(`/superadmin/audit-logs?tenantId=${tenantId}&dateRange=30d&take=10`)),
      ]);
      setTenant(t.data.data);
      setAdmin(a.data?.data || null);
      setQuotas(q.data?.data || null);
      setUsage(u.data?.data || null);
      setSla(c.data?.data || null);
      setViolations(v.data?.data?.violations || []);
      setTickets(tk.data?.data || []);
      setAuditLogs(al.data?.data || []);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load tenant'));
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, user, isAuthenticated, navigate]);

  const handleStatusChange = async () => {
    if (!statusConfirm) return;
    try {
      setActionLoading(true);
      await api.patch(`/superadmin/tenants/${tenantId}/status`, { status: statusConfirm });
      toast.success(`Tenant ${statusConfirm === 'active' ? 'activated' : 'suspended'}`);
      setStatusConfirm(null);
      fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Status update failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      setActionLoading(true);
      await api.post(`/tenants/${tenantId}/admin/reset-password`, { newPassword });
      toast.success('Owner password reset');
      setShowResetModal(false);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Reset failed');
    } finally {
      setActionLoading(false);
    }
  };

  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed');
  const suspended = tenant?.subscriptionStatus === 'suspended';

  return (
    <Layout>
      <PageHeader
        title={tenant?.name || 'Tenant'}
        subtitle={tenant ? `@${tenant.slug} · created ${new Date(tenant.createdAt).toLocaleDateString()}` : ''}
        actions={
          <>
            <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => navigate('/superadmin/tenants')}>Tenants</Button>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchAll} loading={loading}>Refresh</Button>
            {tenant && (
              <>
                <Button variant="secondary" icon={<Edit size={15} />} onClick={() => navigate('/tenants')}>Edit</Button>
                {admin && (
                  <Button variant="secondary" icon={<KeyRound size={15} />} onClick={() => setShowResetModal(true)}>Reset admin password</Button>
                )}
                {suspended ? (
                  <Button variant="primary" icon={<CheckCircle size={15} />} onClick={() => setStatusConfirm('active')}>Activate</Button>
                ) : (
                  <Button variant="danger" icon={<Ban size={15} />} onClick={() => setStatusConfirm('suspended')}>Suspend</Button>
                )}
              </>
            )}
          </>
        }
      />

      {loading && !tenant && (
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="110px" />)}
        </div>
      )}
      {error && <ErrorState message={error.message} onRetry={fetchAll} />}

      {tenant && !loading && (
        <>
          <div className="stats-grid">
            <StatCard label="Status" value={tenant.subscriptionStatus} tone={statusTone(tenant.subscriptionStatus) as any} icon={<Building2 size={18} />} />
            <StatCard label="Users" value={tenant._count?.users ?? 0} icon={<Users size={18} />} />
            <StatCard label="Rooms" value={tenant._count?.rooms ?? 0} icon={<DoorOpen size={18} />} />
            <StatCard label="Reservations" value={tenant._count?.reservations ?? tenant.statistics?.totalReservations ?? 0} icon={<Calendar size={18} />} />
            <StatCard label="Lifetime revenue" value={formatMoney(tenant.statistics?.totalRevenue || 0)} icon={<DollarSign size={18} />} />
          </div>

          <div className="grid2" style={{ alignItems: 'start' }}>
            <Panel title="Tenant & owner" subtitle="Account details">
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <div className="grid2">
                  <span className="text-sm muted">Email</span><span className="text-sm">{tenant.email || '—'}</span>
                  <span className="text-sm muted">Phone</span><span className="text-sm">{tenant.phone || '—'}</span>
                  <span className="text-sm muted">Address</span><span className="text-sm">{tenant.address || '—'}</span>
                  <span className="text-sm muted">Plan</span><span className="text-sm" style={{ textTransform: 'capitalize' }}>{tenant.subscriptionPlan || '—'}</span>
                </div>
                {admin ? (
                  <>
                    <p className="text-xs muted" style={{ margin: 'var(--space-2) 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Admin account</p>
                    <div className="grid2">
                      <span className="text-sm muted">Name</span><span className="text-sm">{admin.firstName} {admin.lastName}</span>
                      <span className="text-sm muted">Email</span><span className="text-sm">{admin.email}</span>
                      <span className="text-sm muted">Role</span><span className="text-sm" style={{ textTransform: 'capitalize' }}>{admin.role?.replace(/_/g, ' ')}</span>
                      <span className="text-sm muted">Active</span><span className="text-sm">{admin.isActive ? 'Yes' : 'No'}</span>
                      <span className="text-sm muted">Last login</span><span className="text-sm">{admin.lastLogin ? new Date(admin.lastLogin).toLocaleString() : 'Never'}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm muted" style={{ margin: 0 }}><User size={13} style={{ verticalAlign: -2 }} /> No admin account found for this tenant</p>
                )}
              </div>
            </Panel>

            <Panel title="Resource quotas" subtitle="Usage vs configured limits" actions={<Button variant="ghost" size="sm" icon={<Gauge size={14} />} onClick={() => navigate('/tenant-quotas')}>Manage</Button>}>
              {usage ? (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <UsageBar label="Rooms" used={usage.roomsUsed} max={quotas?.maxRooms} />
                  <UsageBar label="Users" used={usage.usersUsed} max={quotas?.maxUsers} />
                  <UsageBar label="Reservations" used={usage.reservationsUsed} max={quotas?.maxReservations} />
                </div>
              ) : (
                <p className="text-sm muted" style={{ margin: 0 }}>Quota data unavailable</p>
              )}
            </Panel>
          </div>

          <div className="grid2" style={{ alignItems: 'start' }}>
            <Panel title="SLA compliance" subtitle="24h service-level metrics" actions={<Button variant="ghost" size="sm" icon={<ShieldCheck size={14} />} onClick={() => navigate('/sla-dashboard')}>SLA dashboard</Button>}>
              {sla ? (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  <div className="grid2">
                    <div className="row-between"><span className="text-sm">Uptime</span><strong style={{ color: sla.uptime >= 99 ? 'var(--success)' : 'var(--warning)' }}>{sla.uptime?.toFixed(2)}%</strong></div>
                    <div className="row-between"><span className="text-sm">Error rate</span><strong style={{ color: sla.errorRate > 1 ? 'var(--danger)' : 'var(--success)' }}>{sla.errorRate?.toFixed(2)}%</strong></div>
                    <div className="row-between"><span className="text-sm">Avg response</span><strong>{Math.round(sla.responseTime)}ms</strong></div>
                    <div className="row-between"><span className="text-sm">Ticket response</span><strong>{Math.round(sla.supportTicketResponseTime)}m</strong></div>
                  </div>
                  {violations.length > 0 ? (
                    <div className="stack" style={{ gap: 'var(--space-2)' }}>
                      {violations.map((v, i) => (
                        <div key={i} className="row-between" style={{ padding: 'var(--space-2)', background: 'var(--danger-bg)', borderRadius: 'var(--radius-md)' }}>
                          <span className="text-sm">{v.metric} breach</span>
                          <span className="text-xs muted">{v.value?.toFixed(1)} vs limit {v.limit}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <StatusBadge status="compliant" tone="success" dot={false}>No violations</StatusBadge>
                  )}
                </div>
              ) : (
                <p className="text-sm muted" style={{ margin: 0 }}>No SLA agreement configured for this tenant</p>
              )}
            </Panel>

            <Panel title="Support tickets" subtitle={`${openTickets.length} open · ${tickets.length} recent`} actions={<Button variant="ghost" size="sm" icon={<LifeBuoy size={14} />} onClick={() => navigate('/support-tickets')}>All tickets</Button>}>
              <DataTable
                data={tickets.slice(0, 8)}
                rowKey={(r) => r.id}
                empty={{ title: 'No tickets', description: 'This tenant has not raised any support tickets.' }}
                columns={[
                  { key: 'ticketNumber', header: 'Ticket', render: (t: any) => <span className="text-sm" style={{ fontWeight: 600 }}>{t.ticketNumber || t.id?.slice(0, 8)}</span> },
                  { key: 'subject', header: 'Subject', render: (t: any) => <span className="text-sm">{t.subject}</span> },
                  { key: 'status', header: 'Status', render: (t: any) => <StatusBadge status={t.status} dot={false}>{t.status}</StatusBadge> },
                  { key: 'createdAt', header: 'Opened', render: (t: any) => <span className="text-xs muted">{new Date(t.createdAt).toLocaleDateString()}</span> },
                ]}
              />
            </Panel>
          </div>

          <Panel title="Recent activity" subtitle="Audit events, last 30 days" actions={<Button variant="ghost" size="sm" icon={<ScrollText size={14} />} onClick={() => navigate('/audit-logs')}>Audit logs</Button>}>
            <DataTable
              data={auditLogs}
              rowKey={(r) => r.id}
              empty={{ title: 'No recent activity', description: 'No audit events in the last 30 days.' }}
              columns={[
                { key: 'action', header: 'Action', render: (l: any) => <StatusBadge status={l.action} dot={false}>{l.action}</StatusBadge> },
                { key: 'entityType', header: 'Entity', render: (l: any) => <span className="text-sm muted">{l.entityType}</span> },
                { key: 'userName', header: 'User', render: (l: any) => <span className="text-sm muted">{l.userName || 'System'}</span> },
                { key: 'createdAt', header: 'When', render: (l: any) => <span className="text-xs muted">{new Date(l.createdAt || l.timestamp).toLocaleString()}</span> },
              ]}
            />
          </Panel>
        </>
      )}

      <ConfirmDialog
        open={!!statusConfirm}
        title={statusConfirm === 'suspended' ? 'Suspend tenant?' : 'Activate tenant?'}
        destructive={statusConfirm === 'suspended'}
        confirmLabel={statusConfirm === 'suspended' ? 'Suspend' : 'Activate'}
        loading={actionLoading}
        onConfirm={handleStatusChange}
        onClose={() => setStatusConfirm(null)}
      >
        <p>
          {statusConfirm === 'suspended'
            ? <><strong>{tenant?.name}</strong> and all its staff will lose access. Guest-facing surfaces will show the property as unavailable.</>
            : <><strong>{tenant?.name}</strong> will regain full platform access.</>}
        </p>
      </ConfirmDialog>

      <Modal
        open={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Reset tenant admin password"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleResetPassword} loading={actionLoading} disabled={newPassword.length < 6}>
              Reset password
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <p className="text-sm muted" style={{ margin: 0 }}>
            Sets a new password for <strong>{admin?.email || 'the tenant admin'}</strong>. They are not notified automatically — share it securely.
          </p>
          <Field label="New password" required hint="Minimum 6 characters">
            <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" />
          </Field>
        </div>
      </Modal>
    </Layout>
  );
}
