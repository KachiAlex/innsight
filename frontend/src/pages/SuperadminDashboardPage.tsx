import { useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  Building2,
  Users,
  DoorOpen,
  Calendar,
  DollarSign,
  Activity,
  ArrowRight,
  RefreshCcw,
} from 'lucide-react';
import {
  AlertPanel,
  Button,
  DataTable,
  ErrorState,
  PageHeader,
  Panel,
  Skeleton,
  StatCard,
  StatusBadge,
} from '../components/ui';
import type { AlertItem } from '../components/ui/AlertPanel';
import { formatMoney as fmtMoney } from '../lib/money';

interface DashboardData {
  totalStats: {
    totalTenants: number;
    activeTenants: number;
    totalUsers: number;
    totalRooms: number;
    totalReservations: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    averageRevenuePerTenant: number;
  };
  occupancyMetrics: {
    averageADR: number;
    averageREVPAR: number;
  };
  tenantMetrics: {
    newTenantsThisMonth: number;
    activeSubscriptions: Record<'active' | 'suspended' | 'trial' | 'inactive', number>;
  };
  userMetrics: { averageUsersPerTenant: number };
}

interface TopTenant {
  tenantId: string;
  tenantName: string;
  tenantSlug?: string;
  totalRevenue: number;
}

const formatMoney = (n: number) => fmtMoney(n, '₦');

