import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays, subDays, startOfDay, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  DetailDrawer,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusBadge,
  TextInput,
} from '../components/ui';
import { formatMoney } from '../lib/money';
import { useTenantSettings } from '../hooks/useTenantSettings';
import styles from './CalendarPage.module.css';

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

const CELL_CLASS: Record<string, string> = {
  available: styles.cellAvailable,
  occupied: styles.cellOccupied,
  check_in: styles.cellCheckIn,
  check_out: styles.cellCheckOut,
  blocked: styles.cellBlocked,
};

const CHIP_CLASS: Record<string, string> = {
  occupied: styles.resOccupied,
  check_in: styles.resCheckIn,
  check_out: styles.resCheckOut,
};

export default function CalendarPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const settings = useTenantSettings();
  const currency = settings.currencySymbol;
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStartDate, setCurrentStartDate] = useState(startOfDay(new Date()));
  const [daysToShow, setDaysToShow] = useState(14);
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
      toast.error(error.response?.data?.error?.message || 'Failed to fetch calendar');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => setCurrentStartDate(subDays(currentStartDate, daysToShow));
  const handleNext = () => setCurrentStartDate(addDays(currentStartDate, daysToShow));
  const handleToday = () => setCurrentStartDate(startOfDay(new Date()));

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
        (draggedReservation.checkOutDate.getTime() - draggedReservation.checkInDate.getTime()) / 86400000
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
      toast.error(error.response?.data?.error?.message || 'Failed to move reservation');
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

  if (loading && !calendarData) {
    return (
      <Layout>
        <PageHeader title="Room calendar" />
        <Skeleton height="420px" />
      </Layout>
    );
  }

  if (!calendarData) {
    return (
      <Layout>
        <PageHeader title="Room calendar" />
        <EmptyState
          icon={<CalendarIcon size={28} strokeWidth={1.6} />}
          title="No calendar data available"
          action={<Button variant="secondary" onClick={fetchCalendar}>Reload</Button>}
        />
      </Layout>
    );
  }

  const dates = eachDayOfInterval({
    start: parseISO(calendarData.startDate),
    end: parseISO(calendarData.endDate),
  });

  return (
    <Layout>
      <PageHeader
        title="Room calendar"
        subtitle="Drag reservations between available cells to move them"
        actions={
          <div className="row">
            <Button variant="secondary" onClick={() => setShowFilters(!showFilters)}>
              Filters
            </Button>
            <Select
              value={daysToShow}
              onChange={(e) => setDaysToShow(Number(e.target.value))}
              aria-label="Days to show"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
            </Select>
          </div>
        }
      />

      {showFilters && (
        <Panel style={{ marginBottom: 'var(--space-4)' }}>
          <div className="grid3">
            <Field label="Room type">
              <Select
                value={filters.roomType}
                onChange={(e) => setFilters({ ...filters, roomType: e.target.value })}
              >
                <option value="">All types</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="suite">Suite</option>
                <option value="deluxe">Deluxe</option>
              </Select>
            </Field>
            <Field label="Room status">
              <Select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="dirty">Dirty</option>
                <option value="maintenance">Maintenance</option>
              </Select>
            </Field>
            <Field label="Category">
              <Select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
              >
                <option value="">All categories</option>
                {calendarData.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div style={{ marginTop: 'var(--space-3)' }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFilters({ roomType: '', status: '', categoryId: '' })}
            >
              Clear filters
            </Button>
          </div>
        </Panel>
      )}

      <div className={styles.navBar}>
        <Button variant="secondary" icon={<ChevronLeft size={18} />} onClick={handlePrevious} aria-label="Previous period" />
        <div className={styles.navLabel}>
          <span>
            {format(parseISO(calendarData.startDate), 'MMM d')} –{' '}
            {format(parseISO(calendarData.endDate), 'MMM d, yyyy')}
          </span>
          <Button size="sm" variant="ghost" onClick={handleToday}>
            Today
          </Button>
        </div>
        <Button variant="secondary" icon={<ChevronRight size={18} />} onClick={handleNext} aria-label="Next period" />
      </div>

      <div className={styles.chartWrap}>
        <div
          className={styles.grid}
          style={{ gridTemplateColumns: `200px repeat(${dates.length}, minmax(120px, 1fr))` }}
        >
          <div className={styles.cornerCell}>Room</div>
          {dates.map((date) => (
            <div
              key={date.toISOString()}
              className={`${styles.headCell} ${isSameDay(date, new Date()) ? styles.headToday : ''}`}
            >
              <div className={styles.headDow}>{format(date, 'EEE')}</div>
              <div className={styles.headDay}>{format(date, 'd')}</div>
              <div className={styles.headMonth}>{format(date, 'MMM')}</div>
            </div>
          ))}

          {calendarData.rooms.map((roomData) => (
            <div key={roomData.room.id} style={{ display: 'contents' }}>
              <div className={styles.roomCell}>
                <div className={styles.roomNum}>{roomData.room.roomNumber}</div>
                <div className={styles.roomMeta}>
                  <span>{roomData.room.roomType}</span>
                  {roomData.room.category && (
                    <span className={styles.catDot}>
                      <i style={{ background: roomData.room.category.color }} />
                      {roomData.room.category.name}
                    </span>
                  )}
                  {roomData.room.pricing.nightlyRate !== null && (
                    <span className={styles.roomRate}>
                      {formatMoney(roomData.room.pricing.nightlyRate, currency)} / night
                    </span>
                  )}
                </div>
                <div style={{ marginTop: 'var(--space-1)' }}>
                  <StatusBadge status={roomData.room.status} />
                </div>
              </div>

              {roomData.availability.map((day) => {
                const isToday = isSameDay(parseISO(day.date), new Date());
                const date = parseISO(day.date);
                const isDraggingThis =
                  draggedReservation && draggedReservation.reservationId === day.reservation?.id;
                const canDrop =
                  !!draggedReservation &&
                  day.status === 'available' &&
                  !day.reservation &&
                  draggedReservation.roomId !== roomData.room.id;

                return (
                  <div
                    key={day.date}
                    draggable={
                      !!(
                        day.reservation &&
                        (day.reservation.status === 'confirmed' ||
                          day.reservation.status === 'checked_in')
                      )
                    }
                    onDragStart={(e) =>
                      day.reservation && handleDragStart(e, day.reservation, roomData.room.id)
                    }
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, roomData.room.id, date)}
                    onClick={() => {
                      if (day.reservation) {
                        setSelectedReservation(day.reservation);
                      } else {
                        handleCellClick(roomData.room.id, date, day);
                      }
                    }}
                    className={[
                      styles.cell,
                      CELL_CLASS[day.status] ?? '',
                      isToday ? styles.cellToday : '',
                      isDraggingThis ? styles.cellDragging : '',
                      canDrop ? styles.cellDropTarget : '',
                    ].join(' ')}
                  >
                    {day.reservation && (
                      <div>
                        <div
                          className={`${styles.resChip} ${
                            day.reservation.groupBookingId
                              ? styles.resGroup
                              : CHIP_CLASS[day.status] ?? styles.resOccupied
                          }`}
                        >
                          {day.reservation.groupBookingId && <Users size={11} />}
                          <span>{day.reservation.guestName}</span>
                        </div>
                        {day.reservation.groupBooking && (
                          <div
                            className={styles.groupTag}
                            title={`Group: ${
                              day.reservation.groupBooking.groupName ||
                              day.reservation.groupBooking.groupBookingNumber
                            } (${day.reservation.groupBooking.totalRooms} rooms)`}
                          >
                            Group ({day.reservation.groupBooking.totalRooms})
                          </div>
                        )}
                      </div>
                    )}
                    {day.status === 'check_in' && (
                      <div className={`${styles.dayLabel} ${styles.dayLabelIn}`}>Check-in</div>
                    )}
                    {day.status === 'check_out' && (
                      <div className={`${styles.dayLabel} ${styles.dayLabelOut}`}>Check-out</div>
                    )}
                    {day.status === 'blocked' && (
                      <div className={`${styles.dayLabel} ${styles.dayLabelOut}`}>Blocked</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <div className={styles.legendSwatch} style={{ background: 'var(--success-bg)' }} />
          Available
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendSwatch} style={{ background: 'var(--info-bg)' }} />
          Occupied
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendSwatch} style={{ background: 'var(--warning-bg)' }} />
          Check-in
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendSwatch} style={{ background: 'var(--danger-bg)' }} />
          Check-out / Blocked
        </div>
        <div className={styles.legendItem}>
          <div className={styles.legendSwatch} style={{ background: '#7c5cc4', color: '#fff' }}>
            <Users size={11} />
          </div>
          Group booking
        </div>
      </div>

      <DetailDrawer
        open={!!selectedReservation}
        onClose={() => setSelectedReservation(null)}
        title="Reservation details"
        headerExtra={
          selectedReservation ? <StatusBadge status={selectedReservation.status} /> : undefined
        }
        footer={
          selectedReservation ? (
            <Button variant="primary" onClick={() => setSelectedReservation(null)}>
              Close
            </Button>
          ) : undefined
        }
      >
        {selectedReservation && (
          <div className="stack">
            <DetailField label="Guest" value={selectedReservation.guestName} strong />
            <DetailField
              label="Check-in"
              value={format(new Date(selectedReservation.checkInDate), 'MMM d, yyyy')}
            />
            <DetailField
              label="Check-out"
              value={format(new Date(selectedReservation.checkOutDate), 'MMM d, yyyy')}
            />
            <DetailField
              label="Nightly rate"
              value={formatMoney(Number(selectedReservation.rate), currency)}
              strong
            />
            {selectedReservation.groupBooking && (
              <div className={styles.groupBanner}>
                <div className={styles.groupBannerTitle}>
                  <Users size={15} /> Group booking
                </div>
                <div className={styles.groupBannerSub}>
                  {selectedReservation.groupBooking.groupName ||
                    selectedReservation.groupBooking.groupBookingNumber}
                </div>
                <div className={styles.groupBannerMeta}>
                  {selectedReservation.groupBooking.totalRooms} room
                  {selectedReservation.groupBooking.totalRooms !== 1 ? 's' : ''} in this group
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  style={{ marginTop: 'var(--space-3)', width: '100%' }}
                  onClick={() => {
                    setSelectedReservation(null);
                    navigate(`/group-bookings?highlight=${selectedReservation.groupBooking.id}`);
                  }}
                >
                  View group booking
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      <QuickCreateReservationModal
        open={showCreateModal && !!createModalData}
        roomId={createModalData?.roomId ?? ''}
        checkInDate={createModalData?.checkInDate ?? ''}
        checkOutDate={createModalData?.checkOutDate ?? ''}
        rooms={rooms}
        currency={currency}
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
    </Layout>
  );
}

function DetailField({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <div className="text-xs muted" style={{ marginBottom: '2px' }}>{label}</div>
      <div style={strong ? { fontWeight: 700, color: 'var(--text)' } : { color: 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

function QuickCreateReservationModal({
  open,
  roomId,
  checkInDate,
  checkOutDate,
  rooms,
  currency,
  onClose,
  onSuccess,
}: {
  open: boolean;
  roomId: string;
  checkInDate: string;
  checkOutDate: string;
  rooms: any[];
  currency: string;
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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData((prev) => ({ ...prev, roomId, checkInDate, checkOutDate }));
  }, [roomId, checkInDate, checkOutDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guestName || !formData.rate) {
      toast.error('Please fill in guest name and rate');
      return;
    }

    setSaving(true);
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
      toast.error(error.response?.data?.error?.message || 'Failed to create reservation');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick reservation"
      subtitle="Create a booking for the selected room and dates"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>
            Create reservation
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="stack">
        <Field label="Room" required>
          <Select
            value={formData.roomId}
            onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
            required
          >
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber} — {room.roomType}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Guest name" required>
          <TextInput
            value={formData.guestName}
            onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
            required
          />
        </Field>
        <div className="grid2">
          <Field label="Check-in" required>
            <TextInput
              type="datetime-local"
              value={formData.checkInDate}
              onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
              required
            />
          </Field>
          <Field label="Check-out" required>
            <TextInput
              type="datetime-local"
              value={formData.checkOutDate}
              onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
              required
            />
          </Field>
        </div>
        <div className="grid2">
          <Field label="Adults">
            <TextInput
              type="number"
              min={1}
              value={formData.adults}
              onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 1 })}
            />
          </Field>
          <Field label="Children">
            <TextInput
              type="number"
              min={0}
              value={formData.children}
              onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <Field label={`Nightly rate (${currency})`} required>
          <TextInput
            type="number"
            step="0.01"
            value={formData.rate}
            onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
            required
          />
        </Field>
        <Field label="Guest email">
          <TextInput
            type="email"
            value={formData.guestEmail}
            onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
          />
        </Field>
        <Field label="Guest phone">
          <TextInput
            type="tel"
            value={formData.guestPhone}
            onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}
