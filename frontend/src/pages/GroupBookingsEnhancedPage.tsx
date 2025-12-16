import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import {
  Plus,
  Search,
  Filter,
  Users,
  Calendar,
  DollarSign,
  Building,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2,
  MapPin,
  Phone,
  Mail,
  User,
  Bed
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupBooking {
  id: string;
  groupBookingNumber: string;
  groupName: string;
  groupType: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  expectedGuests: number;
  confirmedGuests: number;
  checkInDate: string;
  checkOutDate: string;
  totalRooms: number;
  totalRevenue: number;
  depositAmount?: number;
  depositPaid: boolean;
  status: string;
  bookingProgress: string;
  specialRequests?: string;
  dietaryRequirements?: string;
  setupRequirements?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  roomBlocks?: RoomBlock[];
  reservations?: any[];
}

interface RoomBlock {
  id: string;
  roomCategoryId: string;
  roomType: string;
  totalRooms: number;
  allocatedRooms: number;
  availableRooms: number;
  negotiatedRate?: number;
  discountPercent?: number;
  checkInDate: string;
  checkOutDate: string;
}

interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  totalRooms: number;
  upcomingBookings: number;
}

export default function GroupBookingsEnhancedPage() {
  const { user } = useAuthStore();
  const [bookings, setBookings] = useState<GroupBooking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<GroupBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadBookings();
    loadStats();
  }, [user?.tenantId, statusFilter]);

  const loadBookings = async () => {
    if (!user?.tenantId) return;

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await api.get(`/tenants/${user.tenantId}/group-bookings?${params}`);
      setBookings(response.data.data);
    } catch (error) {
      console.error('Error loading group bookings:', error);
      toast.error('Failed to load group bookings');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user?.tenantId) return;

    try {
      const response = await api.get(`/tenants/${user.tenantId}/group-bookings/stats/overview`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading booking stats:', error);
    }
  };

  const filteredBookings = bookings.filter(booking =>
    booking.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.groupBookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'in_progress': return '#3b82f6';
      case 'completed': return '#8b5cf6';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getProgressColor = (progress: string) => {
    switch (progress) {
      case 'initial_contact': return '#ef4444';
      case 'contract_signed': return '#f59e0b';
      case 'deposit_received': return '#3b82f6';
      case 'rooms_allocated': return '#8b5cf6';
      case 'confirmed': return '#10b981';
      default: return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getProgressLabel = (progress: string) => {
    return progress.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Group Bookings Management
        </h1>
        <p style={{ color: '#64748b' }}>
          Manage large group bookings, room blocks, and event coordination
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
              {stats.totalBookings}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Bookings</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
              {stats.confirmedBookings}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Confirmed</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {stats.pendingBookings}
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
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
              {formatCurrency(stats.totalRevenue)}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Revenue</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {stats.totalRooms}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Rooms</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f97316' }}>
              {stats.upcomingBookings}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Upcoming</div>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '250px' }}>
            <Search size={18} style={{ color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search bookings..."
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
              minWidth: '140px'
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={18} style={{ marginRight: '0.5rem' }} />
            New Group Booking
          </Button>
        </div>
      </div>

      {/* Bookings List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          Loading group bookings...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          border: '2px dashed #e2e8f0',
          borderRadius: '8px'
        }}>
          <Users size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            No Group Bookings Found
          </h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            {searchTerm || statusFilter !== 'all'
              ? 'No bookings match your current filters.'
              : 'Start by creating your first group booking for events or large parties.'}
          </p>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus size={18} style={{ marginRight: '0.5rem' }} />
            Create Group Booking
          </Button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {filteredBookings.map((booking) => (
            <div
              key={booking.id}
              style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                setSelectedBooking(booking);
                setShowDetailsModal(true);
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
                      {booking.groupName}
                    </h3>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      background: `${getStatusColor(booking.status)}20`,
                      color: getStatusColor(booking.status)
                    }}>
                      {booking.status.toUpperCase()}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                    <span>#{booking.groupBookingNumber}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users size={14} />
                      {booking.expectedGuests} expected
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Bed size={14} />
                      {booking.totalRooms} rooms
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={14} />
                      {formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>
                    {formatCurrency(booking.totalRevenue)}
                  </div>
                  <div style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: `${getProgressColor(booking.bookingProgress)}20`,
                    color: getProgressColor(booking.bookingProgress)
                  }}>
                    {getProgressLabel(booking.bookingProgress)}
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
                marginBottom: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                  <User size={16} />
                  <span>{booking.contactPerson}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                  <Mail size={16} />
                  <span>{booking.contactEmail}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                  <Phone size={16} />
                  <span>{booking.contactPhone}</span>
                </div>

                {booking.depositAmount && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                    <DollarSign size={16} />
                    <span>
                      Deposit: {formatCurrency(booking.depositAmount)}
                      {booking.depositPaid && (
                        <span style={{ color: '#10b981', marginLeft: '0.5rem' }}>✓ Paid</span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* Room Blocks Summary */}
              {booking.roomBlocks && booking.roomBlocks.length > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderRadius: '6px',
                  fontSize: '0.875rem'
                }}>
                  <Building size={16} style={{ color: '#64748b' }} />
                  <span style={{ color: '#64748b' }}>
                    {booking.roomBlocks.length} room block{booking.roomBlocks.length !== 1 ? 's' : ''}:
                    {booking.roomBlocks.map(block => ` ${block.totalRooms} ${block.roomType}`).join(', ')}
                  </span>
                </div>
              )}

              {/* Special Requirements */}
              {(booking.specialRequests || booking.dietaryRequirements || booking.setupRequirements) && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem',
                  background: '#fef3c7',
                  borderRadius: '6px',
                  border: '1px solid #f59e0b'
                }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e', marginBottom: '0.25rem' }}>
                    Special Requirements
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#92400e' }}>
                    {booking.specialRequests && <div>Requests: {booking.specialRequests}</div>}
                    {booking.dietaryRequirements && <div>Dietary: {booking.dietaryRequirements}</div>}
                    {booking.setupRequirements && <div>Setup: {booking.setupRequirements}</div>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Details Modal Placeholder */}
      {showDetailsModal && selectedBooking && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                {selectedBooking.groupName} Details
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Detailed booking management interface will be implemented here
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
