import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';
import { format } from 'date-fns';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';

interface GroupBooking {
  id: string;
  groupBookingNumber: string;
  groupName?: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  totalRooms: number;
  totalRate: number;
  status: 'confirmed' | 'partially_checked_in' | 'checked_in' | 'partially_checked_out' | 'checked_out' | 'cancelled';
  reservations: Array<{
    id: string;
    reservationNumber: string;
    roomNumber?: string;
    status: string;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}

// Helper functions
const getStatusLabel = (status: string) => {
  return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return { bg: '#dbeafe', text: '#1e40af', icon: Clock };
    case 'partially_checked_in':
      return { bg: '#fef3c7', text: '#92400e', icon: Clock };
    case 'checked_in':
      return { bg: '#d1fae5', text: '#065f46', icon: CheckCircle };
    case 'partially_checked_out':
      return { bg: '#fef3c7', text: '#92400e', icon: Clock };
    case 'checked_out':
      return { bg: '#e0e7ff', text: '#3730a3', icon: CheckCircle };
    case 'cancelled':
      return { bg: '#fee2e2', text: '#991b1b', icon: XCircle };
    default:
      return { bg: '#f3f4f6', text: '#6b7280', icon: Clock };
  }
};

const getRoomEffectiveRate = (room: any): number | null => {
  if (!room) return null;
  if (room.effectiveRate !== undefined && room.effectiveRate !== null) {
    return Number(room.effectiveRate);
  }
  if (room.customRate !== undefined && room.customRate !== null) {
    return Number(room.customRate);
  }
  if (room.ratePlan?.baseRate !== undefined && room.ratePlan?.baseRate !== null) {
    return Number(room.ratePlan.baseRate);
  }
  return null;
};

type HallReservationForm = {
  id: string;
  hallId: string;
  eventName: string;
  purpose: string;
  setupType: string;
  attendeeCount: string;
  startDateTime: string;
  endDateTime: string;
  cateringNotes: string;
  avRequirements: string;
  rate: string;
};

