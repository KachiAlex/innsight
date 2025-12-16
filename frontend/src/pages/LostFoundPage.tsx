import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import {
  Plus,
  Search,
  Package,
  User,
  MapPin,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Edit,
  Eye,
  DollarSign,
  Hash
} from 'lucide-react';
import toast from 'react-hot-toast';

interface LostItem {
  id: string;
  itemNumber: string;
  itemName: string;
  description: string;
  category: string;
  color?: string;
  brand?: string;
  serialNumber?: string;
  value?: number;
  foundLocation: string;
  foundBy?: string;
  foundAt: string;
  circumstances?: string;
  reportedByGuestId?: string;
  reportedByName?: string;
  reportedByPhone?: string;
  reportedByEmail?: string;
  reportedByRoom?: string;
  reportedAt?: string;
  claimedBy?: string;
  claimedAt?: string;
  claimMethod?: string;
  returnMethod?: string;
  returnedTo?: string;
  status: string;
  storageLocation?: string;
  storageNotes?: string;
  disposedAt?: string;
  disposedBy?: string;
  disposalMethod?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface ItemStats {
  total: number;
  unclaimed: number;
  claimed: number;
  returned: number;
  disposed: number;
  reported: number;
  totalValue: number;
  averageClaimTime: number;
}

export default function LostFoundPage() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<LostItem[]>([]);
  const [stats, setStats] = useState<ItemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadItems();
    loadStats();
  }, [user?.tenantId, statusFilter, categoryFilter]);

  const loadItems = async () => {
    if (!user?.tenantId) return;

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);

      const response = await api.get(`/tenants/${user.tenantId}/lost-found?${params}`);
      setItems(response.data.data);
    } catch (error) {
      console.error('Error loading lost items:', error);
      toast.error('Failed to load lost items');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user?.tenantId) return;

    try {
      const response = await api.get(`/tenants/${user.tenantId}/lost-found/stats/summary`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading item stats:', error);
    }
  };

  const filteredItems = items.filter(item =>
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.itemNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.reportedByName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'unclaimed': return '#f59e0b';
      case 'claimed': return '#10b981';
      case 'returned': return '#3b82f6';
      case 'disposed': return '#6b7280';
      case 'reported': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'unclaimed': return Clock;
      case 'claimed': return CheckCircle;
      case 'returned': return CheckCircle;
      case 'disposed': return XCircle;
      case 'reported': return AlertTriangle;
      default: return Package;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'electronics': return '#3b82f6';
      case 'clothing': return '#10b981';
      case 'jewelry': return '#f59e0b';
      case 'documents': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };


  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w ago`;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Lost & Found
        </h1>
        <p style={{ color: '#64748b' }}>
          Manage found items, lost item reports, and item recovery
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937' }}>
              {stats.total}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Items</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
              {stats.unclaimed}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Unclaimed</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
              {stats.claimed}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Claimed</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
              {stats.returned}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Returned</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {formatCurrency(stats.totalValue)}
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Value</div>
          </div>

          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f97316' }}>
              {stats.averageClaimTime.toFixed(1)}d
            </div>
            <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Avg Claim Time</div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <Button onClick={() => setShowRegisterModal(true)}>
            <Plus size={18} style={{ marginRight: '0.5rem' }} />
            Register Found Item
          </Button>
          <Button variant="secondary" onClick={() => setShowReportModal(true)}>
            <AlertTriangle size={18} style={{ marginRight: '0.5rem' }} />
            Report Lost Item
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <div style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '250px' }}>
            <Search size={18} style={{ color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              minWidth: '140px'
            }}
          >
            <option value="all">All Status</option>
            <option value="unclaimed">Unclaimed</option>
            <option value="claimed">Claimed</option>
            <option value="returned">Returned</option>
            <option value="reported">Reported</option>
            <option value="disposed">Disposed</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '0.875rem',
              minWidth: '140px'
            }}
          >
            <option value="all">All Categories</option>
            <option value="electronics">Electronics</option>
            <option value="clothing">Clothing</option>
            <option value="jewelry">Jewelry</option>
            <option value="documents">Documents</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          Loading items...
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          border: '2px dashed #e2e8f0',
          borderRadius: '8px'
        }}>
          <Package size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            No Items Found
          </h3>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
            {searchTerm || statusFilter !== 'all' || categoryFilter !== 'all'
              ? 'No items match your current filters.'
              : 'No lost or found items have been registered yet.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Button onClick={() => setShowRegisterModal(true)}>
              <Plus size={18} style={{ marginRight: '0.5rem' }} />
              Register Found Item
            </Button>
            <Button variant="secondary" onClick={() => setShowReportModal(true)}>
              <AlertTriangle size={18} style={{ marginRight: '0.5rem' }} />
              Report Lost Item
            </Button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1.5rem'
        }}>
          {filteredItems.map((item) => {
            const StatusIcon = getStatusIcon(item.status);
            return (
              <div
                key={item.id}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onClick={() => {
                  setSelectedItem(item);
                  setShowDetailsModal(true);
                }}
              >
                <div style={{
                  padding: '1.5rem',
                  borderBottom: item.status === 'unclaimed' ? '3px solid #f59e0b' :
                                item.status === 'claimed' ? '3px solid #10b981' :
                                item.status === 'returned' ? '3px solid #3b82f6' :
                                item.status === 'reported' ? '3px solid #8b5cf6' : '3px solid #6b7280'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '1rem'
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginBottom: '0.5rem'
                      }}>
                        <Package size={20} style={{ color: getCategoryColor(item.category) }} />
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                          {item.itemName}
                        </h3>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        fontSize: '0.875rem',
                        color: '#64748b',
                        marginBottom: '0.5rem'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Hash size={14} />
                          {item.itemNumber}
                        </span>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          background: `${getCategoryColor(item.category)}20`,
                          color: getCategoryColor(item.category)
                        }}>
                          {item.category}
                        </span>
                      </div>

                      <p style={{
                        fontSize: '0.875rem',
                        color: '#64748b',
                        marginBottom: '1rem',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}>
                        {item.description}
                      </p>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginLeft: '1rem'
                    }}>
                      <StatusIcon size={16} style={{ color: getStatusColor(item.status) }} />
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        background: `${getStatusColor(item.status)}20`,
                        color: getStatusColor(item.status)
                      }}>
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Item Details */}
                  <div style={{ display: 'grid', gap: '0.75rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                      <MapPin size={14} />
                      <span>Found: {item.foundLocation}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                      <Calendar size={14} />
                      <span>{getTimeAgo(item.foundAt)}</span>
                    </div>

                    {item.value && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                        <DollarSign size={14} />
                        <span>{formatCurrency(item.value)}</span>
                      </div>
                    )}

                    {item.reportedByName && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                        <User size={14} />
                        <span>Reported by: {item.reportedByName}</span>
                      </div>
                    )}

                    {item.storageLocation && (
                      <div style={{
                        padding: '0.5rem',
                        background: '#f8fafc',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        color: '#64748b'
                      }}>
                        📍 {item.storageLocation}
                        {item.storageNotes && (
                          <div style={{ marginTop: '0.25rem', fontStyle: 'italic' }}>
                            {item.storageNotes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '0.5rem',
                    marginTop: '1rem',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e2e8f0'
                  }}>
                    <Button variant="ghost" size="sm" style={{ flex: 1 }}>
                      <Eye size={14} style={{ marginRight: '0.25rem' }} />
                      View
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit size={14} />
                    </Button>
                    {item.status === 'unclaimed' && (
                      <Button variant="ghost" size="sm" style={{ color: '#10b981' }}>
                        <CheckCircle size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Found Item Modal Placeholder */}
      {showRegisterModal && (
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
            maxWidth: '500px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                Register Found Item
              </h2>
              <button
                onClick={() => setShowRegisterModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Item registration form will be implemented here
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Lost Item Modal Placeholder */}
      {showReportModal && (
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
            maxWidth: '500px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                Report Lost Item
              </h2>
              <button
                onClick={() => setShowReportModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Lost item reporting form will be implemented here
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Details Modal Placeholder */}
      {showDetailsModal && selectedItem && (
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
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1.5rem',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
                {selectedItem.itemName} Details
              </h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  color: '#64748b'
                }}
              >
                ×
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                Detailed item management interface will be implemented here
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
