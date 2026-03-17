# Room Status Management System - Implementation Guide

## Overview

The Room Status Management System provides real-time room status tracking with WebSocket integration, HTTP API endpoints, and a comprehensive Vue.js component for managing room statuses across the property management system.

## Architecture

### Components

1. **Backend**
   - `src/utils/roomStatus.ts` - Core status management logic
   - `src/routes/roomStatus.ts` - HTTP API endpoints
   - `prisma/schema.prisma` - Database schema with status tracking

2. **Frontend**
   - `src/composables/useRoomStatus.ts` - Vue composables for real-time and HTTP operations
   - `src/components/RoomStatusManager.vue` - Main UI component

3. **Real-time**
   - `src/utils/realtimeEmitter.ts` - Event emission system with WebSocket support

## Room Status Types

```typescript
enum RoomStatus {
  AVAILABLE = 'available',      // Room ready for guests
  OCCUPIED = 'occupied',        // Guest is checked in
  MAINTENANCE = 'maintenance',  // Room undergoing maintenance
  CLEANING = 'cleaning',        // Room being cleaned
  BLOCKED = 'blocked',          // Room temporarily blocked
  SETUP = 'setup',              // Room being prepared
}
```

### Valid Status Transitions

```
AVAILABLE    → OCCUPIED, CLEANING, BLOCKED, MAINTENANCE
OCCUPIED     → AVAILABLE, MAINTENANCE, BLOCKED
CLEANING     → AVAILABLE, BLOCKED, MAINTENANCE
MAINTENANCE  → AVAILABLE, CLEANING
BLOCKED      → AVAILABLE, MAINTENANCE, CLEANING
SETUP        → AVAILABLE, CLEANING
```

Invalid transitions will throw errors to maintain data integrity.

## API Endpoints

### Room Status Operations

#### GET /api/rooms/:roomId/status
Get current room status

**Response:**
```json
{
  "roomId": "uuid",
  "roomNumber": "101",
  "status": "available",
  "lastUpdated": "2024-01-15T10:30:00Z",
  "lastUpdatedBy": "userId"
}
```

---

#### PUT /api/rooms/:roomId/status
Update room status

**Request Body:**
```json
{
  "status": "occupied",
  "reason": "Guest check-in"
}
```

**Response:**
```json
{
  "success": true,
  "room": {
    "id": "uuid",
    "roomNumber": "101",
    "status": "occupied",
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

---

#### POST /api/rooms/batch/status
Bulk update multiple room statuses

**Request Body:**
```json
{
  "roomIds": ["uuid1", "uuid2", "uuid3"],
  "status": "cleaning",
  "reason": "Daily cleaning cycle"
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "successful": 3,
    "failed": 0,
    "total": 3
  },
  "results": [
    { "roomId": "uuid1", "success": true, "room": {...} },
    { "roomId": "uuid2", "success": true, "room": {...} },
    { "roomId": "uuid3", "success": true, "room": {...} }
  ]
}
```

---

#### GET /api/rooms/status/distribution
Get room status distribution for the property

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRooms": 100,
    "byStatus": {
      "available": 45,
      "occupied": 40,
      "cleaning": 10,
      "maintenance": 3,
      "blocked": 2,
      "setup": 0
    },
    "occupancyRate": "40.00"
  }
}
```

---

#### POST /api/rooms/:roomId/check-in
Check in a guest (mark room as occupied)

**Request Body:**
```json
{
  "guestName": "John Doe",
  "reservationId": "res-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room marked as occupied"
}
```

---

#### POST /api/rooms/:roomId/check-out
Check out a guest (mark room for cleaning)

**Request Body:**
```json
{
  "reservationId": "res-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room marked for cleaning"
}
```

---

#### POST /api/rooms/:roomId/maintenance
Report maintenance issue

**Request Body:**
```json
{
  "issueDescription": "Air conditioning not working",
  "maintenanceId": "maint-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room marked for maintenance"
}
```

---

#### POST /api/rooms/:roomId/cleaned
Mark room as cleaned and available

**Response:**
```json
{
  "success": true,
  "message": "Room now available"
}
```

---

#### PUT /api/rooms/:roomId/block
Block or unblock a room

**Request Body:**
```json
{
  "blockReason": "Water damage" // null to unblock
}
```

**Response:**
```json
{
  "success": true,
  "message": "Room blocked"
}
```

---

#### GET /api/rooms/status/changes
Get room status changes since last sync (polling fallback)

**Query Parameters:**
- `lastSync` - ISO8601 timestamp (optional, defaults to 1 minute ago)

