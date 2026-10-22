import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import {
  Ticket,
  Plus,
  Search,
  MessageSquare,
  Send,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  Button,
  DataTable,
  DetailDrawer,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_customer' | 'on_hold' | 'resolved' | 'closed';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  responseCount: number;
  messages?: { senderType: string; message: string; createdAt: string }[];
}

interface TicketStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResolutionTime: number;
  averageResponseTime: number;
}

const STATUS_OPTIONS = ['open', 'in_progress', 'waiting_for_customer', 'on_hold', 'resolved', 'closed'];
const emptyCreate = { subject: '', description: '', category: 'general', priority: 'medium', requesterName: '', requesterEmail: '', tenantId: '' };

export default function SupportTicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedStatus, setSelectedStatus] = useState(searchParams.get('status') || 'all');
  const [selectedPriority, setSelectedPriority] = useState(searchParams.get('priority') || 'all');

  // URL-sync filters so views are shareable
  useEffect(() => {
    const next: Record<string, string> = {};
    if (searchTerm) next.q = searchTerm;
    if (selectedStatus !== 'all') next.status = selectedStatus;
    if (selectedPriority !== 'all') next.priority = selectedPriority;
    setSearchParams(next, { replace: true });
  }, [searchTerm, selectedStatus, selectedPriority, setSearchParams]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(emptyCreate);
  const [saving, setSaving] = useState(false);
  const [newResponse, setNewResponse] = useState('');
  const [replying, setReplying] = useState(false);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      if (selectedPriority !== 'all') params.append('priority', selectedPriority);

      const [statsRes, ticketsRes] = await Promise.all([
        api.get('/superadmin/support/stats'),
        api.get(`/superadmin/support?${params.toString()}`),
      ]);
      setStats(statsRes.data.data);
      setTickets(ticketsRes.data.data || []);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load tickets'));
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedPriority]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate, selectedStatus, selectedPriority]);

  const openDetail = async (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    try {
      const res = await api.get(`/superadmin/support/${ticket.id}`);
      setSelectedTicket(res.data.data);
    } catch {
      // keep list-level data
    }
  };

  const handleCreate = async () => {
    if (!createForm.subject || !createForm.description || !createForm.requesterEmail || !createForm.requesterName) {
      toast.error('Fill in all required fields');
      return;
    }
    try {
      setSaving(true);
      await api.post('/superadmin/support', {
        ...createForm,
        tenantId: createForm.tenantId || undefined,
      });
      toast.success('Ticket created');
      setShowCreateModal(false);
      setCreateForm(emptyCreate);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !newResponse.trim()) return;
    try {
      setReplying(true);
      await api.post(`/superadmin/support/${selectedTicket.id}/responses`, {
        message: newResponse,
        senderType: 'admin',
      });
      toast.success('Response added');
      setNewResponse('');
      openDetail(selectedTicket);
      fetchTickets();
    } catch {
      toast.error('Failed to add response');
    } finally {
      setReplying(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedTicket) return;
    try {
      await api.patch(`/superadmin/support/${selectedTicket.id}/status`, { status });
      toast.success('Status updated');
      openDetail(selectedTicket);
      fetchTickets();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const filteredTickets = tickets.filter(
    (t) =>
      !searchTerm ||
      t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Support tickets"
        subtitle="Tenant support requests"
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setShowCreateModal(true)}>
            New ticket
          </Button>
        }
      />

      {stats && (
        <div className="stats-grid">
          <StatCard label="Total" value={stats.totalTickets} icon={<Ticket size={18} />} />
          <StatCard label="Open" value={stats.openTickets} tone={stats.openTickets > 0 ? 'warning' : 'neutral'} />
          <StatCard label="In progress" value={stats.inProgressTickets} />
          <StatCard label="Resolved" value={stats.resolvedTickets} tone="good" />
          <StatCard label="Avg resolution" value={`${stats.averageResolutionTime.toFixed(1)}h`} />
        </div>
      )}

      <FilterBar>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <TextInput
              placeholder="Search ticket # or subject…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
        </div>
        <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} style={{ width: 190 }}>
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </Select>
        <Select value={selectedPriority} onChange={(e) => setSelectedPriority(e.target.value)} style={{ width: 150 }}>
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </Select>
      </FilterBar>

      <DataTable
        data={filteredTickets}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchTickets}
        empty={{ title: 'No tickets found', description: 'Tickets appear here as tenants submit requests.' }}
        columns={[
          { key: 'ticketNumber', header: 'Ticket', render: (t: SupportTicket) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{t.ticketNumber}</span> },
          { key: 'subject', header: 'Subject', render: (t: SupportTicket) => (
            <div>
              <div style={{ fontWeight: 600 }}>{t.subject}</div>
              <div className="text-xs muted">{t.category}</div>
            </div>
          ) },
          { key: 'priority', header: 'Priority', render: (t: SupportTicket) => <StatusBadge status={t.priority} dot={false}>{t.priority}</StatusBadge> },
          { key: 'status', header: 'Status', render: (t: SupportTicket) => <StatusBadge status={t.status} dot={false}>{t.status.replace(/_/g, ' ')}</StatusBadge> },
          { key: 'responses', header: 'Replies', align: 'center', render: (t: SupportTicket) => <span className="text-sm muted row"><MessageSquare size={13} /> {t.responseCount}</span> },
          { key: 'createdAt', header: 'Created', render: (t: SupportTicket) => <span className="text-sm muted">{new Date(t.createdAt).toLocaleDateString()}</span> },
          { key: 'actions', header: '', align: 'right', render: (t: SupportTicket) => (
            <Button variant="ghost" size="sm" onClick={() => openDetail(t)}>View</Button>
          ) },
        ]}
      />

      <DetailDrawer
        open={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket?.ticketNumber || 'Ticket'}
        headerExtra={selectedTicket && <span className="text-xs muted">{selectedTicket.subject}</span>}
      >
        {selectedTicket && (
          <div className="stack" style={{ gap: 'var(--space-4)' }}>
            <div className="row wrap">
              <StatusBadge status={selectedTicket.status} dot={false}>{selectedTicket.status.replace(/_/g, ' ')}</StatusBadge>
              <StatusBadge status={selectedTicket.priority} dot={false}>{selectedTicket.priority}</StatusBadge>
              <span className="text-xs muted">{selectedTicket.category} · opened {new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
            </div>

            <div>
              <p className="text-sm muted" style={{ margin: 0 }}>Description</p>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{selectedTicket.description}</p>
            </div>

            {selectedTicket.messages && selectedTicket.messages.length > 0 && (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                <p className="text-sm muted" style={{ margin: 0 }}>Thread</p>
                {selectedTicket.messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--radius-md)',
                      background: m.senderType === 'admin' ? 'var(--teal-50)' : 'var(--surface-sunken)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <div className="text-xs muted" style={{ marginBottom: 4, textTransform: 'capitalize' }}>
                      {m.senderType} · {new Date(m.createdAt).toLocaleString()}
                    </div>
                    {m.message}
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-sm muted" style={{ margin: '0 0 var(--space-2)' }}>Update status</p>
              <div className="row wrap">
                {STATUS_OPTIONS.map((s) => (
                  <Button
                    key={s}
                    variant={selectedTicket.status === s ? 'primary' : 'ghost'}
                    size="sm"
                    onClick={() => handleStatusUpdate(s)}
                    disabled={selectedTicket.status === s}
                  >
                    {s.replace(/_/g, ' ')}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Field label="Add a response">
                <Textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Type your response…"
                  rows={3}
                />
              </Field>
              <Button variant="primary" icon={<Send size={14} />} onClick={handleReply} loading={replying} disabled={!newResponse.trim()} style={{ marginTop: 'var(--space-2)' }}>
                Reply
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>

      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create support ticket"
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving}>Create ticket</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Subject" required>
            <TextInput value={createForm.subject} onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })} />
          </Field>
          <div className="grid2">
            <Field label="Requester name" required>
              <TextInput value={createForm.requesterName} onChange={(e) => setCreateForm({ ...createForm, requesterName: e.target.value })} />
            </Field>
            <Field label="Requester email" required>
              <TextInput type="email" value={createForm.requesterEmail} onChange={(e) => setCreateForm({ ...createForm, requesterEmail: e.target.value })} />
            </Field>
          </div>
          <div className="grid2">
            <Field label="Category">
              <Select value={createForm.category} onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}>
                <option value="general">General</option>
                <option value="billing">Billing</option>
                <option value="technical">Technical</option>
                <option value="feature-request">Feature request</option>
                <option value="bug">Bug report</option>
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={createForm.priority} onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
          </div>
          <Field label="Description" required>
            <Textarea rows={4} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </Field>
        </div>
      </Modal>
    </Layout>
  );
}
