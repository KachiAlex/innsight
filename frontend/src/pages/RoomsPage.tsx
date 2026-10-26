import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, DoorOpen, Tag, X, Edit, Trash2, Package, Layers, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';
import {
  Button,
  EmptyState,
  FilterBar,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusBadge,
  TextInput,
} from '../components/ui';
import { formatMoney } from '../lib/money';
import { useTenantSettings } from '../hooks/useTenantSettings';
import styles from './RoomsPage.module.css';

interface RoomCategory {
  id: string;
  name: string;
  description?: string;
  totalRooms?: number;
  actualRoomCount: number;
  color?: string;
  minPrice?: number | null;
  maxPrice?: number | null;
}

type RatePlanLite = {
  id: string;
  name: string;
  baseRate: number | null;
  categoryId?: string | null;
  isActive?: boolean;
};

interface InventoryItem {
  id?: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  status?: string | null;
  notes?: string | null;
  imageUrl?: string | null;
  isTemplateDerived?: boolean;
  categoryItemId?: string | null;
}

interface RoomInventoryDetail {
  roomId: string;
  categoryId: string | null;
  inventoryItems: InventoryItem[];
  inventoryInheritsTemplate: boolean;
  inventoryTemplateAppliedVersion: number | null;
  inventoryUpdatedAt: string | Date | null;
  primaryImageUrl: string | null;
  inventoryHasCustomItems: boolean;
  categoryTemplate?: InventoryItem[] | null;
}

interface BulkInventoryState {
  inheritTemplate?: boolean;
  overwriteCustom?: boolean;
  primaryImageUrl?: string;
  customItems: InventoryItem[];
}

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  icalToken?: string;
  status: string;
  maxOccupancy: number;
  description?: string;
  categoryId?: string | null;
  category?: {
    id: string;
    name: string;
  };
  ratePlan?: {
    id: string;
    name: string;
    baseRate: number | null;
  } | null;
  ratePlanId?: string | null;
  customRate?: number | null;
  effectiveRate?: number | null;
  lastLogType?: string | null;
  lastLogSummary?: string | null;
  lastLogUserName?: string | null;
  lastLogAt?: string | Date | null;
  inventoryItems?: InventoryItem[];
  inventoryInheritsTemplate?: boolean;
  inventoryTemplateAppliedVersion?: number | null;
  inventoryUpdatedAt?: string | Date | null;
  inventoryHasCustomItems?: boolean;
  primaryImageUrl?: string | null;
}

const inventoryStatusOptions = ['available', 'in_use', 'maintenance', 'retired'];

const mapInventoryItemToPayload = (item: InventoryItem) => ({
  id: item.id,
  name: item.name,
  quantity: item.quantity ?? undefined,
  unit: item.unit ?? undefined,
  status: (item.status as any) ?? undefined,
  notes: item.notes ?? undefined,
  imageUrl: item.imageUrl ?? undefined,
});

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  border: 0,
};

