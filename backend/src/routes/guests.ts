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

export default guestRouter;

