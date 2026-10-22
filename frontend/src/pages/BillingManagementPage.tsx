import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { DollarSign, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { Button, DataTable, ErrorState, PageHeader, Panel, Skeleton, StatCard } from '../components/ui';

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

const formatMoney = (n: number) => `₦${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export default function BillingManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [metrics, setMetrics] = useState<BillingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [plansRes, metricsRes] = await Promise.all([
        api.get('/superadmin/billing/plans'),
        api.get('/superadmin/billing/metrics'),
      ]);
      setPlans(plansRes.data.data);
      setMetrics(metricsRes.data.data);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load billing data'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const arpu = metrics && metrics.activeSubscriptions > 0 ? metrics.mrr / metrics.activeSubscriptions : 0;
  const totalDist = metrics ? Object.values(metrics.planDistribution).reduce((a, b) => a + b, 0) : 0;

  return (
    <Layout>
      <PageHeader
        title="Subscriptions & billing"
        subtitle="Recurring revenue across the platform"
        actions={
          <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }
      />

      {loading && !metrics && (
        <div className="stats-grid">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} height="110px" />)}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={fetchData} />}

      {metrics && !loading && (
        <>
          <div className="stats-grid">
            <StatCard label="Active subscriptions" value={metrics.activeSubscriptions} icon={<Users size={18} />} />
            <StatCard label="MRR" value={formatMoney(metrics.mrr)} icon={<DollarSign size={18} />} />
            <StatCard label="ARR" value={formatMoney(metrics.arr)} icon={<TrendingUp size={18} />} />
            <StatCard
              label="Churn rate"
              value={`${metrics.churnRate.toFixed(1)}%`}
              tone={metrics.churnRate > 5 ? 'critical' : metrics.churnRate > 0 ? 'warning' : 'good'}
              delta={metrics.overdueInvoices > 0 ? `${metrics.overdueInvoices} overdue invoices` : 'No overdue invoices'}
            />
          </div>

          <div className="grid2" style={{ alignItems: 'start' }}>
            <Panel title="Plan distribution" subtitle="Tenants per plan">
              {totalDist === 0 ? (
                <p className="text-sm muted">No subscriptions yet.</p>
              ) : (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  {Object.entries(metrics.planDistribution).map(([plan, count]) => (
                    <div key={plan} className="row-between" style={{ textTransform: 'capitalize' }}>
                      <span className="text-sm">{plan}</span>
                      <span className="row">
                        <span style={{ width: 110, height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden', display: 'inline-block' }}>
                          <span style={{ display: 'block', height: '100%', width: `${(count / totalDist) * 100}%`, background: 'var(--teal-700)' }} />
                        </span>
                        <strong style={{ minWidth: 24, textAlign: 'right' }}>{count}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Revenue metrics">
              <div className="stack" style={{ gap: 'var(--space-4)' }}>
                <div>
                  <p className="text-sm muted" style={{ margin: 0 }}>Average revenue per subscription</p>
                  <p className="kpi-value">{formatMoney(arpu)}</p>
                </div>
                <div>
                  <p className="text-sm muted" style={{ margin: 0 }}>Overdue invoices</p>
                  <p className="kpi-value" style={{ color: metrics.overdueInvoices > 0 ? 'var(--danger)' : undefined }}>
                    {metrics.overdueInvoices}
                  </p>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Subscription plans" subtitle={`${plans.length} plans configured`}>
            <DataTable
              data={plans}
              rowKey={(row) => row.id}
              columns={[
                { key: 'name', header: 'Plan', render: (p: Plan) => (
                  <div>
                    <div style={{ fontWeight: 600 }}>{p.name}</div>
                    <div className="text-xs muted">{p.description}</div>
                  </div>
                ) },
                { key: 'price', header: 'Price', render: (p: Plan) => `${formatMoney(p.price)}/${p.billingCycle === 'yearly' ? 'yr' : 'mo'}` },
                { key: 'maxRooms', header: 'Max rooms', align: 'center' },
                { key: 'maxUsers', header: 'Max users', align: 'center' },
                { key: 'features', header: 'Features', render: (p: Plan) => (
                  <span className="text-sm muted">
                    {p.features.slice(0, 3).join(' · ')}
                    {p.features.length > 3 && ` +${p.features.length - 3} more`}
                  </span>
                ) },
              ]}
              empty={{ title: 'No plans', description: 'Subscription plans will appear here.' }}
            />
          </Panel>
        </>
      )}
    </Layout>
  );
}
