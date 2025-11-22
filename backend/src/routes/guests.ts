import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { db, toDate, toTimestamp, now } from '../utils/firestore';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';

export const guestRouter = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/guests/search
// Search guests by email, phone, or name
guestRouter.get(
  '/search',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { q, email, phone, name } = req.query;

      if (!q && !email && !phone && !name) {
        throw new AppError('Please provide a search query (q, email, phone, or name)', 400);
      }

      // Get all reservations for this tenant
      let query: FirebaseFirestore.Query = db.collection('reservations')
        .where('tenantId', '==', tenantId);

      const reservationsSnapshot = await query.get();

      // Build a map of unique guests
      const guestsMap = new Map<string, {
        email?: string;
        phone?: string;
        name: string;
        idNumber?: string;
        firstStay?: Date;
        lastStay?: Date;
        totalStays: number;
        totalNights: number;
        totalSpent: number;
        reservations: any[];
      }>();

      for (const doc of reservationsSnapshot.docs) {
        const resData = doc.data();
        const guestEmail = resData.guestEmail?.toLowerCase() || '';
        const guestPhone = resData.guestPhone || '';
        const guestName = resData.guestName || '';
        const guestIdNumber = resData.guestIdNumber || '';

        // Create a unique key for the guest (prefer email, then phone, then name)
        const guestKey = guestEmail || guestPhone || guestName.toLowerCase();

        if (!guestKey) continue;

        // Check if this guest matches the search criteria
        const searchLower = (q as string)?.toLowerCase() || '';
        const emailMatch = email ? guestEmail === (email as string).toLowerCase() : true;
        const phoneMatch = phone ? guestPhone === phone : true;
        const nameMatch = name ? guestName.toLowerCase().includes((name as string).toLowerCase()) : true;
        const queryMatch = q ? 
          guestEmail.includes(searchLower) || 
          guestPhone.includes(searchLower) || 
          guestName.toLowerCase().includes(searchLower) ||
          guestIdNumber.includes(searchLower) : true;

        if (!emailMatch || !phoneMatch || !nameMatch || !queryMatch) continue;

        if (!guestsMap.has(guestKey)) {
          guestsMap.set(guestKey, {
            email: guestEmail || undefined,
            phone: guestPhone || undefined,
            name: guestName,
            idNumber: guestIdNumber || undefined,
            totalStays: 0,
            totalNights: 0,
            totalSpent: 0,
            reservations: [],
          });
        }

        const guest = guestsMap.get(guestKey)!;
        const checkIn = toDate(resData.checkInDate);
        const checkOut = toDate(resData.checkOutDate);

        if (checkIn && checkOut) {
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          guest.totalNights += nights;
          guest.totalStays += 1;

          if (!guest.firstStay || checkIn < guest.firstStay) {
            guest.firstStay = checkIn;
          }
          if (!guest.lastStay || checkOut > guest.lastStay) {
            guest.lastStay = checkOut;
          }
        }

        guest.totalSpent += Number(resData.rate || 0);
        guest.reservations.push({
          id: doc.id,
          reservationNumber: resData.reservationNumber,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          status: resData.status,
          rate: Number(resData.rate || 0),
          roomId: resData.roomId,
        });
      }

      // Convert map to array
      const guests = Array.from(guestsMap.values())
        .map(guest => ({
          ...guest,
          reservations: guest.reservations.sort((a, b) => {
            if (!a.checkOutDate || !b.checkOutDate) return 0;
            return b.checkOutDate.getTime() - a.checkOutDate.getTime();
          }),
        }))
        .sort((a, b) => {
          if (!a.lastStay || !b.lastStay) return 0;
          return b.lastStay.getTime() - a.lastStay.getTime();
        });

      res.json({
        success: true,
        data: guests,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error searching guests:', error);
      throw new AppError(
        `Failed to search guests: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/guests/:identifier
// Get detailed guest profile by email, phone, or name
guestRouter.get(
  '/:identifier',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const identifier = req.params.identifier;

      // Get all reservations for this tenant
      const reservationsSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .get();

      // Find all reservations matching this guest
      const matchingReservations: any[] = [];
      const identifierLower = identifier.toLowerCase();

      for (const doc of reservationsSnapshot.docs) {
        const resData = doc.data();
        const guestEmail = resData.guestEmail?.toLowerCase() || '';
        const guestPhone = resData.guestPhone || '';
        const guestName = resData.guestName?.toLowerCase() || '';
        const guestIdNumber = resData.guestIdNumber || '';

        if (
          guestEmail === identifierLower ||
          guestPhone === identifier ||
          guestName === identifierLower ||
          guestIdNumber === identifier
        ) {
          matchingReservations.push({
            id: doc.id,
            ...resData,
            checkInDate: toDate(resData.checkInDate),
            checkOutDate: toDate(resData.checkOutDate),
            checkedInAt: toDate(resData.checkedInAt),
            checkedOutAt: toDate(resData.checkedOutAt),
            createdAt: toDate(resData.createdAt),
            updatedAt: toDate(resData.updatedAt),
          });
        }
      }

      if (matchingReservations.length === 0) {
        throw new AppError('Guest not found', 404);
      }

      // Get guest info from the first reservation
      const firstReservation = matchingReservations[0];
      const guestInfo = {
        name: firstReservation.guestName,
        email: firstReservation.guestEmail || null,
        phone: firstReservation.guestPhone || null,
        idNumber: firstReservation.guestIdNumber || null,
      };

      // Calculate statistics
      let totalStays = 0;
      let totalNights = 0;
      let totalSpent = 0;
      let firstStay: Date | null = null;
      let lastStay: Date | null = null;
      const preferences: {
        preferredRoomTypes: Record<string, number>;
        specialRequests: string[];
        sources: Record<string, number>;
      } = {
        preferredRoomTypes: {},
        specialRequests: [],
        sources: {},
      };

      // Enrich reservations with room data and calculate stats
      const enrichedReservations = await Promise.all(
        matchingReservations.map(async (res) => {
          const roomDoc = await db.collection('rooms').doc(res.roomId).get();
          const roomData = roomDoc.exists ? {
            id: roomDoc.id,
            roomNumber: roomDoc.data()?.roomNumber || null,
            roomType: roomDoc.data()?.roomType || null,
          } : null;

          // Calculate nights
          if (res.checkInDate && res.checkOutDate) {
            const nights = Math.ceil(
              (res.checkOutDate.getTime() - res.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            totalNights += nights;
            totalStays += 1;

            if (!firstStay || res.checkInDate < firstStay) {
              firstStay = res.checkInDate;
            }
            if (!lastStay || res.checkOutDate > lastStay) {
              lastStay = res.checkOutDate;
            }
          }

          totalSpent += Number(res.rate || 0);

          // Track preferences
          if (roomData?.roomType) {
            preferences.preferredRoomTypes[roomData.roomType] =
              (preferences.preferredRoomTypes[roomData.roomType] || 0) + 1;
          }

          if (res.specialRequests) {
            preferences.specialRequests.push(res.specialRequests);
          }

          if (res.source) {
            preferences.sources[res.source] = (preferences.sources[res.source] || 0) + 1;
          }

          return {
            ...res,
            room: roomData,
          };
        })
      );

      // Get folios and payments for this guest
      const foliosSnapshot = await db.collection('folios')
        .where('tenantId', '==', tenantId)
        .get();

      const guestFolios: any[] = [];
      for (const folioDoc of foliosSnapshot.docs) {
        const folioData = folioDoc.data();
        const folioReservationId = folioData.reservationId;

        if (matchingReservations.some(r => r.id === folioReservationId)) {
          const [chargesSnapshot, paymentsSnapshot] = await Promise.all([
            db.collection('folioCharges').where('folioId', '==', folioDoc.id).get(),
            db.collection('payments').where('folioId', '==', folioDoc.id).get(),
          ]);

          guestFolios.push({
            id: folioDoc.id,
            ...folioData,
            totalCharges: Number(folioData.totalCharges || 0),
            totalPayments: Number(folioData.totalPayments || 0),
            balance: Number(folioData.balance || 0),
            charges: chargesSnapshot.docs.map(c => ({
              id: c.id,
              ...c.data(),
              amount: Number(c.data().amount || 0),
              total: Number(c.data().total || 0),
            })),
            payments: paymentsSnapshot.docs.map(p => ({
              id: p.id,
              ...p.data(),
              amount: Number(p.data().amount || 0),
            })),
            createdAt: toDate(folioData.createdAt),
            updatedAt: toDate(folioData.updatedAt),
          });
        }
      }

      // Sort reservations by check-in date (most recent first)
      enrichedReservations.sort((a, b) => {
        if (!a.checkInDate || !b.checkInDate) return 0;
        return b.checkInDate.getTime() - a.checkInDate.getTime();
      });

      const guestProfile = {
        ...guestInfo,
        statistics: {
          totalStays,
          totalNights,
          totalSpent,
          averageStayLength: totalStays > 0 ? Math.round(totalNights / totalStays * 10) / 10 : 0,
          averageSpent: totalStays > 0 ? Math.round(totalSpent / totalStays * 100) / 100 : 0,
          firstStay,
          lastStay,
        },
        preferences: {
          preferredRoomType: Object.keys(preferences.preferredRoomTypes).sort(
            (a, b) => preferences.preferredRoomTypes[b] - preferences.preferredRoomTypes[a]
          )[0] || null,
          roomTypeFrequency: preferences.preferredRoomTypes,
          commonSpecialRequests: preferences.specialRequests.slice(0, 5),
          preferredSource: Object.keys(preferences.sources).sort(
            (a, b) => preferences.sources[b] - preferences.sources[a]
          )[0] || null,
        },
        reservations: enrichedReservations,
        folios: guestFolios,
      };

      res.json({
        success: true,
        data: guestProfile,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching guest profile:', error);
      throw new AppError(
        `Failed to fetch guest profile: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/guests
// List all guests with pagination
guestRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { page, limit } = getPaginationParams(req);

      // Get all reservations for this tenant
      const reservationsSnapshot = await db.collection('reservations')
        .where('tenantId', '==', tenantId)
        .get();

      // Build a map of unique guests
      const guestsMap = new Map<string, {
        email?: string;
        phone?: string;
        name: string;
        idNumber?: string;
        firstStay?: Date;
        lastStay?: Date;
        totalStays: number;
        totalNights: number;
        totalSpent: number;
      }>();

      for (const doc of reservationsSnapshot.docs) {
        const resData = doc.data();
        const guestEmail = resData.guestEmail?.toLowerCase() || '';
        const guestPhone = resData.guestPhone || '';
        const guestName = resData.guestName || '';
        const guestIdNumber = resData.guestIdNumber || '';

        const guestKey = guestEmail || guestPhone || guestName.toLowerCase();
        if (!guestKey) continue;

        if (!guestsMap.has(guestKey)) {
          guestsMap.set(guestKey, {
            email: guestEmail || undefined,
            phone: guestPhone || undefined,
            name: guestName,
            idNumber: guestIdNumber || undefined,
            totalStays: 0,
            totalNights: 0,
            totalSpent: 0,
          });
        }

        const guest = guestsMap.get(guestKey)!;
        const checkIn = toDate(resData.checkInDate);
        const checkOut = toDate(resData.checkOutDate);

        if (checkIn && checkOut) {
          const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
          guest.totalNights += nights;
          guest.totalStays += 1;

          if (!guest.firstStay || checkIn < guest.firstStay) {
            guest.firstStay = checkIn;
          }
          if (!guest.lastStay || checkOut > guest.lastStay) {
            guest.lastStay = checkOut;
          }
        }

        guest.totalSpent += Number(resData.rate || 0);
      }

      // Convert to array and sort
      const allGuests = Array.from(guestsMap.values())
        .map(guest => ({
          ...guest,
          averageStayLength: guest.totalStays > 0 ? Math.round(guest.totalNights / guest.totalStays * 10) / 10 : 0,
          averageSpent: guest.totalStays > 0 ? Math.round(guest.totalSpent / guest.totalStays * 100) / 100 : 0,
        }))
        .sort((a, b) => {
          if (!a.lastStay || !b.lastStay) return 0;
          return b.lastStay.getTime() - a.lastStay.getTime();
        });

      const total = allGuests.length;
      const skip = (page - 1) * limit;
      const paginatedGuests = allGuests.slice(skip, skip + limit);

      const result = createPaginationResult(paginatedGuests, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching guests:', error);
      throw new AppError(
        `Failed to fetch guests: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