export default function GroupBookingsPage() {
  const { user } = useAuthStore();
  const [groupBookings, setGroupBookings] = useState<GroupBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<GroupBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());

  const fetchGroupBookings = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const response = await api.get(`/tenants/${user.tenantId}/group-bookings`, { params });
      setGroupBookings(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch group bookings:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to fetch group bookings');
      setGroupBookings([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, statusFilter]);

  useEffect(() => {
    fetchGroupBookings();
  }, [fetchGroupBookings]);

  // Handle highlight from URL (e.g., from calendar navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlightId = params.get('highlight');
    if (highlightId && groupBookings.length > 0) {
      const booking = groupBookings.find(b => b.id === highlightId);
      if (booking) {
        // Fetch and show details
        (async () => {
          try {
            const response = await api.get(`/tenants/${user?.tenantId}/group-bookings/${booking.id}`);
            setSelectedBooking(response.data.data);
            setShowDetailsModal(true);
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
          } catch (error: any) {
            console.error('Failed to fetch group booking details:', error);
          }
        })();
      }
    }
  }, [groupBookings, user?.tenantId]);

  const handleCheckIn = async (bookingId: string) => {
    setProcessingActions(prev => new Set(prev).add(bookingId));
    try {
      const response = await api.post(`/tenants/${user?.tenantId}/group-bookings/${bookingId}/checkin`);
      toast.success(response.data.message);
      fetchGroupBookings();
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
        setShowDetailsModal(false);
      }
    } catch (error: any) {
      console.error('Failed to check in group booking:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to check in group booking');
    } finally {
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const handleCheckOut = async (bookingId: string) => {
    setProcessingActions(prev => new Set(prev).add(bookingId));
    try {
      const response = await api.post(`/tenants/${user?.tenantId}/group-bookings/${bookingId}/checkout`);
      toast.success(response.data.message);
      fetchGroupBookings();
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
        setShowDetailsModal(false);
      }
    } catch (error: any) {
      console.error('Failed to check out group booking:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to check out group booking');
    } finally {
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this group booking? This will cancel all reservations in the group.')) {
      return;
    }

    setProcessingActions(prev => new Set(prev).add(bookingId));
    try {
      await api.post(`/tenants/${user?.tenantId}/group-bookings/${bookingId}/cancel`);
      toast.success('Group booking cancelled successfully');
      fetchGroupBookings();
      if (selectedBooking?.id === bookingId) {
        setSelectedBooking(null);
        setShowDetailsModal(false);
      }
    } catch (error: any) {
      console.error('Failed to cancel group booking:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to cancel group booking');
    } finally {
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const handleViewDetails = async (bookingId: string) => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/group-bookings/${bookingId}`);
      setSelectedBooking(response.data.data);
      setShowDetailsModal(true);
    } catch (error: any) {
      console.error('Failed to fetch group booking details:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch group booking details');
    }
  };


  const filteredBookings = useMemo(() => groupBookings.filter((booking) => {
    if (!debouncedSearchTerm) return true;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return (
      booking.groupBookingNumber.toLowerCase().includes(searchLower) ||
      booking.guestName.toLowerCase().includes(searchLower) ||
      booking.guestEmail?.toLowerCase().includes(searchLower) ||
      booking.guestPhone?.toLowerCase().includes(searchLower) ||
      booking.groupName?.toLowerCase().includes(searchLower)
    );
  }), [groupBookings, debouncedSearchTerm]);

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem' }}>
          <DashboardSkeleton />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={28} />
            Group Bookings
          </h1>
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
            Create Group Booking
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <SearchInput
              placeholder="Search by booking number, guest name, email, or phone..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatusFilter(null)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: statusFilter === null ? '#3b82f6' : 'white',
                color: statusFilter === null ? 'white' : '#64748b',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            {['confirmed', 'checked_in', 'checked_out', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(statusFilter === status ? null : status)}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: statusFilter === status ? '#3b82f6' : 'white',
                  color: statusFilter === status ? 'white' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>

        {!loading && filteredBookings.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchTerm || statusFilter ? 'No group bookings match your filters' : 'No group bookings yet'}
            description={searchTerm || statusFilter
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first group booking to get started'}
            action={searchTerm || statusFilter ? undefined : {
              label: 'Create Group Booking',
              onClick: () => setShowCreateModal(true),
            }}
          />
        ) : filteredBookings.length > 0 ? (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredBookings.map((booking: GroupBooking) => {
              const statusStyle = getStatusColor(booking.status);
              const StatusIcon = statusStyle.icon;

              return (
                <div
                  key={booking.id}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleViewDetails(booking.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1e293b' }}>
                          {booking.groupName || booking.guestName}
                        </h3>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            background: statusStyle.bg,
                            color: statusStyle.text,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                          }}
                        >
                          <StatusIcon size={12} />
                          {getStatusLabel(booking.status)}
                        </span>
                      </div>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
                        {booking.groupBookingNumber}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                        ₦{booking.totalRate.toLocaleString()}
                      </p>
                      <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                        {booking.totalRooms} room{booking.totalRooms !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Guest</p>
                      <p style={{ margin: '0.25rem 0 0', fontWeight: '500', color: '#1e293b' }}>{booking.guestName}</p>
                      {booking.guestEmail && (
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>{booking.guestEmail}</p>
                      )}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Check-In</p>
                      <p style={{ margin: '0.25rem 0 0', fontWeight: '500', color: '#1e293b' }}>
                        {format(new Date(booking.checkInDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Check-Out</p>
                      <p style={{ margin: '0.25rem 0 0', fontWeight: '500', color: '#1e293b' }}>
                        {format(new Date(booking.checkOutDate), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Guests</p>
                      <p style={{ margin: '0.25rem 0 0', fontWeight: '500', color: '#1e293b' }}>
                        {booking.adults} Adult{booking.adults !== 1 ? 's' : ''}
                        {booking.children > 0 && `, ${booking.children} Child${booking.children !== 1 ? 'ren' : ''}`}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    {booking.reservations.slice(0, 5).map((res: { id: string; reservationNumber: string; roomNumber?: string; status: string }) => (
                      <span
                        key={res.id}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#f1f5f9',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          color: '#475569',
                        }}
                      >
                        {res.roomNumber || res.reservationNumber}
                      </span>
                    ))}
                    {booking.reservations.length > 5 && (
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: '#f1f5f9',
                          borderRadius: '4px',
                          fontSize: '0.875rem',
                          color: '#475569',
                        }}
                      >
                        +{booking.reservations.length - 5} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {/* Details Modal */}
        {showDetailsModal && selectedBooking && (
          <GroupBookingDetailsModal
            booking={selectedBooking}
            onClose={() => {
              setShowDetailsModal(false);
              setSelectedBooking(null);
            }}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            onCancel={handleCancel}
            tenantId={user?.tenantId || ''}
            isProcessing={processingActions.has(selectedBooking.id)}
          />
        )}

        {/* Create Modal - Will be implemented next */}
        {showCreateModal && (
          <CreateGroupBookingModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchGroupBookings();
            }}
            tenantId={user?.tenantId || ''}
          />
        )}
      </div>
    </Layout>
  );
}

// Details Modal Component
function GroupBookingDetailsModal({
  booking,
  onClose,
  onCheckIn,
  onCheckOut,
  onCancel,
  tenantId,
  isProcessing = false,
}: {
  booking: GroupBooking;
  onClose: () => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onCancel: (id: string) => void;
  tenantId: string;
  isProcessing?: boolean;
}) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDetails();
  }, [booking.id, tenantId]);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tenants/${tenantId}/group-bookings/${booking.id}`);
      setDetails(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch details:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch details');
    } finally {
      setLoading(false);
    }
  };

  const statusStyle = getStatusColor(booking.status);
  const StatusIcon = statusStyle.icon;

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
          width: '90%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#1e293b' }}>
            Group Booking Details
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <XCircle size={24} color="#64748b" />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : details ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Booking Number</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: '600', color: '#1e293b' }}>{details.groupBookingNumber}</p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Status</p>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    marginTop: '0.25rem',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    background: statusStyle.bg,
                    color: statusStyle.text,
                  }}
                >
                  <StatusIcon size={14} />
                  {getStatusLabel(details.status)}
                </span>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Total Rate</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: '600', color: '#1e293b', fontSize: '1.25rem' }}>
                  ₦{details.totalRate?.toLocaleString() || 0}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Total Rooms</p>
                <p style={{ margin: '0.25rem 0 0', fontWeight: '600', color: '#1e293b' }}>{details.totalRooms}</p>
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>Guest Information</h3>
              <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: '500', color: '#1e293b' }}>{details.guestName}</p>
                {details.guestEmail && <p style={{ margin: '0 0 0.25rem', color: '#64748b' }}>Email: {details.guestEmail}</p>}
                {details.guestPhone && <p style={{ margin: 0, color: '#64748b' }}>Phone: {details.guestPhone}</p>}
              </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>Reservations</h3>
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                {details.reservations?.map((res: any) => (
                  <div
                    key={res.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '1rem',
                      background: '#f8f9fa',
                      borderRadius: '6px',
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontWeight: '500', color: '#1e293b' }}>
                        {res.room?.roomNumber || 'Room N/A'}
                      </p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                        {res.reservationNumber}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontWeight: '600', color: '#1e293b' }}>₦{res.rate?.toLocaleString() || 0}</p>
                      <span
                        style={{
                          display: 'inline-block',
                          marginTop: '0.25rem',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          background: res.status === 'checked_in' ? '#d1fae5' : res.status === 'checked_out' ? '#e0e7ff' : '#dbeafe',
                          color: res.status === 'checked_in' ? '#065f46' : res.status === 'checked_out' ? '#3730a3' : '#1e40af',
                        }}
                      >
                        {res.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0' }}>
              {details.status === 'confirmed' || details.status === 'partially_checked_in' ? (
                <button
                  onClick={() => onCheckIn(details.id)}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Check In All Rooms'}
                </button>
              ) : null}
              {details.status === 'checked_in' || details.status === 'partially_checked_out' ? (
                <button
                  onClick={() => onCheckOut(details.id)}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Check Out All Rooms'}
                </button>
              ) : null}
              {details.status !== 'cancelled' && details.status !== 'checked_out' ? (
                <button
                  onClick={() => onCancel(details.id)}
                  disabled={isProcessing}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#ef4444',
                    border: '1px solid #fee2e2',
                    borderRadius: '6px',
                    cursor: isProcessing ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: isProcessing ? 0.6 : 1,
                  }}
                >
                  {isProcessing ? 'Processing...' : 'Cancel'}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}


