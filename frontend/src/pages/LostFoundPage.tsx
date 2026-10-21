import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Package, User, MapPin, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import {
  Button,
  DetailDrawer,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';
import type { BadgeTone } from '../components/ui/StatusBadge';
import styles from './LostFoundPage.module.css';

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
  disposalMethod?: string;
  createdAt: string;
}

interface ItemStats {
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  total: number;
  unclaimedValue: number;
}

const STATUS_TONE: Record<string, BadgeTone> = {
  unclaimed: 'warning',
  claimed: 'success',
  returned: 'info',
  disposed: 'neutral',
  reported: 'danger',
};

const STATUS_COLOR: Record<string, string> = {
  unclaimed: 'var(--warning)',
  claimed: 'var(--success)',
  returned: 'var(--info)',
  disposed: 'var(--muted)',
  reported: 'var(--danger)',
};

const CATEGORIES = ['electronics', 'clothing', 'jewelry', 'documents', 'other'];
const STATUSES = ['unclaimed', 'claimed', 'returned', 'reported', 'disposed'];

const getTimeAgo = (dateString: string) => {
  const diffInHours = Math.floor((Date.now() - new Date(dateString).getTime()) / 3600000);
  if (diffInHours < 1) return 'Just now';
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return `${Math.floor(diffInDays / 7)}w ago`;
};

