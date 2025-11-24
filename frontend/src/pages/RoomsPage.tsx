import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, DoorOpen, Tag, X, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';

interface RoomCategory {
  id: string;
  name: string;
  description?: string;
  totalRooms?: number;
  actualRoomCount: number;
}

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  status: string;
  maxOccupancy: number;
  description?: string;
  categoryId?: string;
  category?: {
    id: string;
    name: string;
  };
  ratePlan?: {
    name: string;
    baseRate: number;
  };
}

export default function RoomsPage() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RoomCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchRooms();
    fetchCategories();
  }, [user]);

  const fetchRooms = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`);
      setRooms(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/room-categories`);
      setCategories(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
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
    fetchRooms();

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

  const filteredRooms = rooms.filter((room) => {
    // Filter by search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        room.roomNumber.toLowerCase().includes(searchLower) ||
        room.roomType.toLowerCase().includes(searchLower) ||
        room.status.toLowerCase().includes(searchLower) ||
        room.description?.toLowerCase().includes(searchLower) ||
        room.category?.name.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Filter by category
    if (selectedCategoryFilter) {
      if (selectedCategoryFilter === 'none') {
        if (room.categoryId) return false;
      } else {
        if (room.categoryId !== selectedCategoryFilter) return false;
      }
    }

    return true;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      available: '#10b981',
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
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Rooms</h1>
          <CardSkeleton count={6} />
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
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1e293b' }}>Rooms</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => {
                setEditingCategory(null);
                setShowCategoryModal(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: '#8b5cf6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '500',
              }}
            >
              <Tag size={20} />
              Manage Categories
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
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
              Add Room
            </button>
          </div>
        </div>

        {selectedRooms.size > 0 && (
          <div
            style={{
              background: '#dbeafe',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#1e40af', fontWeight: '500' }}>
              {selectedRooms.size} room{selectedRooms.size !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleBulkStatusUpdate(e.target.value);
                    e.target.value = '';
                  }
                }}
                disabled={isBulkProcessing}
                style={{
                  padding: '0.5rem 1rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  cursor: isBulkProcessing ? 'not-allowed' : 'pointer',
                }}
              >
                <option value="">Update Status To...</option>
                <option value="available">Available</option>
                <option value="clean">Clean</option>
                <option value="dirty">Dirty</option>
                <option value="inspected">Inspected</option>
                <option value="out_of_order">Out of Order</option>
                <option value="maintenance">Maintenance</option>
              </select>
              <button
                onClick={() => setSelectedRooms(new Set())}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by room number, type, status, or description..."
            />
          </div>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              minWidth: '200px',
            }}
          >
            <option value="">All Categories</option>
            <option value="none">No Category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.actualRoomCount})
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={selectedRooms.size === filteredRooms.length && filteredRooms.length > 0}
            onChange={toggleSelectAll}
            style={{ cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            Select All ({filteredRooms.length} rooms)
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                borderLeft: `4px solid ${getStatusColor(room.status)}`,
                border: selectedRooms.has(room.id) ? `2px solid #3b82f6` : undefined,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  checked={selectedRooms.has(room.id)}
                  onChange={() => toggleSelectRoom(room.id)}
                  style={{ cursor: 'pointer', marginTop: '0.25rem' }}
                />
                <div style={{ flex: 1, marginLeft: '0.5rem' }}>
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: 'bold' }}>
                    Room {room.roomNumber}
                  </h3>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                    {room.roomType} • Floor {room.floor}
                    {room.category && (
                      <span style={{ marginLeft: '0.5rem', color: '#8b5cf6', fontWeight: '500' }}>
                        • {room.category.name}
                      </span>
                    )}
                  </p>
                  {room.description && (
                    <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.875rem', fontStyle: 'italic' }}>
                      {room.description}
                    </p>
                  )}
                </div>
                <div
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    background: `${getStatusColor(room.status)}20`,
                    color: getStatusColor(room.status),
                  }}
                >
                  {room.status.replace('_', ' ').toUpperCase()}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Max Occupancy</span>
                  <span style={{ fontWeight: '500', color: '#1e293b' }}>{room.maxOccupancy} guests</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Rate Plan</span>
                  <span style={{ fontWeight: '500', color: '#1e293b' }}>{room.ratePlan?.name || 'N/A'}</span>
                </div>
                {room.ratePlan?.baseRate && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Base Rate</span>
                    <span style={{ fontWeight: '500', color: '#1e293b' }}>
                      ₦{Number(room.ratePlan.baseRate).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {filteredRooms.length === 0 && (
          <div
            style={{
              background: 'white',
              padding: '3rem',
              borderRadius: '8px',
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            <DoorOpen size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No rooms found. Create your first room to get started.</p>
          </div>
        )}

        {showCreateModal && (
          <CreateRoomModal
            categories={categories}
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchRooms();
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
      </div>
    </Layout>
  );
}

function CreateRoomModal({
  categories,
  onClose,
  onSuccess,
}: {
  categories: RoomCategory[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    roomNumber: '',
    roomType: 'single',
    floor: '',
    maxOccupancy: 1,
    ratePlanId: '',
    categoryId: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/tenants/${user?.tenantId}/rooms`, {
        ...formData,
        floor: formData.floor ? parseInt(formData.floor) : null,
        ratePlanId: formData.ratePlanId || null,
        categoryId: formData.categoryId || null,
        description: formData.description || null,
      });
      onSuccess();
      toast.success('Room created successfully');
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
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
      onClick={onClose}
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
        <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Add New Room</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Room Number *
              </label>
              <input
                type="text"
                value={formData.roomNumber}
                onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
            </div>

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
                placeholder="Room description, features, or notes..."
              />
            </div>

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
                disabled={loading}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
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
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingCategory) {
      setFormData({
        name: editingCategory.name,
        description: editingCategory.description || '',
        totalRooms: editingCategory.totalRooms?.toString() || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        totalRooms: '',
      });
    }
  }, [editingCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        name: formData.name,
        description: formData.description || null,
      };
      if (formData.totalRooms) {
        payload.totalRooms = parseInt(formData.totalRooms, 10);
      }

      if (editingCategory) {
        await api.patch(`/tenants/${user?.tenantId}/room-categories/${editingCategory.id}`, payload);
        toast.success('Category updated successfully');
      } else {
        await api.post(`/tenants/${user?.tenantId}/room-categories`, payload);
        toast.success('Category created successfully');
      }
      onSuccess();
      setFormData({ name: '', description: '', totalRooms: '' });
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

  return (
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
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
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
                        setFormData({ name: '', description: '', totalRooms: '' });
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
                          <Tag size={16} style={{ color: '#8b5cf6' }} />
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
                          <span style={{ fontWeight: '500' }}>{category.actualRoomCount}</span> room
                          {category.actualRoomCount !== 1 ? 's' : ''} assigned
                          {category.totalRooms && (
                            <span>
                              {' '}
                              / {category.totalRooms} total
                            </span>
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
