import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, DoorOpen, Tag, X, Edit, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';

interface RoomCategory {
  id: string;
  name: string;
  description?: string;
  totalRooms?: number;
  actualRoomCount: number;
  color?: string;
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
  lastLogType?: string | null;
  lastLogSummary?: string | null;
  lastLogUserName?: string | null;
  lastLogAt?: string | Date | null;
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<RoomCategory | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
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
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [latestReport, setLatestReport] = useState<any>(null);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchRooms(1, pagination.limit);
  }, [user, selectedCategoryFilter, selectedFloorFilter]);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchCategories();
  }, [user]);

  const fetchRooms = async (page = 1, limit = pagination.limit) => {
    setLoading(true);
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/rooms`, {
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
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchLatestReport();
  }, [user?.tenantId]);

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
  });

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

  const statusLabels: Record<string, string> = {
    dirty: 'Dirty',
    maintenance: 'Maintenance',
    inspected: 'Inspected',
    clean: 'Clean',
    available: 'Available',
    reserved: 'Reserved',
    occupied: 'Occupied',
    out_of_order: 'Out of Order',
  };

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

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
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
          <select
            value={selectedRoomTypeFilter}
            onChange={(e) => setSelectedRoomTypeFilter(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              minWidth: '150px',
            }}
          >
            <option value="">All Room Types</option>
            {roomTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            style={{
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer',
              minWidth: '150px',
            }}
          >
            <option value="">All Statuses</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={selectedFloorFilter}
            onChange={(e) => setSelectedFloorFilter(e.target.value)}
            placeholder="Floor"
            style={{
              padding: '0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '0.875rem',
              minWidth: '120px',
            }}
          />
          {(searchTerm || selectedCategoryFilter || selectedFloorFilter || selectedRoomTypeFilter || selectedStatusFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategoryFilter('');
                setSelectedFloorFilter('');
                setSelectedRoomTypeFilter('');
                setSelectedStatusFilter('');
              }}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                background: '#f8fafc',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
        {activeFilters.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {activeFilters.map((filter) => (
              <span
                key={filter.key}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '999px',
                  background: '#eef2ff',
                  color: '#312e81',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                {filter.label}
                <button
                  onClick={() => clearFilter(filter.key)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    color: '#312e81',
                    padding: 0,
                  }}
                  aria-label={`Clear ${filter.label} filter`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {rooms.length > 0 && (
          <section
            style={{
              marginBottom: '1.5rem',
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>Room accountability snapshot</h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#475569', fontSize: '0.85rem' }}>
                  Rooms with stale logs, flagged statuses, and missing accountability details.
                </p>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ padding: '1rem', borderRadius: '8px', background: '#fdf2f8', border: '1px solid #f5d0fe' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#be185d' }}>{accountabilityMetrics.staleCount}</div>
                <div style={{ fontSize: '0.85rem', color: '#6b21a8' }}>Rooms with no log in 6h</div>
              </div>
              <div style={{ padding: '1rem', borderRadius: '8px', background: '#eef2ff', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1d4ed8' }}>{accountabilityMetrics.flaggedCount}</div>
                <div style={{ fontSize: '0.85rem', color: '#1e3a8a' }}>Rooms flagged dirty/reserved/maintenance</div>
              </div>
              <div style={{ padding: '1rem', borderRadius: '8px', background: '#ecfccb', border: '1px solid #bef264' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: '#15803d' }}>{accountabilityMetrics.noLogCount}</div>
                <div style={{ fontSize: '0.85rem', color: '#166534' }}>Rooms never logged</div>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0 0 0.75rem 0', color: '#0f172a', fontSize: '1rem', fontWeight: '600' }}>Most overdue rooms</h3>
              {accountabilityMetrics.staleRoomsList.length === 0 ? (
                <p style={{ margin: 0, color: '#475569', fontSize: '0.85rem' }}>All rooms have fresh logs.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#475569' }}>Room</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#475569' }}>Status</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#475569' }}>Last action</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb', fontSize: '0.75rem', color: '#475569' }}>Responsible</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem 0', borderBottom: '1px solid #e5e7eb' }} />
                      </tr>
                    </thead>
                    <tbody>
                      {accountabilityMetrics.staleRoomsList.map((room) => (
                        <tr key={room.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem 0' }}>
                            <strong>Room {room.roomNumber}</strong>
                            <div style={{ fontSize: '0.75rem', color: '#475569' }}>
                              Last logged {formatTimeAgo(room.parsedLastLogAt)}
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem 0' }}>
                            <span
                              style={{
                                padding: '0.25rem 0.5rem',
                                borderRadius: '999px',
                                background: `${getStatusColor(room.status)}20`,
                                color: getStatusColor(room.status),
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {room.status.replace('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0', color: '#475569', fontSize: '0.85rem' }}>
                            {room.lastLogSummary || 'No log yet'}
                          </td>
                          <td style={{ padding: '0.5rem 0', color: '#475569', fontSize: '0.85rem' }}>
                            {room.lastLogUserName || 'Unassigned'}
                          </td>
                          <td style={{ padding: '0.5rem 0', textAlign: 'right' }}>
                            <button
                              onClick={() => handleViewActivity(room)}
                              style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                              }}
                            >
                              View history
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {latestReport && (
          <section
            style={{
              marginBottom: '1.5rem',
              background: '#0f172a',
              borderRadius: '12px',
              color: 'white',
              padding: '1rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>Latest accountability snapshot</h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#cbd5f5' }}>
                  Generated on {new Date(latestReport.lastReportAt?.seconds ? latestReport.lastReportAt.seconds * 1000 : latestReport.lastReportAt)?.toLocaleString() || 'unknown'}
                </p>
              </div>
              <span style={{ fontSize: '0.8rem', color: '#cbd5f5' }}>
                Generated by {latestReport.generatedBy || 'system'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
              <div>
                <strong style={{ fontSize: '1.1rem' }}>{latestReport.staleCount}</strong>
                <p style={{ margin: '0.15rem 0 0 0', color: '#cbd5f5', fontSize: '0.85rem' }}>Rooms without a recent log</p>
              </div>
              <div>
                <strong style={{ fontSize: '1.1rem' }}>{latestReport.flaggedCount}</strong>
                <p style={{ margin: '0.15rem 0 0 0', color: '#cbd5f5', fontSize: '0.85rem' }}>Rooms flagged dirty/reserved/maintenance</p>
              </div>
              <div>
                <strong style={{ fontSize: '1.1rem' }}>{latestReport.noLogCount}</strong>
                <p style={{ margin: '0.15rem 0 0 0', color: '#cbd5f5', fontSize: '0.85rem' }}>Rooms lacking any logs</p>
              </div>
            </div>
          </section>
        )}

        {rooms.length > 0 && (
          <section
            style={{
              marginBottom: '1.5rem',
              background: 'white',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>Status board</h2>
                <p style={{ margin: '0.25rem 0 0 0', color: '#475569', fontSize: '0.85rem' }}>
                  Rooms organized by current status. Quick actions let staff move rooms through the workflow.
                </p>
              </div>
              <span style={{ color: '#475569', fontSize: '0.85rem' }}>Role: {user?.role || 'Unknown'}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {boardStatuses.map((status) => (
                <div key={status} style={{ borderRadius: '8px', border: '1px solid #e5e7eb', padding: '0.75rem', background: '#f8fafc' }}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#0f172a' }}>{statusLabels[status]}</h3>
                  <p style={{ margin: '0.35rem 0 0 0', color: '#475569', fontSize: '0.75rem' }}>
                    {roomsByStatus[status]?.length || 0} room{roomsByStatus[status]?.length === 1 ? '' : 's'}
                  </p>
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {(roomsByStatus[status] ?? []).slice(0, 4).map((room) => (
                      <div
                        key={room.id}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '6px',
                          border: '1px solid rgba(126, 145, 191, 0.3)',
                          background: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <strong style={{ color: '#1e293b' }}>Room {room.roomNumber}</strong>
                          <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                            {formatTimeAgo(room.lastLogAt ? new Date(room.lastLogAt) : undefined)}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                          {room.lastLogSummary || 'No log entry yet'}
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#475569' }}>
                            {room.lastLogUserName || 'Unassigned'}
                          </span>
                          <button
                            onClick={() => handleViewActivity(room)}
                            style={{
                              marginLeft: 'auto',
                              border: 'none',
                              background: 'transparent',
                              color: '#1d4ed8',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                            }}
                          >
                            History
                          </button>
                        </div>
                        {canActOnBoard && quickStatusNext[room.status] && (
                          <button
                            onClick={() => handleBoardStatusChange(room, quickStatusNext[room.status])}
                            style={{
                              marginTop: '0.25rem',
                              padding: '0.35rem 0.65rem',
                              borderRadius: '4px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            Mark as {statusLabels[quickStatusNext[room.status]] || quickStatusNext[room.status]}
                          </button>
                        )}
                      </div>
                    ))}
                    {(roomsByStatus[status] ?? []).length > 4 && (
                      <span style={{ fontSize: '0.7rem', color: '#475569' }}>
                        +{(roomsByStatus[status] ?? []).length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                          <span style={{ color: categoryColor, fontWeight: '500' }}>
                            {room.category.name}
                          </span>
                        </span>
                      );
                    })()}
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
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => handleViewActivity(room)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    background: 'white',
                    color: '#3b82f6',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  View Activity
                </button>
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
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
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
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setCreationProgress(null);

    try {
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
        <h2 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>
          {mode === 'single' ? 'Add New Room' : 'Bulk Create Rooms'}
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
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {/* Room Number Input - Different for each mode */}
            {mode === 'single' ? (
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
                disabled={loading || (mode === 'bulk' && parsedRoomNumbers.length === 0)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading || (mode === 'bulk' && parsedRoomNumbers.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: loading || (mode === 'bulk' && parsedRoomNumbers.length === 0) ? 0.6 : 1,
                }}
              >
                {loading
                  ? 'Creating...'
                  : mode === 'single'
                  ? 'Create Room'
                  : `Create ${parsedRoomNumbers.length || 0} Room${parsedRoomNumbers.length !== 1 ? 's' : ''}`}
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
        setFormData({ name: '', description: '', totalRooms: '' });
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
          padding: '1.5rem',
          width: '90%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
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
