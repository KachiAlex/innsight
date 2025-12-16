import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import {
  Search,
  MessageSquare,
  Clock,
  AlertTriangle,
  MoreVertical,
  User,
  Calendar,
  Hash
} from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function GuestRequestsPage() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<GuestRequest[]>([]);
  const [stats, setStats] = useState<RequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

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
    } catch (error) {
      console.error('Error loading guest requests:', error);
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

  const filteredRequests = requests.filter(request =>
    request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.guestName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.roomNumber?.includes(searchTerm)
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'assigned': return '#3b82f6';
      case 'in_progress': return '#8b5cf6';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#ef4444';
      case 'high': return '#f97316';
      case 'normal': return '#eab308';
      case 'low': return '#6b7280';
      default: return '#6b7280';
    }
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isOverdue = (request: GuestRequest) => {
    if (!request.estimatedCompletion || request.status === 'completed') return false;
    return new Date(request.estimatedCompletion) < new Date();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Guest Requests
        </h1>
        <p style={{ color: '#64748b' }}>
          Manage and respond to guest service requests
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
              {stats.total}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Requests</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {stats.pending}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Pending</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {stats.inProgress}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>In Progress</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
              {stats.completed}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Completed</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ef4444' }}>
              {stats.urgent}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Urgent</div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
            <Search size={18} style={{ color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              minWidth: '120px'
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              minWidth: '120px'
            }}
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              minWidth: '140px'
            }}
          >
            <option value="all">All Types</option>
            <option value="amenities">Amenities</option>
            <option value="maintenance">Maintenance</option>
            <option value="housekeeping">Housekeeping</option>
            <option value="concierge">Concierge</option>
            <option value="other">Other</option>
          </select>

          <Button onClick={() => {
            setSearchTerm('');
            setStatusFilter('all');
            setPriorityFilter('all');
            setTypeFilter('all');
          }}>
            Clear Filters
          </Button>
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          Loading guest requests...
        </div>
      ) : filteredRequests.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          border: '2px dashed #e2e8f0',
          borderRadius: '8px'
        }}>
          <MessageSquare size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            No Guest Requests Found
          </h3>
          <p style={{ color: '#64748b' }}>
            {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all' || typeFilter !== 'all'
              ? 'No requests match your current filters.'
              : 'No guest requests have been submitted yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.5rem',
                position: 'relative'
              }}
            >
              {/* Priority Indicator */}
              {request.priority === 'urgent' && (
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: '#ef4444',
                  color: 'white',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}>
                  <AlertTriangle size={12} />
                  URGENT
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    fontSize: '1.5rem',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f3f4f6',
                    borderRadius: '8px'
                  }}>
                    {getTypeIcon(request.requestType)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {request.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Hash size={14} />
                        {request.id.slice(-8)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={14} />
                        {formatDate(request.createdAt)}
                      </span>
                      {request.roomNumber && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <User size={14} />
                          Room {request.roomNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    background: `${getPriorityColor(request.priority)}20`,
                    color: getPriorityColor(request.priority)
                  }}>
                    {request.priority.toUpperCase()}
                  </span>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    background: `${getStatusColor(request.status)}20`,
                    color: getStatusColor(request.status)
                  }}>
                    {request.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <p style={{
                color: '#64748b',
                marginBottom: '1rem',
                lineHeight: '1.5',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {request.description}
              </p>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                  {request.guestName && (
                    <span>Guest: {request.guestName}</span>
                  )}
                  {request.assignedTo && (
                    <span>Assigned: {request.assignedTo}</span>
                  )}
                  {request.estimatedCompletion && (
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      color: isOverdue(request) ? '#ef4444' : '#64748b'
                    }}>
                      <Clock size={14} />
                      Due: {formatDate(request.estimatedCompletion)}
                      {isOverdue(request) && ' (Overdue)'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="ghost" size="sm">
                    <MessageSquare size={16} />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical size={16} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
