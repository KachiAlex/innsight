import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  BarChart3,
  Building,
  DollarSign,
  Download,
  FileText,
  RefreshCw,
  Star,
  Target,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import {
  Button,
  Column,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  TextInput,
} from '../components/ui';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';

type TabId = 'performance' | 'occupancy' | 'revenue' | 'financial' | 'feedback' | 'custom';

interface OccupancyReport {
  totalRooms: number;
  averageOccupancyRate: number;
  totalRoomNightsSold: number;
  adr: number;
  revpar: number;
  daily: { date: string; occupiedRooms: number; occupancyRate: number }[];
}

interface RevenueReport {
  totalRevenue: number;
  paymentCount: number;
  byMethod: Record<string, number>;
  daily: { date: string; amount: number }[];
}

interface FinancialReport {
  totalRevenue: number;
  paymentCount: number;
  outstandingBalance: number;
  openFolioCount: number;
  depositsHeld: number;
}

interface PerformanceReport {
  totalRooms: number;
  newReservations: number;
  activeReservations: number;
  cancellations: number;
  cancellationRate: number;
  openHousekeepingTasks: number;
  openMaintenanceTickets: number;
  bookingsRevenue: number;
}

interface FeedbackReport {
  guestRequestsByStatus: { status: string; count: number }[];
  ratedTickets: number;
  averageSatisfaction: number | null;
}

interface CustomReportResult {
  entity: string;
  from: string;
  to: string;
  rows: { key: string; count: number; total: number }[];
}

const TABS: { id: TabId; label: string; icon: typeof Target }[] = [
  { id: 'performance', label: 'Performance', icon: Target },
  { id: 'occupancy', label: 'Occupancy', icon: Building },
  { id: 'revenue', label: 'Revenue', icon: DollarSign },
  { id: 'financial', label: 'Financial', icon: FileText },
  { id: 'feedback', label: 'Guest feedback', icon: Star },
  { id: 'custom', label: 'Custom report', icon: BarChart3 },
];

const CUSTOM_ENTITIES = [
  { value: 'reservations', label: 'Reservations' },
  { value: 'payments', label: 'Payments' },
  { value: 'folios', label: 'Folios' },
  { value: 'rooms', label: 'Rooms' },
];

const CUSTOM_GROUPINGS = [
  { value: 'status', label: 'By status' },
  { value: 'day', label: 'By day' },
  { value: 'method', label: 'By method' },
];

