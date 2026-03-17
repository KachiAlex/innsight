import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { prisma } from '@/prisma';
import {
  updateRoomStatus,
  bulkUpdateRoomStatus,
  getRoomStatusDistribution,
  handleRoomCheckIn,
  handleRoomCheckOut,
  handleRoomMaintenance,
  handleRoomCleaned,
  toggleRoomBlock,
  getRoomStatusChanges,
  RoomStatus,
} from '@/utils/roomStatus';
import { realtimeEmitter } from '@/utils/realtimeEmitter';

describe('Room Status Management', () => {
  const testTenantId = 'test-tenant-1';
  const testRoomId = 'test-room-1';
  let createdRoomIds: string[] = [];

  beforeEach(async () => {
    // Clean up test data
    await prisma.room.deleteMany({
      where: { tenantId: testTenantId },
    });

    // Create test room
    const room = await prisma.room.create({
      data: {
        tenantId: testTenantId,
        roomNumber: '101',
        roomType: 'standard',
        maxOccupancy: 2,
        status: RoomStatus.AVAILABLE,
      },
    });
    createdRoomIds.push(room.id);

    // Spy on emitter
    vi.spyOn(realtimeEmitter, 'emitRoomStatusChanged');
    vi.spyOn(realtimeEmitter, 'emitReservationCheckIn');
    vi.spyOn(realtimeEmitter, 'emitReservationCheckOut');
  });

  afterEach(async () => {
    // Clean up
    await prisma.room.deleteMany({
      where: { id: { in: createdRoomIds } },
    });
    vi.clearAllMocks();
  });

  describe('updateRoomStatus', () => {
    it('should update room status successfully', async () => {
      const result = await updateRoomStatus(
        testTenantId,
        createdRoomIds[0],
        RoomStatus.OCCUPIED,
        'Guest check-in'
      );

      expect(result.status).toBe(RoomStatus.OCCUPIED);
      expect(result.lastStatusUpdate).toBeDefined();
      expect(realtimeEmitter.emitRoomStatusChanged).toHaveBeenCalled();
    });

    it('should prevent invalid status transitions', async () => {
      // Set room to occupied
      await updateRoomStatus(testTenantId, createdRoomIds[0], RoomStatus.OCCUPIED);

      // Try invalid transition: occupied -> available (invalid; should be occupied -> available not allowed directly)
      // Actually OCCUPIED -> AVAILABLE IS valid based on our rules
      const result = await updateRoomStatus(
        testTenantId,
        createdRoomIds[0],
        RoomStatus.AVAILABLE
      );

      expect(result.status).toBe(RoomStatus.AVAILABLE);

      // Try invalid transition that should fail
      await updateRoomStatus(testTenantId, createdRoomIds[0], RoomStatus.OCCUPIED);
      await updateRoomStatus(testTenantId, createdRoomIds[0], RoomStatus.CLEANING);

      // Try invalid: CLEANING -> OCCUPIED
      await expect(
        updateRoomStatus(testTenantId, createdRoomIds[0], RoomStatus.OCCUPIED)
      ).rejects.toThrow('Cannot transition from cleaning to occupied');
    });

    it('should track who updated the status', async () => {
      const staffId = 'staff-123';
      const result = await updateRoomStatus(
        testTenantId,
        createdRoomIds[0],
        RoomStatus.CLEANING,
        'Daily cleaning',
        staffId
      );

      expect(result.lastStatusUpdateBy).toBe(staffId);
    });

    it('should throw error for non-existent room', async () => {
      await expect(
        updateRoomStatus(testTenantId, 'non-existent-room', RoomStatus.AVAILABLE)
      ).rejects.toThrow('Room non-existent-room not found');
    });
  });

  describe('bulkUpdateRoomStatus', () => {
    beforeEach(async () => {
      // Create additional test rooms
      for (let i = 0; i < 3; i++) {
        const room = await prisma.room.create({
          data: {
            tenantId: testTenantId,
            roomNumber: `${102 + i}`,
            roomType: 'standard',
            maxOccupancy: 2,
            status: RoomStatus.AVAILABLE,
          },
        });
        createdRoomIds.push(room.id);
      }
    });

    it('should update multiple rooms successfully', async () => {
      const roomIds = createdRoomIds.slice(0, 3);
      const results = await bulkUpdateRoomStatus(
        testTenantId,
        roomIds,
        RoomStatus.CLEANING,
        'Daily cleaning'
      );

      expect(results.length).toBe(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.every(r => r.room.status === RoomStatus.CLEANING)).toBe(true);
    });

    it('should report partial failures', async () => {
      const roomIds = [...createdRoomIds.slice(0, 2), 'non-existent-room'];
      const results = await bulkUpdateRoomStatus(
        testTenantId,
        roomIds,
        RoomStatus.AVAILABLE
      );

      expect(results.length).toBe(3);
      expect(results.filter(r => r.success).length).toBe(2);
      expect(results.filter(r => !r.success).length).toBe(1);
    });
  });

  describe('getRoomStatusDistribution', () => {
    beforeEach(async () => {
      // Create rooms in different statuses
      const rooms = [
        { num: '102', status: RoomStatus.OCCUPIED },
        { num: '103', status: RoomStatus.OCCUPIED },
        { num: '104', status: RoomStatus.CLEANING },
        { num: '105', status: RoomStatus.MAINTENANCE },
      ];

      for (const room of rooms) {
        const created = await prisma.room.create({
          data: {
            tenantId: testTenantId,
            roomNumber: room.num,
            roomType: 'standard',
            maxOccupancy: 2,
            status: room.status,
          },
        });
        createdRoomIds.push(created.id);
      }
    });

    it('should calculate correct status distribution', async () => {
      const distribution = await getRoomStatusDistribution(testTenantId);

      expect(distribution.totalRooms).toBe(5);
      expect(distribution.byStatus.available).toBe(1);
      expect(distribution.byStatus.occupied).toBe(2);
      expect(distribution.byStatus.cleaning).toBe(1);
      expect(distribution.byStatus.maintenance).toBe(1);
    });

    it('should calculate occupancy rate', async () => {
      const distribution = await getRoomStatusDistribution(testTenantId);
      const expectedRate = (2 / 5) * 100; // 2 occupied out of 5 total

      expect(parseFloat(distribution.occupancyRate)).toBe(expectedRate);
    });
  });

  describe('handleRoomCheckIn', () => {
    it('should check in guest and emit event', async () => {
      const result = await handleRoomCheckIn(
        testTenantId,
        createdRoomIds[0],
        'John Doe',
        'res-123'
      );

      expect(result.success).toBe(true);
      expect(realtimeEmitter.emitReservationCheckIn).toHaveBeenCalled();

      const room = await prisma.room.findUnique({
        where: { id: createdRoomIds[0] },
      });
      expect(room?.status).toBe(RoomStatus.OCCUPIED);
    });
  });

  describe('handleRoomCheckOut', () => {
    beforeEach(async () => {
      // Check in first
      await prisma.room.update({
        where: { id: createdRoomIds[0] },
        data: { status: RoomStatus.OCCUPIED },
      });
    });

    it('should check out guest and mark for cleaning', async () => {
      const result = await handleRoomCheckOut(testTenantId, createdRoomIds[0], 'res-123');

      expect(result.success).toBe(true);
      expect(realtimeEmitter.emitReservationCheckOut).toHaveBeenCalled();

      const room = await prisma.room.findUnique({
        where: { id: createdRoomIds[0] },
      });
      expect(room?.status).toBe(RoomStatus.CLEANING);
    });
  });

  describe('handleRoomMaintenance', () => {
    it('should mark room as maintenance', async () => {
      const result = await handleRoomMaintenance(
        testTenantId,
        createdRoomIds[0],
        'Air conditioning not working'
      );

      expect(result.success).toBe(true);

      const room = await prisma.room.findUnique({
        where: { id: createdRoomIds[0] },
      });
      expect(room?.status).toBe(RoomStatus.MAINTENANCE);
    });
  });

  describe('handleRoomCleaned', () => {
    beforeEach(async () => {
      // Mark as cleaning first
      await prisma.room.update({
        where: { id: createdRoomIds[0] },
        data: { status: RoomStatus.CLEANING },
      });
    });

    it('should mark room as cleaned and available', async () => {
      const result = await handleRoomCleaned(testTenantId, createdRoomIds[0]);

      expect(result.success).toBe(true);

      const room = await prisma.room.findUnique({
        where: { id: createdRoomIds[0] },
      });
      expect(room?.status).toBe(RoomStatus.AVAILABLE);
    });
  });

  describe('toggleRoomBlock', () => {
    it('should block room with reason', async () => {
      const result = await toggleRoomBlock(
        testTenantId,
        createdRoomIds[0],
        'Water damage'
      );

      expect(result.success).toBe(true);

      const room = await prisma.room.findUnique({
        where: { id: createdRoomIds[0] },
      });
      expect(room?.status).toBe(RoomStatus.BLOCKED);
    });

    it('should unblock room', async () => {
      // Block first
      await toggleRoomBlock(testTenantId, createdRoomIds[0], 'Water damage');

      // Unblock
      const result = await toggleRoomBlock(testTenantId, createdRoomIds[0], null);

      expect(result.success).toBe(true);

      const room = await prisma.room.findUnique({
        where: { id: createdRoomIds[0] },
      });
      expect(room?.status).toBe(RoomStatus.AVAILABLE);
    });
  });

  describe('getRoomStatusChanges', () => {
    it('should retrieve recent status changes', async () => {
      const before = new Date();

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make a status change
      await updateRoomStatus(testTenantId, createdRoomIds[0], RoomStatus.OCCUPIED);

      // Query changes
      const changes = await getRoomStatusChanges(testTenantId, before);

      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].roomId).toBe(createdRoomIds[0]);
      expect(changes[0].newStatus).toBe(RoomStatus.OCCUPIED);
    });

    it('should not return changes before lastSync', async () => {
      const now = new Date();
      const futureTime = new Date(now.getTime() + 60000); // 1 minute in future

      const changes = await getRoomStatusChanges(testTenantId, futureTime);

      expect(changes.length).toBe(0);
    });
  });

  describe('Real-time Event Emissions', () => {
    it('should emit room status changed event with correct data', async () => {
      await updateRoomStatus(
        testTenantId,
        createdRoomIds[0],
        RoomStatus.OCCUPIED,
        'Guest arrival',
        'staff-123'
      );

      expect(realtimeEmitter.emitRoomStatusChanged).toHaveBeenCalledWith(
        testTenantId,
        createdRoomIds[0],
        RoomStatus.AVAILABLE,
        RoomStatus.OCCUPIED,
        expect.objectContaining({
          reason: 'Guest arrival',
          staffId: 'staff-123',
        })
      );
    });

    it('should emit check-in event', async () => {
      await handleRoomCheckIn(testTenantId, createdRoomIds[0], 'Jane Smith', 'res-456');

      expect(realtimeEmitter.emitReservationCheckIn).toHaveBeenCalledWith(
        testTenantId,
        'res-456',
        expect.objectContaining({
          roomId: createdRoomIds[0],
          guestName: 'Jane Smith',
        })
      );
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle concurrent status updates', async () => {
      const updates = [
        updateRoomStatus(testTenantId, createdRoomIds[0], RoomStatus.OCCUPIED),
        updateRoomStatus(testTenantId, createdRoomIds[0], RoomStatus.AVAILABLE),
      ];

      // The second one should fail due to invalid transition
      const results = await Promise.allSettled(updates);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });
});
