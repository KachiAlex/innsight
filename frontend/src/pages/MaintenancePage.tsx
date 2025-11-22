import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Wrench, Plus, X, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import FileUpload from '../components/FileUpload';

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

export default function MaintenancePage() {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<MaintenanceTicket | null>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchTickets();
  }, [user, filters]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.priority) params.priority = filters.priority;

      const response = await api.get(`/tenants/${user?.tenantId}/maintenance`, { params });
      setTickets(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (ticketId: string) => {
    try {
      await api.patch(`/tenants/${user?.tenantId}/maintenance/${ticketId}`, {
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
      });
      toast.success('Ticket resolved successfully');
      fetchTickets();
    } catch (error: any) {
      // Error handled by API interceptor
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      urgent: { bg: '#fee2e2', text: '#991b1b' },
      high: { bg: '#fef3c7', text: '#92400e' },
      medium: { bg: '#dbeafe', text: '#1e40af' },
      low: { bg: '#d1fae5', text: '#065f46' },
    };
    return colors[priority] || colors.medium;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      open: { bg: '#fee2e2', text: '#991b1b' },
      assigned: { bg: '#fef3c7', text: '#92400e' },
      in_progress: { bg: '#dbeafe', text: '#1e40af' },
      resolved: { bg: '#d1fae5', text: '#065f46' },
      closed: { bg: '#e5e7eb', text: '#374151' },
    };
    return colors[status] || colors.open;
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Maintenance</h1>
          <CardSkeleton count={6} />
        </div>
      </Layout>
    );
  }

  const openTickets = tickets.filter((t) => t.status !== 'resolved' && t.status !== 'closed').length;
  const urgentTickets = tickets.filter((t) => t.priority === 'urgent' && t.status !== 'resolved').length;

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#1e293b' }}>Maintenance</h1>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              <span>{tickets.length} total tickets</span>
              {openTickets > 0 && (
                <span style={{ color: '#ef4444', fontWeight: '500' }}>{openTickets} open</span>
              )}
              {urgentTickets > 0 && (
                <span style={{ color: '#991b1b', fontWeight: '500' }}>{urgentTickets} urgent</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Plus size={20} />
            Create Ticket
          </button>
        </div>

        {/* Filters */}
        <div
          style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              style={{
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">All</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
              Priority
            </label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              style={{
                padding: '0.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '0.875rem',
              }}
            >
              <option value="">All</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={() => setFilters({ status: '', priority: '' })}
              style={{
                padding: '0.5rem 1rem',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Tickets Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {tickets.map((ticket) => {
            const priorityColor = getPriorityColor(ticket.priority);
            const statusColor = getStatusColor(ticket.status);
            return (
              <div
                key={ticket.id}
                style={{
                  background: 'white',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: `4px solid ${priorityColor.text}`,
                  cursor: 'pointer',
                }}
                onClick={() => setSelectedTicket(ticket)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#1e293b', marginBottom: '0.5rem' }}>{ticket.title}</h3>
                    {ticket.room && (
                      <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Room {ticket.room.roomNumber}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: priorityColor.bg,
                        color: priorityColor.text,
                      }}
                    >
                      {ticket.priority.toUpperCase()}
                    </span>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: statusColor.bg,
                        color: statusColor.text,
                      }}
                    >
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>

                <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem', lineHeight: '1.5' }}>
                  {ticket.description.length > 100 ? `${ticket.description.substring(0, 100)}...` : ticket.description}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: '#94a3b8' }}>
                  <div>
                    Reported by {ticket.reporter.firstName} {ticket.reporter.lastName}
                  </div>
                  <div>{format(new Date(ticket.createdAt), 'MMM dd, yyyy')}</div>
                </div>

                {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResolve(ticket.id);
                    }}
                    style={{
                      marginTop: '1rem',
                      width: '100%',
                      padding: '0.75rem',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <CheckCircle size={18} />
                    Resolve
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {tickets.length === 0 && (
          <div
            style={{
              background: 'white',
              padding: '3rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            <Wrench size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No maintenance tickets found</p>
          </div>
        )}

        {showCreateModal && (
          <CreateTicketModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchTickets();
            }}
          />
        )}

        {selectedTicket && (
          <TicketDetailsModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </div>
    </Layout>
  );
}

function CreateTicketModal({
  onClose,
  onSuccess,
}: {
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const handleUploadComplete = (urls: string[]) => {
    setPhotos(urls);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b' }}>Create Maintenance Ticket</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Room (Optional)
              </label>
              <select
                value={formData.roomId}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="">Select a room (optional)</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} - {room.roomType}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
                placeholder="Brief description of the issue"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  resize: 'vertical',
                }}
                placeholder="Detailed description of the maintenance issue"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Priority *
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Photos (Optional)
              </label>
              <FileUpload
                onUploadComplete={handleUploadComplete}
                maxFiles={5}
                maxSizeMB={5}
                accept="image/*"
                multiple={true}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {loading ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function TicketDetailsModal({
  ticket,
  onClose,
}: {
  ticket: MaintenanceTicket;
  onClose: () => void;
}) {
  const priorityColor = getPriorityColor(ticket.priority);
  const statusColor = getStatusColor(ticket.status);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b' }}>{ticket.title}</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '500',
              background: priorityColor.bg,
              color: priorityColor.text,
            }}
          >
            {ticket.priority.toUpperCase()}
          </span>
          <span
            style={{
              padding: '0.25rem 0.75rem',
              borderRadius: '12px',
              fontSize: '0.75rem',
              fontWeight: '500',
              background: statusColor.bg,
              color: statusColor.text,
            }}
          >
            {ticket.status.replace('_', ' ').toUpperCase()}
          </span>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Description</div>
          <div style={{ color: '#1e293b', lineHeight: '1.6' }}>{ticket.description}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {ticket.room && (
            <div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Room</div>
              <div style={{ fontWeight: '500', color: '#1e293b' }}>{ticket.room.roomNumber}</div>
            </div>
          )}
          <div>
            <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Reported By</div>
            <div style={{ fontWeight: '500', color: '#1e293b' }}>
              {ticket.reporter.firstName} {ticket.reporter.lastName}
            </div>
          </div>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Created</div>
            <div style={{ fontWeight: '500', color: '#1e293b' }}>
              {format(new Date(ticket.createdAt), 'MMM dd, yyyy HH:mm')}
            </div>
          </div>
          {ticket.resolvedAt && (
            <div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Resolved</div>
              <div style={{ fontWeight: '500', color: '#1e293b' }}>
                {format(new Date(ticket.resolvedAt), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
          )}
        </div>

        {ticket.photos && ticket.photos.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Photos</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '0.5rem' }}>
              {ticket.photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`Photo ${index + 1}`}
                  style={{
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '4px',
                    border: '1px solid #e2e8f0',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: '#f1f5f9',
            color: '#475569',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}

function getPriorityColor(priority: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    urgent: { bg: '#fee2e2', text: '#991b1b' },
    high: { bg: '#fef3c7', text: '#92400e' },
    medium: { bg: '#dbeafe', text: '#1e40af' },
    low: { bg: '#d1fae5', text: '#065f46' },
  };
  return colors[priority] || colors.medium;
}

function getStatusColor(status: string) {
  const colors: Record<string, { bg: string; text: string }> = {
    open: { bg: '#fee2e2', text: '#991b1b' },
    assigned: { bg: '#fef3c7', text: '#92400e' },
    in_progress: { bg: '#dbeafe', text: '#1e40af' },
    resolved: { bg: '#d1fae5', text: '#065f46' },
    closed: { bg: '#e5e7eb', text: '#374151' },
  };
  return colors[status] || colors.open;
}