export default function ReportsPage() {
  const { user } = useAuthStore();
  const { currencySymbol } = useTenantSettings();
  const [activeTab, setActiveTab] = useState<TabId>('performance');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [dateRange, setDateRange] = useState(() => ({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  }));
  const [customEntity, setCustomEntity] = useState('reservations');
  const [customGroupBy, setCustomGroupBy] = useState('status');
  const [customResult, setCustomResult] = useState<CustomReportResult | null>(null);
  const [runningCustom, setRunningCustom] = useState(false);

  const money = (n?: number | null) => formatMoney(n ?? 0, currencySymbol);

  const loadReport = useCallback(async () => {
    if (!user?.tenantId || activeTab === 'custom') return;
    setLoading(true);
    setError(null);
    const endpoints: Record<Exclude<TabId, 'custom'>, string> = {
      performance: 'performance-metrics',
      occupancy: 'occupancy',
      revenue: 'revenue',
      financial: 'financial',
      feedback: 'guest-feedback',
    };
    try {
      const response = await api.get(`/tenants/${user.tenantId}/reports/${endpoints[activeTab]}`, {
        params: { from: dateRange.from, to: dateRange.to },
      });
      setData(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load report');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, activeTab, dateRange]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const runCustomReport = async () => {
    if (!user?.tenantId) return;
    setRunningCustom(true);
    setError(null);
    try {
      const response = await api.post(`/tenants/${user.tenantId}/reports/custom`, {
        entity: customEntity,
        from: dateRange.from,
        to: dateRange.to,
        groupBy: customGroupBy,
      });
      setCustomResult(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to run custom report');
      setCustomResult(null);
    } finally {
      setRunningCustom(false);
    }
  };

  const exportCustomReport = async () => {
    if (!customResult) return;
    try {
      const { default: ExcelJS } = await import('exceljs');
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Report');
      ws.columns = [
        { header: CUSTOM_GROUPINGS.find((g) => g.value === customGroupBy)?.label ?? 'Key', key: 'key' },
        { header: 'Count', key: 'count' },
        { header: 'Total', key: 'total' },
      ];
      customResult.rows.forEach((r) => ws.addRow(r));
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${customResult.entity}-report-${dateRange.from}-to-${dateRange.to}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch {
      toast.error('Failed to export report');
    }
  };

  const chartLabel = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  const customColumns: Column<{ key: string; count: number; total: number }>[] = [
    { key: 'key', header: CUSTOM_GROUPINGS.find((g) => g.value === customGroupBy)?.label ?? 'Group' },
    { key: 'count', header: 'Count', align: 'right' },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      render: (r) => money(r.total),
    },
  ];

  const perf = activeTab === 'performance' ? (data as PerformanceReport | null) : null;
  const occ = activeTab === 'occupancy' ? (data as OccupancyReport | null) : null;
  const rev = activeTab === 'revenue' ? (data as RevenueReport | null) : null;
  const fin = activeTab === 'financial' ? (data as FinancialReport | null) : null;
  const fb = activeTab === 'feedback' ? (data as FeedbackReport | null) : null;

  return (
    <Layout>
      <PageHeader
        title="Reports"
        subtitle="Business intelligence for the selected period"
        actions={
          <>
            <TextInput
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((p) => ({ ...p, from: e.target.value }))}
              aria-label="From date"
              style={{ width: 'auto' }}
            />
            <TextInput
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((p) => ({ ...p, to: e.target.value }))}
              aria-label="To date"
              style={{ width: 'auto' }}
            />
            <Button variant="secondary" icon={<RefreshCw size={16} />} loading={loading} onClick={loadReport}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="tabs" style={{ marginBottom: 'var(--space-5)' }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} style={{ marginRight: 6, verticalAlign: -2 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="stack">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height="120px" />
            ))}
          </div>
          <Skeleton height="280px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={activeTab === 'custom' ? runCustomReport : loadReport} />
      ) : activeTab === 'custom' ? (
        <Panel title="Custom aggregation" subtitle="Group reservations, payments, folios, or rooms over the selected period">
          <div className="row" style={{ flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
            <Field label="Entity">
              <Select value={customEntity} onChange={(e) => setCustomEntity(e.target.value)} style={{ minWidth: 200 }}>
                {CUSTOM_ENTITIES.map((en) => (
                  <option key={en.value} value={en.value}>{en.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Group by">
              <Select value={customGroupBy} onChange={(e) => setCustomGroupBy(e.target.value)} style={{ minWidth: 200 }}>
                {CUSTOM_GROUPINGS.map((g) => (
                  <option key={g.value} value={g.value}>{g.label}</option>
                ))}
              </Select>
            </Field>
            <Button variant="primary" loading={runningCustom} onClick={runCustomReport} style={{ alignSelf: 'flex-end' }}>
              Run report
            </Button>
          </div>

          {customResult && (
            <>
              <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
                <span className="text-sm muted">
                  {customResult.rows.length} group{customResult.rows.length !== 1 ? 's' : ''} ·{' '}
                  {customResult.entity}
                </span>
                <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={exportCustomReport}>
                  Export Excel
                </Button>
              </div>
              <DataTable
                columns={customColumns}
                data={customResult.rows}
                rowKey={(r) => r.key}
                empty={{ title: 'No data in this period', description: 'Try a wider date range' }}
              />
            </>
          )}
        </Panel>
      ) : !data ? (
        <EmptyState icon={<BarChart3 size={28} strokeWidth={1.6} />} title="No data" description="No report data for this period" />
      ) : (
        <div className="stack">
          {perf && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <StatCard label="New reservations" value={String(perf.newReservations)} delta={`${perf.activeReservations} currently active`} icon={<FileText size={18} />} />
              <StatCard label="Bookings revenue" value={money(perf.bookingsRevenue)} delta="Active reservation rates" icon={<DollarSign size={18} />} />
              <StatCard
                label="Cancellation rate"
                value={`${perf.cancellationRate.toFixed(1)}%`}
                delta={`${perf.cancellations} cancelled`}
                tone={perf.cancellationRate > 20 ? 'warning' : 'neutral'}
              />
              <StatCard label="Open tasks" value={String(perf.openHousekeepingTasks + perf.openMaintenanceTickets)} delta={`HK ${perf.openHousekeepingTasks} · Maint ${perf.openMaintenanceTickets}`} tone={perf.openHousekeepingTasks + perf.openMaintenanceTickets > 15 ? 'warning' : 'neutral'} />
            </div>
          )}

          {occ && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <StatCard label="Avg occupancy" value={`${occ.averageOccupancyRate.toFixed(1)}%`} tone={occ.averageOccupancyRate >= 80 ? 'good' : occ.averageOccupancyRate >= 60 ? 'warning' : 'critical'} icon={<Building size={18} />} />
                <StatCard label="Room nights sold" value={String(occ.totalRoomNightsSold)} delta={`${occ.totalRooms} rooms`} icon={<Building size={18} />} />
                <StatCard label="ADR" value={money(occ.adr)} icon={<DollarSign size={18} />} />
                <StatCard label="RevPAR" value={money(occ.revpar)} icon={<DollarSign size={18} />} />
              </div>
              <Panel title="Daily occupancy" subtitle={`${occ.daily.length} days`}>
                {occ.daily.length ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={occ.daily.map((d) => ({ ...d, label: chartLabel(d.date) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" domain={[0, 100]} tickFormatter={(v: any) => `${v}%`} />
                      <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`, 'Occupancy']} />
                      <Area type="monotone" dataKey="occupancyRate" stroke="var(--teal)" fill="var(--teal)" fillOpacity={0.15} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm muted">No occupancy data for this period</p>
                )}
              </Panel>
            </>
          )}

          {rev && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
                <StatCard label="Total revenue" value={money(rev.totalRevenue)} icon={<DollarSign size={18} />} />
                <StatCard label="Payments" value={String(rev.paymentCount)} icon={<FileText size={18} />} />
                <StatCard label="Avg payment" value={money(rev.paymentCount ? rev.totalRevenue / rev.paymentCount : 0)} icon={<DollarSign size={18} />} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 'var(--space-4)' }}>
                <Panel title="Daily revenue">
                  {rev.daily.length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={rev.daily.map((d) => ({ ...d, label: chartLabel(d.date) }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" width={70} tickFormatter={(v: any) => `${currencySymbol}${(Number(v) / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => [money(Number(v)), 'Revenue']} />
                        <Area type="monotone" dataKey="amount" stroke="var(--champagne)" fill="var(--champagne)" fillOpacity={0.2} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm muted">No payments in this period</p>
                  )}
                </Panel>
                <Panel title="By payment method">
                  {Object.keys(rev.byMethod).length ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={Object.entries(rev.byMethod).map(([method, amount]) => ({ method, amount }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="method" tick={{ fontSize: 11 }} stroke="var(--muted)" />
                        <YAxis tick={{ fontSize: 11 }} stroke="var(--muted)" width={70} tickFormatter={(v: any) => `${currencySymbol}${(Number(v) / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(v: any) => [money(Number(v)), 'Total']} />
                        <Bar dataKey="amount" fill="var(--teal)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm muted">No payment methods recorded</p>
                  )}
                </Panel>
              </div>
            </>
          )}

          {fin && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-4)' }}>
              <StatCard label="Total revenue" value={money(fin.totalRevenue)} delta={`${fin.paymentCount} payments`} icon={<DollarSign size={18} />} />
              <StatCard label="Outstanding balances" value={money(fin.outstandingBalance)} delta={`${fin.openFolioCount} open folios`} tone={fin.outstandingBalance > 0 ? 'warning' : 'good'} icon={<FileText size={18} />} />
              <StatCard label="Deposits held" value={money(fin.depositsHeld)} icon={<DollarSign size={18} />} />
            </div>
          )}

          {fb && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              <Panel title="Satisfaction">
                <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                  <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text)' }}>
                    {fb.averageSatisfaction != null ? fb.averageSatisfaction.toFixed(1) : '—'}
                  </div>
                  <div className="text-sm muted">
                    {fb.ratedTickets} rated ticket{fb.ratedTickets !== 1 ? 's' : ''}
                  </div>
                </div>
              </Panel>
              <Panel title="Guest requests by status">
                {fb.guestRequestsByStatus.length ? (
                  <div className="stack" style={{ gap: 'var(--space-2)' }}>
                    {fb.guestRequestsByStatus.map((s) => (
                      <div key={s.status} className="row-between text-sm">
                        <StatusBadge status={s.status}>{s.status.replace(/_/g, ' ')}</StatusBadge>
                        <strong>{s.count}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm muted">No requests in this period</p>
                )}
              </Panel>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