// Create Group Booking Modal
function CreateGroupBookingModal({
  onClose,
  onSuccess,
  tenantId,
}: {
  onClose: () => void;
  onSuccess: () => void;
  tenantId: string;
}) {
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [meetingHalls, setMeetingHalls] = useState<any[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [roomRates, setRoomRates] = useState<Record<string, number>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [roomSearch, setRoomSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bulkSelectionInput, setBulkSelectionInput] = useState('');
  const [bulkSelectionError, setBulkSelectionError] = useState<string | null>(null);
  const [unavailableRooms, setUnavailableRooms] = useState<Set<string>>(new Set());
  const [hallReservations, setHallReservations] = useState<HallReservationForm[]>([]);
  const [includeHall, setIncludeHall] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const steps = ['Guest Details', 'Stay Details', 'Rooms', 'Hall Booking', 'Invoice'];
  const [formData, setFormData] = useState({
    groupName: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestAddress: '',
    guestIdNumber: '',
    checkInDate: '',
    checkOutDate: '',
    adults: 1,
    children: 0,
    specialRequests: '',
  });

  const generateTempId = () => Math.random().toString(36).substring(2, 9);

  useEffect(() => {
    if (!tenantId) return;
    fetchCategories();
    fetchMeetingHalls();
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    if (!formData.checkInDate || !formData.checkOutDate) {
      setAvailableRooms([]);
      setSelectedRooms(new Set());
      setRoomRates({});
      setAvailabilityError(null);
      return;
    }
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      setAvailabilityError('Select a valid check-in and check-out date');
      return;
    }
    if (checkOut <= checkIn) {
      setAvailabilityError('Check-out must be after check-in');
      return;
    }
    fetchAvailability(checkIn, checkOut);
  }, [formData.checkInDate, formData.checkOutDate, formData.adults, formData.children, tenantId]);

  useEffect(() => {
    if (includeHall && hallReservations.length === 0 && meetingHalls.length > 0) {
      setHallReservations([
        {
          id: generateTempId(),
          hallId: meetingHalls[0]?.id || '',
          eventName: '',
          purpose: '',
          setupType: '',
          attendeeCount: '',
          startDateTime: '',
          endDateTime: '',
          cateringNotes: '',
          avRequirements: '',
          rate: '',
        },
      ]);
    }
    if (!includeHall) {
      setHallReservations([]);
    }
  }, [includeHall, meetingHalls]);

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/tenants/${tenantId}/room-categories`);
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      toast.error('Unable to load room categories');
    }
  };

  const fetchMeetingHalls = async () => {
    try {
      const response = await api.get(`/tenants/${tenantId}/group-bookings/meeting-halls`);
      setMeetingHalls(response.data.data || []);
    } catch (error) {
      console.error('Failed to load meeting halls:', error);
      toast.error('Unable to load meeting halls');
    }
  };

  const fetchAvailability = async (checkIn: Date, checkOut: Date) => {
    setCheckingAvailability(true);
    setAvailabilityError(null);
    setBulkSelectionError(null);
    setUnavailableRooms(new Set());

    try {
      const response = await api.get(`/tenants/${tenantId}/reservations/availability`, {
        params: {
          startDate: checkIn.toISOString(),
          endDate: checkOut.toISOString(),
          minOccupancy: Math.max(1, (formData.adults || 0) + (formData.children || 0)),
        },
      });
      const rooms = response.data.data?.availableRooms || [];
      setAvailableRooms(rooms);
      setSelectedRooms((prev) => {
        const next = new Set(prev);
        const validIds = new Set(rooms.map((room: any) => room.id));
        Array.from(next).forEach((roomId) => {
          if (!validIds.has(roomId)) {
            next.delete(roomId);
          }
        });
        return next;
      });
      setRoomRates((prev) => {
        const updated: Record<string, number> = {};
        rooms.forEach((room: any) => {
          const effectiveRate = getRoomEffectiveRate(room);
          if (effectiveRate !== null) {
            updated[room.id] = prev[room.id] ?? effectiveRate;
          }
        });
        return updated;
      });
    } catch (error) {
      console.error('Failed to load availability:', error);
      setAvailabilityError('Unable to load availability for the selected dates');
      setAvailableRooms([]);
      setSelectedRooms(new Set());
    } finally {
      setCheckingAvailability(false);
    }
  };

  const parseBulkSelection = (input: string): string[] => {
    const roomNumbers: string[] = [];
    const parts = input.split(',').map((part) => part.trim()).filter(Boolean);
    parts.forEach((part) => {
      if (part.includes('-')) {
        const [startRaw, endRaw] = part.split('-');
        const start = parseInt(startRaw.trim(), 10);
        const end = parseInt(endRaw.trim(), 10);
        if (Number.isNaN(start) || Number.isNaN(end)) {
          throw new Error(`Invalid range "${part}"`);
        }
        if (start > end) {
          throw new Error(`Range start (${start}) must be <= end (${end})`);
        }
        for (let i = start; i <= end; i += 1) {
          roomNumbers.push(String(i));
        }
      } else {
        const num = parseInt(part, 10);
        if (Number.isNaN(num)) {
          throw new Error(`Invalid room number "${part}"`);
        }
        roomNumbers.push(String(num));
      }
    });
    return roomNumbers;
  };

  const handleBulkSelection = () => {
    if (!bulkSelectionInput.trim()) {
      setBulkSelectionError('Enter room numbers to add');
      return;
    }
    try {
      const numbers = parseBulkSelection(bulkSelectionInput);
      const nextSelected = new Set(selectedRooms);
      const notFound = new Set<string>();
      numbers.forEach((roomNumber) => {
        const match = availableRooms.find(
          (room: any) => (room.roomNumber || '').toString() === roomNumber.toString()
        );
        if (match) {
          nextSelected.add(match.id);
        } else {
          notFound.add(roomNumber);
        }
      });
      setSelectedRooms(nextSelected);
      setUnavailableRooms(notFound);
      if (notFound.size > 0) {
        setBulkSelectionError(`Rooms unavailable: ${Array.from(notFound).join(', ')}`);
      } else {
        setBulkSelectionError(null);
        setBulkSelectionInput('');
        toast.success(`Added ${numbers.length} room${numbers.length === 1 ? '' : 's'}`);
      }
    } catch (error: any) {
      setBulkSelectionError(error.message || 'Invalid format');
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  const handleCategorySelectAll = (rooms: any[]) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      rooms.forEach((room) => next.add(room.id));
      return next;
    });
  };

  const handleCategoryClear = (rooms: any[]) => {
    setSelectedRooms((prev) => {
      const next = new Set(prev);
      rooms.forEach((room) => next.delete(room.id));
      return next;
    });
  };

  const filteredRooms = availableRooms.filter((room) => {
    const matchesCategory =
      categoryFilter === 'all'
        ? true
        : categoryFilter === 'none'
          ? !room.categoryId
          : room.categoryId === categoryFilter;
    if (!matchesCategory) return false;
    if (!roomSearch.trim()) return true;
    const query = roomSearch.toLowerCase();
    return (
      (room.roomNumber || '').toLowerCase().includes(query) ||
      (room.roomType || '').toLowerCase().includes(query) ||
      (room.category?.name || '').toLowerCase().includes(query)
    );
  });

  const roomsByCategory = Object.values(
    filteredRooms.reduce<Record<string, { id: string; name: string; rooms: any[] }>>((acc, room) => {
      const key = room.category?.id || 'uncategorized';
      if (!acc[key]) {
        acc[key] = {
          id: key,
          name: room.category?.name || 'Uncategorized',
          rooms: [],
        };
      }
      acc[key].rooms.push(room);
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const hallTotal = hallReservations.reduce((sum, hall) => sum + (Number(hall.rate) || 0), 0);
  const nights = (() => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    const start = new Date(formData.checkInDate);
    const end = new Date(formData.checkOutDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  })();

  const nightMultiplier = Math.max(nights, 1);
  const roomSubtotal = Array.from(selectedRooms).reduce(
    (sum, roomId) => sum + (roomRates[roomId] || 0) * nightMultiplier,
    0
  );
  const invoiceTotal = roomSubtotal + hallTotal;

  const validateHallReservations = () => {
    if (!includeHall) return true;
    if (hallReservations.length === 0) return false;
    return hallReservations.every((reservation) => {
      if (!reservation.hallId || !reservation.startDateTime || !reservation.endDateTime) return false;
      const start = new Date(reservation.startDateTime);
      const end = new Date(reservation.endDateTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return false;
      return Number(reservation.rate) > 0;
    });
  };

  const validateStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return (
          formData.guestName.trim().length > 1 &&
          formData.guestEmail.trim().length > 3 &&
          formData.guestPhone.trim().length > 3 &&
          formData.guestAddress.trim().length > 3
        );
      case 1: {
        if (!formData.checkInDate || !formData.checkOutDate) return false;
        const start = new Date(formData.checkInDate);
        const end = new Date(formData.checkOutDate);
        return end > start && !availabilityError && availableRooms.length >= 0;
      }
      case 2:
        return selectedRooms.size > 0;
      case 3:
        return validateHallReservations();
      case 4:
        return selectedRooms.size > 0 && (!includeHall || validateHallReservations());
      default:
        return true;
    }
  };

  const canProceed = validateStep(currentStep);

  const goToNextStep = () => {
    if (!canProceed) {
      toast.error('Please complete the required fields before continuing');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleHallChange = (index: number, field: keyof HallReservationForm, value: string) => {
    setHallReservations((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addHallReservation = () => {
    setHallReservations((prev) => [
      ...prev,
      {
        id: generateTempId(),
        hallId: meetingHalls[0]?.id || '',
        eventName: '',
        purpose: '',
        setupType: '',
        attendeeCount: '',
        startDateTime: '',
        endDateTime: '',
        cateringNotes: '',
        avRequirements: '',
        rate: '',
      },
    ]);
  };

  const removeHallReservation = (id: string) => {
    setHallReservations((prev) => prev.filter((reservation) => reservation.id !== id));
  };

  const selectedRoomDetails = Array.from(selectedRooms)
    .map((roomId) => availableRooms.find((room) => room.id === roomId))
    .filter(Boolean);

  const formatCurrency = (value: number) => `₦${Number(value).toLocaleString()}`;

  const handleSubmit = async () => {
    if (!validateStep(steps.length - 1)) {
      toast.error('Please complete required details before submitting');
      return;
    }
    if (!tenantId) {
      toast.error('Tenant not found');
      return;
    }
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
      toast.error('Select valid dates');
      return;
    }
    const roomIdArray = Array.from(selectedRooms);
    if (roomIdArray.length === 0) {
      toast.error('Select at least one room');
      return;
    }
    setSubmitting(true);
    try {
      const rates: Record<string, number> = {};
      roomIdArray.forEach((roomId) => {
        rates[roomId] = roomRates[roomId] || 0;
      });
      const hallNotes =
        includeHall && hallReservations.length > 0
          ? hallReservations
              .map((reservation, index) => {
                const hallName = meetingHalls.find((hall) => hall.id === reservation.hallId)?.name || 'Hall';
                return `Hall ${index + 1}: ${hallName} (${reservation.startDateTime} - ${
                  reservation.endDateTime
                }) • ${formatCurrency(Number(reservation.rate) || 0)}`;
              })
              .join('\n')
          : '';
      const addressNote = formData.guestAddress ? `Guest address: ${formData.guestAddress.trim()}` : '';
      const combinedRequests = [addressNote, hallNotes, formData.specialRequests.trim()]
        .filter(Boolean)
        .join('\n\n');

      await api.post(`/tenants/${tenantId}/group-bookings`, {
        roomIds: roomIdArray,
        groupName: formData.groupName || undefined,
        guestName: formData.guestName.trim(),
        guestEmail: formData.guestEmail.trim() || undefined,
        guestPhone: formData.guestPhone.trim() || undefined,
        guestIdNumber: formData.guestIdNumber.trim() || undefined,
        checkInDate: checkIn.toISOString(),
        checkOutDate: checkOut.toISOString(),
        adults: formData.adults,
        children: formData.children,
        rates,
        specialRequests: combinedRequests || undefined,
        hallReservations: includeHall ? hallReservations : undefined,
      });
      toast.success('Group booking created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create group booking:', error);
      toast.error(error.response?.data?.message || 'Unable to create group booking');
    } finally {
      setSubmitting(false);
    }
  };

  const renderGuestStep = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>Group Name</label>
          <input
            type="text"
            value={formData.groupName}
            onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
            placeholder="Corporate Retreat, Family Reunion..."
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
            Guest Name *
          </label>
          <input
            type="text"
            value={formData.guestName}
            onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
            Email *
          </label>
          <input
            type="email"
            value={formData.guestEmail}
            onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
            Phone *
          </label>
          <input
            type="tel"
            value={formData.guestPhone}
            onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
            required
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
          Address *
        </label>
        <textarea
          value={formData.guestAddress}
          onChange={(e) => setFormData({ ...formData, guestAddress: e.target.value })}
          rows={3}
          placeholder="Street, City, State"
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            resize: 'vertical',
          }}
          required
        />
      </div>
    </div>
  );

  const renderStayStep = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
            Check-in *
          </label>
          <input
            type="date"
            value={formData.checkInDate}
            onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
            Check-out *
          </label>
          <input
            type="date"
            value={formData.checkOutDate}
            onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
            Adults *
          </label>
          <input
            type="number"
            min={1}
            value={formData.adults}
            onChange={(e) => setFormData({ ...formData, adults: Math.max(1, parseInt(e.target.value || '0', 10)) })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
            Children
          </label>
          <input
            type="number"
            min={0}
            value={formData.children}
            onChange={(e) => setFormData({ ...formData, children: Math.max(0, parseInt(e.target.value || '0', 10)) })}
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>Special Notes</label>
        <textarea
          value={formData.specialRequests}
          onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
          rows={3}
          placeholder="Dietary needs, arrival info..."
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '8px',
            border: '1px solid #cbd5e1',
            resize: 'vertical',
          }}
        />
      </div>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem',
          background: '#f8fafc',
        }}
      >
        {checkingAvailability ? (
          <p style={{ margin: 0, color: '#64748b' }}>Checking room availability...</p>
        ) : availabilityError ? (
          <p style={{ margin: 0, color: '#ef4444' }}>{availabilityError}</p>
        ) : formData.checkInDate && formData.checkOutDate ? (
          <p style={{ margin: 0, color: '#0f172a' }}>
            {availableRooms.length} room{availableRooms.length === 1 ? '' : 's'} available for {nights || 1} night
            {nights === 1 ? '' : 's'}.
          </p>
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>Pick your dates to load availability.</p>
        )}
      </div>
    </div>
  );

  const renderRoomsStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>Search rooms</label>
          <input
            type="text"
            value={roomSearch}
            onChange={(e) => setRoomSearch(e.target.value)}
            placeholder="Search by room #, type, category"
            style={{
              width: '100%',
              padding: '0.7rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          />
        </div>
        <div style={{ minWidth: '220px' }}>
          <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '0.7rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
            }}
          >
            <option value="all">All categories</option>
            <option value="none">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          padding: '1rem',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}
      >
        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: 600 }}>
          Bulk select (e.g. "101-105" or "201,203")
        </label>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={bulkSelectionInput}
            onChange={(e) => {
              setBulkSelectionInput(e.target.value);
              setBulkSelectionError(null);
            }}
            placeholder="101-105, 210"
            style={{
              flex: 1,
              minWidth: '220px',
              padding: '0.75rem',
              borderRadius: '8px',
              border: `1px solid ${bulkSelectionError ? '#ef4444' : '#cbd5e1'}`,
            }}
          />
          <button
            type="button"
            onClick={handleBulkSelection}
            style={{
              padding: '0.8rem 1.5rem',
              borderRadius: '8px',
              border: 'none',
              background: '#2563eb',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Add Rooms
          </button>
        </div>
        {bulkSelectionError && (
          <p style={{ marginTop: '0.4rem', color: '#ef4444', fontSize: '0.85rem' }}>{bulkSelectionError}</p>
        )}
        {unavailableRooms.size > 0 && (
          <p style={{ marginTop: '0.4rem', color: '#f97316', fontSize: '0.85rem' }}>
            Unavailable: {Array.from(unavailableRooms).join(', ')}
          </p>
        )}
      </div>

      {roomsByCategory.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center' }}>
          {formData.checkInDate && formData.checkOutDate
            ? 'No rooms available for the selected filters'
            : 'Select stay details first to load rooms'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '320px', overflowY: 'auto' }}>
          {roomsByCategory.map((group) => {
            const selectedCount = group.rooms.filter((room) => selectedRooms.has(room.id)).length;
            return (
              <div
                key={group.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem',
                  background: '#fff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>{group.name}</p>
                    <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      {selectedCount}/{group.rooms.length} selected
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={() => handleCategorySelectAll(group.rooms)}
                      style={{
                        padding: '0.35rem 0.9rem',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                      }}
                    >
                      Select all
                    </button>
                    {selectedCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleCategoryClear(group.rooms)}
                        style={{
                          padding: '0.35rem 0.9rem',
                          borderRadius: '6px',
                          border: '1px solid #fecaca',
                          background: '#fee2e2',
                          color: '#b91c1c',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {group.rooms.map((room) => {
                    const isSelected = selectedRooms.has(room.id);
                    const rate = roomRates[room.id] ?? getRoomEffectiveRate(room) ?? 0;
                    const hasCustomRate = room.customRate !== undefined && room.customRate !== null;
                    return (
                      <div
                        key={room.id}
                        onClick={() => toggleRoomSelection(room.id)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.85rem',
                          border: `2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? '#eff6ff' : '#fff',
                        }}
                      >
                        <div>
                          <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>
                            Room {room.roomNumber} • {room.roomType}
                          </p>
                          <p style={{ margin: '0.2rem 0 0', color: '#475569', fontSize: '0.85rem' }}>
                            {hasCustomRate ? 'Custom rate' : room.ratePlan?.name || 'Category rate'}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <input
                            type="number"
                            value={rate}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              setRoomRates({ ...roomRates, [room.id]: Number(e.target.value) || 0 })
                            }
                            style={{
                              width: '110px',
                              padding: '0.45rem',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              textAlign: 'right',
                            }}
                          />
                          <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.75rem' }}>per night</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedRooms.size > 0 && (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1rem',
            background: '#f8fafc',
          }}
        >
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Selected</p>
          <p style={{ margin: '0.25rem 0', fontWeight: 700, color: '#0f172a', fontSize: '1.25rem' }}>
            {selectedRooms.size} room{selectedRooms.size === 1 ? '' : 's'} • {formatCurrency(roomSubtotal)}
          </p>
          <p style={{ margin: 0, color: '#475569', fontSize: '0.85rem' }}>
            {selectedRoomDetails
              .map((room: any) => `${room.roomNumber} (${formatCurrency(roomRates[room.id] || 0)}/night)`)
              .join(', ')}
          </p>
        </div>
      )}
    </div>
  );

  const renderHallStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem',
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div>
          <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Add hall or event space</p>
          <p style={{ margin: '0.2rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
            Attach meeting halls to this group booking
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={includeHall} onChange={(e) => setIncludeHall(e.target.checked)} />
          Include hall booking
        </label>
      </div>

      {includeHall && meetingHalls.length === 0 && (
        <p style={{ color: '#ef4444' }}>No meeting halls configured for this property yet.</p>
      )}

      {includeHall && meetingHalls.length > 0 && (
        <>
          {hallReservations.map((reservation, index) => (
            <div
              key={reservation.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '1rem',
                background: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Hall Reservation #{index + 1}</p>
                {hallReservations.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeHallReservation(reservation.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    Hall *
                  </label>
                  <select
                    value={reservation.hallId}
                    onChange={(e) => handleHallChange(index, 'hallId', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  >
                    <option value="">Select hall</option>
                    {meetingHalls.map((hall) => (
                      <option key={hall.id} value={hall.id}>
                        {hall.name} (cap. {hall.capacity})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    Event Name
                  </label>
                  <input
                    type="text"
                    value={reservation.eventName}
                    onChange={(e) => handleHallChange(index, 'eventName', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    Rate (flat) *
                  </label>
                  <input
                    type="number"
                    value={reservation.rate}
                    onChange={(e) => handleHallChange(index, 'rate', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    Start *
                  </label>
                  <input
                    type="datetime-local"
                    value={reservation.startDateTime}
                    onChange={(e) => handleHallChange(index, 'startDateTime', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    End *
                  </label>
                  <input
                    type="datetime-local"
                    value={reservation.endDateTime}
                    onChange={(e) => handleHallChange(index, 'endDateTime', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    Attendees
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={reservation.attendeeCount}
                    onChange={(e) => handleHallChange(index, 'attendeeCount', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={reservation.purpose}
                    onChange={(e) => handleHallChange(index, 'purpose', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
                    Setup Type
                  </label>
                  <input
                    type="text"
                    value={reservation.setupType}
                    onChange={(e) => handleHallChange(index, 'setupType', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.7rem',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                    }}
                  />
                </div>
              </div>
              <textarea
                value={reservation.cateringNotes}
                onChange={(e) => handleHallChange(index, 'cateringNotes', e.target.value)}
                placeholder="Catering notes"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  resize: 'vertical',
                }}
              />
              <textarea
                value={reservation.avRequirements}
                onChange={(e) => handleHallChange(index, 'avRequirements', e.target.value)}
                placeholder="A/V requirements"
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.7rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  resize: 'vertical',
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={addHallReservation}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px dashed #94a3b8',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              color: '#2563eb',
            }}
          >
            + Add another hall
          </button>
        </>
      )}
    </div>
  );

  const renderInvoiceStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem',
          background: '#fff',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Guest</p>
        <p style={{ margin: '0.2rem 0 0', color: '#475569' }}>{formData.guestName}</p>
        <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
          {formData.guestEmail} • {formData.guestPhone}
        </p>
        <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>{formData.guestAddress}</p>
      </div>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem',
          background: '#fff',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Stay</p>
        <p style={{ margin: '0.2rem 0 0', color: '#475569' }}>
          {formData.checkInDate} → {formData.checkOutDate} • {nightMultiplier} night
          {nightMultiplier === 1 ? '' : 's'}
        </p>
        <p style={{ margin: '0.2rem 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
          {formData.adults} adult{formData.adults === 1 ? '' : 's'}
          {formData.children ? ` • ${formData.children} child${formData.children === 1 ? '' : 'ren'}` : ''}
        </p>
      </div>
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '1rem',
          background: '#fff',
        }}
      >
        <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Rooms ({selectedRooms.size})</p>
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {selectedRoomDetails.map((room: any) => {
            const nightly = roomRates[room.id] || 0;
            return (
              <div
                key={room.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#475569',
                }}
              >
                <span>
                  Room {room.roomNumber} • {room.roomType}
                </span>
                <span>
                  {formatCurrency(nightly)} × {nightMultiplier} = {formatCurrency(nightly * nightMultiplier)}
                </span>
              </div>
            );
          })}
        </div>
        <p style={{ marginTop: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
          Subtotal: {formatCurrency(roomSubtotal)}
        </p>
      </div>
      {includeHall && hallReservations.length > 0 && (
        <div
          style={{
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '1rem',
            background: '#fff',
          }}
        >
          <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Hall bookings</p>
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {hallReservations.map((reservation, index) => {
              const hallName = meetingHalls.find((hall) => hall.id === reservation.hallId)?.name || `Hall ${index + 1}`;
              return (
                <div
                  key={reservation.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#475569',
                  }}
                >
                  <span>
                    {hallName} • {reservation.startDateTime || 'TBD'}
                  </span>
                  <span>{formatCurrency(Number(reservation.rate) || 0)}</span>
                </div>
              );
            })}
          </div>
          <p style={{ marginTop: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
            Hall total: {formatCurrency(hallTotal)}
          </p>
        </div>
      )}
      <div
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: '12px',
          padding: '1.25rem',
          background: '#0f172a',
          color: '#fff',
        }}
      >
        <p style={{ margin: 0, fontSize: '0.9rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Invoice total</p>
        <p style={{ margin: '0.25rem 0 0', fontSize: '2rem', fontWeight: 700 }}>{formatCurrency(invoiceTotal)}</p>
        <p style={{ margin: '0.25rem 0 0', color: '#cbd5f5' }}>
          Rooms: {formatCurrency(roomSubtotal)} • Halls: {formatCurrency(hallTotal)}
        </p>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return renderGuestStep();
      case 1:
        return renderStayStep();
      case 2:
        return renderRoomsStep();
      case 3:
        return renderHallStep();
      case 4:
        return renderInvoiceStep();
      default:
        return null;
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
        background: 'rgba(15, 23, 42, 0.45)',
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
          width: '95%',
          maxWidth: '960px',
          background: '#fff',
          borderRadius: '18px',
          padding: '2rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 25px 70px rgba(15, 23, 42, 0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>New Group Booking</h2>
            <p style={{ margin: '0.3rem 0 0', color: '#64748b' }}>Capture guest info, rooms, halls, and invoice in one flow</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
          >
            <XCircle size={28} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`, gap: '0.35rem', marginBottom: '1.5rem' }}>
          {steps.map((label, index) => {
            const isActive = index === currentStep;
            const isComplete = index < currentStep;
            return (
              <div
                key={label}
                style={{
                  padding: '0.55rem 0.4rem',
                  borderRadius: '999px',
                  textAlign: 'center',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  background: isComplete ? '#dbeafe' : isActive ? '#2563eb' : '#f1f5f9',
                  color: isActive ? '#fff' : isComplete ? '#1d4ed8' : '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {label}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>{renderStep()}</div>

        <div
          style={{
            marginTop: '2rem',
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.9rem 1.5rem',
              borderRadius: '999px',
              border: '1px solid #e2e8f0',
              background: '#fff',
              color: '#475569',
              fontWeight: 600,
              flex: 1,
              maxWidth: '160px',
            }}
          >
            Cancel
          </button>
          {currentStep > 0 && (
            <button
              type="button"
              onClick={goToPreviousStep}
              style={{
                padding: '0.9rem 1.5rem',
                borderRadius: '999px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#0f172a',
                fontWeight: 600,
                flex: 1,
                maxWidth: '160px',
              }}
            >
              Back
            </button>
          )}
          {currentStep < steps.length - 1 && (
            <button
              type="button"
              onClick={goToNextStep}
              disabled={!canProceed}
              style={{
                padding: '0.9rem 1.5rem',
                borderRadius: '999px',
                border: 'none',
                background: canProceed ? '#2563eb' : '#cbd5e1',
                color: '#fff',
                fontWeight: 600,
                flex: 1,
                maxWidth: '200px',
                cursor: canProceed ? 'pointer' : 'not-allowed',
              }}
            >
              Next
            </button>
          )}
          {currentStep === steps.length - 1 && (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                padding: '0.9rem 1.5rem',
                borderRadius: '999px',
                border: 'none',
                background: submitting ? '#cbd5e1' : '#16a34a',
                color: '#fff',
                fontWeight: 600,
                flex: 1,
                maxWidth: '220px',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Saving...' : 'Create Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

