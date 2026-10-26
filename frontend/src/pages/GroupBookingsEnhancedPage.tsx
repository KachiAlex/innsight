import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  Plus,
  Trash2,
  Users,
  Bed,
  Calendar,
  Mail,
  Phone,
  DollarSign,
  LogIn,
  LogOut,
  Ban,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  Column,
  DataTable,
  DetailDrawer,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import styles from './GroupBookingsEnhancedPage.module.css';

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
  hall?: { id: string; name: string; capacity: number; location?: string } | null;
}

interface MeetingHall {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  location?: string;
}

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
  roomBlocks?: RoomBlock[];
  hallReservations?: HallReservation[];
  reservations?: any[];
}

interface BookingStats {
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  totalRevenue: number;
  totalRooms: number;
  upcomingBookings: number;
}

const generateTempId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const GROUP_TYPES = [
  { value: 'corporate', label: 'Corporate' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'conference', label: 'Conference' },
  { value: 'tour', label: 'Tour group' },
  { value: 'sports', label: 'Sports team' },
  { value: 'social', label: 'Social event' },
  { value: 'other', label: 'Other' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const newRoomBlock = (): RoomBlock => ({
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
});

const EMPTY_FORM = () => ({
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
  roomBlocks: [newRoomBlock()],
  hallReservations: [] as HallReservation[],
});

type FormState = ReturnType<typeof EMPTY_FORM>;

export default function GroupBookingsEnhancedPage() {
  const { user } = useAuthStore();
  const { currencySymbol } = useTenantSettings();
  const [bookings, setBookings] = useState<GroupBooking[]>([]);
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedBooking, setSelectedBooking] = useState<GroupBooking | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [meetingHalls, setMeetingHalls] = useState<MeetingHall[]>([]);
  const [roomCategories, setRoomCategories] = useState<{ id: string; name: string }[]>([]);
  const [roomTypes, setRoomTypes] = useState<string[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<'checkin' | 'checkout' | 'cancel' | null>(null);
  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM());

  const money = (n?: number | null) => formatMoney(n ?? 0, currencySymbol);
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const fmtTime = (d: string) =>
    new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const progressLabel = (p: string) =>
    p.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  const loadBookings = async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await api.get(`/tenants/${user.tenantId}/group-bookings?${params}`);
      setBookings(response.data.data);
    } catch {
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
    } catch {
      /* stats are non-critical */
    }
  };

  const runLifecycle = async (action: 'checkin' | 'checkout' | 'cancel') => {
    if (!selectedBooking || !user?.tenantId) return;
    setLifecycleAction(action);
    try {
      const res = await api.post(
        `/tenants/${user.tenantId}/group-bookings/${selectedBooking.id}/${action}`
      );
      toast.success(res.data?.message || 'Done');
      if (res.data?.data) setSelectedBooking(res.data.data);
      await Promise.all([loadBookings(), loadStats()]);
      if (action === 'cancel') setSelectedBooking(null);
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error?.message || e?.response?.data?.message || 'Action failed'
      );
    } finally {
      setLifecycleAction(null);
    }
  };

  const loadCreateMeta = async () => {
    if (!user?.tenantId) return;
    setLoadingMeta(true);
    try {
      const [categoriesRes, roomsRes, hallsRes] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/room-categories`),
        api.get(`/tenants/${user.tenantId}/rooms`),
        api.get(`/tenants/${user.tenantId}/group-bookings/meeting-halls`),
      ]);
      setRoomCategories(
        (categoriesRes.data?.data ?? []).map((c: any) => ({ id: c.id, name: c.name }))
      );
      const rooms = roomsRes.data?.data ?? [];
      setRoomTypes(
        Array.from(new Set(rooms.map((r: any) => r.roomType).filter(Boolean))) as string[]
      );
      setMeetingHalls(hallsRes.data?.data ?? []);
    } catch {
      toast.error('Failed to load booking options');
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    loadBookings();
    loadStats();
  }, [user?.tenantId, statusFilter]);

  useEffect(() => {
    if (showCreateModal) loadCreateMeta();
  }, [showCreateModal, user?.tenantId]);

  /* ---------- validation ---------- */
  const validationErrors = useMemo(() => {
    const fields: Record<string, string | undefined> = {
      groupName: formData.groupName.trim() ? undefined : 'Group name is required',
      contactPerson: formData.contactPerson.trim() ? undefined : 'Contact person is required',
      contactEmail: formData.contactEmail.trim() ? undefined : 'Contact email is required',
      contactPhone: formData.contactPhone.trim() ? undefined : 'Contact phone is required',
      checkInDate: formData.checkInDate ? undefined : 'Check-in date is required',
      checkOutDate: formData.checkOutDate ? undefined : 'Check-out date is required',
      roomBlocks: formData.roomBlocks.length === 0 ? 'At least one room block is required' : undefined,
    };
    if (
      formData.checkInDate &&
      formData.checkOutDate &&
      new Date(formData.checkOutDate) <= new Date(formData.checkInDate)
    ) {
      fields.checkOutDate = 'Check-out must be after check-in';
    }
    const roomBlocks = formData.roomBlocks.map((b) => ({
      roomCategoryId: b.roomCategoryId.trim() ? undefined : 'Category required',
      roomType: b.roomType.trim() ? undefined : 'Room type required',
      totalRooms: b.totalRooms > 0 ? undefined : 'Must be > 0',
    }));
    const hallReservations = formData.hallReservations.map((r) => ({
      hallId: r.hallId ? undefined : 'Select a hall',
      startDateTime: r.startDateTime ? undefined : 'Start required',
      endDateTime: !r.endDateTime
        ? 'End required'
        : r.startDateTime && new Date(r.endDateTime) <= new Date(r.startDateTime)
        ? 'End must be after start'
        : undefined,
    }));
    const hasErrors =
      Object.values(fields).some(Boolean) ||
      roomBlocks.some((b) => Object.values(b).some(Boolean)) ||
      hallReservations.some((r) => Object.values(r).some(Boolean));
    return { fields, roomBlocks, hallReservations, hasErrors };
  }, [formData]);

  const fieldError = (f: string) => (showValidationErrors ? validationErrors.fields[f] : undefined);
  const blockError = (i: number, f: 'roomCategoryId' | 'roomType' | 'totalRooms') =>
    showValidationErrors ? validationErrors.roomBlocks[i]?.[f] : undefined;
  const hallError = (i: number, f: 'hallId' | 'startDateTime' | 'endDateTime') =>
    showValidationErrors ? validationErrors.hallReservations[i]?.[f] : undefined;

  /* ---------- room block / hall handlers ---------- */
  const updateRoomBlock = (index: number, field: keyof RoomBlock, value: string) => {
    setFormData((prev) => {
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

  const updateHallReservation = (index: number, field: keyof HallReservation, value: string) => {
    setFormData((prev) => {
      const updated = [...prev.hallReservations];
      const target = { ...updated[index] };
      if (field === 'attendeeCount') target.attendeeCount = value === '' ? undefined : Number(value);
      else (target as any)[field] = value;
      updated[index] = target;
      return { ...prev, hallReservations: updated };
    });
  };

  /* ---------- create ---------- */
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
        roomBlocks: formData.roomBlocks.map((b) => ({
          roomCategoryId: b.roomCategoryId.trim(),
          roomType: b.roomType.trim(),
          totalRooms: b.totalRooms,
          negotiatedRate: b.negotiatedRate,
          discountPercent: b.discountPercent,
        })),
        hallReservations: formData.hallReservations.map((r) => ({
          hallId: r.hallId,
          eventName: r.eventName?.trim() || undefined,
          purpose: r.purpose?.trim() || undefined,
          setupType: r.setupType?.trim() || undefined,
          attendeeCount: r.attendeeCount,
          startDateTime: r.startDateTime,
          endDateTime: r.endDateTime,
          cateringNotes: r.cateringNotes?.trim() || undefined,
          avRequirements: r.avRequirements?.trim() || undefined,
        })),
      });
      toast.success('Group booking created');
      setShowCreateModal(false);
      setFormData(EMPTY_FORM());
      setShowValidationErrors(false);
      loadBookings();
      loadStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.error?.message || 'Failed to create group booking');
    } finally {
      setSaving(false);
    }
  };

  const filteredBookings = bookings.filter(
    (b) =>
      b.groupName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.groupBookingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: Column<GroupBooking>[] = [
    {
      key: 'group',
      header: 'Group',
      render: (b) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{b.groupName}</div>
          <div className="text-sm muted">
            #{b.groupBookingNumber} · {b.groupType}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (b) => (
        <div>
          <div className="text-sm">{b.contactPerson}</div>
          <div className="text-xs muted">{b.contactEmail}</div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (b) => (
        <span className="text-sm">
          {fmtDate(b.checkInDate)} → {fmtDate(b.checkOutDate)}
        </span>
      ),
    },
    {
      key: 'size',
      header: 'Size',
      render: (b) => (
        <span className="text-sm">
          {b.totalRooms} rooms · {b.expectedGuests ?? '—'} guests
        </span>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      render: (b) => <strong>{money(b.totalRevenue)}</strong>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (b) => (
        <div className="stack" style={{ gap: 4 }}>
          <StatusBadge status={b.status}>{b.status.replace(/_/g, ' ')}</StatusBadge>
          <StatusBadge tone="info" dot={false}>
            {progressLabel(b.bookingProgress)}
          </StatusBadge>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="Group bookings"
        subtitle="Room blocks, events, and large-party coordination"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => { setFormData(EMPTY_FORM()); setShowCreateModal(true); }}>
            New group booking
          </Button>
        }
      />

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <StatCard label="Total bookings" value={String(stats.totalBookings)} icon={<Users size={18} />} />
          <StatCard label="Confirmed" value={String(stats.confirmedBookings)} tone="good" />
          <StatCard label="Pending" value={String(stats.pendingBookings)} tone={stats.pendingBookings > 0 ? 'warning' : 'neutral'} />
          <StatCard label="Total revenue" value={money(stats.totalRevenue)} icon={<DollarSign size={18} />} />
          <StatCard label="Rooms blocked" value={String(stats.totalRooms)} icon={<Bed size={18} />} />
          <StatCard label="Upcoming" value={String(stats.upcomingBookings)} icon={<Calendar size={18} />} />
        </div>
      )}

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by name, number, or contact…"
        activeCount={statusFilter !== 'all' ? 1 : 0}
        onClear={() => setStatusFilter('all')}
      >
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>
      </FilterBar>

      <DataTable<GroupBooking>
        columns={columns}
        data={filteredBookings}
        rowKey={(b) => b.id}
        loading={loading}
        onRowClick={(b) => setSelectedBooking(b)}
        empty={{
          title: 'No group bookings found',
          description:
            searchTerm || statusFilter !== 'all'
              ? 'No bookings match your current filters'
              : 'Create your first group booking for events or large parties',
          action: !searchTerm && statusFilter === 'all' ? (
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              Create group booking
            </Button>
          ) : undefined,
        }}
      />

      {/* ---------- Details drawer ---------- */}
      <DetailDrawer
        open={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        title={selectedBooking?.groupName ?? ''}
        headerExtra={
          selectedBooking ? (
            <StatusBadge status={selectedBooking.status}>
              {selectedBooking.status.replace(/_/g, ' ')}
            </StatusBadge>
          ) : undefined
        }
        width="lg"
      >
        {selectedBooking && (
          <div className="stack">
            <div>
              <p className="text-sm muted" style={{ margin: 0 }}>
                #{selectedBooking.groupBookingNumber} · {selectedBooking.groupType} · {progressLabel(selectedBooking.bookingProgress)}
              </p>
              <div className="gridForm" style={{ marginTop: 'var(--space-3)' }}>
                <div>
                  <p className="text-xs muted" style={{ margin: 0 }}>Check-in → Check-out</p>
                  <p className="text-sm" style={{ margin: 0, fontWeight: 600 }}>
                    {fmtDate(selectedBooking.checkInDate)} → {fmtDate(selectedBooking.checkOutDate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs muted" style={{ margin: 0 }}>Guests</p>
                  <p className="text-sm" style={{ margin: 0, fontWeight: 600 }}>
                    {selectedBooking.confirmedGuests ?? 0} confirmed / {selectedBooking.expectedGuests ?? '—'} expected
                  </p>
                </div>
                <div>
                  <p className="text-xs muted" style={{ margin: 0 }}>Revenue</p>
                  <p className="text-sm" style={{ margin: 0, fontWeight: 600 }}>{money(selectedBooking.totalRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs muted" style={{ margin: 0 }}>Deposit</p>
                  <p className="text-sm" style={{ margin: 0, fontWeight: 600 }}>
                    {selectedBooking.depositAmount ? money(selectedBooking.depositAmount) : '—'}
                    {selectedBooking.depositPaid && <StatusBadge tone="success" dot={false}> Paid</StatusBadge>}
                  </p>
                </div>
              </div>
            </div>

            {/* Lifecycle actions */}
            {!['cancelled', 'checked_out'].includes(selectedBooking.status) && (
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                {['pending', 'tentative', 'confirmed', 'partially_checked_in'].includes(
                  selectedBooking.status
                ) && (
                  <Button
                    variant="primary"
                    icon={<LogIn size={14} />}
                    loading={lifecycleAction === 'checkin'}
                    disabled={lifecycleAction !== null}
                    onClick={() => runLifecycle('checkin')}
                  >
                    Check in group
                  </Button>
                )}
                {['checked_in', 'partially_checked_in', 'partially_checked_out'].includes(
                  selectedBooking.status
                ) && (
                  <Button
                    variant="secondary"
                    icon={<LogOut size={14} />}
                    loading={lifecycleAction === 'checkout'}
                    disabled={lifecycleAction !== null}
                    onClick={() => runLifecycle('checkout')}
                  >
                    Check out group
                  </Button>
                )}
                <Button
                  variant="danger"
                  icon={<Ban size={14} />}
                  loading={lifecycleAction === 'cancel'}
                  disabled={lifecycleAction !== null}
                  onClick={() => {
                    if (
                      window.confirm(
                        'Cancel this group booking? All pending reservations in the group will be cancelled.'
                      )
                    ) {
                      runLifecycle('cancel');
                    }
                  }}
                >
                  Cancel booking
                </Button>
              </div>
            )}

            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>Contact</h4>
              <div className="stack" style={{ gap: 4 }}>
                <span className="text-sm"><Users size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{selectedBooking.contactPerson}</span>
                <span className="text-sm"><Mail size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{selectedBooking.contactEmail}</span>
                <span className="text-sm"><Phone size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{selectedBooking.contactPhone}</span>
              </div>
            </div>

            {selectedBooking.roomBlocks && selectedBooking.roomBlocks.length > 0 && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Room blocks ({selectedBooking.roomBlocks.length})</h4>
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  {selectedBooking.roomBlocks.map((b) => (
                    <div key={b.id} className={styles.hallItem}>
                      <strong>{b.totalRooms}× {b.roomType}</strong>
                      {b.negotiatedRate ? ` · ${money(b.negotiatedRate)}/night` : ''}
                      {b.discountPercent ? ` · ${b.discountPercent}% off` : ''}
                      <div className="text-xs muted">
                        {b.allocatedRooms}/{b.totalRooms} allocated
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedBooking.hallReservations && selectedBooking.hallReservations.length > 0 && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Meeting hall reservations ({selectedBooking.hallReservations.length})</h4>
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  {selectedBooking.hallReservations.map((r) => (
                    <div key={r.id} className={styles.hallItem}>
                      <strong>{r.hall?.name || 'Hall'}</strong> — {r.eventName || 'Event'}
                      <div className="text-xs muted">
                        {fmtDate(r.startDateTime)} · {fmtTime(r.startDateTime)}–{fmtTime(r.endDateTime)}
                        {r.attendeeCount ? ` · ${r.attendeeCount} attendees` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(selectedBooking.specialRequests || selectedBooking.dietaryRequirements || selectedBooking.setupRequirements) && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Special requirements</h4>
                <div className={styles.requirements}>
                  {selectedBooking.specialRequests && <div>Requests: {selectedBooking.specialRequests}</div>}
                  {selectedBooking.dietaryRequirements && <div>Dietary: {selectedBooking.dietaryRequirements}</div>}
                  {selectedBooking.setupRequirements && <div>Setup: {selectedBooking.setupRequirements}</div>}
                </div>
              </div>
            )}

            {selectedBooking.reservations && selectedBooking.reservations.length > 0 && (
              <div className={styles.detailSection}>
                <h4 className={styles.detailSectionTitle}>Linked reservations ({selectedBooking.reservations.length})</h4>
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  {selectedBooking.reservations.map((r: any) => (
                    <div key={r.id} className={styles.hallItem}>
                      <strong>#{r.reservationNumber ?? r.id.slice(0, 8)}</strong>
                      <StatusBadge status={r.status} dot={false}>
                        {r.status?.replace(/_/g, ' ')}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>

      {/* ---------- Create modal ---------- */}
      <Modal
        open={showCreateModal}
        onClose={() => { setShowCreateModal(false); setShowValidationErrors(false); }}
        title="New group booking"
        subtitle="Contact details, room blocks, and optional meeting halls"
        width="xl"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleCreateBooking}>
              Create booking
            </Button>
          </>
        }
      >
        {loadingMeta ? (
          <Skeleton height="300px" />
        ) : (
          <div className="stack">
            <div className={styles.gridForm}>
              <Field label="Group name" required error={fieldError('groupName')}>
                <TextInput
                  value={formData.groupName}
                  invalid={!!fieldError('groupName')}
                  onChange={(e) => setFormData({ ...formData, groupName: e.target.value })}
                />
              </Field>
              <Field label="Group type">
                <Select value={formData.groupType} onChange={(e) => setFormData({ ...formData, groupType: e.target.value })}>
                  {GROUP_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className={styles.gridForm}>
              <Field label="Contact person" required error={fieldError('contactPerson')}>
                <TextInput
                  value={formData.contactPerson}
                  invalid={!!fieldError('contactPerson')}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                />
              </Field>
              <Field label="Contact email" required error={fieldError('contactEmail')}>
                <TextInput
                  type="email"
                  value={formData.contactEmail}
                  invalid={!!fieldError('contactEmail')}
                  onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                />
              </Field>
              <Field label="Contact phone" required error={fieldError('contactPhone')}>
                <TextInput
                  value={formData.contactPhone}
                  invalid={!!fieldError('contactPhone')}
                  onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                />
              </Field>
            </div>

            <div className={styles.gridForm}>
              <Field label="Check-in" required error={fieldError('checkInDate')}>
                <TextInput
                  type="date"
                  value={formData.checkInDate}
                  invalid={!!fieldError('checkInDate')}
                  onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                />
              </Field>
              <Field label="Check-out" required error={fieldError('checkOutDate')}>
                <TextInput
                  type="date"
                  value={formData.checkOutDate}
                  invalid={!!fieldError('checkOutDate')}
                  onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                />
              </Field>
              <Field label="Expected guests">
                <TextInput
                  type="number"
                  min="1"
                  value={formData.expectedGuests}
                  onChange={(e) => setFormData({ ...formData, expectedGuests: e.target.value })}
                />
              </Field>
              <Field label={`Deposit amount (${currencySymbol})`}>
                <TextInput
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.depositAmount}
                  onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                />
              </Field>
            </div>

            <div className={styles.detailSection}>
              <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
                <h4 className={styles.detailSectionTitle} style={{ margin: 0 }}>
                  Room blocks {fieldError('roomBlocks') && <span style={{ color: 'var(--danger)' }}>— {fieldError('roomBlocks')}</span>}
                </h4>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => setFormData((p) => ({ ...p, roomBlocks: [...p.roomBlocks, newRoomBlock()] }))}
                >
                  Add block
                </Button>
              </div>
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                {formData.roomBlocks.map((block, i) => (
                  <div key={block.id} className={styles.blockCard}>
                    <div className={styles.blockHead}>
                      <span className={styles.blockTitle}>Block {i + 1}</span>
                      {formData.roomBlocks.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Trash2 size={14} />}
                          onClick={() => setFormData((p) => ({ ...p, roomBlocks: p.roomBlocks.filter((_, j) => j !== i) }))}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className={styles.gridForm}>
                      <Field label="Category" required error={blockError(i, 'roomCategoryId')}>
                        <Select
                          value={block.roomCategoryId}
                          invalid={!!blockError(i, 'roomCategoryId')}
                          onChange={(e) => updateRoomBlock(i, 'roomCategoryId', e.target.value)}
                        >
                          <option value="">Select category</option>
                          {roomCategories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Room type" required error={blockError(i, 'roomType')}>
                        <Select
                          value={block.roomType}
                          invalid={!!blockError(i, 'roomType')}
                          onChange={(e) => updateRoomBlock(i, 'roomType', e.target.value)}
                        >
                          <option value="">Select type</option>
                          {roomTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Rooms" required error={blockError(i, 'totalRooms')}>
                        <TextInput
                          type="number"
                          min="1"
                          value={block.totalRooms}
                          invalid={!!blockError(i, 'totalRooms')}
                          onChange={(e) => updateRoomBlock(i, 'totalRooms', e.target.value)}
                        />
                      </Field>
                      <Field label={`Negotiated rate (${currencySymbol})`}>
                        <TextInput
                          type="number"
                          min="0"
                          step="0.01"
                          value={block.negotiatedRate ?? ''}
                          onChange={(e) => updateRoomBlock(i, 'negotiatedRate', e.target.value)}
                        />
                      </Field>
                      <Field label="Discount %">
                        <TextInput
                          type="number"
                          min="0"
                          max="100"
                          value={block.discountPercent ?? ''}
                          onChange={(e) => updateRoomBlock(i, 'discountPercent', e.target.value)}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.detailSection}>
              <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
                <h4 className={styles.detailSectionTitle} style={{ margin: 0 }}>Meeting halls (optional)</h4>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={14} />}
                  disabled={!meetingHalls.length}
                  onClick={() =>
                    setFormData((p) => ({
                      ...p,
                      hallReservations: [
                        ...p.hallReservations,
                        { id: generateTempId(), hallId: meetingHalls[0]?.id || '', startDateTime: '', endDateTime: '' },
                      ],
                    }))
                  }
                >
                  Add hall
                </Button>
              </div>
              {!meetingHalls.length && (
                <p className="text-sm muted">No meeting halls configured for this property.</p>
              )}
              <div className="stack" style={{ gap: 'var(--space-3)' }}>
                {formData.hallReservations.map((r, i) => (
                  <div key={r.id} className={styles.blockCard}>
                    <div className={styles.blockHead}>
                      <span className={styles.blockTitle}>Hall reservation {i + 1}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => setFormData((p) => ({ ...p, hallReservations: p.hallReservations.filter((_, j) => j !== i) }))}
                      >
                        Remove
                      </Button>
                    </div>
                    <div className={styles.gridForm}>
                      <Field label="Hall" required error={hallError(i, 'hallId')}>
                        <Select
                          value={r.hallId}
                          invalid={!!hallError(i, 'hallId')}
                          onChange={(e) => updateHallReservation(i, 'hallId', e.target.value)}
                        >
                          <option value="">Select hall</option>
                          {meetingHalls.map((h) => (
                            <option key={h.id} value={h.id}>{h.name} ({h.capacity})</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Event name">
                        <TextInput value={r.eventName ?? ''} onChange={(e) => updateHallReservation(i, 'eventName', e.target.value)} />
                      </Field>
                      <Field label="Start" required error={hallError(i, 'startDateTime')}>
                        <TextInput
                          type="datetime-local"
                          value={r.startDateTime}
                          invalid={!!hallError(i, 'startDateTime')}
                          onChange={(e) => updateHallReservation(i, 'startDateTime', e.target.value)}
                        />
                      </Field>
                      <Field label="End" required error={hallError(i, 'endDateTime')}>
                        <TextInput
                          type="datetime-local"
                          value={r.endDateTime}
                          invalid={!!hallError(i, 'endDateTime')}
                          onChange={(e) => updateHallReservation(i, 'endDateTime', e.target.value)}
                        />
                      </Field>
                      <Field label="Attendees">
                        <TextInput
                          type="number"
                          min="1"
                          value={r.attendeeCount ?? ''}
                          onChange={(e) => updateHallReservation(i, 'attendeeCount', e.target.value)}
                        />
                      </Field>
                      <Field label="Setup type">
                        <TextInput value={r.setupType ?? ''} onChange={(e) => updateHallReservation(i, 'setupType', e.target.value)} placeholder="e.g., Theatre, Banquet" />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.gridForm}>
              <Field label="Special requests">
                <Textarea rows={2} value={formData.specialRequests} onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })} />
              </Field>
              <Field label="Dietary requirements">
                <Textarea rows={2} value={formData.dietaryRequirements} onChange={(e) => setFormData({ ...formData, dietaryRequirements: e.target.value })} />
              </Field>
              <Field label="Setup requirements">
                <Textarea rows={2} value={formData.setupRequirements} onChange={(e) => setFormData({ ...formData, setupRequirements: e.target.value })} />
              </Field>
            </div>
          </div>
        )}
      </Modal>
    </Layout>
  );
}
