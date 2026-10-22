import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Users, DollarSign, RefreshCw, TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';
import {
  Button,
  DataTable,
  ErrorState,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
} from '../components/ui';

interface PlatformAnalytics {
  growth: {
    tenantGrowth: number;
    userGrowth: number;
    reservationGrowth: number;
    revenueGrowth: number;
  };
  performance: {
    averageOccupancyRate: number;
    averageADR: number;
    totalReservations: number;
    totalRevenue: number;
  };
  tenantHealth: {
    activeTenantsCount: number;
    inactiveTenantsCount: number;
    churnedTenantsCount: number;
  };
  forecast: {
    projectedTenants30Days: number;
    projectedTenants90Days: number;
    projectedRevenue30Days: number;
    projectedRevenue90Days: number;
  };
}

interface TenantComparison {
  tenantId: string;
  tenantName: string;
  metrics: { revenue: number; occupancy: number; guestCount: number };
  ranking: { revenueRank: number; occupancyRank: number };
  trend: 'up' | 'down' | 'stable';
}

const formatMoney = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const growthDelta = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}% vs last period`;

export default function PlatformAnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [comparisons, setComparisons] = useState<TenantComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [period, setPeriod] = useState('30');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [analyticsRes, comparisonRes] = await Promise.all([
        api.get(`/superadmin/analytics?days=${period}`),
        api.get('/superadmin/analytics/tenants/comparison?limit=10'),
      ]);
      setAnalytics(analyticsRes.data.data);
      setComparisons(comparisonRes.data.data);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load analytics'));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate, period]);

  const trendIcon = (trend: TenantComparison['trend']) =>
    trend === 'up' ? <TrendingUp size={14} /> : trend === 'down' ? <TrendingDown size={14} /> : <Minus size={14} />;
  const trendTone = (trend: TenantComparison['trend']) =>
    trend === 'up' ? 'success' : trend === 'down' ? 'danger' : 'neutral';

  return (
    <Layout>
      <PageHeader
        title="Platform analytics"
        subtitle="Growth, performance, and tenant health"
        actions={
          <>
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 160 }}>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </Select>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchAnalytics} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      {loading && !analytics && (
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="110px" />)}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={fetchAnalytics} />}

      {analytics && (
        <>
          <Panel title="Growth" subtitle={`Change over the last ${period} days`} style={{ marginBottom: 'var(--space-5)' }}>
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <StatCard label="Tenant growth" value={`${analytics.growth.tenantGrowth.toFixed(1)}%`} icon={<Users size={18} />} delta={growthDelta(analytics.growth.tenantGrowth)} tone={analytics.growth.tenantGrowth >= 0 ? 'good' : 'critical'} />
              <StatCard label="User growth" value={`${analytics.growth.userGrowth.toFixed(1)}%`} icon={<Users size={18} />} delta={growthDelta(analytics.growth.userGrowth)} tone={analytics.growth.userGrowth >= 0 ? 'good' : 'critical'} />
              <StatCard label="Reservation growth" value={`${analytics.growth.reservationGrowth.toFixed(1)}%`} icon={<BarChart3 size={18} />} delta={growthDelta(analytics.growth.reservationGrowth)} tone={analytics.growth.reservationGrowth >= 0 ? 'good' : 'critical'} />
              <StatCard label="Revenue growth" value={`${analytics.growth.revenueGrowth.toFixed(1)}%`} icon={<DollarSign size={18} />} delta={growthDelta(analytics.growth.revenueGrowth)} tone={analytics.growth.revenueGrowth >= 0 ? 'good' : 'critical'} />
            </div>
          </Panel>

          <Panel title="Performance" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="stats-grid" style={{ marginBottom: 0 }}>
              <StatCard label="Avg occupancy" value={`${analytics.performance.averageOccupancyRate.toFixed(1)}%`} icon={<BarChart3 size={18} />} />
              <StatCard label="Avg daily rate" value={formatMoney(analytics.performance.averageADR)} icon={<DollarSign size={18} />} />
              <StatCard label="Total reservations" value={analytics.performance.totalReservations.toLocaleString()} icon={<Users size={18} />} />
              <StatCard label="Platform revenue" value={formatMoney(analytics.performance.totalRevenue)} icon={<DollarSign size={18} />} />
            </div>
          </Panel>

          <div className="grid3" style={{ marginBottom: 'var(--space-5)' }}>
            <Panel title="Tenant status">
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <div className="row-between"><span className="text-sm">Active</span><strong>{analytics.tenantHealth.activeTenantsCount}</strong></div>
                <div className="row-between"><span className="text-sm">Inactive</span><strong>{analytics.tenantHealth.inactiveTenantsCount}</strong></div>
                <div className="row-between"><span className="text-sm">Churned</span><strong style={{ color: 'var(--danger)' }}>{analytics.tenantHealth.churnedTenantsCount}</strong></div>
              </div>
            </Panel>
            <Panel title="30-day forecast">
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <div className="row-between"><span className="text-sm">Projected tenants</span><strong>{analytics.forecast.projectedTenants30Days}</strong></div>
                <div className="row-between"><span className="text-sm">Projected revenue</span><strong>{formatMoney(analytics.forecast.projectedRevenue30Days)}</strong></div>
              </div>
            </Panel>
            <Panel title="90-day forecast">
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                <div className="row-between"><span className="text-sm">Projected tenants</span><strong>{analytics.forecast.projectedTenants90Days}</strong></div>
                <div className="row-between"><span className="text-sm">Projected revenue</span><strong>{formatMoney(analytics.forecast.projectedRevenue90Days)}</strong></div>
              </div>
            </Panel>
          </div>

          <Panel title="Top performing tenants" subtitle="Ranked by revenue">
            <DataTable
              data={comparisons.slice(0, 10)}
              rowKey={(row) => row.tenantId}
              columns={[
                { key: 'tenantName', header: 'Tenant' },
                { key: 'revenue', header: 'Revenue', align: 'right', render: (t: TenantComparison) => formatMoney(t.metrics.revenue) },
                { key: 'occupancy', header: 'Occupancy', align: 'right', render: (t: TenantComparison) => `${t.metrics.occupancy.toFixed(1)}%` },
                { key: 'guests', header: 'Guests', align: 'right', render: (t: TenantComparison) => t.metrics.guestCount },
                { key: 'trend', header: 'Trend', render: (t: TenantComparison) => (
                  <StatusBadge status={t.trend} tone={trendTone(t.trend)} dot={false}>
                    <span className="row" style={{ gap: 4 }}>{trendIcon(t.trend)} #{t.ranking.revenueRank}</span>
                  </StatusBadge>
                ) },
              ]}
              empty={{ title: 'No tenant data', description: 'Comparisons appear once tenants have activity.' }}
            />
          </Panel>
        </>
      )}
    </Layout>
  );
}
