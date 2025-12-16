import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Button from '../components/Button';
import {
  Plus,
  Search,
  Filter,
  ChefHat,
  Clock,
  DollarSign,
  Edit,
  Trash2,
  ShoppingCart,
  Package,
  Star,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  isActive: boolean;
  imageUrl?: string;
}

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isActive: boolean;
  isVegetarian: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  containsNuts: boolean;
  spiceLevel: string;
  preparationTime?: number;
  allergens: string[];
}

interface RoomServiceOrder {
  id: string;
  orderNumber: string;
  guestName: string;
  roomNumber: string;
  guestPhone?: string;
  status: string;
  orderType: string;
  specialInstructions?: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  totalAmount: number;
  requestedAt: string;
  confirmedAt?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  preparedAt?: string;
  items: any[];
}

interface OrderStats {
  totalOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  popularItems: Array<{ name: string; count: number }>;
}

export default function RoomServicePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics'>('orders');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<RoomServiceOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  useEffect(() => {
    if (activeTab === 'menu') {
      loadMenuData();
    } else if (activeTab === 'orders') {
      loadOrders();
      loadStats();
    }
  }, [user?.tenantId, activeTab, statusFilter]);

  const loadMenuData = async () => {
    if (!user?.tenantId) return;

    try {
      const [categoriesResponse, itemsResponse] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/menu/categories`),
        api.get(`/tenants/${user.tenantId}/menu/items`)
      ]);

      setCategories(categoriesResponse.data.data);
      setMenuItems(itemsResponse.data.data);
    } catch (error) {
      console.error('Error loading menu data:', error);
      toast.error('Failed to load menu data');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    if (!user?.tenantId) return;

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await api.get(`/tenants/${user.tenantId}/room-service/orders?${params}`);
      setOrders(response.data.data);
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!user?.tenantId) return;

    try {
      const response = await api.get(`/tenants/${user.tenantId}/room-service/stats/summary`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.roomNumber.includes(searchTerm) ||
    order.orderNumber.toLowerCase().includes(searchTerm)
  );

  const filteredItems = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'confirmed': return '#3b82f6';
      case 'preparing': return '#8b5cf6';
      case 'ready': return '#f97316';
      case 'delivered': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSpiceLevelColor = (level: string) => {
    switch (level) {
      case 'mild': return '#10b981';
      case 'medium': return '#f97316';
      case 'hot': return '#ef4444';
      case 'very_hot': return '#991b1b';
      default: return '#6b7280';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'menu', label: 'Menu', icon: ChefHat },
    { id: 'analytics', label: 'Analytics', icon: DollarSign }
  ];

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Room Service
        </h1>
        <p style={{ color: '#64748b' }}>
          Manage menu items, orders, and room service operations
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

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div>
          {/* Stats Cards */}
          {stats && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
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
                  {stats.totalOrders}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Orders</div>
              </div>

              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>
                  {formatCurrency(stats.totalRevenue)}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Revenue</div>
              </div>

              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>
                  {formatCurrency(stats.averageOrderValue)}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Avg Order Value</div>
              </div>

              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1.5rem',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f97316' }}>
                  {stats.popularItems.length > 0 ? stats.popularItems[0].name : 'N/A'}
                </div>
                <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Top Item</div>
              </div>
            </div>
          )}

          {/* Filters */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
                <Search size={18} style={{ color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Search orders..."
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
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="preparing">Preparing</option>
                <option value="ready">Ready</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Orders List */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              Loading orders...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              border: '2px dashed #e2e8f0',
              borderRadius: '8px'
            }}>
              <ShoppingCart size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                No Orders Found
              </h3>
              <p style={{ color: '#64748b' }}>
                {searchTerm || statusFilter !== 'all'
                  ? 'No orders match your current filters.'
                  : 'No room service orders have been placed yet.'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        Order #{order.orderNumber}
                      </h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.875rem', color: '#64748b' }}>
                        <span>{order.guestName}</span>
                        <span>Room {order.roomNumber}</span>
                        <span>{formatDate(order.requestedAt)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        background: `${getStatusColor(order.status)}20`,
                        color: getStatusColor(order.status)
                      }}>
                        {order.status.toUpperCase()}
                      </span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                        {formatCurrency(order.totalAmount)}
                      </div>
                    </div>
                  </div>

                  {order.specialInstructions && (
                    <div style={{
                      background: '#fef3c7',
                      border: '1px solid #f59e0b',
                      borderRadius: '6px',
                      padding: '0.75rem',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                        <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#92400e' }}>
                          Special Instructions
                        </span>
                      </div>
                      <p style={{ fontSize: '0.875rem', color: '#92400e', margin: 0 }}>
                        {order.specialInstructions}
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      {order.items.length} item{order.items.length !== 1 ? 's' : ''}
                      {order.estimatedDelivery && (
                        <span style={{ marginLeft: '1rem' }}>
                          Est. delivery: {formatDate(order.estimatedDelivery)}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                      <Button variant="ghost" size="sm">
                        Update Status
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Menu Tab */}
      {activeTab === 'menu' && (
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem'
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>Menu Management</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button onClick={() => setShowCategoryModal(true)}>
                <Plus size={18} style={{ marginRight: '0.5rem' }} />
                Add Category
              </Button>
              <Button onClick={() => setShowItemModal(true)}>
                <Plus size={18} style={{ marginRight: '0.5rem' }} />
                Add Item
              </Button>
            </div>
          </div>

          {/* Search */}
          <div style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', maxWidth: '400px' }}>
              <Search size={18} style={{ color: '#64748b' }} />
              <input
                type="text"
                placeholder="Search menu items..."
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
          </div>

          {/* Menu Items Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              Loading menu...
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              border: '2px dashed #e2e8f0',
              borderRadius: '8px'
            }}>
              <ChefHat size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                No Menu Items Found
              </h3>
              <p style={{ color: '#64748b' }}>
                {searchTerm ? 'No items match your search.' : 'Start by adding menu categories and items.'}
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '1.5rem'
            }}>
              {filteredItems.map((item) => {
                const category = categories.find(c => c.id === item.categoryId);
                return (
                  <div
                    key={item.id}
                    style={{
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}
                  >
                    {item.imageUrl && (
                      <div style={{
                        height: '150px',
                        backgroundImage: `url(${item.imageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }} />
                    )}

                    <div style={{ padding: '1.5rem' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '0.75rem'
                      }}>
                        <div>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                            {item.name}
                          </h3>
                          <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            {category?.name}
                          </p>
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1f2937' }}>
                          {formatCurrency(item.price)}
                        </div>
                      </div>

                      {item.description && (
                        <p style={{
                          fontSize: '0.875rem',
                          color: '#64748b',
                          marginBottom: '1rem',
                          lineHeight: '1.4'
                        }}>
                          {item.description}
                        </p>
                      )}

                      {/* Dietary Info */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        marginBottom: '1rem'
                      }}>
                        {item.isVegetarian && (
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            background: '#dcfce7',
                            color: '#166534',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            Vegetarian
                          </span>
                        )}
                        {item.isVegan && (
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            background: '#dcfce7',
                            color: '#166534',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            Vegan
                          </span>
                        )}
                        {item.isGlutenFree && (
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            background: '#dbeafe',
                            color: '#1e40af',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            Gluten Free
                          </span>
                        )}
                        {item.spiceLevel !== 'mild' && (
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            background: `${getSpiceLevelColor(item.spiceLevel)}20`,
                            color: getSpiceLevelColor(item.spiceLevel),
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: '500'
                          }}>
                            {item.spiceLevel.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {item.preparationTime && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem', color: '#64748b' }}>
                              <Clock size={14} />
                              {item.preparationTime}min
                            </div>
                          )}
                          <span style={{
                            padding: '0.125rem 0.5rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            background: item.isActive ? '#dcfce7' : '#fee2e2',
                            color: item.isActive ? '#166534' : '#991b1b'
                          }}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <Button variant="ghost" size="sm">
                            <Edit size={16} />
                          </Button>
                          <Button variant="ghost" size="sm" style={{ color: '#ef4444' }}>
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
            Room Service Analytics
          </h2>

          <div style={{
            textAlign: 'center',
            padding: '3rem',
            border: '2px dashed #e2e8f0',
            borderRadius: '8px'
          }}>
            <DollarSign size={48} style={{ color: '#cbd5e1', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
              Analytics Coming Soon
            </h3>
            <p style={{ color: '#64748b' }}>
              Advanced analytics and reporting features will be available here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
