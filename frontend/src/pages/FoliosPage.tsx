import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Printer, Receipt, Plus, CreditCard } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { printFolio } from '../utils/print';
import { useDebounce } from '../hooks/useDebounce';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import {
  Button,
  ChargeSummary,
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
  TextInput,
  Textarea,
} from '../components/ui';
import type { Column } from '../components/ui/DataTable';

interface Folio {
  id: string;
  guestName: string;
  status: string;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  room?: {
    roomNumber: string;
  };
  charges: any[];
  payments: any[];
}

const fmtDate = (d: string) => format(new Date(d), 'MMM dd, yyyy HH:mm');

export default function FoliosPage() {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const money = (n?: number | null) => formatMoney(n, settings.currencySymbol);

  const [folios, setFolios] = useState<Folio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolio, setSelectedFolio] = useState<Folio | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filters, setFilters] = useState({ status: '', startDate: '', endDate: '' });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });

  const fetchFolios = useCallback(
    async (page = pagination.page) => {
      if (!user?.tenantId) return;
      setLoading(true);
      setError(null);
      try {
        const params: any = { page, limit: pagination.limit };
        if (filters.status) params.status = filters.status;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        const response = await api.get(`/tenants/${user.tenantId}/folios`, { params });
        setFolios(response.data.data || []);
        if (response.data.pagination) setPagination(response.data.pagination);
      } catch (err: any) {
        setError(err.response?.data?.error?.message || 'Failed to fetch folios');
        setFolios([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.tenantId, filters, pagination.limit, pagination.page]
  );

  useEffect(() => {
    fetchFolios(pagination.page);
  }, [fetchFolios, pagination.page]);

  const handleViewDetails = async (folioId: string) => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/folios/${folioId}`);
      setSelectedFolio(response.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to fetch folio details');
    }
  };

  const filteredFolios = useMemo(
    () =>
      folios.filter((folio) => {
        if (!debouncedSearchTerm) return true;
        const s = debouncedSearchTerm.toLowerCase();
        return (
          folio.guestName.toLowerCase().includes(s) ||
          folio.room?.roomNumber.toLowerCase().includes(s) ||
          folio.status.toLowerCase().includes(s)
        );
      }),
    [folios, debouncedSearchTerm]
  );

  const setFilter = (patch: Partial<typeof filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const activeFilterCount =
    (filters.status ? 1 : 0) + (filters.startDate ? 1 : 0) + (filters.endDate ? 1 : 0);

  const columns: Column<Folio>[] = [
    {
      key: 'guest',
      header: 'Guest',
      render: (f) => <span style={{ fontWeight: 500, color: 'var(--text)' }}>{f.guestName}</span>,
    },
    { key: 'room', header: 'Room', render: (f) => f.room?.roomNumber ?? '—' },
    {
      key: 'charges',
      header: 'Charges',
      align: 'right',
      render: (f) => <span style={{ fontWeight: 500 }}>{money(f.totalCharges)}</span>,
    },
    {
      key: 'payments',
      header: 'Payments',
      align: 'right',
      render: (f) => <span style={{ fontWeight: 500, color: 'var(--success)' }}>{money(f.totalPayments)}</span>,
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      render: (f) => (
        <span style={{ fontWeight: 600, color: Number(f.balance) > 0 ? 'var(--danger)' : 'var(--success)' }}>
          {money(f.balance)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} /> },
  ];

  return (
    <Layout>
      <PageHeader
        title="Folios"
        subtitle={pagination.total > 0 ? `${pagination.total} total folio${pagination.total !== 1 ? 's' : ''}` : 'Guest billing'}
      />

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search by guest, room, or status…"
        activeCount={activeFilterCount}
        onClear={() => setFilter({ status: '', startDate: '', endDate: '' })}
      >
        <Select
          value={filters.status}
          onChange={(e) => setFilter({ status: e.target.value })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
          <option value="voided">Voided</option>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setFilter({
              status: '',
              startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
              endDate: format(new Date(), 'yyyy-MM-dd'),
            })
          }
        >
          Last 7 days
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setFilter({
              status: '',
              startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
              endDate: format(new Date(), 'yyyy-MM-dd'),
            })
          }
        >
          Last 30 days
        </Button>
      </FilterBar>

      {loading ? (
        <SkeletonTable rows={8} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchFolios()} />
      ) : filteredFolios.length === 0 ? (
        <EmptyState
          icon={<Receipt size={28} strokeWidth={1.6} />}
          title={
            debouncedSearchTerm || activeFilterCount > 0
              ? 'No folios match your filters'
              : 'No folios yet'
          }
          description={
            debouncedSearchTerm || activeFilterCount > 0
              ? 'Try adjusting your search or filter criteria'
              : 'Folios will appear here when guests make reservations'
          }
        />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={filteredFolios}
            rowKey={(f) => f.id}
            onRowClick={(f) => handleViewDetails(f.id)}
          />
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            limit={pagination.limit}
            onPageChange={(newPage) => {
              setPagination((p) => ({ ...p, page: newPage }));
              fetchFolios(newPage);
            }}
          />
        </>
      )}

      <FolioDetailsDrawer
        folio={selectedFolio}
        currency={settings.currencySymbol}
        onClose={() => setSelectedFolio(null)}
        onRefresh={() => selectedFolio && handleViewDetails(selectedFolio.id)}
      />
    </Layout>
  );
}

/* ---------- Folio detail drawer ---------- */

function FolioDetailsDrawer({
  folio,
  currency,
  onClose,
  onRefresh,
}: {
  folio: Folio | null;
  currency: string;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const money = (n?: number | null) => formatMoney(n, currency);

  return (
    <DetailDrawer
      open={!!folio}
      onClose={onClose}
      title={folio ? `Folio — ${folio.guestName}` : 'Folio'}
      width="lg"
      headerExtra={
        folio ? (
          <div className="row">
            <StatusBadge status={folio.status} />
            <span className="text-sm muted">Room {folio.room?.roomNumber ?? '—'}</span>
          </div>
        ) : undefined
      }
      footer={
        folio ? (
          <div className="row wrap">
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddCharge(true)}>
              Add charge
            </Button>
            <Button variant="primary" size="sm" icon={<CreditCard size={14} />} onClick={() => setShowAddPayment(true)}>
              Add payment
            </Button>
            <Button variant="ghost" size="sm" icon={<Printer size={14} />} onClick={() => printFolio(folio)}>
              Print
            </Button>
          </div>
        ) : undefined
      }
    >
      {folio && (
        <div className="stack-lg">
          <div className="grid3">
            <MiniStat label="Charges" value={money(folio.totalCharges)} />
            <MiniStat label="Payments" value={money(folio.totalPayments)} color="var(--success)" />
            <MiniStat
              label="Balance"
              value={money(folio.balance)}
              color={Number(folio.balance) > 0 ? 'var(--danger)' : 'var(--success)'}
            />
          </div>

          <section>
            <h3 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Charges
            </h3>
            {folio.charges?.length ? (
              <DataTable
                columns={[
                  { key: 'desc', header: 'Description', render: (c: any) => c.description },
                  { key: 'cat', header: 'Category', render: (c: any) => <StatusBadge status={c.category} dot={false} /> },
                  {
                    key: 'amt',
                    header: 'Amount',
                    align: 'right',
                    render: (c: any) => <span style={{ fontWeight: 500 }}>{money(c.total)}</span>,
                  },
                ]}
                data={folio.charges}
                rowKey={(c: any) => c.id}
              />
            ) : (
              <div className="text-sm muted">No charges</div>
            )}
          </section>

          <section>
            <h3 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Payments
            </h3>
            {folio.payments?.length ? (
              <DataTable
                columns={[
                  { key: 'date', header: 'Date', render: (p: any) => fmtDate(p.createdAt) },
                  { key: 'method', header: 'Method', render: (p: any) => p.method },
                  {
                    key: 'amt',
                    header: 'Amount',
                    align: 'right',
                    render: (p: any) => (
                      <span style={{ fontWeight: 500, color: 'var(--success)' }}>{money(p.amount)}</span>
                    ),
                  },
                  { key: 'status', header: 'Status', render: (p: any) => <StatusBadge status={p.status} /> },
                ]}
                data={folio.payments}
                rowKey={(p: any) => p.id}
              />
            ) : (
              <div className="text-sm muted">No payments</div>
            )}
          </section>

          <ChargeSummary
            title="Folio summary"
            lines={[
              { label: 'Total charges', amount: Number(folio.totalCharges) },
              { label: 'Total payments', amount: Number(folio.totalPayments), negative: true },
            ]}
            total={Number(folio.balance)}
            totalLabel="Balance due"
            currency={currency}
          />
        </div>
      )}

      <AddChargeModal
        open={showAddCharge}
        folioId={folio?.id ?? ''}
        currency={currency}
        onClose={() => setShowAddCharge(false)}
        onSuccess={() => {
          setShowAddCharge(false);
          onRefresh();
        }}
      />
      <AddPaymentModal
        open={showAddPayment}
        folioId={folio?.id ?? ''}
        currency={currency}
        onClose={() => setShowAddPayment(false)}
        onSuccess={() => {
          setShowAddPayment(false);
          onRefresh();
        }}
      />
    </DetailDrawer>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: 'var(--surface-raised)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3)',
      }}
    >
      <div className="text-xs muted">{label}</div>
      <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: color ?? 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

/* ---------- Add charge ---------- */

function AddChargeModal({
  open,
  folioId,
  currency,
  onClose,
  onSuccess,
}: {
  open: boolean;
  folioId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    description: '',
    category: 'other' as 'room_rate' | 'extra' | 'tax' | 'discount' | 'other',
    amount: '',
    quantity: '1',
    taxRate: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setFormData({ description: '', category: 'other', amount: '', quantity: '1', taxRate: '' });
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/folios/${folioId}/charges`, {
        description: formData.description,
        category: formData.category,
        amount: parseFloat(formData.amount),
        quantity: parseInt(formData.quantity),
        taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
      });
      toast.success('Charge added successfully');
      onSuccess();
    } catch {
      // Error is handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add charge"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>
            Add charge
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="stack">
        <Field label="Description" required>
          <TextInput
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            placeholder="e.g., Room service, mini bar"
          />
        </Field>
        <Field label="Category" required>
          <Select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
            required
          >
            <option value="room_rate">Room rate</option>
            <option value="extra">Extra</option>
            <option value="tax">Tax</option>
            <option value="discount">Discount</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <div className="grid2">
          <Field label={`Amount (${currency})`} required>
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
              placeholder="0.00"
            />
          </Field>
          <Field label="Quantity" required>
            <TextInput
              type="number"
              min="1"
              value={formData.quantity}
              onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="Tax rate (%)" hint="Optional">
          <TextInput
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={formData.taxRate}
            onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ---------- Add payment ---------- */

function AddPaymentModal({
  open,
  folioId,
  currency,
  onClose,
  onSuccess,
}: {
  open: boolean;
  folioId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash' as 'card' | 'bank_transfer' | 'cash' | 'other',
    reference: '',
    paymentGateway: 'manual' as 'paystack' | 'flutterwave' | 'stripe' | 'manual',
    gatewayTransactionId: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open)
      setFormData({
        amount: '',
        method: 'cash',
        reference: '',
        paymentGateway: 'manual',
        gatewayTransactionId: '',
        notes: '',
      });
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/payments`, {
        folioId,
        amount: parseFloat(formData.amount),
        method: formData.method,
        reference: formData.reference || undefined,
        paymentGateway: formData.paymentGateway !== 'manual' ? formData.paymentGateway : undefined,
        gatewayTransactionId: formData.gatewayTransactionId || undefined,
        notes: formData.notes || undefined,
      });
      toast.success('Payment added successfully');
      onSuccess();
    } catch {
      // Error is handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add payment"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={handleSubmit}>
            Add payment
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="stack">
        <Field label={`Amount (${currency})`} required>
          <TextInput
            type="number"
            step="0.01"
            min="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
            placeholder="0.00"
          />
        </Field>
        <div className="grid2">
          <Field label="Payment method" required>
            <Select
              value={formData.method}
              onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
              required
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Gateway">
            <Select
              value={formData.paymentGateway}
              onChange={(e) => setFormData({ ...formData, paymentGateway: e.target.value as any })}
            >
              <option value="manual">Manual entry</option>
              <option value="paystack">Paystack</option>
              <option value="flutterwave">Flutterwave</option>
              <option value="stripe">Stripe</option>
            </Select>
          </Field>
        </div>
        {formData.paymentGateway !== 'manual' && (
          <Field label="Gateway transaction ID">
            <TextInput
              value={formData.gatewayTransactionId}
              onChange={(e) => setFormData({ ...formData, gatewayTransactionId: e.target.value })}
              placeholder="Transaction ID from gateway"
            />
          </Field>
        )}
        <Field label="Reference number" hint="Optional">
          <TextInput
            value={formData.reference}
            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
          />
        </Field>
        <Field label="Notes" hint="Optional">
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
          />
        </Field>
      </form>
    </Modal>
  );
}
