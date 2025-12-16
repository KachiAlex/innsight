import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from './Button';
import { X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface DepositPolicy {
  id?: string;
  name: string;
  description?: string;
  depositType: 'percentage' | 'fixed_amount' | 'nights' | 'custom';
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

export default function DepositPolicyModal({
  isOpen,
  onClose,
  policy,
  onSuccess
}: DepositPolicyModalProps) {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<DepositPolicy>({
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
  });

  const [newRoomCategory, setNewRoomCategory] = useState('');
  const [newRatePlan, setNewRatePlan] = useState('');

  useEffect(() => {
    if (policy) {
      setFormData(policy);
    } else {
      setFormData({
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
      });
    }
  }, [policy, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.tenantId) return;

    // Validation
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
        ...formData,
        maxDepositAmount: formData.maxDepositAmount || null,
        minDepositAmount: formData.minDepositAmount || null,
        refundableAfterDays: formData.refundableAfterDays || null,
        cancellationFee: formData.cancellationFee || null,
      };

      if (policy?.id) {
        await api.put(`/tenants/${user.tenantId}/deposit-policies/${policy.id}`, submitData);
        toast.success('Deposit policy updated successfully');
      } else {
        await api.post(`/tenants/${user.tenantId}/deposit-policies`, submitData);
        toast.success('Deposit policy created successfully');
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error saving deposit policy:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to save deposit policy');
    } finally {
      setLoading(false);
    }
  };

  const addRoomCategory = () => {
    if (newRoomCategory.trim() && !formData.roomCategoryIds.includes(newRoomCategory.trim())) {
      setFormData(prev => ({
        ...prev,
        roomCategoryIds: [...prev.roomCategoryIds, newRoomCategory.trim()]
      }));
      setNewRoomCategory('');
    }
  };

  const removeRoomCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      roomCategoryIds: prev.roomCategoryIds.filter(c => c !== category)
    }));
  };

  const addRatePlan = () => {
    if (newRatePlan.trim() && !formData.ratePlanIds.includes(newRatePlan.trim())) {
      setFormData(prev => ({
        ...prev,
        ratePlanIds: [...prev.ratePlanIds, newRatePlan.trim()]
      }));
      setNewRatePlan('');
    }
  };

  const removeRatePlan = (plan: string) => {
    setFormData(prev => ({
      ...prev,
      ratePlanIds: prev.ratePlanIds.filter(p => p !== plan)
    }));
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '12px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '90vh',
        overflow: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.5rem',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
            {policy ? 'Edit Deposit Policy' : 'Create Deposit Policy'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '6px',
              color: '#64748b'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Basic Information */}
            <div style={{ display: 'grid', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Basic Information
              </h3>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#374151'
                }}>
                  Policy Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Standard Weekend Policy"
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#374151'
                }}>
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description of the policy"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                />
                <label htmlFor="isActive" style={{ fontSize: '0.875rem', color: '#374151' }}>
                  Active Policy
                </label>
              </div>
            </div>

            {/* Deposit Calculation */}
            <div style={{ display: 'grid', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Deposit Calculation
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Deposit Type *
                  </label>
                  <select
                    value={formData.depositType}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      depositType: e.target.value as any
                    }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed Amount</option>
                    <option value="nights">Per Night</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Value *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {formData.depositType === 'percentage' && (
                      <span style={{ marginRight: '0.5rem', color: '#64748b' }}>%</span>
                    )}
                    {formData.depositType === 'fixed_amount' && (
                      <span style={{ marginRight: '0.5rem', color: '#64748b' }}>₦</span>
                    )}
                    <input
                      type="number"
                      value={formData.depositValue}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        depositValue: parseFloat(e.target.value) || 0
                      }))}
                      min="0"
                      step={formData.depositType === 'percentage' ? '1' : '100'}
                      placeholder={formData.depositType === 'percentage' ? '30' : '5000'}
                      required
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Minimum Deposit
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '0.5rem', color: '#64748b' }}>₦</span>
                    <input
                      type="number"
                      value={formData.minDepositAmount || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        minDepositAmount: e.target.value ? parseFloat(e.target.value) : undefined
                      }))}
                      min="0"
                      step="100"
                      placeholder="1000"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Maximum Deposit
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: '0.5rem', color: '#64748b' }}>₦</span>
                    <input
                      type="number"
                      value={formData.maxDepositAmount || ''}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        maxDepositAmount: e.target.value ? parseFloat(e.target.value) : undefined
                      }))}
                      min="0"
                      step="100"
                      placeholder="50000"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '1rem'
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Application Rules */}
            <div style={{ display: 'grid', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Application Rules
              </h3>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="appliesToAllRooms"
                  checked={formData.appliesToAllRooms}
                  onChange={(e) => setFormData(prev => ({ ...prev, appliesToAllRooms: e.target.checked }))}
                />
                <label htmlFor="appliesToAllRooms" style={{ fontSize: '0.875rem', color: '#374151' }}>
                  Apply to all rooms
                </label>
              </div>

              {!formData.appliesToAllRooms && (
                <>
                  {/* Room Categories */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: '#374151'
                    }}>
                      Room Categories
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        value={newRoomCategory}
                        onChange={(e) => setNewRoomCategory(e.target.value)}
                        placeholder="e.g., deluxe, suite"
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '1rem'
                        }}
                      />
                      <Button type="button" onClick={addRoomCategory} size="sm">
                        <Plus size={16} />
                      </Button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {formData.roomCategoryIds.map((category) => (
                        <span
                          key={category}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            background: '#e0f2fe',
                            color: '#0277bd',
                            borderRadius: '4px',
                            fontSize: '0.75rem'
                          }}
                        >
                          {category}
                          <button
                            type="button"
                            onClick={() => removeRoomCategory(category)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0',
                              color: '#0277bd'
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Rate Plans */}
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: '#374151'
                    }}>
                      Rate Plans
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input
                        type="text"
                        value={newRatePlan}
                        onChange={(e) => setNewRatePlan(e.target.value)}
                        placeholder="e.g., standard, corporate"
                        style={{
                          flex: 1,
                          padding: '0.75rem',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '1rem'
                        }}
                      />
                      <Button type="button" onClick={addRatePlan} size="sm">
                        <Plus size={16} />
                      </Button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {formData.ratePlanIds.map((plan) => (
                        <span
                          key={plan}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.25rem 0.5rem',
                            background: '#e8f5e8',
                            color: '#2e7d32',
                            borderRadius: '4px',
                            fontSize: '0.75rem'
                          }}
                        >
                          {plan}
                          <button
                            type="button"
                            onClick={() => removeRatePlan(plan)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '0',
                              color: '#2e7d32'
                            }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Timing Rules */}
            <div style={{ display: 'grid', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Timing Rules
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Due Days Before Check-in
                  </label>
                  <input
                    type="number"
                    value={formData.dueDaysBeforeCheckIn || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      dueDaysBeforeCheckIn: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    min="0"
                    placeholder="7"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Refundable After Days
                  </label>
                  <input
                    type="number"
                    value={formData.refundableAfterDays || ''}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      refundableAfterDays: e.target.value ? parseInt(e.target.value) : undefined
                    }))}
                    min="0"
                    placeholder="30"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  marginBottom: '0.5rem',
                  color: '#374151'
                }}>
                  Cancellation Fee (%)
                </label>
                <input
                  type="number"
                  value={formData.cancellationFee || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    cancellationFee: e.target.value ? parseFloat(e.target.value) : undefined
                  }))}
                  min="0"
                  max="100"
                  step="1"
                  placeholder="10"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '1rem'
                  }}
                />
              </div>
            </div>

            {/* Special Conditions */}
            <div style={{ display: 'grid', gap: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                Special Conditions
              </h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="requiresForWeekends"
                    checked={formData.requiresForWeekends || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresForWeekends: e.target.checked }))}
                  />
                  <label htmlFor="requiresForWeekends" style={{ fontSize: '0.875rem', color: '#374151' }}>
                    Weekends
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="requiresForHolidays"
                    checked={formData.requiresForHolidays || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresForHolidays: e.target.checked }))}
                  />
                  <label htmlFor="requiresForHolidays" style={{ fontSize: '0.875rem', color: '#374151' }}>
                    Holidays
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="requiresForPeakSeason"
                    checked={formData.requiresForPeakSeason || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresForPeakSeason: e.target.checked }))}
                  />
                  <label htmlFor="requiresForPeakSeason" style={{ fontSize: '0.875rem', color: '#374151' }}>
                    Peak Season
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid #e2e8f0',
            marginTop: '1.5rem'
          }}>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              {policy ? 'Update Policy' : 'Create Policy'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
