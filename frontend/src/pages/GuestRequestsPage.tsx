import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  MessageSquare,
  Clock,
  AlertTriangle,
  User,
  Calendar,
  Hash,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AuditTrail,
  Button,
  DetailDrawer,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  Select,
  Skeleton,
  SkeletonCard,
  StatCard,
  StatusBadge,
  TextInput,
  type AuditEntry,
} from '../components/ui';
import styles from './GuestRequestsPage.module.css';

interface GuestRequest {
  id: string;
  requestType: 'amenities' | 'maintenance' | 'housekeeping' | 'concierge' | 'other';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  title: string;
  description: string;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  roomNumber?: string;
  assignedTo?: string;
  department?: string;
  estimatedCompletion?: string;
  actualCompletion?: string;
  createdAt: string;
  updatedAt: string;
}

interface RequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  urgent: number;
  overdue: number;
  averageResolutionTime: number;
}

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'info',
  low: 'neutral',
};

const NEXT_STATUS: Record<string, { label: string; status: string }[]> = {
  pending: [
    { label: 'Assign', status: 'assigned' },
    { label: 'Start work', status: 'in_progress' },
    { label: 'Cancel', status: 'cancelled' },
  ],
  assigned: [
    { label: 'Start work', status: 'in_progress' },
    { label: 'Cancel', status: 'cancelled' },
  ],
  in_progress: [{ label: 'Mark complete', status: 'completed' }],
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'amenities': return '🛁';
    case 'maintenance': return '🔧';
    case 'housekeeping': return '🧹';
    case 'concierge': return '🎩';
    default: return '❓';
  }
};

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const isOverdue = (request: GuestRequest) =>
  !!request.estimatedCompletion &&
  request.status !== 'completed' &&
  request.status !== 'cancelled' &&
  new Date(request.estimatedCompletion) < new Date();

