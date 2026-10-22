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
  Button,
  DataTable,
  ErrorState,
  PageHeader,
  Panel,
  Skeleton,
  StatCard,
  StatusBadge,
} from '../components/ui';

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

const formatMoney = (n: number) =>
  `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function SuperadminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [metrics, setMetrics] = useState<DashboardData | null>(null);
  const [topTenants, setTopTenants] = useState<TopTenant[]>([]);
  const [health, setHealth] = useState<{ status: string; uptime: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);
      const [dash, top, hlth] = await Promise.all([
        api.get('/superadmin/dashboard'),
        api.get('/superadmin/top-tenants?limit=5'),
        api.get('/superadmin/health'),
      ]);
      setMetrics(dash.data.data);
      setTopTenants(top.data.data || []);
      setHealth(hlth.data.data);
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
                  { key: 'tenantName', header: 'Tenant' },
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
