import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import DepositPolicyModal from '../components/DepositPolicyModal';
import Layout from '../components/Layout';
import { Plus, Pencil, Trash2, Calculator, Settings, Banknote } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  SkeletonTable,
  StatusBadge,
  TextInput,
} from '../components/ui';
import type { Column } from '../components/ui/DataTable';
import styles from './DepositManagementPage.module.css';

interface DepositPolicy {
  id: string;
  name: string;
  description?: string;
  depositType: 'percentage' | 'fixed' | 'first_night';
  depositValue: number;
  maxDepositAmount?: number;
  minDepositAmount?: number;
  appliesToAllRooms: boolean;
  roomCategoryIds: string[];
  ratePlanIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AppliedPolicy {
  policy: { id: string; name: string; depositType: string; depositValue: number };
  depositAmount: number;
}

interface DepositCalculation {
  depositRequired: boolean;
  depositAmount: number;
  appliedPolicies: AppliedPolicy[];
}

interface DepositPayment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference?: string;
  refundAmount?: number;
  refundReason?: string;
  paidAt?: string;
  createdAt: string;
  reservation: {
    id: string;
    reservationNumber: string;
    guestName: string;
    checkInDate: string;
    checkOutDate: string;
  };
}

const DEPOSIT_TYPE_LABEL: Record<string, string> = {
  percentage: 'Percentage',
  fixed: 'Fixed amount',
  first_night: 'First night',
};

