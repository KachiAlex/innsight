<template>
  <div class="room-status-manager">
    <!-- Header -->
    <div class="header">
      <h1>🏨 Room Status Manager</h1>
      <div class="connection-status" :class="connectionStatus">
        <span class="indicator"></span>
        {{ connectionStatus === 'connected' ? '🟢 Live' : '⚪ Offline' }}
      </div>
    </div>

    <!-- Stats Dashboard -->
    <div class="stats-dashboard">
      <div class="stat-card available">
        <h3>Available</h3>
        <p class="count">{{ statusDistribution.available || 0 }}</p>
      </div>
      <div class="stat-card occupied">
        <h3>Occupied</h3>
        <p class="count">{{ statusDistribution.occupied || 0 }}</p>
      </div>
      <div class="stat-card cleaning">
        <h3>Cleaning</h3>
        <p class="count">{{ statusDistribution.cleaning || 0 }}</p>
      </div>
      <div class="stat-card maintenance">
        <h3>Maintenance</h3>
        <p class="count">{{ statusDistribution.maintenance || 0 }}</p>
      </div>
      <div class="stat-card blocked">
        <h3>Blocked</h3>
        <p class="count">{{ statusDistribution.blocked || 0 }}</p>
      </div>
      <div class="stat-card occupancy">
        <h3>Occupancy</h3>
        <p class="count">{{ occupancyRate }}%</p>
      </div>
    </div>

    <!-- Rooms Needing Attention -->
    <div v-if="roomsNeedingAttention.length > 0" class="attention-section">
      <h2>⚠️ Rooms Needing Attention</h2>
      <div class="room-list">
        <div v-for="room in roomsNeedingAttention" :key="room.roomId" class="room-card urgent">
          <div class="room-header">
            <h3>Room {{ room.roomNumber }}</h3>
            <span class="status-badge" :class="room.status">{{ room.status }}</span>
          </div>
          <p class="last-updated">Updated: {{ formatTime(room.lastUpdated) }}</p>
        </div>
      </div>
    </div>

    <!-- Bulk Actions -->
    <div class="bulk-actions">
      <h2>🔧 Bulk Operations</h2>
      <div class="action-controls">
        <input
          v-model="searchRoomNumber"
          type="text"
          placeholder="Filter by room number..."
          class="search-input"
        />
        <select v-model="bulkAction.status" class="status-select">
          <option value="">Select Status...</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="cleaning">Cleaning</option>
          <option value="maintenance">Maintenance</option>
          <option value="blocked">Blocked</option>
        </select>
        <input
          v-model="bulkAction.reason"
          type="text"
          placeholder="Reason (optional)..."
          class="reason-input"
        />
        <button @click="applyBulkAction" class="btn btn-primary">Apply</button>
      </div>
    </div>

    <!-- All Rooms -->
    <div class="rooms-section">
      <h2>All Rooms</h2>
      <div class="room-list">
        <div
          v-for="room in filteredRooms"
          :key="room.roomId"
          class="room-card"
          :class="room.status"
        >
          <div class="room-header">
            <h3>Room {{ room.roomNumber }}</h3>
            <span class="status-badge" :class="room.status">{{ room.status }}</span>
          </div>

          <div class="room-actions">
            <button @click="openRoomDetails(room)" class="btn btn-small">Details</button>
            <select @change="quickStatusChange(room, $event)" class="quick-select">
              <option value="">Quick Action...</option>
              <option value="available">Mark Available</option>
              <option value="cleaning">Mark Cleaning</option>
              <option value="occupied">Mark Occupied</option>
              <option value="maintenance">Report Maintenance</option>
              <option value="blocked">Block Room</option>
            </select>
          </div>

          <p class="last-updated">{{ formatTime(room.lastUpdated) }}</p>
        </div>
      </div>
    </div>

    <!-- Room Details Modal -->
    <transition name="fade">
      <div v-if="selectedRoom" class="modal-overlay" @click="closeRoomDetails">
        <div class="modal" @click.stop>
          <div class="modal-header">
            <h2>Room {{ selectedRoom.roomNumber }}</h2>
            <button @click="closeRoomDetails" class="close-btn">✕</button>
          </div>

          <div class="modal-content">
            <div class="detail-group">
              <label>Current Status:</label>
              <span class="status-badge" :class="selectedRoom.status">{{ selectedRoom.status }}</span>
            </div>

            <div class="detail-group">
              <label>Last Updated:</label>
              <span>{{ formatDateTime(selectedRoom.lastUpdated) }}</span>
            </div>

            <div class="detail-group">
              <label>New Status:</label>
              <select v-model="modalData.status" class="status-select">
                <option value="">Select Status...</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="cleaning">Cleaning</option>
                <option value="maintenance">Maintenance</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            <div class="detail-group">
              <label>Reason:</label>
              <textarea v-model="modalData.reason" placeholder="Enter reason..." class="reason-textarea"></textarea>
            </div>

            <div v-if="modalData.status === 'occupied'" class="detail-group">
              <label>Guest Name:</label>
              <input v-model="modalData.guestName" type="text" placeholder="Enter guest name..." class="text-input" />
            </div>

            <div v-if="modalData.status === 'occupied'" class="detail-group">
              <label>Reservation ID:</label>
              <input v-model="modalData.reservationId" type="text" placeholder="Enter reservation ID..." class="text-input" />
            </div>
          </div>

          <div class="modal-actions">
            <button @click="closeRoomDetails" class="btn btn-secondary">Cancel</button>
            <button @click="updateSelectedRoom" class="btn btn-primary">Update Status</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Toast Notifications -->
    <div class="toast-container">
      <transition-group name="toast">
        <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
          {{ toast.message }}
        </div>
      </transition-group>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoomStatusRealTime, useRoomStatusHttp } from '../composables/useRoomStatus';

