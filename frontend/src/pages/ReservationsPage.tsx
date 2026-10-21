import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  DataTable,
  DetailDrawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  SkeletonTable,
  StatusBadge,
  Stepper,
  TextInput,
  Textarea,
  type Column,
} from '../components/ui';
import { formatMoney, reservationTotal } from '../lib/money';
import { useTenantSettings } from '../hooks/useTenantSettings';
import Pagination from '../components/Pagination';
import styles from './ReservationsPage.module.css';

interface Reservation {
  id: string;
  reservationNumber: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  rate: number;
  adults?: number;
  children?: number;
  source?: string;
  specialRequests?: string;
  createdAt?: string;
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

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'checked_in', label: 'Checked in' },
  { key: 'checked_out', label: 'Checked out' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'no_show', label: 'No-show' },
];

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
  const settings = useTenantSettings();
  const currency = settings.currencySymbol;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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
  const [confirmBulk, setConfirmBulk] = useState<'in' | 'out' | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

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
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`, {
        params: { limit: 500 },
      });
      setRooms(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  const fetchReservations = async (page = pagination.page) => {
    try {
      setError(null);
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
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error('Failed to load reservations'));
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (reservationId: string) => {
    setProcessingReservations((prev) => new Set(prev).add(reservationId));
    try {
      await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkin`);
      fetchReservations();
      toast.success('Guest checked in successfully');
    } catch {
      // Error handled by API interceptor
    } finally {
      setProcessingReservations((prev) => {
        const next = new Set(prev);
        next.delete(reservationId);
        return next;
      });
    }
  };

  const handleCheckOut = async (reservationId: string) => {
    setProcessingReservations((prev) => new Set(prev).add(reservationId));
    try {
      await api.post(`/tenants/${user?.tenantId}/reservations/${reservationId}/checkout`, {
        finalCharges: {},
        paymentInfo: {},
      });
      fetchReservations();
      toast.success('Guest checked out successfully');
    } catch {
      // Error handled by API interceptor
    } finally {
      setProcessingReservations((prev) => {
        const next = new Set(prev);
        next.delete(reservationId);
        return next;
      });
    }
  };

  const runBulk = async (action: 'in' | 'out') => {
    setIsBulkProcessing(true);
    const reservationIds = Array.from(selectedReservations);
    let successCount = 0;
    let failCount = 0;

    for (const reservationId of reservationIds) {
      try {
        await api.post(
          `/tenants/${user?.tenantId}/reservations/${reservationId}/${
            action === 'in' ? 'checkin' : 'checkout'
          }`,
          action === 'out' ? { finalCharges: {}, paymentInfo: {} } : undefined
        );
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsBulkProcessing(false);
    setSelectedReservations(new Set());
    setConfirmBulk(null);
    fetchReservations();

    const verb = action === 'in' ? 'checked in' : 'checked out';
    if (failCount === 0) {
      toast.success(`Successfully ${verb} ${successCount} reservation(s)`);
    } else {
      toast.error(`Completed ${successCount}, failed ${failCount}`);
    }
  };

  const toggleSelectReservation = (reservationId: string) => {
    const next = new Set(selectedReservations);
    if (next.has(reservationId)) next.delete(reservationId);
    else next.add(reservationId);
    setSelectedReservations(next);
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
    const q = searchTerm.toLowerCase();
    return (
      reservation.reservationNumber.toLowerCase().includes(q) ||
      reservation.guestName.toLowerCase().includes(q) ||
      reservation.room?.roomNumber?.toLowerCase().includes(q) ||
      reservation.room?.roomType?.toLowerCase().includes(q)
    );
  });

  const activeFilterCount =
    (filters.status ? 1 : 0) +
    (filters.roomId ? 1 : 0) +
    (filters.startDate ? 1 : 0) +
    (filters.endDate ? 1 : 0);

  const columns = useMemo<Column<Reservation>[]>(
    () => [
      {
        key: '_select',
        header: (
          <input
            type="checkbox"
            checked={
              selectedReservations.size === filteredReservations.length &&
              filteredReservations.length > 0
            }
            onChange={toggleSelectAll}
            aria-label="Select all reservations"
          />
        ),
        width: '40px',
        render: (r) => (
          <input
            type="checkbox"
            checked={selectedReservations.has(r.id)}
            onChange={() => toggleSelectReservation(r.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${r.reservationNumber}`}
          />
        ),
      },
      {
        key: 'reservationNumber',
        header: 'Reservation',
        render: (r) => <strong>{r.reservationNumber}</strong>,
      },
      { key: 'guestName', header: 'Guest' },
      {
        key: 'room',
        header: 'Room',
        render: (r) =>
          r.room ? `${r.room.roomNumber}${r.room.roomType ? ` · ${r.room.roomType}` : ''}` : '—',
      },
      {
        key: 'checkInDate',
        header: 'Check-in',
        render: (r) => format(new Date(r.checkInDate), 'MMM dd, yyyy'),
      },
      {
        key: 'checkOutDate',
        header: 'Check-out',
        render: (r) => format(new Date(r.checkOutDate), 'MMM dd, yyyy'),
      },
      {
        key: 'rate',
        header: 'Rate',
        align: 'right',
        render: (r) => (
          <span>
            {formatMoney(Number(r.rate), currency)}
            <span className="muted text-xs"> /night</span>
          </span>
        ),
      },
      {
        key: 'total',
        header: 'Total',
        align: 'right',
        render: (r) => <strong>{formatMoney(reservationTotal(r), currency)}</strong>,
      },
      { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
      {
        key: '_actions',
        header: '',
        width: '110px',
        render: (r) => (
          <div className="row" style={{ gap: 'var(--space-1)' }} onClick={(e) => e.stopPropagation()}>
            {r.status === 'confirmed' && (
              <Button
                size="sm"
                variant="primary"
                loading={processingReservations.has(r.id)}
                disabled={isBulkProcessing}
                onClick={() => handleCheckIn(r.id)}
              >
                Check in
              </Button>
            )}
            {r.status === 'checked_in' && (
              <Button
                size="sm"
                variant="secondary"
                loading={processingReservations.has(r.id)}
                disabled={isBulkProcessing}
                onClick={() => handleCheckOut(r.id)}
              >
                Check out
              </Button>
            )}
          </div>
        ),
      },
    ],
    [
      selectedReservations,
      filteredReservations,
      processingReservations,
      isBulkProcessing,
      currency,
    ]
  );

  if (loading && !reservations.length) {
    return (
      <Layout>
        <PageHeader title="Reservations" />
        <SkeletonTable rows={8} cols={7} />
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Reservations"
        subtitle={
          pagination.total > 0
            ? `${pagination.total} total reservation${pagination.total !== 1 ? 's' : ''}`
            : undefined
        }
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>
            New reservation
          </Button>
        }
      />

      {/* Status tabs */}
      <div className={styles.tabs} role="tablist" aria-label="Filter by status">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={filters.status === tab.key}
            className={`${styles.tab} ${filters.status === tab.key ? styles.tabActive : ''}`}
            onClick={() => {
              setFilters({ ...filters, status: tab.key });
              setPagination({ ...pagination, page: 1 });
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {selectedReservations.size > 0 && (
        <div className={styles.bulkBar}>
          <span>
            {selectedReservations.size} reservation{selectedReservations.size !== 1 ? 's' : ''}{' '}
            selected
          </span>
          <div className="row">
            <Button
              size="sm"
              variant="secondary"
              icon={<CheckCircle size={15} />}
              loading={isBulkProcessing}
              onClick={() => setConfirmBulk('in')}
            >
              Check in all
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<XCircle size={15} />}
              loading={isBulkProcessing}
              onClick={() => setConfirmBulk('out')}
            >
              Check out all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedReservations(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by guest, reservation #, or room…"
        activeCount={activeFilterCount}
        onClear={() => {
          setFilters({ status: '', roomId: '', startDate: '', endDate: '' });
          setPagination({ ...pagination, page: 1 });
        }}
      >
        <Select
          value={filters.roomId}
          onChange={(e) => {
            setFilters({ ...filters, roomId: e.target.value });
            setPagination({ ...pagination, page: 1 });
          }}
          aria-label="Filter by room"
        >
          <option value="">All rooms</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.roomNumber}
            </option>
          ))}
        </Select>
        <TextInput
          type="date"
          value={filters.startDate}
          onChange={(e) => {
            setFilters({ ...filters, startDate: e.target.value });
            setPagination({ ...pagination, page: 1 });
          }}
          aria-label="Check-in from"
        />
        <TextInput
          type="date"
          value={filters.endDate}
          onChange={(e) => {
            setFilters({ ...filters, endDate: e.target.value });
            setPagination({ ...pagination, page: 1 });
          }}
          aria-label="Check-out to"
        />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFilters({
              ...filters,
              startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
              endDate: format(new Date(), 'yyyy-MM-dd'),
            });
            setPagination({ ...pagination, page: 1 });
          }}
        >
          Last 7d
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFilters({
              ...filters,
              startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
              endDate: format(new Date(), 'yyyy-MM-dd'),
            });
            setPagination({ ...pagination, page: 1 });
          }}
        >
          Last 30d
        </Button>
      </FilterBar>

      {error ? (
        <ErrorState
          message={error.message}
          onRetry={() => fetchReservations(pagination.page)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredReservations}
          rowKey={(r) => r.id}
          onRowClick={(r) => setDetailId(r.id)}
          empty={{
            title: searchTerm
              ? 'No reservations match your search'
              : 'No reservations yet',
            description: searchTerm
              ? 'Try a different search term.'
              : 'Create your first reservation to get started.',
            action: !searchTerm ? (
              <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                New reservation
              </Button>
            ) : undefined,
          }}
          footer={
            pagination.totalPages > 1 ? (
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={(newPage) => {
                  setPagination({ ...pagination, page: newPage });
                }}
              />
            ) : undefined
          }
        />
      )}

      <ReservationDetailDrawer
        reservationId={detailId}
        tenantId={user?.tenantId}
        currency={currency}
        onClose={() => setDetailId(null)}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        processing={detailId ? processingReservations.has(detailId) : false}
      />

      <ConfirmDialog
        open={confirmBulk !== null}
        onClose={() => setConfirmBulk(null)}
        onConfirm={() => confirmBulk && runBulk(confirmBulk)}
        title={confirmBulk === 'in' ? 'Bulk check-in' : 'Bulk check-out'}
        confirmLabel={confirmBulk === 'in' ? 'Check in all' : 'Check out all'}
        loading={isBulkProcessing}
      >
        {confirmBulk === 'in'
          ? `Check in ${selectedReservations.size} selected reservation(s)? Each must pass room-readiness rules.`
          : `Check out ${selectedReservations.size} selected reservation(s)? Balances should be settled first.`}
      </ConfirmDialog>

      <CreateReservationModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchReservations();
        }}
        currency={currency}
      />
    </Layout>
  );
}

/* ==================== Detail drawer ==================== */

interface DrawerProps {
  reservationId: string | null;
  tenantId?: string;
  currency: string;
  onClose: () => void;
  onCheckIn: (id: string) => void;
  onCheckOut: (id: string) => void;
  processing: boolean;
}

type DrawerTab = 'summary' | 'guest' | 'charges' | 'payments' | 'history';

function ReservationDetailDrawer({
  reservationId,
  tenantId,
  currency,
  onClose,
  onCheckIn,
  onCheckOut,
  processing,
}: DrawerProps) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('summary');

  useEffect(() => {
    if (!reservationId || !tenantId) {
      setDetail(null);
      return;
    }
    setTab('summary');
    setLoading(true);
    api
      .get(`/tenants/${tenantId}/reservations/${reservationId}`)
      .then((res) => setDetail(res.data?.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [reservationId, tenantId]);

  const folios: any[] = detail?.folios ?? [];
  const charges = folios.flatMap((f: any) => f.charges ?? []);
  const payments = folios.flatMap((f: any) => f.payments ?? []);
  const totalCharges = charges.reduce((s: number, c: any) => s + Number(c.total ?? c.amount ?? 0), 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const balance = totalCharges - totalPaid;

  const TABS: { key: DrawerTab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'guest', label: 'Guest' },
    { key: 'charges', label: `Charges${charges.length ? ` (${charges.length})` : ''}` },
    { key: 'payments', label: `Payments${payments.length ? ` (${payments.length})` : ''}` },
    { key: 'history', label: 'History' },
  ];

  return (
    <DetailDrawer
      open={!!reservationId}
      onClose={onClose}
      title={detail?.reservationNumber ?? 'Reservation'}
      headerExtra={detail ? <StatusBadge status={detail.status} /> : undefined}
      width="lg"
      footer={
        detail ? (
          <>
            {detail.status === 'confirmed' && (
              <Button
                variant="primary"
                loading={processing}
                onClick={() => onCheckIn(detail.id)}
              >
                Check in
              </Button>
            )}
            {detail.status === 'checked_in' && (
              <Button
                variant="secondary"
                loading={processing}
                onClick={() => onCheckOut(detail.id)}
              >
                Check out
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {loading ? (
        <SkeletonTable rows={4} cols={2} />
      ) : !detail ? (
        <ErrorState message="Couldn't load this reservation" />
      ) : (
        <>
          <div className={styles.tabs} role="tablist">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'summary' && (
            <div className="stack-lg">
              <div className={styles.kvGrid}>
                <KV k="Room" v={`${detail.room?.roomNumber ?? '—'} ${detail.room?.roomType ? `· ${detail.room.roomType}` : ''}`} />
                <KV k="Nights" v={String(Math.max(1, Math.ceil((new Date(detail.checkOutDate).getTime() - new Date(detail.checkInDate).getTime()) / 86400000)))} />
                <KV k="Nightly rate" v={formatMoney(Number(detail.rate), currency)} />
                <KV
                  k="Stay total"
                  v={formatMoney(
                    Number(detail.rate) *
                      Math.max(
                        1,
                        Math.ceil(
                          (new Date(detail.checkOutDate).getTime() -
                            new Date(detail.checkInDate).getTime()) /
                            86400000
                        )
                      ),
                    currency
                  )}
                />
                <KV k="Adults" v={String(detail.adults ?? 1)} />
                <KV k="Children" v={String(detail.children ?? 0)} />
                <KV k="Source" v={detail.source ?? 'manual'} />
                <KV k="Balance due" v={formatMoney(balance, currency)} />
              </div>
              {detail.specialRequests && (
                <div className={`${styles.infoCard} ${styles.infoCardMuted}`}>
                  <p className={styles.infoTitle}>Special requests</p>
                  <p className={styles.infoText}>{detail.specialRequests}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'guest' && (
            <div className={styles.kvGrid}>
              <KV k="Name" v={detail.guestName} />
              <KV k="Email" v={detail.guestEmail || '—'} />
              <KV k="Phone" v={detail.guestPhone || '—'} />
              <KV k="ID number" v={detail.guestIdNumber || '—'} />
            </div>
          )}

          {tab === 'charges' &&
            (charges.length ? (
              <div className="stack">
                {charges.map((c: any) => (
                  <div key={c.id} className="row-between">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                        {c.description ?? c.chargeType ?? 'Charge'}
                      </div>
                      <div className="muted text-xs">
                        {c.quantity ?? 1} × {formatMoney(Number(c.unitPrice ?? c.amount ?? 0), currency)}
                      </div>
                    </div>
                    <strong>{formatMoney(Number(c.total ?? c.amount ?? 0), currency)}</strong>
                  </div>
                ))}
                <div className="row-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-3)' }}>
                  <strong>Total charges</strong>
                  <strong>{formatMoney(totalCharges, currency)}</strong>
                </div>
              </div>
            ) : (
              <EmptyState contained={false} title="No charges posted" description="Charges appear here once posted to a folio." />
            ))}

          {tab === 'payments' &&
            (payments.length ? (
              <div className="stack">
                {payments.map((p: any) => (
                  <div key={p.id} className="row-between">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 'var(--fs-sm)' }}>
                        {p.method ?? 'payment'}
                      </div>
                      <div className="muted text-xs">
                        {p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}{' '}
                        {p.reference ? `· ${p.reference}` : ''}
                      </div>
                    </div>
                    <div className="row">
                      <StatusBadge status={p.status} />
                      <strong>{formatMoney(Number(p.amount), currency)}</strong>
                    </div>
                  </div>
                ))}
                <div className="row-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-3)' }}>
                  <strong>Total paid</strong>
                  <strong>{formatMoney(totalPaid, currency)}</strong>
                </div>
              </div>
            ) : (
              <EmptyState contained={false} title="No payments recorded" />
            ))}

          {tab === 'history' && (
            <div className="stack">
              <KV k="Created" v={detail.createdAt ? new Date(detail.createdAt).toLocaleString() : '—'} />
              <KV k="Created by" v={detail.creator ? `${detail.creator.firstName} ${detail.creator.lastName}` : '—'} />
              <KV k="Checked in" v={detail.checkedInAt ? `${new Date(detail.checkedInAt).toLocaleString()}${detail.checkInStaff ? ` by ${detail.checkInStaff.firstName} ${detail.checkInStaff.lastName}` : ''}` : '—'} />
              <KV k="Checked out" v={detail.checkedOutAt ? `${new Date(detail.checkedOutAt).toLocaleString()}${detail.checkOutStaff ? ` by ${detail.checkOutStaff.firstName} ${detail.checkOutStaff.lastName}` : ''}` : '—'} />
              <KV k="Last updated" v={detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : '—'} />
            </div>
          )}
        </>
      )}
    </DetailDrawer>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvKey}>{k}</span>
      <span className={styles.kvVal}>{v}</span>
    </div>
  );
}

/* ==================== Create reservation wizard ==================== */

const WIZARD_STEPS = [
  { key: 'guest', label: 'Guest', description: 'Contact details' },
  { key: 'stay', label: 'Stay', description: 'Dates & occupants' },
  { key: 'rooms', label: 'Rooms', description: 'Select inventory' },
  { key: 'hall', label: 'Hall', description: 'Optional event space' },
  { key: 'invoice', label: 'Review', description: 'Invoice total' },
];

function CreateReservationModal({
  open,
  onClose,
  onSuccess,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currency: string;
}) {
  const { user } = useAuthStore();
  const [availableRooms, setAvailableRooms] = useState<any[]>([]);
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
  const [includeRooms, setIncludeRooms] = useState(true);
  const [includeHall, setIncludeHall] = useState(false);
  const [hallReservations, setHallReservations] = useState<HallReservationForm[]>([]);

  const generateTempId = () => Math.random().toString(36).substring(2, 9);

  useEffect(() => {
    if (includeHall) {
      setHallReservations((prev) => {
        if (prev.length > 0) return prev;
        return [
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
        ];
      });
    } else {
      setHallReservations([]);
    }
  }, [includeHall, meetingHalls]);

  useEffect(() => {
    if (!user?.tenantId || !open) return;
    api
      .get(`/tenants/${user.tenantId}/halls`)
      .then((res) => setMeetingHalls(res.data.data || []))
      .catch(() => toast.error('Unable to load meeting halls'));
  }, [user?.tenantId, open]);

  useEffect(() => {
    if (!includeRooms) {
      setAvailableRooms([]);
      setAvailabilitySummary(null);
      setAvailabilityError(null);
      setHasAvailabilityRun(false);
      return;
    }
    if (!formData.checkInDate || !formData.checkOutDate) {
      setAvailableRooms([]);
      setAvailabilitySummary(null);
      setAvailabilityError(null);
      setHasAvailabilityRun(false);
      return;
    }
    const checkIn = new Date(formData.checkInDate);
    const checkOut = new Date(formData.checkOutDate);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return;
    if (checkOut <= checkIn) {
      setAvailabilityError('Check-out date must be after check-in date');
      setAvailableRooms([]);
      setAvailabilitySummary(null);
      return;
    }
    const minGuests = Number(formData.adults || 0) + Number(formData.children || 0);

    setCheckingAvailability(true);
    setAvailabilityError(null);
    api
      .get(`/tenants/${user?.tenantId}/reservations/availability`, {
        params: {
          startDate: checkIn.toISOString(),
          endDate: checkOut.toISOString(),
          minOccupancy: Math.max(1, minGuests),
        },
      })
      .then((response) => {
        const data = response.data.data || {};
        const roomsList = data.availableRooms || [];
        setAvailableRooms(roomsList);
        setAvailabilitySummary({
          total: data.totalRooms ?? roomsList.length,
          available: data.availableCount ?? roomsList.length,
        });
        setHasAvailabilityRun(true);
      })
      .catch(() => {
        setAvailabilityError('Unable to load availability. Please try again.');
        setAvailableRooms([]);
        setAvailabilitySummary(null);
        setHasAvailabilityRun(true);
      })
      .finally(() => setCheckingAvailability(false));
  }, [formData.checkInDate, formData.checkOutDate, formData.adults, formData.children, includeRooms]);

  const roomOptions = includeRooms && hasAvailabilityRun ? availableRooms : [];

  const categoryOptions = useMemo(() => {
    const unique = new Map<string, string>();
    roomOptions.forEach((room) => {
      if (room.category?.id) unique.set(room.category.id, room.category.name || 'Unnamed Category');
    });
    return Array.from(unique.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [roomOptions]);

  const hasUncategorizedRooms = useMemo(
    () => roomOptions.some((room) => !room.category?.id),
    [roomOptions]
  );

  useEffect(() => {
    if (categoryFilter === 'none' && !hasUncategorizedRooms) {
      setCategoryFilter('all');
      return;
    }
    if (
      categoryFilter !== 'all' &&
      categoryFilter !== 'none' &&
      !categoryOptions.some((option) => option.id === categoryFilter)
    ) {
      setCategoryFilter('all');
    }
  }, [categoryFilter, categoryOptions, hasUncategorizedRooms]);

  useEffect(() => {
    setSelectedRoomIds((prev) => {
      if (!prev.size) return prev;
      const validIds = new Set(roomOptions.map((room) => room.id));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next;
    });
  }, [roomOptions]);

  useEffect(() => {
    const next: Record<string, number> = {};
    roomOptions.forEach((room) => {
      const effectiveRate = getRoomEffectiveRate(room);
      if (effectiveRate !== null) next[room.id] = effectiveRate;
    });
    setRoomRates(next);
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
      return (
        (room.roomNumber || '').toLowerCase().includes(query) ||
        (room.roomType || '').toLowerCase().includes(query) ||
        (room.category?.name || '').toLowerCase().includes(query)
      );
    }
    return true;
  });

  const roomsByCategory = Object.values(
    filteredRooms.reduce<Record<string, { id: string; name: string; rooms: any[] }>>((acc, room) => {
      const key = room.category?.id || 'uncategorized';
      if (!acc[key]) {
        acc[key] = { id: key, name: room.category?.name || 'Uncategorized', rooms: [] };
      }
      acc[key].rooms.push(room);
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const selectedRoomDetails = Array.from(selectedRoomIds)
    .map((roomId) => roomOptions.find((room) => room.id === roomId))
    .filter(Boolean);

  const resolveRoomRate = (room: any) => {
    if (!room) return 0;
    return roomRates[room.id] ?? getRoomEffectiveRate(room) ?? 0;
  };

  const getNights = () => {
    if (!formData.checkInDate || !formData.checkOutDate) return 0;
    const start = new Date(formData.checkInDate);
    const end = new Date(formData.checkOutDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
    const diff = end.getTime() - start.getTime();
    if (diff <= 0) return 0;
    return Math.ceil(diff / 86400000);
  };

  const nights = getNights();
  const nightMultiplier = Math.max(nights, 1);
  const roomSubtotal = selectedRoomDetails.reduce(
    (sum, room: any) => sum + resolveRoomRate(room) * nightMultiplier,
    0
  );
  const hallTotal = hallReservations.reduce((sum, hall) => sum + (Number(hall.rate) || 0), 0);
  const invoiceTotal = roomSubtotal + (includeHall ? hallTotal : 0);

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
    const parts = input.split(',').map((part) => part.trim()).filter(Boolean);
    parts.forEach((part) => {
      if (part.includes('-')) {
        const [startRaw, endRaw] = part.split('-');
        const start = parseInt(startRaw.trim(), 10);
        const end = parseInt(endRaw.trim(), 10);
        if (Number.isNaN(start) || Number.isNaN(end)) throw new Error(`Invalid range "${part}"`);
        if (start > end) throw new Error(`Range start (${start}) must be <= end (${end})`);
        for (let i = start; i <= end; i += 1) roomNumbers.push(String(i));
      } else {
        const num = parseInt(part, 10);
        if (Number.isNaN(num)) throw new Error(`Invalid room number "${part}"`);
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
        if (match) nextSelected.add(match.id);
        else notFound.add(roomNumber);
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
    } catch (err: any) {
      setBulkSelectionError(err.message || 'Invalid format');
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

  const validateStep = (stepIndex: number) => {
    const hasValidRooms = !includeRooms || (selectedRoomIds.size > 0 && !availabilityError);
    const hallValid = !includeHall || validateHallReservations();
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
        return hasValidRooms;
      case 3:
        return hallValid;
      case 4: {
        if (!hasValidRooms) return false;
        if (!includeHall) return true;
        return hallValid;
      }
      default:
        return true;
    }
  };

  const canProceed = validateStep(currentStep);

  const handleRoomToggle = (roomId: string) => {
    if (!includeRooms) return;
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const handleCategorySelectAll = (roomsList: any[]) => {
    if (!includeRooms) return;
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      roomsList.forEach((room) => next.add(room.id));
      return next;
    });
  };

  const handleCategoryClear = (roomsList: any[]) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      roomsList.forEach((room) => next.delete(room.id));
      return next;
    });
  };

  useEffect(() => {
    if (!includeRooms) {
      setSelectedRoomIds(new Set());
      setRoomSearch('');
      setCategoryFilter('all');
      setBulkSelectionInput('');
      setUnavailableRooms(new Set());
    }
  }, [includeRooms]);

  const toIsoString = (value: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  };

  const handleSubmit = async () => {
    if (!validateStep(WIZARD_STEPS.length - 1)) {
      toast.error('Please complete all required details before creating reservations.');
      return;
    }
    const checkInIso = toIsoString(formData.checkInDate);
    const checkOutIso = toIsoString(formData.checkOutDate);
    if (!checkInIso || !checkOutIso) {
      toast.error('Please select valid check-in and check-out dates.');
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

    const roomsPayload = includeRooms
      ? Array.from(selectedRoomIds)
          .map((roomId) => {
            const room = roomOptions.find((r) => r.id === roomId);
            return { room, roomId, nightly: resolveRoomRate(room) };
          })
          .filter((entry) => entry.room)
      : [];

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

    const hasRooms = includeRooms && roomsPayload.length > 0;
    const hasHalls = includeHall && (hallReservationsPayload?.length || 0) > 0;
    if (!hasRooms && !hasHalls) {
      toast.error('Add at least one room or hall reservation.');
      return;
    }

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
      if (hasRooms) {
        toast.success(`Created ${createdCount} reservation${createdCount === 1 ? '' : 's'}`);
      } else {
        toast.success('Hall booking captured');
      }
      onSuccess();
    } catch {
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
    setCurrentStep((prev) => Math.min(prev + 1, WIZARD_STEPS.length - 1));
  };

  const renderGuestStep = () => (
    <div className="stack">
      <Field label="Guest name" required htmlFor="res-guest-name">
        <TextInput
          id="res-guest-name"
          value={formData.guestName}
          onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
        />
      </Field>
      <div className="grid2">
        <Field label="Email" required htmlFor="res-guest-email">
          <TextInput
            id="res-guest-email"
            type="email"
            value={formData.guestEmail}
            onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
          />
        </Field>
        <Field label="Phone" required htmlFor="res-guest-phone">
          <TextInput
            id="res-guest-phone"
            type="tel"
            value={formData.guestPhone}
            onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Address" required htmlFor="res-guest-address">
        <Textarea
          id="res-guest-address"
          rows={3}
          value={formData.guestAddress}
          onChange={(e) => setFormData({ ...formData, guestAddress: e.target.value })}
        />
      </Field>
      <Field label="Notes" htmlFor="res-guest-notes" hint="Optional requests or remarks">
        <Textarea
          id="res-guest-notes"
          rows={3}
          value={formData.specialRequests}
          onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
        />
      </Field>
    </div>
  );

  const renderStayStep = () => (
    <div className="stack">
      <div className="grid2">
        <Field label="Check-in" required>
          <TextInput
            type="date"
            value={formData.checkInDate}
            onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
          />
        </Field>
        <Field label="Check-out" required>
          <TextInput
            type="date"
            value={formData.checkOutDate}
            onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
          />
        </Field>
        <Field label="Adults" required>
          <TextInput
            type="number"
            min={1}
            value={formData.adults}
            onChange={(e) =>
              setFormData({ ...formData, adults: Math.max(1, parseInt(e.target.value || '0', 10) || 1) })
            }
          />
        </Field>
        <Field label="Children">
          <TextInput
            type="number"
            min={0}
            value={formData.children}
            onChange={(e) =>
              setFormData({ ...formData, children: Math.max(0, parseInt(e.target.value || '0', 10) || 0) })
            }
          />
        </Field>
      </div>
      <div className={styles.availabilityBox}>
        {checkingAvailability ? (
          'Checking availability…'
        ) : availabilityError ? (
          <span className={styles.availabilityError}>{availabilityError}</span>
        ) : availabilitySummary ? (
          <span>
            {availabilitySummary.available} of {availabilitySummary.total} rooms available for{' '}
            {nights} night{nights === 1 ? '' : 's'}.
          </span>
        ) : (
          'Select dates to view availability.'
        )}
      </div>
    </div>
  );

  const renderRoomsStep = () => (
    <div className="stack">
      <div className={styles.toggleCard}>
        <div>
          <p className={styles.infoTitle}>Attach guest rooms</p>
          <p className={styles.infoSubtext}>
            Toggle off if this reservation doesn't need room assignments
          </p>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={includeRooms}
            onChange={(e) => setIncludeRooms(e.target.checked)}
          />
          Include rooms
        </label>
      </div>

      {includeRooms && (
        <FilterBar
          search={roomSearch}
          onSearchChange={setRoomSearch}
          searchPlaceholder="Search by room #, type, category"
        >
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            disabled={!roomOptions.length}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {hasUncategorizedRooms && <option value="none">Uncategorized</option>}
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </FilterBar>
      )}

      {includeRooms && (
        <div className={styles.infoCard}>
          <Field
            label='Bulk select (e.g. "101-105" or "201,203")'
            error={bulkSelectionError ?? undefined}
          >
            <div className="row wrap">
              <div className="grow">
                <TextInput
                  value={bulkSelectionInput}
                  onChange={(e) => {
                    setBulkSelectionInput(e.target.value);
                    setBulkSelectionError(null);
                  }}
                  placeholder="101-105, 210"
                  invalid={!!bulkSelectionError}
                />
              </div>
              <Button variant="primary" onClick={handleBulkSelection}>
                Add rooms
              </Button>
              {selectedRoomIds.size > 0 && (
                <Button variant="secondary" onClick={() => setSelectedRoomIds(new Set())}>
                  Clear
                </Button>
              )}
            </div>
          </Field>
          {unavailableRooms.size > 0 && (
            <p className="text-xs" style={{ color: 'var(--warning)', marginTop: 'var(--space-2)' }}>
              Unavailable: {Array.from(unavailableRooms).join(', ')}
            </p>
          )}
        </div>
      )}

      {!includeRooms ? (
        <EmptyState
          contained={false}
          title="Room booking disabled"
          description="Enable the toggle above if you need to attach guest rooms."
        />
      ) : roomsByCategory.length === 0 ? (
        <EmptyState
          contained={false}
          title={
            formData.checkInDate && formData.checkOutDate && hasAvailabilityRun
              ? 'No rooms match the filters'
              : 'Set stay dates first'
          }
          description="Adjust dates, filters, or category to load available rooms."
        />
      ) : (
        <div className={styles.roomsScroll}>
          {roomsByCategory.map((group) => {
            const selectedCount = group.rooms.filter((room) => selectedRoomIds.has(room.id)).length;
            return (
              <div key={group.id} className={styles.roomGroup}>
                <div className={styles.roomGroupHead}>
                  <div>
                    <p className={styles.infoTitle}>{group.name}</p>
                    <p className={styles.infoSubtext}>
                      {selectedCount}/{group.rooms.length} selected
                    </p>
                  </div>
                  <div className="row">
                    <Button size="sm" variant="secondary" onClick={() => handleCategorySelectAll(group.rooms)}>
                      Select all
                    </Button>
                    {selectedCount > 0 && (
                      <Button size="sm" variant="danger" onClick={() => handleCategoryClear(group.rooms)}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <div className={styles.roomList}>
                  {group.rooms.map((room) => {
                    const isSelected = selectedRoomIds.has(room.id);
                    const rate = resolveRoomRate(room);
                    const hasCustomRate = room.customRate !== undefined && room.customRate !== null;
                    return (
                      <button
                        type="button"
                        key={room.id}
                        onClick={() => handleRoomToggle(room.id)}
                        className={`${styles.roomCard} ${isSelected ? styles.roomCardSelected : ''}`}
                        aria-pressed={isSelected}
                      >
                        <div>
                          <p className={styles.infoTitle}>
                            Room {room.roomNumber} · {room.roomType}
                          </p>
                          <p className={styles.infoSubtext}>
                            {hasCustomRate ? 'Custom rate' : room.ratePlan?.name || 'Category rate'}
                          </p>
                        </div>
                        <div className={styles.roomRate}>
                          {formatMoney(rate, currency)}
                          <div className={styles.roomRateNote}>per night</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {includeRooms && selectedRoomIds.size > 0 && (
        <div className={styles.selectionSummary}>
          <p className={styles.infoSubtext}>Selected</p>
          <p className={styles.infoTitle} style={{ fontSize: 'var(--fs-xl)' }}>
            {selectedRoomIds.size} room{selectedRoomIds.size === 1 ? '' : 's'} ·{' '}
            {formatMoney(roomSubtotal, currency)}
          </p>
          <p className={styles.infoSubtext}>
            {selectedRoomDetails
              .map((room: any) => `${room.roomNumber} (${formatMoney(resolveRoomRate(room), currency)}/night)`)
              .join(', ')}
          </p>
        </div>
      )}
    </div>
  );

  const renderHallStep = () => (
    <div className="stack">
      <div className={styles.toggleCard}>
        <div>
          <p className={styles.infoTitle}>Add hall or event space</p>
          <p className={styles.infoSubtext}>Attach meeting halls to this reservation</p>
        </div>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={includeHall}
            onChange={(e) => setIncludeHall(e.target.checked)}
          />
          Include hall booking
        </label>
      </div>

      {includeHall && meetingHalls.length === 0 && (
        <EmptyState
          contained={false}
          title="No meeting halls configured"
          description="Configure halls in hotel settings first."
        />
      )}

      {includeHall && meetingHalls.length > 0 && (
        <>
          {hallReservations.map((reservation, index) => (
            <div key={reservation.id} className={styles.infoCard}>
              <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
                <p className={styles.infoTitle}>Hall reservation #{index + 1}</p>
                {hallReservations.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setHallReservations((prev) => prev.filter((r) => r.id !== reservation.id))
                    }
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="grid3">
                <Field label="Hall" required>
                  <Select
                    value={reservation.hallId}
                    onChange={(e) => handleHallChange(index, 'hallId', e.target.value)}
                  >
                    <option value="">Select hall</option>
                    {meetingHalls.map((hall) => (
                      <option key={hall.id} value={hall.id}>
                        {hall.name} (cap. {hall.capacity})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Event name">
                  <TextInput
                    value={reservation.eventName}
                    onChange={(e) => handleHallChange(index, 'eventName', e.target.value)}
                  />
                </Field>
                <Field label="Rate (flat)" required>
                  <TextInput
                    type="number"
                    value={reservation.rate}
                    onChange={(e) => handleHallChange(index, 'rate', e.target.value)}
                  />
                </Field>
                <Field label="Start" required>
                  <TextInput
                    type="datetime-local"
                    value={reservation.startDateTime}
                    onChange={(e) => handleHallChange(index, 'startDateTime', e.target.value)}
                  />
                </Field>
                <Field label="End" required>
                  <TextInput
                    type="datetime-local"
                    value={reservation.endDateTime}
                    onChange={(e) => handleHallChange(index, 'endDateTime', e.target.value)}
                  />
                </Field>
                <Field label="Attendees">
                  <TextInput
                    type="number"
                    min={0}
                    value={reservation.attendeeCount}
                    onChange={(e) => handleHallChange(index, 'attendeeCount', e.target.value)}
                  />
                </Field>
                <Field label="Purpose">
                  <TextInput
                    value={reservation.purpose}
                    onChange={(e) => handleHallChange(index, 'purpose', e.target.value)}
                  />
                </Field>
                <Field label="Setup type">
                  <TextInput
                    value={reservation.setupType}
                    onChange={(e) => handleHallChange(index, 'setupType', e.target.value)}
                  />
                </Field>
              </div>
              <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
                <Textarea
                  value={reservation.cateringNotes}
                  onChange={(e) => handleHallChange(index, 'cateringNotes', e.target.value)}
                  placeholder="Catering notes"
                  rows={2}
                />
                <Textarea
                  value={reservation.avRequirements}
                  onChange={(e) => handleHallChange(index, 'avRequirements', e.target.value)}
                  placeholder="A/V requirements"
                  rows={2}
                />
              </div>
            </div>
          ))}
          <Button variant="secondary" onClick={addHallReservation}>
            + Add another hall
          </Button>
        </>
      )}
    </div>
  );

  const renderInvoiceStep = () => (
    <div className="stack">
      <div className={styles.infoCard}>
        <p className={styles.infoTitle}>Guest</p>
        <p className={styles.infoText}>{formData.guestName}</p>
        <p className={styles.infoSubtext}>
          {formData.guestEmail} · {formData.guestPhone}
        </p>
        <p className={styles.infoSubtext}>{formData.guestAddress}</p>
      </div>
      <div className={styles.infoCard}>
        <p className={styles.infoTitle}>Stay</p>
        <p className={styles.infoText}>
          {formData.checkInDate || '—'} → {formData.checkOutDate || '—'} · {nightMultiplier} night
          {nightMultiplier === 1 ? '' : 's'}
        </p>
        <p className={styles.infoSubtext}>
          {formData.adults} adult{formData.adults === 1 ? '' : 's'}
          {formData.children ? ` · ${formData.children} child${formData.children === 1 ? '' : 'ren'}` : ''}
        </p>
      </div>
      <div className={styles.infoCard}>
        <p className={styles.infoTitle}>Rooms ({selectedRoomIds.size})</p>
        {includeRooms && selectedRoomDetails.length > 0 ? (
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            {selectedRoomDetails.map((room: any) => {
              const nightly = roomRates[room.id] || 0;
              return (
                <div key={room.id} className={styles.summaryRow}>
                  <span>
                    Room {room.roomNumber} · {room.roomType}
                  </span>
                  <span>
                    {formatMoney(nightly, currency)} × {nightMultiplier} ={' '}
                    {formatMoney(nightly * nightMultiplier, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.infoSubtext} style={{ marginTop: 'var(--space-2)' }}>
            No rooms attached to this booking.
          </p>
        )}
      </div>
      {includeHall && hallReservations.length > 0 && (
        <div className={styles.infoCard}>
          <p className={styles.infoTitle}>Hall bookings</p>
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            {hallReservations.map((reservation, index) => {
              const hallName =
                meetingHalls.find((hall) => hall.id === reservation.hallId)?.name ||
                `Hall ${index + 1}`;
              return (
                <div key={reservation.id} className={styles.summaryRow}>
                  <span>
                    {hallName} · {reservation.startDateTime || 'TBD'}
                  </span>
                  <span>{formatMoney(Number(reservation.rate) || 0, currency)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.invoiceTotal}>
        <p className={styles.invoiceTotalLabel}>Invoice total</p>
        <p className={styles.invoiceTotalValue}>{formatMoney(invoiceTotal, currency)}</p>
        <p className={styles.invoiceTotalSub}>
          Rooms: {formatMoney(roomSubtotal, currency)} · Halls:{' '}
          {formatMoney(includeHall ? hallTotal : 0, currency)}
        </p>
      </div>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0: return renderGuestStep();
      case 1: return renderStayStep();
      case 2: return renderRoomsStep();
      case 3: return renderHallStep();
      case 4: return renderInvoiceStep();
      default: return null;
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New reservation"
      subtitle="Capture guest info, stay, rooms, optional halls, and review the invoice"
      width="xl"
      footer={
        <div className="row-between" style={{ width: '100%' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <div className="row">
            {currentStep > 0 && (
              <Button variant="secondary" onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
            )}
            {currentStep < WIZARD_STEPS.length - 1 && (
              <Button variant="primary" onClick={goToNextStep} disabled={!canProceed}>
                Next
              </Button>
            )}
            {currentStep === WIZARD_STEPS.length - 1 && (
              <Button variant="primary" onClick={handleSubmit} loading={modalLoading}>
                Create reservation
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <Stepper
          steps={WIZARD_STEPS}
          current={currentStep}
          onStepClick={(i) => setCurrentStep(i)}
        />
      </div>
      {renderStep()}
    </Modal>
  );
}
