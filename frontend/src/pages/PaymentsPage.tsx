import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { CreditCard, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  FilterBar,
  PageHeader,
  Select,
  SkeletonTable,
  StatusBadge,
  TextInput,
} from '../components/ui';
import type { Column } from '../components/ui/DataTable';
import styles from './PaymentsPage.module.css';

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference?: string;
  paymentGateway?: string;
  gatewayTransactionId?: string;
  reconciled: boolean;
  reconciledAt?: string;
  createdAt: string;
  folio: {
    id: string;
    guestName: string;
    room: {
      roomNumber: string;
    };
  };
  user: {
    firstName: string;
    lastName: string;
  };
}

const METHOD_TONES: Record<string, 'info' | 'success' | 'warning' | 'neutral'> = {
  card: 'info',
  bank_transfer: 'success',
  cash: 'warning',
  other: 'neutral',
};

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const money = (n?: number | null) => formatMoney(n, settings.currencySymbol);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [reconcilingPayments, setReconcilingPayments] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    reconciled: '',
    startDate: '',
    endDate: '',
  });
  const [activeTab, setActiveTab] = useState<'all' | 'reconcile'>('all');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchPayments = useCallback(
    async (page = pagination.page) => {
      if (!user?.tenantId) return;
      setLoading(true);
      setError(null);
      try {
        let response;
        if (activeTab === 'reconcile') {
          response = await api.get(`/tenants/${user.tenantId}/payments`, {
            params: { page, limit: pagination.limit, reconciled: 'false' },
          });
        } else {
          const params: any = { page, limit: pagination.limit };
          if (filters.status) params.status = filters.status;
          if (filters.method) params.method = filters.method;
          if (filters.reconciled) params.reconciled = filters.reconciled;
          if (filters.startDate) params.startDate = filters.startDate;
          if (filters.endDate) params.endDate = filters.endDate;
          response = await api.get(`/tenants/${user.tenantId}/payments`, { params });
        }
        setPayments(response.data.data || []);
        if (response.data.pagination) setPagination(response.data.pagination);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to fetch payments');
        setPayments([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.tenantId, activeTab, filters, pagination.limit, pagination.page]
  );

  useEffect(() => {
    fetchPayments(pagination.page);
  }, [fetchPayments, pagination.page]);

  const handleReconcile = async (paymentId: string) => {
    setReconcilingPayments((prev) => new Set(prev).add(paymentId));
    try {
      await api.post(`/tenants/${user?.tenantId}/payments/${paymentId}/reconcile`);
      toast.success('Payment reconciled successfully');
      fetchPayments();
    } catch {
      // Error handled by API interceptor
    } finally {
      setReconcilingPayments((prev) => {
        const next = new Set(prev);
        next.delete(paymentId);
        return next;
      });
    }
  };

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        if (!debouncedSearchTerm) return true;
        const s = debouncedSearchTerm.toLowerCase();
        return (
          payment.reference?.toLowerCase().includes(s) ||
          payment.folio.guestName.toLowerCase().includes(s) ||
          payment.folio.room?.roomNumber.toLowerCase().includes(s) ||
          payment.gatewayTransactionId?.toLowerCase().includes(s) ||
          `${payment.user.firstName} ${payment.user.lastName}`.toLowerCase().includes(s)
        );
      }),
    [payments, debouncedSearchTerm]
  );

  const setFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const unreconciledCount = payments.filter((p) => !p.reconciled).length;
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const subtitleParts = [`${payments.length} payments`, `Total: ${money(totalAmount)}`];
  if (unreconciledCount > 0) subtitleParts.push(`${unreconciledCount} unreconciled`);

  const columns: Column<Payment>[] = [
    {
      key: 'date',
      header: 'Date',
      render: (p) => (
        <span className="text-sm muted">{format(new Date(p.createdAt), 'MMM dd, yyyy HH:mm')}</span>
      ),
    },
    {
      key: 'guest',
      header: 'Guest',
      render: (p) => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{p.folio.guestName}</span>,
    },
    { key: 'room', header: 'Room', render: (p) => p.folio.room?.roomNumber ?? '—' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => <span style={{ fontWeight: 600 }}>{money(p.amount)}</span>,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => <StatusBadge status={p.method} tone={METHOD_TONES[p.method]} />,
    },
    {
      key: 'ref',
      header: 'Reference',
      render: (p) => <span className={styles.ref}>{p.reference || '—'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
          <StatusBadge status={p.status} />
          {!p.reconciled && (
            <StatusBadge tone="warning" dot={false}>
              Unreconciled
            </StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p) =>
        !p.reconciled && activeTab === 'reconcile' ? (
          <Button
            variant="primary"
            size="sm"
            icon={<CheckCircle size={14} />}
            loading={reconcilingPayments.has(p.id)}
            onClick={(e) => {
              e.stopPropagation();
              handleReconcile(p.id);
            }}
          >
            Reconcile
          </Button>
        ) : p.reconciled ? (
          <span className="text-xs muted">
            Reconciled {p.reconciledAt && format(new Date(p.reconciledAt), 'MMM dd')}
          </span>
        ) : null,
    },
  ];

  return (
    <Layout>
      <PageHeader title="Payments" subtitle={subtitleParts.join(' · ')} />

      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'all'}
          className={`${styles.tab} ${activeTab === 'all' ? styles.active : ''}`}
          onClick={() => {
            setActiveTab('all');
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          All payments
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'reconcile'}
          className={`${styles.tab} ${activeTab === 'reconcile' ? styles.active : ''}`}
          onClick={() => {
            setActiveTab('reconcile');
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        >
          Reconciliation
          {unreconciledCount > 0 && <span className={styles.countChip}>{unreconciledCount}</span>}
        </button>
      </div>

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by reference, guest, room, or transaction ID…"
        activeCount={activeTab === 'all' ? activeFilterCount : 0}
        onClear={() =>
          setFilters({ status: '', method: '', reconciled: '', startDate: '', endDate: '' })
        }
      >
        {activeTab === 'all' && (
          <>
            <Select
              value={filters.status}
              onChange={(e) => setFilter({ status: e.target.value })}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </Select>
            <Select
              value={filters.method}
              onChange={(e) => setFilter({ method: e.target.value })}
              aria-label="Filter by method"
            >
              <option value="">All methods</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="other">Other</option>
            </Select>
            <Select
              value={filters.reconciled}
              onChange={(e) => setFilter({ reconciled: e.target.value })}
              aria-label="Filter by reconciliation"
            >
              <option value="">All</option>
              <option value="true">Reconciled</option>
              <option value="false">Unreconciled</option>
            </Select>
            <TextInput
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilter({ startDate: e.target.value })}
              aria-label="From date"
            />
            <TextInput
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilter({ endDate: e.target.value })}
              aria-label="To date"
            />
          </>
        )}
      </FilterBar>

      {loading ? (
        <SkeletonTable rows={8} cols={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchPayments()} />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={<CreditCard size={28} strokeWidth={1.6} />}
          title={
            debouncedSearchTerm || activeFilterCount > 0
              ? 'No payments match your filters'
              : 'No payments yet'
          }
          description={
            debouncedSearchTerm || activeFilterCount > 0
              ? 'Try adjusting your search or filter criteria'
              : 'Payments will appear here when guests make transactions'
          }
        />
      ) : (
        <>
          <DataTable columns={columns} data={filteredPayments} rowKey={(p) => p.id} />
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={(newPage) => {
              setPagination((p) => ({ ...p, page: newPage }));
              fetchPayments(newPage);
            }}
          />
        </>
      )}
    </Layout>
  );
}
