import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import { format } from 'date-fns';
import {
  Plus,
  ChefHat,
  Clock,
  ShoppingCart,
  AlertTriangle,
  Pencil,
  Power,
  Minus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import {
  Button,
  ChargeSummary,
  ConfirmDialog,
  DetailDrawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  SkeletonTable,
  StatCard,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';
import styles from './RoomServicePage.module.css';

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

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialRequests?: string;
  menuItem?: { name: string; price: number };
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
  deliveryNotes?: string;
  subtotal: number;
  taxAmount?: number;
  serviceCharge: number;
  totalAmount: number;
  requestedAt: string;
  confirmedAt?: string;
  estimatedDelivery?: string;
  deliveredAt?: string;
  preparedAt?: string;
  items: OrderItem[];
  assignedStaff?: { firstName: string; lastName: string };
  deliveryStaff?: { firstName: string; lastName: string };
}

interface OrderStats {
  byStatus: Record<string, number>;
  todayOrderCount: number;
  todayRevenue: number;
  totalRevenue: number;
}

const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'delivered',
] as const;

const NEXT_STATUS: Record<string, { next: string; label: string } | null> = {
  pending: { next: 'confirmed', label: 'Confirm' },
  confirmed: { next: 'preparing', label: 'Start preparing' },
  preparing: { next: 'ready', label: 'Mark ready' },
  ready: { next: 'delivering', label: 'Out for delivery' },
  delivering: { next: 'delivered', label: 'Mark delivered' },
  delivered: null,
  cancelled: null,
};

const SPICE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  mild: 'success',
  medium: 'warning',
  hot: 'danger',
  very_hot: 'danger',
};

