import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Pencil, Trash2, UserPlus, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  RoleGate,
  Select,
  Skeleton,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';
import { ErrorState } from '../components/ui';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import styles from './WagePlansPage.module.css';

interface AssignedStaff {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface WagePlan {
  id: string;
  name: string;
  description?: string | null;
  payType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'salary';
  amount: number;
  currency: string;
  payFrequency: 'weekly' | 'biweekly' | 'monthly';
  isActive: boolean;
  assignedStaff?: AssignedStaff[];
  assignedCount?: number;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  permissions?: { wagePlanId?: string } | null;
}

const PAY_TYPES: { value: WagePlan['payType']; label: string }[] = [
  { value: 'hourly', label: 'Per hour' },
  { value: 'daily', label: 'Per day' },
  { value: 'weekly', label: 'Per week' },
  { value: 'monthly', label: 'Per month' },
  { value: 'salary', label: 'Salary (annual)' },
];

const PAY_FREQUENCIES: { value: WagePlan['payFrequency']; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every two weeks' },
  { value: 'monthly', label: 'Monthly' },
];

const payTypeLabel = (t: WagePlan['payType']) => PAY_TYPES.find((p) => p.value === t)?.label ?? t;

const MANAGER_ROLES = ['owner', 'general_manager'];

interface FormState {
  name: string;
  description: string;
  payType: WagePlan['payType'];
  amount: string;
  currency: string;
  payFrequency: WagePlan['payFrequency'];
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  payType: 'monthly',
  amount: '',
  currency: 'NGN',
  payFrequency: 'monthly',
  isActive: true,
};

export default function WagePlansPage() {
  const { user } = useAuthStore();
  const { currencySymbol } = useTenantSettings();
  const [wagePlans, setWagePlans] = useState<WagePlan[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterActive, setFilterActive] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [editingPlan, setEditingPlan] = useState<WagePlan | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WagePlan | null>(null);
  const [assignPlan, setAssignPlan] = useState<WagePlan | null>(null);
  const [assignStaffId, setAssignStaffId] = useState('');

  const fetchWagePlans = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filterActive) params.isActive = filterActive;
      const response = await api.get(`/tenants/${user.tenantId}/wage-plans`, { params });
      setWagePlans(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch wage plans');
      setWagePlans([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filterActive]);

  useEffect(() => {
    fetchWagePlans();
    api
      .get(`/tenants/${user?.tenantId}/staff`)
      .then((res) => setStaff(res.data.data || []))
      .catch(() => setStaff([]));
  }, [fetchWagePlans, user?.tenantId]);

  const openEdit = (plan: WagePlan) => {
    setFormData({
      name: plan.name,
      description: plan.description || '',
      payType: plan.payType,
      amount: String(plan.amount),
      currency: plan.currency,
      payFrequency: plan.payFrequency,
      isActive: plan.isActive,
    });
    setEditingPlan(plan);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.amount) {
      toast.error('Name and amount are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || undefined,
        payType: formData.payType,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        payFrequency: formData.payFrequency,
        isActive: formData.isActive,
      };
      if (editingPlan === 'new') {
        await api.post(`/tenants/${user?.tenantId}/wage-plans`, payload);
        toast.success('Wage plan created');
      } else if (editingPlan) {
        await api.patch(`/tenants/${user?.tenantId}/wage-plans/${editingPlan.id}`, payload);
        toast.success('Wage plan updated');
      }
      setEditingPlan(null);
      setFormData(EMPTY_FORM);
      fetchWagePlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save wage plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/tenants/${user?.tenantId}/wage-plans/${deleteTarget.id}`);
      toast.success('Wage plan deleted');
      setDeleteTarget(null);
      fetchWagePlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete wage plan');
    } finally {
      setDeleting(false);
    }
  };

  const handleAssign = async () => {
    if (!assignPlan || !assignStaffId) return;
    setSaving(true);
    try {
      await api.post(
        `/tenants/${user?.tenantId}/wage-plans/${assignPlan.id}/assign-to-staff/${assignStaffId}`
      );
      toast.success('Wage plan assigned');
      setAssignPlan(null);
      setAssignStaffId('');
      fetchWagePlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to assign wage plan');
    } finally {
      setSaving(false);
    }
  };

  const filteredPlans = wagePlans.filter((plan) => {
    if (!debouncedSearchTerm) return true;
    const s = debouncedSearchTerm.toLowerCase();
    return plan.name.toLowerCase().includes(s) || plan.description?.toLowerCase().includes(s);
  });

  const unassignedStaff = staff.filter(
    (s) => s.isActive && s.permissions?.wagePlanId !== assignPlan?.id
  );

  return (
    <Layout>
      <PageHeader
        title="Wage plans"
        subtitle={`${wagePlans.length} plan${wagePlans.length !== 1 ? 's' : ''}`}
        actions={
          <RoleGate roles={MANAGER_ROLES}>
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setFormData(EMPTY_FORM);
                setEditingPlan('new');
              }}
            >
              Create wage plan
            </Button>
          </RoleGate>
        }
      />

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search wage plans…"
        activeCount={filterActive ? 1 : 0}
        onClear={() => setFilterActive('')}
      >
        <Select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </FilterBar>

      {loading ? (
        <div className={styles.cardGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="200px" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchWagePlans} />
      ) : filteredPlans.length === 0 ? (
        <EmptyState
          icon={<Wallet size={28} strokeWidth={1.6} />}
          title={debouncedSearchTerm || filterActive ? 'No wage plans match your filters' : 'No wage plans yet'}
          description={
            debouncedSearchTerm || filterActive
              ? 'Try adjusting your search or filters'
              : 'Create a wage plan to define how staff are paid'
          }
          action={
            <RoleGate roles={MANAGER_ROLES}>
              {!debouncedSearchTerm && !filterActive && (
                <Button variant="primary" onClick={() => setEditingPlan('new')}>
                  Create wage plan
                </Button>
              )}
            </RoleGate>
          }
        />
      ) : (
        <div className={styles.cardGrid}>
          {filteredPlans.map((plan) => (
            <div key={plan.id} className={styles.card}>
              <div className={styles.cardHead}>
                <div style={{ flex: 1 }}>
                  <h3 className={styles.cardName}>{plan.name}</h3>
                  {plan.description && <p className={styles.cardDesc}>{plan.description}</p>}
                </div>
                <StatusBadge tone={plan.isActive ? 'success' : 'neutral'} dot={false}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </StatusBadge>
              </div>

              <div>
                <span className={styles.cardAmount}>{formatMoney(plan.amount, currencySymbol)}</span>
                <span className={styles.cardAmountSuffix}>{payTypeLabel(plan.payType)}</span>
              </div>
              <div className="text-sm muted">
                Paid {PAY_FREQUENCIES.find((f) => f.value === plan.payFrequency)?.label.toLowerCase() ?? plan.payFrequency}
              </div>

              {plan.assignedStaff && plan.assignedStaff.length > 0 ? (
                <div>
                  <div className="text-xs muted" style={{ marginBottom: 4 }}>
                    {plan.assignedCount} assigned
                  </div>
                  <div className={styles.assignedRow}>
                    {plan.assignedStaff.slice(0, 4).map((s) => (
                      <span key={s.id} className={styles.staffChip}>
                        {s.firstName} {s.lastName}
                      </span>
                    ))}
                    {plan.assignedStaff.length > 4 && (
                      <span className={styles.staffChip}>+{plan.assignedStaff.length - 4}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-xs muted">No staff assigned</div>
              )}

              <RoleGate roles={MANAGER_ROLES}>
                <div className={styles.cardFoot}>
                  <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(plan)}>
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<UserPlus size={14} />}
                    onClick={() => {
                      setAssignPlan(plan);
                      setAssignStaffId('');
                    }}
                  >
                    Assign
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => setDeleteTarget(plan)}
                  >
                    Delete
                  </Button>
                </div>
              </RoleGate>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editingPlan !== null}
        onClose={() => setEditingPlan(null)}
        title={editingPlan === 'new' ? 'Create wage plan' : 'Edit wage plan'}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingPlan(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editingPlan === 'new' ? 'Create plan' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Plan name" required>
            <TextInput
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Front Desk — Monthly"
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </Field>
          <div className="grid2">
            <Field label="Pay type" required>
              <Select
                value={formData.payType}
                onChange={(e) => setFormData({ ...formData, payType: e.target.value as WagePlan['payType'] })}
              >
                {PAY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" required>
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
          </div>
          <div className="grid2">
            <Field label="Currency">
              <Select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              >
                <option value="NGN">NGN (₦)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </Select>
            </Field>
            <Field label="Pay frequency">
              <Select
                value={formData.payFrequency}
                onChange={(e) =>
                  setFormData({ ...formData, payFrequency: e.target.value as WagePlan['payFrequency'] })
                }
              >
                {PAY_FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {editingPlan !== 'new' && (
            <label className="row text-sm" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Active plan
            </label>
          )}
        </div>
      </Modal>

      <Modal
        open={!!assignPlan}
        onClose={() => setAssignPlan(null)}
        title={`Assign "${assignPlan?.name}" to staff`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignPlan(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} disabled={!assignStaffId} onClick={handleAssign}>
              Assign plan
            </Button>
          </>
        }
      >
        <Field label="Staff member" required hint="Assigning replaces their current wage plan">
          <Select value={assignStaffId} onChange={(e) => setAssignStaffId(e.target.value)}>
            <option value="">Select a staff member</option>
            {unassignedStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} — {s.role.replace(/_/g, ' ')}
              </option>
            ))}
          </Select>
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete wage plan"
        confirmLabel="Delete plan"
        loading={deleting}
        destructive
      >
        {deleteTarget && (
          <>
            Delete <strong>{deleteTarget.name}</strong>?
            {deleteTarget.assignedCount
              ? ` ${deleteTarget.assignedCount} staff member${deleteTarget.assignedCount !== 1 ? 's are' : ' is'} currently assigned to this plan.`
              : ''}
          </>
        )}
      </ConfirmDialog>
    </Layout>
  );
}
