import { useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BedDouble,
  LogIn,
  LogOut,
  Moon,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuthStore } from '../store/authStore';
import { useDashboardStats, type DashboardStats } from '../hooks/useQueryHooks';
import { useTenantSettings } from '../hooks/useTenantSettings';
import Layout from '../components/Layout';
import {
  AlertPanel,
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  StatusBadge,
  type AlertItem,
  type Column,
} from '../components/ui';
import { formatMoney, reservationTotal } from '../lib/money';
import toast from 'react-hot-toast';

const CHART_TEAL = '#163d45';
const CHART_GOLD = '#d2a96b';
const CHART_MUTED = '#718087';
const CHART_LINE = '#e8edeb';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const settings = useTenantSettings();
  const currency = settings.currencySymbol;

  const {
    data: stats,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useDashboardStats(user?.tenantId || '', {
    enabled: !!user?.tenantId,
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message || 'Failed to load dashboard data';
      toast.error(msg);
    },
  });

  const handleRefresh = useCallback(() => void refetch(), [refetch]);

  const attentionItems = useMemo<AlertItem[]>(() => {
    if (!stats) return [];
    const items: AlertItem[] = [];

    for (const alert of stats.openAlerts.slice(0, 3)) {
      items.push({
        id: `alert-${alert.id}`,
        severity: (alert.severity as AlertItem['severity']) || 'medium',
        title: alert.title,
        description: alert.message,
        meta: fmtDate(alert.createdAt),
        link: { label: 'View alerts', onClick: () => navigate('/alerts') },
      });
    }

    if (stats.awaitingCheckIn > 0) {
      items.push({
        id: 'awaiting-checkin',
        severity: 'medium',
        title: 'Arrivals awaiting check-in',
        description: `${stats.awaitingCheckIn} confirmed reservation${
          stats.awaitingCheckIn === 1 ? '' : 's'
        } due in today`,
        link: { label: 'Go to arrivals', onClick: () => navigate('/reservations') },
      });
    }

    const dirtyRooms =
      (stats.roomStatusCounts['dirty'] ?? 0) + (stats.roomStatusCounts['blocked'] ?? 0);
    if (dirtyRooms > 0) {
      items.push({
        id: 'dirty-rooms',
        severity: dirtyRooms > 5 ? 'high' : 'medium',
        title: 'Rooms need housekeeping attention',
        description: `${dirtyRooms} room${dirtyRooms === 1 ? '' : 's'} dirty or blocked`,
        link: { label: 'Open room board', onClick: () => navigate('/rooms') },
      });
    }

    if (stats.maintenanceOpen > 0) {
      items.push({
        id: 'maintenance',
        severity: stats.maintenanceOpen > 3 ? 'high' : 'medium',
        title: 'Open maintenance tickets',
        description: `${stats.maintenanceOpen} ticket${
          stats.maintenanceOpen === 1 ? '' : 's'
        } unresolved`,
        link: { label: 'View tickets', onClick: () => navigate('/maintenance') },
      });
    }

    return items;
  }, [stats, navigate]);

  const arrivalColumns = useMemo<Column<DashboardStats['arrivals'][number]>[]>(
    () => [
      {
        key: 'reservationNumber',
        header: 'Reservation',
        render: (r) => <strong>{r.reservationNumber}</strong>,
      },
      { key: 'guestName', header: 'Guest' },
      {
        key: 'room',
        header: 'Room',
        render: (r) => (r.room ? `${r.room.roomNumber} · ${r.room.roomType ?? ''}` : '—'),
      },
      {
        key: 'stay',
        header: 'Stay',
        render: (r) => `${fmtDate(r.checkInDate)} – ${fmtDate(r.checkOutDate)}`,
      },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      {
        key: 'total',
        header: 'Total',
        align: 'right',
        render: (r) => formatMoney(reservationTotal(r), currency),
      },
    ],
    [currency]
  );

  if (isLoading && !stats) {
    return (
      <Layout>
        <PageHeader title={`${greeting()}, ${user?.firstName ?? ''}`} />
        <div className="grid4" style={{ marginBottom: 'var(--space-6)' }}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid2">
          <SkeletonCard lines={6} />
          <SkeletonTable rows={4} />
        </div>
      </Layout>
    );
  }

  if (error && !stats) {
    return (
      <Layout>
        <PageHeader title="Dashboard" />
        <ErrorState
          message={
            error instanceof Error ? error.message : 'Unable to load dashboard data'
          }
          onRetry={handleRefresh}
        />
      </Layout>
    );
  }

  const occupancyDelta =
    stats && stats.dailyOccupancy.length > 1
      ? stats.dailyOccupancy[stats.dailyOccupancy.length - 1].occupancyRate -
        stats.occupancyRate
      : 0;
  const revenueDelta =
    stats && stats.yesterdayRevenue > 0
      ? ((stats.todayRevenue - stats.yesterdayRevenue) / stats.yesterdayRevenue) * 100
      : null;

  const roomStatusOrder = [
    'available',
    'occupied',
    'in_use',
    'dirty',
    'clean',
    'inspected',
    'out_of_order',
    'blocked',
  ];

  return (
    <Layout>
      <PageHeader
        title={`${greeting()}, ${user?.firstName ?? 'there'}`}
        subtitle={new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw size={15} />}
              onClick={handleRefresh}
              loading={isRefetching}
            >
              Refresh
            </Button>
            <Button variant="primary" onClick={() => navigate('/reservations')}>
              + New reservation
            </Button>
          </>
        }
      />

      {/* KPI cards */}
      <div className="grid4" style={{ marginBottom: 'var(--space-6)' }}>
        <StatCard
          label="Occupancy"
          value={`${(stats?.occupancyRate ?? 0).toFixed(1)}%`}
          delta={`${occupancyDelta >= 0 ? '↑' : '↓'} ${Math.abs(occupancyDelta).toFixed(
            1
          )} pts vs 21-day avg`}
          icon={<TrendingUp size={16} />}
          tone={
            (stats?.occupancyRate ?? 0) >= 80
              ? 'good'
              : (stats?.occupancyRate ?? 0) >= 60
              ? 'warning'
              : 'critical'
          }
        />
        <StatCard
          label="Arrivals today"
          value={stats?.arrivalsToday ?? 0}
          delta={`${stats?.awaitingCheckIn ?? 0} awaiting check-in`}
          icon={<LogIn size={16} />}
        />
        <StatCard
          label="Departures today"
          value={stats?.departuresToday ?? 0}
          delta={`${stats?.inHouse ?? 0} guests in-house`}
          icon={<LogOut size={16} />}
        />
        <StatCard
          label="Revenue today"
          value={formatMoney(stats?.todayRevenue ?? 0, currency)}
          delta={
            revenueDelta !== null
              ? `${revenueDelta >= 0 ? '↑' : '↓'} ${Math.abs(revenueDelta).toFixed(
                  1
                )}% vs yesterday`
              : 'No revenue yesterday'
          }
          tone={revenueDelta !== null && revenueDelta >= 0 ? 'good' : 'neutral'}
        />
      </div>

      {/* Room status strip */}
      <Panel title="Room status" subtitle={`${stats?.totalRooms ?? 0} rooms total`}>
        <div className="row wrap" style={{ gap: 'var(--space-2)' }}>
          {roomStatusOrder
            .filter((s) => (stats?.roomStatusCounts[s] ?? 0) > 0)
            .map((s) => (
              <StatusBadge key={s} status={s} dot>
                {s.replace(/_/g, ' ')} · {stats?.roomStatusCounts[s]}
              </StatusBadge>
            ))}
          {Object.keys(stats?.roomStatusCounts ?? {}).length === 0 && (
            <span className="muted text-sm">No rooms configured yet</span>
          )}
        </div>
      </Panel>

      <div className="grid2" style={{ marginTop: 'var(--space-6)' }}>
        {/* Occupancy chart */}
        <Panel title="Occupancy overview" subtitle="Room occupancy over the last 21 days">
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={stats?.dailyOccupancy ?? []}
                margin={{ top: 4, right: 8, bottom: 0, left: -16 }}
              >
                <defs>
                  <linearGradient id="occFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_TEAL} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={CHART_TEAL} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_LINE} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(5)}
                  tick={{ fontSize: 11, fill: CHART_MUTED }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: CHART_MUTED }}
                  axisLine={false}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  formatter={(v) => [`${v ?? 0}%`, 'Occupancy']}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{
                    border: `1px solid ${CHART_LINE}`,
                    borderRadius: 9,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="occupancyRate"
                  stroke={CHART_TEAL}
                  strokeWidth={2}
                  fill="url(#occFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Priority queue */}
        <Panel
          title="Needs your attention"
          subtitle="Open alerts and operational blockers"
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate('/alerts')}>
              All alerts →
            </Button>
          }
        >
          {attentionItems.length > 0 ? (
            <AlertPanel items={attentionItems} />
          ) : (
            <EmptyState
              contained={false}
              icon={<Sparkles size={26} />}
              title="All clear"
              description="No open alerts or operational blockers right now."
            />
          )}
        </Panel>
      </div>

      <div className="grid2" style={{ marginTop: 'var(--space-6)' }}>
        {/* Arrivals table */}
        <Panel
          title="Today's arrivals"
          subtitle="Reservations due to check in"
          flush
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate('/reservations')}>
              All reservations →
            </Button>
          }
        >
          <DataTable
            columns={arrivalColumns}
            data={stats?.arrivals ?? []}
            rowKey={(r) => r.id}
            empty={{
              title: 'No arrivals today',
              description: 'No reservations are due to check in today.',
            }}
            onRowClick={() => navigate('/reservations')}
          />
        </Panel>

        {/* Operations snapshot */}
        <Panel title="Operations snapshot">
          <div className="stack-lg">
            <div className="row-between">
              <div className="row">
                <Sparkles size={18} color={CHART_GOLD} />
                <div>
                  <strong>Housekeeping</strong>
                  <div className="muted text-xs">
                    {stats?.housekeepingCompleted ?? 0} of {stats?.housekeepingTotal ?? 0}{' '}
                    tasks completed
                  </div>
                </div>
              </div>
              <StatusBadge
                status={
                  stats && stats.housekeepingTotal > 0
                    ? stats.housekeepingCompleted >= stats.housekeepingTotal
                      ? 'completed'
                      : 'in_progress'
                    : 'neutral'
                }
              />
            </div>

            <div
              style={{
                height: 6,
                borderRadius: 999,
                background: 'var(--surface-sunken)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${
                    stats && stats.housekeepingTotal > 0
                      ? (stats.housekeepingCompleted / stats.housekeepingTotal) * 100
                      : 0
                  }%`,
                  background: 'var(--success)',
                  borderRadius: 999,
                  transition: 'width 400ms ease',
                }}
              />
            </div>

            <div className="row-between">
              <div className="row">
                <Wrench size={18} color={CHART_GOLD} />
                <div>
                  <strong>Maintenance</strong>
                  <div className="muted text-xs">
                    {stats?.maintenanceOpen ?? 0} open ticket
                    {stats?.maintenanceOpen === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <StatusBadge
                status={stats && stats.maintenanceOpen > 0 ? 'in_progress' : 'completed'}
              />
            </div>

            <div className="row-between">
              <div className="row">
                <Moon size={18} color={CHART_GOLD} />
                <div>
                  <strong>Night audit</strong>
                  <div className="muted text-xs">End-of-day reconciliation</div>
                </div>
              </div>
              <Link to="/night-audit" className="text-sm" style={{ fontWeight: 600 }}>
                Open →
              </Link>
            </div>

            <div className="row-between">
              <div className="row">
                <BedDouble size={18} color={CHART_GOLD} />
                <div>
                  <strong>Room board</strong>
                  <div className="muted text-xs">
                    {stats?.availableRooms ?? 0} of {stats?.totalRooms ?? 0} available
                  </div>
                </div>
              </div>
              <Link to="/rooms" className="text-sm" style={{ fontWeight: 600 }}>
                Open →
              </Link>
            </div>
          </div>
        </Panel>
      </div>

      {/* Quick actions */}
      <Panel title="Quick actions">
        <div className="row wrap">
          <Button variant="secondary" icon={<AlertTriangle size={15} />} onClick={() => navigate('/guest-requests')}>
            Guest requests
          </Button>
          <Button variant="secondary" icon={<Sparkles size={15} />} onClick={() => navigate('/housekeeping')}>
            Housekeeping board
          </Button>
          <Button variant="secondary" icon={<TrendingUp size={15} />} onClick={() => navigate('/reports')}>
            Reports
          </Button>
          <Button variant="secondary" icon={<Wrench size={15} />} onClick={() => navigate('/maintenance')}>
            Maintenance
          </Button>
        </div>
      </Panel>
    </Layout>
  );
}
