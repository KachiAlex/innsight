import { Router, Request, Response, NextFunction } from 'express';
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
} from '../utils/roomStatus';
import { realtimeEmitter } from '../utils/realtimeEmitter';
// import { authMiddleware } from '../middleware/auth';

const router = Router();

// All routes require authentication
// router.use(authMiddleware);

/**
 * GET /api/rooms/:roomId/status
 * Get current room status
 */
router.get('/:roomId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        roomNumber: true,
        status: true,
        lastStatusUpdate: true,
        lastStatusUpdateBy: true,
      },
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      roomId: room.id,
      roomNumber: room.roomNumber,
      status: room.status || RoomStatus.AVAILABLE,
      lastUpdated: room.lastStatusUpdate,
      lastUpdatedBy: room.lastStatusUpdateBy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/rooms/:roomId/status
 * Update room status
 * Body: { status: RoomStatus, reason?: string }
 */
router.put('/:roomId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { status, reason } = req.body;
    const tenantId = req.tenant?.id;
    const staffId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    if (!status || !Object.values(RoomStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid room status' });
    }

    const updatedRoom = await updateRoomStatus(tenantId, roomId, status, reason, staffId);

    res.json({
      success: true,
      room: {
        id: updatedRoom.id,
        roomNumber: updatedRoom.roomNumber,
        status: updatedRoom.status,
        lastUpdated: updatedRoom.lastStatusUpdate,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/batch/status
 * Bulk update room statuses
 * Body: { roomIds: string[], status: RoomStatus, reason?: string }
 */
router.post('/batch/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomIds, status, reason } = req.body;
    const tenantId = req.tenant?.id;
    const staffId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      return res.status(400).json({ error: 'Invalid roomIds' });
    }

    if (!status || !Object.values(RoomStatus).includes(status)) {
      return res.status(400).json({ error: 'Invalid room status' });
    }

    const results = await bulkUpdateRoomStatus(tenantId, roomIds, status, reason, staffId);

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    res.json({
      success: true,
      summary: { successful, failed, total: results.length },
      results,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/status/distribution
 * Get room status distribution
 */
router.get('/status/distribution', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    const distribution = await getRoomStatusDistribution(tenantId);

    res.json({
      success: true,
      data: distribution,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/check-in
 * Mark room as occupied (guest check-in)
 * Body: { guestName: string, reservationId: string }
 */
router.post('/:roomId/check-in', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { guestName, reservationId } = req.body;
    const tenantId = req.tenant?.id;
    const staffId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    if (!guestName || !reservationId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await handleRoomCheckIn(tenantId, roomId, guestName, reservationId, staffId);

    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/check-out
 * Mark room as cleaning (guest check-out)
 * Body: { reservationId: string }
 */
router.post('/:roomId/check-out', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { reservationId } = req.body;
    const tenantId = req.tenant?.id;
    const staffId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    if (!reservationId) {
      return res.status(400).json({ error: 'Missing reservationId' });
    }

    const result = await handleRoomCheckOut(tenantId, roomId, reservationId, staffId);

    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/maintenance
 * Mark room as maintenance
 * Body: { issueDescription: string, maintenanceId?: string }
 */
router.post(
  '/:roomId/maintenance',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roomId } = req.params;
      const { issueDescription, maintenanceId } = req.body;
      const tenantId = req.tenant?.id;
      const staffId = req.user?.id;

      if (!tenantId) {
        return res.status(401).json({ error: 'Tenant not identified' });
      }

      if (!issueDescription) {
        return res.status(400).json({ error: 'Missing issueDescription' });
      }

      const result = await handleRoomMaintenance(
        tenantId,
        roomId,
        issueDescription,
        maintenanceId,
        staffId
      );

      res.json({ success: true, message: result.message });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/rooms/:roomId/cleaned
 * Mark room as cleaned and available
 */
router.post('/:roomId/cleaned', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const tenantId = req.tenant?.id;
    const staffId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    const result = await handleRoomCleaned(tenantId, roomId, staffId);

    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/rooms/:roomId/block
 * Block/unblock room
 * Body: { blockReason?: string | null }
 */
router.put('/:roomId/block', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { blockReason } = req.body;
    const tenantId = req.tenant?.id;
    const staffId = req.user?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    const result = await toggleRoomBlock(tenantId, roomId, blockReason || null, staffId);

    res.json({ success: true, message: result.message });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/status/changes
 * Get room status changes since last sync (polling fallback)
 * Query: { lastSync: ISO8601 timestamp }
 */
router.get('/status/changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lastSync } = req.query;
    const tenantId = req.tenant?.id;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant not identified' });
    }

    const lastSyncDate = lastSync ? new Date(lastSync as string) : new Date(Date.now() - 60000); // Default: last minute

    const changes = await getRoomStatusChanges(tenantId, lastSyncDate);

    res.json({
      success: true,
      changes,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// WebSocket connection for real-time updates
export const setupRoomStatusWebSocket = (io: any) => {
  io.on('connection', (socket: any) => {
    const tenantId = socket.handshake.auth.tenantId;
    const userId = socket.handshake.auth.userId;

    if (!tenantId) {
      socket.disconnect();
      return;
    }

    // Join tenant room
    socket.join(`tenant:${tenantId}`);

    // Listen for real-time events from emitter
    realtimeEmitter.on('roomStatusChanged', (data: any) => {
      if (data.tenantId === tenantId) {
        socket.emit('room:status-changed', data);
      }
    });

    realtimeEmitter.on('reservationCheckIn', (data: any) => {
      if (data.tenantId === tenantId) {
        socket.emit('reservation:checked-in', data);
      }
    });

    realtimeEmitter.on('reservationCheckOut', (data: any) => {
      if (data.tenantId === tenantId) {
        socket.emit('reservation:checked-out', data);
      }
    });

    socket.on('disconnect', () => {
      console.log(`👤 User ${userId} disconnected`);
    });
  });
};

export default router;
