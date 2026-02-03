import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';
// import { db, now, toDate, toTimestamp } from '../utils/firestore';
import { createRoomLog } from '../utils/roomLogs';
import { v4 as uuidv4 } from 'uuid';
// import admin from 'firebase-admin';

export const groupBookingRouter = Router({ mergeParams: true });

const getUserDisplayName = (user?: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) => {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || null;
};

// Schema for creating a group booking
const createGroupBookingSchema = z.object({
  roomIds: z.array(z.string().uuid()).min(1, 'At least one room is required'),
  guestName: z.string().min(1),
  guestEmail: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().email().optional()
  ),
  guestPhone: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  guestIdNumber: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  rates: z.record(z.string().uuid(), z.number().positive()).optional(), // roomId -> rate mapping
  depositAmount: z.number().nonnegative().optional(),
  source: z.enum(['manual', 'web', 'ota', 'channel_manager']).default('manual'),
  specialRequests: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
  groupName: z.string().optional(), // Optional name for the group (e.g., "Smith Family", "Corporate Retreat")
});

// POST /api/tenants/:tenantId/group-bookings
groupBookingRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createGroupBookingSchema.parse(req.body);

      // Validate dates
      const checkIn = new Date(data.checkInDate);
      const checkOut = new Date(data.checkOutDate);

      if (checkOut <= checkIn) {
        throw new AppError('Check-out date must be after check-in date', 400);
      }

      // Validate all rooms exist and belong to tenant
      const roomDocs = await Promise.all(
        data.roomIds.map(roomId => db.collection('rooms').doc(roomId).get())
      );

      const invalidRooms = roomDocs.filter((doc, index) => {
        if (!doc.exists) return true;
        const roomData = doc.data();
        return roomData?.tenantId !== tenantId;
      });

      if (invalidRooms.length > 0) {
        throw new AppError('One or more rooms not found', 404);
      }

      // Check for overlapping reservations for all rooms
      const checkInTimestamp = toTimestamp(checkIn);
      const checkOutTimestamp = toTimestamp(checkOut);

      for (const roomId of data.roomIds) {
        const overlappingSnapshot = await db.collection('reservations')
          .where('tenantId', '==', tenantId)
          .where('roomId', '==', roomId)
          .where('status', 'in', ['confirmed', 'checked_in'])
          .get();

        const overlapping = overlappingSnapshot.docs.find(doc => {
          const resData = doc.data();
          const resCheckIn = toDate(resData.checkInDate);
          const resCheckOut = toDate(resData.checkOutDate);
          
          if (!resCheckIn || !resCheckOut) return false;
          
          return resCheckIn <= checkOut && resCheckOut >= checkIn;
        });

        if (overlapping) {
          throw new AppError(`Room ${roomDocs.find((_, i) => data.roomIds[i] === roomId)?.data()?.roomNumber || roomId} is not available for the selected dates`, 400);
        }
      }

      // Generate group booking number
      const groupBookingNumber = `GRP-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      // Use Firestore batch for atomic operations
      const batch = db.batch();

      // Create group booking record
      const groupBookingRef = db.collection('groupBookings').doc();
      const groupBookingData = {
        tenantId,
        groupBookingNumber,
        groupName: data.groupName || null,
        guestName: data.guestName,
        guestEmail: data.guestEmail || null,
        guestPhone: data.guestPhone || null,
        guestIdNumber: data.guestIdNumber || null,
        checkInDate: checkInTimestamp,
        checkOutDate: checkOutTimestamp,
        adults: data.adults,
        children: data.children,
        totalRooms: data.roomIds.length,
        depositAmount: data.depositAmount || null,
        depositStatus: data.depositAmount ? 'pending' : null,
        source: data.source,
        specialRequests: data.specialRequests || null,
        createdBy: req.user!.id,
        status: 'confirmed', // confirmed, partially_checked_in, checked_in, partially_checked_out, checked_out, cancelled
        createdAt: now(),
        updatedAt: now(),
      };

      batch.set(groupBookingRef, groupBookingData);

      // Create individual reservations for each room
      const reservationRefs: string[] = [];
      let totalRate = 0;

      for (const roomId of data.roomIds) {
        const roomData = roomDocs.find((_, i) => data.roomIds[i] === roomId)?.data();
        
        // Get rate for this room (custom override, provided mapping, then rate plan)
        let roomRate = data.rates?.[roomId];
        if (!roomRate && roomData?.customRate) {
          roomRate = Number(roomData.customRate);
        }
        if (!roomRate && roomData?.ratePlanId) {
          const ratePlanDoc = await db.collection('ratePlans').doc(roomData.ratePlanId).get();
          if (ratePlanDoc.exists) {
            roomRate = Number(ratePlanDoc.data()?.baseRate || 0);
          }
        }
        if (!roomRate) {
          throw new AppError(`No rate found for room ${roomData?.roomNumber || roomId}`, 400);
        }

        totalRate += roomRate;

        const reservationNumber = `RES-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
        const reservationRef = db.collection('reservations').doc();
        reservationRefs.push(reservationRef.id);

        const reservationData = {
          tenantId,
          roomId,
          groupBookingId: groupBookingRef.id,
          reservationNumber,
          guestName: data.guestName,
          guestEmail: data.guestEmail || null,
          guestPhone: data.guestPhone || null,
          guestIdNumber: data.guestIdNumber || null,
          checkInDate: checkInTimestamp,
          checkOutDate: checkOutTimestamp,
          adults: data.adults,
          children: data.children,
          rate: roomRate,
          depositAmount: null, // Deposits handled at group level
          depositStatus: null,
          source: data.source,
          specialRequests: data.specialRequests || null,
          createdBy: req.user!.id,
          status: 'confirmed',
          createdAt: now(),
          updatedAt: now(),
        };

        batch.set(reservationRef, reservationData);
      }

      // Update group booking with total rate
      batch.update(groupBookingRef, {
        totalRate,
        reservationIds: reservationRefs,
      });

      await batch.commit();

      // Get created group booking with reservations
      const groupBookingDoc = await groupBookingRef.get();
      const groupBookingDataFinal = groupBookingDoc.data();

      const reservations = await Promise.all(
        reservationRefs.map(async (resId) => {
          const resDoc = await db.collection('reservations').doc(resId).get();
          const resData = resDoc.data();
          const roomDoc = await db.collection('rooms').doc(resData?.roomId).get();
          
          return {
            id: resDoc.id,
            reservationNumber: resData?.reservationNumber,
            roomId: resData?.roomId,
            room: roomDoc.exists ? {
              id: roomDoc.id,
              roomNumber: roomDoc.data()?.roomNumber,
              roomType: roomDoc.data()?.roomType,
            } : null,
            rate: Number(resData?.rate || 0),
            status: resData?.status,
          };
        })
      );

      const groupBooking = {
        id: groupBookingDoc.id,
        ...groupBookingDataFinal,
        checkInDate: toDate(groupBookingDataFinal?.checkInDate),
        checkOutDate: toDate(groupBookingDataFinal?.checkOutDate),
        totalRate: Number(groupBookingDataFinal?.totalRate || 0),
        createdAt: toDate(groupBookingDataFinal?.createdAt),
        updatedAt: toDate(groupBookingDataFinal?.updatedAt),
        reservations,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_group_booking',
        entityType: 'group_booking',
        entityId: groupBookingRef.id,
        afterState: groupBooking,
        metadata: {
          groupBookingNumber,
          totalRooms: data.roomIds.length,
        },
      });

      res.status(201).json({
        success: true,
        data: groupBooking,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const message = error.errors?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') || 'Invalid group booking data';
        throw new AppError(message, 400);
      }
      console.error('Error creating group booking:', error);
      throw new AppError(
        `Failed to create group booking: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/group-bookings
groupBookingRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, startDate, endDate } = req.query;

      const { page, limit } = require('../utils/pagination').getPaginationParams(req);

      let query: admin.firestore.Query = db.collection('groupBookings')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.get();

      // Filter by date range if provided
      let filteredBookings = snapshot.docs;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : null;
        const end = endDate ? new Date(endDate as string) : null;

        filteredBookings = filteredBookings.filter(doc => {
          const bookingData = doc.data();
          const checkIn = toDate(bookingData.checkInDate);
          const checkOut = toDate(bookingData.checkOutDate);
          
          if (!checkIn || !checkOut) return false;
          
          if (start && checkOut < start) return false;
          if (end && checkIn > end) return false;
          
          return true;
        });
      }

      const total = filteredBookings.length;
      const skip = (page - 1) * limit;
      const paginatedBookings = filteredBookings
        .sort((a, b) => {
          const aCreated = toDate(a.data().createdAt);
          const bCreated = toDate(b.data().createdAt);
          if (!aCreated || !bCreated) return 0;
          return bCreated.getTime() - aCreated.getTime();
        })
        .slice(skip, skip + limit);

      const groupBookings = await Promise.all(
        paginatedBookings.map(async (doc) => {
          const bookingData = doc.data();
          const reservationIds = bookingData.reservationIds || [];

          // Get reservation summaries
          const reservations = await Promise.all(
            reservationIds.slice(0, 5).map(async (resId: string) => {
              const resDoc = await db.collection('reservations').doc(resId).get();
              if (!resDoc.exists) return null;
              
              const resData = resDoc.data();
              const roomDoc = await db.collection('rooms').doc(resData?.roomId).get();
              
              return {
                id: resDoc.id,
                reservationNumber: resData?.reservationNumber,
                roomNumber: roomDoc.exists ? roomDoc.data()?.roomNumber : null,
                status: resData?.status,
              };
            })
          );

          return {
            id: doc.id,
            ...bookingData,
            checkInDate: toDate(bookingData.checkInDate),
            checkOutDate: toDate(bookingData.checkOutDate),
            totalRate: Number(bookingData.totalRate || 0),
            createdAt: toDate(bookingData.createdAt),
            updatedAt: toDate(bookingData.updatedAt),
            reservations: reservations.filter(Boolean),
            totalReservations: reservationIds.length,
          };
        })
      );

      const result = require('../utils/pagination').createPaginationResult(groupBookings, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching group bookings:', error);
      throw new AppError(
        `Failed to fetch group bookings: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/group-bookings/:id
groupBookingRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const groupBookingId = req.params.id;

      const groupBookingDoc = await db.collection('groupBookings').doc(groupBookingId).get();

      if (!groupBookingDoc.exists) {
        throw new AppError('Group booking not found', 404);
      }

      const groupBookingData = groupBookingDoc.data();
      if (groupBookingData?.tenantId !== tenantId) {
        throw new AppError('Group booking not found', 404);
      }

      // Get all reservations
      const reservationIds = groupBookingData.reservationIds || [];
      const reservations = await Promise.all(
        reservationIds.map(async (resId: string) => {
          const resDoc = await db.collection('reservations').doc(resId).get();
          if (!resDoc.exists) return null;
          
          const resData = resDoc.data();
          const roomDoc = await db.collection('rooms').doc(resData?.roomId).get();
          
          // Get folios for this reservation
          const foliosSnapshot = await db.collection('folios')
            .where('reservationId', '==', resDoc.id)
            .get();

          return {
            id: resDoc.id,
            reservationNumber: resData?.reservationNumber,
            roomId: resData?.roomId,
            room: roomDoc.exists ? {
              id: roomDoc.id,
              roomNumber: roomDoc.data()?.roomNumber,
              roomType: roomDoc.data()?.roomType,
              floor: roomDoc.data()?.floor,
            } : null,
            rate: Number(resData?.rate || 0),
            status: resData?.status,
            checkedInAt: toDate(resData?.checkedInAt),
            checkedOutAt: toDate(resData?.checkedOutAt),
            folios: foliosSnapshot.docs.map(f => ({
              id: f.id,
              ...f.data(),
              status: f.data().status,
              balance: Number(f.data().balance || 0),
            })),
          };
        })
      );

      const groupBooking = {
        id: groupBookingDoc.id,
        ...groupBookingData,
        checkInDate: toDate(groupBookingData.checkInDate),
        checkOutDate: toDate(groupBookingData.checkOutDate),
        totalRate: Number(groupBookingData.totalRate || 0),
        createdAt: toDate(groupBookingData.createdAt),
        updatedAt: toDate(groupBookingData.updatedAt),
        reservations: reservations.filter(Boolean),
      };

      res.json({
        success: true,
        data: groupBooking,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching group booking:', error);
      throw new AppError(
        `Failed to fetch group booking: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/group-bookings/:id/checkin
groupBookingRouter.post(
  '/:id/checkin',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const groupBookingId = req.params.id;

      const groupBookingDoc = await db.collection('groupBookings').doc(groupBookingId).get();
      if (!groupBookingDoc.exists) {
        throw new AppError('Group booking not found', 404);
      }

      const groupBookingData = groupBookingDoc.data();
      if (groupBookingData?.tenantId !== tenantId) {
        throw new AppError('Group booking not found', 404);
      }

      if (groupBookingData.status === 'cancelled') {
        throw new AppError('Cannot check in a cancelled group booking', 400);
      }

      const reservationIds = groupBookingData.reservationIds || [];
      if (reservationIds.length === 0) {
        throw new AppError('No reservations found for this group booking', 400);
      }

      const batch = db.batch();
      let checkedInCount = 0;
      let failedRooms: string[] = [];

      // Check in all confirmed reservations
      for (const resId of reservationIds) {
        const resDoc = await db.collection('reservations').doc(resId).get();
        if (!resDoc.exists) continue;

        const resData = resDoc.data();
        if (resData?.status !== 'confirmed') {
          if (resData?.status === 'checked_in') checkedInCount++;
          continue;
        }

        // Get room
        const roomDoc = await db.collection('rooms').doc(resData.roomId).get();
        if (!roomDoc.exists) {
          failedRooms.push(resData.roomId);
          continue;
        }

        // Update reservation
        batch.update(resDoc.ref, {
          status: 'checked_in',
          checkedInAt: now(),
          checkedInBy: req.user!.id,
          updatedAt: now(),
        });

        // Update room status
        batch.update(roomDoc.ref, {
          status: 'occupied',
          updatedAt: now(),
        });

        // Create folio if doesn't exist
        const existingFoliosSnapshot = await db.collection('folios')
          .where('reservationId', '==', resId)
          .where('tenantId', '==', tenantId)
          .limit(1)
          .get();

        if (existingFoliosSnapshot.empty) {
          const folioRef = db.collection('folios').doc();
          batch.set(folioRef, {
            tenantId,
            reservationId: resId,
            groupBookingId: groupBookingId,
            roomId: resData.roomId,
            guestName: resData.guestName,
            createdBy: req.user!.id,
            status: 'open',
            totalCharges: resData.rate,
            totalPayments: 0,
            balance: resData.rate,
            createdAt: now(),
            updatedAt: now(),
          });

          // Add room rate charge
          const chargeRef = db.collection('folioCharges').doc();
          batch.set(chargeRef, {
            folioId: folioRef.id,
            description: `Room rate - ${roomDoc.data()?.roomNumber || 'N/A'}`,
            category: 'room_rate',
            amount: resData.rate,
            quantity: 1,
            total: resData.rate,
            createdAt: now(),
          });
        }

        checkedInCount++;
      }

      await batch.commit();

      // Update group booking status
      let newStatus = 'confirmed';
      if (checkedInCount === reservationIds.length) {
        newStatus = 'checked_in';
      } else if (checkedInCount > 0) {
        newStatus = 'partially_checked_in';
      }

      await groupBookingDoc.ref.update({
        status: newStatus,
        updatedAt: now(),
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'group_checkin',
        entityType: 'group_booking',
        entityId: groupBookingId,
        metadata: {
          checkedInCount,
          totalRooms: reservationIds.length,
          failedRooms: failedRooms.length > 0 ? failedRooms : null,
        },
      });

      res.json({
        success: true,
        message: `Checked in ${checkedInCount} of ${reservationIds.length} rooms`,
        data: {
          checkedInCount,
          totalRooms: reservationIds.length,
          status: newStatus,
          failedRooms: failedRooms.length > 0 ? failedRooms : null,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error checking in group booking:', error);
      throw new AppError(
        `Failed to check in group booking: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/group-bookings/:id/checkout
groupBookingRouter.post(
  '/:id/checkout',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const groupBookingId = req.params.id;

      const groupBookingDoc = await db.collection('groupBookings').doc(groupBookingId).get();
      if (!groupBookingDoc.exists) {
        throw new AppError('Group booking not found', 404);
      }

      const groupBookingData = groupBookingDoc.data();
      if (groupBookingData?.tenantId !== tenantId) {
        throw new AppError('Group booking not found', 404);
      }

      const reservationIds = groupBookingData.reservationIds || [];
      if (reservationIds.length === 0) {
        throw new AppError('No reservations found for this group booking', 400);
      }

      const batch = db.batch();
      let checkedOutCount = 0;
      let failedRooms: string[] = [];

      // Check out all checked-in reservations
      for (const resId of reservationIds) {
        const resDoc = await db.collection('reservations').doc(resId).get();
        if (!resDoc.exists) continue;

        const resData = resDoc.data();
        if (resData?.status !== 'checked_in') {
          if (resData?.status === 'checked_out') checkedOutCount++;
          continue;
        }

        // Get room and folios
        const [roomDoc, foliosSnapshot] = await Promise.all([
          db.collection('rooms').doc(resData.roomId).get(),
          db.collection('folios').where('reservationId', '==', resId).limit(1).get(),
        ]);

        if (!roomDoc.exists) {
          failedRooms.push(resData.roomId);
          continue;
        }

        // Update reservation
        batch.update(resDoc.ref, {
          status: 'checked_out',
          checkedOutAt: now(),
          checkedOutBy: req.user!.id,
          updatedAt: now(),
        });

        // Update room status
        batch.update(roomDoc.ref, {
          status: 'dirty',
          updatedAt: now(),
        });

        // Close folio if exists
        if (!foliosSnapshot.empty) {
          const folioDoc = foliosSnapshot.docs[0];
          batch.update(folioDoc.ref, {
            status: 'closed',
            closedAt: now(),
            closedBy: req.user!.id,
            updatedAt: now(),
          });
        }

        checkedOutCount++;
      }

      await batch.commit();

      // Update group booking status
      let newStatus = 'checked_in';
      if (checkedOutCount === reservationIds.length) {
        newStatus = 'checked_out';
      } else if (checkedOutCount > 0) {
        newStatus = 'partially_checked_out';
      }

      await groupBookingDoc.ref.update({
        status: newStatus,
        updatedAt: now(),
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'group_checkout',
        entityType: 'group_booking',
        entityId: groupBookingId,
        metadata: {
          checkedOutCount,
          totalRooms: reservationIds.length,
          failedRooms: failedRooms.length > 0 ? failedRooms : null,
        },
      });

      res.json({
        success: true,
        message: `Checked out ${checkedOutCount} of ${reservationIds.length} rooms`,
        data: {
          checkedOutCount,
          totalRooms: reservationIds.length,
          status: newStatus,
          failedRooms: failedRooms.length > 0 ? failedRooms : null,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error checking out group booking:', error);
      throw new AppError(
        `Failed to check out group booking: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/group-bookings/:id/cancel
groupBookingRouter.post(
  '/:id/cancel',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const groupBookingId = req.params.id;
      const { reason } = req.body;

      const groupBookingDoc = await db.collection('groupBookings').doc(groupBookingId).get();
      if (!groupBookingDoc.exists) {
        throw new AppError('Group booking not found', 404);
      }

      const groupBookingData = groupBookingDoc.data();
      if (groupBookingData?.tenantId !== tenantId) {
        throw new AppError('Group booking not found', 404);
      }

      if (groupBookingData.status === 'cancelled') {
        throw new AppError('Group booking is already cancelled', 400);
      }

      if (groupBookingData.status === 'checked_out') {
        throw new AppError('Cannot cancel a checked-out group booking', 400);
      }

      const reservationIds = groupBookingData.reservationIds || [];
      const batch = db.batch();

      // Cancel all reservations
      for (const resId of reservationIds) {
        const resDoc = await db.collection('reservations').doc(resId).get();
        if (!resDoc.exists) continue;

        const resData = resDoc.data();
        if (resData?.status === 'cancelled') continue;

        // Only cancel if not checked in
        if (resData?.status === 'checked_in') {
          throw new AppError('Cannot cancel group booking with checked-in rooms. Please check out first.', 400);
        }

        batch.update(resDoc.ref, {
          status: 'cancelled',
          updatedAt: now(),
        });

        // Update room status if it was reserved
        if (resData?.roomId) {
          const roomDoc = await db.collection('rooms').doc(resData.roomId).get();
          if (roomDoc.exists && roomDoc.data()?.status === 'reserved') {
            batch.update(roomDoc.ref, {
              status: 'available',
              updatedAt: now(),
            });
          }
        }
      }

      // Update group booking
      batch.update(groupBookingDoc.ref, {
        status: 'cancelled',
        updatedAt: now(),
      });

      await batch.commit();

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'cancel_group_booking',
        entityType: 'group_booking',
        entityId: groupBookingId,
        metadata: {
          reason: reason || null,
          totalRooms: reservationIds.length,
        },
      });

      res.json({
        success: true,
        message: 'Group booking cancelled successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error cancelling group booking:', error);
      throw new AppError(
        `Failed to cancel group booking: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

