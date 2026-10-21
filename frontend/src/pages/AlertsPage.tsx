import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Select,
  SkeletonTable,
  StatusBadge,
} from '../components/ui';
import type { Column } from '../components/ui/DataTable';
import type { BadgeTone } from '../components/ui/StatusBadge';

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  resolver?: {
    firstName: string;
    lastName: string;
  };
}

const SEVERITY_TONE: Record<string, BadgeTone> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

export default function AlertsPage() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ status: '', severity: '', alertType: '' });
  const [resolvingAlerts, setResolvingAlerts] = useState<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      if (filters.alertType) params.alertType = filters.alertType;
      const response = await api.get(`/tenants/${user.tenantId}/alerts`, { params });
      setAlerts(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch alerts');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filters]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    setResolvingAlerts((prev) => new Set(prev).add(alertId));
    try {
      await api.post(`/tenants/${user?.tenantId}/alerts/${alertId}/resolve`);
      toast.success('Alert resolved successfully');
      fetchAlerts();
    } catch {
      // Error handled by API interceptor
    } finally {
      setResolvingAlerts((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const alertTypes = Array.from(new Set(alerts.map((a) => a.alertType))).sort();
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const openAlerts = alerts.filter((a) => a.status === 'open').length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length;
  const subtitleParts = [`${alerts.length} total`];
  if (openAlerts > 0) subtitleParts.push(`${openAlerts} open`);
  if (criticalAlerts > 0) subtitleParts.push(`${criticalAlerts} critical`);

  const columns: Column<Alert>[] = [
    {
      key: 'severity',
      header: 'Severity',
      render: (a) => <StatusBadge status={a.severity} tone={SEVERITY_TONE[a.severity]} />,
    },
    {
      key: 'type',
      header: 'Type',
      render: (a) => a.alertType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    },
    {
      key: 'title',
      header: 'Title',
      render: (a) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{a.title}</div>
          <div className="text-sm muted">{a.message}</div>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (a) => <StatusBadge status={a.status} /> },
    {
      key: 'date',
      header: 'Date',
      render: (a) => (
        <span className="text-sm muted">{format(new Date(a.createdAt), 'MMM dd, yyyy HH:mm')}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (a) =>
        a.status !== 'resolved' ? (
          <Button
            variant="primary"
            size="sm"
            icon={<CheckCircle size={14} />}
            loading={resolvingAlerts.has(a.id)}
            onClick={() => handleResolve(a.id)}
          >
            Resolve
          </Button>
        ) : a.resolver ? (
          <span className="text-xs muted">
            By {a.resolver.firstName} {a.resolver.lastName}
          </span>
        ) : null,
    },
  ];

  return (
    <Layout>
      <PageHeader title="Alerts" subtitle={subtitleParts.join(' · ')} />

      <FilterBar
        activeCount={activeFilterCount}
        onClear={() => setFilters({ status: '', severity: '', alertType: '' })}
      >
        <Select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </Select>
        <Select
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
          aria-label="Filter by severity"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select
          value={filters.alertType}
          onChange={(e) => setFilters({ ...filters, alertType: e.target.value })}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {alertTypes.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </FilterBar>

      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAlerts} />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<AlertCircle size={28} strokeWidth={1.6} />}
          title={activeFilterCount > 0 ? 'No alerts match your filters' : 'No alerts yet'}
          description={
            activeFilterCount > 0
              ? 'Try adjusting your filter criteria'
              : 'Alerts will appear here when system events occur'
          }
        />
      ) : (
        <DataTable columns={columns} data={alerts} rowKey={(a) => a.id} />
      )}
    </Layout>
  );
}
