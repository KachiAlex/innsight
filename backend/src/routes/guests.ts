import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';

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

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Build where clause for guest search
      const where: any = { tenantId };

      if (email) {
        where.email = email;
      } else if (phone) {
        where.phone = phone;
      } else if (name) {
        where.name = {
          contains: name,
          mode: 'insensitive',
        };
      } else if (q) {
        const searchTerm = q as string;
        where.OR = [
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { phone: { contains: searchTerm } },
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { idNumber: { contains: searchTerm, mode: 'insensitive' } },
        ];
      }

      const guests = await prisma.guest.findMany({
        where,
        include: {
          reservations: {
            select: {
              id: true,
              checkInDate: true,
              checkOutDate: true,
              rate: true,
              reservationNumber: true,
            },
            orderBy: {
              checkInDate: 'desc',
            },
          },
        },
        orderBy: {
          lastStayDate: 'desc',
        },
      });

      // Transform guests to match expected format
      const transformedGuests = guests.map(guest => ({
        id: guest.id,
        email: guest.email,
        phone: guest.phone,
        name: guest.name,
        idNumber: guest.idNumber,
        dateOfBirth: guest.dateOfBirth,
        nationality: guest.nationality,
        address: guest.address,
        city: guest.city,
        state: guest.state,
        country: guest.country,
        postalCode: guest.postalCode,
        loyaltyTier: guest.loyaltyTier,
        loyaltyPoints: guest.loyaltyPoints,
        totalStays: guest.totalStays,
        totalNights: guest.totalNights,
        totalSpent: Number(guest.totalSpent),
        preferredRoomType: guest.preferredRoomType,
        preferredFloor: guest.preferredFloor,
        smokingPreference: guest.smokingPreference,
        bedPreference: guest.bedPreference,
        pillowPreference: guest.pillowPreference,
        dietaryRestrictions: guest.dietaryRestrictions,
        allergies: guest.allergies,
        specialRequests: guest.specialRequests,
        isVIP: guest.isVIP,
        isBanned: guest.isBanned,
        bannedReason: guest.bannedReason,
        bannedAt: guest.bannedAt,
        marketingOptIn: guest.marketingOptIn,
        emailOptIn: guest.emailOptIn,
        smsOptIn: guest.smsOptIn,
        firstStayDate: guest.firstStayDate,
        lastStayDate: guest.lastStayDate,
        createdAt: guest.createdAt,
        updatedAt: guest.updatedAt,
        reservations: guest.reservations.map(res => ({
          id: res.id,
          reservationNumber: res.reservationNumber,
          checkInDate: res.checkInDate,
          checkOutDate: res.checkOutDate,
          rate: Number(res.rate || 0),
        })),
      }));

      res.json({
        success: true,
        data: transformedGuests,
      });
    } catch (error: any) {
      console.error('Error searching guests:', error);
      throw new AppError(
        `Failed to search guests: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);
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

