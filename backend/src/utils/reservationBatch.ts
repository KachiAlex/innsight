import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from '../middleware/errorHandler';
import { prisma } from './prisma';

export const createReservationBatchSchema = z
  .object({
    guestName: z.string().min(1),
    guestId: z.string().uuid().optional(),
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
    depositAmount: z.number().nonnegative().optional(),
    source: z
      .enum([
        'manual',
        'web',
        'ota',
        'channel_manager',
        'web_portal',
        'mobile_portal',
        'public_portal',
      ])
      .default('manual'),
    specialRequests: z.preprocess(
      (val) => (val === '' || val === null || val === undefined ? undefined : val),
      z.string().optional()
    ),
    rooms: z
      .array(
        z.object({
          roomId: z.string().min(1),
          rate: z.number().positive(),
        })
      )
      .default([]),
    hallReservations: z
      .array(
        z.object({
          hallId: z.string().uuid(),
          eventName: z.string().optional(),
          purpose: z.string().optional(),
          setupType: z.string().optional(),
          attendeeCount: z.union([z.number().int().min(0), z.string()]).optional(),
          startDateTime: z.string().datetime(),
          endDateTime: z.string().datetime(),
          cateringNotes: z.string().optional(),
          avRequirements: z.string().optional(),
          rate: z.union([z.number().nonnegative(), z.string()]).optional(),
          status: z.string().optional(),
        })
      )
      .optional(),
  })
  .refine(
    (data) =>
      (Array.isArray(data.rooms) && data.rooms.length > 0) ||
      (Array.isArray(data.hallReservations) && data.hallReservations.length > 0),
    {
      message: 'At least one room or hall reservation is required',
      path: ['rooms'],
    }
  );

export type CreateReservationBatchInput = z.infer<typeof createReservationBatchSchema>;

type ReservationWithRoom = Prisma.ReservationGetPayload<{ include: { room: true } }>;

export type BatchReservationResult = {
  groupBookingId: string | null;
  reservations: ReservationWithRoom[];
};

export type BatchReservationOptions = {
  reservationNumberFactory?: () => string;
  depositStatus?: string | null;
  depositRequired?: boolean;
};

export const validateHallReservationsForBatch = async (
  tenantId: string,
  hallReservations: any[],
  client: Prisma.TransactionClient
) => {
  if (!Array.isArray(hallReservations) || hallReservations.length === 0) return;

  const hallIds = [...new Set(hallReservations.map((hr) => hr.hallId))];
  const halls = await client.meetingHall.findMany({
    where: {
      tenantId,
      id: { in: hallIds },
      isActive: true,
    },
    select: { id: true },
  });

  const validHallIds = new Set(halls.map((hall: any) => hall.id));
  hallReservations.forEach((reservation) => {
    if (!reservation.hallId || !validHallIds.has(reservation.hallId)) {
      throw new AppError(`Meeting hall ${reservation.hallId} is not available for this tenant`, 400);
    }

    if (!reservation.startDateTime || !reservation.endDateTime) {
      throw new AppError('Hall reservations require start and end date/time', 400);
    }

    const start = new Date(reservation.startDateTime);
    const end = new Date(reservation.endDateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
      throw new AppError('Invalid hall reservation date range', 400);
    }
  });

  for (const reservation of hallReservations) {
    const start = new Date(reservation.startDateTime);
    const end = new Date(reservation.endDateTime);
    const overlap = await client.groupBookingHallReservation.findFirst({
      where: {
        tenantId,
        hallId: reservation.hallId,
        startDateTime: { lt: end },
        endDateTime: { gt: start },
        status: { in: ['tentative', 'confirmed'] },
      },
      select: { id: true },
    });

    if (overlap) {
      throw new AppError('Selected hall already has a booking for the requested schedule', 409);
    }
  }
};

export const resolveTenantUserId = async (
  tenantId: string,
  providedUserId?: string | null,
  client?: Prisma.TransactionClient
): Promise<string> => {
  const prismaClient = client ?? prisma;
  if (!prismaClient) {
    throw new AppError('Database connection not initialized', 500);
  }

  if (providedUserId) {
    const existingUser = await prismaClient.user.findFirst({
      where: {
        id: providedUserId,
        tenantId,
      },
      select: { id: true },
    });
    if (existingUser) {
      return existingUser.id;
    }
  }

  const fallbackUser = await prismaClient.user.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (fallbackUser) {
    return fallbackUser.id;
  }

  const sanitizedTenantSegment = tenantId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 12);
  const systemEmail = `system+${sanitizedTenantSegment || 'tenant'}@innsight.local`;

  const systemUser = await prismaClient.user.create({
    data: {
      tenantId,
      email: systemEmail,
      passwordHash: 'system-user-autogenerated',
      firstName: 'System',
      lastName: 'User',
      role: 'system',
      permissions: {},
      isActive: true,
    },
    select: { id: true },
  });

  return systemUser.id;
};