export default function RoomServicePage() {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const money = (n?: number | null) => formatMoney(n, settings.currencySymbol);

  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'analytics'>('orders');
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<RoomServiceOrder[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  const [selectedOrder, setSelectedOrder] = useState<RoomServiceOrder | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<RoomServiceOrder | null>(null);

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | 'new' | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const [ordersRes, statsRes] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/room-service/orders?${params}`),
        api.get(`/tenants/${user.tenantId}/room-service/stats/summary`),
      ]);
      setOrders(ordersRes.data.data || []);
      setTotalPages(ordersRes.data.pagination?.totalPages ?? 1);
      setTotalOrders(ordersRes.data.pagination?.total ?? 0);
      setStats(statsRes.data.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load orders');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, statusFilter, page]);

  const loadMenuData = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const [categoriesRes, itemsRes] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/menu/categories`),
        api.get(`/tenants/${user.tenantId}/menu/items`),
      ]);
      setCategories(categoriesRes.data.data || []);
      setMenuItems(itemsRes.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load menu data');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    if (activeTab === 'orders' || activeTab === 'analytics') {
      loadOrders();
    } else {
      loadMenuData();
    }
  }, [activeTab, loadOrders, loadMenuData]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const openOrderDetail = async (order: RoomServiceOrder) => {
    setSelectedOrder(order);
    setOrderDetailLoading(true);
    try {
      const res = await api.get(
        `/tenants/${user?.tenantId}/room-service/orders/${order.id}`
      );
      setSelectedOrder(res.data.data);
    } catch {
      // keep list-level data
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await api.patch(
        `/tenants/${user?.tenantId}/room-service/orders/${orderId}`,
        { status }
      );
      toast.success(`Order ${status.replace('_', ' ')}`);
      setSelectedOrder(res.data.data);
      loadOrders();
    } catch {
      // Error handled by API interceptor
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const toggleItemActive = async (item: MenuItem) => {
    try {
      await api.patch(`/tenants/${user?.tenantId}/menu/items/${item.id}`, {
        isActive: !item.isActive,
      });
      toast.success(item.isActive ? 'Item deactivated' : 'Item activated');
      loadMenuData();
    } catch {
      // Error handled by API interceptor
    }
  };

  const filteredOrders = orders.filter(
    (o) =>
      o.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.roomNumber.includes(searchTerm) ||
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredItems = menuItems.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const totalOrdersToday = stats?.todayOrderCount ?? 0;
  const pendingCount = stats?.byStatus
    ? (stats.byStatus.pending ?? 0) + (stats.byStatus.confirmed ?? 0) + (stats.byStatus.preparing ?? 0)
    : 0;

  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'menu', label: 'Menu', icon: ChefHat },
    { id: 'analytics', label: 'Summary', icon: Clock },
  ];

  return (
    <Layout>
      <PageHeader
        title="Room Service"
        subtitle="Manage menu items, orders, and room service operations"
        actions={
          activeTab === 'orders' ? (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowOrderModal(true)}>
              New order
            </Button>
          ) : activeTab === 'menu' ? (
            <div className="row">
              <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setShowCategoryModal(true)}>
                Add category
              </Button>
              <Button
                variant="primary"
                icon={<Plus size={16} />}
                onClick={() => setEditingItem('new')}
                disabled={categories.length === 0}
              >
                Add item
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className={styles.tabs} role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <tab.icon size={16} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorState message={error} onRetry={activeTab === 'menu' ? loadMenuData : loadOrders} />}

      {activeTab === 'orders' && !error && (
        <>
          {stats && (
            <div className="grid4">
              <StatCard
                label="Orders today"
                value={String(totalOrdersToday)}
                icon={<ShoppingCart size={18} />}
              />
              <StatCard
                label="In progress"
                value={String(pendingCount)}
                icon={<Clock size={18} />}
                tone={pendingCount > 0 ? 'warning' : 'neutral'}
              />
              <StatCard
                label="Revenue today"
                value={money(stats.todayRevenue)}
              />
              <StatCard label="Revenue total" value={money(stats.totalRevenue)} />
            </div>
          )}

          <FilterBar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search orders, guest, room…"
            activeCount={statusFilter !== 'all' ? 1 : 0}
            onClear={() => setStatusFilter('all')}
          >
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ')}
                </option>
              ))}
              <option value="cancelled">Cancelled</option>
            </Select>
          </FilterBar>

          {loading ? (
            <SkeletonTable rows={5} cols={4} />
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={<ShoppingCart size={28} strokeWidth={1.6} />}
              title="No orders found"
              description={
                searchTerm || statusFilter !== 'all'
                  ? 'No orders match your current filters'
                  : 'No room service orders have been placed yet'
              }
              action={
                !searchTerm && statusFilter === 'all' ? (
                  <Button variant="primary" onClick={() => setShowOrderModal(true)}>
                    Create order
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="stack">
                {filteredOrders.map((order) => (
                  <button
                    key={order.id}
                    className={styles.orderCard}
                    onClick={() => openOrderDetail(order)}
                  >
                    <div className={styles.orderHead}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                          Order {order.orderNumber}
                        </div>
                        <div className={styles.orderMeta}>
                          <span>{order.guestName}</span>
                          <span>Room {order.roomNumber}</span>
                          <span>{format(new Date(order.requestedAt), 'MMM dd, HH:mm')}</span>
                        </div>
                      </div>
                      <div className={styles.orderRight}>
                        <StatusBadge status={order.status} />
                        <span className={styles.orderTotal}>{money(order.totalAmount)}</span>
                      </div>
                    </div>

                    {order.specialInstructions && (
                      <div className={styles.instructions}>
                        <AlertTriangle size={14} aria-hidden="true" />{' '}
                        <strong>Special instructions:</strong> {order.specialInstructions}
                      </div>
                    )}

                    <div className={styles.orderFoot}>
                      <span>
                        {order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? 's' : ''}
                        {order.estimatedDelivery &&
                          ` · Est. delivery ${format(new Date(order.estimatedDelivery), 'MMM dd, HH:mm')}`}
                      </span>
                      <span className="text-xs">View details →</span>
                    </div>
                  </button>
                ))}
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={totalOrders}
                limit={20}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      {activeTab === 'menu' && !error && (
        <>
          <FilterBar
            search={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search menu items…"
            activeCount={categoryFilter !== 'all' ? 1 : 0}
            onClear={() => setCategoryFilter('all')}
          >
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FilterBar>

          {loading ? (
            <div className={styles.menuGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height="260px" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={<ChefHat size={28} strokeWidth={1.6} />}
              title="No menu items found"
              description={
                searchTerm || categoryFilter !== 'all'
                  ? 'No items match your current filters'
                  : categories.length === 0
                    ? 'Create a category first, then add menu items'
                    : 'Add your first menu item'
              }
              action={
                !searchTerm && categoryFilter === 'all' ? (
                  <Button
                    variant="primary"
                    onClick={() => (categories.length === 0 ? setShowCategoryModal(true) : setEditingItem('new'))}
                  >
                    {categories.length === 0 ? 'Add category' : 'Add item'}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={styles.menuGrid}>
              {filteredItems.map((item) => {
                const category = categories.find((c) => c.id === item.categoryId);
                return (
                  <div key={item.id} className={styles.menuCard}>
                    {item.imageUrl && (
                      <div
                        className={styles.menuImage}
                        style={{ backgroundImage: `url(${item.imageUrl})` }}
                      />
                    )}
                    <div className={styles.menuBody}>
                      <div className={styles.menuHead}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{item.name}</div>
                          <div className="text-xs muted">{category?.name}</div>
                        </div>
                        <div className={styles.menuPrice}>{money(item.price)}</div>
                      </div>

                      {item.description && (
                        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {item.description}
                        </div>
                      )}

                      <div className={styles.dietChips}>
                        {item.isVegetarian && <StatusBadge tone="success" dot={false}>Vegetarian</StatusBadge>}
                        {item.isVegan && <StatusBadge tone="success" dot={false}>Vegan</StatusBadge>}
                        {item.isGlutenFree && <StatusBadge tone="info" dot={false}>Gluten free</StatusBadge>}
                        {item.spiceLevel && item.spiceLevel !== 'mild' && (
                          <StatusBadge tone={SPICE_TONE[item.spiceLevel]} dot={false}>
                            {item.spiceLevel.replace('_', ' ')}
                          </StatusBadge>
                        )}
                        {item.containsNuts && <StatusBadge tone="warning" dot={false}>Nuts</StatusBadge>}
                      </div>

                      <div className={styles.menuFoot}>
                        <div className="row">
                          {item.preparationTime != null && (
                            <span className="text-xs muted row" style={{ gap: 4 }}>
                              <Clock size={13} /> {item.preparationTime}m
                            </span>
                          )}
                          <StatusBadge tone={item.isActive ? 'success' : 'danger'} dot={false}>
                            {item.isActive ? 'Active' : 'Inactive'}
                          </StatusBadge>
                        </div>
                        <div className="row">
                          <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)}>
                            <Pencil size={14} /> Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleItemActive(item)}
                            title={item.isActive ? 'Deactivate' : 'Activate'}
                          >
                            <Power size={14} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'analytics' && !error && (
        <Panel title="Order summary" subtitle="All-time room service metrics">
          {stats ? (
            <div className="grid4" style={{ marginBottom: 'var(--space-4)' }}>
              <StatCard label="Orders today" value={String(stats.todayOrderCount)} />
              <StatCard label="Revenue today" value={money(stats.todayRevenue)} />
              <StatCard label="Revenue total" value={money(stats.totalRevenue)} />
              <StatCard
                label="Delivered (all time)"
                value={String(stats.byStatus?.delivered ?? 0)}
              />
            </div>
          ) : (
            <Skeleton height="120px" />
          )}
          {stats?.byStatus && (
            <div className="stack">
              <div className="text-sm" style={{ fontWeight: 600 }}>Orders by status</div>
              <div className="row wrap">
                {ORDER_STATUSES.map((s) => (
                  <StatusBadge key={s} status={s}>
                    {`${s.replace('_', ' ')} · ${stats.byStatus[s] ?? 0}`}
                  </StatusBadge>
                ))}
                <StatusBadge status="cancelled">
                  {`cancelled · ${stats.byStatus.cancelled ?? 0}`}
                </StatusBadge>
              </div>
            </div>
          )}
        </Panel>
      )}

      <OrderDetailDrawer
        order={selectedOrder}
        loading={orderDetailLoading}
        updating={updatingOrderId === selectedOrder?.id}
        money={money}
        currency={settings.currencySymbol}
        onClose={() => setSelectedOrder(null)}
        onAdvance={(o) => {
          const step = NEXT_STATUS[o.status];
          if (step) updateOrderStatus(o.id, step.next);
        }}
        onCancelRequest={(o) => setCancelTarget(o)}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={() => {
          if (cancelTarget) updateOrderStatus(cancelTarget.id, 'cancelled');
          setCancelTarget(null);
        }}
        title="Cancel order"
        confirmLabel="Cancel order"
        destructive
      >
        {`Cancel order ${cancelTarget?.orderNumber} for room ${cancelTarget?.roomNumber}? This cannot be undone.`}
      </ConfirmDialog>

      <CreateOrderModal
        open={showOrderModal}
        menuItems={menuItems}
        categories={categories}
        currency={settings.currencySymbol}
        onClose={() => setShowOrderModal(false)}
        onSuccess={() => {
          setShowOrderModal(false);
          loadOrders();
        }}
      />

      <CategoryModal
        open={showCategoryModal}
        onClose={() => setShowCategoryModal(false)}
        onSuccess={() => {
          setShowCategoryModal(false);
          loadMenuData();
        }}
      />

      <MenuItemModal
        item={editingItem}
        categories={categories}
        onClose={() => setEditingItem(null)}
        onSuccess={() => {
          setEditingItem(null);
          loadMenuData();
        }}
      />
    </Layout>
  );
}

/* ---------- Order detail drawer ---------- */

function OrderDetailDrawer({
  order,
  loading,
  updating,
  money,
  currency,
  onClose,
  onAdvance,
  onCancelRequest,
}: {
  order: RoomServiceOrder | null;
  loading: boolean;
  updating: boolean;
  money: (n?: number | null) => string;
  currency: string;
  onClose: () => void;
  onAdvance: (o: RoomServiceOrder) => void;
  onCancelRequest: (o: RoomServiceOrder) => void;
}) {
  const step = order ? NEXT_STATUS[order.status] : null;

  return (
    <DetailDrawer
      open={!!order}
      onClose={onClose}
      title={order ? `Order ${order.orderNumber}` : 'Order'}
      headerExtra={order ? <StatusBadge status={order.status} /> : undefined}
      footer={
        order && order.status !== 'delivered' && order.status !== 'cancelled' ? (
          <div className={styles.statusActions}>
            {step && (
              <Button variant="primary" loading={updating} onClick={() => onAdvance(order)}>
                {step.label}
              </Button>
            )}
            <Button variant="danger" onClick={() => onCancelRequest(order)}>
              Cancel order
            </Button>
          </div>
        ) : undefined
      }
    >
      {order && (
        <div className="stack-lg">
          <div className="grid2">
            <KV k="Guest" v={order.guestName} />
            <KV k="Room" v={order.roomNumber} />
            {order.guestPhone && <KV k="Phone" v={order.guestPhone} />}
            <KV k="Requested" v={format(new Date(order.requestedAt), 'MMM dd, yyyy HH:mm')} />
            {order.estimatedDelivery && (
              <KV k="Est. delivery" v={format(new Date(order.estimatedDelivery), 'MMM dd, HH:mm')} />
            )}
            {order.deliveredAt && (
              <KV k="Delivered" v={format(new Date(order.deliveredAt), 'MMM dd, HH:mm')} />
            )}
            {order.assignedStaff && (
              <KV k="Assigned" v={`${order.assignedStaff.firstName} ${order.assignedStaff.lastName}`} />
            )}
            {order.deliveryStaff && (
              <KV k="Delivered by" v={`${order.deliveryStaff.firstName} ${order.deliveryStaff.lastName}`} />
            )}
          </div>

          {order.specialInstructions && (
            <div className={styles.instructions}>
              <AlertTriangle size={14} aria-hidden="true" />{' '}
              <strong>Special instructions:</strong> {order.specialInstructions}
            </div>
          )}
          {order.deliveryNotes && (
            <div className="text-sm muted">Delivery notes: {order.deliveryNotes}</div>
          )}

          <div>
            <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Items {loading && <span className="muted text-xs">(refreshing…)</span>}
            </div>
            <div className={styles.itemLines}>
              {(order.items ?? []).map((item) => (
                <div key={item.id} className={styles.itemLine}>
                  <div>
                    <div className={styles.itemName}>
                      {item.menuItem?.name ?? 'Menu item'}
                    </div>
                    {item.specialRequests && (
                      <div className={styles.itemQty}>“{item.specialRequests}”</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div>
                      {item.quantity} × {money(item.unitPrice)}
                    </div>
                    <div style={{ fontWeight: 600 }}>{money(item.totalPrice)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <ChargeSummary
            lines={[
              { label: 'Subtotal', amount: order.subtotal },
              ...(order.taxAmount ? [{ label: 'Tax', amount: order.taxAmount }] : []),
              { label: 'Service charge', amount: order.serviceCharge },
            ]}
            total={order.totalAmount}
            currency={currency}
          />
        </div>
      )}
    </DetailDrawer>
  );
}

/* ---------- Create order modal ---------- */

function CreateOrderModal({
  open,
  menuItems,
  categories,
  currency,
  onClose,
  onSuccess,
}: {
  open: boolean;
  menuItems: MenuItem[];
  categories: MenuCategory[];
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const money = (n?: number | null) => formatMoney(n, currency);
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setGuestName('');
      setRoomNumber('');
      setGuestPhone('');
      setSpecialInstructions('');
      setCart({});
    }
  }, [open]);

  const activeItems = menuItems.filter((i) => i.isActive);
  const cartLines = Object.entries(cart)
    .map(([id, qty]) => ({ item: activeItems.find((i) => i.id === id), qty }))
    .filter((l): l is { item: MenuItem; qty: number } => !!l.item);
  const subtotal = cartLines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const serviceCharge = Math.round(subtotal * 0.1 * 100) / 100;
  const total = subtotal + serviceCharge;

  const bump = (id: string, delta: number) => {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[id] ?? 0) + delta;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!guestName.trim() || !roomNumber.trim() || cartLines.length === 0) {
      toast.error('Guest name, room, and at least one item are required');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/room-service/orders`, {
        guestName: guestName.trim(),
        roomNumber: roomNumber.trim(),
        guestPhone: guestPhone.trim() || undefined,
        specialInstructions: specialInstructions.trim() || undefined,
        items: cartLines.map((l) => ({ menuItemId: l.item.id, quantity: l.qty })),
      });
      toast.success('Order created');
      onSuccess();
    } catch {
      // Error handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New room service order"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!guestName.trim() || !roomNumber.trim() || cartLines.length === 0}
            onClick={handleSubmit}
          >
            Place order · {money(total)}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="grid3">
          <Field label="Guest name" required>
            <TextInput value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          </Field>
          <Field label="Room" required>
            <TextInput
              value={roomNumber}
              onChange={(e) => setRoomNumber(e.target.value)}
              placeholder="e.g. 204"
            />
          </Field>
          <Field label="Phone" hint="Optional">
            <TextInput value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
          </Field>
        </div>

        <Field label="Special instructions" hint="Optional">
          <Textarea
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            rows={2}
          />
        </Field>

        <div className="grid2" style={{ alignItems: 'start' }}>
          <div>
            <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Menu
            </div>
            <div className={styles.pickList}>
              {categories.map((cat) => (
                <div key={cat.id}>
                  <div
                    className="text-xs"
                    style={{
                      padding: 'var(--space-2) var(--space-3)',
                      color: 'var(--muted)',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {cat.name}
                  </div>
                  {activeItems
                    .filter((i) => i.categoryId === cat.id)
                    .map((item) => (
                      <button
                        key={item.id}
                        className={styles.pickRow}
                        onClick={() => bump(item.id, 1)}
                      >
                        <span>{item.name}</span>
                        <span className="row">
                          <span className="muted text-xs">{money(item.price)}</span>
                          <Plus size={14} />
                        </span>
                      </button>
                    ))}
                </div>
              ))}
              {activeItems.length === 0 && (
                <div className="text-sm muted" style={{ padding: 'var(--space-4)' }}>
                  No active menu items — add them in the Menu tab first.
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Order ({cartLines.length})
            </div>
            <div className={styles.cart}>
              {cartLines.length === 0 ? (
                <div className="text-sm muted" style={{ padding: 'var(--space-4)' }}>
                  Click items on the left to add them.
                </div>
              ) : (
                cartLines.map(({ item, qty }) => (
                  <div key={item.id} className={styles.cartRow}>
                    <span className={styles.cartName}>{item.name}</span>
                    <button className={styles.qtyBtn} onClick={() => bump(item.id, -1)} aria-label="Decrease">
                      <Minus size={13} />
                    </button>
                    <span style={{ minWidth: 20, textAlign: 'center' }}>{qty}</span>
                    <button className={styles.qtyBtn} onClick={() => bump(item.id, 1)} aria-label="Increase">
                      <Plus size={13} />
                    </button>
                    <span className="muted text-xs" style={{ minWidth: 64, textAlign: 'right' }}>
                      {money(item.price * qty)}
                    </span>
                  </div>
                ))
              )}
            </div>
            {cartLines.length > 0 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <ChargeSummary
                  lines={[
                    { label: 'Subtotal', amount: subtotal },
                    { label: 'Service charge (10%)', amount: serviceCharge },
                  ]}
                  total={total}
                  currency={currency}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Category modal ---------- */

function CategoryModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/menu/categories`, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      toast.success('Category created');
      onSuccess();
    } catch {
      // Error handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New menu category"
      width="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} disabled={!name.trim()} onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Breakfast" />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------- Menu item modal ---------- */

function MenuItemModal({
  item,
  categories,
  onClose,
  onSuccess,
}: {
  item: MenuItem | 'new' | null;
  categories: MenuCategory[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const isEdit = item !== null && item !== 'new';
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    categoryId: '',
    name: '',
    description: '',
    price: '',
    preparationTime: '',
    spiceLevel: 'mild',
    isVegetarian: false,
    isVegan: false,
    isGlutenFree: false,
    containsNuts: false,
  });

  useEffect(() => {
    if (item === null) return;
    setForm(
      isEdit
        ? {
            categoryId: item.categoryId,
            name: item.name,
            description: item.description ?? '',
            price: String(item.price),
            preparationTime: item.preparationTime != null ? String(item.preparationTime) : '',
            spiceLevel: item.spiceLevel || 'mild',
            isVegetarian: item.isVegetarian,
            isVegan: item.isVegan,
            isGlutenFree: item.isGlutenFree,
            containsNuts: item.containsNuts,
          }
        : {
            categoryId: categories[0]?.id ?? '',
            name: '',
            description: '',
            price: '',
            preparationTime: '',
            spiceLevel: 'mild',
            isVegetarian: false,
            isVegan: false,
            isGlutenFree: false,
            containsNuts: false,
          }
    );
  }, [item, isEdit, categories]);

  const submit = async () => {
    const price = Number(form.price);
    if (!form.categoryId || !form.name.trim() || !Number.isFinite(price) || price < 0) {
      toast.error('Category, name, and a valid price are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        categoryId: form.categoryId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        price,
        preparationTime: form.preparationTime ? Number(form.preparationTime) : undefined,
        spiceLevel: form.spiceLevel,
        isVegetarian: form.isVegetarian,
        isVegan: form.isVegan,
        isGlutenFree: form.isGlutenFree,
        containsNuts: form.containsNuts,
      };
      if (isEdit) {
        await api.patch(`/tenants/${user?.tenantId}/menu/items/${item.id}`, payload);
        toast.success('Item updated');
      } else {
        await api.post(`/tenants/${user?.tenantId}/menu/items`, payload);
        toast.success('Item created');
      }
      onSuccess();
    } catch {
      // Error handled by API interceptor
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal
      open={item !== null}
      onClose={onClose}
      title={isEdit ? `Edit ${item.name}` : 'New menu item'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {isEdit ? 'Save changes' : 'Create item'}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="grid2">
          <Field label="Category" required>
            <Select value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Price" required>
            <TextInput
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => set('price', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Description" hint="Optional">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} />
        </Field>
        <div className="grid2">
          <Field label="Preparation time (min)" hint="Optional">
            <TextInput
              type="number"
              min="0"
              value={form.preparationTime}
              onChange={(e) => set('preparationTime', e.target.value)}
            />
          </Field>
          <Field label="Spice level">
            <Select value={form.spiceLevel} onChange={(e) => set('spiceLevel', e.target.value)}>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="hot">Hot</option>
              <option value="very_hot">Very hot</option>
            </Select>
          </Field>
        </div>
        <div className="row wrap">
          {(
            [
              ['isVegetarian', 'Vegetarian'],
              ['isVegan', 'Vegan'],
              ['isGlutenFree', 'Gluten free'],
              ['containsNuts', 'Contains nuts'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="row text-sm" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(e) => set(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <span className="text-xs muted" style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>
        {k}
      </span>
      <span className="text-sm" style={{ fontWeight: 500, color: 'var(--text)' }}>
        {v}
      </span>
    </div>
  );
}
