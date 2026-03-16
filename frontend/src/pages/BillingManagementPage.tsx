import { useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { DollarSign, CreditCard, TrendingUp, Users, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'yearly';
  maxRooms: number;
  maxUsers: number;
  features: string[];
}

interface BillingMetrics {
  activeSubscriptions: number;
  mrr: number;
  arr: number;
  churnRate: number;
  planDistribution: Record<string, number>;
  overdueInvoices: number;
}

export default function BillingManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

    fetchData();
  }, [user, isAuthenticated, navigate]);

  const fetchData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const [plansRes, metricsRes] = await Promise.all([
        api.get('/superadmin/billing/plans'),
        api.get('/superadmin/billing/metrics'),
      ]);

      setPlans(plansRes.data.data);
      setMetrics(metricsRes.data.data);
    } catch (error: any) {
      console.error('Failed to fetch billing data:', error);
      toast.error('Failed to load billing data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  if (loading || !metrics) {
    return (
      <Layout>
        <div className="text-center py-12">Loading billing data...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Billing & Subscriptions</h1>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900">{metrics.activeSubscriptions}</p>
              </div>
              <Users className="h-10 w-10 text-blue-400" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Monthly Revenue (MRR)</p>
                <p className="text-3xl font-bold text-gray-900">${(metrics.mrr / 1000).toFixed(1)}k</p>
              </div>
              <DollarSign className="h-10 w-10 text-green-400" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Annual Revenue (ARR)</p>
                <p className="text-3xl font-bold text-gray-900">${(metrics.arr / 1000).toFixed(1)}k</p>
              </div>
              <TrendingUp className="h-10 w-10 text-purple-400" />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Churn Rate</p>
                <p className="text-3xl font-bold text-red-600">{metrics.churnRate.toFixed(1)}%</p>
              </div>
              <Users className="h-10 w-10 text-red-400" />
            </div>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Plan Distribution</h2>
            <div className="space-y-3">
              {Object.entries(metrics.planDistribution).map(([plan, count]) => (
                <div key={plan} className="flex items-center justify-between">
                  <span className="text-gray-600 capitalize">{plan}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{
                          width: `${(count / metrics.activeSubscriptions) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="font-semibold text-gray-900 w-8">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Metrics</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Average Revenue Per User</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${(metrics.mrr / metrics.activeSubscriptions).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Overdue Invoices</p>
                <p className="text-2xl font-bold text-red-600">{metrics.overdueInvoices}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-sm font-medium">
                View All Invoices
              </button>
              <button className="w-full px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-sm font-medium">
                Manage Plans
              </button>
              <button className="w-full px-4 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 text-sm font-medium">
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Subscription Plans */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Subscription Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition">
                <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-gray-600 text-sm mb-4">{plan.description}</p>
                
                <div className="mb-4">
                  <p className="text-3xl font-bold text-gray-900">
                    ${plan.price}
                    <span className="text-sm text-gray-600">/mo</span>
                  </p>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm text-gray-600">
                    <strong>Max Rooms:</strong> {plan.maxRooms}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Max Users:</strong> {plan.maxUsers}
                  </p>
                </div>

                <div className="border-t pt-4 mb-4">
                  <p className="text-sm font-semibold text-gray-900 mb-2">Features:</p>
                  <ul className="space-y-1">
                    {plan.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="text-sm text-gray-600">✓ {feature}</li>
                    ))}
                    {plan.features.length > 3 && (
                      <li className="text-sm text-gray-600">+ {plan.features.length - 3} more...</li>
                    )}
                  </ul>
                </div>

                <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                  Edit Plan
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