export default function GuestRequestsPage() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadRequests();
    loadStats();
  }, [user?.tenantId, statusFilter, priorityFilter, typeFilter]);

  const loadRequests = async () => {
    if (!user?.tenantId) return;
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (typeFilter !== 'all') params.append('requestType', typeFilter);
      const response = await api.get(`/tenants/${user.tenantId}/guest-requests?${params}`);
      setRequests(response.data.data);
    } catch {
      toast.error('Failed to load guest requests');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user.tenantId}/guest-requests/stats/summary`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading request stats:', error);
    }
  };

  const filteredRequests = requests.filter(
    (request) =>
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.guestName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.roomNumber?.includes(searchTerm)
  );

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (priorityFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0);

  return (
    <Layout>
      <PageHeader title="Guest requests" subtitle="Manage and respond to guest service requests" />

      {stats && (
        <div className="grid4" style={{ marginBottom: 'var(--space-6)' }}>
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Pending" value={stats.pending} tone="warning" />
          <StatCard label="In progress" value={stats.inProgress} />
          <StatCard label="Completed" value={stats.completed} tone="good" />
          <StatCard label="Urgent" value={stats.urgent} tone="critical" />
          <StatCard label="Overdue" value={stats.overdue ?? 0} tone={stats.overdue ? 'critical' : 'neutral'} />
        </div>
      )}

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search requests…"
        activeCount={activeFilterCount}
        onClear={() => {
          setSearchTerm('');
          setStatusFilter('all');
          setPriorityFilter('all');
          setTypeFilter('all');
        }}
      >
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
          <option value="all">All status</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} aria-label="Priority">
          <option value="all">All priority</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </Select>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type">
          <option value="all">All types</option>
          <option value="amenities">Amenities</option>
          <option value="maintenance">Maintenance</option>
          <option value="housekeeping">Housekeeping</option>
          <option value="concierge">Concierge</option>
          <option value="other">Other</option>
        </Select>
      </FilterBar>

      {loading ? (
        <div className="stack">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon={<MessageSquare size={28} strokeWidth={1.6} />}
          title="No guest requests found"
          description={
            searchTerm || activeFilterCount > 0
              ? 'No requests match your current filters.'
              : 'No guest requests have been submitted yet.'
          }
        />
      ) : (
        <div className="stack">
          {filteredRequests.map((request) => (
            <button
              type="button"
              key={request.id}
              className={styles.card}
              onClick={() => setSelectedId(request.id)}
            >
              {request.priority === 'urgent' && (
                <div className={styles.urgentTag}>
                  <AlertTriangle size={11} />
                  URGENT
                </div>
              )}
              <div className={styles.cardHead}>
                <div className={styles.cardHeadLeft}>
                  <div className={styles.typeIcon} aria-hidden="true">
                    {getTypeIcon(request.requestType)}
                  </div>
                  <div>
                    <h3 className={styles.cardTitle}>{request.title}</h3>
                    <div className={styles.cardMeta}>
                      <span>
                        <Hash size={12} />
                        {request.id.slice(-8)}
                      </span>
                      <span>
                        <Calendar size={12} />
                        {formatDate(request.createdAt)}
                      </span>
                      {request.roomNumber && (
                        <span>
                          <User size={12} />
                          Room {request.roomNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className={styles.badges}>
                  <StatusBadge status={request.priority} tone={PRIORITY_TONE[request.priority]} />
                  <StatusBadge status={request.status} />
                </div>
              </div>

              <p className={styles.cardDesc}>{request.description}</p>

              <div className={styles.cardFoot}>
                <div className={styles.cardFootLeft}>
                  {request.guestName && <span>Guest: {request.guestName}</span>}
                  {request.assignedTo && <span>Assigned: {request.assignedTo}</span>}
                  {request.estimatedCompletion && (
                    <span className={`${styles.due} ${isOverdue(request) ? styles.dueOverdue : ''}`}>
                      <Clock size={13} />
                      Due {formatDate(request.estimatedCompletion)}
                      {isOverdue(request) && ' · overdue'}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <RequestDetailDrawer
        requestId={selectedId}
        tenantId={user?.tenantId ?? undefined}
        onClose={() => setSelectedId(null)}
        onChanged={() => {
          loadRequests();
          loadStats();
        }}
      />
    </Layout>
  );
}

/* ==================== Detail drawer ==================== */

function RequestDetailDrawer({
  requestId,
  tenantId,
  onClose,
  onChanged,
}: {
  requestId: string | null;
  tenantId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [replyVisible, setReplyVisible] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = () => {
    if (!requestId || !tenantId) return;
    setLoading(true);
    api
      .get(`/tenants/${tenantId}/guest-requests/${requestId}`)
      .then((res) => setDetail(res.data?.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setDetail(null);
    setReply('');
    if (requestId && tenantId) load();
  }, [requestId, tenantId]);

  const setStatus = async (status: string) => {
    if (!detail) return;
    setUpdating(true);
    try {
      await api.patch(`/tenants/${tenantId}/guest-requests/${detail.id}`, { status });
      toast.success(`Marked ${status.replace(/_/g, ' ')}`);
      load();
      onChanged();
    } catch {
      toast.error('Failed to update request');
    } finally {
      setUpdating(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !detail) return;
    setSending(true);
    try {
      await api.post(`/tenants/${tenantId}/guest-requests/${detail.id}/messages`, {
        message: reply.trim(),
        isVisibleToGuest: replyVisible,
      });
      setReply('');
      setReplyVisible(false);
      load();
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const messages: any[] = detail?.messages ?? [];
  const updates: any[] = detail?.updates ?? [];
  const auditEntries: AuditEntry[] = updates.map((u: any) => ({
    id: u.id,
    action: `${(u.updateType ?? 'update').replace(/_/g, ' ')}${
      u.previousStatus && u.newStatus ? `: ${u.previousStatus} → ${u.newStatus}` : ''
    }`,
    actor: u.performedByUser?.firstName
      ? `${u.performedByUser.firstName} ${u.performedByUser.lastName}`
      : undefined,
    timestamp: u.createdAt,
    detail: u.notes ?? undefined,
  }));

  return (
    <DetailDrawer
      open={!!requestId}
      onClose={onClose}
      title={detail?.title ?? 'Request'}
      headerExtra={detail ? <StatusBadge status={detail.status} /> : undefined}
      width="lg"
    >
      {loading ? (
        <Skeleton height="300px" />
      ) : !detail ? (
        <EmptyState contained={false} title="Couldn't load this request" />
      ) : (
        <>
          {(NEXT_STATUS[detail.status] ?? []).length > 0 && (
            <div className={styles.statusActions}>
              <span className="text-xs muted" style={{ alignSelf: 'center' }}>
                Move to:
              </span>
              {(NEXT_STATUS[detail.status] ?? []).map((action) => (
                <Button
                  key={action.status}
                  size="sm"
                  variant={action.status === 'cancelled' ? 'danger' : 'secondary'}
                  loading={updating}
                  onClick={() => setStatus(action.status)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          <div className={styles.kvGrid} style={{ marginBottom: 'var(--space-5)' }}>
            <KV k="Guest" v={detail.guestName ?? '—'} />
            <KV k="Room" v={detail.roomNumber ?? '—'} />
            <KV k="Type" v={detail.requestType} />
            <KV k="Priority" v={detail.priority} />
            <KV k="Assigned to" v={detail.assignedTo ?? 'Unassigned'} />
            <KV k="Department" v={detail.department ?? '—'} />
            <KV
              k="Due"
              v={detail.estimatedCompletion ? formatDate(detail.estimatedCompletion) : '—'}
            />
            <KV k="Opened" v={formatDate(detail.createdAt)} />
          </div>

          <p className="text-sm" style={{ marginBottom: 'var(--space-5)', color: 'var(--text-secondary)' }}>
            {detail.description}
          </p>

          <h3 className="text-sm" style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>
            Messages ({messages.length})
          </h3>
          <div className={styles.thread}>
            {messages.length === 0 && (
              <p className="text-xs muted">No messages yet — reply below.</p>
            )}
            {messages.map((m: any) => (
              <div key={m.id} className={`${styles.msg} ${m.isFromGuest ? styles.msgGuest : styles.msgStaff}`}>
                {m.message}
                <div className={styles.msgMeta}>
                  {m.isFromGuest ? detail.guestName ?? 'Guest' : 'Staff'} ·{' '}
                  {formatDate(m.createdAt)}
                  {!m.isFromGuest && m.isVisibleToGuest && (
                    <span className={styles.msgVisibility}>visible to guest</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <Field label="Reply">
            <div className={styles.replyRow}>
              <TextInput
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write a reply…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendReply();
                  }
                }}
              />
              <Button variant="primary" icon={<Send size={14} />} loading={sending} onClick={sendReply}>
                Send
              </Button>
            </div>
          </Field>
          <label className="text-xs muted row" style={{ marginBottom: 'var(--space-5)' }}>
            <input
              type="checkbox"
              checked={replyVisible}
              onChange={(e) => setReplyVisible(e.target.checked)}
            />
            Visible to guest
          </label>

          {auditEntries.length > 0 && (
            <>
              <h3 className="text-sm" style={{ fontWeight: 700, marginBottom: 'var(--space-3)' }}>
                History
              </h3>
              <AuditTrail entries={auditEntries} />
            </>
          )}
        </>
      )}
    </DetailDrawer>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvKey}>{k}</span>
      <span className={styles.kvVal}>{v}</span>
    </div>
  );
}
