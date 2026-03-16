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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  Activity,
  Zap,
  CheckCircle,
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
      toast.success('Dashboard updated');
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
    trend,
    color = 'blue',
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ComponentType<any>;
    trend?: { value: number; direction: 'up' | 'down' };
    color?: string;
  }) => {
    const colorClasses = {
      blue: 'bg-blue-50 border-blue-200',
      green: 'bg-green-50 border-green-200',
      purple: 'bg-purple-50 border-purple-200',
      orange: 'bg-orange-50 border-orange-200',
      red: 'bg-red-50 border-red-200',
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
        {trend && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2">
              {trend.direction === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.direction === 'up' ? '+' : ''}{trend.value}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Superadmin Dashboard</h1>
            <p className="text-gray-600 mt-1">Platform-wide insights and metrics</p>
          </div>
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="text-sm text-gray-500">
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>

        {/* Total Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title="Total Tenants"
            value={metrics.totalStats.totalTenants}
            subtitle={`${metrics.totalStats.activeTenants} active`}
            icon={Building2}
            color="blue"
          />
          <KPICard
            title="Active Users"
            value={metrics.userMetrics.totalActiveUsers}
            subtitle={`${metrics.userMetrics.averageUsersPerTenant.toFixed(1)} per tenant`}
            icon={Users}
            color="green"
          />
          <KPICard
            title="Total Rooms"
            value={metrics.totalStats.totalRooms}
            icon={Home}
            color="purple"
          />
          <KPICard
            title="Total Reservations"
            value={metrics.totalStats.totalReservations}
            subtitle="All time"
            icon={Activity}
            color="orange"
          />
          <KPICard
            title="Platform Revenue"
            value={`$${metrics.revenueMetrics.totalRevenue.toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 0,
            })}`}
            icon={DollarSign}
            color="green"
            trend={{
              value: metrics.revenueMetrics.revenueGrowth,
              direction: metrics.revenueMetrics.revenueGrowth >= 0 ? 'up' : 'down',
            }}
          />
        </div>

        {/* Revenue & Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Metrics</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Avg per Tenant</span>
                  <span className="font-semibold text-gray-900">
                    ${metrics.revenueMetrics.averageRevenuePerTenant.toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">ADR (Avg Daily Rate)</span>
                  <span className="font-semibold text-gray-900">
                    ${metrics.occupancyMetrics.averageADR.toLocaleString()}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">RevPAR</span>
                  <span className="font-semibold text-gray-900">
                    ${metrics.occupancyMetrics.averageREVPAR.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Average Rate</span>
                  <span className="font-semibold text-gray-900">
                    {metrics.occupancyMetrics.averageOccupancyRate.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${metrics.occupancyMetrics.averageOccupancyRate}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Growth</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">New This Month</span>
                  <span className="font-semibold text-gray-900">
                    {metrics.tenantMetrics.newTenantsThisMonth}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm text-gray-600">Growth Rate</span>
                  <span
                    className={`font-semibold ${
                      metrics.tenantMetrics.tenantGrowthRate >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {metrics.tenantMetrics.tenantGrowthRate >= 0 ? '+' : ''}
                    {metrics.tenantMetrics.tenantGrowthRate.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {metrics.tenantMetrics.activeSubscriptions.active}
              </div>
              <div className="text-sm text-gray-600 mt-1">Active</div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">
                {metrics.tenantMetrics.activeSubscriptions.trial}
              </div>
              <div className="text-sm text-gray-600 mt-1">Trial</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="text-2xl font-bold text-orange-700">
                {metrics.tenantMetrics.activeSubscriptions.suspended}
              </div>
              <div className="text-sm text-gray-600 mt-1">Suspended</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-2xl font-bold text-gray-700">
                {metrics.tenantMetrics.activeSubscriptions.inactive}
              </div>
              <div className="text-sm text-gray-600 mt-1">Inactive</div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        {metrics.alerts.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Alerts
            </h3>
            <div className="space-y-3">
              {metrics.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${
                    alert.severity === 'critical'
                      ? 'bg-red-50 border-red-200'
                      : alert.severity === 'warning'
                      ? 'bg-yellow-50 border-yellow-200'
                      : 'bg-blue-50 border-blue-200'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      alert.severity === 'critical'
                        ? 'text-red-900'
                        : alert.severity === 'warning'
                        ? 'text-yellow-900'
                        : 'text-blue-900'
                    }`}
                  >
                    {alert.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/tenants')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <Building2 className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">Manage Tenants</span>
            </button>
            <button
              onClick={() => navigate('/reports')}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <Zap className="h-5 w-5 text-orange-600" />
              <span className="font-medium text-gray-900">View Reports</span>
            </button>
            <button
              onClick={() => fetchMetrics(true)}
              className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <RefreshCw className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Refresh Data</span>
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
