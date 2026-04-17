import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
  TrendingUp,
  Zap,
  AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SLAMetrics {
  uptime: number;
  responseTime: number;
  errorRate: number;
  supportMetrics: {
    avgResponseTime: number;
    resolutionRate: number;
    customerSatisfaction: number;
  };
  backupSuccessRate: number;
}

interface SLAAgreement {
  id: string;
  tenantId: string;
  tier: 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'violated' | 'expired';
  metrics: {
    uptimeTarget: number;
    responseTimeTarget: number;
    errorRateTarget: number;
  };
  currentCompliance: number;
  violations: number;
  lastUpdated: string;
}

interface PlatformSummary {
  totalUptime: number;
  averageResponseTime: number;
  errorRate: number;
  activeAgreements: number;
  violatingAgreements: number;
  backupSuccessRate: number;
}

export default function SLADashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [loading, setLoading] = useState(true);
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [agreements, setAgreements] = useState<SLAAgreement[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);

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

    fetchData();
  }, [user, isAuthenticated, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [summaryRes, agreementsRes] = await Promise.all([
        api.get('/superadmin/sla/summary'),
        api.get('/superadmin/sla/agreements'),
      ]);

      setPlatformSummary(summaryRes.data?.data);
      setAgreements(agreementsRes.data?.data || []);
    } catch (error: any) {
      toast.error('Failed to load SLA data');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantMetrics = async (tenantId: string) => {
    try {
      const response = await api.get(`/superadmin/sla/compliance/${tenantId}`);
      setMetrics(response.data?.data);
    } catch (error: any) {
      toast.error('Failed to load tenant metrics');
    }
  };

  const handleTenantSelect = (tenantId: string) => {
    setSelectedTenant(tenantId);
    if (tenantId) {
      fetchTenantMetrics(tenantId);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'starter':
        return 'bg-blue-100 text-blue-800';
      case 'professional':
        return 'bg-purple-100 text-purple-800';
      case 'enterprise':
        return 'bg-gold-100 text-gold-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'violated':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'expired':
        return <Clock className="h-4 w-4 text-gray-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getMetricStatus = (current: number, target: number, higherIsBetter: boolean = true) => {
    if (higherIsBetter) {
      return current >= target ? 'text-green-600' : 'text-red-600';
    } else {
      return current <= target ? 'text-green-600' : 'text-red-600';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">SLA Dashboard</h1>

        {/* Platform Summary */}
        {platformSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Platform Uptime</p>
                  <p className="text-2xl font-bold text-gray-900">{platformSummary.totalUptime.toFixed(2)}%</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">{platformSummary.averageResponseTime.toFixed(0)}ms</p>
                </div>
                <Zap className="h-8 w-8 text-yellow-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Error Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{platformSummary.errorRate.toFixed(2)}%</p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Agreements</p>
                  <p className="text-2xl font-bold text-gray-900">{platformSummary.activeAgreements}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Violations</p>
                  <p className="text-2xl font-bold text-gray-900">{platformSummary.violatingAgreements}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Backup Success</p>
                  <p className="text-2xl font-bold text-gray-900">{platformSummary.backupSuccessRate.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-600" />
              </div>
            </div>
          </div>
        )}

        {/* Tenant Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Tenant SLA Details</h2>
          {agreements.length === 0 ? (
            <p className="text-gray-600">No SLA agreements configured</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-4 font-semibold text-gray-900">Tenant ID</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-900">Tier</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-900">Status</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-900">Compliance</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-900">Violations</th>
                    <th className="text-left py-2 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map((agreement) => (
                    <tr key={agreement.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{agreement.tenantId}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${getTierColor(agreement.tier)}`}>
                          {agreement.tier}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(agreement.status)}
                          <span className="capitalize text-gray-700">{agreement.status}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${agreement.currentCompliance >= 95 ? 'bg-green-600' : agreement.currentCompliance >= 85 ? 'bg-yellow-600' : 'bg-red-600'}`}
                              style={{ width: `${agreement.currentCompliance}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold">{agreement.currentCompliance.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={agreement.violations > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                          {agreement.violations}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleTenantSelect(agreement.tenantId)}
                          className="text-blue-600 hover:text-blue-900 font-medium text-xs"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tenant Metrics Detail */}
        {selectedTenant && metrics && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Metrics for {selectedTenant}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Uptime</p>
                <p className={`text-3xl font-bold ${getMetricStatus(metrics.uptime, 99.5)}`}>
                  {metrics.uptime.toFixed(2)}%
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Response Time</p>
                <p className={`text-3xl font-bold ${getMetricStatus(metrics.responseTime, 500, false)}`}>
                  {metrics.responseTime.toFixed(0)}ms
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Error Rate</p>
                <p className={`text-3xl font-bold ${getMetricStatus(metrics.errorRate, 0.5, false)}`}>
                  {metrics.errorRate.toFixed(3)}%
                </p>
              </div>

              <div className="border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">Backup Success Rate</p>
                <p className={`text-3xl font-bold ${getMetricStatus(metrics.backupSuccessRate, 99)}`}>
                  {metrics.backupSuccessRate.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="mt-4 border-t pt-4">
              <h3 className="font-semibold text-gray-900 mb-3">Support Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Avg Response Time</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {metrics.supportMetrics.avgResponseTime.toFixed(0)}m
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Resolution Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics.supportMetrics.resolutionRate.toFixed(1)}%
                  </p>
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Customer Satisfaction</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.supportMetrics.customerSatisfaction.toFixed(1)}/5
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
