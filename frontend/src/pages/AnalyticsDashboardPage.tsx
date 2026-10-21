import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  BarChart3,
  DollarSign,
  Building,
  Users,
  Target,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  AlertPanel,
  Button,
  ErrorState,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatCard,
} from '../components/ui';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';

interface DashboardMetrics {
  period: { start: string; end: string };
  revenue: {
    totalRevenue: number;
    roomRevenue: number;
    roomServiceRevenue: number;
    averageDailyRate: number;
    changePercent: number;
  };
  occupancy: {
    totalRooms: number;
    occupiedRoomDays: number;
    totalRoomDays: number;
    occupancyRate: number;
  };
  satisfaction: {
    totalRequests: number;
    resolvedRequests: number;
    resolutionRate: number;
    urgentRequests: number;
    urgentResolutionRate: number;
    avgResolutionTime: number;
  };
  operational: {
    housekeepingTasks: number;
    maintenanceTickets: number;
    guestRequests: number;
    totalTasks: number;
  };
  alerts: any[];
  trends: {
    revenue: Array<{ date: string; revenue: number }>;
    occupancy: Array<{ date: string; occupancyRate: number }>;
  };
}

const PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y', label: 'Last year' },
];

const occupancyTone = (rate: number) => (rate >= 80 ? 'good' : rate >= 60 ? 'warning' : 'critical');
const resolutionTone = (rate: number) => (rate >= 90 ? 'good' : rate >= 75 ? 'warning' : 'critical');

export default function AnalyticsDashboardPage() {
  const { user } = useAuthStore();
  const { currencySymbol } = useTenantSettings();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadDashboardData = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/analytics/dashboard?period=${period}`);
      setMetrics(response.data.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load analytics');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, period]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const money = (n: number) => formatMoney(n, currencySymbol);
  const pct = (v: number) => `${v.toFixed(1)}%`;

  const revenueSeries = (metrics?.trends.revenue ?? []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));
  const occupancySeries = (metrics?.trends.occupancy ?? []).map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  }));

  return (
    <Layout>
      <PageHeader
        title="Analytics"
        subtitle={
          lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Business intelligence'
        }
        actions={
          <>
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
              aria-label="Reporting period"
              style={{ width: 'auto' }}
            >
              {PERIODS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button variant="secondary" icon={<RefreshCw size={16} />} loading={loading} onClick={loadDashboardData}>
              Refresh
            </Button>
          </>
        }
      />

      {loading && !metrics ? (
        <div className="grid4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-4)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="140px" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadDashboardData} />
      ) : metrics ? (
        <div className="stack">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            <StatCard
              label="Total revenue"
              value={money(metrics.revenue.totalRevenue)}
              delta={`${metrics.revenue.changePercent >= 0 ? '+' : ''}${metrics.revenue.changePercent.toFixed(1)}% vs prev · ADR ${money(metrics.revenue.averageDailyRate)}`}
              tone={metrics.revenue.changePercent >= 0 ? 'good' : 'critical'}
              icon={<DollarSign size={18} />}
            />
            <StatCard
              label="Occupancy rate"
              value={pct(metrics.occupancy.occupancyRate)}
              delta={`${metrics.occupancy.occupiedRoomDays} of ${metrics.occupancy.totalRoomDays} room-days`}
              tone={occupancyTone(metrics.occupancy.occupancyRate)}
              icon={<Building size={18} />}
            />
            <StatCard
              label="Request resolution"
              value={pct(metrics.satisfaction.resolutionRate)}
              delta={`${metrics.satisfaction.resolvedRequests}/${metrics.satisfaction.totalRequests} requests resolved`}
              tone={resolutionTone(metrics.satisfaction.resolutionRate)}
              icon={<Users size={18} />}
            />
            <StatCard
              label="Open operational tasks"
              value={String(metrics.operational.totalTasks)}
              delta={`HK ${metrics.operational.housekeepingTasks} · Maint ${metrics.operational.maintenanceTickets} · Requests ${metrics.operational.guestRequests}`}
              tone={metrics.operational.totalTasks > 20 ? 'warning' : 'neutral'}
              icon={<Target size={18} />}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-4)' }}>
            <Panel title="Revenue trend" subtitle={PERIODS.find((p) => p.value === period)?.label}>
              {revenueSeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={revenueSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" width={70} tickFormatter={(v: number) => `${currencySymbol}${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => [money(Number(v)), 'Revenue']} />
                    <Area type="monotone" dataKey="revenue" stroke="var(--teal)" fill="var(--teal)" fillOpacity={0.15} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm muted">No revenue data for this period</p>
              )}
            </Panel>

            <Panel title="Occupancy trend" subtitle={PERIODS.find((p) => p.value === period)?.label}>
              {occupancySeries.length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={occupancySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                    <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
                    <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Occupancy']} />
                    <Area type="monotone" dataKey="occupancyRate" stroke="var(--champagne)" fill="var(--champagne)" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm muted">No occupancy data for this period</p>
              )}
            </Panel>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-4)' }}>
            <Panel title="Revenue breakdown">
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <div className="row-between text-sm"><span>Room revenue</span><strong>{money(metrics.revenue.roomRevenue)}</strong></div>
                <div className="row-between text-sm"><span>Room service</span><strong>{money(metrics.revenue.roomServiceRevenue)}</strong></div>
                <div className="row-between text-sm"><span>Average daily rate</span><strong>{money(metrics.revenue.averageDailyRate)}</strong></div>
                <div className="row-between text-sm" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-2)' }}>
                  <span>Total</span><strong>{money(metrics.revenue.totalRevenue)}</strong>
                </div>
              </div>
            </Panel>

            <Panel title="Guest requests">
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <div className="row-between text-sm"><span>Resolution rate</span><strong>{pct(metrics.satisfaction.resolutionRate)}</strong></div>
                <div className="row-between text-sm"><span>Urgent resolution</span><strong>{pct(metrics.satisfaction.urgentResolutionRate)}</strong></div>
                <div className="row-between text-sm"><span>Urgent requests</span><strong>{metrics.satisfaction.urgentRequests}</strong></div>
                <div className="row-between text-sm">
                  <span>Avg resolution time</span>
                  <strong>{metrics.satisfaction.avgResolutionTime > 0 ? `${Math.round(metrics.satisfaction.avgResolutionTime)}h` : '—'}</strong>
                </div>
              </div>
            </Panel>

            {metrics.alerts.length > 0 && (
              <Panel title={`Active alerts (${metrics.alerts.length})`}>
                <AlertPanel
                  items={metrics.alerts.slice(0, 5).map((a: any, i: number) => {
                    const sev = String(a.severity ?? 'info').toLowerCase();
                    return {
                      id: a.id ?? i,
                      severity: (['critical', 'high', 'medium', 'low', 'info'].includes(sev) ? sev : 'info') as any,
                      title: a.title ?? a.type ?? 'Alert',
                      description: a.description ?? a.message,
                    };
                  })}
                />
              </Panel>
            )}
          </div>
        </div>
      ) : (
        <Panel>
          <div className="row" style={{ justifyContent: 'center', padding: 'var(--space-8)' }}>
            <BarChart3 size={20} />
            <span className="text-sm muted">No analytics data available</span>
          </div>
        </Panel>
      )}
    </Layout>
  );
}
