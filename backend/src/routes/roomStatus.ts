import { Router, Response, NextFunction } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
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
const router = Router();

router.use(authenticate);

/**
 * Resolve the tenant scope for the request.
 * Tenant staff operate on their own tenant; iitech_admin must pass ?tenantId=.
 */
const resolveTenantId = (req: AuthRequest): string => {
  const requested = (req.query.tenantId as string) || (req.body?.tenantId as string);
  if (req.user!.role === 'iitech_admin') {
    if (!requested) throw new AppError('tenantId is required for admin access', 400);
    return requested;
  }
  if (requested && requested !== req.user!.tenantId) {
    throw new AppError('Access denied to this tenant', 403);
  }
  return req.user!.tenantId;
};

const assertRoomInTenant = async (roomId: string, tenantId: string) => {
  const room = await prisma.room.findFirst({
    where: { id: roomId, tenantId },
    select: { id: true },
  });
  if (!room) throw new AppError('Room not found', 404);
};

/**
 * GET /api/rooms/:roomId/status
 * Get current room status
 */
router.get('/:roomId/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const tenantId = resolveTenantId(req);

    const room = await prisma.room.findFirst({
      where: { id: roomId, tenantId },
      select: {
        id: true,
        roomNumber: true,
        status: true,
        lastStatusUpdate: true,
        lastStatusUpdateBy: true,
      },
    });

    if (!room) {
      throw new AppError('Room not found', 404);
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
router.put('/:roomId/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { status, reason } = req.body;
    const tenantId = resolveTenantId(req);
    const staffId = req.user!.id;

    if (!status || !Object.values(RoomStatus).includes(status)) {
      throw new AppError('Invalid room status', 400);
    }

    await assertRoomInTenant(roomId, tenantId);
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
router.post('/batch/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomIds, status, reason } = req.body;
    const tenantId = resolveTenantId(req);
    const staffId = req.user!.id;

    if (!Array.isArray(roomIds) || roomIds.length === 0) {
      throw new AppError('Invalid roomIds', 400);
    }

    if (!status || !Object.values(RoomStatus).includes(status)) {
      throw new AppError('Invalid room status', 400);
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
router.get('/status/distribution', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const tenantId = resolveTenantId(req);
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
router.post('/:roomId/check-in', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { guestName, reservationId } = req.body;
    const tenantId = resolveTenantId(req);
    const staffId = req.user!.id;

    if (!guestName || !reservationId) {
      throw new AppError('Missing required fields', 400);
    }

    await assertRoomInTenant(roomId, tenantId);
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
router.post('/:roomId/check-out', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { reservationId } = req.body;
    const tenantId = resolveTenantId(req);
    const staffId = req.user!.id;

    if (!reservationId) {
      throw new AppError('Missing reservationId', 400);
    }

    await assertRoomInTenant(roomId, tenantId);
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
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { roomId } = req.params;
      const { issueDescription, maintenanceId } = req.body;
      const tenantId = resolveTenantId(req);
      const staffId = req.user!.id;

      if (!issueDescription) {
        throw new AppError('Missing issueDescription', 400);
      }

      await assertRoomInTenant(roomId, tenantId);
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
router.post('/:roomId/cleaned', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const tenantId = resolveTenantId(req);
    const staffId = req.user!.id;

    await assertRoomInTenant(roomId, tenantId);
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
router.put('/:roomId/block', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { roomId } = req.params;
    const { blockReason } = req.body;
    const tenantId = resolveTenantId(req);
    const staffId = req.user!.id;

    await assertRoomInTenant(roomId, tenantId);
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
router.get('/status/changes', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { lastSync } = req.query;
    const tenantId = resolveTenantId(req);

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

export default router;