export default function SuperadminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [topTenants, setTopTenants] = useState<TopTenant[]>([]);
  const [health, setHealth] = useState<{ status: string; uptime: number } | null>(null);
  const [attention, setAttention] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const safe = (p: Promise<any>) => p.catch(() => ({ data: { data: null } }));
      const [dash, top, hlth, tickets, sla, backups] = await Promise.all([
        api.get('/superadmin/dashboard'),
        api.get('/superadmin/top-tenants?limit=5'),
        safe(api.get('/superadmin/health')),
        safe(api.get('/superadmin/support/stats')),
        safe(api.get('/superadmin/sla/summary')),
        safe(api.get('/superadmin/backup-metrics')),
      ]);
      setMetrics(dash.data.data);
      setTopTenants(top.data.data || []);
      setHealth(hlth.data?.data || null);

      const items: AlertItem[] = [];
      const openTickets = (tickets.data?.data?.openTickets || 0) + (tickets.data?.data?.inProgressTickets || 0);
      if (openTickets > 0) {
        items.push({
          id: 'tickets',
          severity: 'high',
          title: `${openTickets} support ticket${openTickets > 1 ? 's' : ''} awaiting action`,
          description: 'Tenants are waiting on replies or resolution.',
          link: { label: 'Open tickets', onClick: () => navigate('/support-tickets') },
        });
      }
      const suspended = dash.data.data?.tenantMetrics?.activeSubscriptions?.suspended || 0;
      if (suspended > 0) {
        items.push({
          id: 'suspended',
          severity: 'medium',
          title: `${suspended} tenant${suspended > 1 ? 's' : ''} suspended`,
          description: 'Suspended tenants cannot access the platform.',
          link: { label: 'Review tenants', onClick: () => navigate('/superadmin/tenants') },
        });
      }
      const slaViolations = sla.data?.data?.tenantsWithViolations || 0;
      if (slaViolations > 0) {
        items.push({
          id: 'sla',
          severity: 'critical',
          title: `${slaViolations} tenant${slaViolations > 1 ? 's' : ''} breaching SLA`,
          description: 'Service-level agreements are being violated.',
          link: { label: 'SLA dashboard', onClick: () => navigate('/sla-dashboard') },
        });
      }
      const failedBackups = backups.data?.data?.failedBackups || 0;
      const lastBackup = backups.data?.data?.lastBackupTime;
      if (failedBackups > 0) {
        items.push({
          id: 'backups',
          severity: 'high',
          title: `${failedBackups} failed backup${failedBackups > 1 ? 's' : ''} on record`,
          description: lastBackup ? `Most recent backup: ${new Date(lastBackup).toLocaleString()}` : undefined,
          link: { label: 'Backups', onClick: () => navigate('/backup-restore') },
        });
      } else if (lastBackup && Date.now() - new Date(lastBackup).getTime() > 48 * 3600 * 1000) {
        items.push({
          id: 'backup-stale',
          severity: 'medium',
          title: 'No successful backup in 48h',
          description: `Last backup ran ${new Date(lastBackup).toLocaleString()}`,
          link: { label: 'Backups', onClick: () => navigate('/backup-restore') },
        });
      }
      setAttention(items);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load platform metrics'));
    } finally {
      setLoading(false);
    }
  };

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
  }, [user, isAuthenticated, navigate]);

  const subscriptions = metrics?.tenantMetrics.activeSubscriptions;

  return (
    <Layout>
      <PageHeader
        title="Platform overview"
        subtitle="Across every tenant on InnSight"
        actions={
          <>
            <Button variant="ghost" icon={<RefreshCcw size={15} />} onClick={fetchAll} loading={loading}>
              Refresh
            </Button>
            <Button variant="primary" icon={<Building2 size={15} />} onClick={() => navigate('/superadmin/tenants')}>
              Manage tenants
            </Button>
          </>
        }
      />

      {loading && !metrics && (
        <div className="stats-grid">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} height="110px" />
          ))}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={fetchAll} />}

      {metrics && !loading && (
        <>
          {attention.length > 0 && (
            <Panel title="Needs attention" subtitle={`${attention.length} item${attention.length > 1 ? 's' : ''} requiring action`}>
              <AlertPanel items={attention} />
            </Panel>
          )}

          <div className="stats-grid">
            <StatCard label="Total tenants" value={metrics.totalStats.totalTenants} icon={<Building2 size={18} />} delta={`${metrics.tenantMetrics.newTenantsThisMonth} new this month`} />
            <StatCard label="Active subscriptions" value={metrics.totalStats.activeTenants} tone="good" icon={<Activity size={18} />} delta={subscriptions ? `${subscriptions.suspended} suspended · ${subscriptions.trial} trial` : undefined} />
            <StatCard label="Platform users" value={metrics.totalStats.totalUsers} icon={<Users size={18} />} delta={`${metrics.userMetrics.averageUsersPerTenant.toFixed(1)} avg per tenant`} />
            <StatCard label="Rooms" value={metrics.totalStats.totalRooms} icon={<DoorOpen size={18} />} />
            <StatCard label="Reservations" value={metrics.totalStats.totalReservations} icon={<Calendar size={18} />} />
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <StatCard label="Total revenue" value={formatMoney(metrics.revenueMetrics.totalRevenue)} icon={<DollarSign size={18} />} delta={`${formatMoney(metrics.revenueMetrics.averageRevenuePerTenant)} avg per tenant`} />
            <StatCard label="Avg daily rate" value={formatMoney(metrics.occupancyMetrics.averageADR)} icon={<DollarSign size={18} />} />
            <StatCard label="RevPAR" value={formatMoney(metrics.occupancyMetrics.averageREVPAR)} icon={<DollarSign size={18} />} />
            <StatCard
              label="API health"
              value={health?.status === 'healthy' ? 'Healthy' : 'Unknown'}
              tone={health?.status === 'healthy' ? 'good' : 'warning'}
              icon={<Activity size={18} />}
              delta={health ? `Uptime ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : undefined}
            />
          </div>

          <div className="grid2" style={{ alignItems: 'start' }}>
            <Panel title="Top tenants by revenue" subtitle="Lifetime reservation revenue">
              <DataTable
                data={topTenants}
                rowKey={(row) => row.tenantId}
                columns={[
                  {
                    key: 'tenantName',
                    header: 'Tenant',
                    render: (row: TopTenant) => (
                      <span
                        style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--teal-700)' }}
                        onClick={() => navigate(`/superadmin/tenants/${row.tenantId}`)}
                      >
                        {row.tenantName}
                      </span>
                    ),
                  },
                  { key: 'tenantSlug', header: 'Slug' },
                  {
                    key: 'totalRevenue',
                    header: 'Revenue',
                    align: 'right',
                    render: (row: TopTenant) => formatMoney(row.totalRevenue),
                  },
                ]}
                empty={{ title: 'No revenue yet', description: 'Revenue appears once tenants take paid reservations.' }}
              />
            </Panel>

            <Panel title="Subscription status" subtitle="Tenant subscription breakdown">
              {subscriptions && (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  {(['active', 'trial', 'suspended', 'inactive'] as const).map((status) => (
                    <div key={status} className="row-between" style={{ textTransform: 'capitalize' }}>
                      <span className="row">
                        <StatusBadge status={status} dot={false}>{status}</StatusBadge>
                      </span>
                      <strong>{subscriptions[status] ?? 0}</strong>
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/billing')}
                    icon={<ArrowRight size={14} />}
                  >
                    Manage subscriptions
                  </Button>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </Layout>
  );
}
