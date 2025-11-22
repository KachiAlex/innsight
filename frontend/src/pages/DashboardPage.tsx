import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Calendar, DollarSign, Bed, AlertTriangle } from 'lucide-react';
import { DashboardSkeleton } from '../components/LoadingSkeleton';

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

  useEffect(() => {
    if (!user?.tenantId) return;

    const fetchStats = async () => {
      try {
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
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  const StatCard = ({ icon: Icon, title, value, subtitle, color }: any) => (
    <div
      style={{
        background: 'white',
        padding: '1.5rem',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: `1px solid ${color}20`,
        borderLeft: `4px solid ${color}`,
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
  );

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

  return (
    <Layout>
      <div>
        <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Dashboard</h1>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
          }}
        >
          <StatCard
            icon={Calendar}
            title="Today's Reservations"
            value={stats?.todayReservations || 0}
            subtitle={`${stats?.checkedIn || 0} checked in`}
            color="#3b82f6"
          />
          <StatCard
            icon={Bed}
            title="Available Rooms"
            value={stats?.availableRooms || 0}
            color="#10b981"
          />
          <StatCard
            icon={DollarSign}
            title="Today's Revenue"
            value={`₦${(stats?.todayRevenue || 0).toLocaleString()}`}
            color="#f59e0b"
          />
          <StatCard
            icon={AlertTriangle}
            title="Occupancy Rate"
            value={`${(stats?.occupancyRate || 0).toFixed(1)}%`}
            subtitle={`ADR: ₦${(stats?.adr || 0).toLocaleString()}`}
            color="#8b5cf6"
          />
        </div>

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
              <a
                href="/reservations"
                style={{
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: '#1e293b',
                  textAlign: 'center',
                }}
              >
                Create New Reservation
              </a>
              <a
                href="/rooms"
                style={{
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: '#1e293b',
                  textAlign: 'center',
                }}
              >
                Manage Rooms
              </a>
              <a
                href="/reports"
                style={{
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  borderRadius: '4px',
                  textDecoration: 'none',
                  color: '#1e293b',
                  textAlign: 'center',
                }}
              >
                View Reports
              </a>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}