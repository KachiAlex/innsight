import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, CheckCircle, XCircle, Filter } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';

interface Reservation {
  id: string;
  reservationNumber: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  rate: number;
  room: {
    roomNumber: string;
    roomType: string;
  };
}

export default function ReservationsPage() {
  const { user } = useAuthStore();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    roomId: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [rooms, setRooms] = useState<Array<{ id: string; roomNumber: string }>>([]);
  const [selectedReservations, setSelectedReservations] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchRooms();
  }, [user]);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchReservations(pagination.page);
  }, [user, pagination.page, filters]);

  const fetchRooms = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const fetchReservations = async (page = pagination.page) => {
    try {
      const params: any = {
        page,
        limit: pagination.limit,
      };
      if (filters.status) params.status = filters.status;
      if (filters.roomId) params.roomId = filters.roomId;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get(`/tenants/${user?.tenantId}/reservations`, { params });
      setReservations(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (reservationId: string) => {
    try {
      await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkin`);
      fetchReservations();
      toast.success('Guest checked in successfully');
    } catch (error: any) {
      // Error handled by API interceptor
    }
  };

  const handleCheckOut = async (reservationId: string) => {
    try {
      await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkout`, {
        finalCharges: {},
        paymentInfo: {},
      });
      fetchReservations();
      toast.success('Guest checked out successfully');
    } catch (error: any) {
      // Error handled by API interceptor
    }
  };

  const handleBulkCheckIn = async () => {
    if (selectedReservations.size === 0) {
      toast.error('Please select at least one reservation');
      return;
    }

    const confirmMessage = `Are you sure you want to check in ${selectedReservations.size} reservation(s)?`;
    if (!window.confirm(confirmMessage)) return;

    setIsBulkProcessing(true);
    const reservationIds = Array.from(selectedReservations);
    let successCount = 0;
    let failCount = 0;

    for (const reservationId of reservationIds) {
      try {
        await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkin`);
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    setIsBulkProcessing(false);
    setSelectedReservations(new Set());
    fetchReservations();

    if (failCount === 0) {
      toast.success(`Successfully checked in ${successCount} reservation(s)`);
    } else {
      toast.error(`Checked in ${successCount}, failed ${failCount}`);
    }
  };

  const handleBulkCheckOut = async () => {
    if (selectedReservations.size === 0) {
      toast.error('Please select at least one reservation');
      return;
    }

    const confirmMessage = `Are you sure you want to check out ${selectedReservations.size} reservation(s)?`;
    if (!window.confirm(confirmMessage)) return;

    setIsBulkProcessing(true);
    const reservationIds = Array.from(selectedReservations);
    let successCount = 0;
    let failCount = 0;

    for (const reservationId of reservationIds) {
      try {
        await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkout`, {
          finalCharges: {},
          paymentInfo: {},
        });
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    setIsBulkProcessing(false);
    setSelectedReservations(new Set());
    fetchReservations();

    if (failCount === 0) {
      toast.success(`Successfully checked out ${successCount} reservation(s)`);
    } else {
      toast.error(`Checked out ${successCount}, failed ${failCount}`);
    }
  };

  const toggleSelectReservation = (reservationId: string) => {
    const newSelected = new Set(selectedReservations);
    if (newSelected.has(reservationId)) {
      newSelected.delete(reservationId);
    } else {
      newSelected.add(reservationId);
    }
    setSelectedReservations(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedReservations.size === filteredReservations.length) {
      setSelectedReservations(new Set());
    } else {
      setSelectedReservations(new Set(filteredReservations.map((r) => r.id)));
    }
  };

  const filteredReservations = reservations.filter((reservation) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      reservation.reservationNumber.toLowerCase().includes(searchLower) ||
      reservation.guestName.toLowerCase().includes(searchLower) ||
      reservation.room.roomNumber.toLowerCase().includes(searchLower) ||
      reservation.room.roomType.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, any> = {
      confirmed: { background: '#dbeafe', color: '#1e40af' },
      checked_in: { background: '#d1fae5', color: '#065f46' },
      checked_out: { background: '#e5e7eb', color: '#374151' },
      cancelled: { background: '#fee2e2', color: '#991b1b' },
    };
    const style = styles[status] || styles.confirmed;
    return (
      <span
        style={{
          padding: '0.25rem 0.75rem',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: '500',
          ...style,
        }}
      >
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Reservations</h1>
          <TableSkeleton rows={8} columns={7} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#1e293b' }}>Reservations</h1>
            {pagination.total > 0 && (
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                {pagination.total} total reservation{pagination.total !== 1 ? 's' : ''}
              </p>
            )}
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
            New Reservation
          </button>
        </div>

        {selectedReservations.size > 0 && (
          <div
            style={{
              background: '#dbeafe',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#1e40af', fontWeight: '500' }}>
              {selectedReservations.size} reservation{selectedReservations.size !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={handleBulkCheckIn}
                disabled={isBulkProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: isBulkProcessing ? '#94a3b8' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isBulkProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <CheckCircle size={16} />
                Bulk Check In
              </button>
              <button
                onClick={handleBulkCheckOut}
                disabled={isBulkProcessing}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: isBulkProcessing ? '#94a3b8' : '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isBulkProcessing ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <XCircle size={16} />
                Bulk Check Out
              </button>
              <button
                onClick={() => setSelectedReservations(new Set())}
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
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {showFilters && (
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#1e293b', fontSize: '1rem', fontWeight: '600' }}>Filter Reservations</h3>
              <button
                onClick={() => {
                  setFilters({ status: '', roomId: '', startDate: '', endDate: '' });
                  setPagination({ ...pagination, page: 1 });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Clear All
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters({ ...filters, status: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  Room
                </label>
                <select
                  value={filters.roomId}
                  onChange={(e) => {
                    setFilters({ ...filters, roomId: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">All Rooms</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  Check-in From
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => {
                    setFilters({ ...filters, startDate: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  Check-out To
                </label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => {
                    setFilters({ ...filters, endDate: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setFilters({
                    status: '',
                    roomId: '',
                    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                  });
                  setPagination({ ...pagination, page: 1 });
                }}
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
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  setFilters({
                    status: '',
                    roomId: '',
                    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                  });
                  setPagination({ ...pagination, page: 1 });
                }}
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
                Last 30 Days
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by guest name, reservation number, or room..."
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: showFilters ? '#3b82f6' : '#f1f5f9',
              color: showFilters ? 'white' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Filter size={20} />
            Filters
          </button>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569', width: '50px' }}>
                  <input
                    type="checkbox"
                    checked={selectedReservations.size === filteredReservations.length && filteredReservations.length > 0}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>
                  Reservation #
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Guest</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Room</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Check-in</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Check-out</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Rate</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    {searchTerm ? 'No reservations match your search' : 'No reservations found'}
                  </td>
                </tr>
              ) : (
                filteredReservations.map((reservation) => (
                  <tr key={reservation.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedReservations.has(reservation.id)}
                        onChange={() => toggleSelectReservation(reservation.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ padding: '1rem', color: '#1e293b' }}>{reservation.reservationNumber}</td>
                    <td style={{ padding: '1rem', color: '#1e293b' }}>{reservation.guestName}</td>
                    <td style={{ padding: '1rem', color: '#1e293b' }}>
                      {reservation.room?.roomNumber} ({reservation.room?.roomType})
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      {format(new Date(reservation.checkInDate), 'MMM dd, yyyy')}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      {format(new Date(reservation.checkOutDate), 'MMM dd, yyyy')}
                    </td>
                    <td style={{ padding: '1rem', color: '#1e293b', fontWeight: '500' }}>
                      ₦{Number(reservation.rate).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem' }}>{getStatusBadge(reservation.status)}</td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {reservation.status === 'confirmed' && (
                          <button
                            onClick={() => handleCheckIn(reservation.id)}
                            style={{
                              padding: '0.5rem',
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                            title="Check In"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {reservation.status === 'checked_in' && (
                          <button
                            onClick={() => handleCheckOut(reservation.id)}
                            style={{
                              padding: '0.5rem',
                              background: '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                            }}
                            title="Check Out"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => {
                setPagination({ ...pagination, page: newPage });
                fetchReservations(newPage);
              }}
            />
          )}
        </div>

        {showCreateModal && (
          <CreateReservationModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchReservations();
            }}
          />
        )}
      </div>
    </Layout>
  );
}

function CreateReservationModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    roomId: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkInDate: '',
    checkOutDate: '',
    adults: 1,
    children: 0,
    rate: '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/tenants/${user?.tenantId}/reservations`, {
        ...formData,
        rate: parseFloat(formData.rate),
      });
      onSuccess();
      toast.success('Reservation created successfully');
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
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Create New Reservation</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Room *
              </label>
              <select
                value={formData.roomId}
                onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="">Select a room</option>
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} - {room.roomType} (₦{Number(room.ratePlan?.baseRate || 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
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
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Check-in Date *
                </label>
                <input
                  type="datetime-local"
                  value={formData.checkInDate}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Check-out Date *
                </label>
                <input
                  type="datetime-local"
                  value={formData.checkOutDate}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Rate (₦) *
                </label>
                <input
                  type="number"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Adults
                </label>
                <input
                  type="number"
                  value={formData.adults}
                  onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })}
                  min="1"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Children
                </label>
                <input
                  type="number"
                  value={formData.children}
                  onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })}
                  min="0"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Creating...' : 'Create Reservation'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
