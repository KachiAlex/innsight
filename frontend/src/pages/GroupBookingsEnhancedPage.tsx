import { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import {
  Plus,
  Search,
  Users,
  Calendar,
  DollarSign,
  Building,
  User,
  Bed,
  Mail,
  Phone
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
  hallReservations?: HallReservation[];
  reservations?: any[];
}

interface RoomBlockValidationErrors {
  roomCategoryId?: string;
  roomType?: string;
  totalRooms?: string;
}

interface HallReservationValidationErrors {
  hallId?: string;
  startDateTime?: string;
  endDateTime?: string;
}

const generateTempId = () =>
  (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

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

interface HallReservation {
  id?: string;
  hallId: string;
  eventName?: string;
  purpose?: string;
  setupType?: string;
  attendeeCount?: number;
  startDateTime: string;
  endDateTime: string;
  cateringNotes?: string;
  avRequirements?: string;
  hall?: {
    id: string;
    name: string;
    capacity: number;
    location?: string;
  } | null;
}

interface MeetingHall {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  location?: string;
  amenities?: Record<string, unknown>;
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
  const [selectedBooking, setSelectedBooking] = useState<GroupBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [meetingHalls, setMeetingHalls] = useState<MeetingHall[]>([]);
  const [roomCategories, setRoomCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [roomInventory, setRoomInventory] = useState<Array<{ id: string; roomNumber?: string; roomType?: string; categoryId?: string }>>([]);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [loadingHalls, setLoadingHalls] = useState(false);
  const [loadingRoomMeta, setLoadingRoomMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [formData, setFormData] = useState<{
    groupName: string;
    groupType: string;
    contactPerson: string;
    contactEmail: string;
    contactPhone: string;
    expectedGuests: string;
    checkInDate: string;
    checkOutDate: string;
    depositAmount: string;
    specialRequests: string;
    dietaryRequirements: string;
    setupRequirements: string;
    roomBlocks: RoomBlock[];
    hallReservations: HallReservation[];
  }>({
    groupName: '',
    groupType: 'corporate',
    contactPerson: '',
    contactEmail: '',
    contactPhone: '',
    expectedGuests: '',
    checkInDate: '',
    checkOutDate: '',
    depositAmount: '',
    specialRequests: '',
    dietaryRequirements: '',
    setupRequirements: '',
    roomBlocks: [{
      id: generateTempId(),
      roomCategoryId: '',
      roomType: '',
      totalRooms: 5,
      allocatedRooms: 0,
      availableRooms: 5,
      negotiatedRate: undefined,
      discountPercent: undefined,
      checkInDate: '',
      checkOutDate: '',
    }],
    hallReservations: [],
  });

  const getCategoryName = (categoryId: string) => {
    if (!categoryId) return 'Unassigned';
    return roomCategories.find((category) => category.id === categoryId)?.name ?? 'Unassigned';
  };

  const getInventoryCount = (categoryId: string, roomType: string) => {
    return roomInventory.filter((room) => {
      const matchesCategory = categoryId ? room.categoryId === categoryId : true;
      const matchesRoomType = roomType ? room.roomType === roomType : true;
      return matchesCategory && matchesRoomType;
    }).length;
  };

  useEffect(() => {
    loadBookings();
    loadStats();
  }, [user?.tenantId, statusFilter]);

  useEffect(() => {
    if (showCreateModal) {
      loadMeetingHalls();
      loadRoomMeta();
    }
  }, [showCreateModal, user?.tenantId]);

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

  const loadRoomMeta = async () => {
    if (!user?.tenantId) return;
    setLoadingRoomMeta(true);
    try {
      const [categoriesResponse, roomsResponse] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/room-categories`),
        api.get(`/tenants/${user.tenantId}/rooms`),
      ]);

      const categories = categoriesResponse.data?.data ?? [];
      const rooms = roomsResponse.data?.data ?? [];
      setRoomCategories(
        categories.map((category: any) => ({
          id: category.id,
          name: category.name,
        })),
      );
      setRoomInventory(
        rooms.map((room: any) => ({
          id: room.id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          categoryId: room.category?.id ?? room.categoryId ?? null,
        })),
      );
      const types = Array.from(
        new Set(
          rooms
            .map((room: any) => room.roomType)
            .filter((value: string | undefined) => Boolean(value)),
        ),
      ) as string[];
      setRoomTypes(types);
    } catch (error) {
      console.error('Error loading room metadata:', error);
      toast.error('Failed to load room categories/rooms');
    } finally {
      setLoadingRoomMeta(false);
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

  const loadMeetingHalls = async () => {
    if (!user?.tenantId) return;
    setLoadingHalls(true);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/group-bookings/meeting-halls`);
      setMeetingHalls(response.data.data);
    } catch (error) {
      console.error('Error loading meeting halls:', error);
      toast.error('Failed to load meeting halls');
    } finally {
      setLoadingHalls(false);
    }
  };

  const resetForm = () => {
    setFormData({
      groupName: '',
      groupType: 'corporate',
      contactPerson: '',
      contactEmail: '',
      contactPhone: '',
      expectedGuests: '',
      checkInDate: '',
      checkOutDate: '',
      depositAmount: '',
      specialRequests: '',
      dietaryRequirements: '',
      setupRequirements: '',
      roomBlocks: [{
        id: generateTempId(),
        roomCategoryId: '',
        roomType: '',
        totalRooms: 5,
        allocatedRooms: 0,
        availableRooms: 5,
        negotiatedRate: undefined,
        discountPercent: undefined,
        checkInDate: '',
        checkOutDate: '',
      }],
      hallReservations: [],
    });
    setShowValidationErrors(false);
  };

  const validationErrors = useMemo(() => {
    const trim = (value: string) => value.trim();
    const fields: Record<string, string | undefined> = {
      groupName: trim(formData.groupName) ? undefined : 'Group name is required',
      contactPerson: trim(formData.contactPerson) ? undefined : 'Contact person is required',
      contactEmail: trim(formData.contactEmail) ? undefined : 'Contact email is required',
      contactPhone: trim(formData.contactPhone) ? undefined : 'Contact phone is required',
      checkInDate: formData.checkInDate ? undefined : 'Check-in date is required',
      checkOutDate: formData.checkOutDate ? undefined : 'Check-out date is required',
      roomBlocks: formData.roomBlocks.length === 0 ? 'At least one room block is required' : undefined,
    };

    if (formData.checkInDate && formData.checkOutDate) {
      const checkIn = new Date(formData.checkInDate);
      const checkOut = new Date(formData.checkOutDate);
      if (checkOut <= checkIn) {
        fields.checkOutDate = 'Check-out must be after check-in';
      }
    }

    const roomBlocks = formData.roomBlocks.map<RoomBlockValidationErrors>((block) => {
      const errors: RoomBlockValidationErrors = {};
      if (!block.roomCategoryId.trim()) errors.roomCategoryId = 'Room category is required';
      if (!block.roomType.trim()) errors.roomType = 'Room type is required';
      if (!block.totalRooms || block.totalRooms <= 0) errors.totalRooms = 'Total rooms must be greater than 0';
      return errors;
    });

    const hallReservations = formData.hallReservations.map<HallReservationValidationErrors>((reservation) => {
      const errors: HallReservationValidationErrors = {};
      if (!reservation.hallId) errors.hallId = 'Select a hall';
      if (!reservation.startDateTime) errors.startDateTime = 'Start date & time is required';
      if (!reservation.endDateTime) errors.endDateTime = 'End date & time is required';
      if (
        reservation.startDateTime &&
        reservation.endDateTime &&
        new Date(reservation.endDateTime) <= new Date(reservation.startDateTime)
      ) {
        errors.endDateTime = 'End must be after start';
      }
      return errors;
    });

    const hasErrors =
      Object.values(fields).some(Boolean) ||
      roomBlocks.some((block) => Object.keys(block).length > 0) ||
      hallReservations.some((reservation) => Object.keys(reservation).length > 0);

    return { fields, roomBlocks, hallReservations, hasErrors };
  }, [formData]);

  const shouldShowErrors = showValidationErrors;
  const getFieldError = (field: string) =>
    shouldShowErrors ? validationErrors.fields[field] : undefined;
  const errorTextStyle = {
    color: '#dc2626',
    fontSize: '0.75rem',
    marginTop: '0.25rem'
  };
  const inputBorderStyle = (field?: string) => ({
    marginTop: '0.35rem',
    padding: '0.6rem',
    borderRadius: '8px',
    border: field && getFieldError(field) ? '1px solid #f87171' : '1px solid #cbd5f5',
    background: field && getFieldError(field) ? '#fef2f2' : '#fff'
  });
  const createDisabled = saving || validationErrors.hasErrors;
  const roomBlockInputStyle = (index: number, field: keyof RoomBlockValidationErrors) => {
    const error = shouldShowErrors ? validationErrors.roomBlocks[index]?.[field] : undefined;
    return {
      padding: '0.6rem',
      borderRadius: '8px',
      border: error ? '1px solid #f87171' : '1px solid #cbd5f5',
      background: error ? '#fef2f2' : '#fff'
    };
  };
  const hallReservationInputStyle = (index: number, field: keyof HallReservationValidationErrors) => {
    const error = shouldShowErrors ? validationErrors.hallReservations[index]?.[field] : undefined;
    return {
      padding: '0.6rem',
      borderRadius: '8px',
      border: error ? '1px solid #fb7185' : '1px solid #cbd5f5',
      background: error ? '#fff1f2' : '#fff'
    };
  };

  const handleAddRoomBlock = () => {
    setFormData(prev => ({
      ...prev,
      roomBlocks: [
        ...prev.roomBlocks,
        {
          id: generateTempId(),
          roomCategoryId: '',
          roomType: '',
          totalRooms: 5,
          allocatedRooms: 0,
          availableRooms: 5,
          negotiatedRate: undefined,
          discountPercent: undefined,
          checkInDate: '',
          checkOutDate: '',
        },
      ],
    }));
  };

  const handleUpdateRoomBlock = (index: number, field: keyof RoomBlock, value: string) => {
    setFormData(prev => {
      const updated = [...prev.roomBlocks];
      const target = { ...updated[index] };
      if (field === 'totalRooms') {
        const num = Number(value) || 0;
        target.totalRooms = num;
        target.availableRooms = num - (target.allocatedRooms || 0);
      } else if (field === 'negotiatedRate' || field === 'discountPercent') {
        (target as any)[field] = value === '' ? undefined : Number(value);
      } else {
        (target as any)[field] = value;
      }
      updated[index] = target;
      return { ...prev, roomBlocks: updated };
    });
  };

  const handleRemoveRoomBlock = (index: number) => {
    setFormData(prev => ({
      ...prev,
      roomBlocks: prev.roomBlocks.filter((_, i) => i !== index),
    }));
  };

  const handleAddHallReservation = () => {
    setFormData(prev => ({
      ...prev,
      hallReservations: [
        ...prev.hallReservations,
        {
          id: generateTempId(),
          hallId: meetingHalls[0]?.id || '',
          eventName: '',
          purpose: '',
          setupType: '',
          attendeeCount: undefined,
          startDateTime: '',
          endDateTime: '',
          cateringNotes: '',
          avRequirements: '',
        },
      ],
    }));
  };

  const handleUpdateHallReservation = (index: number, field: keyof HallReservation, value: string) => {
    setFormData(prev => {
      const updated = [...prev.hallReservations];
      const target = { ...updated[index] };
      if (field === 'attendeeCount') {
        target.attendeeCount = value === '' ? undefined : Number(value);
      } else {
        (target as any)[field] = value;
      }
      updated[index] = target;
      return { ...prev, hallReservations: updated };
    });
  };

  const handleRemoveHallReservation = (index: number) => {
    setFormData(prev => ({
      ...prev,
      hallReservations: prev.hallReservations.filter((_, i) => i !== index),
    }));
  };

  const handleCreateBooking = async () => {
    if (!user?.tenantId) return;

    if (validationErrors.hasErrors) {
      setShowValidationErrors(true);
      toast.error('Please resolve the highlighted fields');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/tenants/${user.tenantId}/group-bookings`, {
        groupName: formData.groupName.trim(),
        groupType: formData.groupType,
        contactPerson: formData.contactPerson.trim(),
        contactEmail: formData.contactEmail.trim(),
        contactPhone: formData.contactPhone.trim(),
        expectedGuests: formData.expectedGuests ? Number(formData.expectedGuests) : undefined,
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        depositAmount: formData.depositAmount ? Number(formData.depositAmount) : undefined,
        specialRequests: formData.specialRequests.trim() || undefined,
        dietaryRequirements: formData.dietaryRequirements.trim() || undefined,
        setupRequirements: formData.setupRequirements.trim() || undefined,
        roomBlocks: formData.roomBlocks.map(block => ({
          roomCategoryId: block.roomCategoryId.trim(),
          roomType: block.roomType.trim(),
          totalRooms: block.totalRooms,
          negotiatedRate: block.negotiatedRate,
          discountPercent: block.discountPercent,
        })),
        hallReservations: formData.hallReservations.map(reservation => ({
          hallId: reservation.hallId,
          eventName: reservation.eventName?.trim() || undefined,
          purpose: reservation.purpose?.trim() || undefined,
          setupType: reservation.setupType?.trim() || undefined,
          attendeeCount: reservation.attendeeCount,
          startDateTime: reservation.startDateTime,
          endDateTime: reservation.endDateTime,
          cateringNotes: reservation.cateringNotes?.trim() || undefined,
          avRequirements: reservation.avRequirements?.trim() || undefined,
        })),
      });

      toast.success('Group booking created');
      setShowCreateModal(false);
      resetForm();
      loadBookings();
      loadStats();
    } catch (error: any) {
      console.error('Error creating group booking:', error);
      const message = error?.response?.data?.message || 'Failed to create group booking';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setShowValidationErrors(false);
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

          <Button onClick={openCreateModal}>
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
          <Button onClick={openCreateModal}>
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

              {/* Hall Reservations Summary */}
              {booking.hallReservations && booking.hallReservations.length > 0 && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: '#f0f9ff',
                  borderRadius: '6px',
                  border: '1px solid #bae6fd',
                  fontSize: '0.875rem',
                  color: '#0c4a6e'
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Meeting Hall Reservations</div>
                  <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                    {booking.hallReservations.map((reservation) => (
                      <li key={reservation.id} style={{ marginBottom: '0.25rem' }}>
                        <strong>{reservation.hall?.name || 'Hall'}</strong> &mdash; {reservation.eventName || 'Event'}
                        {' '}({formatDate(reservation.startDateTime)} @ {new Date(reservation.startDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' '} - {new Date(reservation.endDateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </li>
                    ))}
                  </ul>
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

      {/* Details Modal */}
      {showDetailsModal && selectedBooking && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '2rem',
            zIndex: 1000,
            overflowY: 'auto'
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              width: '100%',
              maxWidth: '960px',
              paddingBottom: '1rem',
              boxShadow: '0 20px 45px -15px rgba(15,23,42,0.4)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.5rem 2rem',
                borderBottom: '1px solid #e2e8f0'
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: '1.75rem' }}>{selectedBooking.groupName}</h2>
                <p style={{ margin: '0.35rem 0 0', color: '#475569', fontSize: '0.95rem' }}>
                  #{selectedBooking.groupBookingNumber} • {selectedBooking.groupType}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <span
                  style={{
                    padding: '0.35rem 0.85rem',
                    borderRadius: '999px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    background: `${getStatusColor(selectedBooking.status)}20`,
                    color: getStatusColor(selectedBooking.status)
                  }}
                >
                  {selectedBooking.status.toUpperCase()}
                </span>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
                    width: '38px',
                    height: '38px',
                    borderRadius: '999px',
                    fontSize: '1.25rem',
                    cursor: 'pointer'
                  }}
                  aria-label="Close details"
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', display: 'grid', gap: '1.25rem' }}>
              {/* Timeline and Revenue */}
              <section
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '1rem'
                }}
              >
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem'
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '0.05em' }}>CHECK-IN</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatDate(selectedBooking.checkInDate)}</div>
                </div>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem'
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '0.05em' }}>CHECK-OUT</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{formatDate(selectedBooking.checkOutDate)}</div>
                </div>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem'
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '0.05em' }}>ROOMS</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{selectedBooking.totalRooms}</div>
                </div>
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1rem'
                  }}
                >
                  <div style={{ color: '#94a3b8', fontSize: '0.75rem', letterSpacing: '0.05em' }}>REVENUE</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                    {formatCurrency(selectedBooking.totalRevenue)}
                  </div>
                </div>
              </section>

              {/* Contact + Requests */}
              <section
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'grid',
                  gap: '1rem'
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    color: '#475569',
                    fontSize: '0.9rem'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Contact</div>
                    <div>{selectedBooking.contactPerson}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Email</div>
                    <div>{selectedBooking.contactEmail}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Phone</div>
                    <div>{selectedBooking.contactPhone}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Guests</div>
                    <div>
                      Expected {selectedBooking.expectedGuests} / Confirmed {selectedBooking.confirmedGuests}
                    </div>
                  </div>
                </div>

                {(selectedBooking.specialRequests ||
                  selectedBooking.dietaryRequirements ||
                  selectedBooking.setupRequirements) && (
                  <div
                    style={{
                      background: '#fff7ed',
                      borderRadius: '10px',
                      padding: '0.85rem',
                      border: '1px solid #fdba74',
                      color: '#92400e',
                      fontSize: '0.9rem'
                    }}
                  >
                    {selectedBooking.specialRequests && (
                      <div style={{ marginBottom: '0.35rem' }}>
                        <strong>Special:</strong> {selectedBooking.specialRequests}
                      </div>
                    )}
                    {selectedBooking.dietaryRequirements && (
                      <div style={{ marginBottom: '0.35rem' }}>
                        <strong>Dietary:</strong> {selectedBooking.dietaryRequirements}
                      </div>
                    )}
                    {selectedBooking.setupRequirements && (
                      <div>
                        <strong>Setup:</strong> {selectedBooking.setupRequirements}
                      </div>
                    )}
                  </div>
                )}
              </section>

              {/* Room Blocks */}
              {selectedBooking.roomBlocks && selectedBooking.roomBlocks.length > 0 && (
                <section
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem'
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Room Blocks</h3>
                    <span style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {selectedBooking.roomBlocks.length} block
                      {selectedBooking.roomBlocks.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {selectedBooking.roomBlocks.map((block) => (
                      <div
                        key={block.id}
                        style={{
                          border: '1px solid #cbd5f5',
                          borderRadius: '10px',
                          padding: '0.85rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 600 }}>{block.roomType || 'Room Type'}</div>
                          <div style={{ color: '#0f172a', fontWeight: 600 }}>{block.totalRooms} rooms</div>
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                            gap: '0.5rem',
                            fontSize: '0.85rem',
                            color: '#475569'
                          }}
                        >
                          <span>Category: {block.roomCategoryId || '—'}</span>
                          <span>Rate: {block.negotiatedRate ? formatCurrency(block.negotiatedRate) : 'N/A'}</span>
                          <span>Discount: {block.discountPercent ? `${block.discountPercent}%` : '—'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Hall Reservations */}
              {selectedBooking.hallReservations && selectedBooking.hallReservations.length > 0 && (
                <section
                  style={{
                    border: '1px solid #e0f2fe',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    background: '#f0f9ff'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1rem',
                      color: '#0c4a6e'
                    }}
                  >
                    <h3 style={{ margin: 0 }}>Meeting Hall Reservations</h3>
                    <span style={{ fontSize: '0.85rem' }}>
                      {selectedBooking.hallReservations.length}{' '}
                      {selectedBooking.hallReservations.length === 1 ? 'reservation' : 'reservations'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {selectedBooking.hallReservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        style={{
                          border: '1px solid #bae6fd',
                          borderRadius: '10px',
                          padding: '0.85rem',
                          background: '#fff'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '0.5rem',
                            flexWrap: 'wrap',
                            marginBottom: '0.4rem'
                          }}
                        >
                          <div style={{ fontWeight: 600 }}>
                            {reservation.hall?.name || 'Hall'} • {reservation.eventName || 'Event'}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#0369a1' }}>
                            {reservation.attendeeCount ? `${reservation.attendeeCount} attendees` : 'Capacity TBD'}
                          </div>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#0f172a', marginBottom: '0.4rem' }}>
                          {formatDateTime(reservation.startDateTime)} &rarr; {formatDateTime(reservation.endDateTime)}
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                            gap: '0.5rem',
                            fontSize: '0.8rem',
                            color: '#475569'
                          }}
                        >
                          <span>Purpose: {reservation.purpose || '—'}</span>
                          <span>Setup: {reservation.setupType || '—'}</span>
                        </div>
                        {(reservation.cateringNotes || reservation.avRequirements) && (
                          <div
                            style={{
                              marginTop: '0.6rem',
                              background: '#f8fafc',
                              borderRadius: '8px',
                              padding: '0.6rem',
                              fontSize: '0.8rem',
                              color: '#0f172a'
                            }}
                          >
                            {reservation.cateringNotes && (
                              <div style={{ marginBottom: '0.35rem' }}>
                                <strong>Catering:</strong> {reservation.cateringNotes}
                              </div>
                            )}
                            {reservation.avRequirements && (
                              <div>
                                <strong>AV:</strong> {reservation.avRequirements}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Booking Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.55)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          overflowY: 'auto',
          padding: '2rem',
          zIndex: 1000,
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1000px',
            padding: '2rem',
            boxShadow: '0 25px 50px -12px rgba(15,23,42,0.35)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 700 }}>New Group Booking</h2>
                <p style={{ margin: 0, color: '#64748b' }}>Capture room blocks and optional hall reservations</p>
              </div>
              <button
                onClick={closeCreateModal}
                style={{
                  border: 'none',
                  background: '#f1f5f9',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  fontSize: '1.25rem',
                  cursor: 'pointer',
                }}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gap: '1.5rem' }}>
              {/* Contact & Dates */}
              <section style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>Event Details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Group Name *
                    <input
                      type="text"
                      value={formData.groupName}
                      onChange={(e) => setFormData(prev => ({ ...prev, groupName: e.target.value }))}
                      style={inputBorderStyle('groupName')}
                    />
                    {getFieldError('groupName') && (
                      <span style={errorTextStyle}>{getFieldError('groupName')}</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Contact Person *
                    <input
                      type="text"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                      style={inputBorderStyle('contactPerson')}
                    />
                    {getFieldError('contactPerson') && (
                      <span style={errorTextStyle}>{getFieldError('contactPerson')}</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Contact Email *
                    <input
                      type="email"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                      style={inputBorderStyle('contactEmail')}
                    />
                    {getFieldError('contactEmail') && (
                      <span style={errorTextStyle}>{getFieldError('contactEmail')}</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Contact Phone *
                    <input
                      type="tel"
                      value={formData.contactPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                      style={inputBorderStyle('contactPhone')}
                    />
                    {getFieldError('contactPhone') && (
                      <span style={errorTextStyle}>{getFieldError('contactPhone')}</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Expected Guests
                    <input
                      type="number"
                      min={0}
                      value={formData.expectedGuests}
                      onChange={(e) => setFormData(prev => ({ ...prev, expectedGuests: e.target.value }))}
                      style={{ marginTop: '0.35rem', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Check-In Date *
                    <input
                      type="date"
                      value={formData.checkInDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, checkInDate: e.target.value }))}
                      style={inputBorderStyle('checkInDate')}
                    />
                    {getFieldError('checkInDate') && (
                      <span style={errorTextStyle}>{getFieldError('checkInDate')}</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Check-Out Date *
                    <input
                      type="date"
                      value={formData.checkOutDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, checkOutDate: e.target.value }))}
                      style={inputBorderStyle('checkOutDate')}
                    />
                    {getFieldError('checkOutDate') && (
                      <span style={errorTextStyle}>{getFieldError('checkOutDate')}</span>
                    )}
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.85rem', color: '#475569' }}>
                    Deposit Amount
                    <input
                      type="number"
                      min={0}
                      value={formData.depositAmount}
                      onChange={(e) => setFormData(prev => ({ ...prev, depositAmount: e.target.value }))}
                      style={{ marginTop: '0.35rem', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                    />
                  </label>
                </div>
                <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <textarea
                    placeholder="Special requests"
                    value={formData.specialRequests}
                    onChange={(e) => setFormData(prev => ({ ...prev, specialRequests: e.target.value }))}
                    style={{ minHeight: '70px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                  />
                  <textarea
                    placeholder="Dietary requirements"
                    value={formData.dietaryRequirements}
                    onChange={(e) => setFormData(prev => ({ ...prev, dietaryRequirements: e.target.value }))}
                    style={{ minHeight: '70px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                  />
                  <textarea
                    placeholder="Setup requirements"
                    value={formData.setupRequirements}
                    onChange={(e) => setFormData(prev => ({ ...prev, setupRequirements: e.target.value }))}
                    style={{ minHeight: '70px', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                  />
                </div>
              </section>

              {/* Room Blocks */}
              <section style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Room Blocks</h3>
                  <Button
                    onClick={handleAddRoomBlock}
                    disabled={loadingRoomMeta}
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', opacity: loadingRoomMeta ? 0.6 : 1 }}
                  >
                    + Add Block
                  </Button>
                </div>
                {loadingRoomMeta && (
                  <div style={{ color: '#64748b', marginBottom: '0.75rem' }}>Loading room categories and inventory...</div>
                )}
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {shouldShowErrors && validationErrors.fields.roomBlocks && (
                    <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                      {validationErrors.fields.roomBlocks}
                    </div>
                  )}
                  {formData.roomBlocks.map((block, index) => (
                    <div key={block.id} style={{ border: '1px solid #cbd5f5', borderRadius: '10px', padding: '1rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <select
                            value={block.roomCategoryId}
                            onChange={(e) => handleUpdateRoomBlock(index, 'roomCategoryId', e.target.value)}
                            style={roomBlockInputStyle(index, 'roomCategoryId')}
                          >
                            <option value="">Select category</option>
                            {roomCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          {shouldShowErrors && validationErrors.roomBlocks[index]?.roomCategoryId && (
                            <span style={errorTextStyle}>{validationErrors.roomBlocks[index]?.roomCategoryId}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <select
                            value={block.roomType}
                            onChange={(e) => handleUpdateRoomBlock(index, 'roomType', e.target.value)}
                            style={roomBlockInputStyle(index, 'roomType')}
                          >
                            <option value="">Select room type</option>
                            {roomTypes.map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          {shouldShowErrors && validationErrors.roomBlocks[index]?.roomType && (
                            <span style={errorTextStyle}>{validationErrors.roomBlocks[index]?.roomType}</span>
                          )}
                        </div>
                        <input
                          type="number"
                          min={1}
                          placeholder="Total Rooms"
                          value={block.totalRooms}
                          onChange={(e) => handleUpdateRoomBlock(index, 'totalRooms', e.target.value)}
                          style={roomBlockInputStyle(index, 'totalRooms')}
                        />
                        {shouldShowErrors && validationErrors.roomBlocks[index]?.totalRooms && (
                          <span style={errorTextStyle}>{validationErrors.roomBlocks[index]?.totalRooms}</span>
                        )}
                        <input
                          type="number"
                          placeholder="Negotiated Rate"
                          value={block.negotiatedRate ?? ''}
                          onChange={(e) => handleUpdateRoomBlock(index, 'negotiatedRate', e.target.value)}
                          style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                        />
                        <input
                          type="number"
                          placeholder="Discount %"
                          value={block.discountPercent ?? ''}
                          onChange={(e) => handleUpdateRoomBlock(index, 'discountPercent', e.target.value)}
                          style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                        />
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>
                          Inventory:&nbsp;
                          {getInventoryCount(block.roomCategoryId, block.roomType)}
                        </span>
                        &nbsp;rooms
                        {block.roomCategoryId && (
                          <>
                            &nbsp;in {getCategoryName(block.roomCategoryId)}
                            {block.roomType ? ` (${block.roomType})` : ''}
                          </>
                        )}
                      </div>
                      {formData.roomBlocks.length > 1 && (
                        <button
                          onClick={() => handleRemoveRoomBlock(index)}
                          style={{
                            marginTop: '0.75rem',
                            border: 'none',
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Remove block
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Hall Reservations */}
              <section style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Meeting Hall Reservations</h3>
                  <Button
                    onClick={handleAddHallReservation}
                    disabled={!meetingHalls.length || loadingHalls}
                    style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem', opacity: meetingHalls.length ? 1 : 0.6 }}
                  >
                    + Add Hall
                  </Button>
                </div>
                {loadingHalls ? (
                  <div style={{ color: '#64748b' }}>Loading halls...</div>
                ) : meetingHalls.length === 0 ? (
                  <div style={{ color: '#94a3b8' }}>No halls available for this tenant.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {formData.hallReservations.map((reservation, index) => (
                      <div key={reservation.id} style={{ border: '1px solid #cbd5f5', borderRadius: '10px', padding: '1rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                          <select
                            value={reservation.hallId}
                            onChange={(e) => handleUpdateHallReservation(index, 'hallId', e.target.value)}
                            style={hallReservationInputStyle(index, 'hallId')}
                          >
                            {meetingHalls.map(hall => (
                              <option key={hall.id} value={hall.id}>
                                {hall.name} (cap {hall.capacity})
                              </option>
                            ))}
                          </select>
                          {shouldShowErrors && validationErrors.hallReservations[index]?.hallId && (
                            <span style={errorTextStyle}>{validationErrors.hallReservations[index]?.hallId}</span>
                          )}
                          <input
                            type="text"
                            placeholder="Event Name"
                            value={reservation.eventName || ''}
                            onChange={(e) => handleUpdateHallReservation(index, 'eventName', e.target.value)}
                            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                          />
                          <input
                            type="text"
                            placeholder="Purpose"
                            value={reservation.purpose || ''}
                            onChange={(e) => handleUpdateHallReservation(index, 'purpose', e.target.value)}
                            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                          />
                          <input
                            type="text"
                            placeholder="Setup Type"
                            value={reservation.setupType || ''}
                            onChange={(e) => handleUpdateHallReservation(index, 'setupType', e.target.value)}
                            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                          />
                          <input
                            type="number"
                            min={0}
                            placeholder="Attendees"
                            value={reservation.attendeeCount ?? ''}
                            onChange={(e) => handleUpdateHallReservation(index, 'attendeeCount', e.target.value)}
                            style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5f5' }}
                          />
                          <input
                            type="datetime-local"
                            value={reservation.startDateTime}
                            onChange={(e) => handleUpdateHallReservation(index, 'startDateTime', e.target.value)}
                            style={hallReservationInputStyle(index, 'startDateTime')}
                          />
                          {shouldShowErrors && validationErrors.hallReservations[index]?.startDateTime && (
                            <span style={errorTextStyle}>{validationErrors.hallReservations[index]?.startDateTime}</span>
                          )}
                          <input
                            type="datetime-local"
                            value={reservation.endDateTime}
                            onChange={(e) => handleUpdateHallReservation(index, 'endDateTime', e.target.value)}
                            style={hallReservationInputStyle(index, 'endDateTime')}
                          />
                          {shouldShowErrors && validationErrors.hallReservations[index]?.endDateTime && (
                            <span style={errorTextStyle}>{validationErrors.hallReservations[index]?.endDateTime}</span>
                          )}
                        </div>
                        <textarea
                          placeholder="Catering notes"
                          value={reservation.cateringNotes || ''}
                          onChange={(e) => handleUpdateHallReservation(index, 'cateringNotes', e.target.value)}
                          style={{ marginTop: '0.75rem', width: '100%', minHeight: '60px', borderRadius: '8px', border: '1px solid #cbd5f5', padding: '0.6rem' }}
                        />
                        <textarea
                          placeholder="AV requirements"
                          value={reservation.avRequirements || ''}
                          onChange={(e) => handleUpdateHallReservation(index, 'avRequirements', e.target.value)}
                          style={{ marginTop: '0.5rem', width: '100%', minHeight: '60px', borderRadius: '8px', border: '1px solid #cbd5f5', padding: '0.6rem' }}
                        />
                        <button
                          onClick={() => handleRemoveHallReservation(index)}
                          style={{
                            marginTop: '0.75rem',
                            border: 'none',
                            background: 'transparent',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          Remove hall reservation
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  onClick={closeCreateModal}
                  style={{
                    border: '1px solid #cbd5f5',
                    background: '#fff',
                    padding: '0.75rem 1.25rem',
                    borderRadius: '999px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBooking}
                  disabled={createDisabled}
                  style={{
                    border: 'none',
                    background: createDisabled ? '#475569' : '#0f172a',
                    color: '#fff',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '999px',
                    cursor: 'pointer',
                    opacity: createDisabled ? 0.7 : 1,
                  }}
                >
                  {saving ? 'Saving...' : 'Create Booking'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
