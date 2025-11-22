import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, DoorOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';

interface Room {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  status: string;
  maxOccupancy: number;
  ratePlan: {
    name: string;
    baseRate: number;
  };
}

export default function RoomsPage() {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchRooms();
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
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      room.roomNumber.toLowerCase().includes(searchLower) ||
      room.roomType.toLowerCase().includes(searchLower) ||
      room.status.toLowerCase().includes(searchLower)
    );
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

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1e293b' }}>Rooms</h1>
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

        <div style={{ marginBottom: '1.5rem' }}>
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by room number, type, or status..."
          />
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
                  </p>
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
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              fetchRooms();
            }}
          />
        )}
      </div>
    </Layout>
  );
}

function CreateRoomModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    roomNumber: '',
    roomType: 'single',
    floor: '',
    maxOccupancy: 1,
    ratePlanId: '',
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // In a real app, fetch rate plans from API
    // For now, we'll create without rate plan
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/tenants/${user?.tenantId}/rooms`, {
        ...formData,
        floor: formData.floor ? parseInt(formData.floor) : null,
        ratePlanId: formData.ratePlanId || null,
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
                  onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, maxOccupancy: parseInt(e.target.value) })}
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
