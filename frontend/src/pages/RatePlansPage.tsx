import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';
import styles from './RatePlansPage.module.css';

interface RatePlan {
  id: string;
  name: string;
  description?: string;
  baseRate: number;
  currency: string;
  seasonalRules?: any;
  isActive: boolean;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
    color?: string;
  } | null;
  roomCount?: number;
}

interface RoomCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

interface FormState {
  description: string;
  baseRate: string;
  currency: string;
  isActive: boolean;
  categoryId: string;
}

const EMPTY_FORM: FormState = {
  description: '',
  baseRate: '',
  currency: 'NGN',
  isActive: true,
  categoryId: '',
};

export default function RatePlansPage() {
  const { user } = useAuthStore();
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterActive, setFilterActive] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [editingPlan, setEditingPlan] = useState<RatePlan | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RatePlan | null>(null);

  const fetchRatePlans = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filterActive !== '') params.isActive = filterActive;
      if (filterCategory !== '') params.categoryId = filterCategory;
      const response = await api.get(`/tenants/${user.tenantId}/rate-plans`, { params });
      setRatePlans(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch rate plans');
      setRatePlans([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filterActive, filterCategory]);

  useEffect(() => {
    fetchRatePlans();
    api
      .get(`/tenants/${user?.tenantId}/room-categories`)
      .then((res) => setCategories(res.data.data || []))
      .catch(() => setCategories([]));
  }, [fetchRatePlans, user?.tenantId]);

  const handleSave = async () => {
    if (!formData.categoryId || !formData.baseRate) {
      toast.error('Please select a category and enter a base rate');
      return;
    }
    const selectedCategory = categories.find((cat) => cat.id === formData.categoryId);
    if (!selectedCategory) {
      toast.error('Selected category not found');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: selectedCategory.name,
        description: formData.description || selectedCategory.description || undefined,
        baseRate: parseFloat(formData.baseRate),
        currency: formData.currency,
        isActive: formData.isActive,
        categoryId: formData.categoryId,
      };
      if (editingPlan === 'new') {
        await api.post(`/tenants/${user?.tenantId}/rate-plans`, payload);
        toast.success('Rate plan created successfully');
      } else if (editingPlan) {
        await api.patch(`/tenants/${user?.tenantId}/rate-plans/${editingPlan.id}`, payload);
        toast.success('Rate plan updated successfully');
      }
      setEditingPlan(null);
      setFormData(EMPTY_FORM);
      fetchRatePlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save rate plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/tenants/${user?.tenantId}/rate-plans/${deleteTarget.id}`);
      toast.success('Rate plan deleted successfully');
      setDeleteTarget(null);
      fetchRatePlans();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete rate plan');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (ratePlan: RatePlan) => {
    const category = categories.find((cat) => cat.id === ratePlan.categoryId);
    setFormData({
      description: ratePlan.description || category?.description || '',
      baseRate: String(ratePlan.baseRate),
      currency: ratePlan.currency,
      isActive: ratePlan.isActive,
      categoryId: ratePlan.categoryId || '',
    });
    setEditingPlan(ratePlan);
  };

  const handleCategoryChange = (categoryId: string) => {
    const selectedCategory = categories.find((cat) => cat.id === categoryId);
    setFormData((f) => ({
      ...f,
      categoryId,
      description: selectedCategory?.description || f.description,
    }));
  };

  const filteredRatePlans = useMemo(
    () =>
      ratePlans.filter((plan) => {
        if (!debouncedSearchTerm) return true;
        const s = debouncedSearchTerm.toLowerCase();
        return (
          plan.name.toLowerCase().includes(s) ||
          plan.description?.toLowerCase().includes(s) ||
          plan.currency.toLowerCase().includes(s) ||
          plan.category?.name.toLowerCase().includes(s)
        );
      }),
    [ratePlans, debouncedSearchTerm]
  );

  const categoryGroups = useMemo(() => {
    const grouped = filteredRatePlans.reduce(
      (acc, plan) => {
        const key = plan.categoryId || 'none';
        if (!acc[key]) acc[key] = { category: plan.category || null, plans: [] };
        acc[key].plans.push(plan);
        return acc;
      },
      {} as Record<string, { category: RatePlan['category']; plans: RatePlan[] }>
    );
    return Object.entries(grouped).sort((a, b) => {
      if (a[0] === 'none') return 1;
      if (b[0] === 'none') return -1;
      return (a[1].category?.name || '').localeCompare(b[1].category?.name || '');
    });
  }, [filteredRatePlans]);

  const activeFilterCount =
    (filterActive !== '' ? 1 : 0) + (filterCategory !== '' ? 1 : 0);

  return (
    <Layout>
      <PageHeader
        title="Rate plans"
        subtitle={`${ratePlans.length} plan${ratePlans.length !== 1 ? 's' : ''}`}
        actions={
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => {
              setFormData(EMPTY_FORM);
              setEditingPlan('new');
            }}
          >
            Create rate plan
          </Button>
        }
      />

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search rate plans…"
        activeCount={activeFilterCount}
        onClear={() => {
          setFilterActive('');
          setFilterCategory('');
        }}
      >
        <Select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          <option value="none">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
        <Select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </FilterBar>

      {loading ? (
        <div className={styles.cardGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="210px" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchRatePlans} />
      ) : filteredRatePlans.length === 0 ? (
        <EmptyState
          icon={<DollarSign size={28} strokeWidth={1.6} />}
          title={
            debouncedSearchTerm || activeFilterCount > 0
              ? 'No rate plans match your filters'
              : 'No rate plans yet'
          }
          description={
            debouncedSearchTerm || activeFilterCount > 0
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first rate plan to get started'
          }
          action={
            !debouncedSearchTerm && activeFilterCount === 0 ? (
              <Button variant="primary" onClick={() => setEditingPlan('new')}>
                Create rate plan
              </Button>
            ) : undefined
          }
        />
      ) : (
        categoryGroups.map(([categoryKey, group]) => (
          <section key={categoryKey} className={styles.group}>
            <div className={styles.groupHeader}>
              <h2 className={styles.groupTitle}>
                {group.category ? (
                  <>
                    {group.category.color && (
                      <span
                        className={styles.catDot}
                        style={{ background: group.category.color }}
                      />
                    )}
                    {group.category.name}
                  </>
                ) : (
                  'No category'
                )}
                <span className={styles.groupCount}> ({group.plans.length})</span>
              </h2>
            </div>
            <div className={styles.cardGrid}>
              {group.plans.map((plan) => (
                <div key={plan.id} className={styles.card}>
                  <div className={styles.cardHead}>
                    <div style={{ flex: 1 }}>
                      <h3 className={styles.cardName}>{plan.name}</h3>
                      {plan.description && <p className={styles.cardDesc}>{plan.description}</p>}
                      {plan.category && (
                        <div className={styles.cardCat}>
                          {plan.category.color && (
                            <span
                              className={styles.catDot}
                              style={{ background: plan.category.color, width: 8, height: 8 }}
                            />
                          )}
                          {plan.category.name}
                        </div>
                      )}
                    </div>
                    <StatusBadge tone={plan.isActive ? 'success' : 'danger'} dot={false}>
                      {plan.isActive ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </div>

                  <div>
                    <div className={styles.cardRate}>
                      {plan.currency} {Number(plan.baseRate).toLocaleString()}
                    </div>
                    {plan.roomCount != null && plan.roomCount > 0 && (
                      <div className={styles.cardMeta}>
                        {plan.roomCount} room{plan.roomCount !== 1 ? 's' : ''} using this plan
                      </div>
                    )}
                  </div>

                  <div className={styles.cardFoot}>
                    <Button variant="ghost" size="sm" block icon={<Pencil size={14} />} onClick={() => openEdit(plan)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      block
                      icon={<Trash2 size={14} />}
                      onClick={() => setDeleteTarget(plan)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <Modal
        open={editingPlan !== null}
        onClose={() => setEditingPlan(null)}
        title={editingPlan === 'new' ? 'Create rate plan' : 'Edit rate plan'}
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
          <Field label="Room category" required hint="The plan takes the category's name">
            <Select
              value={formData.categoryId}
              onChange={(e) => handleCategoryChange(e.target.value)}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" hint="Optional — defaults to the category description">
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
            />
          </Field>
          <div className="grid2">
            <Field label="Base rate" required>
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={formData.baseRate}
                onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Currency" required>
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
          </div>
          <label className="row text-sm" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />
            Active plan
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete rate plan"
        confirmLabel="Delete plan"
        loading={deleting}
        destructive
      >
        {`Delete "${deleteTarget?.name}"? Rooms using this plan will lose their pricing.`}
      </ConfirmDialog>
    </Layout>
  );
}
