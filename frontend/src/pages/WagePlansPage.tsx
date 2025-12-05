import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Edit, Trash2, DollarSign, X, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';

interface WagePlan {
  id: string;
  name: string;
  description?: string;
  roleClassification: 'normal_staff' | 'supervisor' | 'manager' | 'senior_executive';
  role?: string;
  wageType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'annual';
  baseAmount: number;
  currency: string;
  overtimeRate?: number;
  benefits: string[];
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const roleClassificationLabels: Record<string, string> = {
  normal_staff: 'Normal Staff',
  supervisor: 'Supervisor',
  manager: 'Manager',
  senior_executive: 'Senior Executive',
};

const wageTypeLabels: Record<string, string> = {
  hourly: 'Per Hour',
  daily: 'Per Day',
  weekly: 'Per Week',
  monthly: 'Per Month',
  annual: 'Per Year',
};

export default function WagePlansPage() {
  const { user } = useAuthStore();
  const [wagePlans, setWagePlans] = useState<WagePlan[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedWagePlan, setSelectedWagePlan] = useState<WagePlan | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClassification, setFilterClassification] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    roleClassification: 'normal_staff' | 'supervisor' | 'manager' | 'senior_executive';
    role: string;
    wageType: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'annual';
    baseAmount: string;
    currency: string;
    overtimeRate: string;
    benefits: string[];
    newBenefit: string;
    isActive: boolean;
  }>({
    name: '',
    description: '',
    roleClassification: 'normal_staff',
    role: '',
    wageType: 'monthly',
    baseAmount: '',
    currency: 'NGN',
    overtimeRate: '',
    benefits: [],
    newBenefit: '',
    isActive: true,
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchWagePlans();
    fetchStaff();
  }, [user, filterClassification, filterActive]);

  const fetchWagePlans = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterClassification) params.roleClassification = filterClassification;
      if (filterActive !== null) params.isActive = filterActive.toString();

      const response = await api.get(`/tenants/${user?.tenantId}/wage-plans`, { params });
      setWagePlans(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch wage plans:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch wage plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/staff`);
      setStaff(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch staff:', error);
    }
  };

  const handleCreate = async () => {
    try {
      if (!formData.name || !formData.baseAmount) {
        toast.error('Please fill in all required fields');
        return;
      }

      const wagePlanData: any = {
        name: formData.name,
        description: formData.description || undefined,
        roleClassification: formData.roleClassification,
        wageType: formData.wageType,
        baseAmount: parseFloat(formData.baseAmount),
        currency: formData.currency,
        benefits: formData.benefits,
        isActive: formData.isActive,
      };

      if (formData.role) {
        wagePlanData.role = formData.role;
      }

      if (formData.overtimeRate) {
        wagePlanData.overtimeRate = parseFloat(formData.overtimeRate);
      }

      await api.post(`/tenants/${user?.tenantId}/wage-plans`, wagePlanData);

      toast.success('Wage plan created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchWagePlans();
    } catch (error: any) {
      console.error('Failed to create wage plan:', error);
      toast.error(error.response?.data?.message || 'Failed to create wage plan');
    }
  };

  const handleEdit = async () => {
    if (!selectedWagePlan) return;

    try {
      if (!formData.name || !formData.baseAmount) {
        toast.error('Please fill in all required fields');
        return;
      }

      const wagePlanData: any = {
        name: formData.name,
        description: formData.description || undefined,
        roleClassification: formData.roleClassification,
        wageType: formData.wageType,
        baseAmount: parseFloat(formData.baseAmount),
        currency: formData.currency,
        benefits: formData.benefits,
        isActive: formData.isActive,
      };

      if (formData.role) {
        wagePlanData.role = formData.role;
      } else {
        wagePlanData.role = null;
      }

      if (formData.overtimeRate) {
        wagePlanData.overtimeRate = parseFloat(formData.overtimeRate);
      } else {
        wagePlanData.overtimeRate = null;
      }

      await api.patch(`/tenants/${user?.tenantId}/wage-plans/${selectedWagePlan.id}`, wagePlanData);

      toast.success('Wage plan updated successfully');
      setShowEditModal(false);
      setSelectedWagePlan(null);
      resetForm();
      fetchWagePlans();
    } catch (error: any) {
      console.error('Failed to update wage plan:', error);
      toast.error(error.response?.data?.message || 'Failed to update wage plan');
    }
  };

  const handleDelete = async (wagePlanId: string) => {
    if (!window.confirm('Are you sure you want to delete this wage plan?')) return;

    try {
      await api.delete(`/tenants/${user?.tenantId}/wage-plans/${wagePlanId}`);
      toast.success('Wage plan deleted successfully');
      fetchWagePlans();
    } catch (error: any) {
      console.error('Failed to delete wage plan:', error);
      toast.error(error.response?.data?.message || 'Failed to delete wage plan');
    }
  };

  const handleAssign = async () => {
    if (!selectedWagePlan || !selectedStaff) {
      toast.error('Please select a staff member');
      return;
    }

    try {
      await api.post(`/tenants/${user?.tenantId}/wage-plans/${selectedWagePlan.id}/assign-to-staff/${selectedStaff}`);
      toast.success('Wage plan assigned successfully');
      setShowAssignModal(false);
      setSelectedWagePlan(null);
      setSelectedStaff('');
      fetchStaff();
    } catch (error: any) {
      console.error('Failed to assign wage plan:', error);
      toast.error(error.response?.data?.message || 'Failed to assign wage plan');
    }
  };

  const handleEditClick = (wagePlan: WagePlan) => {
    setSelectedWagePlan(wagePlan);
    setFormData({
      name: wagePlan.name,
      description: wagePlan.description || '',
      roleClassification: wagePlan.roleClassification,
      role: wagePlan.role || '',
      wageType: wagePlan.wageType,
      baseAmount: wagePlan.baseAmount.toString(),
      currency: wagePlan.currency,
      overtimeRate: wagePlan.overtimeRate?.toString() || '',
      benefits: wagePlan.benefits || [],
      newBenefit: '',
      isActive: wagePlan.isActive,
    });
    setShowEditModal(true);
  };

  const handleAssignClick = (wagePlan: WagePlan) => {
    setSelectedWagePlan(wagePlan);
    setSelectedStaff('');
    setShowAssignModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      roleClassification: 'normal_staff',
      role: '',
      wageType: 'monthly',
      baseAmount: '',
      currency: 'NGN',
      overtimeRate: '',
      benefits: [],
      newBenefit: '',
      isActive: true,
    });
  };

  const addBenefit = () => {
    if (formData.newBenefit.trim()) {
      setFormData({
        ...formData,
        benefits: [...formData.benefits, formData.newBenefit.trim()],
        newBenefit: '',
      });
    }
  };

  const removeBenefit = (index: number) => {
    setFormData({
      ...formData,
      benefits: formData.benefits.filter((_, i) => i !== index),
    });
  };

  const filteredWagePlans = wagePlans.filter((plan) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      plan.name.toLowerCase().includes(searchLower) ||
      plan.description?.toLowerCase().includes(searchLower) ||
      (plan.role && plan.role.toLowerCase().includes(searchLower))
    );
  });

  // Group by classification
  const groupedPlans = filteredWagePlans.reduce((acc, plan) => {
    const key = plan.roleClassification;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(plan);
    return acc;
  }, {} as Record<string, WagePlan[]>);

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Wage Plans</h1>
          <CardSkeleton count={6} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1e293b' }}>Wage Plans</h1>
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
            Create Wage Plan
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <SearchInput
              placeholder="Search wage plans..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <select
              value={filterClassification}
              onChange={(e) => setFilterClassification(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <option value="">All Classifications</option>
              <option value="normal_staff">Normal Staff</option>
              <option value="supervisor">Supervisor</option>
              <option value="manager">Manager</option>
              <option value="senior_executive">Senior Executive</option>
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

        {filteredWagePlans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <DollarSign size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No wage plans found</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {Object.entries(groupedPlans).map(([classification, plans]) => (
              <div key={classification}>
                <div style={{ marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #e2e8f0' }}>
                  <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>
                    {roleClassificationLabels[classification]} ({plans.length})
                  </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                  {plans.map((plan) => (
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
                        <div>
                          <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>
                            {plan.name}
                          </h3>
                          {plan.description && (
                            <p style={{ margin: '0.5rem 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                              {plan.description}
                            </p>
                          )}
                          {plan.role && (
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                              Role: {plan.role}
                            </p>
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
                            {plan.currency} {plan.baseAmount.toLocaleString()}
                          </span>
                          <span style={{ color: '#64748b', fontSize: '0.875rem' }}>
                            {wageTypeLabels[plan.wageType]}
                          </span>
                        </div>
                        {plan.overtimeRate && (
                          <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#64748b' }}>
                            Overtime: {plan.overtimeRate}x
                          </p>
                        )}
                      </div>

                      {plan.benefits && plan.benefits.length > 0 && (
                        <div style={{ marginBottom: '1rem' }}>
                          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem', color: '#64748b', fontWeight: '500' }}>
                            Benefits:
                          </p>
                          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#64748b' }}>
                            {plan.benefits.map((benefit, idx) => (
                              <li key={idx}>{benefit}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                        <button
                          onClick={() => handleAssignClick(plan)}
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
                            fontSize: '0.875rem',
                          }}
                          title="Assign to Staff"
                        >
                          <Users size={16} />
                          Assign
                        </button>
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
                            fontSize: '0.875rem',
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
                            fontSize: '0.875rem',
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
                maxWidth: '600px',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Create Wage Plan</h2>
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
                    Plan Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Standard Chef Wage"
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

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Role Classification *
                  </label>
                  <select
                    value={formData.roleClassification}
                    onChange={(e) => setFormData({ ...formData, roleClassification: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="normal_staff">Normal Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="senior_executive">Senior Executive</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Specific Role (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g., Chef, Housekeeper (leave blank for general plan)"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Wage Type *
                    </label>
                    <select
                      value={formData.wageType}
                      onChange={(e) => setFormData({ ...formData, wageType: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Base Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.baseAmount}
                      onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
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
                      Overtime Rate (Multiplier)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.overtimeRate}
                      onChange={(e) => setFormData({ ...formData, overtimeRate: e.target.value })}
                      placeholder="e.g., 1.5 for 1.5x"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Benefits
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={formData.newBenefit}
                      onChange={(e) => setFormData({ ...formData, newBenefit: e.target.value })}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addBenefit();
                        }
                      }}
                      placeholder="Add benefit..."
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={addBenefit}
                      style={{
                        padding: '0.75rem 1rem',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {formData.benefits.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {formData.benefits.map((benefit, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: '#f1f5f9',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          {benefit}
                          <button
                            type="button"
                            onClick={() => removeBenefit(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <X size={14} color="#ef4444" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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

        {/* Edit Modal - Similar structure to Create Modal */}
        {showEditModal && selectedWagePlan && (
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
              setSelectedWagePlan(null);
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                width: '90%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Edit Wage Plan</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedWagePlan(null);
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
                    Plan Name *
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

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Role Classification *
                  </label>
                  <select
                    value={formData.roleClassification}
                    onChange={(e) => setFormData({ ...formData, roleClassification: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="normal_staff">Normal Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="senior_executive">Senior Executive</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Specific Role (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="Leave blank for general plan"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Wage Type *
                    </label>
                    <select
                      value={formData.wageType}
                      onChange={(e) => setFormData({ ...formData, wageType: e.target.value as any })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Base Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.baseAmount}
                      onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
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
                      Overtime Rate
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.overtimeRate}
                      onChange={(e) => setFormData({ ...formData, overtimeRate: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Benefits
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      value={formData.newBenefit}
                      onChange={(e) => setFormData({ ...formData, newBenefit: e.target.value })}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addBenefit();
                        }
                      }}
                      placeholder="Add benefit..."
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    />
                    <button
                      type="button"
                      onClick={addBenefit}
                      style={{
                        padding: '0.75rem 1rem',
                        border: 'none',
                        borderRadius: '6px',
                        background: '#3b82f6',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                    >
                      Add
                    </button>
                  </div>
                  {formData.benefits.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {formData.benefits.map((benefit, idx) => (
                        <span
                          key={idx}
                          style={{
                            padding: '0.5rem 0.75rem',
                            background: '#f1f5f9',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          {benefit}
                          <button
                            type="button"
                            onClick={() => removeBenefit(idx)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <X size={14} color="#ef4444" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
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
                      setSelectedWagePlan(null);
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

        {/* Assign Modal */}
        {showAssignModal && selectedWagePlan && (
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
              setShowAssignModal(false);
              setSelectedWagePlan(null);
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                width: '90%',
                maxWidth: '500px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Assign Wage Plan</h2>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedWagePlan(null);
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

              <div style={{ marginBottom: '1rem' }}>
                <p style={{ margin: '0 0 0.5rem', color: '#64748b' }}>Wage Plan:</p>
                <p style={{ margin: 0, fontWeight: '600', color: '#1e293b' }}>{selectedWagePlan.name}</p>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Select Staff Member *
                </label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                >
                  <option value="">Select staff member...</option>
                  {staff.filter(s => s.isActive).map((staffMember) => (
                    <option key={staffMember.id} value={staffMember.id}>
                      {staffMember.firstName} {staffMember.lastName} - {staffMember.role}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedWagePlan(null);
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
                  onClick={handleAssign}
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
                  Assign
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

