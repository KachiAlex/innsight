import { prisma } from './prisma';
import { realtimeEmitter, RealTimeEventType } from './realtimeEmitter';

/**
 * Room Status enum - represents possible room states
 */
export enum RoomStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  MAINTENANCE = 'maintenance',
  CLEANING = 'cleaning',
  BLOCKED = 'blocked',
  SETUP = 'setup',
}

/**
 * Room Status Transitions - allowed status changes
 */
const VALID_TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  [RoomStatus.AVAILABLE]: [RoomStatus.OCCUPIED, RoomStatus.CLEANING, RoomStatus.BLOCKED, RoomStatus.MAINTENANCE],
  [RoomStatus.OCCUPIED]: [RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE, RoomStatus.BLOCKED],
  [RoomStatus.CLEANING]: [RoomStatus.AVAILABLE, RoomStatus.BLOCKED, RoomStatus.MAINTENANCE],
  [RoomStatus.MAINTENANCE]: [RoomStatus.AVAILABLE, RoomStatus.CLEANING],
  [RoomStatus.BLOCKED]: [RoomStatus.AVAILABLE, RoomStatus.MAINTENANCE, RoomStatus.CLEANING],
  [RoomStatus.SETUP]: [RoomStatus.AVAILABLE, RoomStatus.CLEANING],
};

/**
 * Update room status with real-time emissions
 */
export const updateRoomStatus = async (
  tenantId: string,
  roomId: string,
  newStatus: RoomStatus,
  reason?: string,
  staffId?: string
) => {
  try {
    // Get current room
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, roomNumber: true, status: true },
    });

    if (!room) {
      throw new Error(`Room ${roomId} not found`);
    }

    const oldStatus = (room.status || RoomStatus.AVAILABLE) as RoomStatus;

    // Validate status transition
    if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
      throw new Error(`Cannot transition from ${oldStatus} to ${newStatus}`);
    }

    // Update room status in database
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        status: newStatus,
        lastStatusUpdate: new Date(),
        lastStatusUpdateBy: staffId,
      },
    });

    // Emit real-time event
    realtimeEmitter.emitRoomStatusChanged(tenantId, roomId, oldStatus, newStatus, {
      roomNumber: room.roomNumber,
      reason,
      staffId,
      timestamp: new Date().toISOString(),
    });

    console.log(
      `🔄 Room ${room.roomNumber} status changed: ${oldStatus} → ${newStatus} (Reason: ${reason || 'N/A'})`
    );

    return updatedRoom;
  } catch (error) {
    console.error(`❌ Failed to update room status:`, error);
    throw error;
  }
};

/**
 * Bulk update room statuses
 */
export const bulkUpdateRoomStatus = async (
  tenantId: string,
  roomIds: string[],
  newStatus: RoomStatus,
  reason?: string,
  staffId?: string
) => {
  const results = [];

  for (const roomId of roomIds) {
    try {
      const result = await updateRoomStatus(tenantId, roomId, newStatus, reason, staffId);
      results.push({ roomId, success: true, room: result });
    } catch (error) {
      results.push({ roomId, success: false, error: (error as Error).message });
    }
  }

  return results;
};

/**
 * Get room status distribution for a property
 */
export const getRoomStatusDistribution = async (tenantId: string) => {
  const rooms = await prisma.room.findMany({
    where: { tenantId },
    select: { status: true },
  });

  const distribution: Record<string, number> = {
    available: 0,
    occupied: 0,
    maintenance: 0,
    cleaning: 0,
    blocked: 0,
    setup: 0,
  };

  rooms.forEach(room => {
    const status = (room.status || RoomStatus.AVAILABLE) as RoomStatus;
    if (status in distribution) {
      (distribution[status] as number)++;
    }
  });

  return {
    totalRooms: rooms.length,
    byStatus: distribution,
    occupancyRate: ((distribution.occupied / rooms.length) * 100).toFixed(2),
  };
};

/**
 * Handle room check-in (mark as occupied)
 */
export const handleRoomCheckIn = async (
  tenantId: string,
  roomId: string,
  guestName: string,
  reservationId: string,
  staffId?: string
) => {
  await updateRoomStatus(
    tenantId,
    roomId,
    RoomStatus.OCCUPIED,
    `Guest check-in: ${guestName}`,
    staffId
  );

  realtimeEmitter.emitReservationCheckIn(tenantId, reservationId, {
    roomId,
    guestName,
    timestamp: new Date().toISOString(),
  });

  return { success: true, message: `Room marked as occupied` };
};

/**
 * Handle room check-out (mark for cleaning)
 */
export const handleRoomCheckOut = async (
  tenantId: string,
  roomId: string,
  reservationId: string,
  staffId?: string
) => {
  await updateRoomStatus(tenantId, roomId, RoomStatus.CLEANING, `Guest checkout`, staffId);

  realtimeEmitter.emitReservationCheckOut(tenantId, reservationId, {
    roomId,
    timestamp: new Date().toISOString(),
  });

  return { success: true, message: `Room marked for cleaning` };
};

/**
 * Mark room as maintenance
 */
export const handleRoomMaintenance = async (
  tenantId: string,
  roomId: string,
  issueDescription: string,
  maintenanceId?: string,
  staffId?: string
) => {
  await updateRoomStatus(
    tenantId,
    roomId,
    RoomStatus.MAINTENANCE,
    `Maintenance: ${issueDescription}`,
    staffId
  );

  return { success: true, message: `Room marked for maintenance` };
};

/**
 * Mark room as cleaned and available
 */
export const handleRoomCleaned = async (
  tenantId: string,
  roomId: string,
  staffId?: string
) => {
  await updateRoomStatus(tenantId, roomId, RoomStatus.AVAILABLE, `Room cleaned`, staffId);

  return { success: true, message: `Room now available` };
};

/**
 * Block/unblock room
 */
export const toggleRoomBlock = async (
  tenantId: string,
  roomId: string,
  blockReason: string | null,
  staffId?: string
) => {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { status: true },
  });

  if (!room) throw new Error('Room not found');

  const newStatus = blockReason ? RoomStatus.BLOCKED : RoomStatus.AVAILABLE;
  const reason = blockReason ? `Blocked: ${blockReason}` : 'Block removed';

  await updateRoomStatus(tenantId, roomId, newStatus, reason, staffId);

  return { success: true, message: `Room ${blockReason ? 'blocked' : 'unblocked'}` };
};

/**
 * Watch room status changes via polling (fallback for clients without WebSocket)
 */
export const getRoomStatusChanges = async (
  tenantId: string,
  lastSync: Date
): Promise<{ roomId: string; oldStatus: string; newStatus: string; changedAt: Date }[]> => {
  const rooms = await prisma.room.findMany({
    where: {
      tenantId,
      lastStatusUpdate: { gte: lastSync },
    },
    select: {
      id: true,
      status: true,
      lastStatusUpdate: true,
    },
  });

  return rooms.map(room => ({
    roomId: room.id,
    oldStatus: 'unknown', // For polling, we don't have the old status
    newStatus: room.status || RoomStatus.AVAILABLE,
    changedAt: room.lastStatusUpdate || new Date(),
  }));
};
