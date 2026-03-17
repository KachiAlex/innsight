import { ref, computed } from 'vue';

/**
 * Room status types
 */
export type RoomStatusType = 'available' | 'occupied' | 'maintenance' | 'cleaning' | 'blocked' | 'setup';

/**
 * Room status info
 */
export interface RoomStatusInfo {
  roomId: string;
  roomNumber: string;
  status: RoomStatusType;
  lastUpdated?: string;
  lastUpdatedBy?: string;
  occupancyRate?: string;
}

/**
 * Real-time event data
 */
export interface RealTimeEventData {
  type: string;
  tenantId: string;
  timestamp: string;
  data: Record<string, any>;
}

/**
 * Composable for real-time room status monitoring
 */
export const useRoomStatusRealTime = () => {
  const roomStatuses = ref<Map<string, RoomStatusInfo>>(new Map());
  const statusDistribution = ref<Record<string, number>>({});
  const connectionStatus = ref<'connected' | 'disconnected' | 'error'>('disconnected');
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 seconds

  /**
   * Connect to real-time server
   */
  const connect = (tenantId: string, userId: string) => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/realtime`;

      socket = new WebSocket(wsUrl);

      socket.onopen = () => {
        connectionStatus.value = 'connected';
        reconnectAttempts = 0;
        console.log('✅ Real-time connection established');

        // Send authentication
        socket!.send(
          JSON.stringify({
            type: 'auth',
            tenantId,
            userId,
          })
        );
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleRealTimeEvent(message);
        } catch (error) {
          console.error('❌ Failed to parse real-time message:', error);
        }
      };

      socket.onerror = (error) => {
        connectionStatus.value = 'error';
        console.error('❌ Real-time connection error:', error);
      };

      socket.onclose = () => {
        connectionStatus.value = 'disconnected';
        console.log('⚠️ Real-time connection closed');
        attemptReconnect(tenantId, userId);
      };
    } catch (error) {
      connectionStatus.value = 'error';
      console.error('❌ Failed to establish real-time connection:', error);
    }
  };

  /**
   * Attempt to reconnect with exponential backoff
   */
  const attemptReconnect = (tenantId: string, userId: string) => {
    if (reconnectAttempts < maxReconnectAttempts) {
      reconnectAttempts++;
      const delay = reconnectDelay * Math.pow(2, reconnectAttempts - 1);
      console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);

      setTimeout(() => {
        connect(tenantId, userId);
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  };

  /**
   * Handle incoming real-time events
   */
  const handleRealTimeEvent = (message: RealTimeEventData) => {
    const { type, data, timestamp } = message;

    switch (type) {
      case 'room:status_changed': {
        const { roomId, roomNumber, newStatus } = data;
        const existing = roomStatuses.value.get(roomId) || {};
        roomStatuses.value.set(roomId, {
          ...existing,
          roomId,
          roomNumber: roomNumber || existing.roomNumber,
          status: newStatus,
          lastUpdated: timestamp,
        });
        console.log(`🔄 Room ${roomNumber} status changed to ${newStatus}`);
        break;
      }

      case 'reservation:checked_in': {
        const { roomId, guestName } = data;
        const existing = roomStatuses.value.get(roomId) || {};
        roomStatuses.value.set(roomId, {
          ...existing,
          roomId,
          status: 'occupied',
          lastUpdated: timestamp,
        });
        console.log(`✅ Guest checked in: ${guestName}`);
        break;
      }

      case 'reservation:checked_out': {
        const { roomId } = data;
        const existing = roomStatuses.value.get(roomId) || {};
        roomStatuses.value.set(roomId, {
          ...existing,
          roomId,
          status: 'cleaning',
          lastUpdated: timestamp,
        });
        console.log(`🧹 Room marked for cleaning`);
        break;
      }

      case 'status:distribution': {
        statusDistribution.value = data;
        console.log(`📊 Status distribution updated`, data);
        break;
      }
    }
  };

  /**
   * Send a message through WebSocket
   */
  const send = (message: Record<string, any>) => {
    if (socket && connectionStatus.value === 'connected') {
      socket.send(JSON.stringify(message));
    } else {
      console.warn('⚠️ WebSocket not connected');
    }
  };

  /**
   * Disconnect from real-time server
   */
  const disconnect = () => {
    if (socket) {
      socket.close();
      socket = null;
      connectionStatus.value = 'disconnected';
    }
  };

  /**
   * Get room status for a specific room
   */
  const getRoomStatus = (roomId: string) => {
    return roomStatuses.value.get(roomId);
  };

  /**
   * Get all room statuses as array
   */
  const getAllRoomStatuses = computed(() => {
    return Array.from(roomStatuses.value.values());
  });

  /**
   * Get occupancy rate
   */
  const getOccupancyRate = computed(() => {
    const distribution = statusDistribution.value;
    if (!distribution || !distribution.totalRooms) return 0;
    return ((distribution.occupied / distribution.totalRooms) * 100).toFixed(2);
  });

  /**
   * Get rooms needing attention
   */
  const getRoomsNeedingAttention = computed(() => {
    return getAllRoomStatuses.value.filter(
      room => room.status === 'maintenance' || room.status === 'blocked'
    );
  });

  return {
    // State
    roomStatuses,
    statusDistribution,
    connectionStatus,
    getAllRoomStatuses,
    getOccupancyRate,
    getRoomsNeedingAttention,

    // Methods
    connect,
    disconnect,
    send,
    getRoomStatus,
  };
};

/**
 * Composable for room status polling (fallback when WebSocket unavailable)
 */
export const useRoomStatusPolling = () => {
  const roomStatuses = ref<Map<string, RoomStatusInfo>>(new Map());
  const lastSync = ref<Date>(new Date());
  let pollInterval: NodeJS.Timer | null = null;

  /**
   * Start polling for room status changes
   */
  const startPolling = async (tenantId: string, pollIntervalMs = 10000) => {
    if (pollInterval) return; // Already polling

    pollInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/rooms/status/changes', {
          headers: {
            'X-Tenant-ID': tenantId,
          },
        });

        if (!response.ok) throw new Error('Failed to fetch room status changes');

        const data = await response.json();
        lastSync.value = new Date(data.syncedAt);

        // Update room statuses
        data.changes.forEach((change: any) => {
          const existing = roomStatuses.value.get(change.roomId) || {};
          roomStatuses.value.set(change.roomId, {
            ...existing,
            roomId: change.roomId,
            status: change.newStatus,
            lastUpdated: change.changedAt,
          });
        });
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, pollIntervalMs);

    console.log(`🔄 Started polling for room status changes every ${pollIntervalMs}ms`);
  };

  /**
   * Stop polling
   */
  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
      console.log('⏸️ Stopped polling');
    }
  };

  /**
   * Get all room statuses
   */
  const getAllRoomStatuses = computed(() => {
    return Array.from(roomStatuses.value.values());
  });

  return {
    roomStatuses,
    lastSync,
    getAllRoomStatuses,
    startPolling,
    stopPolling,
  };
};

/**
 * Composable for room status HTTP operations
 */
export const useRoomStatusHttp = () => {
  /**
   * Update a room status via HTTP
   */
  const updateRoomStatus = async (
    roomId: string,
    status: RoomStatusType,
    reason?: string,
    tenantId?: string
  ) => {
    const response = await fetch(`/api/rooms/${roomId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(tenantId && { 'X-Tenant-ID': tenantId }),
      },
      body: JSON.stringify({ status, reason }),
    });

    if (!response.ok) throw new Error('Failed to update room status');
    return response.json();
  };

  /**
   * Check in a guest
   */
  const checkInGuest = async (roomId: string, guestName: string, reservationId: string) => {
    const response = await fetch(`/api/rooms/${roomId}/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestName, reservationId }),
    });

    if (!response.ok) throw new Error('Failed to check in guest');
    return response.json();
  };

  /**
   * Check out a guest
   */
  const checkOutGuest = async (roomId: string, reservationId: string) => {
    const response = await fetch(`/api/rooms/${roomId}/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId }),
    });

    if (!response.ok) throw new Error('Failed to check out guest');
    return response.json();
  };

  /**
   * Report maintenance
   */
  const reportMaintenance = async (roomId: string, issueDescription: string) => {
    const response = await fetch(`/api/rooms/${roomId}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueDescription }),
    });

    if (!response.ok) throw new Error('Failed to report maintenance');
    return response.json();
  };

  /**
   * Mark room as cleaned
   */
  const markRoomCleaned = async (roomId: string) => {
    const response = await fetch(`/api/rooms/${roomId}/cleaned`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) throw new Error('Failed to mark room as cleaned');
    return response.json();
  };

  /**
   * Block/unblock a room
   */
  const toggleRoomBlock = async (roomId: string, blockReason?: string) => {
    const response = await fetch(`/api/rooms/${roomId}/block`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockReason: blockReason || null }),
    });

    if (!response.ok) throw new Error('Failed to toggle room block');
    return response.json();
  };

  /**
   * Get room status distribution
   */
  const getStatusDistribution = async (tenantId: string) => {
    const response = await fetch('/api/rooms/status/distribution', {
      headers: { 'X-Tenant-ID': tenantId },
    });

    if (!response.ok) throw new Error('Failed to get status distribution');
    return response.json();
  };

  return {
    updateRoomStatus,
    checkInGuest,
    checkOutGuest,
    reportMaintenance,
    markRoomCleaned,
    toggleRoomBlock,
    getStatusDistribution,
  };
};