export default function DepositManagementPage() {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const money = (n?: number | null) => formatMoney(n, settings.currencySymbol);

  const [activeTab, setActiveTab] = useState<'policies' | 'calculator' | 'payments'>('policies');
  const [policies, setPolicies] = useState<DepositPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DepositPolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepositPolicy | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Calculator state — matches POST /deposits/calculate { roomId?, checkInDate?, totalAmount, nightlyRate? }
  const [rooms, setRooms] = useState<any[]>([]);
  const [calcForm, setCalcForm] = useState({
    roomId: '',
    checkInDate: '',
    totalAmount: '',
    nightlyRate: '',
  });
  const [calculation, setCalculation] = useState<DepositCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Payments tab
  const [payments, setPayments] = useState<DepositPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');

  const loadPolicies = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/deposits/policies`);
      setPolicies(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load deposit policies');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  const loadPayments = useCallback(async () => {
    if (!user?.tenantId) return;
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const params = paymentStatusFilter ? { status: paymentStatusFilter } : {};
      const response = await api.get(`/tenants/${user.tenantId}/deposits/payments`, { params });
      setPayments(response.data.data || []);
    } catch (err: any) {
      setPaymentsError(err.response?.data?.error?.message || 'Failed to load deposit payments');
    } finally {
      setPaymentsLoading(false);
    }
  }, [user?.tenantId, paymentStatusFilter]);

  useEffect(() => {
    loadPolicies();
    api
      .get(`/tenants/${user?.tenantId}/rooms`)
      .then((res) => setRooms(res.data.data || []))
      .catch(() => setRooms([]));
  }, [loadPolicies, user?.tenantId]);

  useEffect(() => {
    if (activeTab === 'payments') loadPayments();
  }, [activeTab, loadPayments]);

  const handleCalculate = async () => {
    if (!user?.tenantId) return;
    const totalAmount = parseFloat(calcForm.totalAmount);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      toast.error('A valid booking total is required');
      return;
    }
    setCalculating(true);
    setCalculation(null);
    try {
      const response = await api.post(`/tenants/${user.tenantId}/deposits/calculate`, {
        roomId: calcForm.roomId || undefined,
        checkInDate: calcForm.checkInDate || undefined,
        totalAmount,
        nightlyRate: calcForm.nightlyRate ? parseFloat(calcForm.nightlyRate) : undefined,
      });
      setCalculation(response.data.data);
    } catch {
      // Error handled by API interceptor
    } finally {
      setCalculating(false);
    }
  };

  const handleDeletePolicy = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/tenants/${user?.tenantId}/deposits/policies/${deleteTarget.id}`);
      toast.success('Deposit policy deleted');
      setDeleteTarget(null);
      loadPolicies();
    } catch {
      // Error handled by API interceptor
    } finally {
      setDeleting(false);
    }
  };

  const tabs = [
    { id: 'policies', label: 'Policies', icon: Settings },
    { id: 'calculator', label: 'Calculator', icon: Calculator },
    { id: 'payments', label: 'Payments', icon: Banknote },
  ];

  const paymentColumns: Column<DepositPayment>[] = [
    {
      key: 'res',
      header: 'Reservation',
      render: (p) => (
        <div>
          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{p.reservation?.reservationNumber}</div>
          <div className="text-xs muted">{p.reservation?.guestName}</div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Stay',
      render: (p) => (
        <span className="text-sm muted">
          {p.reservation ? `${format(new Date(p.reservation.checkInDate), 'MMM dd')} → ${format(new Date(p.reservation.checkOutDate), 'MMM dd')}` : '—'}
        </span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (p) => <span style={{ fontWeight: 600 }}>{money(p.amount)}</span>,
    },
    { key: 'method', header: 'Method', render: (p) => p.method },
    {
      key: 'ref',
      header: 'Reference',
      render: (p) => (
        <span className="text-xs muted" style={{ fontFamily: 'monospace' }}>
          {p.reference || '—'}
        </span>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      render: (p) => (
        <span className="text-sm muted">
          {p.paidAt ? format(new Date(p.paidAt), 'MMM dd, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => (
        <div className="stack" style={{ gap: 4, alignItems: 'flex-start' }}>
          <StatusBadge status={p.status} />
          {p.refundAmount != null && (
            <span className="text-xs muted">Refunded {money(p.refundAmount)}</span>
          )}
        </div>
      ),
    },
  ];

  const heldTotal = payments
    .filter((p) => p.status === 'held' || p.status === 'paid' || p.status === 'completed')
    .reduce((s, p) => s + Number(p.amount), 0);

  return (
    <Layout>
      <PageHeader
        title="Deposit management"
        subtitle="Manage deposit policies, calculate deposits, and track payments"
        actions={
          activeTab === 'policies' ? (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setEditingPolicy(null);
                setShowPolicyModal(true);
              }}
            >
              New policy
            </Button>
          ) : undefined
        }
      />

      <div className="tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <tab.icon size={16} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'policies' && (
        <>
          {loading ? (
            <div className={styles.policyGrid}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} height="170px" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={loadPolicies} />
          ) : policies.length === 0 ? (
            <EmptyState
              icon={<Settings size={28} strokeWidth={1.6} />}
              title="No deposit policies"
              description="Create your first deposit policy to start managing deposits"
              action={
                <Button variant="primary" onClick={() => setShowPolicyModal(true)}>
                  Create policy
                </Button>
              }
            />
          ) : (
            <div className={styles.policyGrid}>
              {policies.map((policy) => (
                <div key={policy.id} className={styles.policyCard}>
                  <div className={styles.policyHead}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{policy.name}</div>
                      {policy.description && (
                        <div className="text-sm muted">{policy.description}</div>
                      )}
                    </div>
                    <div className="row" style={{ gap: 'var(--space-1)' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Edit policy"
                        onClick={() => {
                          setEditingPolicy(policy);
                          setShowPolicyModal(true);
                        }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Delete policy"
                        onClick={() => setDeleteTarget(policy)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>

                  <div className={styles.policyKv}>
                    <div>
                      <span className="muted">Type:</span>{' '}
                      <strong>{DEPOSIT_TYPE_LABEL[policy.depositType] ?? policy.depositType}</strong>
                    </div>
                    <div>
                      <span className="muted">Value:</span>{' '}
                      <strong>
                        {policy.depositType === 'percentage'
                          ? `${policy.depositValue}%`
                          : money(policy.depositValue)}
                      </strong>
                    </div>
                    <div>
                      <span className="muted">Status:</span>{' '}
                      <StatusBadge tone={policy.isActive ? 'success' : 'danger'} dot={false}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </StatusBadge>
                    </div>
                    <div>
                      <span className="muted">Rooms:</span>{' '}
                      <strong>
                        {policy.appliesToAllRooms
                          ? 'All'
                          : `${policy.roomCategoryIds.length + policy.ratePlanIds.length} scoped`}
                      </strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'calculator' && (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <Panel title="Calculate deposit">
            <div className="stack">
              <Field label="Room" hint="Optional — resolves category and rate plan">
                <Select
                  value={calcForm.roomId}
                  onChange={(e) => setCalcForm((f) => ({ ...f, roomId: e.target.value }))}
                >
                  <option value="">Any room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} — {r.roomType}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Check-in date" hint="Optional — weekend rules apply">
                <TextInput
                  type="date"
                  value={calcForm.checkInDate}
                  onChange={(e) => setCalcForm((f) => ({ ...f, checkInDate: e.target.value }))}
                />
              </Field>
              <Field label={`Booking total (${settings.currencySymbol})`} required>
                <TextInput
                  type="number"
                  min="0"
                  value={calcForm.totalAmount}
                  onChange={(e) => setCalcForm((f) => ({ ...f, totalAmount: e.target.value }))}
                  placeholder="e.g. 75000"
                />
              </Field>
              <Field label={`Nightly rate (${settings.currencySymbol})`} hint="Required for first-night policies">
                <TextInput
                  type="number"
                  min="0"
                  value={calcForm.nightlyRate}
                  onChange={(e) => setCalcForm((f) => ({ ...f, nightlyRate: e.target.value }))}
                  placeholder="e.g. 25000"
                />
              </Field>
              <Button
                variant="primary"
                block
                icon={<Calculator size={16} />}
                loading={calculating}
                onClick={handleCalculate}
              >
                Calculate deposit
              </Button>
            </div>
          </Panel>

          <Panel title="Result">
            {calculation ? (
              <div className="stack">
                <div className={styles.result}>
                  <div className={styles.resultAmount}>{money(calculation.depositAmount)}</div>
                  <div className="text-sm muted">
                    {calculation.depositRequired ? 'Required deposit' : 'No deposit required'}
                  </div>
                </div>
                {calculation.appliedPolicies.length > 0 && (
                  <div>
                    <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                      Applied policies
                    </div>
                    {calculation.appliedPolicies.map((ap) => (
                      <div key={ap.policy.id} className={styles.policyLine}>
                        <div>
                          <div style={{ fontWeight: 500, color: 'var(--text)' }}>{ap.policy.name}</div>
                          <div className="text-xs muted">
                            {DEPOSIT_TYPE_LABEL[ap.policy.depositType] ?? ap.policy.depositType} ·{' '}
                            {ap.policy.depositType === 'percentage'
                              ? `${ap.policy.depositValue}%`
                              : money(ap.policy.depositValue)}
                          </div>
                        </div>
                        <span style={{ fontWeight: 600 }}>{money(ap.depositAmount)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-xs muted">
                  When several policies apply, the highest required amount is used.
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<Calculator size={28} strokeWidth={1.6} />}
                title="No calculation yet"
                description="Enter a booking total and calculate to see the required deposit"
              />
            )}
          </Panel>
        </div>
      )}

      {activeTab === 'payments' && (
        <>
          <FilterBar
            activeCount={paymentStatusFilter ? 1 : 0}
            onClear={() => setPaymentStatusFilter('')}
          >
            <Select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="held">Held</option>
              <option value="paid">Paid</option>
              <option value="completed">Completed</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
            </Select>
            <span className="text-sm muted" style={{ marginLeft: 'auto' }}>
              Held/paid total: <strong style={{ color: 'var(--text)' }}>{money(heldTotal)}</strong>
            </span>
          </FilterBar>

          {paymentsLoading ? (
            <SkeletonTable rows={6} cols={6} />
          ) : paymentsError ? (
            <ErrorState message={paymentsError} onRetry={loadPayments} />
          ) : payments.length === 0 ? (
            <EmptyState
              icon={<Banknote size={28} strokeWidth={1.6} />}
              title="No deposit payments"
              description={
                paymentStatusFilter
                  ? 'No payments match this status'
                  : 'Deposit payments recorded against reservations will appear here'
              }
            />
          ) : (
            <DataTable columns={paymentColumns} data={payments} rowKey={(p) => p.id} />
          )}
        </>
      )}

      <DepositPolicyModal
        isOpen={showPolicyModal}
        onClose={() => {
          setShowPolicyModal(false);
          setEditingPolicy(null);
        }}
        policy={editingPolicy}
        onSuccess={() => {
          loadPolicies();
          setShowPolicyModal(false);
          setEditingPolicy(null);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeletePolicy}
        title="Delete deposit policy"
        confirmLabel="Delete policy"
        loading={deleting}
        destructive
      >
        {`Delete "${deleteTarget?.name}"? Reservations will no longer be charged this deposit.`}
      </ConfirmDialog>
    </Layout>
  );
}
