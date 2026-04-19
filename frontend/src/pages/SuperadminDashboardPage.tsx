import { useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';

interface SimpleMetrics {
  totalTenants: number;
  totalUsers: number;
  totalRooms: number;
  totalReservations: number;
  totalRevenue: number;
}

export default function SuperadminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [metrics, setMetrics] = useState<SimpleMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('[SuperadminDashboard] Page mounted');
    console.log('[SuperadminDashboard] isAuthenticated:', isAuthenticated);
    console.log('[SuperadminDashboard] user:', user);
    console.log('[SuperadminDashboard] user role:', user?.role);

    if (!isAuthenticated) {
      console.log('[SuperadminDashboard] Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role !== 'iitech_admin') {
      console.log('[SuperadminDashboard] Not iitech_admin, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    console.log('[SuperadminDashboard] Auth check passed, fetching metrics');
    fetchMetrics();
  }, [user, isAuthenticated, navigate]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('[SuperadminDashboard] Fetching metrics from API...');
      const response = await api.get('/superadmin/dashboard');
      console.log('[SuperadminDashboard] API response:', response.data);
      
      const data = response.data.data;
      setMetrics({
        totalTenants: data.totalStats?.totalTenants || 0,
        totalUsers: data.totalStats?.totalUsers || 0,
        totalRooms: data.totalStats?.totalRooms || 0,
        totalReservations: data.totalStats?.totalReservations || 0,
        totalRevenue: data.revenueMetrics?.totalRevenue || 0,
      });
    } catch (err: any) {
      console.error('[SuperadminDashboard] Error fetching metrics:', err);
      setError(err.response?.data?.error?.message || 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Superadmin Dashboard</h1>
        
        {/* User Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm mb-6">
          <p className="text-lg text-gray-900 font-medium">Welcome, Superadmin!</p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-900">
              <strong className="text-blue-950">User:</strong> {user?.email || 'N/A'}<br/>
              <strong className="text-blue-950">Role:</strong> {user?.role || 'N/A'}<br/>
              <strong className="text-blue-950">Tenant ID:</strong> {user?.tenantId || 'N/A'}
            </p>
          </div>
        </div>

        {/* Metrics */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Platform Metrics</h2>
          
          {loading && (
            <p className="text-gray-600">Loading metrics...</p>
          )}
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}
          
          {metrics && !loading && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium">Total Tenants</p>
                <p className="text-2xl font-bold text-blue-950 mt-2">{metrics.totalTenants}</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-900 font-medium">Total Users</p>
                <p className="text-2xl font-bold text-green-950 mt-2">{metrics.totalUsers}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-900 font-medium">Total Rooms</p>
                <p className="text-2xl font-bold text-purple-950 mt-2">{metrics.totalRooms}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-900 font-medium">Total Revenue</p>
                <p className="text-2xl font-bold text-orange-950 mt-2">
                  ${(metrics.totalRevenue / 1000).toFixed(1)}k
                </p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-900 font-medium">Total Reservations</p>
                <p className="text-2xl font-bold text-gray-950 mt-2">{metrics.totalReservations}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