export default function LostFoundPage() {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const money = (n?: number | null) => formatMoney(n, settings.currencySymbol);

  const [items, setItems] = useState<LostItem[]>([]);
  const [stats, setStats] = useState<ItemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LostItem | null>(null);

  const loadItems = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '24' });
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      const response = await api.get(`/tenants/${user.tenantId}/lost-found?${params}`);
      setItems(response.data.data || []);
      setTotalPages(response.data.pagination?.totalPages ?? 1);
      setTotal(response.data.pagination?.total ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to load lost items');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, statusFilter, categoryFilter, searchTerm, page]);

  const loadStats = useCallback(async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user.tenantId}/lost-found/stats/summary`);
      setStats(response.data.data);
    } catch {
      // non-critical
    }
  }, [user?.tenantId]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, searchTerm]);

  const updateItem = async (id: string, payload: Record<string, unknown>) => {
    try {
      const res = await api.patch(`/tenants/${user?.tenantId}/lost-found/${id}`, payload);
      toast.success('Item updated');
      setSelectedItem(res.data.data);
      loadItems();
      loadStats();
    } catch {
      // Error handled by API interceptor
    }
  };

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) + (categoryFilter !== 'all' ? 1 : 0) + (searchTerm ? 1 : 0);

  return (
    <Layout>
      <PageHeader
        title="Lost & found"
        subtitle="Manage found items, lost item reports, and item recovery"
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowItemModal(true)}>
            Register item
          </Button>
        }
      />

      {stats && (
        <div className="grid4">
          <StatCard label="Total items" value={String(stats.total)} icon={<Package size={18} />} />
          <StatCard
            label="Unclaimed"
            value={String(stats.byStatus?.unclaimed ?? 0)}
            tone={(stats.byStatus?.unclaimed ?? 0) > 0 ? 'warning' : 'neutral'}
          />
          <StatCard label="Returned" value={String(stats.byStatus?.returned ?? 0)} tone="good" />
          <StatCard label="Unclaimed value" value={money(stats.unclaimedValue)} />
        </div>
      )}

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search name, number, location…"
        activeCount={activeFilterCount}
        onClear={() => {
          setStatusFilter('all');
          setCategoryFilter('all');
          setSearchTerm('');
        }}
      >
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </FilterBar>

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="220px" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={loadItems} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Package size={28} strokeWidth={1.6} />}
          title="No items found"
          description={
            activeFilterCount > 0
              ? 'No items match your current filters'
              : 'No lost or found items have been registered yet'
          }
          action={
            activeFilterCount === 0 ? (
              <Button variant="primary" onClick={() => setShowItemModal(true)}>
                Register item
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className={styles.grid}>
            {items.map((item) => (
              <button
                key={item.id}
                className={styles.card}
                style={{ '--status-color': STATUS_COLOR[item.status] ?? 'var(--line)' } as React.CSSProperties}
                onClick={() => setSelectedItem(item)}
              >
                <div className={styles.cardBody}>
                  <div className={styles.cardHead}>
                    <div>
                      <h3 className={styles.cardTitle}>
                        <Package size={16} aria-hidden="true" />
                        {item.itemName}
                      </h3>
                      <div className={styles.cardMeta}>
                        <span>{item.itemNumber}</span>
                        <span>·</span>
                        <span>{item.category}</span>
                      </div>
                    </div>
                    <StatusBadge status={item.status} tone={STATUS_TONE[item.status]} />
                  </div>

                  <p className={styles.cardDesc}>{item.description}</p>

                  <div className={styles.cardKv}>
                    <span className={styles.kvLine}>
                      <MapPin size={13} /> Found: {item.foundLocation}
                    </span>
                    <span className={styles.kvLine}>{getTimeAgo(item.foundAt)}</span>
                    {item.value != null && (
                      <span className={styles.kvLine}>Value: {money(item.value)}</span>
                    )}
                    {item.reportedByName && (
                      <span className={styles.kvLine}>
                        <User size={13} /> Reported by {item.reportedByName}
                      </span>
                    )}
                    {item.storageLocation && (
                      <div className={styles.storage}>
                        {item.storageLocation}
                        {item.storageNotes && <div style={{ fontStyle: 'italic' }}>{item.storageNotes}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={24}
            onPageChange={setPage}
          />
        </>
      )}

      <ItemModal
        open={showItemModal}
        currency={settings.currencySymbol}
        onClose={() => setShowItemModal(false)}
        onSuccess={() => {
          setShowItemModal(false);
          loadItems();
          loadStats();
        }}
      />

      <ItemDetailDrawer
        item={selectedItem}
        money={money}
        onClose={() => setSelectedItem(null)}
        onUpdate={updateItem}
      />
    </Layout>
  );
}

/* ---------- Create / report modal ---------- */

function ItemModal({
  open,
  currency,
  onClose,
  onSuccess,
}: {
  open: boolean;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    itemName: '',
    description: '',
    category: 'other',
    color: '',
    brand: '',
    serialNumber: '',
    value: '',
    foundLocation: '',
    circumstances: '',
    reportedByName: '',
    reportedByPhone: '',
    reportedByEmail: '',
    reportedByRoom: '',
    storageLocation: '',
    storageNotes: '',
  });

  useEffect(() => {
    if (open)
      setForm({
        itemName: '',
        description: '',
        category: 'other',
        color: '',
        brand: '',
        serialNumber: '',
        value: '',
        foundLocation: '',
        circumstances: '',
        reportedByName: '',
        reportedByPhone: '',
        reportedByEmail: '',
        reportedByRoom: '',
        storageLocation: '',
        storageNotes: '',
      });
  }, [open]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.itemName.trim() || !form.description.trim() || !form.foundLocation.trim()) {
      toast.error('Item name, description, and location are required');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/lost-found`, {
        itemName: form.itemName.trim(),
        description: form.description.trim(),
        category: form.category,
        color: form.color.trim() || undefined,
        brand: form.brand.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        value: form.value ? parseFloat(form.value) : undefined,
        foundLocation: form.foundLocation.trim(),
        circumstances: form.circumstances.trim() || undefined,
        reportedByName: form.reportedByName.trim() || undefined,
        reportedByPhone: form.reportedByPhone.trim() || undefined,
        reportedByEmail: form.reportedByEmail.trim() || undefined,
        reportedByRoom: form.reportedByRoom.trim() || undefined,
        storageLocation: form.storageLocation.trim() || undefined,
        storageNotes: form.storageNotes.trim() || undefined,
      });
      toast.success('Item registered');
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
      title="Register item"
      width="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            Register
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="grid2">
          <Field label="Item name" required>
            <TextInput value={form.itemName} onChange={(e) => set('itemName', e.target.value)} />
          </Field>
          <Field label="Category" required>
            <Select value={form.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Description" required>
          <Textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
          />
        </Field>
        <div className="grid3">
          <Field label="Color" hint="Optional">
            <TextInput value={form.color} onChange={(e) => set('color', e.target.value)} />
          </Field>
          <Field label="Brand" hint="Optional">
            <TextInput value={form.brand} onChange={(e) => set('brand', e.target.value)} />
          </Field>
          <Field label="Serial number" hint="Optional">
            <TextInput value={form.serialNumber} onChange={(e) => set('serialNumber', e.target.value)} />
          </Field>
        </div>
        <div className="grid3">
          <Field label="Found location" required>
            <TextInput
              value={form.foundLocation}
              onChange={(e) => set('foundLocation', e.target.value)}
              placeholder="e.g. Room 204, lobby"
            />
          </Field>
          <Field label={`Est. value (${currency})`} hint="Optional">
            <TextInput
              type="number"
              min="0"
              value={form.value}
              onChange={(e) => set('value', e.target.value)}
            />
          </Field>
          <Field label="Storage location" hint="Optional">
            <TextInput
              value={form.storageLocation}
              onChange={(e) => set('storageLocation', e.target.value)}
              placeholder="e.g. Front desk safe"
            />
          </Field>
        </div>
        <Field label="Circumstances" hint="Optional">
          <Textarea
            value={form.circumstances}
            onChange={(e) => set('circumstances', e.target.value)}
            rows={2}
          />
        </Field>
        <Field label="Storage notes" hint="Optional">
          <TextInput value={form.storageNotes} onChange={(e) => set('storageNotes', e.target.value)} />
        </Field>

        <div>
          <div className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
            Reporter <span className="muted" style={{ fontWeight: 400 }}>(if a guest reported the loss)</span>
          </div>
          <div className="grid2">
            <Field label="Name">
              <TextInput value={form.reportedByName} onChange={(e) => set('reportedByName', e.target.value)} />
            </Field>
            <Field label="Room">
              <TextInput value={form.reportedByRoom} onChange={(e) => set('reportedByRoom', e.target.value)} />
            </Field>
            <Field label="Phone">
              <TextInput value={form.reportedByPhone} onChange={(e) => set('reportedByPhone', e.target.value)} />
            </Field>
            <Field label="Email">
              <TextInput
                type="email"
                value={form.reportedByEmail}
                onChange={(e) => set('reportedByEmail', e.target.value)}
              />
            </Field>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- Detail drawer with claim/return/dispose ---------- */

function ItemDetailDrawer({
  item,
  money,
  onClose,
  onUpdate,
}: {
  item: LostItem | null;
  money: (n?: number | null) => string;
  onClose: () => void;
  onUpdate: (id: string, payload: Record<string, unknown>) => void;
}) {
  const [action, setAction] = useState<'claim' | 'return' | 'dispose' | null>(null);
  const [detail, setDetail] = useState('');
  const [method, setMethod] = useState('');

  useEffect(() => {
    setAction(null);
    setDetail('');
    setMethod('');
  }, [item?.id]);

  if (!item) {
    return <DetailDrawer open={false} onClose={onClose} title="Item"><span /></DetailDrawer>;
  }

  const actionable = item.status === 'unclaimed' || item.status === 'reported';

  const runAction = () => {
    if (action === 'claim') {
      onUpdate(item.id, { status: 'claimed', claimedBy: detail || undefined, claimMethod: method || undefined });
    } else if (action === 'return') {
      onUpdate(item.id, { status: 'returned', returnedTo: detail || undefined, returnMethod: method || undefined });
    } else if (action === 'dispose') {
      onUpdate(item.id, { status: 'disposed', disposalMethod: method || detail || undefined });
    }
    setAction(null);
    setDetail('');
    setMethod('');
  };

  return (
    <DetailDrawer
      open={!!item}
      onClose={onClose}
      title={`${item.itemName}`}
      headerExtra={
        <div className="row">
          <StatusBadge status={item.status} tone={STATUS_TONE[item.status]} />
          <span className="text-sm muted">{item.itemNumber}</span>
        </div>
      }
      footer={
        actionable && !action ? (
          <div className="row wrap">
            <Button variant="primary" size="sm" icon={<CheckCircle size={14} />} onClick={() => setAction('claim')}>
              Mark claimed
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAction('return')}>
              Mark returned
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAction('dispose')}>
              Dispose
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="stack-lg">
        {action && (
          <div className="stack" style={{ padding: 'var(--space-3)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
            <div className="text-sm" style={{ fontWeight: 600 }}>
              {action === 'claim' ? 'Claim item' : action === 'return' ? 'Return item' : 'Dispose item'}
            </div>
            {action !== 'dispose' && (
              <Field label={action === 'claim' ? 'Claimed by' : 'Returned to'}>
                <TextInput
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                  placeholder={action === 'claim' ? 'Guest or staff name' : 'Recipient name'}
                />
              </Field>
            )}
            <Field
              label={action === 'dispose' ? 'Disposal method' : 'Method'}
              hint={action === 'dispose' ? 'e.g. donated, discarded' : 'e.g. in person, courier'}
            >
              <TextInput value={method} onChange={(e) => setMethod(e.target.value)} />
            </Field>
            <div className="row">
              <Button variant="primary" size="sm" onClick={runAction}>
                Confirm
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setAction(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div>
          <div className="text-xs muted" style={{ marginBottom: 'var(--space-1)' }}>Description</div>
          <div style={{ color: 'var(--text)', lineHeight: 1.6 }}>{item.description}</div>
        </div>

        <div className={styles.kvGrid}>
          <KV k="Category" v={item.category} />
          <KV k="Found at" v={item.foundLocation} />
          <KV k="Found on" v={format(new Date(item.foundAt), 'MMM dd, yyyy HH:mm')} />
          {item.color && <KV k="Color" v={item.color} />}
          {item.brand && <KV k="Brand" v={item.brand} />}
          {item.serialNumber && <KV k="Serial" v={item.serialNumber} />}
          {item.value != null && <KV k="Est. value" v={money(item.value)} />}
          {item.circumstances && <KV k="Circumstances" v={item.circumstances} />}
          {item.storageLocation && <KV k="Stored at" v={item.storageLocation} />}
          {item.storageNotes && <KV k="Storage notes" v={item.storageNotes} />}
        </div>

        {(item.reportedByName || item.reportedByPhone || item.reportedByEmail) && (
          <section>
            <h3 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Reporter
            </h3>
            <div className={styles.kvGrid}>
              {item.reportedByName && <KV k="Name" v={item.reportedByName} />}
              {item.reportedByRoom && <KV k="Room" v={item.reportedByRoom} />}
              {item.reportedByPhone && <KV k="Phone" v={item.reportedByPhone} />}
              {item.reportedByEmail && <KV k="Email" v={item.reportedByEmail} />}
            </div>
          </section>
        )}

        {(item.claimedBy || item.returnedTo || item.disposedAt) && (
          <section>
            <h3 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
              Resolution
            </h3>
            <div className={styles.kvGrid}>
              {item.claimedBy && <KV k="Claimed by" v={item.claimedBy} />}
              {item.claimedAt && <KV k="Claimed at" v={format(new Date(item.claimedAt), 'MMM dd, yyyy')} />}
              {item.claimMethod && <KV k="Claim method" v={item.claimMethod} />}
              {item.returnedTo && <KV k="Returned to" v={item.returnedTo} />}
              {item.returnMethod && <KV k="Return method" v={item.returnMethod} />}
              {item.disposedAt && <KV k="Disposed at" v={format(new Date(item.disposedAt), 'MMM dd, yyyy')} />}
              {item.disposalMethod && <KV k="Disposal method" v={item.disposalMethod} />}
            </div>
          </section>
        )}
      </div>
    </DetailDrawer>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className={styles.kv}>
      <span className={styles.kvKey}>{k}</span>
      <span className={styles.kvVal}>{v}</span>
    </div>
  );
}
