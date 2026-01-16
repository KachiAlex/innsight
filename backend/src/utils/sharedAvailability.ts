import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { prisma } from './prisma';

const decimalToNumber = (value?: Prisma.Decimal | null) =>
  value !== null && value !== undefined ? Number(value) : null;

const resolveRoomEffectiveRate = (room: {
  customRate?: Prisma.Decimal | number | null;
  ratePlan?: { baseRate?: Prisma.Decimal | number | null } | null;
}) => {
  const customRate = decimalToNumber(room.customRate as Prisma.Decimal | null);
  if (customRate !== null) {
    return customRate;
  }
  const baseRate = decimalToNumber(room.ratePlan?.baseRate as Prisma.Decimal | null);
  return baseRate;
};

export type HallRecord = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  capacity: number;
  location: string | null;
  amenities: Prisma.JsonValue | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const mapHallRecord = (hall: HallRecord) => {
  const amenitiesObject = (hall.amenities as Record<string, unknown> | null | undefined) ?? {};
  const assets = Array.isArray((amenitiesObject as any).assets)
    ? ((amenitiesObject as any).assets as unknown[]).filter((item) => typeof item === 'string')
    : [];

  return {
    id: hall.id,
    tenantId: hall.tenantId,
    name: hall.name,
    description: hall.description,
    capacity: hall.capacity,
    location: hall.location,
    assets,
    isActive: hall.isActive,
    createdAt: hall.createdAt,
    updatedAt: hall.updatedAt,
  };
};

