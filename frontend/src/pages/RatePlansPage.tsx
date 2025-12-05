import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Edit, Trash2, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';

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
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    baseRate: '',
    currency: 'NGN',
    isActive: true,
    categoryId: '',
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchRatePlans();
    fetchCategories();
  }, [user, filterActive, filterCategory]);

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/room-categories`);
      setCategories(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchRatePlans = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterActive !== null) {
        params.isActive = filterActive.toString();
      }
      if (filterCategory !== null) {
        params.categoryId = filterCategory;
      }
      const response = await api.get(`/tenants/${user?.tenantId}/rate-plans`, { params });
      setRatePlans(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch rate plans:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch rate plans');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.name || !formData.baseRate) {
        toast.error('Please fill in all required fields');
        return;
      }

      await api.post(`/tenants/${user?.tenantId}/rate-plans`, {
        name: formData.name,
        description: formData.description || undefined,
        baseRate: parseFloat(formData.baseRate),
        currency: formData.currency,
        isActive: formData.isActive,
        categoryId: formData.categoryId || undefined,
      });

      toast.success('Rate plan created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchRatePlans();
    } catch (error: any) {
      console.error('Failed to create rate plan:', error);
      toast.error(error.response?.data?.message || 'Failed to create rate plan');
    }
  };

  const handleEdit = async () => {
    if (!selectedRatePlan) return;

    try {
      if (!formData.name || !formData.baseRate) {
        toast.error('Please fill in all required fields');
        return;
      }

      await api.patch(`/tenants/${user?.tenantId}/rate-plans/${selectedRatePlan.id}`, {
        name: formData.name,
        description: formData.description || undefined,
        baseRate: parseFloat(formData.baseRate),
        currency: formData.currency,
        isActive: formData.isActive,
        categoryId: formData.categoryId || undefined,
      });

      toast.success('Rate plan updated successfully');
      setShowEditModal(false);
      setSelectedRatePlan(null);
      resetForm();
      fetchRatePlans();
    } catch (error: any) {
      console.error('Failed to update rate plan:', error);
      toast.error(error.response?.data?.message || 'Failed to update rate plan');
    }
  };

  const handleDelete = async (ratePlanId: string) => {
    if (!window.confirm('Are you sure you want to delete this rate plan?')) return;

    try {
      await api.delete(`/tenants/${user?.tenantId}/rate-plans/${ratePlanId}`);
      toast.success('Rate plan deleted successfully');
      fetchRatePlans();
    } catch (error: any) {
      console.error('Failed to delete rate plan:', error);
      toast.error(error.response?.data?.message || 'Failed to delete rate plan');
    }
  };

  const handleEditClick = (ratePlan: RatePlan) => {
    setSelectedRatePlan(ratePlan);
    setFormData({
      name: ratePlan.name,
      description: ratePlan.description || '',
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

  const filteredRatePlans = ratePlans.filter((plan) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      plan.name.toLowerCase().includes(searchLower) ||
      plan.description?.toLowerCase().includes(searchLower) ||
      plan.currency.toLowerCase().includes(searchLower) ||
      plan.category?.name.toLowerCase().includes(searchLower)
    );
  });

  // Group rate plans by category
  const groupedRatePlans = filteredRatePlans.reduce((acc, plan) => {
    const categoryKey = plan.categoryId || 'none';
    if (!acc[categoryKey]) {
      acc[categoryKey] = {
        category: plan.category || null,
        plans: [],
      };
    }
    acc[categoryKey].plans.push(plan);
    return acc;
  }, {} as Record<string, { category: { id: string; name: string; color?: string } | null; plans: RatePlan[] }>);

  const categoryGroups = Object.entries(groupedRatePlans).sort((a, b) => {
    if (a[0] === 'none') return 1;
    if (b[0] === 'none') return -1;
    return (a[1].category?.name || '').localeCompare(b[1].category?.name || '');
  });

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

        {filteredRatePlans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <DollarSign size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No rate plans found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {categoryGroups.map(([categoryKey, group]) => (
              <div key={categoryKey}>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                  {group.plans.map((plan) => (
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
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{plan.category.name}</span>
                      </div>
                    )}
                  </div>
                  <span
                    style={{
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

                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>
                      {plan.currency} {plan.baseRate.toLocaleString()}
                    </span>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>per night</span>
                  </div>
                  {plan.roomCount !== undefined && (
                    <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
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
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      border: '1px solid #fee2e2',
                      borderRadius: '6px',
                      background: 'white',
                      color: '#ef4444',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <Trash2 size={16} />
                    Delete
                  </button>
                </div>
              </div>
                  ))}
                </div>
              </div>
            ))}
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
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                    placeholder="Standard Rate"
                  />
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
                    placeholder="Optional description"
                  />
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
                    Create
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
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  />
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
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Category
                  </label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
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

