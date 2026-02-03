import { Router } from 'express';
import { z } from 'zod';
import { Prisma, type LoyaltyProgram } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import { normalizeEmail, normalizePhone } from '../utils/guestProfiles';

export const guestEnhancedRouter = Router({ mergeParams: true });

const ensurePrisma = () => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }
  return prisma;
};

const sanitizeNullableString = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const sanitizeDate = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Date(value);
};

const defaultLoyaltyProgram = {
  isActive: true,
  programName: 'InnSight Rewards',
  pointsPerNight: 10,
  pointsPerCurrency: 1,
  silverThreshold: 100,
  goldThreshold: 500,
  platinumThreshold: 1000,
  vipThreshold: 5000,
  bronzeDiscount: 0,
  silverDiscount: 5,
  goldDiscount: 10,
  platinumDiscount: 15,
  vipDiscount: 20,
  pointsRedemptionRate: 100,
  minRedemptionPoints: 500,
  pointsExpiryMonths: null as number | null,
};

const guestUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('').transform(() => undefined)),
  phone: z.string().optional().or(z.literal('').transform(() => undefined)),
  idNumber: z.string().optional().nullable(),
  dateOfBirth: z.string().datetime().optional(),
  nationality: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  preferredRoomType: z.string().optional().nullable(),
  preferredFloor: z.number().int().optional().nullable(),
  smokingPreference: z.boolean().optional(),
  bedPreference: z.string().optional().nullable(),
  pillowPreference: z.string().optional().nullable(),
  dietaryRestrictions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  specialRequests: z.string().optional().nullable(),
  marketingOptIn: z.boolean().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  loyaltyTier: z.string().optional(),
  isVIP: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  bannedReason: z.string().optional().nullable(),
  bannedAt: z.string().datetime().optional(),
});

