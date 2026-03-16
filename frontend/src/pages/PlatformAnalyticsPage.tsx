import { useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { BarChart3, Users, DollarSign, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

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
  metrics: {
    revenue: number;
    occupancy: number;
    guestCount: number;
  };
  ranking: {
    revenueRank: number;
    occupancyRank: number;
  };
  trend: 'up' | 'down' | 'stable';
}

export default function PlatformAnalyticsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [analytics, setAnalytics] = useState<PlatformAnalytics | null>(null);
  const [comparisons, setComparisons] = useState<TenantComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role !== 'iitech_admin') {
      toast.error('Access denied.');
      navigate('/superadmin-dashboard', { replace: true });
      return;
    }

    fetchAnalytics();
  }, [user, isAuthenticated, navigate, period]);

  const fetchAnalytics = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const [analyticsRes, comparisonRes] = await Promise.all([
        api.get(`/superadmin/analytics?days=${period}`),
        api.get('/superadmin/analytics/tenants/comparison?limit=10'),
      ]);

      setAnalytics(analyticsRes.data.data);
      setComparisons(comparisonRes.data.data);
    } catch (error: any) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading || !analytics) {
    return (
      <Layout>
        <div className="text-center py-12">Loading analytics...</div>
      </Layout>
    );
  }

  const MetricCard = ({ title, value, change, icon: Icon, color = 'blue' }: any) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">{title}</p>
        <Icon className={`h-6 w-6 text-${color}-400`} />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <p
          className={`text-sm mt-2 ${
            change >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {change >= 0 ? '+' : ''}{change.toFixed(1)}% vs last period
        </p>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last year</option>
            </select>
            <button
              onClick={() => fetchAnalytics(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Growth Metrics */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Growth Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Tenant Growth"
              value={`${analytics.growth.tenantGrowth.toFixed(1)}%`}
              icon={Users}
              color="blue"
            />
            <MetricCard
              title="User Growth"
              value={`${analytics.growth.userGrowth.toFixed(1)}%`}
              icon={Users}
              color="green"
            />
            <MetricCard
              title="Reservation Growth"
              value={`${analytics.growth.reservationGrowth.toFixed(1)}%`}
              icon={BarChart3}
              color="purple"
            />
            <MetricCard
              title="Revenue Growth"
              value={`${analytics.growth.revenueGrowth.toFixed(1)}%`}
              icon={DollarSign}
              color="orange"
            />
          </div>
        </div>

        {/* Performance Metrics */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Avg Occupancy"
              value={`${analytics.performance.averageOccupancyRate.toFixed(1)}%`}
              icon={BarChart3}
              color="blue"
            />
            <MetricCard
              title="Avg Daily Rate"
              value={`$${analytics.performance.averageADR.toFixed(0)}`}
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="Total Reservations"
              value={analytics.performance.totalReservations.toLocaleString()}
              icon={Users}
              color="purple"
            />
            <MetricCard
              title="Platform Revenue"
              value={`$${(analytics.performance.totalRevenue / 1000).toFixed(1)}k`}
              icon={DollarSign}
              color="orange"
            />
          </div>
        </div>

        {/* Tenant Health */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tenant Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Active</span>
                <span className="font-bold text-gray-900">{analytics.tenantHealth.activeTenantsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Inactive</span>
                <span className="font-bold text-gray-900">{analytics.tenantHealth.inactiveTenantsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Churned</span>
                <span className="font-bold text-red-600">{analytics.tenantHealth.churnedTenantsCount}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">30-Day Forecast</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Projected Tenants</span>
                <span className="font-bold text-gray-900">{analytics.forecast.projectedTenants30Days}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Projected Revenue</span>
                <span className="font-bold text-gray-900">
                  ${(analytics.forecast.projectedRevenue30Days / 1000).toFixed(1)}k
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">90-Day Forecast</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Projected Tenants</span>
                <span className="font-bold text-gray-900">{analytics.forecast.projectedTenants90Days}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Projected Revenue</span>
                <span className="font-bold text-gray-900">
                  ${(analytics.forecast.projectedRevenue90Days / 1000).toFixed(1)}k
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Comparison */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Top Performing Tenants</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Tenant</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Revenue</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Occupancy</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Guests</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {comparisons.slice(0, 10).map((tenant) => (
                  <tr key={tenant.tenantId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {tenant.tenantName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      ${tenant.metrics.revenue.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tenant.metrics.occupancy.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {tenant.metrics.guestCount}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-block font-semibold ${
                          tenant.trend === 'up'
                            ? 'text-green-600'
                            : tenant.trend === 'down'
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}
                      >
                        {tenant.trend === 'up' ? '↑' : tenant.trend === 'down' ? '↓' : '→'}
                        {tenant.ranking.revenueRank}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
