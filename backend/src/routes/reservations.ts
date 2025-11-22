import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate, toTimestamp } from '../utils/firestore';
import { v4 as uuidv4 } from 'uuid';

export const reservationRouter = Router({ mergeParams: true });

const createReservationSchema = z.object({
  roomId: z.string().uuid(),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  guestIdNumber: z.string().optional(),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  rate: z.number().positive(),
  depositAmount: z.number().nonnegative().optional(),
  source: z.enum(['manual', 'web', 'ota', 'channel_manager']).default('manual'),
  specialRequests: z.string().optional(),
});

// POST /api/tenants/:tenantId/reservations
reservationRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createReservationSchema.parse(req.body);

      // Validate dates
      const checkIn = new Date(data.checkInDate);
      const checkOut = new Date(data.checkOutDate);
      if (checkOut <= checkIn) {
        throw new AppError('Check-out date must be after check-in date', 400);
      }

      // Check room availability
      const roomDoc = await db.collection('rooms').doc(data.roomId).get();
      if (!roomDoc.exists) {
        throw new AppError('Room not found', 404);
      }

      const roomData = roomDoc.data();
      if (roomData?.tenantId !== tenantId) {
        throw new AppError('Room not found', 404);
      }

      // Check for overlapping reservations
      const checkInTimestamp = toTimestamp(checkIn);
      const checkOutTimestamp = toTimestamp(checkOut);

      const overlappingSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .where('roomId', '==', data.roomId)
        .where('status', 'in', ['confirmed', 'checked_in'])
        .get();

      const overlapping = overlappingSnapshot.docs.find(doc => {
        const resData = doc.data();
        const resCheckIn = toDate(resData.checkInDate);
        const resCheckOut = toDate(resData.checkOutDate);
        
        if (!resCheckIn || !resCheckOut) return false;
        
        // Check if dates overlap
        return resCheckIn <= checkOut && resCheckOut >= checkIn;
      });

      if (overlapping) {
        throw new AppError('Room is not available for the selected dates', 400);
      }

      const reservationNumber = `RES-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      // Create reservation
      const reservationRef = db.collection('reservations').doc();
      const reservationData = {
        tenantId,
        roomId: data.roomId,
        reservationNumber,
        guestName: data.guestName,
        guestEmail: data.guestEmail || null,
        guestPhone: data.guestPhone || null,
        guestIdNumber: data.guestIdNumber || null,
        checkInDate: checkInTimestamp,
        checkOutDate: checkOutTimestamp,
        adults: data.adults,
        children: data.children,
        rate: data.rate,
        depositAmount: data.depositAmount || null,
        depositStatus: data.depositAmount ? 'pending' : null,
        source: data.source,
        specialRequests: data.specialRequests || null,
        createdBy: req.user!.id,
        status: 'confirmed',
        createdAt: now(),
        updatedAt: now(),
      };

      await reservationRef.set(reservationData);

      // Get room and creator data
      const creatorDoc = await db.collection('users').doc(req.user!.id).get();
      const creator = creatorDoc.exists ? {
        id: creatorDoc.id,
        firstName: creatorDoc.data()?.firstName || null,
        lastName: creatorDoc.data()?.lastName || null,
      } : null;

      const reservation = {
        id: reservationRef.id,
        ...reservationData,
        room: {
          id: roomDoc.id,
          ...roomData,
        },
        creator,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        createdAt: toDate(reservationData.createdAt),
        updatedAt: toDate(reservationData.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_reservation',
        entityType: 'reservation',
        entityId: reservationRef.id,
        afterState: reservation,
        metadata: {
          reservationNumber,
        },
      });

      res.status(201).json({
        success: true,
        data: reservation,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating reservation:', error);
      throw new AppError(
        `Failed to create reservation: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reservations/:id
reservationRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const reservationId = req.params.id;

      const reservationDoc = await db.collection('reservations').doc(reservationId).get();

      if (!reservationDoc.exists) {
        throw new AppError('Reservation not found', 404);
      }

      const reservationData = reservationDoc.data();
      if (reservationData?.tenantId !== tenantId) {
        throw new AppError('Reservation not found', 404);
      }

      // Get related data
      const [roomDoc, creatorDoc, checkInStaffDoc, checkOutStaffDoc, foliosSnapshot] = await Promise.all([
        db.collection('rooms').doc(reservationData.roomId).get(),
        reservationData.createdBy ? db.collection('users').doc(reservationData.createdBy).get() : Promise.resolve(null),
        reservationData.checkedInBy ? db.collection('users').doc(reservationData.checkedInBy).get() : Promise.resolve(null),
        reservationData.checkedOutBy ? db.collection('users').doc(reservationData.checkedOutBy).get() : Promise.resolve(null),
        db.collection('folios').where('reservationId', '==', reservationId).get(),
      ]);

      const room = roomDoc.exists ? {
        id: roomDoc.id,
        ...roomDoc.data(),
      } : null;

      const creator = creatorDoc?.exists ? {
        id: creatorDoc.id,
        firstName: creatorDoc.data()?.firstName || null,
        lastName: creatorDoc.data()?.lastName || null,
      } : null;

      const checkInStaff = checkInStaffDoc?.exists ? {
        id: checkInStaffDoc.id,
        firstName: checkInStaffDoc.data()?.firstName || null,
        lastName: checkInStaffDoc.data()?.lastName || null,
      } : null;

      const checkOutStaff = checkOutStaffDoc?.exists ? {
        id: checkOutStaffDoc.id,
        firstName: checkOutStaffDoc.data()?.firstName || null,
        lastName: checkOutStaffDoc.data()?.lastName || null,
      } : null;

      // Get folios with charges and payments
      const folios = await Promise.all(
        foliosSnapshot.docs.map(async (folioDoc) => {
          const folioData = folioDoc.data();
          const [chargesSnapshot, paymentsSnapshot] = await Promise.all([
            db.collection('folioCharges').where('folioId', '==', folioDoc.id).get(),
            db.collection('payments').where('folioId', '==', folioDoc.id).get(),
          ]);

          return {
            id: folioDoc.id,
            ...folioData,
            charges: chargesSnapshot.docs.map(c => ({ id: c.id, ...c.data() })),
            payments: paymentsSnapshot.docs.map(p => ({ id: p.id, ...p.data() })),
          };
        })
      );

      const reservation = {
        id: reservationDoc.id,
        ...reservationData,
        room,
        creator,
        checkInStaff,
        checkOutStaff,
        folios,
        checkInDate: toDate(reservationData.checkInDate),
        checkOutDate: toDate(reservationData.checkOutDate),
        checkedInAt: toDate(reservationData.checkedInAt),
        checkedOutAt: toDate(reservationData.checkedOutAt),
        createdAt: toDate(reservationData.createdAt),
        updatedAt: toDate(reservationData.updatedAt),
      };

      res.json({
        success: true,
        data: reservation,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching reservation:', error);
      throw new AppError(
        `Failed to fetch reservation: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/reservations
reservationRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, roomId, startDate, endDate } = req.query;

      const { page, limit } = getPaginationParams(req);

      // Build Firestore query
      let query: FirebaseFirestore.Query = db.collection('reservations')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }
      if (roomId) {
        query = query.where('roomId', '==', roomId);
      }

      // Get all reservations first (Firestore doesn't support complex OR queries)
      const allReservationsSnapshot = await query.get();
      
      // Filter by date range if provided
      let filteredReservations = allReservationsSnapshot.docs;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : null;
        const end = endDate ? new Date(endDate as string) : null;
        
        filteredReservations = filteredReservations.filter(doc => {
          const resData = doc.data();
          const checkIn = toDate(resData.checkInDate);
          const checkOut = toDate(resData.checkOutDate);
          
          if (!checkIn || !checkOut) return false;
          
          if (start && checkIn < start) return false;
          if (end && checkOut > end) return false;
          
          return true;
        });
      }

      const total = filteredReservations.length;

      // Apply pagination
      const skip = (page - 1) * limit;
      const paginatedReservations = filteredReservations
        .sort((a, b) => {
          const aCheckIn = toDate(a.data().checkInDate);
          const bCheckIn = toDate(b.data().checkInDate);
          if (!aCheckIn || !bCheckIn) return 0;
          return bCheckIn.getTime() - aCheckIn.getTime(); // Descending
        })
        .slice(skip, skip + limit);

      // Enrich with room data
      const reservations = await Promise.all(
        paginatedReservations.map(async (doc) => {
          const resData = doc.data();
          const roomDoc = await db.collection('rooms').doc(resData.roomId).get();
          const roomData = roomDoc.exists ? {
            id: roomDoc.id,
            roomNumber: roomDoc.data()?.roomNumber || null,
            roomType: roomDoc.data()?.roomType || null,
          } : null;

          return {
            id: doc.id,
            ...resData,
            room: roomData,
            checkInDate: toDate(resData.checkInDate),
            checkOutDate: toDate(resData.checkOutDate),
            createdAt: toDate(resData.createdAt),
            updatedAt: toDate(resData.updatedAt),
          };
        })
      );

      const result = createPaginationResult(reservations, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching reservations:', error);
      throw new AppError(
        `Failed to fetch reservations: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/rooms/:roomId/checkin
reservationRouter.post(
  '/:id/checkin',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const reservationId = req.params.id;
      const { photo } = req.body;

      const reservationDoc = await db.collection('reservations').doc(reservationId).get();
      if (!reservationDoc.exists) {
        throw new AppError('Reservation not found', 404);
      }

      const reservationData = reservationDoc.data();
      if (reservationData?.tenantId !== tenantId) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservationData.status !== 'confirmed') {
        throw new AppError('Reservation is not in confirmed status', 400);
      }

      // Get room data
      const roomDoc = await db.collection('rooms').doc(reservationData.roomId).get();
      if (!roomDoc.exists) {
        throw new AppError('Room not found', 404);
      }

      const beforeState = {
        id: reservationDoc.id,
        ...reservationData,
        room: { id: roomDoc.id, ...roomDoc.data() },
      };

      // Use Firestore batch for atomic operations
      const batch = db.batch();

      // Update reservation
      batch.update(reservationDoc.ref, {
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

      // Check if folio exists
      const existingFoliosSnapshot = await db.collection('folios')
        .where('reservationId', '==', reservationId)
        .where('tenantId', '==', tenantId)
        .limit(1)
        .get();

      if (existingFoliosSnapshot.empty) {
        // Create folio
        const folioRef = db.collection('folios').doc();
        batch.set(folioRef, {
          tenantId,
          reservationId,
          roomId: reservationData.roomId,
          guestName: reservationData.guestName,
          createdBy: req.user!.id,
          status: 'open',
          totalCharges: reservationData.rate,
          totalPayments: 0,
          balance: reservationData.rate,
          createdAt: now(),
          updatedAt: now(),
        });

        // Add room rate charge
        const chargeRef = db.collection('folioCharges').doc();
        batch.set(chargeRef, {
          folioId: folioRef.id,
          description: `Room rate - ${roomDoc.data()?.roomNumber || 'N/A'}`,
          category: 'room_rate',
          amount: reservationData.rate,
          quantity: 1,
          total: reservationData.rate,
          createdAt: now(),
        });
      }

      await batch.commit();

      // Get updated reservation
      const updatedDoc = await db.collection('reservations').doc(reservationId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        checkInDate: toDate(updatedData?.checkInDate),
        checkOutDate: toDate(updatedData?.checkOutDate),
        checkedInAt: toDate(updatedData?.checkedInAt),
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'checkin',
        entityType: 'reservation',
        entityId: reservationId,
        beforeState,
        afterState: updated,
        metadata: {
          photo: photo || null,
          roomId: reservationData.roomId,
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error checking in reservation:', error);
      throw new AppError(
        `Failed to check in reservation: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/rooms/:roomId/checkout
reservationRouter.post(
  '/:id/checkout',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const reservationId = req.params.id;
      const { finalCharges, paymentInfo } = req.body;

      const reservationDoc = await db.collection('reservations').doc(reservationId).get();
      if (!reservationDoc.exists) {
        throw new AppError('Reservation not found', 404);
      }

      const reservationData = reservationDoc.data();
      if (reservationData?.tenantId !== tenantId) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservationData.status !== 'checked_in') {
        throw new AppError('Reservation is not checked in', 400);
      }

      // Get room and folios
      const [roomDoc, foliosSnapshot] = await Promise.all([
        db.collection('rooms').doc(reservationData.roomId).get(),
        db.collection('folios').where('reservationId', '==', reservationId).limit(1).get(),
      ]);

      if (!roomDoc.exists) {
        throw new AppError('Room not found', 404);
      }

      const beforeState = {
        id: reservationDoc.id,
        ...reservationData,
        room: { id: roomDoc.id, ...roomDoc.data() },
      };

      // Use Firestore batch for atomic operations
      const batch = db.batch();

      // Update reservation
      batch.update(reservationDoc.ref, {
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

      await batch.commit();

      // Get updated reservation
      const updatedDoc = await db.collection('reservations').doc(reservationId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        checkInDate: toDate(updatedData?.checkInDate),
        checkOutDate: toDate(updatedData?.checkOutDate),
        checkedInAt: toDate(updatedData?.checkedInAt),
        checkedOutAt: toDate(updatedData?.checkedOutAt),
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'checkout',
        entityType: 'reservation',
        entityId: reservationId,
        beforeState,
        afterState: updated,
        metadata: {
          finalCharges,
          paymentInfo,
        },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error checking out reservation:', error);
      throw new AppError(
        `Failed to check out reservation: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);
