import { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (showRefreshing = false) => {
    if (!user?.tenantId) return;

    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const today = new Date().toISOString().split('T')[0];
      const [reservationsRes, roomsRes, revenueRes, occupancyRes] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/reservations`, {
          params: { startDate: today, endDate: today },
        }),
        api.get(`/tenants/${user.tenantId}/rooms`),
        api.get(`/tenants/${user.tenantId}/reports/revenue`, {
          params: { startDate: today, endDate: today },
        }),
        api.get(`/tenants/${user.tenantId}/reports/occupancy`, {
          params: { startDate: today, endDate: today },
        }),
      ]);

      const reservations = reservationsRes.data.data || [];
      const rooms = roomsRes.data.data || [];
      const revenue = revenueRes.data.data || {};
      const occupancy = occupancyRes.data.data || {};

      setStats({
        todayReservations: reservations.length,
        checkedIn: reservations.filter((r: any) => r.status === 'checked_in').length,
        availableRooms: rooms.filter((r: any) => r.status === 'available').length,
        todayRevenue: revenue.totalRevenue || 0,
        occupancyRate: occupancy.occupancyRate || 0,
        adr: occupancy.adr || 0,
        revpar: occupancy.revpar || 0,
      });
      toast.success('Dashboard updated');
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      const errorMessage = error.response?.data?.error?.message || 'Failed to load dashboard data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const StatCard = memo(({ icon: Icon, title, value, subtitle, color }: any) => (
    <div
      style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: `1px solid ${color}20`,
        borderLeft: `4px solid ${color}`,
        transition: 'transform 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
            {title}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b' }}>
            {value}
          </div>
          {subtitle && (
            <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '0.25rem' }}>
              {subtitle}
            </div>
          )}
        </div>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '8px',
            background: `${color}20`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          <Icon size={24} />
        </div>
      </div>
    </div>
  ));

  const statCards = useMemo(() => {
    if (!stats) return null;
    return [
      {
        icon: Calendar,
        title: "Today's Reservations",
        value: stats.todayReservations,
        subtitle: `${stats.checkedIn} checked in`,
        color: '#3b82f6',
      },
      {
        icon: Bed,
        title: 'Available Rooms',
        value: stats.availableRooms,
        color: '#10b981',
      },
      {
        icon: DollarSign,
        title: "Today's Revenue",
        value: `₦${stats.todayRevenue.toLocaleString()}`,
        color: '#f59e0b',
      },
      {
        icon: AlertTriangle,
        title: 'Occupancy Rate',
        value: `${stats.occupancyRate.toFixed(1)}%`,
        subtitle: `ADR: ₦${stats.adr.toLocaleString()}`,
        color: '#8b5cf6',
      },
    ];
  }, [stats]);

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
              onClick={() => fetchStats()}
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
            <p style={{ marginBottom: '1rem' }}>{error}</p>
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
            onClick={() => fetchStats(true)}
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem',
            }}
          >
            {statCards.map((card, idx) => (
              <StatCard key={idx} {...card} />
            ))}
          </div>
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