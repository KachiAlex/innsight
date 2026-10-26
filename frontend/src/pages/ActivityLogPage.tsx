import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import {
  Button,
  Column,
  DataTable,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  beforeState?: unknown;
  afterState?: unknown;
  timestamp: string;
  user?: { id: string; firstName: string; lastName: string; email: string } | null;
}

const ACTION_TONES: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {};

function actionTone(action: string): 'success' | 'warning' | 'danger' | 'info' {
  if (ACTION_TONES[action]) return ACTION_TONES[action];
  if (action.startsWith('delete') || action.includes('cancel')) return 'danger';
  if (action.startsWith('create')) return 'success';
  if (action.startsWith('update') || action.includes('checkout')) return 'info';
  return 'warning';
}

function formatAction(action: string) {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ActivityLogPage() {
  const { user } = useAuthStore();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ action: '', entityType: '', userId: '', startDate: '', endDate: '' });
  const [detail, setDetail] = useState<AuditEntry | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params: any = { limit: 200 };
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params[k] = v;
      });
      const response = await api.get(`/tenants/${user.tenantId}/audits`, { params });
      setEntries(response.data.data || []);
    } catch {
      toast.error('Failed to load activity log');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filters]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const entityTypes = Array.from(new Set(entries.map((e) => e.entityType))).sort();
  const actions = Array.from(new Set(entries.map((e) => e.action))).sort();
  const actors = Array.from(
    new Map(entries.filter((e) => e.user).map((e) => [e.user!.id, e.user!])).values()
  );

  const columns: Column<AuditEntry>[] = [
    {
      key: 'when',
      header: 'When',
      render: (e) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
            {new Date(e.timestamp).toLocaleDateString()}
          </div>
          <div className="text-sm muted">{new Date(e.timestamp).toLocaleTimeString()}</div>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'Actor',
      render: (e) =>
        e.user ? (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
              {e.user.firstName} {e.user.lastName}
            </div>
            <div className="text-sm muted">{e.user.email}</div>
          </div>
        ) : (
          <span className="muted">System</span>
        ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (e) => (
        <StatusBadge tone={actionTone(e.action)} dot={false}>
          {formatAction(e.action)}
        </StatusBadge>
      ),
    },
    {
      key: 'entity',
      header: 'Entity',
      render: (e) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{e.entityType}</div>
          {e.entityId && (
            <div className="text-sm muted" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
              {e.entityId.slice(0, 8)}…
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '1%',
      align: 'right',
      render: (e) =>
        e.beforeState || e.afterState ? (
          <Button variant="ghost" size="sm" onClick={() => setDetail(e)}>
            View changes
          </Button>
        ) : null,
    },
  ];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <Layout>
      <PageHeader
        title="Activity Log"
        subtitle="Every recorded action in this property"
        actions={<Button variant="ghost" onClick={fetchEntries}>Refresh</Button>}
      />

      <FilterBar
        activeCount={activeFilterCount}
        onClear={() => setFilters({ action: '', entityType: '', userId: '', startDate: '', endDate: '' })}
      >
        <Select
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{formatAction(a)}</option>
          ))}
        </Select>
        <Select
          value={filters.entityType}
          onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
          aria-label="Filter by entity"
        >
          <option value="">All entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <Select
          value={filters.userId}
          onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
          aria-label="Filter by user"
        >
          <option value="">All users</option>
          {actors.map((a) => (
            <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
          ))}
        </Select>
        <TextInput
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          aria-label="Start date"
        />
        <TextInput
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          aria-label="End date"
        />
      </FilterBar>

      <DataTable<AuditEntry>
        columns={columns}
        data={entries}
        rowKey={(e) => e.id}
        loading={loading}
        onRetry={fetchEntries}
        onRowClick={(e) => (e.beforeState || e.afterState ? setDetail(e) : undefined)}
        empty={{
          title: 'No activity recorded',
          description:
            activeFilterCount > 0
              ? 'No entries match the current filters'
              : 'Actions like creating reservations, editing rooms, and changing settings will appear here',
        }}
      />

      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? `${formatAction(detail.action)} — ${detail.entityType}` : ''}
        footer={<Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>}
      >
        <div className="stack">
          {detail?.beforeState != null && (
            <div>
              <strong className="text-sm">Before</strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--text-xs)', background: 'var(--surface-2, rgba(0,0,0,.04))', padding: 'var(--space-3)', borderRadius: 'var(--radius-md, 8px)', overflowX: 'auto' }}>
                {JSON.stringify(detail.beforeState, null, 2)}
              </pre>
            </div>
          )}
          {detail?.afterState != null && (
            <div>
              <strong className="text-sm">After</strong>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--text-xs)', background: 'var(--surface-2, rgba(0,0,0,.04))', padding: 'var(--space-3)', borderRadius: 'var(--radius-md, 8px)', overflowX: 'auto' }}>
                {JSON.stringify(detail.afterState, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
}

export default ActivityLogPage;