function InventoryItemEditor({
  items,
  onChange,
}: {
  items: InventoryItem[];
  onChange: (items: InventoryItem[]) => void;
}) {
  const handleUpdate = (index: number, field: keyof InventoryItem, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([
      ...items,
      {
        id: crypto.randomUUID(),
        name: '',
        quantity: 0,
        unit: '',
        status: 'available',
        notes: '',
        imageUrl: '',
        isTemplateDerived: false,
      },
    ]);
  };

  const handleRemove = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {items.length === 0 && <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No custom items yet.</p>}
      {items.map((item, index) => (
        <div key={item.id || index} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', background: '#f8fafc' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px 1fr auto', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleUpdate(index, 'name', e.target.value)}
              placeholder="Item name"
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="number"
              min={0}
              value={item.quantity ?? ''}
              onChange={(e) => handleUpdate(index, 'quantity', e.target.value === '' ? null : Number(e.target.value))}
              placeholder="Qty"
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <input
              type="text"
              value={item.unit ?? ''}
              onChange={(e) => handleUpdate(index, 'unit', e.target.value)}
              placeholder="Unit"
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
            <select
              value={item.status || 'available'}
              onChange={(e) => handleUpdate(index, 'status', e.target.value)}
              style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              {inventoryStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleRemove(index)}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                background: '#fee2e2',
                color: '#b91c1c',
                cursor: 'pointer',
              }}
            >
              Remove
            </button>
          </div>
          <textarea
            value={item.notes ?? ''}
            onChange={(e) => handleUpdate(index, 'notes', e.target.value)}
            placeholder="Notes"
            style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', minHeight: '60px' }}
          />
          <input
            type="text"
            value={item.imageUrl ?? ''}
            onChange={(e) => handleUpdate(index, 'imageUrl', e.target.value)}
            placeholder="Image URL"
            style={{ marginTop: '0.5rem', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%' }}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={handleAdd}
        style={{
          padding: '0.5rem 0.75rem',
          borderRadius: '6px',
          border: '1px dashed #3b82f6',
          background: '#eff6ff',
          color: '#1d4ed8',
          cursor: 'pointer',
        }}
      >
        + Add custom item
      </button>
    </div>
  );
}

function RoomInventoryModal({
  room,
  detail,
  loading,
  inheritTemplate,
  onChangeInherit,
  onClose,
  onSave,
}: {
  room: Room;
  detail: RoomInventoryDetail | null;
  loading: boolean;
  inheritTemplate: boolean;
  onChangeInherit: (value: boolean) => void;
  onClose: () => void;
  onSave: (payload: { inheritTemplate?: boolean; customItems?: InventoryItem[]; overwriteCustom?: boolean; primaryImageUrl?: string | null }) => void;
}) {
  const [customItems, setCustomItems] = useState<InventoryItem[]>([]);
  const [primaryImage, setPrimaryImage] = useState<string>('');

  useEffect(() => {
    if (detail) {
      const items = (detail.inventoryItems || []).filter((item) => item.isTemplateDerived === false);
      setCustomItems(items);
      setPrimaryImage(detail.primaryImageUrl || '');
    }
  }, [detail]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      inheritTemplate,
      customItems: customItems.map(mapInventoryItemToPayload),
      overwriteCustom: true,
      primaryImageUrl: primaryImage || null,
    });
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div
        className={styles.modalPanel}
        style={{ maxWidth: '900px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Inventory • Room {room.roomNumber}</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              Manage items inherited from category templates and room-specific overrides.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading inventory...</div>
        ) : !detail ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>Unable to load inventory.</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                background: '#f8fafc',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={inheritTemplate}
                  onChange={(e) => onChangeInherit(e.target.checked)}
                />
                Inherit category template items
              </label>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#475569' }}>
                Template version: {detail.inventoryTemplateAppliedVersion ?? 'None'}. {detail.inventoryHasCustomItems ? 'Room has custom overrides.' : 'No custom overrides yet.'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Template items</h3>
                {inheritTemplate && detail.categoryTemplate && detail.categoryTemplate.length > 0 ? (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
                    {detail.categoryTemplate.map((item) => (
                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', padding: '0.5rem', background: '#fff', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                        <strong>{item.name}</strong>
                        <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                          Qty: {item.quantity ?? 0} {item.unit || ''}
                        </span>
                        {item.notes && <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>{item.notes}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>No template items.</p>
                )}
              </div>
              <div>
                <h3 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Custom items</h3>
                <InventoryItemEditor items={customItems} onChange={setCustomItems} />
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Camera size={18} /> Primary image
              </h3>
              <input
                type="text"
                value={primaryImage}
                onChange={(e) => setPrimaryImage(e.target.value)}
                placeholder="https://example.com/room.jpg"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
              {primaryImage && (
                <div style={{ marginTop: '0.75rem' }}>
                  <img
                    src={primaryImage}
                    alt={`Room ${room.roomNumber}`}
                    style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: 'none', background: '#3b82f6', color: 'white', cursor: 'pointer' }}
              >
                Save changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function BulkInventoryModal({
  selectedCount,
  state,
  setState,
  onClose,
  onApply,
  saving,
}: {
  selectedCount: number;
  state: BulkInventoryState;
  setState: React.Dispatch<React.SetStateAction<BulkInventoryState>>;
  onClose: () => void;
  onApply: () => void;
  saving: boolean;
}) {
  const [customItems, setCustomItems] = useState<InventoryItem[]>(state.customItems);

  useEffect(() => {
    setCustomItems(state.customItems);
  }, [state.customItems]);

  useEffect(() => {
    setState((prev) => ({ ...prev, customItems }));
  }, [customItems]);

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div
        className={styles.modalPanel}
        style={{ maxWidth: '720px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Bulk inventory update</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>
              Applying changes to {selectedCount} room{selectedCount === 1 ? '' : 's'}.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={state.inheritTemplate ?? false}
              onChange={(e) => setState((prev) => ({ ...prev, inheritTemplate: e.target.checked }))}
            />
            Inherit category templates (rooms without templates will be skipped)
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              checked={state.overwriteCustom ?? false}
              onChange={(e) => setState((prev) => ({ ...prev, overwriteCustom: e.target.checked }))}
            />
            Remove existing custom overrides before applying new ones
          </label>

          <div>
            <h3 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Primary image override</h3>
            <input
              type="text"
              value={state.primaryImageUrl ?? ''}
              onChange={(e) => setState((prev) => ({ ...prev, primaryImageUrl: e.target.value }))}
              placeholder="Leave blank to keep existing images"
              style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          <div>
            <h3 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Custom items to append</h3>
            <InventoryItemEditor items={customItems} onChange={setCustomItems} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onApply}
              disabled={saving}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '6px', border: 'none', background: '#10b981', color: 'white', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Applying...' : 'Apply changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface RoomLog {
  id: string;
  type: string;
  summary: string;
  details?: string | null;
  metadata?: Record<string, any> | null;
  user?: {
    id?: string | null;
    name?: string | null;
  } | null;
  createdAt: string;
}

export default function RoomsPage() {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const currency = settings.currencySymbol;
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [iotAlerts, setIotAlerts] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [ratePlans, setRatePlans] = useState<RatePlanLite[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [rateEditRoom, setRateEditRoom] = useState<Room | null>(null);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [editingCategory, setEditingCategory] = useState<RoomCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedFloorFilter, setSelectedFloorFilter] = useState<string>('');
  const [selectedRoomTypeFilter, setSelectedRoomTypeFilter] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityRoom, setActivityRoom] = useState<Room | null>(null);
  const [roomLogs, setRoomLogs] = useState<RoomLog[]>([]);
  const [roomLogsLoading, setRoomLogsLoading] = useState(false);
  const [roomLogsPagination, setRoomLogsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50, // Increased from 20 to reduce pagination overhead
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [latestReport, setLatestReport] = useState<any>(null);
  const [inventoryRoom, setInventoryRoom] = useState<Room | null>(null);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryDetail, setInventoryDetail] = useState<RoomInventoryDetail | null>(null);
  const [inheritTemplateToggle, setInheritTemplateToggle] = useState(false);
  const [bulkInventoryModalOpen, setBulkInventoryModalOpen] = useState(false);
  const [bulkInventoryState, setBulkInventoryState] = useState<BulkInventoryState>({
    inheritTemplate: undefined,
    overwriteCustom: false,
    primaryImageUrl: '',
    customItems: [],
  });
  const [bulkInventorySaving, setBulkInventorySaving] = useState(false);

  const handleOpenInventoryModal = async (room: Room) => {
    if (!user?.tenantId) return;
    setInventoryRoom(room);
    setShowInventoryModal(true);
    setInventoryLoading(true);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/rooms/${room.id}/inventory`);
      setInventoryDetail(response.data.data);
      setInheritTemplateToggle(response.data.data.inventoryInheritsTemplate);
    } catch (error) {
      console.error('Failed to load inventory', error);
      toast.error('Failed to load inventory');
      setShowInventoryModal(false);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleSaveInventory = async (payload: { inheritTemplate?: boolean; customItems?: InventoryItem[]; overwriteCustom?: boolean; primaryImageUrl?: string | null }) => {
    if (!user?.tenantId || !inventoryRoom) return;
    setInventoryLoading(true);
    try {
      await api.post(`/tenants/${user.tenantId}/rooms/${inventoryRoom.id}/inventory`, payload);
      toast.success('Inventory updated');
      await fetchRooms(pagination.page);
      setShowInventoryModal(false);
      setInventoryRoom(null);
    } catch (error) {
      console.error('Failed to save inventory', error);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleBulkInventoryApply = async () => {
    if (!user?.tenantId) return;
    if (selectedRooms.size === 0) {
      toast.error('Select rooms to apply bulk inventory');
      return;
    }
    if (!window.confirm(`Apply inventory changes to ${selectedRooms.size} room(s)?`)) {
      return;
    }
    setBulkInventorySaving(true);
    try {
      const payload: any = {
        roomIds: Array.from(selectedRooms),
      };
      if (bulkInventoryState.inheritTemplate !== undefined) {
        payload.inheritTemplate = bulkInventoryState.inheritTemplate;
      }
      if (bulkInventoryState.overwriteCustom !== undefined) {
        payload.overwriteCustom = bulkInventoryState.overwriteCustom;
      }
      if (bulkInventoryState.primaryImageUrl !== undefined) {
        payload.primaryImageUrl = bulkInventoryState.primaryImageUrl || null;
      }
      if (bulkInventoryState.customItems.length > 0) {
        payload.customItems = bulkInventoryState.customItems.map(mapInventoryItemToPayload);
      }
      await api.post(`/tenants/${user.tenantId}/rooms/bulk-inventory`, payload);
      toast.success('Bulk inventory update queued');
      setBulkInventoryModalOpen(false);
      setBulkInventoryState({ inheritTemplate: undefined, overwriteCustom: false, primaryImageUrl: '', customItems: [] });
      setSelectedRooms(new Set());
      fetchRooms(pagination.page);
    } catch (error) {
      console.error('Bulk inventory failed', error);
    } finally {
      setBulkInventorySaving(false);
    }
  };

  const fetchRooms = useCallback(async (page = 1, limit = pagination.limit, showLoading = false) => {
    if (!user?.tenantId) return;
    
    // Only show full loading skeleton on initial load
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      const response = await api.get(`/tenants/${user.tenantId}/rooms`, {
        params: {
          page,
          limit,
          categoryId:
            selectedCategoryFilter && selectedCategoryFilter !== ''
              ? selectedCategoryFilter === 'none'
                ? 'none'
                : selectedCategoryFilter
              : undefined,
          floor: selectedFloorFilter || undefined,
        },
      });
      setRooms(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      } else {
        setPagination((prev) => ({
          ...prev,
          page,
          limit,
          total: response.data.data?.length || 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }));
      }
      setSelectedRooms(new Set());
    } catch (error: any) {
      console.error('Failed to fetch rooms:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to fetch rooms');
      setRooms([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [user?.tenantId, selectedCategoryFilter, selectedFloorFilter, pagination.limit]);

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/room-categories`);
      const newCategories = response.data.data || [];
      setCategories(newCategories);
      
      // If we're editing a category, update it with fresh data from the refetch
      if (editingCategory) {
        const updatedCategory = newCategories.find((cat: RoomCategory) => cat.id === editingCategory.id);
        if (updatedCategory) {
          setEditingCategory(updatedCategory);
        }
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchLatestReport = async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user.tenantId}/rooms/accountability-report/latest`);
      setLatestReport(response.data.data);
    } catch (error) {
      console.error('Failed to fetch latest accountability report:', error);
      setLatestReport(null);
    }
  };

  const fetchIotAlerts = async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user.tenantId}/iot/alerts`);
      const map = new Map<string, string>();
      (response.data.data || []).forEach((alert: any) => {
        const roomId = alert.metadata?.roomId;
        if (roomId && !map.has(roomId)) map.set(roomId, alert.message || 'Occupancy mismatch');
      });
      setIotAlerts(map);
    } catch {
      // IoT is optional — silently skip if no gateway is configured
      setIotAlerts(new Map());
    }
  };

  // Initial data fetch - load rooms and categories in parallel
  useEffect(() => {
    if (!user?.tenantId) return;
    
    const loadInitialData = async () => {
      try {
        // Fetch all data in parallel for faster loading
        await Promise.all([
          fetchRooms(1, pagination.limit, true), // showLoading = true for initial load
          fetchCategories(),
          fetchLatestReport(),
          fetchRatePlans(),
          fetchIotAlerts(),
        ]);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, [user?.tenantId]);

  const fetchRatePlans = async () => {
    if (!user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user.tenantId}/rate-plans`);
      setRatePlans(
        (response.data.data || []).map((plan: any) => ({
          id: plan.id,
          name: plan.name,
          baseRate: plan.baseRate !== undefined && plan.baseRate !== null ? Number(plan.baseRate) : null,
          categoryId: plan.categoryId ?? null,
          isActive: plan.isActive !== false,
        }))
      );
    } catch (error) {
      console.error('Failed to fetch rate plans:', error);
    }
  };
  
  // Refetch when filters change (without showing loading skeleton)
  useEffect(() => {
    if (!user?.tenantId || loading) return;
    fetchRooms(1, pagination.limit, false); // showLoading = false for filter changes
  }, [selectedCategoryFilter, selectedFloorFilter]);

  const fetchRoomLogs = async (roomId: string, page = 1, limit = roomLogsPagination.limit) => {
    setRoomLogsLoading(true);
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms/${roomId}/logs`, {
        params: { page, limit },
      });
      setRoomLogs(response.data.data || []);
      if (response.data.pagination) {
        setRoomLogsPagination(response.data.pagination);
      } else {
        setRoomLogsPagination((prev) => ({
          ...prev,
          page,
          limit,
          total: response.data.data?.length || 0,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch room logs:', error);
    } finally {
      setRoomLogsLoading(false);
    }
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedRooms.size === 0) {
      toast.error('Please select at least one room');
      return;
    }

    const confirmMessage = `Are you sure you want to update ${selectedRooms.size} room(s) to "${newStatus.replace('_', ' ')}"?`;
    if (!window.confirm(confirmMessage)) return;

    setIsBulkProcessing(true);
    const roomIds = Array.from(selectedRooms);
    let successCount = 0;
    let failCount = 0;

    for (const roomId of roomIds) {
      try {
        await api.patch(`/tenants/${user?.tenantId}/rooms/${roomId}`, { status: newStatus });
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    setIsBulkProcessing(false);
    setSelectedRooms(new Set());
    fetchRooms(pagination.page);

    if (failCount === 0) {
      toast.success(`Successfully updated ${successCount} room(s)`);
    } else {
      toast.error(`Updated ${successCount}, failed ${failCount}`);
    }
  };

  const toggleSelectRoom = (roomId: string) => {
    const newSelected = new Set(selectedRooms);
    if (newSelected.has(roomId)) {
      newSelected.delete(roomId);
    } else {
      newSelected.add(roomId);
    }
    setSelectedRooms(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedRooms.size === filteredRooms.length) {
      setSelectedRooms(new Set());
    } else {
      setSelectedRooms(new Set(filteredRooms.map((r) => r.id)));
    }
  };

  const handleViewActivity = (room: Room) => {
    setActivityRoom(room);
    setShowActivityModal(true);
    fetchRoomLogs(room.id, 1);
  };

  const handleActivityPageChange = (newPage: number) => {
    if (!activityRoom) return;
    if (newPage < 1 || newPage > roomLogsPagination.totalPages) return;
    fetchRoomLogs(activityRoom.id, newPage);
  };

  const closeActivityModal = () => {
    setShowActivityModal(false);
    setActivityRoom(null);
    setRoomLogs([]);
  };

  const filteredRooms = useMemo(() => rooms.filter((room) => {
    // Filter by search term (use debounced value for actual filtering but immediate for UI responsiveness)
    if (debouncedSearchTerm) {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        room.roomNumber.toLowerCase().includes(searchLower) ||
        room.roomType.toLowerCase().includes(searchLower) ||
        room.status.toLowerCase().includes(searchLower) ||
        room.description?.toLowerCase().includes(searchLower) ||
        room.category?.name.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Filter by category (support both legacy categoryId and populated category object)
    if (selectedCategoryFilter) {
      const roomCategoryId = room.categoryId || room.category?.id || null;
      if (selectedCategoryFilter === 'none') {
        if (roomCategoryId) return false;
      } else if (!roomCategoryId || roomCategoryId !== selectedCategoryFilter) {
        return false;
      }
    }

    // Filter by room type
    if (selectedRoomTypeFilter) {
      if (room.roomType !== selectedRoomTypeFilter) return false;
    }

    // Filter by status
    if (selectedStatusFilter) {
      if (room.status !== selectedStatusFilter) return false;
    }

    // Filter by floor
    if (selectedFloorFilter) {
        const floorNumber = parseInt(selectedFloorFilter, 10);
      if (!isNaN(floorNumber)) {
        if (room.floor !== floorNumber) return false;
      }
    }

    return true;
  }), [rooms, debouncedSearchTerm, selectedCategoryFilter, selectedRoomTypeFilter, selectedStatusFilter, selectedFloorFilter]);

  const roomTypeOptions = useMemo(() => {
    return Array.from(new Set(rooms.map((room) => room.roomType).filter(Boolean)));
  }, [rooms]);

  const statusLabels: Record<string, string> = {
    available: 'Available',
    reserved: 'Reserved',
    occupied: 'Occupied',
    dirty: 'Dirty',
    clean: 'Clean',
    inspected: 'Inspected',
    out_of_order: 'Out of Order',
    maintenance: 'Maintenance',
  };

  const statusOptions = Object.keys(statusLabels);

  const formatTimeAgo = (date?: Date | null) => {
    if (!date) return 'No activity yet';
    const now = Date.now();
    const diffMs = now - date.getTime();
    if (diffMs < 60 * 1000) return 'just now';
    if (diffMs < 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 1000))}m ago`;
    if (diffMs < 24 * 60 * 60 * 1000) return `${Math.floor(diffMs / (60 * 60 * 1000))}h ago`;
    return `${Math.floor(diffMs / (24 * 60 * 60 * 1000))}d ago`;
  };

  const boardStatuses = [
    'dirty',
    'maintenance',
    'inspected',
    'clean',
    'available',
    'reserved',
    'occupied',
    'out_of_order',
  ];

  const boardRoles = ['housekeeping', 'housekeeping_manager', 'maintenance', 'front_desk'];
  const canActOnBoard = boardRoles.includes(user?.role || '');

  const activeFilters = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (searchTerm) {
      chips.push({ key: 'search', label: `Search: ${searchTerm}` });
    }
    if (selectedCategoryFilter) {
      const categoryLabel =
        selectedCategoryFilter === 'none'
          ? 'No Category'
          : categories.find((cat) => cat.id === selectedCategoryFilter)?.name || 'Category';
      chips.push({ key: 'category', label: `Category: ${categoryLabel}` });
    }
    if (selectedFloorFilter) {
      chips.push({ key: 'floor', label: `Floor: ${selectedFloorFilter}` });
    }
    if (selectedRoomTypeFilter) {
      chips.push({ key: 'roomType', label: `Room type: ${selectedRoomTypeFilter}` });
    }
    if (selectedStatusFilter) {
      chips.push({ key: 'status', label: `Status: ${statusLabels[selectedStatusFilter] || selectedStatusFilter}` });
    }
    return chips;
  }, [
    searchTerm,
    selectedCategoryFilter,
    selectedFloorFilter,
    selectedRoomTypeFilter,
    selectedStatusFilter,
    categories,
  ]);

  const accountabilityThresholdMs = 6 * 60 * 60 * 1000;
  const accountabilityMetrics = useMemo(() => {
    const now = new Date();
    const staleRoomsRaw = rooms
      .map((room) => ({
        ...room,
        parsedLastLogAt: room.lastLogAt ? new Date(room.lastLogAt) : null,
      }))
      .sort((a, b) => {
        if (!a.parsedLastLogAt) return 1;
        if (!b.parsedLastLogAt) return -1;
        return a.parsedLastLogAt.getTime() - b.parsedLastLogAt.getTime();
      });

    const roomsStale = staleRoomsRaw.filter(
      (room) => !room.parsedLastLogAt || now.getTime() - (room.parsedLastLogAt?.getTime() || 0) > accountabilityThresholdMs
    );

    const roomsFlagged = rooms.filter((room) =>
      ['dirty', 'out_of_order', 'maintenance', 'reserved'].includes(room.status)
    );

    const staleRoomsList = roomsStale.slice(0, 5);

    return {
      staleCount: roomsStale.length,
      flaggedCount: roomsFlagged.length,
      noLogCount: rooms.filter((room) => !room.lastLogAt).length,
      staleRoomsList,
    };
  }, [rooms]);

  const roomsByStatus = useMemo(() => {
    const groups: Record<string, Room[]> = {};
    boardStatuses.forEach((status) => {
      groups[status] = [];
    });
    rooms.forEach((room) => {
      const bucket = groups[room.status] || groups.available;
      bucket.push(room);
    });
    return groups;
  }, [rooms]);

  const quickStatusNext: Record<string, string> = {
    dirty: 'clean',
    maintenance: 'available',
    clean: 'inspected',
    inspected: 'available',
    reserved: 'occupied',
    available: 'occupied',
    occupied: 'available',
    out_of_order: 'maintenance',
  };

  const handleBoardStatusChange = async (room: Room, targetStatus: string) => {
    if (!user?.tenantId) return;
    try {
      await api.patch(`/tenants/${user.tenantId}/rooms/${room.id}`, {
        status: targetStatus,
      });
      toast.success(`Room ${room.roomNumber} marked ${statusLabels[targetStatus] || targetStatus}`);
      // Refetch via Rooms page’s fetchRooms (triggers RoomsPage state)
      fetchRooms(pagination.page);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Unable to update status');
    }
  };

  const clearFilter = (key: string) => {
    if (key === 'search') {
      setSearchTerm('');
    } else if (key === 'category') {
      setSelectedCategoryFilter('');
    } else if (key === 'floor') {
      setSelectedFloorFilter('');
    } else if (key === 'roomType') {
      setSelectedRoomTypeFilter('');
    } else if (key === 'status') {
      setSelectedStatusFilter('');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: '#10b981',
      reserved: '#f59e0b',
      occupied: '#3b82f6',
      dirty: '#f59e0b',
      clean: '#8b5cf6',
      inspected: '#06b6d4',
      out_of_order: '#ef4444',
      maintenance: '#f97316',
    };
    return colors[status] || '#94a3b8';
  };

  if (loading) {
    return (
      <Layout>
        <PageHeader title="Rooms" />
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="220px" />
          ))}
        </div>
      </Layout>
    );
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!window.confirm('Are you sure you want to delete this category? Rooms assigned to it will not be deleted.')) {
      return;
    }

    try {
      await api.delete(`/tenants/${user?.tenantId}/room-categories/${categoryId}`);
      toast.success('Category deleted successfully');
      fetchCategories();
      // Clear category filter if it was selected
      if (selectedCategoryFilter === categoryId) {
        setSelectedCategoryFilter('');
      }
    } catch (error: any) {
      // Error handled by API interceptor
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Rooms"
        subtitle={`${pagination.total || rooms.length} rooms in inventory`}
        actions={
          <>
            <Button
              variant="secondary"
              icon={<Tag size={16} />}
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryModal(true);
              }}
            >
              Categories
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>
              Add room
            </Button>
          </>
        }
      />

      {selectedRooms.size > 0 && (
        <div className={styles.bulkBar}>
          <span className={styles.bulkLabel}>
            {selectedRooms.size} room{selectedRooms.size !== 1 ? 's' : ''} selected
          </span>
          <div className="row wrap">
            <Select
              onChange={(e) => {
                if (e.target.value) {
                  handleBulkStatusUpdate(e.target.value);
                  e.target.value = '';
                }
              }}
              disabled={isBulkProcessing}
              aria-label="Bulk status update"
              defaultValue=""
            >
              <option value="">Set status…</option>
              <option value="available">Available</option>
              <option value="clean">Clean</option>
              <option value="dirty">Dirty</option>
              <option value="inspected">Inspected</option>
              <option value="out_of_order">Out of order</option>
              <option value="maintenance">Maintenance</option>
            </Select>
            <Button size="sm" variant="secondary" onClick={() => setBulkInventoryModalOpen(true)} icon={<Layers size={15} />}>
              Bulk inventory
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedRooms(new Set())}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search room #, type, status, description…"
        activeCount={activeFilters.length}
        onClear={() => {
          setSearchTerm('');
          setSelectedCategoryFilter('');
          setSelectedFloorFilter('');
          setSelectedRoomTypeFilter('');
          setSelectedStatusFilter('');
        }}
      >
        <Select
          value={selectedCategoryFilter}
          onChange={(e) => setSelectedCategoryFilter(e.target.value)}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          <option value="none">No category</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name} ({cat.actualRoomCount})
            </option>
          ))}
        </Select>
        <Select
          value={selectedRoomTypeFilter}
          onChange={(e) => setSelectedRoomTypeFilter(e.target.value)}
          aria-label="Filter by room type"
        >
          <option value="">All types</option>
          {roomTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
        <Select
          value={selectedStatusFilter}
          onChange={(e) => setSelectedStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]}
            </option>
          ))}
        </Select>
        <TextInput
          type="number"
          value={selectedFloorFilter}
          onChange={(e) => setSelectedFloorFilter(e.target.value)}
          placeholder="Floor"
          style={{ width: '90px' }}
          aria-label="Filter by floor"
        />
      </FilterBar>

      {activeFilters.length > 0 && (
        <div className={styles.chipRow}>
          {activeFilters.map((filter) => (
            <span key={filter.key} className={styles.chip}>
              {filter.label}
              <button onClick={() => clearFilter(filter.key)} aria-label={`Clear ${filter.label} filter`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

        {rooms.length > 0 && (
          <Panel
            title="Room accountability"
            subtitle="Rooms with stale logs, flagged statuses, and missing accountability details"
            style={{ marginBottom: 'var(--space-4)' }}
          >
            <div className={styles.metricGrid}>
              <div className={styles.metricDanger}>
                <div className={styles.metricValue}>{accountabilityMetrics.staleCount}</div>
                <div className={styles.metricLabel}>Rooms with no log in 6h</div>
              </div>
              <div className={styles.metricInfo}>
                <div className={styles.metricValue}>{accountabilityMetrics.flaggedCount}</div>
                <div className={styles.metricLabel}>Flagged dirty / reserved / maintenance</div>
              </div>
              <div className={styles.metricSuccess}>
                <div className={styles.metricValue}>{accountabilityMetrics.noLogCount}</div>
                <div className={styles.metricLabel}>Rooms never logged</div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 var(--space-3)', color: 'var(--text)', fontSize: 'var(--fs-base)', fontWeight: 700 }}>
                Most overdue rooms
              </h3>
              {accountabilityMetrics.staleRoomsList.length === 0 ? (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>
                  All rooms have fresh logs.
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className={styles.miniTable}>
                    <thead>
                      <tr>
                        <th>Room</th>
                        <th>Status</th>
                        <th>Last action</th>
                        <th>Responsible</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {accountabilityMetrics.staleRoomsList.map((room) => (
                        <tr key={room.id}>
                          <td>
                            <strong style={{ color: 'var(--text)' }}>Room {room.roomNumber}</strong>
                            <div style={{ fontSize: 'var(--fs-2xs)', color: 'var(--muted)' }}>
                              Last logged {formatTimeAgo(room.parsedLastLogAt)}
                            </div>
                          </td>
                          <td>
                            <StatusBadge status={room.status} />
                          </td>
                          <td>{room.lastLogSummary || 'No log yet'}</td>
                          <td>{room.lastLogUserName || 'Unassigned'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <Button size="sm" variant="secondary" onClick={() => handleViewActivity(room)}>
                              History
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Panel>
        )}

        {latestReport && (
          <section className={styles.reportBanner}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <div>
                <h3>Latest accountability report</h3>
                <p className={styles.reportBannerSub}>
                  Generated {new Date(latestReport.lastReportAt?.seconds ? latestReport.lastReportAt.seconds * 1000 : latestReport.lastReportAt)?.toLocaleString() || 'recently'}
                </p>
              </div>
              <span className={styles.reportBannerSub}>
                by {latestReport.generatedBy || 'system'}
              </span>
            </div>
            <div className={styles.reportStats}>
              <div>
                <strong>{latestReport.staleCount}</strong>
                <p>Without a recent log</p>
              </div>
              <div>
                <strong>{latestReport.flaggedCount}</strong>
                <p>Flagged dirty / reserved / maintenance</p>
              </div>
              <div>
                <strong>{latestReport.noLogCount}</strong>
                <p>Lacking any logs</p>
              </div>
            </div>
          </section>
        )}

        {rooms.length > 0 && (
          <Panel
            title="Status board"
            subtitle="Rooms by current status — quick actions move rooms through the workflow"
            style={{ marginBottom: 'var(--space-4)' }}
          >
            <div className={styles.boardGrid}>
              {boardStatuses.map((status) => (
                <div key={status} className={styles.boardCol}>
                  <div className={styles.boardColTitle}>{statusLabels[status]}</div>
                  <p className={styles.boardColCount}>
                    {roomsByStatus[status]?.length || 0} room{roomsByStatus[status]?.length === 1 ? '' : 's'}
                  </p>
                  <div className={styles.boardCards}>
                    {(roomsByStatus[status] ?? []).slice(0, 4).map((room) => (
                      <div key={room.id} className={styles.boardCard}>
                        <div className={styles.boardCardHead}>
                          <strong>Room {room.roomNumber}</strong>
                          <span>{formatTimeAgo(room.lastLogAt ? new Date(room.lastLogAt) : undefined)}</span>
                        </div>
                        <div className={styles.boardCardBody}>
                          {room.lastLogSummary || 'No log entry yet'}
                        </div>
                        <div className={styles.boardCardFoot}>
                          <span>{room.lastLogUserName || 'Unassigned'}</span>
                          <button onClick={() => handleViewActivity(room)}>History</button>
                        </div>
                        {canActOnBoard && quickStatusNext[room.status] && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleBoardStatusChange(room, quickStatusNext[room.status])}
                          >
                            Mark {statusLabels[quickStatusNext[room.status]] || quickStatusNext[room.status]}
                          </Button>
                        )}
                      </div>
                    ))}
                    {(roomsByStatus[status] ?? []).length > 4 && (
                      <span className={styles.more}>
                        +{(roomsByStatus[status] ?? []).length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        <label className={styles.selectAll}>
          <input
            type="checkbox"
            checked={selectedRooms.size === filteredRooms.length && filteredRooms.length > 0}
            onChange={toggleSelectAll}
          />
          Select all ({filteredRooms.length} rooms)
        </label>

        <div className={styles.grid}>
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className={`${styles.roomCard} ${selectedRooms.has(room.id) ? styles.roomCardSelected : ''}`}
              style={{ '--status-color': getStatusColor(room.status) } as React.CSSProperties}
            >
              <div className={styles.roomHead}>
                <input
                  type="checkbox"
                  checked={selectedRooms.has(room.id)}
                  onChange={() => toggleSelectRoom(room.id)}
                  aria-label={`Select room ${room.roomNumber}`}
                />
                <div style={{ flex: 1 }}>
                  <h3 className={styles.roomTitle}>Room {room.roomNumber}</h3>
                  <p className={styles.roomSub}>
                    {room.roomType} · Floor {room.floor}
                    {room.category && (() => {
                      const categoryData = categories.find(cat => cat.id === room.category?.id);
                      const categoryColor = categoryData?.color || '#8b5cf6';
                      return (
                        <span style={{ marginLeft: '0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span
                            role="img"
                            aria-label={`Category color ${room.category?.name}`}
                            style={{
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: categoryColor,
                            }}
                          >
                            <span style={srOnlyStyle}>{categoryColor}</span>
                          </span>
                          <span style={{ color: categoryColor, fontWeight: 600 }}>
                            {room.category.name}
                          </span>
                        </span>
                      );
                    })()}
                  </p>
                  {room.description && <p className={styles.roomDesc}>{room.description}</p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-end' }}>
                  <StatusBadge status={room.status} />
                  {iotAlerts.has(room.id) && (
                    <span
                      role="status"
                      title={iotAlerts.get(room.id)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: 'var(--warning, #b45309)',
                        background: 'var(--warning-bg, rgba(234, 179, 8, 0.12))',
                        border: '1px solid var(--warning-border, rgba(234, 179, 8, 0.35))',
                        borderRadius: '999px',
                        padding: '0.1rem 0.5rem',
                        cursor: 'help',
                      }}
                    >
                      ⚠ IoT mismatch
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.roomFacts}>
                <div className={styles.factRow}>
                  <span className={styles.factKey}>Max occupancy</span>
                  <span className={styles.factVal}>{room.maxOccupancy} guests</span>
                </div>
                <div className={styles.factRow}>
                  <span className={styles.factKey}>Rate plan</span>
                  <span className={styles.factVal}>{room.ratePlan?.name || 'N/A'}</span>
                </div>
                <div className={styles.factRow}>
                  <span className={styles.factKey}>Custom rate</span>
                  <span className={styles.factVal} style={!room.customRate ? { color: 'var(--muted)', fontWeight: 400 } : undefined}>
                    {room.customRate ? formatMoney(Number(room.customRate), currency) : 'Not set'}
                  </span>
                </div>
                {room.effectiveRate && (
                  <div className={styles.factRow}>
                    <span className={styles.factKey}>Effective rate</span>
                    <span className={styles.factVal}>{formatMoney(Number(room.effectiveRate), currency)}</span>
                  </div>
                )}
              </div>
              <div className={styles.roomActions}>
                <Button size="sm" variant="secondary" icon={<Edit size={14} />} onClick={() => setEditRoom(room)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setRateEditRoom(room)}>
                  Edit rate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleViewActivity(room)}>
                  Activity
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Package size={14} />}
                  onClick={() => handleOpenInventoryModal(room)}
                >
                  Inventory
                </Button>
              </div>
            </div>
          ))}
        </div>

        {filteredRooms.length === 0 && (
          <EmptyState
            icon={<DoorOpen size={28} strokeWidth={1.6} />}
            title={searchTerm || selectedCategoryFilter || selectedFloorFilter ? 'No rooms found' : 'No rooms yet'}
            description={
              searchTerm || selectedCategoryFilter || selectedFloorFilter
                ? 'Try adjusting your filters to find rooms'
                : 'Create your first room to get started'
            }
            action={
              !(searchTerm || selectedCategoryFilter || selectedFloorFilter) ? (
                <Button variant="primary" onClick={() => setShowCreateModal(true)}>
                  Create room
                </Button>
              ) : undefined
            }
          />
        )}

        {rooms.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => {
                if (newPage === pagination.page) return;
                if (newPage < 1 || newPage > pagination.totalPages) return;
                fetchRooms(newPage, pagination.limit);
              }}
            />
          </div>
        )}

        {showCreateModal && (
          <CreateRoomModal
            categories={categories}
            rooms={rooms}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchRooms(pagination.page);
            }}
            ratePlans={ratePlans}
          />
        )}

        {editRoom && (
          <EditRoomModal
            room={editRoom}
            onClose={() => setEditRoom(null)}
            onSuccess={() => {
              setEditRoom(null);
              fetchRooms(pagination.page);
            }}
          />
        )}

        {rateEditRoom && (
          <EditRoomRateModal
            room={rateEditRoom}
            categories={categories}
            ratePlans={ratePlans}
            onClose={() => setRateEditRoom(null)}
            onSuccess={() => {
              setRateEditRoom(null);
              fetchRooms(pagination.page);
            }}
          />
        )}

        {showCategoryModal && (
          <CategoryManagementModal
            categories={categories}
            editingCategory={editingCategory}
            setEditingCategory={setEditingCategory}
            onClose={() => {
              setShowCategoryModal(false);
              setEditingCategory(null);
            }}
            onSuccess={() => {
              fetchCategories();
            }}
            onDelete={handleDeleteCategory}
          />
        )}

        {showActivityModal && activityRoom && (
          <RoomActivityModal
            room={activityRoom}
            logs={roomLogs}
            pagination={roomLogsPagination}
            loading={roomLogsLoading}
            onClose={closeActivityModal}
            onPageChange={handleActivityPageChange}
          />
        )}

        {showInventoryModal && inventoryRoom && (
          <RoomInventoryModal
            room={inventoryRoom}
            detail={inventoryDetail}
            loading={inventoryLoading}
            inheritTemplate={inheritTemplateToggle}
            onChangeInherit={setInheritTemplateToggle}
            onClose={() => {
              setShowInventoryModal(false);
              setInventoryRoom(null);
              setInventoryDetail(null);
            }}
            onSave={handleSaveInventory}
          />
        )}

        {bulkInventoryModalOpen && (
          <BulkInventoryModal
            selectedCount={selectedRooms.size}
            state={bulkInventoryState}
            setState={setBulkInventoryState}
            onClose={() => setBulkInventoryModalOpen(false)}
            onApply={handleBulkInventoryApply}
            saving={bulkInventorySaving}
          />
        )}
    </Layout>
  );
}

interface EditRoomModalProps {
  room: Room;
  categories: RoomCategory[];
  ratePlans: RatePlanLite[];
  onClose: () => void;
  onSuccess: () => void;
}

function CreateRoomModal({
  categories,
  rooms,
  ratePlans,
  onClose,
  onSuccess,
}: {
  categories: RoomCategory[];
  rooms: Room[];
  ratePlans: RatePlanLite[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [mode, setMode] = useState<'single' | 'bulk' | 'generate'>('single');
  const [genMode, setGenMode] = useState<'smart' | 'manual'>('smart');
  const [genConfig, setGenConfig] = useState({
    startFloor: '1',
    endFloor: '10',
    single: '4',
    double: '3',
    twin: '1',
    deluxe: '1',
    suite: '1',
  });
  const [smartConfig, setSmartConfig] = useState({
    totalRooms: '40',
    floors: '4',
    startFloor: '1',
  });
  const [clusterPremium, setClusterPremium] = useState(true);
  // Manual edits to the suggested mix / type / plan, keyed by smart-row key.
  const [smartOverrides, setSmartOverrides] = useState<Record<string, number>>({});
  const [smartTypeOverrides, setSmartTypeOverrides] = useState<Record<string, string>>({});
  const [smartPlanOverrides, setSmartPlanOverrides] = useState<Record<string, string | null>>({});
  const [formData, setFormData] = useState({
    roomNumber: '',
    roomNumberRange: '',
    roomType: 'single',
    floor: '',
    maxOccupancy: 1,
    ratePlanId: '',
    categoryId: '',
    description: '',
    overrideDescription: false,
    customRate: '',
  });
  const [loading, setLoading] = useState(false);
  const [parsedRoomNumbers, setParsedRoomNumbers] = useState<string[]>([]);
  const [creationProgress, setCreationProgress] = useState<{
    total: number;
    created: number;
    failed: number;
  } | null>(null);

  // Parse room number range (e.g., "100-150" or "101, 102, 105-110")
  const parseRoomNumbers = (input: string): string[] => {
    const numbers: string[] = [];
    const parts = input.split(',').map(p => p.trim());
    
    for (const part of parts) {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(s => s.trim());
        const startNum = parseInt(start, 10);
        const endNum = parseInt(end, 10);
        if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum) {
          for (let i = startNum; i <= endNum; i++) {
            numbers.push(String(i));
          }
        }
      } else {
        const num = part.trim();
        if (num) {
          numbers.push(num);
        }
      }
    }
    
    return [...new Set(numbers)]; // Remove duplicates
  };

  // Auto-fill description from category
  useEffect(() => {
    if (!!formData.categoryId && !formData.overrideDescription) {
      const category = categories.find(cat => cat.id === formData.categoryId);
      if (category?.description) {
        setFormData(prev => ({ ...prev, description: category.description || '' }));
      }
    }
  }, [formData.categoryId, categories, formData.overrideDescription]);

  // Parse room numbers when range input changes (bulk mode)
  useEffect(() => {
    if (mode === 'bulk' && formData.roomNumberRange) {
      const parsed = parseRoomNumbers(formData.roomNumberRange);
      setParsedRoomNumbers(parsed);
    } else {
      setParsedRoomNumbers([]);
    }
  }, [mode, formData.roomNumberRange]);

  // Auto-detect floor from room number
  const autoDetectFloor = (roomNumber: string): number | null => {
    const num = parseInt(roomNumber, 10);
    if (isNaN(num)) return null;
    // If room number is 3+ digits, first digit(s) might be floor
    if (num >= 100) {
      const firstDigit = Math.floor(num / 100);
      return firstDigit;
    }
    return null;
  };

  // ---- Smart generation helpers ----

  // Largest-remainder apportionment: split `total` across `weights` so the
  // parts are as proportional as possible while summing exactly to `total`.
  const apportion = (total: number, weights: number[]): number[] => {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0 || total <= 0) return weights.map(() => 0);
    const raw = weights.map((w) => (total * w) / sum);
    const base = raw.map(Math.floor);
    const out = [...base];
    let rem = total - base.reduce((a, b) => a + b, 0);
    const order = raw
      .map((r, i) => ({ frac: r - base[i], idx: i }))
      .sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < rem; k++) out[order[k % order.length].idx]++;
    return out;
  };

  const TYPE_OCCUPANCY: Record<string, number> = {
    single: 1,
    double: 2,
    twin: 2,
    deluxe: 3,
    suite: 4,
  };

  const guessRoomType = (name: string): string => {
    const n = name.toLowerCase();
    if (/suite|penthouse|presidential/.test(n)) return 'suite';
    if (/deluxe|premium|executive|luxury|vip/.test(n)) return 'deluxe';
    if (/twin/.test(n)) return 'twin';
    if (/double|queen|king|family|matrimonial/.test(n)) return 'double';
    return 'single';
  };

  // Standard-ish categories should carry the bulk of inventory; premium
  // tiers get progressively fewer rooms. Used only when no price data exists.
  const nameTierWeight = (name: string): number => {
    const n = name.toLowerCase();
    if (/suite|penthouse|presidential/.test(n)) return 1;
    if (/deluxe|premium|executive|luxury|vip/.test(n)) return 2;
    return 5;
  };

  // One row per tenant category, each carrying its linked active rate plans.
  // Falls back to generic room types when no categories exist yet.
  const smartRows = useMemo(() => {
    type Row = {
      key: string;
      label: string;
      categoryId: string | null;
      planOptions: RatePlanLite[];
      defaultPlanId: string | null;
      defaultRoomType: string;
      price: number | null;
      weight: number;
    };

    let rows: Row[];
    if (categories.length > 0) {
      rows = categories.map((cat) => {
        const planOptions = ratePlans.filter((p) => p.categoryId === cat.id && p.isActive !== false);
        const plan = planOptions[0];
        const price =
          plan?.baseRate ??
          (cat.minPrice != null && cat.maxPrice != null
            ? (Number(cat.minPrice) + Number(cat.maxPrice)) / 2
            : cat.minPrice ?? cat.maxPrice ?? null);
        return {
          key: cat.id,
          label: cat.name,
          categoryId: cat.id as string | null,
          planOptions,
          defaultPlanId: plan?.id ?? null,
          defaultRoomType: guessRoomType(cat.name),
          price: price != null ? Number(price) : null,
          weight: nameTierWeight(cat.name),
        };
      });
    } else {
      const fallbackWeights: Record<string, number> = {
        single: 4,
        double: 3,
        twin: 1,
        deluxe: 1,
        suite: 1,
      };
      rows = (['single', 'double', 'twin', 'deluxe', 'suite'] as const).map((t) => ({
        key: `type:${t}`,
        label: t.charAt(0).toUpperCase() + t.slice(1),
        categoryId: null,
        planOptions: [],
        defaultPlanId: null,
        defaultRoomType: t as string,
        price: null,
        weight: fallbackWeights[t],
      }));
    }

    // Price-driven weighting: when most rows have a price, the cheapest
    // category gets weight 5 and the most expensive gets ~1, scaled linearly.
    // Rows without a price keep their name-derived weight.
    const priced = rows.filter((r) => r.price != null);
    if (priced.length > 1) {
      const prices = priced.map((r) => r.price as number);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (max > min) {
        rows = rows.map((r) =>
          r.price != null
            ? { ...r, weight: Math.max(1, Math.round(5 - (4 * (r.price - min)) / (max - min))) }
            : r
        );
      }
    }
    return rows;
  }, [categories, ratePlans]);

  const smartSuggested = useMemo(() => {
    const total = parseInt(smartConfig.totalRooms, 10) || 0;
    const counts = apportion(total, smartRows.map((r) => r.weight));
    const map: Record<string, number> = {};
    smartRows.forEach((r, i) => {
      map[r.key] = counts[i];
    });
    return map;
  }, [smartRows, smartConfig.totalRooms]);

  const smartMix = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of smartRows) {
      map[row.key] = smartOverrides[row.key] ?? smartSuggested[row.key] ?? 0;
    }
    return map;
  }, [smartRows, smartSuggested, smartOverrides]);

  // Per-row effective room type / rate plan (user overrides win).
  const smartEffective = useMemo(() => {
    const map: Record<string, { roomType: string; ratePlanId: string | null }> = {};
    for (const row of smartRows) {
      map[row.key] = {
        roomType: smartTypeOverrides[row.key] ?? row.defaultRoomType,
        ratePlanId:
          row.key in smartPlanOverrides ? smartPlanOverrides[row.key] : row.defaultPlanId,
      };
    }
    return map;
  }, [smartRows, smartTypeOverrides, smartPlanOverrides]);

  // Room numbers already in use — generated collisions are skipped server-side,
  // so surface the count up front.
  const existingNumbers = useMemo(
    () => new Set(rooms.map((r) => String(r.roomNumber))),
    [rooms]
  );

  // Highest floor currently in use — used to hint the starting floor.
  const maxExistingFloor = useMemo(
    () => rooms.reduce((max, r) => Math.max(max, r.floor || 0), 0),
    [rooms]
  );

  type GenGroup = {
    roomType: string;
    maxOccupancy: number;
    numbers: string[];
    categoryId: string | null;
    ratePlanId: string | null;
    label?: string;
  };

  // Build generation plan. Manual mode: per-floor type counts between a
  // floor range. Smart mode: category totals either spread evenly across
  // floors, or clustered so premium categories land on the top floors.
  // Rooms are numbered floor * 100 + position.
  const genPlan = useMemo(() => {
    const empty = {
      groups: [] as GenGroup[],
      total: 0,
      floors: 0,
      overflow: false,
      perFloor: [] as number[],
      collisions: 0,
    };

    if (genMode === 'smart') {
      const floors = parseInt(smartConfig.floors, 10);
      const startFloor = parseInt(smartConfig.startFloor, 10);
      if (isNaN(floors) || isNaN(startFloor) || floors < 1 || startFloor < 1) {
        return empty;
      }

      const activeRows = smartRows
        .filter((row) => (smartMix[row.key] ?? 0) > 0)
        .map((row) => ({
          row,
          count: smartMix[row.key] ?? 0,
          eff: smartEffective[row.key],
        }));

      const groups: GenGroup[] = activeRows.map(({ row, eff }) => ({
        roomType: eff.roomType,
        maxOccupancy: TYPE_OCCUPANCY[eff.roomType] ?? 1,
        numbers: [],
        categoryId: row.categoryId,
        ratePlanId: eff.ratePlanId,
        label: row.label,
      }));

      const perFloor: number[] = new Array(floors).fill(0);
      let overflow = false;

      if (clusterPremium) {
        // Fill floors bottom-up: bulk/standard categories first so premium
        // categories land on the top floors. Each floor holds up to
        // ceil(total/floors) rooms; the top floor gets the remainder.
        const totalRooms = activeRows.reduce((s, a) => s + a.count, 0);
        const cap = Math.max(1, Math.ceil(totalRooms / floors));
        const ordered = activeRows
          .map((a, i) => ({ ...a, groupIdx: i }))
          .sort((a, b) => b.row.weight - a.row.weight);
        let floorIdx = 0;
        let pos = 1;
        for (const { groupIdx, count } of ordered) {
          for (let i = 0; i < count; i++) {
            if (floorIdx >= floors) {
              overflow = true;
              break;
            }
            if (pos > 99) {
              overflow = true;
              break;
            }
            groups[groupIdx].numbers.push(String((startFloor + floorIdx) * 100 + pos));
            perFloor[floorIdx]++;
            pos++;
            if (pos > cap) {
              pos = 1;
              floorIdx++;
            }
          }
          if (overflow) break;
        }
      } else {
        // Even spread: each category distributes across all floors so every
        // floor has the same mini-mix.
        const perRowPerFloor = activeRows.map(({ count }) =>
          apportion(count, new Array(floors).fill(1))
        );
        for (let f = 0; f < floors; f++) {
          let pos = 1;
          activeRows.forEach((_, i) => {
            for (let k = 0; k < (perRowPerFloor[i][f] || 0); k++) {
              if (pos > 99) {
                overflow = true;
              } else {
                groups[i].numbers.push(String((startFloor + f) * 100 + pos));
                perFloor[f]++;
              }
              pos++;
            }
          });
        }
      }

      const total = groups.reduce((s, g) => s + g.numbers.length, 0);
      const collisions = groups.reduce(
        (s, g) => s + g.numbers.filter((n) => existingNumbers.has(n)).length,
        0
      );
      return { groups, total, floors, overflow, perFloor, collisions };
    }

    const startFloor = parseInt(genConfig.startFloor, 10);
    const endFloor = parseInt(genConfig.endFloor, 10);
    if (isNaN(startFloor) || isNaN(endFloor) || startFloor < 1 || endFloor < startFloor) {
      return empty;
    }
    const counts: Array<[string, number, number]> = [
      ['single', parseInt(genConfig.single, 10) || 0, 1],
      ['double', parseInt(genConfig.double, 10) || 0, 2],
      ['twin', parseInt(genConfig.twin, 10) || 0, 2],
      ['deluxe', parseInt(genConfig.deluxe, 10) || 0, 3],
      ['suite', parseInt(genConfig.suite, 10) || 0, 4],
    ];
    const groups: GenGroup[] = counts
      .filter(([, count]) => count > 0)
      .map(([roomType, count, maxOccupancy]): GenGroup => {
        const numbers: string[] = [];
        for (let f = startFloor; f <= endFloor; f++) {
          const offset = counts.slice(0, counts.findIndex(([t]) => t === roomType)).reduce((s, [, c]) => s + c, 0);
          for (let pos = offset + 1; pos <= offset + count; pos++) {
            numbers.push(String(f * 100 + pos));
          }
        }
        return {
          roomType,
          maxOccupancy,
          numbers,
          categoryId: formData.categoryId || null,
          ratePlanId: formData.ratePlanId || null,
        };
      });
    const floors = endFloor - startFloor + 1;
    const total = floors * counts.reduce((s, [, c]) => s + c, 0);
    const perFloor = new Array(floors).fill(counts.reduce((s, [, c]) => s + c, 0));
    const collisions = groups.reduce(
      (s, g) => s + g.numbers.filter((n) => existingNumbers.has(n)).length,
      0
    );
    return { groups, total, floors, overflow: false, perFloor, collisions };
  }, [genMode, genConfig, smartConfig, smartRows, smartMix, smartEffective, clusterPremium, existingNumbers, formData.categoryId, formData.ratePlanId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreationProgress(null);

    try {
      if (mode === 'generate') {
        if (genPlan.total === 0) {
          toast.error('Configure at least one room to generate');
          setLoading(false);
          return;
        }
        if (genPlan.total > 500) {
          toast.error('Generation is limited to 500 rooms at a time');
          setLoading(false);
          return;
        }
        setCreationProgress({ total: genPlan.total, created: 0, failed: 0 });
        let created = 0;
        let skipped = 0;
        let failed = false;
        for (const group of genPlan.groups) {
          try {
            const response = await api.post(`/tenants/${user?.tenantId}/rooms/bulk`, {
              roomNumbers: group.numbers,
              roomType: group.roomType,
              floor: null,
              maxOccupancy: group.maxOccupancy,
              ratePlanId: group.ratePlanId,
              categoryId: group.categoryId,
              description: formData.description || null,
              customRate:
                genMode === 'smart' ? null : formData.customRate ? Number(formData.customRate) : null,
            });
            created += response.data.data?.created || 0;
            skipped += response.data.data?.skipped || 0;
            setCreationProgress({ total: genPlan.total, created, failed: 0 });
          } catch {
            failed = true;
          }
        }
        onSuccess();
        if (failed) {
          toast.error('Some room types failed to generate — check the list and retry');
        } else {
          toast.success(`Created ${created} room(s)${skipped ? `, skipped ${skipped} existing` : ''}`);
        }
        setTimeout(() => onClose(), 1200);
        setLoading(false);
        return;
      }

      if (mode === 'single') {
        // Single room creation
        const floorValue = formData.floor 
          ? parseInt(formData.floor, 10) 
          : autoDetectFloor(formData.roomNumber);
        
        await api.post(`/tenants/${user?.tenantId}/rooms`, {
          roomNumber: formData.roomNumber,
          roomType: formData.roomType,
          floor: floorValue,
          maxOccupancy: formData.maxOccupancy,
          ratePlanId: formData.ratePlanId || null,
          categoryId: formData.categoryId || null,
          description: formData.description || null,
          customRate: formData.customRate ? Number(formData.customRate) : null,
        });
        onSuccess();
        toast.success('Room created successfully');
      } else {
        // Bulk room creation
        if (parsedRoomNumbers.length === 0) {
          toast.error('Please enter valid room numbers');
          setLoading(false);
          return;
        }

        const floorValue = formData.floor ? parseInt(formData.floor, 10) : null;
        
        setCreationProgress({ total: parsedRoomNumbers.length, created: 0, failed: 0 });
        
        try {
          const response = await api.post(`/tenants/${user?.tenantId}/rooms/bulk`, {
            roomNumbers: parsedRoomNumbers,
            roomType: formData.roomType,
            floor: floorValue,
            maxOccupancy: formData.maxOccupancy,
            ratePlanId: formData.ratePlanId || null,
            categoryId: formData.categoryId || null,
            description: formData.overrideDescription ? formData.description : null,
            customRate: formData.customRate ? Number(formData.customRate) : null,
          });

          const created = response.data.data?.created || 0;
          setCreationProgress({ total: parsedRoomNumbers.length, created, failed: 0 });
          
          onSuccess();
          toast.success(`Successfully created ${created} room(s)`);
          
          // Close modal after a brief delay
          setTimeout(() => {
            onClose();
          }, 1500);
        } catch (error: any) {
          setCreationProgress(null);
          // Error handled by API interceptor
        }
      }
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div
        className={styles.modalPanel}
        style={{ maxWidth: mode === 'generate' && genMode === 'smart' ? '560px' : '500px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>
          {mode === 'single' ? 'Add New Room' : mode === 'bulk' ? 'Bulk Create Rooms' : 'Generate Rooms'}
        </h2>

        {/* Mode Toggle */}
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.25rem', borderRadius: '6px' }}>
          <button
            type="button"
            onClick={() => {
              setMode('single');
              setFormData(prev => ({ ...prev, roomNumberRange: '', overrideDescription: false }));
            }}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              background: mode === 'single' ? '#3b82f6' : 'transparent',
              color: mode === 'single' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.875rem',
            }}
          >
            Single Room
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('bulk');
              setFormData(prev => ({ ...prev, roomNumber: '', overrideDescription: false }));
            }}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              background: mode === 'bulk' ? '#3b82f6' : 'transparent',
              color: mode === 'bulk' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.875rem',
            }}
          >
            Bulk Create
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('generate');
              setFormData(prev => ({ ...prev, roomNumber: '', roomNumberRange: '', overrideDescription: false }));
            }}
            style={{
              flex: 1,
              padding: '0.5rem 1rem',
              background: mode === 'generate' ? '#3b82f6' : 'transparent',
              color: mode === 'generate' ? 'white' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '0.875rem',
            }}
          >
            Generate
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Room Number Input - Different for each mode */}
            {mode === 'generate' ? (
              <>
                {/* Smart vs manual sub-toggle */}
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.25rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  {(['smart', 'manual'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setGenMode(m)}
                      style={{
                        flex: 1,
                        padding: '0.4rem 0.75rem',
                        background: genMode === m ? '#e0e7ff' : 'transparent',
                        color: genMode === m ? '#3730a3' : '#64748b',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '0.8rem',
                      }}
                    >
                      {m === 'smart' ? '✨ Smart (recommended)' : 'Manual per floor'}
                    </button>
                  ))}
                </div>

                {genMode === 'smart' ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500', fontSize: '0.85rem' }}>
                          Total rooms *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={smartConfig.totalRooms}
                          onChange={(e) => {
                            setSmartConfig({ ...smartConfig, totalRooms: e.target.value });
                            setSmartOverrides({});
                          }}
                          required
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500', fontSize: '0.85rem' }}>
                          Floors *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={smartConfig.floors}
                          onChange={(e) => setSmartConfig({ ...smartConfig, floors: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500', fontSize: '0.85rem' }}>
                          Starting floor *
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={98}
                          value={smartConfig.startFloor}
                          onChange={(e) => setSmartConfig({ ...smartConfig, startFloor: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                    </div>

                    {maxExistingFloor > 0 && maxExistingFloor >= (parseInt(smartConfig.startFloor, 10) || 0) && (
                      <div style={{ padding: '0.5rem 0.75rem', background: '#fffbeb', borderRadius: '6px', fontSize: '0.8rem', color: '#92400e' }}>
                        Existing rooms already occupy floors up to {maxExistingFloor}.{' '}
                        <button
                          type="button"
                          onClick={() => setSmartConfig({ ...smartConfig, startFloor: String(maxExistingFloor + 1) })}
                          style={{ background: 'none', border: 'none', color: '#b45309', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
                        >
                          Start at floor {maxExistingFloor + 1} instead
                        </button>
                      </div>
                    )}

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <label style={{ color: '#475569', fontWeight: '500' }}>
                          Recommended mix {categories.length > 0 ? '(by category)' : '(by type)'}
                        </label>
                        <span style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          {(() => {
                            const mixTotal = Object.values(smartMix).reduce((a, b) => a + b, 0);
                            const target = parseInt(smartConfig.totalRooms, 10) || 0;
                            return mixTotal !== target ? (
                              <span style={{ fontSize: '0.75rem', color: '#b45309' }}>
                                {mixTotal} of {target} rooms
                              </span>
                            ) : null;
                          })()}
                          {(Object.keys(smartOverrides).length > 0 ||
                            Object.keys(smartTypeOverrides).length > 0 ||
                            Object.keys(smartPlanOverrides).length > 0) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSmartOverrides({});
                                setSmartTypeOverrides({});
                                setSmartPlanOverrides({});
                              }}
                              style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.8rem', padding: 0 }}
                            >
                              Reset suggestion
                            </button>
                          )}
                        </span>
                      </div>
                      {categories.length === 0 && (
                        <div style={{ marginBottom: '0.5rem', padding: '0.5rem 0.75rem', background: '#fffbeb', borderRadius: '6px', fontSize: '0.8rem', color: '#92400e' }}>
                          No room categories yet — rooms will be created uncategorized. Run the Setup Wizard first to attach categories and rate plans.
                        </div>
                      )}
                      <div style={{ display: 'grid', gap: '0.4rem' }}>
                        {smartRows.map((row) => {
                          const eff = smartEffective[row.key];
                          return (
                            <div
                              key={row.key}
                              style={{
                                padding: '0.5rem 0.75rem',
                                background: '#f8fafc',
                                borderRadius: '6px',
                                border: '1px solid #e2e8f0',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ flex: 1, fontWeight: '500', color: '#1e293b', fontSize: '0.875rem' }}>
                                  {row.label}
                                </div>
                                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>rooms</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={500}
                                  value={smartMix[row.key] ?? 0}
                                  onChange={(e) =>
                                    setSmartOverrides({
                                      ...smartOverrides,
                                      [row.key]: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    })
                                  }
                                  style={{ width: '64px', padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: '6px', textAlign: 'center' }}
                                />
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.4rem' }}>
                                <select
                                  value={eff.roomType}
                                  onChange={(e) =>
                                    setSmartTypeOverrides({ ...smartTypeOverrides, [row.key]: e.target.value })
                                  }
                                  style={{ padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', color: '#475569', background: 'white' }}
                                >
                                  {(['single', 'double', 'twin', 'deluxe', 'suite'] as const).map((t) => (
                                    <option key={t} value={t}>
                                      {t} · sleeps {TYPE_OCCUPANCY[t]}
                                    </option>
                                  ))}
                                </select>
                                {row.planOptions.length > 1 ? (
                                  <select
                                    value={eff.ratePlanId ?? ''}
                                    onChange={(e) =>
                                      setSmartPlanOverrides({
                                        ...smartPlanOverrides,
                                        [row.key]: e.target.value || null,
                                      })
                                    }
                                    style={{ flex: 1, padding: '0.25rem 0.4rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.75rem', color: '#475569', background: 'white' }}
                                  >
                                    <option value="">No rate plan</option>
                                    {row.planOptions.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                        {p.baseRate != null ? ` · ₦${Number(p.baseRate).toLocaleString()}` : ''}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                    {row.planOptions[0]
                                      ? `${row.planOptions[0].name}${row.planOptions[0].baseRate != null ? ` · ₦${Number(row.planOptions[0].baseRate).toLocaleString()}` : ''}`
                                      : categories.length > 0
                                      ? 'no rate plan linked'
                                      : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={clusterPremium}
                        onChange={(e) => setClusterPremium(e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      Cluster premium rooms on the top floors
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {clusterPremium ? '(standard fill lower floors)' : '(even mix on every floor)'}
                      </span>
                    </label>
                  </>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                          Start floor *
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={genConfig.startFloor}
                          onChange={(e) => setGenConfig({ ...genConfig, startFloor: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                          End floor *
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={genConfig.endFloor}
                          onChange={(e) => setGenConfig({ ...genConfig, endFloor: e.target.value })}
                          required
                          style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                        Rooms per floor by type
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                        {(['single', 'double', 'twin', 'deluxe', 'suite'] as const).map((t) => (
                          <div key={t}>
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'capitalize' }}>
                              {t}
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={genConfig[t]}
                              onChange={(e) => setGenConfig({ ...genConfig, [t]: e.target.value })}
                              style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {genPlan.overflow && (
                  <div style={{ padding: '0.75rem', background: '#fef2f2', borderRadius: '6px', fontSize: '0.875rem', color: '#b91c1c' }}>
                    More than 99 rooms on a floor — increase the number of floors or reduce the totals.
                  </div>
                )}
                {genPlan.total > 0 && (
                  <div style={{ padding: '0.75rem', background: '#f0f9ff', borderRadius: '6px', fontSize: '0.875rem', color: '#0369a1' }}>
                    <strong>{genPlan.total}</strong> rooms across <strong>{genPlan.floors}</strong> floor{genPlan.floors !== 1 ? 's' : ''}
                    <div style={{ marginTop: '0.25rem', color: '#64748b' }}>
                      {genPlan.groups.map((g) => `${g.numbers.length} ${g.label || g.roomType}`).join(' · ')} — numbered floor × 100 + position
                    </div>
                    {genPlan.perFloor.length > 1 && genPlan.perFloor.length <= 20 && (
                      <div style={{ marginTop: '0.25rem', color: '#64748b', fontSize: '0.8rem' }}>
                        {genPlan.perFloor
                          .map((n, i) => `F${(parseInt(genMode === 'smart' ? smartConfig.startFloor : genConfig.startFloor, 10) || 0) + i}:${n}`)
                          .join(' · ')}
                      </div>
                    )}
                    {genPlan.collisions > 0 && (
                      <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.5rem', background: '#fef9c3', borderRadius: '4px', color: '#854d0e', fontSize: '0.8rem' }}>
                        {genPlan.collisions} room number{genPlan.collisions !== 1 ? 's' : ''} already exist and will be skipped — {genPlan.total - genPlan.collisions} new rooms will be created.
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : mode === 'single' ? (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Room Number *
                </label>
                <input
                  type="text"
                  value={formData.roomNumber}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, roomNumber: value });
                    // Auto-detect floor if not set
                    if (!formData.floor && value) {
                      const detectedFloor = autoDetectFloor(value);
                      if (detectedFloor !== null) {
                        setFormData(prev => ({ ...prev, roomNumber: value, floor: String(detectedFloor) }));
                      }
                    }
                  }}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                  placeholder="e.g., 101"
                />
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Room Numbers *
                </label>
                <input
                  type="text"
                  value={formData.roomNumberRange}
                  onChange={(e) => setFormData({ ...formData, roomNumberRange: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                  placeholder="e.g., 100-150 or 101, 102, 105-110"
                />
                {parsedRoomNumbers.length > 0 && (
                  <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: '#f0f9ff', borderRadius: '6px', fontSize: '0.875rem', color: '#0369a1' }}>
                    <strong>{parsedRoomNumbers.length}</strong> room{parsedRoomNumbers.length !== 1 ? 's' : ''} will be created
                    {parsedRoomNumbers.length <= 10 && (
                      <div style={{ marginTop: '0.25rem', color: '#64748b' }}>
                        {parsedRoomNumbers.join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {mode !== 'generate' && (
            <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Room Type *
                </label>
                <select
                  value={formData.roomType}
                  onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                >
                  <option value="single">Single</option>
                  <option value="double">Double</option>
                  <option value="twin">Twin</option>
                  <option value="suite">Suite</option>
                  <option value="deluxe">Deluxe</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Floor
                </label>
                <input
                  type="number"
                  value={formData.floor}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, floor: value === '' ? '' : value });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Max Occupancy *
              </label>
              <input
                type="number"
                value={formData.maxOccupancy}
                onChange={(e) => {
                  const value = e.target.value;
                  const numValue = value === '' ? 1 : parseInt(value, 10);
                  if (!isNaN(numValue) && numValue >= 1) {
                    setFormData({ ...formData, maxOccupancy: numValue });
                  }
                }}
                min="1"
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
            </div>
            </>
            )}

            {!(mode === 'generate' && genMode === 'smart') && (
            <>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
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
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Rate Plan
              </label>
              <select
                value={formData.ratePlanId}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData((prev) => ({
                    ...prev,
                    ratePlanId: value,
                    customRate: prev.customRate || value === '' ? prev.customRate : '',
                  }));
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="">No Rate Plan</option>
                {ratePlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} {plan.baseRate ? `• ₦${plan.baseRate.toLocaleString()}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#475569', fontWeight: '500' }}>Custom Rate (optional)</label>
                {formData.ratePlanId && (
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Overrides {ratePlans.find((plan) => plan.id === formData.ratePlanId)?.name || 'selected plan'}
                  </span>
                )}
              </div>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.customRate}
                onChange={(e) => setFormData({ ...formData, customRate: e.target.value })}
                placeholder="Enter a custom rate (e.g., 45000)"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
              {formData.customRate && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.85rem', color: '#0f172a' }}>
                  Effective rate will be ₦{Number(formData.customRate).toLocaleString()}
                </div>
              )}
            </div>
            </>
            )}

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ color: '#475569', fontWeight: '500' }}>
                  Description
                </label>
                {!!formData.categoryId && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#64748b', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.overrideDescription}
                      onChange={(e) => setFormData({ ...formData, overrideDescription: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    Override category description
                  </label>
                )}
              </div>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value, overrideDescription: true })}
                disabled={!!formData.categoryId && !formData.overrideDescription}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  background: !!formData.categoryId && !formData.overrideDescription ? '#f8fafc' : 'white',
                  color: !!formData.categoryId && !formData.overrideDescription ? '#94a3b8' : '#1e293b',
                }}
                  placeholder={
                  !!formData.categoryId && !formData.overrideDescription
                    ? 'Description will be inherited from category'
                    : 'Room description, features, or notes...'
                }
              />
              {!!formData.categoryId && !formData.overrideDescription && (
                <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                  Using description from category
                </div>
              )}
            </div>

            {/* Progress indicator for bulk creation */}
            {creationProgress && (
              <div style={{ padding: '1rem', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  <span style={{ color: '#0369a1', fontWeight: '500' }}>Creating rooms...</span>
                  <span style={{ color: '#64748b' }}>
                    {creationProgress.created} / {creationProgress.total}
                  </span>
                </div>
                <div style={{ width: '100%', height: '8px', background: '#e0f2fe', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${(creationProgress.created / creationProgress.total) * 100}%`,
                      height: '100%',
                      background: '#3b82f6',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || (mode === 'bulk' && parsedRoomNumbers.length === 0) || (mode === 'generate' && (genPlan.total === 0 || genPlan.overflow))}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading || (mode === 'bulk' && parsedRoomNumbers.length === 0) || (mode === 'generate' && (genPlan.total === 0 || genPlan.overflow)) ? 'not-allowed' : 'pointer',
                  opacity: loading || (mode === 'bulk' && parsedRoomNumbers.length === 0) || (mode === 'generate' && (genPlan.total === 0 || genPlan.overflow)) ? 0.6 : 1,
                }}
              >
                {loading
                  ? 'Creating...'
                  : mode === 'single'
                  ? 'Create Room'
                  : mode === 'generate'
                  ? `Generate ${genPlan.total} Room${genPlan.total !== 1 ? 's' : ''}`
                  : `Create ${parsedRoomNumbers.length || 0} Room${parsedRoomNumbers.length !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditRoomRateModal({ room, categories, ratePlans, onClose, onSuccess }: EditRoomModalProps) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    ratePlanId: room.ratePlanId || room.ratePlan?.id || '',
    customRate: room.customRate ? String(room.customRate) : '',
  });
  const [loading, setLoading] = useState(false);
  const selectedPlan = ratePlans.find((plan) => plan.id === formData.ratePlanId);
  const category = room.categoryId
    ? categories.find((cat) => cat.id === room.categoryId)
    : null;
  const effectiveRate =
    formData.customRate !== ''
      ? Number(formData.customRate)
      : selectedPlan?.baseRate ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch(`/tenants/${user?.tenantId}/rooms/${room.id}`, {
        ratePlanId: formData.ratePlanId || null,
        customRate: formData.customRate ? Number(formData.customRate) : null,
      });
      toast.success('Room rate updated');
      onSuccess();
    } catch (error: any) {
      // handled globally
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div
        className={styles.modalPanel}
        style={{ maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Edit Room Rate</h2>
        <p style={{ margin: 0, color: '#64748b' }}>
          Room {room.roomNumber} • {room.roomType}
        </p>
        {category && (
          <p style={{ marginTop: '0.25rem', color: '#94a3b8', fontSize: '0.85rem' }}>
            Category: {category.name}
          </p>
        )}

        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
              Rate Plan
            </label>
            <select
              value={formData.ratePlanId}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  ratePlanId: e.target.value,
                  customRate: prev.customRate,
                }))
              }
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            >
              <option value="">No Rate Plan</option>
              {ratePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} {plan.baseRate ? `• ₦${plan.baseRate.toLocaleString()}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ color: '#475569', fontWeight: '500' }}>Custom Rate (optional)</label>
              {selectedPlan?.baseRate !== undefined && selectedPlan?.baseRate !== null && (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  Plan base ₦{Number(selectedPlan.baseRate).toLocaleString()}
                </span>
              )}
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.customRate}
              onChange={(e) => setFormData({ ...formData, customRate: e.target.value })}
              placeholder="Leave blank to use plan rate"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
              }}
            />
            {formData.customRate && (
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, customRate: '' }))}
                style={{
                  marginTop: '0.5rem',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                Remove custom rate
              </button>
            )}
          </div>

          <div
            style={{
              marginTop: '0.5rem',
              padding: '0.75rem',
              borderRadius: '6px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              fontSize: '0.9rem',
              color: '#0f172a',
            }}
          >
            <strong>Effective nightly rate:</strong>{' '}
            {effectiveRate !== null ? `₦${Number(effectiveRate).toLocaleString()}` : 'Not set'}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '0.65rem 1.25rem',
                background: '#f1f5f9',
                color: '#475569',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.65rem 1.25rem',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CategoryManagementModal({
  categories,
  editingCategory,
  setEditingCategory,
  onClose,
  onSuccess,
  onDelete,
}: {
  categories: RoomCategory[];
  editingCategory: RoomCategory | null;
  setEditingCategory: (category: RoomCategory | null) => void;
  onClose: () => void;
  onSuccess: () => void;
  onDelete: (id: string) => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    totalRooms: '',
    color: '#8b5cf6',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      // Only update form data if we're switching to a different category or starting fresh
      // Don't reset if we're already editing this category (to prevent losing user input while typing)
      setFormData((prev) => {
        // Only update if the category ID changed or if form is empty
        if (prev.name === '' || prev.name !== editingCategory.name) {
          return {
            name: editingCategory.name,
            description: editingCategory.description || '',
            totalRooms: editingCategory.totalRooms?.toString() || '',
            color: editingCategory.color || '#8b5cf6',
          };
        }
        return prev;
      });
    } else {
      // Only clear if we're not currently editing
      setFormData((prev) => {
        if (prev.name !== '') {
          return prev; // Keep current form data
        }
        return {
          name: '',
          description: '',
          totalRooms: '',
          color: '#8b5cf6',
        };
      });
    }
  }, [editingCategory?.id]); // Only depend on the ID, not the whole object

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        name: formData.name,
        description: formData.description || null,
        color: formData.color || '#8b5cf6',
      };
      if (formData.totalRooms) {
        payload.totalRooms = parseInt(formData.totalRooms, 10);
      }

      if (editingCategory) {
        const response = await api.patch(`/tenants/${user?.tenantId}/room-categories/${editingCategory.id}`, payload);
        toast.success('Category updated successfully');
        // Update editingCategory with fresh data from response
        if (response.data?.data) {
          setEditingCategory(response.data.data);
        }
        // Refetch categories to update the list
        onSuccess();
      } else {
        await api.post(`/tenants/${user?.tenantId}/room-categories`, payload);
        toast.success('Category created successfully');
        // Clear form and refetch categories
        setFormData({ name: '', description: '', totalRooms: '', color: '#8b5cf6' });
        setEditingCategory(null);
        onSuccess();
      }
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div
        className={styles.modalPanel}
        style={{ maxWidth: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, color: '#1e293b' }}>
            {editingCategory ? 'Edit Category' : 'Manage Room Categories'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.5rem',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Form Section */}
          <div>
            <h3 style={{ marginBottom: '1rem', color: '#475569', fontSize: '1rem', fontWeight: '600' }}>
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                    }}
                    placeholder="e.g., Standard, Premium, Deluxe"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                    }}
                    placeholder="Category description..."
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                    Total Rooms (Optional)
                  </label>
                  <input
                    type="number"
                    value={formData.totalRooms}
                    onChange={(e) => setFormData({ ...formData, totalRooms: e.target.value })}
                    min="0"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                    }}
                    placeholder="Expected number of rooms in this category"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                    Category Color
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      style={{
                        width: '60px',
                        height: '40px',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      pattern="^#[0-9A-Fa-f]{6}$"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                      }}
                      placeholder="#8b5cf6"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      flex: 1,
                      padding: '0.75rem 1.5rem',
                      background: '#8b5cf6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      opacity: loading ? 0.6 : 1,
                      fontWeight: '500',
                    }}
                  >
                    {loading ? 'Saving...' : editingCategory ? 'Update Category' : 'Create Category'}
                  </button>
                  {editingCategory && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ name: '', description: '', totalRooms: '', color: '#8b5cf6' });
                        setEditingCategory(null);
                        onSuccess();
                      }}
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#f1f5f9',
                        color: '#475569',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Categories List */}
          <div>
            <h3 style={{ marginBottom: '1rem', color: '#475569', fontSize: '1rem', fontWeight: '600' }}>
              Existing Categories ({categories.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '400px', overflow: 'auto' }}>
              {categories.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
                  No categories yet. Create your first category!
                </p>
              ) : (
                categories.map((category) => (
                  <div
                    key={category.id}
                    style={{
                      background: '#f8fafc',
                      padding: '1rem',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '4px',
                              background: category.color || '#8b5cf6',
                              border: '1px solid rgba(0,0,0,0.1)',
                            }}
                          />
                          <h4 style={{ margin: 0, color: '#1e293b', fontSize: '0.875rem', fontWeight: '600' }}>
                            {category.name}
                          </h4>
                        </div>
                        {category.description && (
                          <p style={{ margin: '0.25rem 0', color: '#64748b', fontSize: '0.75rem' }}>
                            {category.description}
                          </p>
                        )}
                        <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
                          <div>
                            <span style={{ fontWeight: '500' }}>{category.actualRoomCount}</span> room
                            {category.actualRoomCount !== 1 ? 's' : ''} assigned
                            {category.totalRooms && (
                              <span>
                                {' '}
                                / {category.totalRooms} total
                              </span>
                            )}
                          </div>
                          {category.minPrice !== null && category.minPrice !== undefined && (
                            <div style={{ marginTop: '0.25rem', fontWeight: '600', color: '#3b82f6' }}>
                              {category.minPrice === category.maxPrice ? (
                                <>₦{category.minPrice.toLocaleString()}</>
                              ) : (
                                <>
                                  ₦{category.minPrice.toLocaleString()} - ₦{category.maxPrice?.toLocaleString()}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <button
                          onClick={() => {
                            setEditingCategory(category);
                            setFormData({
                              name: category.name,
                              description: category.description || '',
                              totalRooms: category.totalRooms?.toString() || '',
                              color: category.color || '#8b5cf6',
                            });
                          }}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                          }}
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => onDelete(category.id)}
                          disabled={category.actualRoomCount > 0}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: category.actualRoomCount > 0 ? 'not-allowed' : 'pointer',
                            color: category.actualRoomCount > 0 ? '#cbd5e1' : '#ef4444',
                            opacity: category.actualRoomCount > 0 ? 0.5 : 1,
                          }}
                          title={category.actualRoomCount > 0 ? 'Cannot delete: has rooms assigned' : 'Delete'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RoomActivityModal({
  room,
  logs,
  pagination,
  loading,
  onClose,
  onPageChange,
}: {
  room: Room;
  logs: RoomLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  loading: boolean;
  onClose: () => void;
  onPageChange: (page: number) => void;
}) {
  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
    >
      <div
        className={styles.modalPanel}
        style={{ maxWidth: '700px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0, color: '#1e293b' }}>Room {room.roomNumber} Activity</h2>
            <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Latest actions and updates logged for this room.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              color: '#475569',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>Loading activity...</div>
          ) : logs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8' }}>No activity logs yet for this room.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    borderLeft: '3px solid #3b82f6',
                    paddingLeft: '1rem',
                    paddingRight: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        fontWeight: '600',
                        color: '#3b82f6',
                      }}
                    >
                      {log.type.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p style={{ margin: '0.25rem 0', color: '#1e293b', fontWeight: '500' }}>{log.summary}</p>
                  {log.details && (
                    <p style={{ margin: 0, color: '#64748b', fontSize: '0.875rem' }}>{log.details}</p>
                  )}
                  {log.metadata && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {Object.entries(log.metadata).map(([key, value]) => (
                        <span
                          key={key}
                          style={{
                            background: '#f1f5f9',
                            borderRadius: '999px',
                            padding: '0.25rem 0.75rem',
                            fontSize: '0.75rem',
                            color: '#475569',
                          }}
                        >
                          {key}: {String(value)}
                        </span>
                      ))}
                    </div>
                  )}
                  {log.user?.name && (
                    <p style={{ margin: '0.5rem 0 0 0', color: '#94a3b8', fontSize: '0.75rem' }}>
                      Logged by {log.user.name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {logs.length > 0 && pagination.totalPages > 1 && (
          <div style={{ marginTop: '1rem' }}>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function EditRoomModal({
  room,
  onClose,
  onSuccess,
}: {
  room: Room;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    roomNumber: room.roomNumber,
    roomType: room.roomType,
    floor: room.floor != null ? String(room.floor) : '',
    maxOccupancy: String(room.maxOccupancy),
    description: room.description || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.roomNumber.trim()) {
      toast.error('Room number is required');
      return;
    }
    setLoading(true);
    try {
      await api.patch(`/tenants/${user?.tenantId}/rooms/${room.id}`, {
        roomNumber: formData.roomNumber.trim(),
        roomType: formData.roomType,
        floor: formData.floor === '' ? null : Number(formData.floor),
        maxOccupancy: Number(formData.maxOccupancy),
        description: formData.description || null,
      });
      toast.success(`Room ${formData.roomNumber} updated`);
      onSuccess();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to update room');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalPanel} style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ marginBottom: '0.5rem', color: 'var(--text)' }}>Edit Room {room.roomNumber}</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--muted)', fontWeight: '500' }}>
              Room Number
            </label>
            <TextInput
              value={formData.roomNumber}
              onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--muted)', fontWeight: '500' }}>
              Room Type
            </label>
            <Select value={formData.roomType} onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}>
              <option value="single">Single</option>
              <option value="double">Double</option>
              <option value="twin">Twin</option>
              <option value="suite">Suite</option>
              <option value="deluxe">Deluxe</option>
            </Select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--muted)', fontWeight: '500' }}>
                Floor
              </label>
              <TextInput
                type="number"
                value={formData.floor}
                onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--muted)', fontWeight: '500' }}>
                Max Occupancy
              </label>
              <TextInput
                type="number"
                min={1}
                value={formData.maxOccupancy}
                onChange={(e) => setFormData({ ...formData, maxOccupancy: e.target.value })}
                required
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--muted)', fontWeight: '500' }}>
              Description
            </label>
            <TextInput
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <RoomIcalSection room={room} />
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading}>
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface IcalFeed {
  id: string;
  roomId: string;
  name: string | null;
  importUrl: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  lastSummary: string | null;
  isActive: boolean;
}

function RoomIcalSection({ room }: { room: Room }) {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [feeds, setFeeds] = useState<IcalFeed[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const exportUrl = room.icalToken
    ? `${window.location.origin}/api/public/ical/rooms/${room.icalToken}.ics`
    : null;

  const load = async () => {
    if (!user?.tenantId) return;
    setLoadingFeeds(true);
    try {
      const res = await api.get(`/tenants/${user.tenantId}/ical-feeds`, {
        params: { roomId: room.id },
      });
      setFeeds(res.data.data?.feeds || []);
    } catch {
      // surfaced via toast only on actions; list stays empty
    } finally {
      setLoadingFeeds(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, room.id]);

  const addFeed = async () => {
    if (!newUrl.trim()) {
      toast.error('Paste the external calendar URL first');
      return;
    }
    setAdding(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/ical-feeds`, {
        roomId: room.id,
        name: newName.trim() || null,
        importUrl: newUrl.trim(),
      });
      setNewName('');
      setNewUrl('');
      toast.success('Calendar feed added — it will sync within 15 minutes');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to add feed');
    } finally {
      setAdding(false);
    }
  };

  const removeFeed = async (feedId: string) => {
    try {
      await api.delete(`/tenants/${user?.tenantId}/ical-feeds/${feedId}`);
      toast.success('Feed removed — imported blocks were cancelled');
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to remove feed');
    }
  };

  const syncNow = async (feedId: string) => {
    setSyncing(feedId);
    try {
      const res = await api.post(`/tenants/${user?.tenantId}/ical-feeds/${feedId}/sync`);
      const r = res.data.data?.result;
      toast.success(`Synced: ${r?.imported ?? 0} imported, ${r?.cancelled ?? 0} cancelled`);
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  const copyExport = async () => {
    if (!exportUrl) return;
    try {
      await navigator.clipboard.writeText(exportUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — copy the URL manually');
    }
  };

  return (
    <div style={{ borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: '0.75rem' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--muted)',
          fontWeight: 600,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
        }}
      >
        <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▸</span>
        Calendar sync (iCal)
      </button>

      {open && (
        <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
              Export URL — paste this into Airbnb / Booking.com to publish InnSight availability
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                readOnly
                value={exportUrl || 'Token pending — save the room first'}
                onFocus={(e) => e.target.select()}
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  color: '#475569',
                  background: '#f8fafc',
                }}
              />
              <Button type="button" variant="secondary" onClick={copyExport} disabled={!exportUrl}>
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.35rem' }}>
              Import feeds — external calendars pull in as blocked reservations
            </div>
            {loadingFeeds ? (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Loading feeds…</div>
            ) : feeds.length === 0 ? (
              <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No import feeds configured.</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {feeds.map((feed) => (
                  <div
                    key={feed.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.6rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{feed.name || 'External calendar'}</div>
                      {feed.lastError ? (
                        <div style={{ color: '#b91c1c' }}>{feed.lastError}</div>
                      ) : (
                        <div style={{ color: '#64748b' }}>
                          {feed.lastSyncedAt
                            ? `Synced ${new Date(feed.lastSyncedAt).toLocaleString()}${feed.lastSummary ? ` — ${feed.lastSummary}` : ''}`
                            : 'Not synced yet'}
                        </div>
                      )}
                    </div>
                    {feed.importUrl && (
                      <button
                        type="button"
                        onClick={() => syncNow(feed.id)}
                        disabled={syncing === feed.id}
                        style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '0.78rem', padding: 0, whiteSpace: 'nowrap' }}
                      >
                        {syncing === feed.id ? 'Syncing…' : 'Sync now'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeFeed(feed.id)}
                      style={{ background: 'none', border: 'none', color: '#b91c1c', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input
                placeholder="Name (e.g. Airbnb)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
              />
              <input
                placeholder="https://…/calendar.ics"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                style={{ padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.8rem' }}
              />
              <Button type="button" variant="secondary" onClick={addFeed} loading={adding}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
