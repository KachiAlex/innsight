import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Activity, RefreshCw, Zap, AlertCircle, CheckCircle, TrendingUp, AlertTriangle, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Panel,
  Skeleton,
  StatCard,
  StatusBadge,
} from '../components/ui';

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

const metricTone = (current: number, target: number, higherIsBetter = true) =>
  (higherIsBetter ? current >= target : current <= target) ? 'var(--success, #2f8f5b)' : 'var(--danger)';

export default function SLADashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [agreements, setAgreements] = useState<SLAAgreement[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [metrics, setMetrics] = useState<SLAMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [summaryRes, agreementsRes] = await Promise.all([
        api.get('/superadmin/sla/summary'),
        api.get('/superadmin/sla/agreements'),
      ]);
      setPlatformSummary(summaryRes.data?.data);
      setAgreements(agreementsRes.data?.data || []);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load SLA data'));
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

  const handleTenantSelect = async (tenantId: string) => {
    setSelectedTenant(tenantId);
    try {
      setMetricsLoading(true);
      const response = await api.get(`/superadmin/sla/compliance/${tenantId}`);
      setMetrics(response.data?.data);
    } catch {
      toast.error('Failed to load tenant metrics');
      setMetrics(null);
    } finally {
      setMetricsLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Service levels"
        subtitle="Platform uptime, response, and SLA compliance"
        actions={
          <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchData} loading={loading}>
            Refresh
          </Button>
        }
      />

      {loading && !platformSummary && (
        <div className="stats-grid">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height="110px" />)}
        </div>
      )}

      {error && <ErrorState message={error.message} onRetry={fetchData} />}

      {platformSummary && (
        <div className="stats-grid">
          <StatCard label="Platform uptime" value={`${platformSummary.totalUptime.toFixed(2)}%`} tone={platformSummary.totalUptime >= 99 ? 'good' : 'warning'} icon={<Activity size={18} />} />
          <StatCard label="Avg response" value={`${platformSummary.averageResponseTime.toFixed(0)}ms`} icon={<Zap size={18} />} />
          <StatCard label="Error rate" value={`${platformSummary.errorRate.toFixed(2)}%`} tone={platformSummary.errorRate > 0.5 ? 'critical' : 'good'} icon={<AlertCircle size={18} />} />
          <StatCard label="Active agreements" value={platformSummary.activeAgreements} icon={<CheckCircle size={18} />} />
          <StatCard label="Violations" value={platformSummary.violatingAgreements} tone={platformSummary.violatingAgreements > 0 ? 'critical' : 'good'} icon={<AlertTriangle size={18} />} />
          <StatCard label="Backup success" value={`${platformSummary.backupSuccessRate.toFixed(1)}%`} tone={platformSummary.backupSuccessRate >= 95 ? 'good' : 'warning'} icon={<TrendingUp size={18} />} />
        </div>
      )}

      <Panel title="Tenant SLA agreements" subtitle={`${agreements.length} agreements`}>
        <DataTable
          data={agreements}
          rowKey={(row) => row.id}
          loading={loading}
          columns={[
            { key: 'tenantId', header: 'Tenant', render: (a: SLAAgreement) => <span className="text-sm" style={{ fontFamily: 'monospace' }}>{a.tenantId.slice(0, 8)}…</span> },
            { key: 'tier', header: 'Tier', render: (a: SLAAgreement) => <StatusBadge status={a.tier} dot={false}>{a.tier}</StatusBadge> },
            { key: 'status', header: 'Status', render: (a: SLAAgreement) => <StatusBadge status={a.status} dot={false}>{a.status}</StatusBadge> },
            {
              key: 'compliance',
              header: 'Compliance',
              render: (a: SLAAgreement) => (
                <span className="row">
                  <span style={{ width: 90, height: 8, borderRadius: 99, background: 'var(--line)', overflow: 'hidden', display: 'inline-block' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${Math.min(a.currentCompliance, 100)}%`,
                        background: a.currentCompliance >= 95 ? 'var(--success, #2f8f5b)' : a.currentCompliance >= 85 ? 'var(--warning, #d97706)' : 'var(--danger)',
                      }}
                    />
                  </span>
                  <span className="text-sm" style={{ fontWeight: 600 }}>{a.currentCompliance.toFixed(1)}%</span>
                </span>
              ),
            },
            {
              key: 'violations',
              header: 'Violations',
              align: 'center',
              render: (a: SLAAgreement) => (
                <span style={{ fontWeight: 600, color: a.violations > 0 ? 'var(--danger)' : 'var(--success, #2f8f5b)' }}>{a.violations}</span>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              render: (a: SLAAgreement) => (
                <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => handleTenantSelect(a.tenantId)}>
                  Details
                </Button>
              ),
            },
          ]}
          empty={{ title: 'No SLA agreements', description: 'Agreements appear once configured for tenants.' }}
        />
      </Panel>

      {selectedTenant && (
        <Panel title={`Tenant metrics — ${selectedTenant.slice(0, 8)}…`} subtitle="Against standard targets">
          {metricsLoading ? (
            <Skeleton height="200px" />
          ) : metrics ? (
            <>
              <div className="stats-grid">
                <StatCard label="Uptime (≥99.5%)" value={`${metrics.uptime.toFixed(2)}%`} icon={<Activity size={18} />} tone={metrics.uptime >= 99.5 ? 'good' : 'critical'} />
                <StatCard label="Response (≤500ms)" value={`${metrics.responseTime.toFixed(0)}ms`} icon={<Zap size={18} />} tone={metrics.responseTime <= 500 ? 'good' : 'critical'} />
                <StatCard label="Error rate (≤0.5%)" value={`${metrics.errorRate.toFixed(3)}%`} icon={<AlertCircle size={18} />} tone={metrics.errorRate <= 0.5 ? 'good' : 'critical'} />
                <StatCard label="Backup success (≥99%)" value={`${metrics.backupSuccessRate.toFixed(1)}%`} icon={<TrendingUp size={18} />} tone={metrics.backupSuccessRate >= 99 ? 'good' : 'critical'} />
              </div>
              <div className="grid3">
                <div>
                  <p className="text-sm muted" style={{ margin: 0 }}>Avg support response</p>
                  <p className="kpi-value">{metrics.supportMetrics.avgResponseTime.toFixed(0)}m</p>
                </div>
                <div>
                  <p className="text-sm muted" style={{ margin: 0 }}>Resolution rate</p>
                  <p className="kpi-value" style={{ color: metricTone(metrics.supportMetrics.resolutionRate, 90) }}>
                    {metrics.supportMetrics.resolutionRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm muted" style={{ margin: 0 }}>Satisfaction</p>
                  <p className="kpi-value">{metrics.supportMetrics.customerSatisfaction.toFixed(1)}/5</p>
                </div>
              </div>
            </>
          ) : (
            <EmptyState title="No metrics" description="Unable to load metrics for this tenant." />
          )}
        </Panel>
      )}
    </Layout>
  );
}
