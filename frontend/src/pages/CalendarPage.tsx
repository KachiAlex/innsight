import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { format, addDays, subDays, startOfDay, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';

type CalendarAvailabilityStatus = 'available' | 'occupied' | 'check_in' | 'check_out' | 'blocked';

interface CategorySummary {
  id: string;
  name: string;
  color: string;
  roomCount: number;
  minRate: number | null;
  maxRate: number | null;
}

interface CalendarData {
  startDate: string;
  endDate: string;
  categories: CategorySummary[];
  rooms: Array<{
    room: {
      id: string;
      roomNumber: string;
      roomType: string;
      status: string;
      maxOccupancy: number;
      category?: {
        id: string;
        name: string;
        color: string;
      } | null;
      pricing: {
        nightlyRate: number | null;
        source: 'custom' | 'rate_plan' | 'base' | 'none';
      };
    };
    availability: Array<{
      date: string;
      status: CalendarAvailabilityStatus;
      reservation: {
        id: string;
        guestName: string;
        checkInDate: Date;
        checkOutDate: Date;
        status: string;
        rate: number;
        groupBookingId?: string | null;
        groupBooking?: {
          id: string;
          groupBookingNumber: string;
          groupName?: string | null;
          totalRooms: number;
        } | null;
      } | null;
    }>;
  }>;
}

export default function CalendarPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStartDate, setCurrentStartDate] = useState(startOfDay(new Date()));
  const [daysToShow, setDaysToShow] = useState(14); // Show 2 weeks by default
  const [selectedReservation, setSelectedReservation] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    roomType: '',
    status: '',
    categoryId: '',
  });
  const [draggedReservation, setDraggedReservation] = useState<{
    reservationId: string;
    roomId: string;
    checkInDate: Date;
    checkOutDate: Date;
  } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalData, setCreateModalData] = useState<{
    roomId: string;
    checkInDate: string;
    checkOutDate: string;
  } | null>(null);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchCalendar();
    fetchRooms();
  }, [user, currentStartDate, daysToShow, filters]);

  const fetchRooms = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    }
  };

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const endDate = addDays(currentStartDate, daysToShow - 1);
      const params: any = {
        startDate: format(currentStartDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      };
      if (filters.roomType) params.roomType = filters.roomType;
      if (filters.status) params.status = filters.status;
      if (filters.categoryId) params.categoryId = filters.categoryId;

      const response = await api.get(`/tenants/${user?.tenantId}/calendar`, { params });
      setCalendarData(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch calendar:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch calendar');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentStartDate(subDays(currentStartDate, daysToShow));
  };

  const handleNext = () => {
    setCurrentStartDate(addDays(currentStartDate, daysToShow));
  };

  const handleToday = () => {
    setCurrentStartDate(startOfDay(new Date()));
  };

  const handleDragStart = (e: React.DragEvent, reservation: any, roomId: string) => {
    if (reservation.status === 'checked_out' || reservation.status === 'cancelled') {
      e.preventDefault();
      return;
    }
    setDraggedReservation({
      reservationId: reservation.id,
      roomId,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
    });
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetRoomId: string, targetDate: Date) => {
    e.preventDefault();
    if (!draggedReservation) return;

    try {
      const nights = Math.ceil(
        (draggedReservation.checkOutDate.getTime() - draggedReservation.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newCheckInDate = startOfDay(targetDate);
      const newCheckOutDate = addDays(newCheckInDate, nights);

      await api.post(`/tenants/${user?.tenantId}/calendar/move-reservation`, {
        reservationId: draggedReservation.reservationId,
        newRoomId: targetRoomId,
        newCheckInDate: newCheckInDate.toISOString(),
        newCheckOutDate: newCheckOutDate.toISOString(),
      });

      toast.success('Reservation moved successfully');
      fetchCalendar();
    } catch (error: any) {
      console.error('Failed to move reservation:', error);
      toast.error(error.response?.data?.message || 'Failed to move reservation');
    } finally {
      setDraggedReservation(null);
    }
  };

  const handleCellClick = (roomId: string, date: Date, day: any) => {
    if (day.status === 'available' && !day.reservation) {
      const nextDay = addDays(date, 1);
      setCreateModalData({
        roomId,
        checkInDate: format(date, "yyyy-MM-dd'T'HH:mm"),
        checkOutDate: format(nextDay, "yyyy-MM-dd'T'HH:mm"),
      });
      setShowCreateModal(true);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: '#d1fae5', // green-100
      occupied: '#dbeafe', // blue-100
      check_in: '#fef3c7', // yellow-100
      check_out: '#fce7f3', // pink-100
      blocked: '#fee2e2', // red-100
    };
    return colors[status] || '#f3f4f6';
  };

  const getStatusBorderColor = (status: string) => {
    const colors: Record<string, string> = {
      available: '#10b981', // green-500
      occupied: '#3b82f6', // blue-500
      check_in: '#f59e0b', // yellow-500
      check_out: '#ec4899', // pink-500
      blocked: '#ef4444', // red-500
    };
    return colors[status] || '#9ca3af';
  };

  const getStatusTextColor = (status: string) => {
    const colors: Record<string, string> = {
      available: '#065f46', // green-800
      occupied: '#1e40af', // blue-800
      check_in: '#92400e', // yellow-800
      check_out: '#9f1239', // pink-800
      blocked: '#991b1b', // red-800
    };
    return colors[status] || '#374151';
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <CardSkeleton count={3} />
        </div>
      </Layout>
    );
  }

  if (!calendarData) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <CalendarIcon size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: '#64748b' }} />
          <p style={{ color: '#64748b' }}>No calendar data available</p>
        </div>
      </Layout>
    );
  }

  const dates = eachDayOfInterval({
    start: parseISO(calendarData.startDate),
    end: parseISO(calendarData.endDate),
  });

  return (
    <Layout>
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ color: '#1e293b' }}>Room Calendar</h1>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowFilters(!showFilters)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Filter size={16} />
              Filters
            </button>
            <select
              value={daysToShow}
              onChange={(e) => setDaysToShow(Number(e.target.value))}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </select>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                Room Type
              </label>
              <select
                value={filters.roomType}
                onChange={(e) => setFilters({ ...filters, roomType: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  minWidth: '150px',
                }}
              >
                <option value="">All Types</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="suite">Suite</option>
                <option value="deluxe">Deluxe</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                Room Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  minWidth: '150px',
                }}
              >
                <option value="">All Statuses</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="dirty">Dirty</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
                Category
              </label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  minWidth: '150px',
                }}
              >
                <option value="">All Categories</option>
                {calendarData?.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setFilters({ roomType: '', status: '', categoryId: '' })}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
                alignSelf: 'flex-end',
              }}
            >
              Clear Filters
            </button>
          </div>
        )}

        {/* Date Navigation */}
        <div
          style={{
            background: 'white',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button
            onClick={handlePrevious}
            style={{
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>
              {format(parseISO(calendarData.startDate), 'MMM d')} - {format(parseISO(calendarData.endDate), 'MMM d, yyyy')}
            </span>
            <button
              onClick={handleToday}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: '#f8fafc',
                color: '#64748b',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Today
            </button>
          </div>
          <button
            onClick={handleNext}
            style={{
              padding: '0.5rem',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              background: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Calendar Grid */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            overflow: 'auto',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(${dates.length}, minmax(120px, 1fr))`, minWidth: 'max-content' }}>
            {/* Header Row */}
            <div
              style={{
                padding: '1rem',
                background: '#f8fafc',
                borderBottom: '2px solid #e2e8f0',
                fontWeight: '600',
                color: '#1e293b',
                position: 'sticky',
                left: 0,
                zIndex: 10,
              }}
            >
              Room
            </div>
            {dates.map((date) => (
              <div
                key={date.toISOString()}
                style={{
                  padding: '1rem 0.5rem',
                  background: '#f8fafc',
                  borderBottom: '2px solid #e2e8f0',
                  borderLeft: '1px solid #e2e8f0',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#1e293b',
                }}
              >
                <div style={{ fontSize: '0.875rem' }}>{format(date, 'EEE')}</div>
                <div style={{ fontSize: '1.125rem' }}>{format(date, 'd')}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{format(date, 'MMM')}</div>
              </div>
            ))}

            {/* Room Rows */}
            {calendarData.rooms.map((roomData) => (
              <div key={roomData.room.id} style={{ display: 'contents' }}>
                {/* Room Name Column */}
                <div
                  style={{
                    padding: '1rem',
                    background: 'white',
                    borderBottom: '1px solid #e2e8f0',
                    borderRight: '1px solid #e2e8f0',
                    position: 'sticky',
                    left: 0,
                    zIndex: 5,
                  }}
                >
                  <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                    {roomData.room.roomNumber}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span>{roomData.room.roomType}</span>
                    {roomData.room.category && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: roomData.room.category.color,
                            display: 'inline-block',
                          }}
                        />
                        {roomData.room.category.name}
                      </span>
                    )}
                    {roomData.room.pricing.nightlyRate !== null && (
                      <span style={{ fontWeight: 600, color: '#1e293b' }}>
                        ₦{roomData.room.pricing.nightlyRate.toLocaleString()} / night
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '12px',
                      display: 'inline-block',
                      marginTop: '0.25rem',
                      background: getStatusColor(roomData.room.status),
                      color: getStatusTextColor(roomData.room.status),
                    }}
                  >
                    {roomData.room.status}
                  </div>
                </div>

                {/* Date Cells */}
                {roomData.availability.map((day) => {
                  const isToday = isSameDay(parseISO(day.date), new Date());
                  const date = parseISO(day.date);
                  const canDrop = draggedReservation && 
                    day.status === 'available' && 
                    !day.reservation &&
                    draggedReservation.roomId !== roomData.room.id;
                  
                  return (
                    <div
                      key={day.date}
                      draggable={!!(day.reservation && (day.reservation.status === 'confirmed' || day.reservation.status === 'checked_in'))}
                      onDragStart={(e) => day.reservation && handleDragStart(e, day.reservation, roomData.room.id)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, roomData.room.id, date)}
                      onClick={() => {
                        if (day.reservation) {
                          setSelectedReservation(day.reservation);
                        } else {
                          handleCellClick(roomData.room.id, date, day);
                        }
                      }}
                      style={{
                        padding: '0.5rem',
                        borderBottom: '1px solid #e2e8f0',
                        borderLeft: isToday ? '3px solid #3b82f6' : '1px solid #e2e8f0',
                        minHeight: '80px',
                        background: canDrop ? '#dbeafe' : getStatusColor(day.status),
                        cursor: day.reservation || day.status === 'available' ? 'pointer' : 'default',
                        position: 'relative',
                        opacity: draggedReservation && draggedReservation.reservationId === day.reservation?.id ? '0.5' : '1',
                      }}
                      onMouseEnter={(e) => {
                        if (day.reservation || day.status === 'available') {
                          e.currentTarget.style.opacity = '0.8';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = draggedReservation && draggedReservation.reservationId === day.reservation?.id ? '0.5' : '1';
                      }}
                    >
                      {day.reservation && (
                        <div>
                          <div
                            style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '4px',
                              background: day.reservation.groupBookingId ? '#8b5cf6' : getStatusBorderColor(day.status),
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              marginBottom: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            {day.reservation.groupBookingId && (
                              <Users size={12} style={{ flexShrink: 0 }} />
                            )}
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {day.reservation.guestName}
                            </span>
                          </div>
                          {day.reservation.groupBooking && (
                            <div
                              style={{
                                fontSize: '0.625rem',
                                color: '#6b21a8',
                                fontWeight: '500',
                                marginTop: '0.125rem',
                                padding: '0.125rem 0.375rem',
                                background: '#f3e8ff',
                                borderRadius: '3px',
                                display: 'inline-block',
                              }}
                              title={`Group: ${day.reservation.groupBooking.groupName || day.reservation.groupBooking.groupBookingNumber} (${day.reservation.groupBooking.totalRooms} rooms)`}
                            >
                              Group ({day.reservation.groupBooking.totalRooms})
                            </div>
                          )}
                        </div>
                      )}
                      {day.status === 'check_in' && (
                        <div style={{ fontSize: '0.625rem', color: '#92400e', fontWeight: '500' }}>Check-in</div>
                      )}
                      {day.status === 'check_out' && (
                        <div style={{ fontSize: '0.625rem', color: '#9f1239', fontWeight: '500' }}>Check-out</div>
                      )}
                      {day.status === 'blocked' && (
                        <div style={{ fontSize: '0.625rem', color: '#991b1b', fontWeight: '500' }}>Blocked</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'white',
            borderRadius: '8px',
            display: 'flex',
            gap: '1.5rem',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#d1fae5', borderRadius: '4px' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Available</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#dbeafe', borderRadius: '4px' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Occupied</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#fef3c7', borderRadius: '4px' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Check-in</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#fce7f3', borderRadius: '4px' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Check-out</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#fee2e2', borderRadius: '4px' }} />
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Blocked</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '20px', height: '20px', background: '#8b5cf6', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={12} color="white" />
            </div>
            <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Group Booking</span>
          </div>
        </div>

        {/* Reservation Details Modal */}
        {selectedReservation && (
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
            onClick={() => setSelectedReservation(null)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '500px',
                width: '90%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ margin: '0 0 1rem', color: '#1e293b' }}>Reservation Details</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Guest</div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>{selectedReservation.guestName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Check-in</div>
                  <div style={{ color: '#1e293b' }}>{format(selectedReservation.checkInDate, 'MMM d, yyyy')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Check-out</div>
                  <div style={{ color: '#1e293b' }}>{format(selectedReservation.checkOutDate, 'MMM d, yyyy')}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Rate</div>
                  <div style={{ fontWeight: '600', color: '#1e293b' }}>₦{selectedReservation.rate.toLocaleString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.25rem' }}>Status</div>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      background: getStatusColor(selectedReservation.status),
                      color: getStatusTextColor(selectedReservation.status),
                    }}
                  >
                    {selectedReservation.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                {selectedReservation.groupBooking && (
                  <div
                    style={{
                      padding: '0.75rem',
                      background: '#f3e8ff',
                      borderRadius: '6px',
                      border: '1px solid #c084fc',
                    }}
                  >
                    <div style={{ fontSize: '0.875rem', color: '#6b21a8', marginBottom: '0.5rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Users size={16} />
                      Group Booking
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#7c3aed', marginBottom: '0.25rem' }}>
                      {selectedReservation.groupBooking.groupName || selectedReservation.groupBooking.groupBookingNumber}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#a855f7' }}>
                      {selectedReservation.groupBooking.totalRooms} room{selectedReservation.groupBooking.totalRooms !== 1 ? 's' : ''} in this group
                    </div>
                    <button
                      onClick={() => {
                        setSelectedReservation(null);
                        navigate(`/group-bookings?highlight=${selectedReservation.groupBooking.id}`);
                      }}
                      style={{
                        marginTop: '0.75rem',
                        padding: '0.5rem 1rem',
                        border: '1px solid #c084fc',
                        borderRadius: '4px',
                        background: 'white',
                        color: '#7c3aed',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        width: '100%',
                      }}
                    >
                      View Group Booking
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  onClick={() => setSelectedReservation(null)}
                  style={{
                    flex: 1,
                    padding: '0.75rem 1.5rem',
                    border: 'none',
                    borderRadius: '6px',
                    background: '#3b82f6',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Create Reservation Modal */}
        {showCreateModal && createModalData && (
          <QuickCreateReservationModal
            roomId={createModalData.roomId}
            checkInDate={createModalData.checkInDate}
            checkOutDate={createModalData.checkOutDate}
            rooms={rooms}
            onClose={() => {
              setShowCreateModal(false);
              setCreateModalData(null);
            }}
            onSuccess={() => {
              setShowCreateModal(false);
              setCreateModalData(null);
              fetchCalendar();
            }}
          />
        )}
      </div>
    </Layout>
  );
}

function QuickCreateReservationModal({
  roomId,
  checkInDate,
  checkOutDate,
  rooms,
  onClose,
  onSuccess,
}: {
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  rooms: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    roomId,
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkInDate,
    checkOutDate,
    adults: 1,
    children: 0,
    rate: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guestName || !formData.rate) {
      toast.error('Please fill in guest name and rate');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/reservations`, {
        ...formData,
        rate: parseFloat(formData.rate),
        checkInDate: new Date(formData.checkInDate).toISOString(),
        checkOutDate: new Date(formData.checkOutDate).toISOString(),
      });
      toast.success('Reservation created successfully');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create reservation:', error);
      toast.error(error.response?.data?.message || 'Failed to create reservation');
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
          maxWidth: '500px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 1.5rem', color: '#1e293b' }}>Quick Create Reservation</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.roomNumber} - {room.roomType}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Adults
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.adults}
                  onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 1 })}
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
                  min="0"
                  value={formData.children}
                  onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Rate (₦) *
              </label>
              <input
                type="number"
                step="0.01"
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
                Guest Email
              </label>
              <input
                type="email"
                value={formData.guestEmail}
                onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
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
                Guest Phone
              </label>
              <input
                type="tel"
                value={formData.guestPhone}
                onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
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
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  borderRadius: '6px',
                  background: '#3b82f6',
                  color: 'white',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
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

