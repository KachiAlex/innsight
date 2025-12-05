import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Users, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';
import { format } from 'date-fns';

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

export default function GroupBookingsPage() {
  const { user } = useAuthStore();
  const [groupBookings, setGroupBookings] = useState<GroupBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<GroupBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (user?.tenantId) {
      fetchGroupBookings();
    }
  }, [user?.tenantId, statusFilter]);

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

  const fetchGroupBookings = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter) {
        params.status = statusFilter;
      }
      const response = await api.get(`/tenants/${user?.tenantId}/group-bookings`, { params });
      setGroupBookings(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch group bookings:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch group bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (bookingId: string) => {
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
      toast.error(error.response?.data?.message || 'Failed to check in group booking');
    }
  };

  const handleCheckOut = async (bookingId: string) => {
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
      toast.error(error.response?.data?.message || 'Failed to check out group booking');
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this group booking? This will cancel all reservations in the group.')) {
      return;
    }

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
      toast.error(error.response?.data?.message || 'Failed to cancel group booking');
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


  const filteredBookings = groupBookings.filter((booking) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        booking.groupBookingNumber.toLowerCase().includes(searchLower) ||
        booking.guestName.toLowerCase().includes(searchLower) ||
        booking.guestEmail?.toLowerCase().includes(searchLower) ||
        booking.guestPhone?.toLowerCase().includes(searchLower) ||
        booking.groupName?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

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

        {filteredBookings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
            <Users size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: '#64748b' }} />
            <p style={{ color: '#64748b', fontSize: '1.1rem' }}>No group bookings found</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {filteredBookings.map((booking) => {
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
                    {booking.reservations.slice(0, 5).map((res) => (
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
        )}

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
}: {
  booking: GroupBooking;
  onClose: () => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  onCancel: (id: string) => void;
  tenantId: string;
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
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Check In All Rooms
                </button>
              ) : null}
              {details.status === 'checked_in' || details.status === 'partially_checked_out' ? (
                <button
                  onClick={() => onCheckOut(details.id)}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Check Out All Rooms
                </button>
              ) : null}
              {details.status !== 'cancelled' && details.status !== 'checked_out' ? (
                <button
                  onClick={() => onCancel(details.id)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: 'white',
                    color: '#ef4444',
                    border: '1px solid #fee2e2',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '500',
                  }}
                >
                  Cancel
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
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [roomRates, setRoomRates] = useState<Record<string, number>>({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [formData, setFormData] = useState({
    groupName: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestIdNumber: '',
    checkInDate: '',
    checkOutDate: '',
    adults: 1,
    children: 0,
    specialRequests: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      if (checkOut > checkIn) {
        fetchAvailability(checkIn, checkOut);
      }
    }
  }, [formData.checkInDate, formData.checkOutDate, tenantId]);

  const fetchAvailability = async (checkIn: Date, checkOut: Date) => {
    if (!tenantId) return;
    setCheckingAvailability(true);
    try {
      const response = await api.get(`/tenants/${tenantId}/reservations/availability`, {
        params: {
          startDate: checkIn.toISOString(),
          endDate: checkOut.toISOString(),
        },
      });
      const rooms = response.data.data?.availableRooms || [];
      setAvailableRooms(rooms);
      
      // Initialize rates from rate plans
      const rates: Record<string, number> = {};
      rooms.forEach((room: any) => {
        if (room.ratePlan?.baseRate) {
          rates[room.id] = Number(room.ratePlan.baseRate);
        }
      });
      setRoomRates(rates);
    } catch (error: any) {
      console.error('Failed to fetch availability:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch room availability');
    } finally {
      setCheckingAvailability(false);
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    setSelectedRooms(newSelected);
  };

  const handleSubmit = async () => {
    if (!formData.guestName || !formData.checkInDate || !formData.checkOutDate) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedRooms.size === 0) {
      toast.error('Please select at least one room');
      return;
    }

    setSubmitting(true);
    try {
      const rates: Record<string, number> = {};
      selectedRooms.forEach(roomId => {
        rates[roomId] = roomRates[roomId] || 0;
      });

      await api.post(`/tenants/${tenantId}/group-bookings`, {
        roomIds: Array.from(selectedRooms),
        groupName: formData.groupName || undefined,
        guestName: formData.guestName,
        guestEmail: formData.guestEmail || undefined,
        guestPhone: formData.guestPhone || undefined,
        guestIdNumber: formData.guestIdNumber || undefined,
        checkInDate: new Date(formData.checkInDate).toISOString(),
        checkOutDate: new Date(formData.checkOutDate).toISOString(),
        adults: formData.adults,
        children: formData.children,
        rates: rates,
        specialRequests: formData.specialRequests || undefined,
      });

      toast.success('Group booking created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create group booking:', error);
      toast.error(error.response?.data?.message || 'Failed to create group booking');
    } finally {
      setSubmitting(false);
    }
  };

  const totalRate = Array.from(selectedRooms).reduce((sum, roomId) => {
    return sum + (roomRates[roomId] || 0);
  }, 0);

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
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '600', color: '#1e293b' }}>Create Group Booking</h2>
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

        <div style={{ display: 'grid', gap: '1.5rem' }}>
          {/* Guest Information */}
          <div>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>Guest Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Group Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.groupName}
                  onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                  placeholder="e.g., Smith Family, Corporate Retreat"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
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
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={formData.guestEmail}
                  onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.guestPhone}
                  onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Dates and Guests */}
          <div>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>Dates & Guests</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Check-In Date *
                </label>
                <input
                  type="date"
                  value={formData.checkInDate}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Check-Out Date *
                </label>
                <input
                  type="date"
                  value={formData.checkOutDate}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Adults *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.adults}
                  onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 1 })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Children
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.children}
                  onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Room Selection */}
          <div>
            <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: '600', color: '#1e293b' }}>
              Select Rooms {checkingAvailability && <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#64748b' }}>(Loading...)</span>}
            </h3>
            {availableRooms.length === 0 && formData.checkInDate && formData.checkOutDate ? (
              <p style={{ color: '#64748b', padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
                No available rooms for the selected dates. Please try different dates.
              </p>
            ) : availableRooms.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto', padding: '0.5rem' }}>
                {availableRooms.map((room) => {
                  const isSelected = selectedRooms.has(room.id);
                  const rate = roomRates[room.id] || 0;
                  
                  return (
                    <div
                      key={room.id}
                      onClick={() => toggleRoomSelection(room.id)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        border: `2px solid ${isSelected ? '#3b82f6' : '#e2e8f0'}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        background: isSelected ? '#eff6ff' : 'white',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div>
                        <p style={{ margin: 0, fontWeight: '500', color: '#1e293b' }}>
                          {room.roomNumber} - {room.roomType}
                        </p>
                        {room.ratePlan && (
                          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                            Rate Plan: {room.ratePlan.name}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <input
                          type="number"
                          value={rate}
                          onChange={(e) => {
                            const newRate = parseFloat(e.target.value) || 0;
                            setRoomRates({ ...roomRates, [room.id]: newRate });
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            width: '100px',
                            padding: '0.5rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            textAlign: 'right',
                          }}
                          placeholder="Rate"
                        />
                        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>per night</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Summary */}
          {selectedRooms.size > 0 && (
            <div style={{ padding: '1rem', background: '#f8f9fa', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Selected Rooms</p>
                  <p style={{ margin: '0.25rem 0 0', fontWeight: '600', color: '#1e293b' }}>
                    {selectedRooms.size} room{selectedRooms.size !== 1 ? 's' : ''}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>Total Rate</p>
                  <p style={{ margin: '0.25rem 0 0', fontWeight: '700', color: '#1e293b', fontSize: '1.5rem' }}>
                    ₦{totalRate.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              onClick={onClose}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || selectedRooms.size === 0}
              style={{
                flex: 1,
                padding: '0.75rem',
                border: 'none',
                borderRadius: '6px',
                background: submitting || selectedRooms.size === 0 ? '#cbd5e1' : '#3b82f6',
                color: 'white',
                cursor: submitting || selectedRooms.size === 0 ? 'not-allowed' : 'pointer',
                fontWeight: '500',
              }}
            >
              {submitting ? 'Creating...' : 'Create Group Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