**Response:**
```json
{
  "success": true,
  "changes": [
    {
      "roomId": "uuid",
      "oldStatus": "available",
      "newStatus": "occupied",
      "changedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "syncedAt": "2024-01-15T10:35:00Z"
}
```

## Real-time Events

Events are emitted through WebSocket connections and can be subscribed to via the frontend composables.

### Event Types

- `room:status_changed` - Room status changed
- `reservation:checked_in` - Guest checked in
- `reservation:checked_out` - Guest checked out
- `maintenance:reported` - Maintenance issue reported
- `task:assigned` - Task assigned to staff
- `system:alert` - System alert triggered

### Event Payload Example

```json
{
  "type": "room:status_changed",
  "tenantId": "tenant-uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "roomId": "room-uuid",
    "roomNumber": "101",
    "oldStatus": "available",
    "newStatus": "occupied",
    "reason": "Guest check-in",
    "staffId": "user-uuid"
  },
  "metadata": {
    "priority": "medium",
    "roomId": "room-uuid"
  }
}
```

## Frontend Usage

### Composables

#### 1. useRoomStatusRealTime()

For real-time WebSocket connection:

```typescript
import { useRoomStatusRealTime } from '@/composables/useRoomStatus';

const {
  roomStatuses,           // Reactive map of room statuses
  statusDistribution,     // Status count distribution
  connectionStatus,       // 'connected' | 'disconnected' | 'error'
  getAllRoomStatuses,     // Computed array of all rooms
  getOccupancyRate,       // Computed occupancy percentage
  getRoomsNeedingAttention, // Computed array of urgent rooms
  connect,                // Connect to real-time server
  disconnect,             // Disconnect from server
  send,                   // Send WebSocket message
  getRoomStatus,          // Get status of specific room
} = useRoomStatusRealTime();

// Usage
onMounted(() => {
  const tenantId = localStorage.getItem('tenantId');
  const userId = localStorage.getItem('userId');
  connect(tenantId, userId);
});

// Listen for room updates
watch(
  () => roomStatuses.value,
  (newStatuses) => {
    console.log('Room statuses updated:', newStatuses);
  },
  { deep: true }
);
```

---

#### 2. useRoomStatusPolling()

For polling-based updates (fallback when WebSocket unavailable):

```typescript
import { useRoomStatusPolling } from '@/composables/useRoomStatus';

const { 
  roomStatuses,      // Reactive map of room statuses
  lastSync,          // Last sync timestamp
  getAllRoomStatuses, // Computed array
  startPolling,      // Start polling for changes
  stopPolling,       // Stop polling
} = useRoomStatusPolling();

// Usage
const tenantId = localStorage.getItem('tenantId');
startPolling(tenantId, 10000); // Poll every 10 seconds

onUnmounted(() => {
  stopPolling();
});
```

---

#### 3. useRoomStatusHttp()

For HTTP API operations:

```typescript
import { useRoomStatusHttp } from '@/composables/useRoomStatus';

const {
  updateRoomStatus,        // PUT /api/rooms/:roomId/status
  checkInGuest,            // POST /api/rooms/:roomId/check-in
  checkOutGuest,           // POST /api/rooms/:roomId/check-out
  reportMaintenance,       // POST /api/rooms/:roomId/maintenance
  markRoomCleaned,         // POST /api/rooms/:roomId/cleaned
  toggleRoomBlock,         // PUT /api/rooms/:roomId/block
  getStatusDistribution,   // GET /api/rooms/status/distribution
} = useRoomStatusHttp();

// Usage
async function handleCheckIn() {
  try {
    await checkInGuest('room-uuid', 'John Doe', 'reservation-uuid');
    console.log('Guest checked in successfully');
  } catch (error) {
    console.error('Check-in failed:', error);
  }
}
```

### Component Usage

The `RoomStatusManager` component provides a complete UI for managing room statuses:

```vue
<template>
  <RoomStatusManager />
</template>

<script setup>
import RoomStatusManager from '@/components/RoomStatusManager.vue';
</script>
```

**Features:**
- 📊 Real-time status dashboard with statistics
- ⚠️ Highlights rooms needing attention
- 🔧 Bulk operations for multiple rooms
- 🎯 Individual room detail modal
- 🔄 Real-time updates via WebSocket
- ⏱️ Polling fallback for offline mode
- 🔔 Toast notifications for actions

## Database Schema

### Room Model

```prisma
model Room {
  id                    String              @id @default(uuid())
  tenantId              String
  roomNumber            String
  status                String              @default("available")
  maxOccupancy          Int
  amenities             Json?
  lastStatusUpdate      DateTime?           // NEW: Track when status changed
  lastStatusUpdateBy    String?             // NEW: Track who changed it
  // ... other fields
  
  @@unique([tenantId, roomNumber])
  @@index([tenantId, status])
}
```