// Real-time and HTTP composables
const { roomStatuses, statusDistribution, connectionStatus, getRoomsNeedingAttention, connect, disconnect } =
  useRoomStatusRealTime();
const { updateRoomStatus, checkInGuest, checkOutGuest, reportMaintenance } = useRoomStatusHttp();

// Local state
const searchRoomNumber = ref('');
const selectedRoom = ref(null);
const modalData = ref({
  status: '',
  reason: '',
  guestName: '',
  reservationId: '',
});
const bulkAction = ref({
  status: '',
  reason: '',
});
const toasts = ref<Array<{ id: number; type: string; message: string }>>([]);

// Get room details by ID
const getRoomById = (roomId: string) => {
  return Array.from(roomStatuses.value.values()).find(r => r.roomId === roomId);
};

// Filtered rooms based on search
const filteredRooms = computed(() => {
  const allRooms = Array.from(roomStatuses.value.values());
  if (!searchRoomNumber.value) return allRooms;
  return allRooms.filter(room => room.roomNumber.includes(searchRoomNumber.value));
});

// Rooms needing attention
const roomsNeedingAttention = computed(() => {
  return Array.from(roomStatuses.value.values()).filter(
    room => room.status === 'maintenance' || room.status === 'blocked'
  );
});

// Occupancy rate
const occupancyRate = computed(() => {
  if (!statusDistribution.value || !statusDistribution.value.totalRooms) return 0;
  return (
    ((statusDistribution.value.occupied || 0) / statusDistribution.value.totalRooms) *
    100
  ).toFixed(2);
});

// Show toast notification
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  const id = Date.now();
  toasts.value.push({ id, type, message });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 5000);
};

// Format time
const formatTime = (date?: string) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleTimeString();
};

const formatDateTime = (date?: string) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
};

// Open room details modal
const openRoomDetails = (room: any) => {
  selectedRoom.value = room;
  modalData.value = {
    status: room.status,
    reason: '',
    guestName: '',
    reservationId: '',
  };
};

// Close room details modal
const closeRoomDetails = () => {
  selectedRoom.value = null;
};

// Update selected room
const updateSelectedRoom = async () => {
  if (!selectedRoom.value) return;

  try {
    const { roomId, roomNumber } = selectedRoom.value;
    const { status, reason, guestName, reservationId } = modalData.value;

    if (status === 'occupied' && guestName && reservationId) {
      await checkInGuest(roomId, guestName, reservationId);
    } else if (status === 'maintenance' && reason) {
      await reportMaintenance(roomId, reason);
    } else if (status) {
      await updateRoomStatus(roomId, status, reason);
    }

    showToast(`✅ Room ${roomNumber} status updated`, 'success');
    closeRoomDetails();
  } catch (error) {
    showToast(`❌ Failed to update room: ${(error as Error).message}`, 'error');
  }
};

// Quick status change
const quickStatusChange = async (room: any, event: Event) => {
  const select = event.target as HTMLSelectElement;
  const status = select.value;
  select.value = '';

  if (!status) return;

  try {
    await updateRoomStatus(room.roomId, status);
    showToast(`✅ Room ${room.roomNumber} marked as ${status}`, 'success');
  } catch (error) {
    showToast(`❌ Failed to update room: ${(error as Error).message}`, 'error');
  }
};

// Bulk action
const applyBulkAction = async () => {
  if (!bulkAction.value.status) {
    showToast('⚠️ Please select a status', 'info');
    return;
  }

  const roomsToUpdate = filteredRooms.value;
  if (roomsToUpdate.length === 0) {
    showToast('⚠️ No rooms match your filter', 'info');
    return;
  }

  try {
    for (const room of roomsToUpdate) {
      await updateRoomStatus(room.roomId, bulkAction.value.status, bulkAction.value.reason);
    }
    showToast(`✅ Updated ${roomsToUpdate.length} rooms`, 'success');
  } catch (error) {
    showToast(`❌ Failed to update rooms: ${(error as Error).message}`, 'error');
  }
};

