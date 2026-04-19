import { useEffect, useState, useCallback } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  Building2,
  Users,
  DollarSign,
  Home,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardSkeleton } from '../components/LoadingSkeleton';

interface DashboardMetrics {
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
    revenueGrowth: number;
    topRevenueTenantsCount: number;
  };
  occupancyMetrics: {
    averageOccupancyRate: number;
    averageADR: number;
    averageREVPAR: number;
  };
  tenantMetrics: {
    newTenantsThisMonth: number;
    newTenantsLastMonth: number;
    tenantGrowthRate: number;
    churnedTenants: number;
    activeSubscriptions: {
      active: number;
      suspended: number;
      trial: number;
      inactive: number;
    };
  };
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    createdAt: string;
  }>;
  timeline: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
  }>;
}

export default function SuperadminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Check auth and role
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role !== 'iitech_admin') {
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard', { replace: true });
      return;
    }
  }, [user, isAuthenticated, navigate]);

  const fetchMetrics = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const response = await api.get('/superadmin/dashboard');
      setMetrics(response.data.data);
      setLastUpdated(new Date());
      if (!showRefreshing) toast.success('Dashboard loaded');
    } catch (error: any) {
      console.error('Failed to fetch metrics:', error);
      const errorMessage =
        error.response?.data?.error?.message || 'Failed to load dashboard';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchMetrics(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-8">
          <DashboardSkeleton />
        </div>
      </Layout>
    );
  }

  if (!metrics) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <p className="text-gray-600">Failed to load dashboard metrics</p>
        </div>
      </Layout>
    );
  }

  const KPICard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color = 'blue',
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<any>;
    color?: string;
  }) => {
    const colorClasses = {
      blue: 'bg-blue-50 border-blue-200',
      green: 'bg-green-50 border-green-200',
      purple: 'bg-purple-50 border-purple-200',
      orange: 'bg-orange-50 border-orange-200',
    };

    return (
      <div className={`${colorClasses[color as keyof typeof colorClasses]} border rounded-lg p-6`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-${color}-100`}>
            <Icon className="h-6 w-6 text-gray-700" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Superadmin Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            </p>
          </div>
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <KPICard
            title="Total Tenants"
            value={metrics?.totalStats?.totalTenants || 0}
            subtitle={`${metrics?.totalStats?.activeTenants || 0} active`}
            icon={Building2}
            color="blue"
          />
          <KPICard
            title="Total Users"
            value={metrics?.totalStats?.totalUsers || 0}
            subtitle="Across all tenants"
            icon={Users}
            color="green"
          />
          <KPICard
            title="Total Rooms"
            value={metrics?.totalStats?.totalRooms || 0}
            subtitle="Across all properties"
            icon={Home}
            color="purple"
          />
          <KPICard
            title="Total Revenue"
            value={`$${((metrics?.revenueMetrics?.totalRevenue || 0) / 1000).toFixed(1)}k`}
            subtitle="All time"
            icon={DollarSign}
            color="orange"
          />
          <KPICard
            title="Total Reservations"
            value={metrics?.totalStats?.totalReservations || 0}
            subtitle="All time"
            icon={RefreshCw}
            color="blue"
          />
        </div>

        {/* Simple Metrics Summary */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Average Revenue per Tenant</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                ${metrics?.revenueMetrics?.averageRevenuePerTenant?.toFixed(2) || '0.00'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">New Tenants (This Month)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics?.tenantMetrics?.newTenantsThisMonth || 0}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {metrics?.tenantMetrics?.activeSubscriptions?.active || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
