import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma, isPrismaAvailable } from '../utils/prisma';

export const groupBookingRouter = Router({ mergeParams: true });

type PrismaClientType = typeof prisma;

const ensurePrismaClient = (): PrismaClientType => {
  if (!isPrismaAvailable() || !prisma) {
    throw new AppError('Relational database is not configured for this environment', 500);
  }
  return prisma;
};

const toPlainNumber = (value?: Prisma.Decimal | number | null) => (
  value === null || value === undefined ? value : Number(value)
);

const toPlainDate = (value?: Date | null) => (value ? value.toISOString() : null);

const includeConfig = {
  roomBlocks: true,
  hallReservations: {
    include: {
      hall: true,
    },
  },
  reservations: {
    include: {
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
    },
  },
};

const serializeGroupBooking = (booking: any) => ({
  id: booking.id,
  tenantId: booking.tenantId,
  groupBookingNumber: booking.groupBookingNumber,
  groupName: booking.groupName,
  groupType: booking.groupType,
  contactPerson: booking.contactPerson,
  contactEmail: booking.contactEmail,
  contactPhone: booking.contactPhone,
  expectedGuests: booking.expectedGuests,
  confirmedGuests: booking.confirmedGuests,
  checkInDate: toPlainDate(booking.checkInDate),
  checkOutDate: toPlainDate(booking.checkOutDate),
  totalRooms: booking.totalRooms,
  totalRevenue: toPlainNumber(booking.totalRevenue) ?? 0,
  depositAmount: toPlainNumber(booking.depositAmount),
  depositPaid: booking.depositPaid,
  status: booking.status,
  bookingProgress: booking.bookingProgress,
  specialRequests: booking.specialRequests,
  dietaryRequirements: booking.dietaryRequirements,
  setupRequirements: booking.setupRequirements,
  assignedTo: booking.assignedTo,
  createdBy: booking.createdBy,
  createdAt: toPlainDate(booking.createdAt),
  updatedAt: toPlainDate(booking.updatedAt),
  roomBlocks: booking.roomBlocks?.map((block: any) => ({
    id: block.id,
    roomCategoryId: block.roomCategoryId,
    roomType: block.roomType,
    totalRooms: block.totalRooms,
    allocatedRooms: block.allocatedRooms,
    availableRooms: block.availableRooms,
    negotiatedRate: toPlainNumber(block.negotiatedRate),
    discountPercent: toPlainNumber(block.discountPercent),
    checkInDate: toPlainDate(block.checkInDate),
    checkOutDate: toPlainDate(block.checkOutDate),
    createdAt: toPlainDate(block.createdAt),
    updatedAt: toPlainDate(block.updatedAt),
  })) ?? [],
  hallReservations: booking.hallReservations?.map((reservation: any) => ({
    id: reservation.id,
    hallId: reservation.hallId,
    eventName: reservation.eventName,
    purpose: reservation.purpose,
    setupType: reservation.setupType,
    attendeeCount: reservation.attendeeCount,
    startDateTime: toPlainDate(reservation.startDateTime),
    endDateTime: toPlainDate(reservation.endDateTime),
    cateringNotes: reservation.cateringNotes,
    avRequirements: reservation.avRequirements,
    status: reservation.status,
    createdAt: toPlainDate(reservation.createdAt),
    updatedAt: toPlainDate(reservation.updatedAt),
    hall: reservation.hall
      ? {
          id: reservation.hall.id,
          name: reservation.hall.name,
          capacity: reservation.hall.capacity,
          location: reservation.hall.location,
        }
      : null,
  })) ?? [],
  reservations: booking.reservations?.map((reservation: any) => ({
    id: reservation.id,
    reservationNumber: reservation.reservationNumber,
    roomId: reservation.roomId,
    checkInDate: toPlainDate(reservation.checkInDate),
    checkOutDate: toPlainDate(reservation.checkOutDate),
    status: reservation.status,
    rate: toPlainNumber(reservation.rate),
    room: reservation.room
      ? {
          id: reservation.room.id,
          roomNumber: reservation.room.roomNumber,
          roomType: reservation.room.roomType,
        }
      : null,
  })) ?? [],
});

const generateGroupBookingNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `GB-${dateStr}-${randomStr}`;
};

const validateHallReservations = async (
  tenantId: string,
  hallReservations: any[],
  client: PrismaClientType
) => {
  if (!hallReservations.length) return;

  const hallIds = [...new Set(hallReservations.map((hr) => hr.hallId))];

  const halls = await client.meetingHall.findMany({
    where: {
      tenantId,
      id: { in: hallIds },
      isActive: true,
    },
    select: { id: true },
  });

  const validHallIds = new Set(halls.map((hall) => hall.id));
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

// ============================================
// GROUP BOOKING CRUD
// ============================================

// GET /api/tenants/:tenantId/group-bookings - List group bookings
groupBookingRouter.get('/', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const { skip, take, page, limit } = getPaginationParams(req);
  const { status, startDate, endDate } = req.query;

  const where: Prisma.GroupBookingWhereInput = {
    tenantId,
  };

  if (status && typeof status === 'string' && status !== 'all') {
    where.status = status;
  }

  if (startDate || endDate) {
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    if (start && Number.isNaN(start.getTime())) {
      throw new AppError('Invalid startDate filter', 400);
    }
    if (end && Number.isNaN(end.getTime())) {
      throw new AppError('Invalid endDate filter', 400);
    }

    where.checkInDate = {
      gte: start,
      lte: end,
    };
  }

  try {
    const [total, bookings] = await client.$transaction([
      client.groupBooking.count({ where }),
      client.groupBooking.findMany({
        where,
        orderBy: { checkInDate: 'desc' },
        skip,
        take,
        include: includeConfig,
      }),
    ]);

    const serialized = bookings.map(serializeGroupBooking);
    const result = createPaginationResult(serialized, total, page, limit);

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
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const bookingData = req.body;

  try {
    if (!bookingData.groupName || !bookingData.contactPerson ||
      !bookingData.contactEmail || !bookingData.contactPhone) {
      throw new AppError('Group name, contact person, email, and phone are required', 400);
    }

    if (!bookingData.checkInDate || !bookingData.checkOutDate) {
      throw new AppError('Check-in and check-out dates are required', 400);
    }

    const checkInDate = new Date(bookingData.checkInDate);
    const checkOutDate = new Date(bookingData.checkOutDate);

    if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime())) {
      throw new AppError('Invalid check-in/check-out date format', 400);
    }

    if (checkInDate >= checkOutDate) {
      throw new AppError('Check-out date must be after check-in date', 400);
    }

    const roomBlocks: any[] = Array.isArray(bookingData.roomBlocks) ? bookingData.roomBlocks : [];
    const hallReservations: any[] = Array.isArray(bookingData.hallReservations) ? bookingData.hallReservations : [];

    await validateHallReservations(tenantId, hallReservations, client);

    const totalRoomsFromBlocks = roomBlocks.reduce((sum, block) => (
      sum + (Number(block.totalRooms) || 0)
    ), 0);

    const groupBooking = await client.groupBooking.create({
      data: {
        tenantId,
        groupBookingNumber: generateGroupBookingNumber(),
        groupName: bookingData.groupName,
        groupType: bookingData.groupType || 'other',
        contactPerson: bookingData.contactPerson,
        contactEmail: bookingData.contactEmail,
        contactPhone: bookingData.contactPhone,
        expectedGuests: Number(bookingData.expectedGuests) || 0,
        confirmedGuests: 0,
        checkInDate,
        checkOutDate,
        totalRooms: bookingData.totalRooms || totalRoomsFromBlocks,
        totalRevenue: bookingData.totalRevenue || 0,
        depositAmount: bookingData.depositAmount ?? null,
        depositPaid: bookingData.depositPaid ?? false,
        status: bookingData.status || 'pending',
        bookingProgress: bookingData.bookingProgress || 'initial_contact',
        specialRequests: bookingData.specialRequests || null,
        dietaryRequirements: bookingData.dietaryRequirements || null,
        setupRequirements: bookingData.setupRequirements || null,
        assignedTo: bookingData.assignedTo || null,
        createdBy: req.user?.id || 'system',
        roomBlocks: roomBlocks.length ? {
          create: roomBlocks.map((block) => ({
            tenantId,
            roomCategoryId: block.roomCategoryId,
            roomType: block.roomType || '',
            totalRooms: Number(block.totalRooms) || 0,
            allocatedRooms: Number(block.allocatedRooms) || 0,
            availableRooms: Number(block.availableRooms ?? (Number(block.totalRooms) || 0)),
            negotiatedRate: block.negotiatedRate ?? null,
            discountPercent: block.discountPercent ?? null,
            checkInDate,
            checkOutDate,
          })),
        } : undefined,
        hallReservations: hallReservations.length ? {
          create: hallReservations.map((reservation) => ({
            tenantId,
            hallId: reservation.hallId,
            eventName: reservation.eventName || null,
            purpose: reservation.purpose || null,
            setupType: reservation.setupType || null,
            attendeeCount: reservation.attendeeCount ? Number(reservation.attendeeCount) : null,
            startDateTime: new Date(reservation.startDateTime),
            endDateTime: new Date(reservation.endDateTime),
            cateringNotes: reservation.cateringNotes || null,
            avRequirements: reservation.avRequirements || null,
            status: reservation.status || 'tentative',
          })),
        } : undefined,
      },
      include: includeConfig,
    });

    res.status(201).json({
      success: true,
      data: serializeGroupBooking(groupBooking),
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

// GET /api/tenants/:tenantId/group-bookings/meeting-halls - List available meeting halls
groupBookingRouter.get('/meeting-halls', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;

  try {
    const halls = await client.meetingHall.findMany({
      where: {
        tenantId,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: halls.map((hall) => ({
        id: hall.id,
        name: hall.name,
        description: hall.description,
        capacity: hall.capacity,
        location: hall.location,
        amenities: hall.amenities,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching meeting halls:', error);
    throw new AppError(
      `Failed to fetch meeting halls: ${error.message || 'Unknown error'}`,
      500
    );
  }
});

// GET /api/tenants/:tenantId/group-bookings/:bookingId - Get group booking details
groupBookingRouter.get('/:bookingId', authenticate, requireTenantAccess, async (req: AuthRequest, res) => {
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const bookingId = req.params.bookingId;

  try {
    const booking = await client.groupBooking.findFirst({
      where: {
        id: bookingId,
        tenantId,
      },
      include: includeConfig,
    });

    if (!booking) {
      throw new AppError('Group booking not found', 404);
    }

    res.json({
      success: true,
      data: serializeGroupBooking(booking),
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
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const bookingId = req.params.bookingId;
  const updates = req.body;

  try {
    const existing = await client.groupBooking.findFirst({
      where: { id: bookingId, tenantId },
    });

    if (!existing) {
      throw new AppError('Group booking not found', 404);
    }

    const data: Prisma.GroupBookingUpdateInput = {
      groupName: updates.groupName ?? existing.groupName,
      groupType: updates.groupType ?? existing.groupType,
      contactPerson: updates.contactPerson ?? existing.contactPerson,
      contactEmail: updates.contactEmail ?? existing.contactEmail,
      contactPhone: updates.contactPhone ?? existing.contactPhone,
      expectedGuests: updates.expectedGuests ?? existing.expectedGuests,
      confirmedGuests: updates.confirmedGuests ?? existing.confirmedGuests,
      totalRooms: updates.totalRooms ?? existing.totalRooms,
      totalRevenue: updates.totalRevenue ?? existing.totalRevenue,
      depositAmount: updates.depositAmount ?? existing.depositAmount,
      depositPaid: typeof updates.depositPaid === 'boolean' ? updates.depositPaid : existing.depositPaid,
      status: updates.status ?? existing.status,
      bookingProgress: updates.bookingProgress ?? existing.bookingProgress,
      specialRequests: updates.specialRequests ?? existing.specialRequests,
      dietaryRequirements: updates.dietaryRequirements ?? existing.dietaryRequirements,
      setupRequirements: updates.setupRequirements ?? existing.setupRequirements,
    };

    if (updates.checkInDate) {
      const date = new Date(updates.checkInDate);
      if (Number.isNaN(date.getTime())) {
        throw new AppError('Invalid check-in date', 400);
      }
      data.checkInDate = date;
    }

    if (updates.checkOutDate) {
      const date = new Date(updates.checkOutDate);
      if (Number.isNaN(date.getTime())) {
        throw new AppError('Invalid check-out date', 400);
      }
      data.checkOutDate = date;
    }

    if (data.checkInDate && data.checkOutDate && data.checkInDate >= data.checkOutDate) {
      throw new AppError('Check-out date must be after check-in date', 400);
    }

    const updated = await client.groupBooking.update({
      where: { id: bookingId },
      data,
      include: includeConfig,
    });

    res.json({
      success: true,
      data: serializeGroupBooking(updated),
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
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const bookingId = req.params.bookingId;

  try {
    const booking = await client.groupBooking.findFirst({
      where: { id: bookingId, tenantId },
      select: { id: true },
    });

    if (!booking) {
      throw new AppError('Group booking not found', 404);
    }

    const hasReservations = await client.reservation.findFirst({
      where: {
        tenantId,
        groupBookingId: bookingId,
      },
      select: { id: true },
    });

    if (hasReservations) {
      throw new AppError('Cannot delete group booking with existing reservations. Cancel reservations first.', 400);
    }

    await client.$transaction([
      client.groupBookingHallReservation.deleteMany({
        where: { tenantId, groupBookingId: bookingId },
      }),
      client.roomBlock.deleteMany({
        where: { tenantId, groupBookingId: bookingId },
      }),
      client.groupBooking.delete({
        where: { id: bookingId },
      }),
    ]);

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
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const bookingId = req.params.bookingId;
  const blockData = req.body;

  try {
    const booking = await client.groupBooking.findFirst({
      where: { id: bookingId, tenantId },
    });

    if (!booking) {
      throw new AppError('Group booking not found', 404);
    }

    if (!blockData.roomCategoryId || !blockData.totalRooms) {
      throw new AppError('Room category and total rooms are required', 400);
    }

    const totalRooms = Number(blockData.totalRooms);
    if (!Number.isFinite(totalRooms) || totalRooms <= 0) {
      throw new AppError('Total rooms must be greater than zero', 400);
    }

    const roomBlock = await client.roomBlock.create({
      data: {
        tenantId,
        groupBookingId: bookingId,
        roomCategoryId: blockData.roomCategoryId,
        roomType: blockData.roomType || '',
        totalRooms,
        allocatedRooms: 0,
        availableRooms: totalRooms,
        negotiatedRate: blockData.negotiatedRate ?? null,
        discountPercent: blockData.discountPercent ?? null,
        checkInDate: booking.checkInDate,
        checkOutDate: booking.checkOutDate,
      },
    });

    await client.groupBooking.update({
      where: { id: bookingId },
      data: {
        totalRooms: {
          increment: totalRooms,
        },
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: roomBlock.id,
        roomCategoryId: roomBlock.roomCategoryId,
        roomType: roomBlock.roomType,
        totalRooms: roomBlock.totalRooms,
        allocatedRooms: roomBlock.allocatedRooms,
        availableRooms: roomBlock.availableRooms,
        negotiatedRate: toPlainNumber(roomBlock.negotiatedRate),
        discountPercent: toPlainNumber(roomBlock.discountPercent),
        checkInDate: toPlainDate(roomBlock.checkInDate),
        checkOutDate: toPlainDate(roomBlock.checkOutDate),
        createdAt: toPlainDate(roomBlock.createdAt),
        updatedAt: toPlainDate(roomBlock.updatedAt),
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
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const bookingId = req.params.bookingId;
  const blockId = req.params.blockId;
  const updates = req.body;

  try {
    const block = await client.roomBlock.findFirst({
      where: { id: blockId, tenantId, groupBookingId: bookingId },
    });

    if (!block) {
      throw new AppError('Room block not found', 404);
    }

    const newTotalRooms = updates.totalRooms !== undefined ? Number(updates.totalRooms) : block.totalRooms;

    if (newTotalRooms < block.allocatedRooms) {
      throw new AppError('Cannot reduce total rooms below allocated rooms', 400);
    }

    const updated = await client.roomBlock.update({
      where: { id: blockId },
      data: {
        roomType: updates.roomType ?? block.roomType,
        roomCategoryId: updates.roomCategoryId ?? block.roomCategoryId,
        totalRooms: newTotalRooms,
        availableRooms: newTotalRooms - block.allocatedRooms,
        negotiatedRate: updates.negotiatedRate ?? block.negotiatedRate,
        discountPercent: updates.discountPercent ?? block.discountPercent,
      },
    });

    if (newTotalRooms !== block.totalRooms) {
      await client.groupBooking.update({
        where: { id: bookingId },
        data: {
          totalRooms: {
            increment: newTotalRooms - block.totalRooms,
          },
        },
      });
    }

    res.json({
      success: true,
      data: {
        id: updated.id,
        roomCategoryId: updated.roomCategoryId,
        roomType: updated.roomType,
        totalRooms: updated.totalRooms,
        allocatedRooms: updated.allocatedRooms,
        availableRooms: updated.availableRooms,
        negotiatedRate: toPlainNumber(updated.negotiatedRate),
        discountPercent: toPlainNumber(updated.discountPercent),
        checkInDate: toPlainDate(updated.checkInDate),
        checkOutDate: toPlainDate(updated.checkOutDate),
        createdAt: toPlainDate(updated.createdAt),
        updatedAt: toPlainDate(updated.updatedAt),
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
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;
  const bookingId = req.params.bookingId;
  const blockId = req.params.blockId;

  try {
    const block = await client.roomBlock.findFirst({
      where: { id: blockId, tenantId, groupBookingId: bookingId },
    });

    if (!block) {
      throw new AppError('Room block not found', 404);
    }

    if (block.allocatedRooms > 0) {
      throw new AppError('Cannot delete room block with allocated rooms. Deallocate rooms first.', 400);
    }

    await client.$transaction([
      client.roomBlock.delete({
        where: { id: blockId },
      }),
      client.groupBooking.update({
        where: { id: bookingId },
        data: {
          totalRooms: {
            decrement: block.totalRooms,
          },
        },
      }),
    ]);

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
  const client = ensurePrismaClient();
  const tenantId = req.params.tenantId;

  try {
    const now = new Date();

    const [
      totalBookings,
      confirmedBookings,
      pendingBookings,
      revenueAggregate,
      roomsAggregate,
      upcomingBookings,
    ] = await Promise.all([
      client.groupBooking.count({ where: { tenantId } }),
      client.groupBooking.count({ where: { tenantId, status: 'confirmed' } }),
      client.groupBooking.count({ where: { tenantId, status: 'pending' } }),
      client.groupBooking.aggregate({
        where: { tenantId },
        _sum: { totalRevenue: true },
      }),
      client.groupBooking.aggregate({
        where: { tenantId },
        _sum: { totalRooms: true },
      }),
      client.groupBooking.count({
        where: {
          tenantId,
          checkInDate: { gt: now },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalBookings,
        confirmedBookings,
        pendingBookings,
        totalRevenue: toPlainNumber(revenueAggregate._sum.totalRevenue) ?? 0,
        totalRooms: roomsAggregate._sum.totalRooms ?? 0,
        upcomingBookings,
      },
    });
  } catch (error: any) {
    console.error('Error fetching group booking stats:', error);
    throw new AppError(
      `Failed to fetch group booking stats: ${error.message || 'Unknown error'}`,
      500
    );
  }
});
