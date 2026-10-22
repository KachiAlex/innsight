import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Search, RefreshCw, Download, User, Clock, Eye, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  DataTable,
  DetailDrawer,
  FilterBar,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface AuditLog {
  id: string;
  tenantId: string;
  tenantName: string;
  userId?: string;
  userName?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  metadata?: any;
  status: 'success' | 'error';
  createdAt: string;
}

interface AuditMetrics {
  totalLogs: number;
  actionsLast24h: number;
  errorRate: number;
  topActions: Array<{ action: string; count: number }>;
}

const actionTone = (action: string): 'info' | 'danger' | 'warning' | 'neutral' => {
  const a = action.toLowerCase();
  if (a.includes('delete')) return 'danger';
  if (a.includes('update')) return 'warning';
  if (a.includes('create')) return 'info';
  return 'neutral';
};

const fmtVal = (v: any) =>
  v === undefined ? '—' : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);

function StateDiff({ before, after }: { before: any; after: any }) {
  const beforeObj = before && typeof before === 'object' ? before : null;
  const afterObj = after && typeof after === 'object' ? after : null;

  if (!beforeObj && !afterObj) {
    return (
      <pre style={{ background: 'var(--surface-sunken)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', overflow: 'auto', maxHeight: 220, margin: 0 }}>
        {JSON.stringify(before ?? after, null, 2)}
      </pre>
    );
  }

  const keys = Array.from(new Set([...Object.keys(beforeObj || {}), ...Object.keys(afterObj || {})]));
  const changed = keys.filter((k) => JSON.stringify(beforeObj?.[k]) !== JSON.stringify(afterObj?.[k]));
  const unchanged = keys.filter((k) => !changed.includes(k));
  const rows = [...changed, ...unchanged];

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
          <th style={{ padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>Field</th>
          <th style={{ padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>Before</th>
          <th style={{ padding: '6px 8px', color: 'var(--muted)', fontWeight: 600 }}>After</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((k) => {
          const isChanged = changed.includes(k);
          return (
            <tr key={k} style={{ borderBottom: '1px solid var(--border)', background: isChanged ? 'var(--warning-bg)' : 'transparent' }}>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace', fontWeight: isChanged ? 700 : 400 }}>{k}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: 'var(--text-secondary)', maxWidth: 180, wordBreak: 'break-all' }}>{fmtVal(beforeObj?.[k])}</td>
              <td style={{ padding: '6px 8px', fontFamily: 'monospace', maxWidth: 180, wordBreak: 'break-all' }}>{fmtVal(afterObj?.[k])}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [exporting, setExporting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [actionFilter, setActionFilter] = useState(searchParams.get('action') || 'all');
  const [entityTypeFilter, setEntityTypeFilter] = useState(searchParams.get('entity') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [dateRange, setDateRange] = useState<'1h' | '24h' | '7d' | '30d'>((searchParams.get('range') as any) || '24h');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Keep the URL in sync so filtered views are shareable links
  useEffect(() => {
    const next: Record<string, string> = {};
    if (searchTerm) next.q = searchTerm;
    if (actionFilter !== 'all') next.action = actionFilter;
    if (entityTypeFilter !== 'all') next.entity = entityTypeFilter;
    if (statusFilter !== 'all') next.status = statusFilter;
    if (dateRange !== '24h') next.range = dateRange;
    setSearchParams(next, { replace: true });
  }, [searchTerm, actionFilter, entityTypeFilter, statusFilter, dateRange, setSearchParams]);

  const buildQuery = () =>
    new URLSearchParams({
      dateRange,
      ...(actionFilter !== 'all' && { action: actionFilter }),
      ...(entityTypeFilter !== 'all' && { entityType: entityTypeFilter }),
      ...(statusFilter !== 'all' && { status: statusFilter }),
    });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const query = buildQuery();
      const [logsRes, metricsRes] = await Promise.all([
        api.get(`/superadmin/audit-logs?${query}`),
        api.get('/superadmin/audit-logs/metrics'),
      ]);
      setLogs(logsRes.data?.data || []);
      setMetrics(metricsRes.data?.data || null);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load audit logs'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, actionFilter, entityTypeFilter, statusFilter]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate, dateRange, actionFilter, entityTypeFilter, statusFilter]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const response = await api.get(`/superadmin/audit-logs/export?${buildQuery()}&format=csv`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit-logs-${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Audit logs exported');
    } catch {
      toast.error('Failed to export audit logs');
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      !searchTerm ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.entityType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Audit logs"
        subtitle="Every mutating action across the platform"
        actions={
          <>
            <Button variant="secondary" icon={<Download size={15} />} onClick={handleExport} loading={exporting}>
              Export CSV
            </Button>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchLogs} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      {metrics && (
        <div className="stats-grid">
          <StatCard label="Total actions" value={metrics.totalLogs} icon={<FileText size={18} />} />
          <StatCard label="Last 24h" value={metrics.actionsLast24h} />
          <StatCard label="Error rate" value={`${metrics.errorRate}%`} tone={metrics.errorRate > 0 ? 'critical' : 'good'} />
          <StatCard label="Top action" value={metrics.topActions[0]?.action || '—'} />
        </div>
      )}

      <FilterBar>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <TextInput placeholder="Search actions, tenants…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
        </div>
        <Select value={dateRange} onChange={(e) => setDateRange(e.target.value as any)} style={{ width: 140 }}>
          <option value="1h">Last hour</option>
          <option value="24h">Last 24h</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </Select>
        <Select value={entityTypeFilter} onChange={(e) => setEntityTypeFilter(e.target.value)} style={{ width: 140 }}>
          <option value="all">All entities</option>
          <option value="tenant">Tenant</option>
          <option value="reservation">Reservation</option>
          <option value="room">Room</option>
          <option value="user">User</option>
          <option value="system">System</option>
        </Select>
        <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={{ width: 130 }}>
          <option value="all">All actions</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 120 }}>
          <option value="all">All status</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </Select>
      </FilterBar>

      <DataTable
        data={filteredLogs}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchLogs}
        empty={{ title: 'No audit logs', description: 'No activity matched the current filters.' }}
        columns={[
          { key: 'status', header: '', width: '40px', render: (l: AuditLog) => <StatusBadge status={l.status} tone={l.status === 'success' ? 'success' : 'danger'} dot={false} /> },
          { key: 'action', header: 'Action', render: (l: AuditLog) => <StatusBadge status={l.action} tone={actionTone(l.action)} dot={false}>{l.action}</StatusBadge> },
          { key: 'tenantName', header: 'Tenant' },
          { key: 'entityType', header: 'Entity', render: (l: AuditLog) => <span className="text-sm muted">{l.entityType}</span> },
          { key: 'userName', header: 'User', render: (l: AuditLog) => <span className="text-sm muted row"><User size={13} /> {l.userName || 'System'}</span> },
          { key: 'createdAt', header: 'Timestamp', render: (l: AuditLog) => <span className="text-sm muted row"><Clock size={13} /> {new Date(l.createdAt).toLocaleString()}</span> },
          { key: 'details', header: '', align: 'right', render: (l: AuditLog) => (
            <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => setSelectedLog(l)}>Details</Button>
          ) },
        ]}
      />

      <DetailDrawer
        open={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={selectedLog?.action || 'Audit detail'}
        headerExtra={selectedLog && <span className="text-xs muted">{selectedLog.tenantName} · {new Date(selectedLog.createdAt).toLocaleString()}</span>}
      >
        {selectedLog && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            <div className="grid2">
              <div><p className="text-xs muted" style={{ margin: 0 }}>Status</p><StatusBadge status={selectedLog.status} tone={selectedLog.status === 'success' ? 'success' : 'danger'} dot={false}>{selectedLog.status}</StatusBadge></div>
              <div><p className="text-xs muted" style={{ margin: 0 }}>Entity</p><p className="text-sm" style={{ margin: 0 }}>{selectedLog.entityType} · {selectedLog.entityId?.slice(0, 12)}</p></div>
              <div><p className="text-xs muted" style={{ margin: 0 }}>User</p><p className="text-sm" style={{ margin: 0 }}>{selectedLog.userName || 'System'}</p></div>
              <div><p className="text-xs muted" style={{ margin: 0 }}>Log ID</p><p className="text-sm" style={{ margin: 0, fontFamily: 'monospace' }}>{selectedLog.id.slice(0, 12)}…</p></div>
            </div>
            {(selectedLog.beforeState || selectedLog.afterState) && (
              <div>
                <p className="text-sm" style={{ margin: '0 0 var(--space-2)', fontWeight: 600 }}>Changes</p>
                <StateDiff before={selectedLog.beforeState} after={selectedLog.afterState} />
              </div>
            )}
            {selectedLog.metadata && (
              <div>
                <p className="text-sm" style={{ margin: '0 0 var(--space-2)', fontWeight: 600 }}>Metadata</p>
                <pre style={{ background: 'var(--surface-sunken)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', overflow: 'auto', maxHeight: 160, margin: 0 }}>
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </Layout>
  );
}
