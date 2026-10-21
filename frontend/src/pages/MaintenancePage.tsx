import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Wrench, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import FileUpload from '../components/FileUpload';
import {
  Button,
  DetailDrawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';
import styles from './MaintenancePage.module.css';

interface MaintenanceTicket {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  room?: {
    roomNumber: string;
  };
  reporter: {
    firstName: string;
    lastName: string;
  };
  assignedStaff?: {
    firstName: string;
    lastName: string;
  };
  photos?: string[];
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: 'var(--danger)',
  high: 'var(--warning)',
  medium: 'var(--info)',
  low: 'var(--success)',
};

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'info' | 'success'> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'success',
};

export default function MaintenancePage() {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [filters, setFilters] = useState({ status: '', priority: '' });
  const [resolvingTickets, setResolvingTickets] = useState<Set<string>>(new Set());

  const fetchTickets = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      const response = await api.get(`/tenants/${user.tenantId}/maintenance`, { params });
      setTickets(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filters]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleResolve = async (ticketId: string) => {
    setResolvingTickets((prev) => new Set(prev).add(ticketId));
    try {
      await api.patch(`/tenants/${user?.tenantId}/maintenance/${ticketId}`, {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
      });
      toast.success('Ticket resolved successfully');
      fetchTickets();
      setSelectedTicket((prev) => (prev?.id === ticketId ? { ...prev, status: 'resolved' } : prev));
    } catch {
      // Error handled by API interceptor
    } finally {
      setResolvingTickets((prev) => {
        const next = new Set(prev);
        next.delete(ticketId);
        return next;
      });
    }
  };

  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length;
  const urgentTickets = tickets.filter((t) => t.priority === 'urgent' && t.status !== 'resolved').length;
  const activeFilterCount = (filters.status ? 1 : 0) + (filters.priority ? 1 : 0);

  const subtitleParts = [`${tickets.length} total`];
  if (openTickets > 0) subtitleParts.push(`${openTickets} open`);
  if (urgentTickets > 0) subtitleParts.push(`${urgentTickets} urgent`);

  return (
    <Layout>
      <PageHeader
        title="Maintenance"
        subtitle={subtitleParts.join(' · ')}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>
            Create ticket
          </Button>
        }
      />

      <FilterBar
        activeCount={activeFilterCount}
        onClear={() => setFilters({ status: '', priority: '' })}
      >
        <Select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </Select>
        <Select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
      </FilterBar>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="200px" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchTickets} />
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<Wrench size={28} strokeWidth={1.6} />}
          title={
            activeFilterCount > 0 ? 'No tickets match your filters' : 'No maintenance tickets yet'
          }
          description={
            activeFilterCount > 0
              ? 'Try adjusting your filter criteria'
              : 'Create your first maintenance ticket to get started'
          }
          action={
            activeFilterCount === 0 ? (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                Create ticket
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={styles.grid}>
          {tickets.map((ticket) => (
            <div
              key={ticket.id}
              className={styles.card}
              style={{ '--priority-color': PRIORITY_COLOR[ticket.priority] ?? 'var(--info)' } as React.CSSProperties}
              onClick={() => setSelectedTicket(ticket)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setSelectedTicket(ticket);
              }}
            >
              <div className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>{ticket.title}</h3>
                  {ticket.room && <div className={styles.cardRoom}>Room {ticket.room.roomNumber}</div>}
                </div>
                <div className={styles.badges}>
                  <StatusBadge status={ticket.priority} tone={PRIORITY_TONE[ticket.priority]} />
                  <StatusBadge status={ticket.status} />
                </div>
              </div>

              <p className={styles.cardDesc}>
                {ticket.description.length > 140
                  ? `${ticket.description.substring(0, 140)}…`
                  : ticket.description}
              </p>

              <div className={styles.cardFoot}>
                <span>
                  {ticket.reporter.firstName} {ticket.reporter.lastName}
                </span>
                <span>{format(new Date(ticket.createdAt), 'MMM dd, yyyy')}</span>
              </div>

              {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                <div className={styles.cardActions} onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="primary"
                    block
                    icon={<CheckCircle size={15} />}
                    loading={resolvingTickets.has(ticket.id)}
                    onClick={() => handleResolve(ticket.id)}
                  >
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CreateTicketModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchTickets();
        }}
      />

      <TicketDetailsDrawer
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onResolve={handleResolve}
        resolving={selectedTicket ? resolvingTickets.has(selectedTicket.id) : false}
      />
    </Layout>
  );
}

function CreateTicketModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    roomId: '',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    api
      .get(`/tenants/${user?.tenantId}/rooms`)
      .then((res) => setRooms(res.data.data || []))
      .catch(() => {});
  }, [open, user?.tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/maintenance`, {
        roomId: formData.roomId || undefined,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        photos: photos.length > 0 ? photos : undefined,
      });
      toast.success('Ticket created successfully');
      onSuccess();
    } catch {
      // Error handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create maintenance ticket"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>
            Create ticket
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="stack">
        <Field label="Room" hint="Optional">
          <Select
            value={formData.roomId}
            onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
          >
            <option value="">Select a room (optional)</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber} — {room.roomType}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" required>
          <TextInput
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            placeholder="Brief description of the issue"
          />
        </Field>
        <Field label="Description" required>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            rows={4}
            placeholder="Detailed description of the maintenance issue"
          />
        </Field>
        <Field label="Priority" required>
          <Select
            value={formData.priority}
            onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
            required
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </Field>
        <Field label="Photos" hint="Optional">
          <FileUpload
            onUploadComplete={setPhotos}
            maxFiles={5}
            maxSizeMB={5}
            accept="image/*"
            multiple={true}
          />
        </Field>
      </form>
    </Modal>
  );
}

function TicketDetailsDrawer({
  ticket,
  onClose,
  onResolve,
  resolving,
}: {
  ticket: MaintenanceTicket | null;
  onClose: () => void;
  onResolve: (id: string) => void;
  resolving: boolean;
}) {
  return (
    <DetailDrawer
      open={!!ticket}
      onClose={onClose}
      title={ticket?.title ?? 'Ticket'}
      headerExtra={
        ticket ? (
          <div className="row">
            <StatusBadge status={ticket.priority} tone={PRIORITY_TONE[ticket.priority]} />
            <StatusBadge status={ticket.status} />
          </div>
        ) : undefined
      }
      footer={
        ticket && ticket.status !== 'resolved' && ticket.status !== 'closed' ? (
          <Button
            variant="primary"
            block
            icon={<CheckCircle size={15} />}
            loading={resolving}
            onClick={() => onResolve(ticket.id)}
          >
            Resolve ticket
          </Button>
        ) : undefined
      }
    >
      {ticket && (
        <div className="stack-lg">
          <div>
            <div className="text-xs muted" style={{ marginBottom: 'var(--space-1)' }}>
              Description
            </div>
            <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>{ticket.description}</div>
          </div>

          <div className={styles.kvGrid}>
            {ticket.room && <KV k="Room" v={ticket.room.roomNumber} />}
            <KV k="Reported by" v={`${ticket.reporter.firstName} ${ticket.reporter.lastName}`} />
            {ticket.assignedStaff && (
              <KV
                k="Assigned to"
                v={`${ticket.assignedStaff.firstName} ${ticket.assignedStaff.lastName}`}
              />
            )}
            <KV k="Created" v={format(new Date(ticket.createdAt), 'MMM dd, yyyy HH:mm')} />
            {ticket.resolvedAt && (
              <KV k="Resolved" v={format(new Date(ticket.resolvedAt), 'MMM dd, yyyy HH:mm')} />
            )}
          </div>

          {ticket.photos && ticket.photos.length > 0 && (
            <div>
              <div className="text-xs muted" style={{ marginBottom: 'var(--space-2)' }}>
                Photos
              </div>
              <div className={styles.photoGrid}>
                {ticket.photos.map((photo, index) => (
                  <img key={index} src={photo} alt={`Ticket photo ${index + 1}`} />
                ))}
              </div>
            </div>
          )}
        </div>
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
