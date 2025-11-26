import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp } from '../utils/firestore';
import { startOfDay, endOfDay, eachDayOfInterval, format, isWithinInterval } from 'date-fns';
import admin from 'firebase-admin';
export const calendarRouter = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/calendar
// Get room availability calendar for a date range
calendarRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate, roomType, status } = req.query;

      // Default to current month if no dates provided
      const start = startDate ? new Date(startDate as string) : startOfDay(new Date());
      const end = endDate ? endOfDay(new Date(endDate as string)) : endOfDay(new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)); // Default 30 days

      if (end <= start) {
        throw new AppError('End date must be after start date', 400);
      }

      // Get all rooms for this tenant
      let roomsQuery: admin.firestore.Query = db.collection('rooms')
        .where('tenantId', '==', tenantId);

      if (roomType) {
        roomsQuery = roomsQuery.where('roomType', '==', roomType);
      }
      if (status) {
        roomsQuery = roomsQuery.where('status', '==', status);
      }

      const roomsSnapshot = await roomsQuery.get();
      const rooms = roomsSnapshot.docs.map(doc => {
        const roomData = doc.data();
        return {
          id: doc.id,
          ...roomData,
          roomNumber: roomData.roomNumber || '',
          roomType: roomData.roomType || '',
          status: roomData.status || 'available',
          maxOccupancy: roomData.maxOccupancy || 2,
        };
      });

      // Get all reservations that overlap with the date range
      const reservationsSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .get();

      // Filter reservations that overlap with the date range
      const overlappingReservations = reservationsSnapshot.docs
        .map(doc => {
          const resData = doc.data();
          const checkIn = toDate(resData.checkInDate);
          const checkOut = toDate(resData.checkOutDate);

          if (!checkIn || !checkOut) return null;

          // Check if reservation overlaps with the date range
          // Reservation overlaps if: checkIn < end && checkOut > start
          if (checkIn < end && checkOut > start) {
            return {
              id: doc.id,
              ...resData,
              roomId: resData.roomId,
              guestName: resData.guestName || '',
              checkInDate: checkIn,
              checkOutDate: checkOut,
              status: resData.status || 'confirmed',
              rate: Number(resData.rate || 0),
            };
          }
          return null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      // Generate array of dates in the range
      const dates = eachDayOfInterval({ start, end });

      // Build calendar data structure
      const calendarData = rooms.map(room => {
        // Get reservations for this room
        const roomReservations = overlappingReservations.filter(r => r.roomId === room.id);

        // Build availability for each date
        const availability = dates.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const dateStart = startOfDay(date);
          const dateEnd = endOfDay(date);

          // Find reservations that cover this date
          const reservationsForDate = roomReservations.filter(res => {
            return res.checkInDate <= dateEnd && res.checkOutDate > dateStart;
          });

          // Determine status for this date
          let dayStatus: 'available' | 'occupied' | 'check_in' | 'check_out' | 'blocked' = 'available';
          let reservation: any = null;

          if (reservationsForDate.length > 0) {
            const primaryReservation = reservationsForDate[0];
            reservation = {
              id: primaryReservation.id,
              guestName: primaryReservation.guestName,
              checkInDate: primaryReservation.checkInDate,
              checkOutDate: primaryReservation.checkOutDate,
              status: primaryReservation.status,
              rate: primaryReservation.rate,
            };

            // Check if it's check-in or check-out day
            const isCheckIn = format(primaryReservation.checkInDate, 'yyyy-MM-dd') === dateStr;
            const isCheckOut = format(primaryReservation.checkOutDate, 'yyyy-MM-dd') === dateStr;

            if (primaryReservation.status === 'checked_in' || primaryReservation.status === 'checked_out') {
              dayStatus = primaryReservation.status === 'checked_in' ? 'occupied' : 'available';
            } else if (isCheckIn) {
              dayStatus = 'check_in';
            } else if (isCheckOut) {
              dayStatus = 'check_out';
            } else {
              dayStatus = 'occupied';
            }
          } else if (room.status === 'out_of_order' || room.status === 'maintenance') {
            dayStatus = 'blocked';
          }

          return {
            date: dateStr,
            status: dayStatus,
            reservation,
          };
        });

        return {
          room: {
            id: room.id,
            roomNumber: room.roomNumber,
            roomType: room.roomType,
            status: room.status,
            maxOccupancy: room.maxOccupancy,
          },
          availability,
        };
      });

      // Sort rooms by room number
      calendarData.sort((a, b) => {
        const numA = parseInt(a.room.roomNumber) || 0;
        const numB = parseInt(b.room.roomNumber) || 0;
        return numA - numB;
      });

      res.json({
        success: true,
        data: {
          startDate: format(start, 'yyyy-MM-dd'),
          endDate: format(end, 'yyyy-MM-dd'),
          rooms: calendarData,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching calendar:', error);
      throw new AppError(
        `Failed to fetch calendar: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/calendar/move-reservation
// Move a reservation to a different room/date (for drag-and-drop)
calendarRouter.post(
  '/move-reservation',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { reservationId, newRoomId, newCheckInDate, newCheckOutDate } = req.body;

      if (!reservationId || !newRoomId || !newCheckInDate || !newCheckOutDate) {
        throw new AppError('Missing required fields: reservationId, newRoomId, newCheckInDate, newCheckOutDate', 400);
      }

      const checkIn = new Date(newCheckInDate);
      const checkOut = new Date(newCheckOutDate);

      if (checkOut <= checkIn) {
        throw new AppError('Check-out date must be after check-in date', 400);
      }

      // Get reservation
      const reservationDoc = await db.collection('reservations').doc(reservationId).get();
      if (!reservationDoc.exists) {
        throw new AppError('Reservation not found', 404);
      }

      const reservationData = reservationDoc.data();
      if (reservationData?.tenantId !== tenantId) {
        throw new AppError('Reservation not found', 404);
      }

      // Check if new room exists
      const newRoomDoc = await db.collection('rooms').doc(newRoomId).get();
      if (!newRoomDoc.exists) {
        throw new AppError('Room not found', 404);
      }

      const newRoomData = newRoomDoc.data();
      if (newRoomData?.tenantId !== tenantId) {
        throw new AppError('Room not found', 404);
      }

      // Check for overlapping reservations in the new room
      const overlappingSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .where('roomId', '==', newRoomId)
        .where('status', 'in', ['confirmed', 'checked_in'])
        .get();

      const overlapping = overlappingSnapshot.docs.find(doc => {
        if (doc.id === reservationId) return false; // Skip the current reservation
        const resData = doc.data();
        const resCheckIn = toDate(resData.checkInDate);
        const resCheckOut = toDate(resData.checkOutDate);
        
        if (!resCheckIn || !resCheckOut) return false;
        
        // Check if dates overlap
        return resCheckIn < checkOut && resCheckOut > checkIn;
      });

      if (overlapping) {
        throw new AppError('Room is not available for the selected dates', 400);
      }

      // Update reservation
      await reservationDoc.ref.update({
        roomId: newRoomId,
        checkInDate: toTimestamp(checkIn),
        checkOutDate: toTimestamp(checkOut),
        updatedAt: toTimestamp(new Date()),
      });

      // Get updated reservation with room data
      const updatedDoc = await db.collection('reservations').doc(reservationId).get();
      const updatedData = updatedDoc.data();
      const roomDoc = await db.collection('rooms').doc(newRoomId).get();
      const roomData = roomDoc.exists ? {
        id: roomDoc.id,
        roomNumber: roomDoc.data()?.roomNumber || null,
        roomType: roomDoc.data()?.roomType || null,
      } : null;

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        room: roomData,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        updatedAt: new Date(),
      };

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error moving reservation:', error);
      throw new AppError(
        `Failed to move reservation: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