const activitySchema = z.object({
  activityType: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

const noteSchema = z.object({
  noteType: z.string().optional(),
  note: z.string().min(1),
  isImportant: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

const loyaltyMutationSchema = z.object({
  points: z.number().int().refine((val) => val !== 0, {
    message: 'Points value is required',
  }),
  description: z.string().optional(),
  reservationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const loyaltyProgramSchema = z.object({
  isActive: z.boolean().optional(),
  programName: z.string().optional(),
  pointsPerNight: z.number().int().min(0).optional(),
  pointsPerCurrency: z.number().positive().optional(),
  silverThreshold: z.number().int().min(0).optional(),
  goldThreshold: z.number().int().min(0).optional(),
  platinumThreshold: z.number().int().min(0).optional(),
  vipThreshold: z.number().int().min(0).optional(),
  bronzeDiscount: z.number().min(0).optional(),
  silverDiscount: z.number().min(0).optional(),
  goldDiscount: z.number().min(0).optional(),
  platinumDiscount: z.number().min(0).optional(),
  vipDiscount: z.number().min(0).optional(),
  pointsRedemptionRate: z.number().positive().optional(),
  minRedemptionPoints: z.number().int().min(0).optional(),
  pointsExpiryMonths: z.number().int().min(1).nullable().optional(),
});

const listQuerySchema = z.object({
  loyaltyTier: z.string().optional(),
  isVIP: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

const resolveLoyaltyTier = (points: number, program?: { [key: string]: any }) => {
  const config = program || defaultLoyaltyProgram;
  if (points >= config.vipThreshold) return 'vip';
  if (points >= config.platinumThreshold) return 'platinum';
  if (points >= config.goldThreshold) return 'gold';
  if (points >= config.silverThreshold) return 'silver';
  return 'bronze';
};

const serializeDecimal = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') return value;
  return Number(value);
};

const serializeGuest = (guest: any) => ({
  ...guest,
  totalSpent: serializeDecimal(guest.totalSpent) || 0,
  dietaryRestrictions: Array.isArray(guest.dietaryRestrictions) ? guest.dietaryRestrictions : [],
  allergies: Array.isArray(guest.allergies) ? guest.allergies : [],
});

const findGuestByIdentifier = async (tenantId: string, identifier: string) => {
  const client = ensurePrisma();
  const email = normalizeEmail(identifier) || undefined;
  const phone = normalizePhone(identifier) || undefined;

  return client.guest.findFirst({
    where: {
      tenantId,
      OR: [
        { id: identifier },
        email ? { email } : undefined,
        phone ? { phone } : undefined,
      ].filter(Boolean) as Prisma.GuestWhereInput[],
    },
  });
};

const getGuestOrThrow = async (tenantId: string, identifier: string) => {
  const guest = await findGuestByIdentifier(tenantId, identifier);
  if (!guest) {
    throw new AppError('Guest not found', 404);
  }
  return guest;
};

const calculateNights = (checkIn?: Date | null, checkOut?: Date | null) => {
  if (!checkIn || !checkOut) return 0;
  const diff = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
};

type GuestStats = {
  totalStays: number;
  totalNights: number;
  totalSpent: number;
  firstStayDate: Date | null;
  lastStayDate: Date | null;
  preferredRoomType: string | null;
};

const buildGuestStats = async (tenantId: string, guestIds: string[]): Promise<Record<string, GuestStats>> => {
  const client = ensurePrisma();
  if (!guestIds.length) {
    return {};
  }

  const reservations = await client.reservation.findMany({
    where: {
      tenantId,
      guestId: { in: guestIds },
    },
    select: {
      guestId: true,
      checkInDate: true,
      checkOutDate: true,
      rate: true,
      room: {
        select: {
          roomType: true,
        },
      },
    },
  });

  const statsMap: Record<string, GuestStats & { roomTypeCounts: Record<string, number> }> = {};

  for (const reservation of reservations) {
    if (!reservation.guestId) continue;
    if (!statsMap[reservation.guestId]) {
      statsMap[reservation.guestId] = {
        totalStays: 0,
        totalNights: 0,
        totalSpent: 0,
        firstStayDate: null,
        lastStayDate: null,
        preferredRoomType: null,
        roomTypeCounts: {},
      };
    }

    const entry = statsMap[reservation.guestId];
    entry.totalStays += 1;
    entry.totalSpent += Number(reservation.rate || 0);
    const checkIn = reservation.checkInDate ? new Date(reservation.checkInDate) : null;
    const checkOut = reservation.checkOutDate ? new Date(reservation.checkOutDate) : null;
    entry.totalNights += calculateNights(checkIn, checkOut);
    if (checkIn && (!entry.firstStayDate || checkIn < entry.firstStayDate)) {
      entry.firstStayDate = checkIn;
    }
    if (checkOut && (!entry.lastStayDate || checkOut > entry.lastStayDate)) {
      entry.lastStayDate = checkOut;
    }
    if (reservation.room?.roomType) {
      const key = reservation.room.roomType;
      entry.roomTypeCounts[key] = (entry.roomTypeCounts[key] || 0) + 1;
    }
  }

  const formatted: Record<string, GuestStats> = {};
  Object.entries(statsMap).forEach(([guestId, data]) => {
    const preferred = Object.entries(data.roomTypeCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    formatted[guestId] = {
      totalStays: data.totalStays,
      totalNights: data.totalNights,
      totalSpent: data.totalSpent,
      firstStayDate: data.firstStayDate,
      lastStayDate: data.lastStayDate,
      preferredRoomType: preferred,
    };
  });

  return formatted;
};

const buildLoyaltyProgramConfig = (program?: LoyaltyProgram | null) => {
  if (!program) {
    return defaultLoyaltyProgram;
  }

  return {
    isActive: program.isActive,
    programName: program.programName,
    pointsPerNight: program.pointsPerNight,
    pointsPerCurrency: Number(program.pointsPerCurrency),
    silverThreshold: program.silverThreshold,
    goldThreshold: program.goldThreshold,
    platinumThreshold: program.platinumThreshold,
    vipThreshold: program.vipThreshold,
    bronzeDiscount: Number(program.bronzeDiscount),
    silverDiscount: Number(program.silverDiscount),
    goldDiscount: Number(program.goldDiscount),
    platinumDiscount: Number(program.platinumDiscount),
    vipDiscount: Number(program.vipDiscount),
    pointsRedemptionRate: Number(program.pointsRedemptionRate),
    minRedemptionPoints: program.minRedemptionPoints,
    pointsExpiryMonths: program.pointsExpiryMonths,
  };
};

// ============================================
// GUEST CRUD OPERATIONS
// ============================================

guestEnhancedRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const payload = guestUpsertSchema.parse(req.body);
      const client = ensurePrisma();

      const normalizedEmail = payload.email ? normalizeEmail(payload.email) : undefined;
      const normalizedPhone = payload.phone ? normalizePhone(payload.phone) : undefined;

      if (!payload.id && !normalizedEmail && !normalizedPhone) {
        throw new AppError('Either email or phone is required', 400);
      }

      let guest = payload.id
        ? await client.guest.findFirst({ where: { id: payload.id, tenantId } })
        : null;

      if (!guest && (normalizedEmail || normalizedPhone)) {
        guest = await client.guest.findFirst({
          where: {
            tenantId,
            OR: [
              normalizedEmail ? { email: normalizedEmail } : undefined,
              normalizedPhone ? { phone: normalizedPhone } : undefined,
            ].filter(Boolean) as Prisma.GuestWhereInput[],
          },
        });
      }

      const baseData: Prisma.GuestUpdateInput = {
        name: payload.name.trim(),
        email:
          normalizedEmail ?? (payload.email === undefined ? undefined : payload.email === null ? null : payload.email),
        phone:
          normalizedPhone ?? (payload.phone === undefined ? undefined : payload.phone === null ? null : payload.phone),
        idNumber: sanitizeNullableString(payload.idNumber),
        dateOfBirth: sanitizeDate(payload.dateOfBirth),
        nationality: sanitizeNullableString(payload.nationality),
        address: sanitizeNullableString(payload.address),
        city: sanitizeNullableString(payload.city),
        state: sanitizeNullableString(payload.state),
        country: sanitizeNullableString(payload.country),
        postalCode: sanitizeNullableString(payload.postalCode),
        preferredRoomType: sanitizeNullableString(payload.preferredRoomType),
        preferredFloor:
          payload.preferredFloor === undefined ? undefined : payload.preferredFloor ?? null,
        smokingPreference: payload.smokingPreference ?? undefined,
        bedPreference: sanitizeNullableString(payload.bedPreference),
        pillowPreference: sanitizeNullableString(payload.pillowPreference),
        dietaryRestrictions: payload.dietaryRestrictions ?? undefined,
        allergies: payload.allergies ?? undefined,
        specialRequests: sanitizeNullableString(payload.specialRequests),
        marketingOptIn: payload.marketingOptIn ?? undefined,
        emailOptIn: payload.emailOptIn ?? undefined,
        smsOptIn: payload.smsOptIn ?? undefined,
        isVIP: payload.isVIP ?? undefined,
        isBanned: payload.isBanned ?? undefined,
        bannedReason: sanitizeNullableString(payload.bannedReason),
        bannedAt: sanitizeDate(payload.bannedAt),
        loyaltyTier: sanitizeNullableString(payload.loyaltyTier) ?? undefined,
      };

      let savedGuest;

      if (guest) {
        savedGuest = await client.guest.update({
          where: { id: guest.id },
          data: {
            ...Object.fromEntries(
              Object.entries(baseData).filter(([, value]) => value !== undefined)
            ),
          },
        });

        await client.guestActivityLog.create({
          data: {
            tenantId,
            guestId: guest.id,
            activityType: 'profile_updated',
            title: 'Profile Updated',
            description: 'Guest profile information was updated',
            metadata: { updatedBy: req.user?.id },
            performedBy: req.user?.id || null,
          },
        });
      } else {
        savedGuest = await client.guest.create({
          data: {
            tenantId,
            name: payload.name.trim(),
            email: normalizedEmail ?? sanitizeNullableString(payload.email ?? null),
            phone: normalizedPhone ?? sanitizeNullableString(payload.phone ?? null),
            idNumber: sanitizeNullableString(payload.idNumber) ?? null,
            dateOfBirth: sanitizeDate(payload.dateOfBirth) ?? null,
            nationality: sanitizeNullableString(payload.nationality) ?? null,
            address: sanitizeNullableString(payload.address) ?? null,
            city: sanitizeNullableString(payload.city) ?? null,
            state: sanitizeNullableString(payload.state) ?? null,
            country: sanitizeNullableString(payload.country) ?? null,
            postalCode: sanitizeNullableString(payload.postalCode) ?? null,
            preferredRoomType: sanitizeNullableString(payload.preferredRoomType) ?? null,
            preferredFloor: payload.preferredFloor ?? null,
            smokingPreference: payload.smokingPreference ?? false,
            bedPreference: sanitizeNullableString(payload.bedPreference) ?? null,
            pillowPreference: sanitizeNullableString(payload.pillowPreference) ?? null,
            dietaryRestrictions: payload.dietaryRestrictions ?? [],
            allergies: payload.allergies ?? [],
            specialRequests: sanitizeNullableString(payload.specialRequests) ?? null,
            marketingOptIn: payload.marketingOptIn ?? true,
            emailOptIn: payload.emailOptIn ?? true,
            smsOptIn: payload.smsOptIn ?? true,
            loyaltyTier: sanitizeNullableString(payload.loyaltyTier) ?? 'bronze',
            isVIP: payload.isVIP ?? false,
            isBanned: payload.isBanned ?? false,
            bannedReason: sanitizeNullableString(payload.bannedReason) ?? null,
            bannedAt: sanitizeDate(payload.bannedAt) ?? null,
          },
        });

        await client.guestActivityLog.create({
          data: {
            tenantId,
            guestId: savedGuest.id,
            activityType: 'profile_created',
            title: 'Profile Created',
            description: 'Guest profile was created',
            metadata: { createdBy: req.user?.id },
            performedBy: req.user?.id || null,
          },
        });
      }

      const statsMap = await buildGuestStats(tenantId, [savedGuest.id]);
      const stats = statsMap[savedGuest.id];

      res.json({
        success: true,
        data: {
          ...serializeGuest(savedGuest),
          totalStays: stats?.totalStays ?? savedGuest.totalStays ?? 0,
          totalNights: stats?.totalNights ?? savedGuest.totalNights ?? 0,
          totalSpent: stats?.totalSpent ?? serializeDecimal(savedGuest.totalSpent) ?? 0,
          firstStayDate: stats?.firstStayDate ?? savedGuest.firstStayDate ?? null,
          lastStayDate: stats?.lastStayDate ?? savedGuest.lastStayDate ?? null,
          preferredRoomType: savedGuest.preferredRoomType ?? stats?.preferredRoomType ?? null,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating/updating guest:', error);
      throw new AppError(
        `Failed to create/update guest: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// ============================================
// GUEST LISTING
// ============================================

guestEnhancedRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { skip, take, page, limit } = getPaginationParams(req);
      const filters = listQuerySchema.parse(req.query);
      const client = ensurePrisma();

      const where: Prisma.GuestWhereInput = { tenantId };

      if (filters.loyaltyTier) {
        where.loyaltyTier = filters.loyaltyTier;
      }

      if (filters.isVIP) {
        where.isVIP = filters.isVIP === 'true';
      }

      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { phone: { contains: filters.search, mode: 'insensitive' } },
          { idNumber: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      const [guests, total] = await Promise.all([
        client.guest.findMany({
          where,
          skip,
          take,
          orderBy: [
            { lastStayDate: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
        client.guest.count({ where }),
      ]);

      const statsMap = await buildGuestStats(
        tenantId,
        guests.map((guest) => guest.id)
      );

      const items = guests.map((guest) => {
        const stats = statsMap[guest.id];
        return {
          ...serializeGuest(guest),
          totalStays: stats?.totalStays ?? guest.totalStays ?? 0,
          totalNights: stats?.totalNights ?? guest.totalNights ?? 0,
          totalSpent: stats?.totalSpent ?? serializeDecimal(guest.totalSpent) ?? 0,
          firstStayDate: stats?.firstStayDate ?? guest.firstStayDate ?? null,
          lastStayDate: stats?.lastStayDate ?? guest.lastStayDate ?? null,
          preferredRoomType: guest.preferredRoomType ?? stats?.preferredRoomType ?? null,
        };
      });

      const result = createPaginationResult(items, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching guests:', error);
      throw new AppError(
        `Failed to fetch guests: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// ============================================
// LOYALTY PROGRAM CONFIGURATION
// ============================================

guestEnhancedRouter.get(
  '/loyalty/program',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const client = ensurePrisma();
      const program = await client.loyaltyProgram.findUnique({ where: { tenantId } });

      res.json({
        success: true,
        data: buildLoyaltyProgramConfig(program),
      });
    } catch (error: any) {
      console.error('Error fetching loyalty program:', error);
      throw new AppError(
        `Failed to fetch loyalty program: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

guestEnhancedRouter.put(
  '/loyalty/program',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const payload = loyaltyProgramSchema.parse(req.body);
      const client = ensurePrisma();

      const existing = await client.loyaltyProgram.findUnique({ where: { tenantId } });

      const data: Prisma.LoyaltyProgramUpsertArgs['create'] = {
        tenantId,
        isActive: payload.isActive ?? existing?.isActive ?? defaultLoyaltyProgram.isActive,
        programName: payload.programName ?? existing?.programName ?? defaultLoyaltyProgram.programName,
        pointsPerNight: payload.pointsPerNight ?? existing?.pointsPerNight ?? defaultLoyaltyProgram.pointsPerNight,
        pointsPerCurrency:
          payload.pointsPerCurrency ??
          Number(existing?.pointsPerCurrency ?? defaultLoyaltyProgram.pointsPerCurrency),
        silverThreshold: payload.silverThreshold ?? existing?.silverThreshold ?? defaultLoyaltyProgram.silverThreshold,
        goldThreshold: payload.goldThreshold ?? existing?.goldThreshold ?? defaultLoyaltyProgram.goldThreshold,
        platinumThreshold:
          payload.platinumThreshold ?? existing?.platinumThreshold ?? defaultLoyaltyProgram.platinumThreshold,
        vipThreshold: payload.vipThreshold ?? existing?.vipThreshold ?? defaultLoyaltyProgram.vipThreshold,
        bronzeDiscount:
          payload.bronzeDiscount ?? Number(existing?.bronzeDiscount ?? defaultLoyaltyProgram.bronzeDiscount),
        silverDiscount:
          payload.silverDiscount ?? Number(existing?.silverDiscount ?? defaultLoyaltyProgram.silverDiscount),
        goldDiscount:
          payload.goldDiscount ?? Number(existing?.goldDiscount ?? defaultLoyaltyProgram.goldDiscount),
        platinumDiscount:
          payload.platinumDiscount ?? Number(existing?.platinumDiscount ?? defaultLoyaltyProgram.platinumDiscount),
        vipDiscount:
          payload.vipDiscount ?? Number(existing?.vipDiscount ?? defaultLoyaltyProgram.vipDiscount),
        pointsRedemptionRate:
          payload.pointsRedemptionRate ??
          Number(existing?.pointsRedemptionRate ?? defaultLoyaltyProgram.pointsRedemptionRate),
        minRedemptionPoints:
          payload.minRedemptionPoints ?? existing?.minRedemptionPoints ?? defaultLoyaltyProgram.minRedemptionPoints,
        pointsExpiryMonths:
          payload.pointsExpiryMonths ?? existing?.pointsExpiryMonths ?? defaultLoyaltyProgram.pointsExpiryMonths,
      };

      const program = await client.loyaltyProgram.upsert({
        where: { tenantId },
        create: data,
        update: data,
      });

      res.json({
        success: true,
        data: buildLoyaltyProgramConfig(program),
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating loyalty program:', error);
      throw new AppError(
        `Failed to update loyalty program: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// ============================================
// GUEST ACTIVITY LOGS & NOTES
// ============================================

guestEnhancedRouter.post(
  '/:guestId/activity',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guest = await getGuestOrThrow(tenantId, req.params.guestId);
      const payload = activitySchema.parse(req.body);
      const client = ensurePrisma();

      const activity = await client.guestActivityLog.create({
        data: {
          tenantId,
          guestId: guest.id,
          activityType: payload.activityType,
          title: payload.title,
          description: sanitizeNullableString(payload.description) ?? null,
          metadata: payload.metadata ?? {},
          performedBy: req.user?.id || null,
        },
      });

      res.json({
        success: true,
        data: activity,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error adding activity log:', error);
      throw new AppError(
        `Failed to add activity log: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

guestEnhancedRouter.post(
  '/:guestId/notes',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guest = await getGuestOrThrow(tenantId, req.params.guestId);
      const payload = noteSchema.parse(req.body);
      const client = ensurePrisma();

      const note = await client.guestNote.create({
        data: {
          tenantId,
          guestId: guest.id,
          noteType: sanitizeNullableString(payload.noteType) ?? 'general',
          note: payload.note,
          isImportant: payload.isImportant ?? false,
          isPinned: payload.isPinned ?? false,
          createdBy: req.user?.id || 'system',
        },
      });

      await client.guestActivityLog.create({
        data: {
          tenantId,
          guestId: guest.id,
          activityType: 'note',
          title: 'Note Added',
          description: payload.note.substring(0, 100),
          metadata: { noteId: note.id, noteType: note.noteType },
          performedBy: req.user?.id || null,
        },
      });

      res.json({
        success: true,
        data: note,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error adding note:', error);
      throw new AppError(`Failed to add note: ${error.message || 'Unknown error'}`, 500);
    }
  }
);

guestEnhancedRouter.put(
  '/:guestId/notes/:noteId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      await getGuestOrThrow(tenantId, req.params.guestId);
      const payload = noteSchema.parse(req.body);
      const client = ensurePrisma();

      const note = await client.guestNote.findFirst({
        where: { id: req.params.noteId, tenantId },
      });

      if (!note) {
        throw new AppError('Note not found', 404);
      }

      const updated = await client.guestNote.update({
        where: { id: note.id },
        data: {
          note: payload.note ?? note.note,
          isImportant: payload.isImportant ?? note.isImportant,
          isPinned: payload.isPinned ?? note.isPinned,
          noteType: sanitizeNullableString(payload.noteType) ?? note.noteType,
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
      console.error('Error updating note:', error);
      throw new AppError(`Failed to update note: ${error.message || 'Unknown error'}`, 500);
    }
  }
);

guestEnhancedRouter.delete(
  '/:guestId/notes/:noteId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      await getGuestOrThrow(tenantId, req.params.guestId);
      const client = ensurePrisma();

      const note = await client.guestNote.findFirst({
        where: { id: req.params.noteId, tenantId },
      });

      if (!note) {
        throw new AppError('Note not found', 404);
      }

      await client.guestNote.delete({ where: { id: note.id } });

      res.json({
        success: true,
        message: 'Note deleted successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting note:', error);
      throw new AppError(`Failed to delete note: ${error.message || 'Unknown error'}`, 500);
    }
  }
);

// ============================================
// LOYALTY MANAGEMENT
// ============================================

guestEnhancedRouter.post(
  '/:guestId/loyalty',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guest = await getGuestOrThrow(tenantId, req.params.guestId);
      const payload = loyaltyMutationSchema.parse(req.body);
      const client = ensurePrisma();

      const program = await client.loyaltyProgram.findUnique({ where: { tenantId } });
      const config = buildLoyaltyProgramConfig(program);

      const currentPoints = guest.loyaltyPoints ?? 0;
      const newPoints = currentPoints + payload.points;

      if (newPoints < 0) {
        throw new AppError('Insufficient loyalty points', 400);
      }

      const newTier = resolveLoyaltyTier(newPoints, config);

      await client.loyaltyTransaction.create({
        data: {
          tenantId,
          guestId: guest.id,
          transactionType: payload.points > 0 ? 'earned' : 'redeemed',
          points: payload.points,
          balanceBefore: currentPoints,
          balanceAfter: newPoints,
          description: payload.description || (payload.points > 0 ? 'Points earned' : 'Points redeemed'),
          reservationId: sanitizeNullableString(payload.reservationId) ?? null,
          metadata: payload.metadata ?? {},
          createdBy: req.user?.id || null,
        },
      });

      await client.guest.update({
        where: { id: guest.id },
        data: {
          loyaltyPoints: newPoints,
          loyaltyTier: newTier,
        },
      });

      await client.guestActivityLog.create({
        data: {
          tenantId,
          guestId: guest.id,
          activityType: payload.points > 0 ? 'loyalty_earned' : 'loyalty_redeemed',
          title: payload.points > 0 ? 'Loyalty Points Earned' : 'Loyalty Points Redeemed',
          description: `${Math.abs(payload.points)} points ${payload.points > 0 ? 'earned' : 'redeemed'}`,
          metadata: { points: payload.points, balanceAfter: newPoints, tier: newTier },
          performedBy: req.user?.id || null,
        },
      });

      res.json({
        success: true,
        data: {
          points: newPoints,
          tier: newTier,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error adding loyalty points:', error);
      throw new AppError(
        `Failed to add loyalty points: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

// ============================================
// GUEST PROFILE
// ============================================

guestEnhancedRouter.get(
  '/:guestId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const guest = await getGuestOrThrow(tenantId, req.params.guestId);
      const client = ensurePrisma();

      const reservations = await client.reservation.findMany({
        where: { tenantId, guestId: guest.id },
        include: {
          room: {
            select: {
              id: true,
              roomNumber: true,
              roomType: true,
            },
          },
        },
        orderBy: { checkInDate: 'desc' },
      });

      const statsMap = await buildGuestStats(tenantId, [guest.id]);
      const stats = statsMap[guest.id] ?? {
        totalStays: guest.totalStays ?? 0,
        totalNights: guest.totalNights ?? 0,
        totalSpent: serializeDecimal(guest.totalSpent) ?? 0,
        firstStayDate: guest.firstStayDate ?? null,
        lastStayDate: guest.lastStayDate ?? null,
        preferredRoomType: guest.preferredRoomType ?? null,
      };

      const activityLogs = await client.guestActivityLog.findMany({
        where: { tenantId, guestId: guest.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      const notes = await client.guestNote.findMany({
        where: { tenantId, guestId: guest.id },
        orderBy: { createdAt: 'desc' },
      });

      const loyaltyTransactions = await client.loyaltyTransaction.findMany({
        where: { tenantId, guestId: guest.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });

      res.json({
        success: true,
        data: {
          ...serializeGuest(guest),
          totalStays: stats.totalStays,
          totalNights: stats.totalNights,
          totalSpent: stats.totalSpent,
          firstStayDate: stats.firstStayDate,
          lastStayDate: stats.lastStayDate,
          preferredRoomType: guest.preferredRoomType ?? stats.preferredRoomType,
          reservations: reservations.map((reservation) => ({
            ...reservation,
            rate: serializeDecimal(reservation.rate),
          })),
          activityLogs,
          notes,
          loyaltyTransactions,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching guest profile:', error);
      throw new AppError(
        `Failed to fetch guest profile: ${error.message || 'Unknown error'}`,
        500
      );
    }
  }
);