export const getHallAvailability = async (tenantId: string, start: Date, end: Date) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const halls = await prisma.meetingHall.findMany({
    where: {
      tenantId,
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  if (halls.length === 0) {
    return {
      totalHalls: 0,
      availableCount: 0,
      availableHalls: [],
      unavailableHalls: [],
    };
  }

  const overlappingHallReservations = await prisma.groupBookingHallReservation.findMany({
    where: {
      tenantId,
      status: {
        in: ['tentative', 'confirmed'],
      },
      startDateTime: { lt: end },
      endDateTime: { gt: start },
    },
    select: {
      id: true,
      hallId: true,
      eventName: true,
      status: true,
      startDateTime: true,
      endDateTime: true,
      groupBookingId: true,
    },
  });

  const reservationsByHall = new Map<string, typeof overlappingHallReservations>();
  overlappingHallReservations.forEach((reservation) => {
    const existing = reservationsByHall.get(reservation.hallId) ?? [];
    existing.push(reservation);
    reservationsByHall.set(reservation.hallId, existing);
  });

  const availableHalls: any[] = [];
  const unavailableHalls: any[] = [];

  halls.forEach((hall) => {
    const normalized = mapHallRecord(hall as HallRecord);
    const overlaps = reservationsByHall.get(hall.id) ?? [];

    if (overlaps.length === 0) {
      availableHalls.push(normalized);
      return;
    }

    unavailableHalls.push({
      ...normalized,
      reservations: overlaps.map((reservation) => ({
        id: reservation.id,
        groupBookingId: reservation.groupBookingId,
        eventName: reservation.eventName,
        status: reservation.status,
        startDateTime: reservation.startDateTime.toISOString(),
        endDateTime: reservation.endDateTime.toISOString(),
      })),
    });
  });

  return {
    totalHalls: halls.length,
    availableCount: availableHalls.length,
    availableHalls,
    unavailableHalls,
  };
};

export const availabilityQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  roomType: z.string().optional(),
  categoryId: z.string().optional(),
  ratePlanId: z.string().optional(),
  minOccupancy: z.coerce.number().int().min(1).optional(),
  floor: z.coerce.number().int().optional(),
  minRate: z.coerce.number().nonnegative().optional(),
  maxRate: z.coerce.number().nonnegative().optional(),
  includeOutOfOrder: z.coerce.boolean().optional(),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const fetchTenantAvailability = async (
  tenantId: string,
  query: AvailabilityQuery
) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const parsed = availabilityQuerySchema.parse(query);

  const {
    startDate,
    endDate,
    roomType,
    categoryId,
    ratePlanId,
    minOccupancy,
    floor,
    minRate,
    maxRate,
    includeOutOfOrder,
  } = parsed;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    throw new AppError('End date must be after start date', 400);
  }
  if (minRate !== undefined && maxRate !== undefined && Number(minRate) > Number(maxRate)) {
    throw new AppError('Minimum rate cannot be greater than maximum rate', 400);
  }

  const blockedStatuses = includeOutOfOrder ? [] : ['out_of_order', 'maintenance'];

  const rooms = await prisma.room.findMany({
    where: {
      tenantId,
      ...(roomType ? { roomType } : {}),
      ...(typeof floor === 'number' ? { floor } : {}),
      ...(includeOutOfOrder
        ? {}
        : {
            status: {
              notIn: blockedStatuses,
            },
          }),
      ...(minOccupancy
        ? {
            maxOccupancy: {
              gte: minOccupancy,
            },
          }
        : {}),
      ...(categoryId
        ? categoryId === 'none'
          ? {
              categoryId: null,
            }
          : { categoryId }
        : {}),
      ...(ratePlanId ? { ratePlanId } : {}),
    },
    include: {
      ratePlan: true,
      category: true,
    },
  });

  const categoryRatePlans = await prisma.ratePlan.findMany({
    where: {
      tenantId,
      isActive: true,
      categoryId: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      baseRate: true,
      categoryId: true,
    },
  });

  const categoryRatePlanMap = new Map<string, (typeof categoryRatePlans)[0]>();
  for (const plan of categoryRatePlans) {
    if (!plan.categoryId) continue;
    const existing = categoryRatePlanMap.get(plan.categoryId);
    if (!existing) {
      categoryRatePlanMap.set(plan.categoryId, plan);
      continue;
    }
    const existingRate = decimalToNumber(existing.baseRate);
    const newRate = decimalToNumber(plan.baseRate);
    if (newRate !== null && (existingRate === null || newRate < existingRate)) {
      categoryRatePlanMap.set(plan.categoryId, plan);
    }
  }

  if (rooms.length === 0) {
    const hallAvailability = await getHallAvailability(tenantId, start, end);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      totalRooms: 0,
      availableCount: 0,
      availableRooms: [],
      unavailableRooms: [],
      recommendedRooms: [],
      hallAvailability,
    };
  }

  const allowedRoomIds = rooms.map((room) => room.id);

  const overlappingReservations = await prisma.reservation.findMany({
    where: {
      tenantId,
      status: {
        in: ['confirmed', 'checked_in'],
      },
      roomId: {
        in: allowedRoomIds,
      },
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    select: {
      id: true,
      reservationNumber: true,
      status: true,
      checkInDate: true,
      checkOutDate: true,
      guestName: true,
      roomId: true,
    },
  });

  const unavailableRoomReservations: Map<string, any[]> = new Map();

  for (const reservation of overlappingReservations) {
    if (!reservation.roomId) continue;
    const summaries = unavailableRoomReservations.get(reservation.roomId) ?? [];
    summaries.push({
      reservationId: reservation.id,
      reservationNumber: reservation.reservationNumber,
      status: reservation.status,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      guestName: reservation.guestName,
    });
    unavailableRoomReservations.set(reservation.roomId, summaries);
  }

  const availableRoomsRaw = rooms.filter((room) => !unavailableRoomReservations.has(room.id));

  const availableRoomsWithRates = availableRoomsRaw.map((room) => {
    const fallbackRatePlan =
      !room.ratePlan && room.categoryId ? categoryRatePlanMap.get(room.categoryId) : null;
    const selectedRatePlan = room.ratePlan ?? fallbackRatePlan ?? null;
    const ratePlanBaseRate = selectedRatePlan ? decimalToNumber(selectedRatePlan.baseRate) : null;
    const effectiveRate = resolveRoomEffectiveRate({
      customRate: room.customRate,
      ratePlan: selectedRatePlan
        ? {
            baseRate: ratePlanBaseRate,
          }
        : null,
    });

    return {
      id: room.id,
      roomNumber: room.roomNumber || '',
      roomType: room.roomType || '',
      floor: typeof room.floor === 'number' ? room.floor : null,
      status: room.status || 'available',
      maxOccupancy: room.maxOccupancy || 0,
      amenities: room.amenities || null,
      categoryId: room.categoryId || null,
      ratePlanId: room.ratePlanId ?? fallbackRatePlan?.id ?? null,
      ratePlan: selectedRatePlan
        ? {
            id: selectedRatePlan.id,
            name: selectedRatePlan.name,
            baseRate: ratePlanBaseRate,
          }
        : null,
      category: room.category
        ? {
            id: room.category.id,
            name: room.category.name,
          }
        : null,
      customRate: decimalToNumber(room.customRate as Prisma.Decimal | null),
      effectiveRate,
    };
  });

  const availableRooms = availableRoomsWithRates.filter((room) => {
    const effectiveRate = room.effectiveRate ?? null;

    if (minRate !== undefined) {
      if (effectiveRate === null || effectiveRate < Number(minRate)) {
        return false;
      }
    }
    if (maxRate !== undefined) {
      if (effectiveRate === null || effectiveRate > Number(maxRate)) {
        return false;
      }
    }
    return true;
  });

  const unavailableRooms = Array.from(unavailableRoomReservations.entries()).map(
    ([roomId, reservations]) => ({
      roomId,
      reservations: reservations.map((reservation) => ({
        ...reservation,
        checkInDate: reservation.checkInDate?.toISOString?.() || null,
        checkOutDate: reservation.checkOutDate?.toISOString?.() || null,
      })),
    })
  );

  const recommendedRooms = availableRoomsWithRates
    .filter((room) => room.status !== 'available')
    .map((room) => ({
      id: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
      status: room.status,
      rate: room.effectiveRate ?? null,
      categoryId: room.categoryId,
      ratePlan: room.ratePlan,
    }))
    .slice(0, 3);

  const hallAvailability = await getHallAvailability(tenantId, start, end);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totalRooms: rooms.length,
    availableCount: availableRooms.length,
    availableRooms,
    unavailableRooms,
    recommendedRooms,
    hallAvailability,
  };
};
