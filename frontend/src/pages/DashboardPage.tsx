import { useState, useMemo, useCallback } from 'react';

import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useDashboardStats } from '../hooks/useQueryHooks';
import { EnhancedStatCard, KPIGrid } from '../components/EnhancedStatCard';
import Layout from '../components/Layout';
import { Calendar, DollarSign, Bed, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import toast from 'react-hot-toast';

interface DashboardStats {
  todayReservations: number;
  checkedIn: number;
  availableRooms: number;
  todayRevenue: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [previousStats, setPreviousStats] = useState<DashboardStats | null>(null);

  // Use React Query for caching
  const { data: stats, isLoading: loading, error, refetch } = useDashboardStats(user?.tenantId || '', {
    enabled: !!user?.tenantId,
    onError: (err: unknown) => {
      const errorMessage =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
        (err instanceof Error ? err.message : 'Failed to load dashboard data');
      toast.error(errorMessage);
    },
    onSuccess: (newStats) => {
      if (newStats) {
        setPreviousStats(newStats);
      }
      toast.success('Dashboard updated');
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const fetchStats = useCallback(() => {
    void refetch();
  }, [refetch]);

  // Calculate trends
  const calculateTrend = (currentVal: number, previousVal?: number) => {
    if (!previousVal || previousVal === 0) return undefined;
    const percentChange = ((currentVal - previousVal) / previousVal) * 100;
    return {
      direction: percentChange > 0 ? ('up' as const) : percentChange < 0 ? ('down' as const) : ('neutral' as const),
      percentChange: Math.abs(percentChange),
      previousValue: previousVal,
    };
  };

  // Determine status based on metrics
  type StatusSeverity = 'good' | 'warning' | 'critical' | 'neutral';

  const getStatus = (metricName: string, value: number): StatusSeverity => {
    switch (metricName) {
      case 'occupancy':
        if (value >= 80) return 'good';
        if (value >= 60) return 'warning';
        return 'critical';

      case 'revenue':
        if (value > 0) return 'good';
        return 'neutral';
      case 'rooms':
        if (value < 10) return 'critical';
        if (value < 20) return 'warning';
        return 'good';
      default:
        return 'neutral';
    }
  };

  const statCards = useMemo(() => {
    if (!stats) return null;
    return [
      {
        icon: Calendar,
        title: "Today's Reservations",
        value: stats.todayReservations,
        subtitle: `${stats.checkedIn} checked in`,
        color: '#3b82f6',
        trend: calculateTrend(stats.todayReservations, previousStats?.todayReservations),
        status: getStatus('reservations', stats.todayReservations),
        sparkData: [stats.todayReservations * 0.7, stats.todayReservations * 0.85, stats.todayReservations],
        format: 'number',
      },
      {
        icon: Bed,
        title: 'Available Rooms',
        value: stats.availableRooms,
        color: '#10b981',
        trend: calculateTrend(stats.availableRooms, previousStats?.availableRooms),
        status: getStatus('rooms', stats.availableRooms),
        sparkData: [stats.availableRooms * 0.8, stats.availableRooms * 0.9, stats.availableRooms],
        format: 'number',
      },
      {
        icon: DollarSign,
        title: "Today's Revenue",
        value: stats.todayRevenue,
        color: '#f59e0b',
        trend: calculateTrend(stats.todayRevenue, previousStats?.todayRevenue),
        status: getStatus('revenue', stats.todayRevenue),
        sparkData: [stats.todayRevenue * 0.6, stats.todayRevenue * 0.85, stats.todayRevenue],
        format: 'currency',
      },
      {
        icon: AlertTriangle,
        title: 'Occupancy Rate',
        value: stats.occupancyRate,
        subtitle: `ADR: ₦${stats.adr.toLocaleString()}`,
        color: '#8b5cf6',
        trend: calculateTrend(stats.occupancyRate, previousStats?.occupancyRate),
        status: getStatus('occupancy', stats.occupancyRate),
        sparkData: [stats.occupancyRate * 0.85, stats.occupancyRate * 0.92, stats.occupancyRate],
        format: 'percentage',
      },
    ];
  }, [stats, previousStats]);

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Dashboard</h1>
          <DashboardSkeleton />
        </div>
      </Layout>
    );
  }

  if (error && !stats) {
    return (
      <Layout>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ color: '#1e293b' }}>Dashboard</h1>
            <button
              onClick={() => refetch()}
              style={{
                padding: '0.5rem 1rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <RefreshCw size={16} />
              Retry
            </button>
          </div>
          <div style={{
            background: 'white',
            padding: '2rem',
            borderRadius: '8px',
            textAlign: 'center',
            color: '#64748b',
          }}>
            <AlertCircle size={48} style={{ margin: '0 auto 1rem', color: '#ef4444' }} />
            <p style={{ marginBottom: '1rem' }}>
              {typeof error === 'string'
                ? error
                : error instanceof Error
                ? error.message
                : 'Unable to load dashboard data'}
            </p>
            <button
              onClick={() => fetchStats()}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1e293b' }}>Dashboard</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '0.5rem 1rem',
              background: refreshing ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!refreshing) {
                e.currentTarget.style.background = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (!refreshing) {
                e.currentTarget.style.background = '#3b82f6';
              }
            }}
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>

        {statCards && (
          <KPIGrid>
            {statCards.map((card, idx) => (
              <EnhancedStatCard
                key={idx}
                icon={card.icon}
                title={card.title}
                value={card.format === 'currency' ? `₦${card.value.toLocaleString()}` : 
                       card.format === 'percentage' ? `${card.value.toFixed(1)}%` :
                       card.value}
                subtitle={card.subtitle}
                color={card.color}
                trend={card.trend}
                status={card.status}
                sparkData={card.sparkData}
              />
            ))}
          </KPIGrid>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Key Metrics</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Average Daily Rate (ADR)</span>
                <span style={{ fontWeight: 'bold' }}>₦{(stats?.adr || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>RevPAR</span>
                <span style={{ fontWeight: 'bold' }}>₦{(stats?.revpar || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Occupancy Rate</span>
                <span style={{ fontWeight: 'bold' }}>{(stats?.occupancyRate || 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <Link
                to="/reservations"
                style={{
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: '#1e293b',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Create New Reservation
              </Link>
              <Link
                to="/rooms"
                style={{
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: '#1e293b',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Manage Rooms
              </Link>
              <Link
                to="/reports"
                style={{
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: '#1e293b',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#e2e8f0';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                View Reports
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}