// Lifecycle hooks
onMounted(() => {
  const tenantId = localStorage.getItem('tenantId') || '';
  const userId = localStorage.getItem('userId') || '';
  connect(tenantId, userId);
});

onUnmounted(() => {
  disconnect();
});
</script>

<style scoped>
.room-status-manager {
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
  background: #f5f5f7;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  gap: 16px;
}

.header h1 {
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  background: #f0f0f0;
  color: #666;
}

.connection-status.connected {
  background: #dffce3;
  color: #2d7a2d;
}

.connection-status.error {
  background: #fde8e8;
  color: #a01010;
}

.indicator {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #999;
}

.connection-status.connected .indicator {
  background: #2d7a2d;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Stats Dashboard */
.stats-dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
  border-left: 4px solid #999;
}

.stat-card h3 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
}

.stat-card .count {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  color: #1a1a1a;
}

.stat-card.available {
  border-left-color: #34c759;
}

.stat-card.occupied {
  border-left-color: #ff9500;
}

.stat-card.cleaning {
  border-left-color: #007aff;
}

.stat-card.maintenance {
  border-left-color: #ff3b30;
}

.stat-card.blocked {
  border-left-color: #a2845e;
}

.stat-card.occupancy {
  border-left-color: #5856d6;
}

/* Sections */
.attention-section,
.bulk-actions,
.rooms-section {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 24px;
}

.attention-section h2,
.bulk-actions h2,
.rooms-section h2 {
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
}

/* Action Controls */
.action-controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.search-input,
.status-select,
.reason-input,
.quick-select {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.search-input,
.reason-input {
  flex: 1;
  min-width: 150px;
}

/* Rooms Grid */
.room-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.room-card {
  background: #f9f9fb;
  border: 1px solid #e5e5e7;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.3s ease;
}

.room-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.room-card.available {
  border-left: 4px solid #34c759;
}

.room-card.occupied {
  border-left: 4px solid #ff9500;
}

.room-card.cleaning {
  border-left: 4px solid #007aff;
}

.room-card.maintenance {
  border-left: 4px solid #ff3b30;
}

.room-card.blocked {
  border-left: 4px solid #a2845e;
}

.room-card.urgent {
  background: #fff5f5;
  border-color: #ff3b30;
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.room-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  background: #e5e5e7;
  color: #666;
}

.status-badge.available {
  background: #dffce3;
  color: #2d7a2d;
}

.status-badge.occupied {
  background: #ffe5cc;
  color: #8b5a00;
}

.status-badge.cleaning {
  background: #cce5ff;
  color: #004a99;
}

.status-badge.maintenance {
  background: #fde8e8;
  color: #a01010;
}

.status-badge.blocked {
  background: #f5ede5;
  color: #6b5240;
}

.room-actions {
  display: flex;
  gap: 8px;
  margin: 12px 0;
}

.btn {
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}

.btn-small {
  padding: 6px 10px;
  font-size: 12px;
  flex: 1;
  background: #007aff;
  color: white;
}

.btn-small:hover {
  background: #0051d5;
}

.btn-primary {
  background: #34c759;
  color: white;
}

.btn-primary:hover {
  background: #2fa740;
}

.btn-secondary {
  background: #e5e5e7;
  color: #1a1a1a;
}

.btn-secondary:hover {
  background: #d5d5d7;
}

.last-updated {
  margin: 12px 0 0 0;
  font-size: 12px;
  color: #999;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e5e5e7;
}

.modal-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;
}

.modal-content {
  padding: 24px;
}

.detail-group {
  margin-bottom: 24px;
}

.detail-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.text-input,
.reason-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}

.reason-textarea {
  min-height: 80px;
  resize: vertical;
}

.modal-actions {
  display: flex;
  gap: 12px;
  padding: 24px;
  border-top: 1px solid #e5e5e7;
}

.modal-actions .btn {
  flex: 1;
  padding: 12px;
}

/* Toast Notifications */
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2000;
}

.toast {
  background: #1a1a1a;
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.toast.success {
  background: #34c759;
}

.toast.error {
  background: #ff3b30;
}

.toast.info {
  background: #007aff;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

/* Responsive */
@media (max-width: 768px) {
  .room-status-manager {
    padding: 16px;
  }

  .header {
    flex-direction: column;
    align-items: flex-start;
  }

  .stats-dashboard {
    grid-template-columns: repeat(2, 1fr);
  }

  .room-list {
    grid-template-columns: 1fr;
  }

  .action-controls {
    flex-direction: column;
  }

  .search-input,
  .reason-input,
  .status-select {
    width: 100%;
  }
}
</style>
