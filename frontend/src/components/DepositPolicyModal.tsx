import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import toast from 'react-hot-toast';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { Button, Field, Modal, Select, TextInput, Textarea } from './ui';

export interface DepositPolicy {
  id?: string;
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
  dueDaysBeforeCheckIn?: number;
  refundableAfterDays?: number;
  cancellationFee?: number;
  requiresForWeekends?: boolean;
  requiresForHolidays?: boolean;
  requiresForPeakSeason?: boolean;
}

interface DepositPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy?: DepositPolicy | null;
  onSuccess: () => void;
}

interface NamedOption {
  id: string;
  name: string;
}

const EMPTY_FORM: DepositPolicy = {
  name: '',
  description: '',
  depositType: 'percentage',
  depositValue: 0,
  maxDepositAmount: undefined,
  minDepositAmount: undefined,
  appliesToAllRooms: true,
  roomCategoryIds: [],
  ratePlanIds: [],
  isActive: true,
  dueDaysBeforeCheckIn: 7,
  refundableAfterDays: undefined,
  cancellationFee: undefined,
  requiresForWeekends: false,
  requiresForHolidays: false,
  requiresForPeakSeason: false,
};

export default function DepositPolicyModal({
  isOpen,
  onClose,
  policy,
  onSuccess,
}: DepositPolicyModalProps) {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<DepositPolicy>(EMPTY_FORM);
  const [categories, setCategories] = useState<NamedOption[]>([]);
  const [ratePlans, setRatePlans] = useState<NamedOption[]>([]);

  useEffect(() => {
    setFormData(policy ? { ...EMPTY_FORM, ...policy } : EMPTY_FORM);
  }, [policy, isOpen]);

  useEffect(() => {
    if (!isOpen || !user?.tenantId) return;
    api
      .get(`/tenants/${user.tenantId}/room-categories`)
      .then((res) => setCategories(res.data.data || []))
      .catch(() => setCategories([]));
    api
      .get(`/tenants/${user.tenantId}/rate-plans`, { params: { isActive: 'true' } })
      .then((res) => setRatePlans(res.data.data || []))
      .catch(() => setRatePlans([]));
  }, [isOpen, user?.tenantId]);

  const toggleId = (key: 'roomCategoryIds' | 'ratePlanIds', id: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: prev[key].includes(id) ? prev[key].filter((x) => x !== id) : [...prev[key], id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    if (!formData.name.trim()) {
      toast.error('Policy name is required');
      return;
    }
    if (formData.depositValue <= 0) {
      toast.error('Deposit value must be greater than 0');
      return;
    }
    if (formData.depositType === 'percentage' && formData.depositValue > 100) {
      toast.error('Percentage cannot exceed 100%');
      return;
    }

    setLoading(true);
    try {
      const submitData = {
        name: formData.name.trim(),
        description: formData.description || null,
        isActive: formData.isActive,
        appliesToAllRooms: formData.appliesToAllRooms,
        roomCategoryIds: formData.appliesToAllRooms ? [] : formData.roomCategoryIds,
        ratePlanIds: formData.appliesToAllRooms ? [] : formData.ratePlanIds,
        depositType: formData.depositType,
        depositValue: formData.depositValue,
        maxDepositAmount: formData.maxDepositAmount || null,
        minDepositAmount: formData.minDepositAmount || null,
        dueDaysBeforeCheckIn: formData.dueDaysBeforeCheckIn ?? 0,
        refundableAfterDays: formData.refundableAfterDays ?? null,
        cancellationFee: formData.cancellationFee ?? null,
        requiresForWeekends: formData.requiresForWeekends ?? false,
        requiresForHolidays: formData.requiresForHolidays ?? false,
        requiresForPeakSeason: formData.requiresForPeakSeason ?? false,
      };

      if (policy?.id) {
        await api.patch(`/tenants/${user.tenantId}/deposit-policies/${policy.id}`, submitData);
        toast.success('Deposit policy updated');
      } else {
        await api.post(`/tenants/${user.tenantId}/deposit-policies`, submitData);
        toast.success('Deposit policy created');
      }
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save deposit policy');
    } finally {
      setLoading(false);
    }
  };

  const set = <K extends keyof DepositPolicy>(k: K, v: DepositPolicy[K]) =>
    setFormData((prev) => ({ ...prev, [k]: v }));

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={policy ? 'Edit deposit policy' : 'Create deposit policy'}
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} onClick={handleSubmit}>
            {policy ? 'Update policy' : 'Create policy'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="stack-lg">
        <section className="stack">
          <Field label="Policy name" required>
            <TextInput
              value={formData.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g., Standard weekend policy"
              required
            />
          </Field>
          <Field label="Description" hint="Optional">
            <Textarea
              value={formData.description || ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
            />
          </Field>
          <label className="row text-sm" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => set('isActive', e.target.checked)}
            />
            Active policy
          </label>
        </section>

        <section className="stack">
          <h3 className="text-sm" style={{ fontWeight: 600 }}>
            Deposit calculation
          </h3>
          <div className="grid2">
            <Field label="Deposit type" required>
              <Select
                value={formData.depositType}
                onChange={(e) => set('depositType', e.target.value as DepositPolicy['depositType'])}
              >
                <option value="percentage">Percentage of total</option>
                <option value="fixed">Fixed amount</option>
                <option value="first_night">First night rate</option>
              </Select>
            </Field>
            <Field
              label={
                formData.depositType === 'percentage'
                  ? 'Value (%)'
                  : formData.depositType === 'fixed'
                    ? `Amount (${settings.currencySymbol})`
                    : 'Fallback amount'
              }
              required
              hint={
                formData.depositType === 'first_night'
                  ? 'Used when a nightly rate is unavailable'
                  : undefined
              }
            >
              <TextInput
                type="number"
                value={formData.depositValue || ''}
                onChange={(e) => set('depositValue', parseFloat(e.target.value) || 0)}
                min="0"
                step={formData.depositType === 'percentage' ? '1' : '100'}
                required
              />
            </Field>
          </div>
          <div className="grid2">
            <Field label={`Minimum deposit (${settings.currencySymbol})`} hint="Optional">
              <TextInput
                type="number"
                value={formData.minDepositAmount ?? ''}
                onChange={(e) =>
                  set('minDepositAmount', e.target.value ? parseFloat(e.target.value) : undefined)
                }
                min="0"
              />
            </Field>
            <Field label={`Maximum deposit (${settings.currencySymbol})`} hint="Optional">
              <TextInput
                type="number"
                value={formData.maxDepositAmount ?? ''}
                onChange={(e) =>
                  set('maxDepositAmount', e.target.value ? parseFloat(e.target.value) : undefined)
                }
                min="0"
              />
            </Field>
          </div>
        </section>

        <section className="stack">
          <h3 className="text-sm" style={{ fontWeight: 600 }}>
            Application rules
          </h3>
          <label className="row text-sm" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.appliesToAllRooms}
              onChange={(e) => set('appliesToAllRooms', e.target.checked)}
            />
            Apply to all rooms
          </label>
          {!formData.appliesToAllRooms && (
            <div className="grid2" style={{ alignItems: 'start' }}>
              <Field label="Room categories" hint="Leave empty for none">
                <div className="stack" style={{ gap: 'var(--space-1)' }}>
                  {categories.length === 0 && (
                    <span className="text-xs muted">No room categories configured</span>
                  )}
                  {categories.map((c) => (
                    <label key={c.id} className="row text-sm" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.roomCategoryIds.includes(c.id)}
                        onChange={() => toggleId('roomCategoryIds', c.id)}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Rate plans" hint="Leave empty for none">
                <div className="stack" style={{ gap: 'var(--space-1)' }}>
                  {ratePlans.length === 0 && (
                    <span className="text-xs muted">No rate plans configured</span>
                  )}
                  {ratePlans.map((p) => (
                    <label key={p.id} className="row text-sm" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.ratePlanIds.includes(p.id)}
                        onChange={() => toggleId('ratePlanIds', p.id)}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          )}
        </section>

        <section className="stack">
          <h3 className="text-sm" style={{ fontWeight: 600 }}>
            Timing rules
          </h3>
          <div className="grid3">
            <Field label="Due days before check-in">
              <TextInput
                type="number"
                value={formData.dueDaysBeforeCheckIn ?? ''}
                onChange={(e) =>
                  set('dueDaysBeforeCheckIn', e.target.value ? parseInt(e.target.value) : undefined)
                }
                min="0"
              />
            </Field>
            <Field label="Refundable after days" hint="Optional">
              <TextInput
                type="number"
                value={formData.refundableAfterDays ?? ''}
                onChange={(e) =>
                  set('refundableAfterDays', e.target.value ? parseInt(e.target.value) : undefined)
                }
                min="0"
              />
            </Field>
            <Field label="Cancellation fee (%)" hint="Optional">
              <TextInput
                type="number"
                value={formData.cancellationFee ?? ''}
                onChange={(e) =>
                  set('cancellationFee', e.target.value ? parseFloat(e.target.value) : undefined)
                }
                min="0"
                max="100"
              />
            </Field>
          </div>
        </section>

        <section className="stack">
          <h3 className="text-sm" style={{ fontWeight: 600 }}>
            Special conditions
          </h3>
          <div className="row wrap">
            {(
              [
                ['requiresForWeekends', 'Weekends'],
                ['requiresForHolidays', 'Holidays'],
                ['requiresForPeakSeason', 'Peak season'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="row text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData[key] || false}
                  onChange={(e) => set(key, e.target.checked)}
                />
                {label}
              </label>
            ))}
          </div>
        </section>
      </form>
    </Modal>
  );
}