### Migration

Run the migration to add new fields:

```bash
npm run prisma:migrate
```

The migration adds:
- `lastStatusUpdate` - DateTime field for tracking last status change
- `lastStatusUpdateBy` - String field for tracking staff member who made change
- Index on `lastStatusUpdate` for efficient querying

## Integration Steps

### 1. Backend Setup

```bash
cd backend
npm install socket.io socket.io-client
npm run prisma:migrate
npm run build
```

### 2. Update main Express app

```typescript
import roomStatusRouter from './routes/roomStatus';
import { setupRoomStatusWebSocket } from './routes/roomStatus';

// Add HTTP routes
app.use('/api/rooms', roomStatusRouter);

// Setup WebSocket
setupRoomStatusWebSocket(io);
```

### 3. Frontend Setup

```bash
cd frontend
npm install
```

### 4. Use in components

```vue
<template>
  <RoomStatusManager />
</template>

<script setup>
import RoomStatusManager from '@/components/RoomStatusManager.vue';
</script>
```

## Error Handling

### Invalid Status Transitions

```typescript
try {
  await updateRoomStatus(roomId, 'invalid-status');
} catch (error) {
  if (error.message.includes('Cannot transition')) {
    console.error('Invalid status transition');
  }
}
```

### Concurrent Updates

The system handles concurrent updates through:
- Timestamp-based last-write-wins strategy
- Real-time event notifications prevent stale data
- Atomic database operations

## Performance Considerations

1. **WebSocket Efficiency**
   - Single connection per user
   - Automatic reconnection with exponential backoff
   - Immediate updates vs. polling delays

2. **Polling Optimization**
   - Configurable poll interval (default: 10 seconds)
   - Only fetches changes since last sync
   - Reduces server load for offline clients

3. **Database**
   - Indexed queries on `tenantId` and `status`
   - Pagination for bulk operations
   - Connection pooling via Prisma

## Monitoring & Analytics

### Track Status Changes

```typescript
// Automatically logged via realtimeEmitter
realtimeEmitter.onRoomStatusChanged((event) => {
  console.log(`Room ${event.roomNumber}: ${event.oldStatus} → ${event.newStatus}`);
  // Use for analytics, logging, notifications, etc.
});
```

### Get Status Report

```typescript
const distribution = await getRoomStatusDistribution(tenantId);
console.log(`Occupancy rate: ${distribution.occupancyRate}%`);
console.log(`Available rooms: ${distribution.byStatus.available}`);
```

## Testing

### Unit Tests

```typescript
import { updateRoomStatus, RoomStatus } from '@/utils/roomStatus';

describe('Room Status Management', () => {
  it('should update room status', async () => {
    const result = await updateRoomStatus(
      'tenant-1',
      'room-1',
      RoomStatus.OCCUPIED,
      'Guest check-in'
    );
    expect(result.status).toBe('occupied');
  });

  it('should prevent invalid transitions', async () => {
    await expect(
      updateRoomStatus('tenant-1', 'room-1', 'invalid-status')
    ).rejects.toThrow();
  });
});
```

### E2E Tests

```typescript
describe('Room Status Manager Component', () => {
  it('should display room status updates in real-time', async () => {
    const wrapper = mount(RoomStatusManager);
    await wrapper.vm.$nextTick();
    
    // Simulate WebSocket event
    const room = wrapper.vm.roomStatuses.get('room-1');
    expect(room.status).toBe('occupied');
  });
});
```

## Troubleshooting

### WebSocket Connection Issues

```typescript
// Check connection status
if (connectionStatus.value !== 'connected') {
  // Fallback to polling
  startPolling(tenantId);
}
```

### Stale Data

```typescript
// Force refresh
const updates = await getRoomStatusChanges(tenantId, new Date(0)); // All changes
```

### Performance Issues

```typescript
// Reduce polling interval or use WebSocket
// Monitor memory: roomStatuses.value.size
// Clear old entries if needed
```

## Security

- Tenant isolation enforced at all levels
- User authentication required for all endpoints
- Role-based access control for operations
- Audit logging of all status changes via `lastStatusUpdateBy`

## Future Enhancements

- [ ] Mobile app support
- [ ] SMS notifications for urgent status changes
- [ ] Voice commands for staff
- [ ] Predictive maintenance alerting
- [ ] Integration with IoT sensors
- [ ] Machine learning for occupancy prediction
- [ ] Custom status workflows
- [ ] Advanced analytics dashboard

---

**Last Updated:** 2024-01-15
**Version:** 1.0.0
