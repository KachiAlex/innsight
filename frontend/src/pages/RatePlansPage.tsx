import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Edit, Trash2, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';

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
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
}

export default function RatePlansPage() {
  const { user } = useAuthStore();
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRatePlan, setSelectedRatePlan] = useState<RatePlan | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingPlans, setDeletingPlans] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    baseRate: '',
    currency: 'NGN',
    isActive: true,
    categoryId: '',
  });

  const fetchCategories = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user.tenantId}/room-categories`);
      setCategories(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch categories:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to fetch categories');
    }
  }, [user?.tenantId]);

  const fetchRatePlans = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (filterActive !== null) {
        params.isActive = filterActive.toString();
      }
      if (filterCategory !== null) {
        params.categoryId = filterCategory;
      }
      const response = await api.get(`/tenants/${user.tenantId}/rate-plans`, { params });
      setRatePlans(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch rate plans:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to fetch rate plans');
      setRatePlans([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filterActive, filterCategory]);

  useEffect(() => {
    fetchRatePlans();
    fetchCategories();
  }, [fetchRatePlans, fetchCategories]);

  const handleCreate = async () => {
    if (!formData.categoryId || !formData.baseRate) {
      toast.error('Please select a category and enter a base rate');
      return;
    }

    const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
    if (!selectedCategory) {
      toast.error('Selected category not found');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/rate-plans`, {
        name: selectedCategory.name, // Use category name as rate plan name
        description: formData.description || selectedCategory.description || undefined,
        baseRate: parseFloat(formData.baseRate),
        currency: formData.currency,
        isActive: formData.isActive,
        categoryId: formData.categoryId,
      });
      toast.success('Rate plan created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchRatePlans();
    } catch (error: any) {
      console.error('Failed to create rate plan:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to create rate plan');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedRatePlan) return;

    if (!formData.categoryId || !formData.baseRate) {
      toast.error('Please select a category and enter a base rate');
      return;
    }

    const selectedCategory = categories.find(cat => cat.id === formData.categoryId);
    if (!selectedCategory) {
      toast.error('Selected category not found');
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/tenants/${user?.tenantId}/rate-plans/${selectedRatePlan.id}`, {
        name: selectedCategory.name, // Use category name as rate plan name
        description: formData.description || selectedCategory.description || undefined,
        baseRate: parseFloat(formData.baseRate),
        currency: formData.currency,
        isActive: formData.isActive,
        categoryId: formData.categoryId,
      });
      toast.success('Rate plan updated successfully');
      setShowEditModal(false);
      setSelectedRatePlan(null);
      resetForm();
      fetchRatePlans();
    } catch (error: any) {
      console.error('Failed to update rate plan:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to update rate plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ratePlanId: string) => {
    if (!window.confirm('Are you sure you want to delete this rate plan?')) return;

    setDeletingPlans(prev => new Set(prev).add(ratePlanId));
    try {
      await api.delete(`/tenants/${user?.tenantId}/rate-plans/${ratePlanId}`);
      toast.success('Rate plan deleted successfully');
      fetchRatePlans();
    } catch (error: any) {
      console.error('Failed to delete rate plan:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to delete rate plan');
    } finally {
      setDeletingPlans(prev => {
        const next = new Set(prev);
        next.delete(ratePlanId);
        return next;
      });
    }
  };

  const handleEditClick = (ratePlan: RatePlan) => {
    setSelectedRatePlan(ratePlan);
    const category = categories.find(cat => cat.id === ratePlan.categoryId);
    setFormData({
      name: ratePlan.name, // Keep for display but won't be used
      description: ratePlan.description || category?.description || '',
      baseRate: ratePlan.baseRate.toString(),
      currency: ratePlan.currency,
      isActive: ratePlan.isActive,
      categoryId: ratePlan.categoryId || '',
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      baseRate: '',
      currency: 'NGN',
      isActive: true,
      categoryId: '',
    });
  };

  const handleCategoryChange = (categoryId: string) => {
    const selectedCategory = categories.find(cat => cat.id === categoryId);
    setFormData({
      ...formData,
      categoryId,
      description: selectedCategory?.description || formData.description,
    });
  };

  const filteredRatePlans = useMemo(() => ratePlans.filter((plan) => {
    if (!debouncedSearchTerm) return true;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return (
      plan.name.toLowerCase().includes(searchLower) ||
      plan.description?.toLowerCase().includes(searchLower) ||
      plan.currency.toLowerCase().includes(searchLower) ||
      plan.category?.name.toLowerCase().includes(searchLower)
    );
  }), [ratePlans, debouncedSearchTerm]);

  // Group rate plans by category
  const groupedRatePlans = useMemo(() => filteredRatePlans.reduce((acc: Record<string, { category: { id: string; name: string; color?: string } | null; plans: RatePlan[] }>, plan: RatePlan) => {
    const categoryKey = plan.categoryId || 'none';
    if (!acc[categoryKey]) {
      acc[categoryKey] = {
        category: plan.category || null,
        plans: [],
      };
    }
    acc[categoryKey].plans.push(plan);
    return acc;
  }, {} as Record<string, { category: { id: string; name: string; color?: string } | null; plans: RatePlan[] }>), [filteredRatePlans]);

  const categoryGroups = useMemo(() => Object.entries(groupedRatePlans).sort((a, b) => {
    if (a[0] === 'none') return 1;
    if (b[0] === 'none') return -1;
    const aGroup = a[1] as { category: { id: string; name: string; color?: string } | null; plans: RatePlan[] };
    const bGroup = b[1] as { category: { id: string; name: string; color?: string } | null; plans: RatePlan[] };
    return (aGroup.category?.name || '').localeCompare(bGroup.category?.name || '');
  }), [groupedRatePlans]);

  // Separate primary categories (Standard, Deluxe, Executive) from others
  const primaryCategoryNames = ['Standard', 'Deluxe', 'Executive'];
  const primaryCategories = useMemo(() => 
    categoryGroups.filter(([_, group]) => {
      const categoryName = group.category?.name || '';
      return primaryCategoryNames.some(name => 
        categoryName.toLowerCase() === name.toLowerCase()
      );
    }), [categoryGroups]);

  const otherCategories = useMemo(() => 
    categoryGroups.filter(([_, group]) => {
      const categoryName = group.category?.name || '';
      return !primaryCategoryNames.some(name => 
        categoryName.toLowerCase() === name.toLowerCase()
      );
    }), [categoryGroups]);

  const renderCategoryGroup = ([categoryKey, group]: [string, { category: { id: string; name: string; color?: string } | null; plans: RatePlan[] }]) => (
    <div key={categoryKey} style={{ flex: '1 1 400px', minWidth: '350px', maxWidth: '100%' }}>
      <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0' }}>
        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {group.category ? (
            <>
              {group.category.color && (
                <span
                  style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: group.category.color,
                    display: 'inline-block',
                  }}
                />
              )}
              {group.category.name}
            </>
          ) : (
            'No Category'
          )}
          <span style={{ fontSize: '0.875rem', fontWeight: '400', color: '#64748b' }}>
            ({group.plans.length})
          </span>
        </h2>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {group.plans.map((plan: RatePlan) => (
          <div
            key={plan.id}
            style={{
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>
                  {plan.name}
                </h3>
                {plan.description && (
                  <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                    {plan.description}
                  </p>
                )}
                {plan.category && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {plan.category.color && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: plan.category.color,
                          display: 'inline-block',
                        }}
                      />
                    )}
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {plan.category.name}
                    </span>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: plan.isActive ? '#d1fae5' : '#fee2e2',
                    color: plan.isActive ? '#065f46' : '#991b1b',
                  }}
                >
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>
                  {plan.currency} {plan.baseRate.toLocaleString()}
                </span>
              </div>
              {plan.roomCount !== undefined && plan.roomCount > 0 && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                  {plan.roomCount} room{plan.roomCount !== 1 ? 's' : ''} using this plan
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <button
                onClick={() => handleEditClick(plan)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  background: 'white',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <Edit size={16} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(plan.id)}
                disabled={deletingPlans.has(plan.id)}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #fee2e2',
                  borderRadius: '6px',
                  opacity: deletingPlans.has(plan.id) ? 0.6 : 1,
                  cursor: deletingPlans.has(plan.id) ? 'not-allowed' : 'pointer',
                  background: 'white',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                <Trash2 size={16} />
                {deletingPlans.has(plan.id) ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Rate Plans</h1>
          <CardSkeleton count={6} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1e293b' }}>Rate Plans</h1>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Plus size={20} />
            Create Rate Plan
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <SearchInput
              placeholder="Search rate plans..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={filterCategory || ''}
              onChange={(e) => setFilterCategory(e.target.value || null)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <option value="">All Categories</option>
              <option value="none">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setFilterActive(null)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: filterActive === null ? '#3b82f6' : 'white',
                color: filterActive === null ? 'white' : '#64748b',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilterActive(true)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: filterActive === true ? '#10b981' : 'white',
                color: filterActive === true ? 'white' : '#64748b',
                cursor: 'pointer',
              }}
            >
              Active
            </button>
            <button
              onClick={() => setFilterActive(false)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: filterActive === false ? '#ef4444' : 'white',
                color: filterActive === false ? 'white' : '#64748b',
                cursor: 'pointer',
              }}
            >
              Inactive
            </button>
          </div>
        </div>

        {!loading && filteredRatePlans.length === 0 ? (
          <EmptyState
            icon={DollarSign}
            title={searchTerm || filterActive !== null || filterCategory ? 'No rate plans match your filters' : 'No rate plans yet'}
            description={searchTerm || filterActive !== null || filterCategory
              ? 'Try adjusting your search or filter criteria'
              : 'Create your first rate plan to get started'}
            action={searchTerm || filterActive !== null || filterCategory ? undefined : {
              label: 'Create Rate Plan',
              onClick: () => {
                resetForm();
                setShowCreateModal(true);
              },
            }}
          />
        ) : (
          <div>
            {/* Primary Categories Row (Standard, Deluxe, Executive) */}
            {primaryCategories.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {primaryCategories.map(renderCategoryGroup)}
              </div>
            )}

            {/* Other Categories */}
            {otherCategories.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {otherCategories.map(renderCategoryGroup)}
              </div>
            )}
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
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
            onClick={() => setShowCreateModal(false)}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Create Rate Plan</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} color="#64748b" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Category *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="">Select a category...</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {formData.categoryId && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#64748b', fontStyle: 'italic' }}>
                      Rate plan name will be: {categories.find(c => c.id === formData.categoryId)?.name}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      minHeight: '80px',
                      resize: 'vertical',
                    }}
                    placeholder={categories.find(c => c.id === formData.categoryId)?.description || "Optional description (will use category description if available)"}
                  />
                  {formData.categoryId && categories.find(c => c.id === formData.categoryId)?.description && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      Category description: {categories.find(c => c.id === formData.categoryId)?.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Base Rate *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.baseRate}
                      onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    >
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span style={{ color: '#1e293b' }}>Active</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => setShowCreateModal(false)}
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
                    onClick={handleCreate}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#3b82f6',
                      color: 'white',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                      opacity: saving ? 0.6 : 1,
                    }}
                  >
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedRatePlan && (
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
            onClick={() => {
              setShowEditModal(false);
              setSelectedRatePlan(null);
            }}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Edit Rate Plan</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedRatePlan(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} color="#64748b" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Category *
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="">Select a category...</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {formData.categoryId && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#64748b', fontStyle: 'italic' }}>
                      Rate plan name will be: {categories.find(c => c.id === formData.categoryId)?.name}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      minHeight: '80px',
                      resize: 'vertical',
                    }}
                    placeholder={categories.find(c => c.id === formData.categoryId)?.description || "Optional description (will use category description if available)"}
                  />
                  {formData.categoryId && categories.find(c => c.id === formData.categoryId)?.description && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      Category description: {categories.find(c => c.id === formData.categoryId)?.description}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Base Rate *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.baseRate}
                      onChange={(e) => setFormData({ ...formData, baseRate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Currency
                    </label>
                    <select
                      value={formData.currency}
                      onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    >
                      <option value="NGN">NGN</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>


                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span style={{ color: '#1e293b' }}>Active</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedRatePlan(null);
                    }}
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
                    onClick={handleEdit}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#3b82f6',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