export const createBatchReservations = async ({
  tenantId,
  data,
  actorUserId,
  client,
  overrides,
}: {
  tenantId: string;
  data: CreateReservationBatchInput;
  actorUserId: string;
  client: Prisma.TransactionClient;
  overrides?: BatchReservationOptions;
}): Promise<BatchReservationResult> => {
  const checkIn = new Date(data.checkInDate);
  const checkOut = new Date(data.checkOutDate);
  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime()) || checkOut <= checkIn) {
    throw new AppError('Check-out date must be after check-in date', 400);
  }

  const roomIds = data.rooms.map((room) => room.roomId);
  const uniqueRoomIds = [...new Set(roomIds)];
  if (uniqueRoomIds.length !== roomIds.length) {
    throw new AppError('Duplicate rooms are not allowed in a batch reservation', 400);
  }

  const halls = Array.isArray(data.hallReservations) ? data.hallReservations : [];

  let rooms: Array<{ id: string; roomNumber: string | null; roomType: string | null }> = [];

  if (uniqueRoomIds.length > 0) {
    rooms = await client.room.findMany({
      where: {
        tenantId,
        id: { in: uniqueRoomIds },
      },
      select: {
        id: true,
        roomNumber: true,
        roomType: true,
      },
    });

    if (rooms.length !== uniqueRoomIds.length) {
      throw new AppError('One or more rooms were not found for this tenant', 404);
    }

    const overlaps = await client.reservation.findMany({
      where: {
        tenantId,
        roomId: { in: uniqueRoomIds },
        status: { in: ['confirmed', 'checked_in'] },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: {
        id: true,
        roomId: true,
      },
    });

    if (overlaps.length > 0) {
      const blockedRoomIds = [...new Set(overlaps.map((r) => r.roomId))];
      const blockedNumbers = rooms
        .filter((room) => blockedRoomIds.includes(room.id))
        .map((room) => room.roomNumber || room.id);
      throw new AppError(
        `Some rooms are not available for the selected dates: ${blockedNumbers.join(', ')}`,
        400
      );
    }
  }

  await validateHallReservationsForBatch(tenantId, halls, client);

  const nights = Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)));

  const roomSubtotal = data.rooms.reduce((sum, room) => sum + Number(room.rate) * nights, 0);
  const hallSubtotal = halls.reduce((sum, hall) => sum + (Number((hall as any).rate) || 0), 0);
  const totalRevenue = roomSubtotal + hallSubtotal;

  const shouldCreateGroupBooking = data.rooms.length > 1 || halls.length > 0;
  let groupBooking: { id: string } | null = null;

  const reservationNumberFactory =
    overrides?.reservationNumberFactory ||
    (() => `RES-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`);
  const depositStatusOverride = overrides?.depositStatus ?? (data.depositAmount ? 'pending' : null);
  const depositRequiredOverride =
    overrides?.depositRequired ?? (data.depositAmount !== undefined ? true : false);

  if (shouldCreateGroupBooking) {
    const groupBookingNumber = `GB-${new Date()
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '')}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    groupBooking = await client.groupBooking.create({
      data: {
        tenantId,
        groupBookingNumber,
        groupName: `Reservation - ${data.guestName}`,
        groupType: 'other',
        contactPerson: data.guestName,
        contactEmail: data.guestEmail || 'unknown@example.com',
        contactPhone: data.guestPhone || 'N/A',
        expectedGuests: Number(data.adults) + Number(data.children),
        confirmedGuests: 0,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        totalRooms: data.rooms.length,
        totalRevenue: new Prisma.Decimal(totalRevenue),
        depositAmount:
          data.depositAmount !== undefined ? new Prisma.Decimal(data.depositAmount) : null,
        depositPaid: false,
        status: 'confirmed',
        bookingProgress: 'confirmed',
        specialRequests: data.specialRequests || null,
        dietaryRequirements: null,
        setupRequirements: null,
        assignedTo: null,
        createdBy: actorUserId,
        hallReservations: halls.length
          ? {
              create: halls.map((reservation) => ({
                tenantId,
                hallId: reservation.hallId,
                eventName: reservation.eventName || null,
                purpose: reservation.purpose || null,
                setupType: reservation.setupType || null,
                attendeeCount:
                  reservation.attendeeCount !== undefined && reservation.attendeeCount !== null
                    ? Number(reservation.attendeeCount) || null
                    : null,
                startDateTime: new Date(reservation.startDateTime),
                endDateTime: new Date(reservation.endDateTime),
                cateringNotes: reservation.cateringNotes || null,
                avRequirements: reservation.avRequirements || null,
                status: reservation.status || 'tentative',
              })),
            }
          : undefined,
      },
    });
  }

  const reservations = data.rooms.length
    ? await Promise.all(
        data.rooms.map(async (room) => {
          const reservationNumber = reservationNumberFactory();
          return client.reservation.create({
            data: {
              tenantId,
              roomId: room.roomId,
              groupBookingId: groupBooking?.id ?? null,
              reservationNumber,
              guestName: data.guestName,
              guestId: data.guestId ?? null,
              guestEmail: data.guestEmail || null,
              guestPhone: data.guestPhone || null,
              guestIdNumber: data.guestIdNumber || null,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              adults: data.adults,
              children: data.children,
              rate: new Prisma.Decimal(room.rate),
              depositAmount:
                data.depositAmount !== undefined ? new Prisma.Decimal(data.depositAmount) : null,
              depositStatus: depositStatusOverride,
              depositRequired: depositRequiredOverride,
              source: data.source,
              specialRequests: data.specialRequests || null,
              createdBy: actorUserId,
              status: 'confirmed',
            },
            include: {
              room: true,
            },
          });
        })
      )
    : [];

  return {
    groupBookingId: groupBooking?.id ?? null,
    reservations,
  };
};
