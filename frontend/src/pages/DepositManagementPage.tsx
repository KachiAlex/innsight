import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import DepositPolicyModal from '../components/DepositPolicyModal';
import Layout from '../components/Layout';
import { Plus, Edit, Trash2, DollarSign, Calculator, Settings } from 'lucide-react';
import toast from 'react-hot-toast';

interface DepositPolicy {
  id: string;
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
  createdAt: string;
  updatedAt: string;
}

interface DepositCalculation {
  depositAmount: number;
  depositRequired: boolean;
  policy: {
    id: string;
    name: string;
    depositType: string;
    depositValue: number;
  };
  calculation: {
    type: string;
    nights: number;
    rate: number;
    rawAmount: number;
    adjustments: {
      minLimit?: number;
      maxLimit?: number;
    };
  };
}

export default function DepositManagementPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'policies' | 'calculator' | 'payments'>('policies');
  const [policies, setPolicies] = useState<DepositPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<DepositPolicy | null>(null);

  // Calculator state
  const [calculatorData, setCalculatorData] = useState({
    roomId: '',
    checkInDate: '',
    checkOutDate: '',
    rate: '',
    roomType: '',
    categoryId: '',
    ratePlanId: ''
  });
  const [calculation, setCalculation] = useState<DepositCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);

  const loadPolicies = useCallback(async () => {
    if (!user?.tenantId) return;

    try {
      const response = await api.get(`/tenants/${user.tenantId}/deposits/policies`);
      setPolicies(response.data.data);
    } catch (error) {
      console.error('Error loading deposit policies:', error);
      toast.error('Failed to load deposit policies');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleCalculateDeposit = async () => {
    if (!user?.tenantId) return;

    const { roomId, checkInDate, checkOutDate, rate, roomType, categoryId, ratePlanId } = calculatorData;

    if (!roomId || !checkInDate || !checkOutDate || !rate) {
      toast.error('Please fill in all required fields');
      return;
    }

    setCalculating(true);
    try {
      const response = await api.post(`/tenants/${user.tenantId}/deposits/calculate`, {
        roomId,
        checkInDate,
        checkOutDate,
        rate: parseFloat(rate),
        roomType,
        categoryId,
        ratePlanId
      });

      setCalculation(response.data.data);
    } catch (error) {
      console.error('Error calculating deposit:', error);
      toast.error('Failed to calculate deposit');
    } finally {
      setCalculating(false);
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!user?.tenantId) return;

    if (!confirm('Are you sure you want to delete this deposit policy?')) return;

    try {
      await api.delete(`/tenants/${user.tenantId}/deposits/policies/${policyId}`);
      toast.success('Deposit policy deleted successfully');
      loadPolicies();
    } catch (error) {
      console.error('Error deleting policy:', error);
      toast.error('Failed to delete deposit policy');
    }
  };

  const tabs = [
    { id: 'policies', label: 'Policies', icon: Settings },
    { id: 'calculator', label: 'Calculator', icon: Calculator },
    { id: 'payments', label: 'Payments', icon: DollarSign }
  ];

  return (
    <Layout>
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Deposit Management
        </h1>
        <p style={{ color: '#64748b' }}>
          Manage deposit policies, calculate deposits, and track payments
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '2rem'
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 1.5rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab.id ? '#3b82f6' : '#64748b',
              fontWeight: activeTab === tab.id ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Policies Tab */}
      {activeTab === 'policies' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Deposit Policies</h2>
            <Button
              onClick={() => {
                setEditingPolicy(null);
                setShowPolicyModal(true);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={18} />
              New Policy
            </Button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              Loading policies...
            </div>
          ) : policies.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              border: '2px dashed #e2e8f0',
              borderRadius: '8px'
            }}>
              <Settings size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                No Deposit Policies
              </h3>
              <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
                Create your first deposit policy to start managing deposits
              </p>
              <Button onClick={() => setShowPolicyModal(true)}>
                <Plus size={18} style={{ marginRight: '0.5rem' }} />
                Create Policy
              </Button>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))'
            }}>
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    background: 'white'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem'
                  }}>
                    <div>
                      <h3 style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                        {policy.name}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                        {policy.description}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPolicy(policy);
                          setShowPolicyModal(true);
                        }}
                        title="Edit policy"
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePolicy(policy.id)}
                        style={{ color: '#ef4444' }}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '1rem',
                    fontSize: '0.875rem'
                  }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Type:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>
                        {policy.depositType.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Value:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>
                        {policy.depositType === 'percentage' ? `${policy.depositValue}%` : `₦${policy.depositValue}`}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Status:</span>
                      <span style={{
                        marginLeft: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: policy.isActive ? '#dcfce7' : '#fee2e2',
                        color: policy.isActive ? '#166534' : '#991b1b'
                      }}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Rooms:</span>
                      <span style={{ marginLeft: '0.5rem', fontWeight: '500' }}>
                        {policy.appliesToAllRooms ? 'All' : `${policy.roomCategoryIds.length} categories`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Calculator Tab */}
      {activeTab === 'calculator' && (
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Deposit Calculator
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem'
          }}>
            {/* Calculator Form */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '2rem',
              background: 'white'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                Calculate Deposit
              </h3>

              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    marginBottom: '0.5rem',
                    color: '#374151'
                  }}>
                    Room ID *
                  </label>
                  <input
                    type="text"
                    value={calculatorData.roomId}
                    onChange={(e) => setCalculatorData(prev => ({ ...prev, roomId: e.target.value }))}
                    placeholder="Enter room ID"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '1rem'
                    }}
                  />
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
                      Check-in Date *
                    </label>
                    <input
                      type="date"
                      value={calculatorData.checkInDate}
                      onChange={(e) => setCalculatorData(prev => ({ ...prev, checkInDate: e.target.value }))}
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
                      Check-out Date *
                    </label>
                    <input
                      type="date"
                      value={calculatorData.checkOutDate}
                      onChange={(e) => setCalculatorData(prev => ({ ...prev, checkOutDate: e.target.value }))}
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                      marginBottom: '0.5rem',
                      color: '#374151'
                    }}>
                      Room Rate (₦) *
                    </label>
                    <input
                      type="number"
                      value={calculatorData.rate}
                      onChange={(e) => setCalculatorData(prev => ({ ...prev, rate: e.target.value }))}
                      placeholder="25000"
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
                      Room Type
                    </label>
                    <input
                      type="text"
                      value={calculatorData.roomType}
                      onChange={(e) => setCalculatorData(prev => ({ ...prev, roomType: e.target.value }))}
                      placeholder="deluxe"
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

                <Button
                  onClick={handleCalculateDeposit}
                  loading={calculating}
                  style={{ width: '100%', marginTop: '1rem' }}
                >
                  <Calculator size={18} style={{ marginRight: '0.5rem' }} />
                  Calculate Deposit
                </Button>
              </div>
            </div>

            {/* Calculation Result */}
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '2rem',
              background: 'white'
            }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                Calculation Result
              </h3>

              {calculation ? (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div style={{
                    padding: '1.5rem',
                    background: '#f0f9ff',
                    borderRadius: '8px',
                    border: '1px solid #bae6fd'
                  }}>
                    <div style={{
                      fontSize: '2rem',
                      fontWeight: 'bold',
                      color: '#0369a1',
                      marginBottom: '0.5rem'
                    }}>
                      ₦{calculation.depositAmount.toLocaleString()}
                    </div>
                    <div style={{ color: '#0369a1', fontSize: '0.875rem' }}>
                      Required Deposit Amount
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '6px'
                    }}>
                      <span style={{ color: '#64748b' }}>Policy Applied:</span>
                      <span style={{ fontWeight: '500' }}>{calculation.policy.name}</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '6px'
                    }}>
                      <span style={{ color: '#64748b' }}>Calculation Type:</span>
                      <span style={{ fontWeight: '500' }}>{calculation.calculation.type.replace('_', ' ').toUpperCase()}</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '6px'
                    }}>
                      <span style={{ color: '#64748b' }}>Nights:</span>
                      <span style={{ fontWeight: '500' }}>{calculation.calculation.nights}</span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      background: '#f8fafc',
                      borderRadius: '6px'
                    }}>
                      <span style={{ color: '#64748b' }}>Deposit Required:</span>
                      <span style={{
                        fontWeight: '500',
                        color: calculation.depositRequired ? '#166534' : '#991b1b'
                      }}>
                        {calculation.depositRequired ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: '#64748b'
                }}>
                  <Calculator size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>Enter reservation details and click calculate to see the deposit amount</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Deposit Payments
          </h2>

          <div style={{
            textAlign: 'center',
            padding: '3rem',
            border: '2px dashed #e2e8f0',
            borderRadius: '8px'
          }}>
            <DollarSign size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Payment Tracking
            </h3>
            <p style={{ color: '#64748b' }}>
              Deposit payment tracking will be implemented here
            </p>
          </div>
        </div>
      )}

        {/* Policy Modal */}
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
      </div>
    </Layout>
  );
}
