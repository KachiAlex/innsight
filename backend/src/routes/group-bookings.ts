import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import admin from 'firebase-admin';

export const groupBookingRouter = Router({ mergeParams: true });

// ============================================
// GROUP BOOKING CRUD
// ============================================

// GET /api/tenants/:tenantId/group-bookings - List group bookings
groupBookingRouter.get('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const { page, limit } = getPaginationParams(req);
    const { status, startDate, endDate } = req.query;

    let query: admin.firestore.Query = db.collection('group_bookings')
      .where('tenantId', '==', tenantId);

    if (status) {
      query = query.where('status', '==', status);
    }

    if (startDate && endDate) {
      query = query.where('checkInDate', '>=', toTimestamp(new Date(startDate as string)))
                   .where('checkInDate', '<=', toTimestamp(new Date(endDate as string)));
    }

    const snapshot = await query
      .orderBy('checkInDate', 'desc')
      .get();

    const groupBookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      checkInDate: toDate(doc.data().checkInDate),
      checkOutDate: toDate(doc.data().checkOutDate),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
      totalRevenue: Number(doc.data().totalRevenue || 0),
      depositAmount: doc.data().depositAmount ? Number(doc.data().depositAmount) : null,
    }));

    const total = groupBookings.length;
    const skip = (page - 1) * limit;
    const paginatedBookings = groupBookings.slice(skip, skip + limit);

    const result = createPaginationResult(paginatedBookings, total, page, limit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error('Error fetching group bookings:', error);
    throw new AppError(
      `Failed to fetch group bookings: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// POST /api/tenants/:tenantId/group-bookings - Create group booking
groupBookingRouter.post('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const bookingData = req.body;

    // Validate required fields
    if (!bookingData.groupName || !bookingData.contactPerson ||
        !bookingData.contactEmail || !bookingData.contactPhone) {
      throw new AppError('Group name, contact person, email, and phone are required', 400);
    }

    if (!bookingData.checkInDate || !bookingData.checkOutDate) {
      throw new AppError('Check-in and check-out dates are required', 400);
    }

    const checkInDate = bookingData.checkInDate ? new Date(bookingData.checkInDate.toDate()) : new Date();
    const checkOutDate = bookingData.checkOutDate ? new Date(bookingData.checkOutDate.toDate()) : new Date();

    if (checkInDate >= checkOutDate) {
      throw new AppError('Check-out date must be after check-in date', 400);
    }

    // Generate group booking number
    const timestamp = now();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const groupBookingNumber = `GB-${dateStr}-${randomStr}`;

    const bookingRecord = {
      tenantId,
      groupBookingNumber,
      groupName: bookingData.groupName,
      groupType: bookingData.groupType || 'other',
      contactPerson: bookingData.contactPerson,
      contactEmail: bookingData.contactEmail,
      contactPhone: bookingData.contactPhone,
      expectedGuests: bookingData.expectedGuests || 0,
      confirmedGuests: 0,
      checkInDate: toTimestamp(checkInDate),
      checkOutDate: toTimestamp(checkOutDate),
      totalRooms: bookingData.totalRooms || 0,
      totalRevenue: 0,
      depositAmount: bookingData.depositAmount || null,
      depositPaid: false,
      status: 'pending',
      bookingProgress: 'initial_contact',
      specialRequests: bookingData.specialRequests || null,
      dietaryRequirements: bookingData.dietaryRequirements || null,
      setupRequirements: bookingData.setupRequirements || null,
      assignedTo: bookingData.assignedTo || null,
      createdBy: req.user?.id || 'system',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const docRef = await db.collection('group_bookings').add(bookingRecord);

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...bookingRecord,
        checkInDate: toDate(bookingRecord.checkInDate),
        checkOutDate: toDate(bookingRecord.checkOutDate),
        createdAt: toDate(timestamp),
        updatedAt: toDate(timestamp),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating group booking:', error);
    throw new AppError(
      `Failed to create group booking: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/group-bookings/:bookingId - Get group booking details
groupBookingRouter.get('/:bookingId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const bookingId = req.params.bookingId;

    const bookingDoc = await db.collection('group_bookings').doc(bookingId).get();

    if (!bookingDoc.exists || bookingDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Group booking not found', 404);
    }

    // Get room blocks for this booking
    const roomBlocksSnapshot = await db.collection('room_blocks')
      .where('tenantId', '==', tenantId)
      .where('groupBookingId', '==', bookingId)
      .get();

    const roomBlocks = roomBlocksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      negotiatedRate: doc.data().negotiatedRate ? Number(doc.data().negotiatedRate) : null,
      discountPercent: doc.data().discountPercent ? Number(doc.data().discountPercent) : null,
      checkInDate: toDate(doc.data().checkInDate),
      checkOutDate: toDate(doc.data().checkOutDate),
      createdAt: toDate(doc.data().createdAt),
      updatedAt: toDate(doc.data().updatedAt),
    }));

    // Get reservations linked to this group booking
    const reservationsSnapshot = await db.collection('reservations')
      .where('tenantId', '==', tenantId)
      .where('groupBookingId', '==', bookingId)
      .get();

    const reservations = await Promise.all(
      reservationsSnapshot.docs.map(async (doc) => {
        const resData = doc.data();
        const roomDoc = await db.collection('rooms').doc(resData.roomId).get();

        return {
          id: doc.id,
          ...resData,
          checkInDate: toDate(resData.checkInDate),
          checkOutDate: toDate(resData.checkOutDate),
          rate: Number(resData.rate || 0),
          room: roomDoc.exists ? {
            roomNumber: roomDoc.data()?.roomNumber,
            roomType: roomDoc.data()?.roomType,
          } : null,
        };
      })
    );

    const bookingData = bookingDoc.data();

    const booking = {
      id: bookingDoc.id,
      ...bookingData,
      checkInDate: toDate(bookingData?.checkInDate),
      checkOutDate: toDate(bookingData?.checkOutDate),
      createdAt: toDate(bookingData?.createdAt),
      updatedAt: toDate(bookingData?.updatedAt),
      totalRevenue: Number(bookingData?.totalRevenue || 0),
      depositAmount: bookingData?.depositAmount ? Number(bookingData.depositAmount) : null,
      roomBlocks,
      reservations,
    };

    res.json({
      success: true,
      data: booking,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching group booking:', error);
    throw new AppError(
      `Failed to fetch group booking: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/group-bookings/:bookingId - Update group booking
groupBookingRouter.put('/:bookingId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const bookingId = req.params.bookingId;
    const updates = req.body;

    const bookingDoc = await db.collection('group_bookings').doc(bookingId).get();

    if (!bookingDoc.exists || bookingDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Group booking not found', 404);
    }

    const timestamp = now();
    const updatedData = {
      ...updates,
      updatedAt: timestamp,
    };

    // Handle date conversions
    if (updates.checkInDate) {
      updatedData.checkInDate = toTimestamp(new Date(updates.checkInDate));
    }
    if (updates.checkOutDate) {
      updatedData.checkOutDate = toTimestamp(new Date(updates.checkOutDate));
    }

    await db.collection('group_bookings').doc(bookingId).update(updatedData);

    const updatedDoc = await db.collection('group_bookings').doc(bookingId).get();
    const bookingData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...bookingData,
        checkInDate: toDate(bookingData?.checkInDate),
        checkOutDate: toDate(bookingData?.checkOutDate),
        createdAt: toDate(bookingData?.createdAt),
        updatedAt: toDate(bookingData?.updatedAt),
        totalRevenue: Number(bookingData?.totalRevenue || 0),
        depositAmount: bookingData?.depositAmount ? Number(bookingData?.depositAmount) : null,
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating group booking:', error);
    throw new AppError(
      `Failed to update group booking: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// DELETE /api/tenants/:tenantId/group-bookings/:bookingId - Delete group booking
groupBookingRouter.delete('/:bookingId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const bookingId = req.params.bookingId;

    const bookingDoc = await db.collection('group_bookings').doc(bookingId).get();

    if (!bookingDoc.exists || bookingDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Group booking not found', 404);
    }

    const bookingData = bookingDoc.data();

    // Check if there are any linked reservations
    const reservationsSnapshot = await db.collection('reservations')
      .where('tenantId', '==', tenantId)
      .where('groupBookingId', '==', bookingId)
      .limit(1)
      .get();

    if (!reservationsSnapshot.empty) {
      throw new AppError('Cannot delete group booking with existing reservations. Cancel reservations first.', 400);
    }

    // Delete room blocks
    const roomBlocksSnapshot = await db.collection('room_blocks')
      .where('tenantId', '==', tenantId)
      .where('groupBookingId', '==', bookingId)
      .get();

    const batch = db.batch();
    roomBlocksSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    batch.delete(db.collection('group_bookings').doc(bookingId));

    await batch.commit();

    res.json({
      success: true,
      message: 'Group booking deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error deleting group booking:', error);
    throw new AppError(
      `Failed to delete group booking: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// ROOM BLOCKS MANAGEMENT
// ============================================

// POST /api/tenants/:tenantId/group-bookings/:bookingId/room-blocks - Create room block
groupBookingRouter.post('/:bookingId/room-blocks', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const bookingId = req.params.bookingId;
    const blockData = req.body;

    // Validate group booking exists
    const bookingDoc = await db.collection('group_bookings').doc(bookingId).get();
    if (!bookingDoc.exists || bookingDoc.data()?.tenantId !== tenantId) {
      throw new AppError('Group booking not found', 404);
    }

    // Validate required fields
    if (!blockData.roomCategoryId || !blockData.totalRooms) {
      throw new AppError('Room category and total rooms are required', 400);
    }

    const bookingData = bookingDoc.data();
    const blockRecord = {
      tenantId,
      groupBookingId: bookingId,
      roomCategoryId: blockData.roomCategoryId,
      roomType: blockData.roomType || '',
      totalRooms: blockData.totalRooms,
      allocatedRooms: 0,
      availableRooms: blockData.totalRooms,
      negotiatedRate: blockData.negotiatedRate || null,
      discountPercent: blockData.discountPercent || null,
      checkInDate: bookingData?.checkInDate,
      checkOutDate: bookingData?.checkOutDate,
      createdAt: now(),
      updatedAt: now(),
    };

    const docRef = await db.collection('room_blocks').add(blockRecord);

    // Update group booking total rooms
    const currentTotalRooms = bookingData?.totalRooms || 0;
    await db.collection('group_bookings').doc(bookingId).update({
      totalRooms: currentTotalRooms + blockData.totalRooms,
      updatedAt: now(),
    });

    res.json({
      success: true,
      data: {
        id: docRef.id,
        ...blockRecord,
        negotiatedRate: blockRecord.negotiatedRate ? Number(blockRecord.negotiatedRate) : null,
        discountPercent: blockRecord.discountPercent ? Number(blockRecord.discountPercent) : null,
        checkInDate: toDate(blockRecord.checkInDate),
        checkOutDate: toDate(blockRecord.checkOutDate),
        createdAt: toDate(blockRecord.createdAt),
        updatedAt: toDate(blockRecord.updatedAt),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating room block:', error);
    throw new AppError(
      `Failed to create room block: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// PUT /api/tenants/:tenantId/group-bookings/:bookingId/room-blocks/:blockId - Update room block
groupBookingRouter.put('/:bookingId/room-blocks/:blockId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const bookingId = req.params.bookingId;
    const blockId = req.params.blockId;
    const updates = req.body;

    const blockDoc = await db.collection('room_blocks').doc(blockId).get();

    if (!blockDoc.exists || blockDoc.data()?.tenantId !== tenantId || blockDoc.data()?.groupBookingId !== bookingId) {
      throw new AppError('Room block not found', 404);
    }

    const blockData = blockDoc.data();
    const oldTotalRooms = blockData?.totalRooms || 0;
    const newTotalRooms = updates.totalRooms || oldTotalRooms;
    const allocatedRooms = blockData?.allocatedRooms || 0;

    if (newTotalRooms < allocatedRooms) {
      throw new AppError('Cannot reduce total rooms below allocated rooms', 400);
    }

    const updatedData = {
      ...updates,
      availableRooms: newTotalRooms - allocatedRooms,
      updatedAt: now(),
    };

    await db.collection('room_blocks').doc(blockId).update(updatedData);

    // Update group booking total rooms if necessary
    if (oldTotalRooms !== newTotalRooms) {
      const bookingDoc = await db.collection('group_bookings').doc(bookingId).get();
      const bookingData = bookingDoc.data();
      const currentTotalRooms = bookingData?.totalRooms || 0;
      const newBookingTotalRooms = currentTotalRooms - oldTotalRooms + newTotalRooms;

      await db.collection('group_bookings').doc(bookingId).update({
        totalRooms: newBookingTotalRooms,
        updatedAt: now(),
      });
    }

    const updatedDoc = await db.collection('room_blocks').doc(blockId).get();
    const finalBlockData = updatedDoc.data();

    res.json({
      success: true,
      data: {
        id: updatedDoc.id,
        ...finalBlockData,
        negotiatedRate: finalBlockData?.negotiatedRate ? Number(finalBlockData.negotiatedRate) : null,
        discountPercent: finalBlockData?.discountPercent ? Number(finalBlockData.discountPercent) : null,
        checkInDate: toDate(finalBlockData?.checkInDate),
        checkOutDate: toDate(finalBlockData?.checkOutDate),
        createdAt: toDate(finalBlockData?.createdAt),
        updatedAt: toDate(finalBlockData?.updatedAt),
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating room block:', error);
    throw new AppError(
      `Failed to update room block: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// DELETE /api/tenants/:tenantId/group-bookings/:bookingId/room-blocks/:blockId - Delete room block
groupBookingRouter.delete('/:bookingId/room-blocks/:blockId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;
    const bookingId = req.params.bookingId;
    const blockId = req.params.blockId;

    const blockDoc = await db.collection('room_blocks').doc(blockId).get();

    if (!blockDoc.exists || blockDoc.data()?.tenantId !== tenantId || blockDoc.data()?.groupBookingId !== bookingId) {
      throw new AppError('Room block not found', 404);
    }

    const blockData = blockDoc.data();

    // Check if rooms are allocated
    if ((blockData?.allocatedRooms || 0) > 0) {
      throw new AppError('Cannot delete room block with allocated rooms. Deallocate rooms first.', 400);
    }

    // Update group booking total rooms
    const bookingDoc = await db.collection('group_bookings').doc(bookingId).get();
    const bookingData = bookingDoc.data();
    const currentTotalRooms = bookingData?.totalRooms || 0;
    const blockTotalRooms = blockData?.totalRooms || 0;

    await db.collection('group_bookings').doc(bookingId).update({
      totalRooms: Math.max(0, currentTotalRooms - blockTotalRooms),
      updatedAt: now(),
    });

    await db.collection('room_blocks').doc(blockId).delete();

    res.json({
      success: true,
      message: 'Room block deleted successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error deleting room block:', error);
    throw new AppError(
      `Failed to delete room block: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// ============================================
// GROUP BOOKING STATISTICS
// ============================================

// GET /api/tenants/:tenantId/group-bookings/stats - Get group booking statistics
groupBookingRouter.get('/stats/overview', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.tenantId;

    const bookingsSnapshot = await db.collection('group_bookings')
      .where('tenantId', '==', tenantId)
      .get();

    let stats = {
      totalBookings: 0,
      confirmedBookings: 0,
      pendingBookings: 0,
      totalRevenue: 0,
      totalRooms: 0,
      upcomingBookings: 0,
    };

    const now = new Date();
    bookingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      stats.totalBookings++;

      if (data.status === 'confirmed') stats.confirmedBookings++;
      if (data.status === 'pending') stats.pendingBookings++;

      stats.totalRevenue += Number(data.totalRevenue || 0);
      stats.totalRooms += Number(data.totalRooms || 0);

      const checkInDate = toDate(data.checkInDate);
      if (checkInDate && checkInDate > now) stats.upcomingBookings++;
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching group booking stats:', error);
    throw new AppError(
      `Failed to fetch group booking stats: ${error.message || 'Unknown error'}`,
      500
    );
  }
});
