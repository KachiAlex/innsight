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
  const [processingReservations, setProcessingReservations] = useState<Set<string>>(new Set());

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
    setProcessingReservations(prev => new Set(prev).add(reservationId));
    try {
      await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkin`);
      fetchReservations();
      toast.success('Guest checked in successfully');
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setProcessingReservations(prev => {
        const next = new Set(prev);
        next.delete(reservationId);
        return next;
      });
    }
  };

  const handleCheckOut = async (reservationId: string) => {
    setProcessingReservations(prev => new Set(prev).add(reservationId));
    try {
      await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkout`, {
        finalCharges: {},
        paymentInfo: {},
      });
      fetchReservations();
      toast.success('Guest checked out successfully');
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setProcessingReservations(prev => {
        const next = new Set(prev);
        next.delete(reservationId);
        return next;
      });
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
                            disabled={processingReservations.has(reservation.id) || isBulkProcessing}
                            style={{
                              padding: '0.5rem',
                              background: processingReservations.has(reservation.id) ? '#94a3b8' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: processingReservations.has(reservation.id) ? 'not-allowed' : 'pointer',
                              opacity: processingReservations.has(reservation.id) ? 0.6 : 1,
                            }}
                            title="Check In"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                        {reservation.status === 'checked_in' && (
                          <button
                            onClick={() => handleCheckOut(reservation.id)}
                            disabled={processingReservations.has(reservation.id) || isBulkProcessing}
                            style={{
                              padding: '0.5rem',
                              background: processingReservations.has(reservation.id) ? '#94a3b8' : '#f59e0b',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: processingReservations.has(reservation.id) ? 'not-allowed' : 'pointer',
                              opacity: processingReservations.has(reservation.id) ? 0.6 : 1,
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
  const [allRooms, setAllRooms] = useState<any[]>([]);
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [meetingHalls, setMeetingHalls] = useState<any[]>([]);
  const [hasAvailabilityRun, setHasAvailabilityRun] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bulkSelectionInput, setBulkSelectionInput] = useState('');
  const [bulkSelectionError, setBulkSelectionError] = useState<string | null>(null);
  const [unavailableRooms, setUnavailableRooms] = useState<Set<string>>(new Set());
  const [roomRates, setRoomRates] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestAddress: '',
    checkInDate: '',
    checkOutDate: '',
    adults: 1,
    children: 0,
    specialRequests: '',
  });
  const [modalLoading, setModalLoading] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilitySummary, setAvailabilitySummary] = useState<{ total: number; available: number } | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [includeHall, setIncludeHall] = useState(false);
  const [hallReservations, setHallReservations] = useState<HallReservationForm[]>([]);

  useEffect(() => {
    if (includeHall) {
      setHallReservations((prev) => {
        if (prev.length > 0) return prev;
        const defaultHallId = meetingHalls[0]?.id || '';
        return [
          {
            id: generateTempId(),
            hallId: defaultHallId,
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
        ];
      });
    } else {
      setHallReservations([]);
    }
  }, [includeHall, meetingHalls]);

  const steps = ['Guest Information', 'Stay Details', 'Rooms', 'Hall Booking', 'Invoice'];
  const generateTempId = () => Math.random().toString(36).substring(2, 9);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchRooms();
    fetchCategories();
    fetchMeetingHalls();
  }, [user?.tenantId]);

  const fetchRooms = async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`);
      setAllRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const fetchCategories = async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/room-categories`);
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchMeetingHalls = async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/group-bookings/meeting-halls`);
      setMeetingHalls(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch meeting halls:', error);
      toast.error('Unable to load meeting halls');
    }
  };

  const fetchAvailability = async (checkIn: Date, checkOut: Date, minGuests: number) => {
    if (!user?.tenantId) return;

    setCheckingAvailability(true);
    setAvailabilityError(null);

    const params: Record<string, any> = {
      startDate: checkIn.toISOString(),
      endDate: checkOut.toISOString(),
      minOccupancy: Math.max(1, minGuests),
    };

    try {
      const response = await api.get(`/tenants/${user?.tenantId}/reservations/availability`, {
        params,
      });

      const data = response.data.data || {};
      const rooms = data.availableRooms || [];
      setAvailableRooms(rooms);
      setAvailabilitySummary({
        total: data.totalRooms ?? rooms.length,
        available: data.availableCount ?? rooms.length,
      });
      setHasAvailabilityRun(true);
    } catch (error) {
      console.error('Failed to fetch availability:', error);
      setAvailabilityError('Unable to load availability. Please try again.');
      setAvailableRooms([]);
      setAvailabilitySummary(null);
      setHasAvailabilityRun(true);
    } finally {
      setCheckingAvailability(false);
    }
  };

  useEffect(() => {
    if (!formData.checkInDate || !formData.checkOutDate) {
      setAvailableRooms([]);
      setAvailabilitySummary(null);
      setAvailabilityError(null);
      setHasAvailabilityRun(false);
      return;
    }

    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);

    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
      return;
    }
    if (checkOut <= checkIn) {
      setAvailabilityError('Check-out date must be after check-in date');
      setAvailableRooms([]);
      setAvailabilitySummary(null);
      return;
    }

    const minGuests = Number(formData.adults || 0) + Number(formData.children || 0);
    fetchAvailability(checkIn, checkOut, minGuests);
  }, [formData.checkInDate, formData.checkOutDate, formData.adults, formData.children]);

  const roomOptions = hasAvailabilityRun ? availableRooms : allRooms;
  useEffect(() => {
    setSelectedRoomIds((prev) => {
      if (!prev.size) return prev;
      const validIds = new Set(roomOptions.map((room) => room.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [roomOptions]);

  useEffect(() => {
    setRoomRates((prev) => {
      const next = { ...prev };
      roomOptions.forEach((room) => {
        if (next[room.id] === undefined) {
          const effectiveRate = getRoomEffectiveRate(room);
          if (effectiveRate !== null) {
            next[room.id] = effectiveRate;
          }
        }
      });
      return next;
    });
  }, [roomOptions]);

  const filteredRooms = roomOptions.filter((room) => {
    const matchesCategory =
      categoryFilter === 'all'
        ? true
        : categoryFilter === 'none'
          ? !room.category?.id
          : room.category?.id === categoryFilter;
    if (!matchesCategory) return false;
    if (roomSearch.trim()) {
      const query = roomSearch.toLowerCase();
      const matchesQuery =
        (room.roomNumber || '').toLowerCase().includes(query) ||
        (room.roomType || '').toLowerCase().includes(query) ||
        (room.category?.name || '').toLowerCase().includes(query);
      if (!matchesQuery) return false;
    }
    return true;
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

  const selectedRoomDetails = Array.from(selectedRoomIds)
    .map((roomId) => roomOptions.find((room) => room.id === roomId) || allRooms.find((room) => room.id === roomId))
    .filter(Boolean);

  const getNights = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    const start = new Date(formData.checkInDate);
    const end = new Date(formData.checkOutDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const nights = getNights();
  const nightMultiplier = Math.max(nights, 1);
  const roomSubtotal = selectedRoomDetails.reduce((sum, room: any) => {
    const nightly = roomRates[room.id] ?? getRoomEffectiveRate(room) ?? 0;
    return sum + nightly * nightMultiplier;
  }, 0);
  const hallTotal = hallReservations.reduce((sum, hall) => sum + (Number(hall.rate) || 0), 0);
  const invoiceTotal = roomSubtotal + (includeHall ? hallTotal : 0);

  const formatCurrency = (value: number) => `₦${Number(value).toLocaleString()}`;

  const validateHallReservations = () => {
    if (!includeHall) return true;
    if (hallReservations.length === 0) return false;
    return hallReservations.every((reservation) => {
      if (!reservation.hallId || !reservation.startDateTime || !reservation.endDateTime) return false;
      const start = new Date(reservation.startDateTime);
      const end = new Date(reservation.endDateTime);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
      if (end <= start) return false;
      return Number(reservation.rate) > 0;
    });
  };

  const parseBulkSelection = (input: string): string[] => {
    const roomNumbers: string[] = [];
    const parts = input
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

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
      const nextSelected = new Set(selectedRoomIds);
      const notFound = new Set<string>();
      numbers.forEach((roomNumber) => {
        const match = roomOptions.find(
          (room: any) => (room.roomNumber || '').toString() === roomNumber.toString()
        );
        if (match) {
          nextSelected.add(match.id);
        } else {
          notFound.add(roomNumber);
        }
      });
      setSelectedRoomIds(nextSelected);
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
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
        if (end <= start) return false;
        return !availabilityError;
      }
      case 2:
        return selectedRoomIds.size > 0 && !availabilityError;
      case 3:
        return !includeHall || validateHallReservations();
      case 4:
        return selectedRoomIds.size > 0 && (!includeHall || validateHallReservations());
      default:
        return true;
    }
  };

  const canProceed = validateStep(currentStep);

  const handleRoomToggle = (roomId: string) => {
    setSelectedRoomIds((prev) => {
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
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      rooms.forEach((room) => next.add(room.id));
      return next;
    });
  };

  const handleCategoryClear = (rooms: any[]) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      rooms.forEach((room) => next.delete(room.id));
      return next;
    });
  };

  const clearAllRooms = () => setSelectedRoomIds(new Set());

  const toIsoString = (value: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toISOString();
  };

  const handleSubmit = async () => {
    if (!validateStep(steps.length - 1)) {
      toast.error('Please complete all required details before creating reservations.');
      return;
    }

    const checkInIso = toIsoString(formData.checkInDate);
    const checkOutIso = toIsoString(formData.checkOutDate);

    if (!checkInIso || !checkOutIso) {
      toast.error('Please select valid check-in and check-out dates.');
      return;
    }

    if (selectedRoomIds.size === 0) {
      toast.error('Select at least one room to continue.');
      return;
    }

    const email = formData.guestEmail.trim();
    const phone = formData.guestPhone.trim();
    const specialRequestsNote = formData.specialRequests.trim();
    const combinedSpecialRequests = [
      formData.guestAddress ? `Guest address: ${formData.guestAddress.trim()}` : null,
      specialRequestsNote || null,
    ]
      .filter(Boolean)
      .join('\n');

    const roomsPayload = Array.from(selectedRoomIds)
      .map((roomId) => {
        const room =
          availableRooms.find((r) => r.id === roomId) || allRooms.find((r) => r.id === roomId);
        const nightly = roomRates[roomId] ?? getRoomEffectiveRate(room) ?? 0;
        return {
          room,
          roomId,
          nightly,
        };
      })
      .filter((entry) => entry.room);

    const invalidRates = roomsPayload
      .filter((entry) => !entry.nightly || entry.nightly <= 0)
      .map((entry) => entry.room?.roomNumber || entry.roomId);

    if (invalidRates.length > 0) {
      toast.error(`Please provide valid nightly rates for: ${invalidRates.join(', ')}`);
      return;
    }

    const hallReservationsPayload = includeHall
      ? hallReservations.map((reservation) => ({
          hallId: reservation.hallId,
          eventName: reservation.eventName || undefined,
          purpose: reservation.purpose || undefined,
          setupType: reservation.setupType || undefined,
          attendeeCount: reservation.attendeeCount || undefined,
          startDateTime: new Date(reservation.startDateTime).toISOString(),
          endDateTime: new Date(reservation.endDateTime).toISOString(),
          cateringNotes: reservation.cateringNotes || undefined,
          avRequirements: reservation.avRequirements || undefined,
          rate: reservation.rate || undefined,
        }))
      : undefined;

    setModalLoading(true);
    try {
      const response = await api.post(`/tenants/${user?.tenantId}/reservations/batch`, {
        guestName: formData.guestName.trim(),
        guestEmail: email === '' ? undefined : email,
        guestPhone: phone === '' ? undefined : phone,
        checkInDate: checkInIso,
        checkOutDate: checkOutIso,
        adults: formData.adults,
        children: formData.children,
        specialRequests: combinedSpecialRequests || undefined,
        rooms: roomsPayload.map((entry) => ({
          roomId: entry.roomId,
          rate: Number(entry.nightly),
        })),
        hallReservations: hallReservationsPayload,
      });

      const createdCount = response?.data?.data?.reservations?.length || roomsPayload.length;
      toast.success(`Created ${createdCount} reservation${createdCount > 1 ? 's' : ''}`);
      onSuccess();
    } catch (error: any) {
      // Error handled by API interceptor
      toast.error('Unable to create reservations. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  const goToNextStep = () => {
    if (!canProceed) {
      toast.error('Please complete the required fields before continuing');
      return;
    }
    if (currentStep === steps.length - 1) return;
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const goToPreviousStep = () => {
    if (currentStep === 0) return;
    setCurrentStep((prev) => prev - 1);
  };

  const renderGuestStep = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
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
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
          }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
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
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
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
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />
        </div>
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>
          Address *
        </label>
        <textarea
          rows={3}
          value={formData.guestAddress}
          onChange={(e) => setFormData({ ...formData, guestAddress: e.target.value })}
          required
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            resize: 'vertical',
          }}
        />
      </div>
      <div>
        <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>Notes</label>
        <textarea
          rows={3}
          value={formData.specialRequests}
          onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
          placeholder="Optional requests or remarks"
          style={{
            width: '100%',
            padding: '0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            resize: 'vertical',
          }}
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
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>Adults *</label>
          <input
            type="number"
            min={1}
            value={formData.adults}
            onChange={(e) =>
              setFormData({ ...formData, adults: Math.max(1, parseInt(e.target.value || '0', 10) || 1) })
            }
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.45rem', color: '#475569', fontWeight: 600 }}>Children</label>
          <input
            type="number"
            min={0}
            value={formData.children}
            onChange={(e) =>
              setFormData({ ...formData, children: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })
            }
            style={{
              width: '100%',
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
            }}
          />
        </div>
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
          <p style={{ margin: 0, color: '#64748b' }}>Checking availability...</p>
        ) : availabilityError ? (
          <p style={{ margin: 0, color: '#ef4444' }}>{availabilityError}</p>
        ) : availabilitySummary ? (
          <p style={{ margin: 0, color: '#0f172a' }}>
            {availabilitySummary.available} of {availabilitySummary.total} rooms available for {getNights()} night
            {getNights() === 1 ? '' : 's'}.
          </p>
        ) : (
          <p style={{ margin: 0, color: '#64748b' }}>Select dates to view availability.</p>
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
          <label style={{ display: 'block', marginBottom: '0.35rem', color: '#475569', fontWeight: 600 }}>
            Search rooms
          </label>
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
          {selectedRoomIds.size > 0 && (
            <button
              type="button"
              onClick={clearAllRooms}
              style={{
                padding: '0.8rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#fff',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Clear Selection
            </button>
          )}
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
            const selectedCount = group.rooms.filter((room) => selectedRoomIds.has(room.id)).length;
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
                    const isSelected = selectedRoomIds.has(room.id);
                    const rate = roomRates[room.id] ?? getRoomEffectiveRate(room) ?? 0;
                    const hasCustomRate = room.customRate !== undefined && room.customRate !== null;
                    return (
                      <div
                        key={room.id}
                        onClick={() => handleRoomToggle(room.id)}
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

      {selectedRoomIds.size > 0 && (
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
            {selectedRoomIds.size} room{selectedRoomIds.size === 1 ? '' : 's'} • {formatCurrency(roomSubtotal)}
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
            Attach meeting halls to this reservation
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
          {formData.checkInDate || '—'} → {formData.checkOutDate || '—'} • {nightMultiplier} night
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
        <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Rooms ({selectedRoomIds.size})</p>
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
          Rooms: {formatCurrency(roomSubtotal)} • Halls: {formatCurrency(includeHall ? hallTotal : 0)}
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
            <h2 style={{ margin: 0, fontSize: '1.75rem', color: '#0f172a' }}>New Reservation</h2>
            <p style={{ margin: '0.3rem 0 0', color: '#64748b' }}>
              Capture guest info, stay, rooms, optional halls, and review invoice
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}
          >
            <XCircle size={28} />
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
            gap: '0.35rem',
            marginBottom: '1.5rem',
          }}
        >
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
              disabled={modalLoading}
              style={{
                padding: '0.9rem 1.5rem',
                borderRadius: '999px',
                border: 'none',
                background: modalLoading ? '#cbd5e1' : '#16a34a',
                color: '#fff',
                fontWeight: 600,
                flex: 1,
                maxWidth: '220px',
                cursor: modalLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {modalLoading ? 'Saving...' : 'Create Reservation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
