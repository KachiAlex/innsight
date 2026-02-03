import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import { createRoomLog } from '../utils/roomLogs';
import {
  availabilityQuerySchema as sharedAvailabilityQuerySchema,
  fetchTenantAvailability,
} from '../utils/sharedAvailability';
import {
  createBatchReservations,
  createReservationBatchSchema,
  resolveTenantUserId,
} from '../utils/reservationBatch';
import { upsertGuestProfile } from '../utils/guestProfiles';
import { 
  sendEmail, 
  generateReservationConfirmationEmail, 
  generateCheckInReminderEmail,
  generateCheckOutThankYouEmail,
  getTenantEmailSettings,
  type ReservationEmailData,
} from '../utils/email';
import { v4 as uuidv4 } from 'uuid';
export const reservationRouter = Router({ mergeParams: true });

const getUserDisplayName = (user?: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) => {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || null;
};

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

const serializeReservation = (reservation: any) => {
  if (!reservation) return reservation;
  return {
    ...reservation,
    rate: decimalToNumber(reservation.rate),
    depositAmount: decimalToNumber(reservation.depositAmount),
  };
};

type RoomReservationSummary = {
  reservationId: string;
  reservationNumber: string | null;
  status: string | null;
  checkInDate: Date | null;
  checkOutDate: Date | null;
  guestName: string | null;
};

const serializeFolio = (folio: any) => {
  if (!folio) return folio;
  return {
    ...folio,
    totalCharges: decimalToNumber(folio.totalCharges) ?? 0,
    totalPayments: decimalToNumber(folio.totalPayments) ?? 0,
    balance: decimalToNumber(folio.balance) ?? 0,
    charges: (folio.charges ?? []).map((charge: any) => ({
      ...charge,
      amount: decimalToNumber(charge.amount) ?? 0,
      total: decimalToNumber(charge.total) ?? 0,
      taxRate: decimalToNumber(charge.taxRate),
      taxAmount: decimalToNumber(charge.taxAmount),
    })),
    payments: (folio.payments ?? []).map((payment: any) => ({
      ...payment,
      amount: decimalToNumber(payment.amount) ?? 0,
    })),
  };
};

const availabilityQuerySchema = sharedAvailabilityQuerySchema;

const createReservationSchema = z.object({
  roomId: z.string().min(1),
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
  rate: z.number().positive(),
  depositAmount: z.number().nonnegative().optional(),
  source: z.enum(['manual', 'web', 'ota', 'channel_manager']).default('manual'),
  specialRequests: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.string().optional()
  ),
});

type GuestResolutionInput = {
  tenantId: string;
  guestName: string;
  guestId?: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
};

const resolveGuestContext = async ({
  tenantId,
  guestName,
  guestId,
  guestEmail,
  guestPhone,
}: GuestResolutionInput) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  if (guestId) {
    const existingGuest = await prisma.guest.findFirst({
      where: {
        id: guestId,
        tenantId,
      },
      select: {
        id: true,
        email: true,
        phone: true,
      },
    });

    if (!existingGuest) {
      throw new AppError('Guest not found', 404);
    }

    return {
      guestId: existingGuest.id,
      guestEmail: existingGuest.email ?? guestEmail ?? null,
      guestPhone: existingGuest.phone ?? guestPhone ?? null,
    };
  }

  if (!guestEmail && !guestPhone) {
    return {
      guestId: null,
      guestEmail: guestEmail ?? null,
      guestPhone: guestPhone ?? null,
    };
  }

  const guestProfile = await upsertGuestProfile({
    tenantId,
    name: guestName,
    email: guestEmail ?? undefined,
    phone: guestPhone ?? undefined,
  });

  return {
    guestId: guestProfile?.id ?? null,
    guestEmail: guestProfile?.email ?? guestEmail ?? null,
    guestPhone: guestProfile?.phone ?? guestPhone ?? null,
  };
};

// POST /api/tenants/:tenantId/reservations
// GET /api/tenants/:tenantId/reservations/availability
reservationRouter.get(
  '/availability',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }
      const parsed = availabilityQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        throw new AppError('Invalid availability query parameters', 400);
      }

      const data = await fetchTenantAvailability(tenantId, parsed.data);

      res.json({
        success: true,
        data,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error checking availability:', error);
      throw new AppError(
        `Failed to fetch availability: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

reservationRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }
      const data = createReservationSchema.parse(req.body);

      // Validate dates
      const checkIn = new Date(data.checkInDate);
      const checkOut = new Date(data.checkOutDate);
      if (checkOut <= checkIn) {
        throw new AppError('Check-out date must be after check-in date', 400);
      }

      // Validate room
      const room = await prisma.room.findFirst({
        where: {
          id: data.roomId,
          tenantId,
        },
      });

      if (!room) {
        throw new AppError('Room not found', 404);
      }

      // Check for overlapping reservations
      const overlapping = await prisma.reservation.findFirst({
        where: {
          tenantId,
          roomId: data.roomId,
          status: {
            in: ['confirmed', 'checked_in'],
          },
          AND: [
            {
              checkInDate: {
                lt: checkOut,
              },
            },
            {
              checkOutDate: {
                gt: checkIn,
              },
            },
          ],
        },
        select: { id: true },
      });

      if (overlapping) {
        throw new AppError('Room is not available for the selected dates', 400);
      }

      const reservationNumber = `RES-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      const guestContext = await resolveGuestContext({
        tenantId,
        guestName: data.guestName,
        guestId: data.guestId,
        guestEmail: data.guestEmail ?? null,
        guestPhone: data.guestPhone ?? null,
      });

      const reservation = await prisma.reservation.create({
        data: {
          tenantId,
          roomId: data.roomId,
          reservationNumber,
          guestName: data.guestName,
          guestId: guestContext.guestId,
          guestEmail: guestContext.guestEmail,
          guestPhone: guestContext.guestPhone,
          guestIdNumber: data.guestIdNumber || null,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: data.adults,
          children: data.children,
          rate: new Prisma.Decimal(data.rate),
          depositAmount:
            data.depositAmount !== undefined
              ? new Prisma.Decimal(data.depositAmount)
              : null,
          depositStatus: data.depositAmount ? 'pending' : null,
          depositRequired: data.depositAmount ? true : false,
          source: data.source,
          specialRequests: data.specialRequests || null,
          createdBy: req.user!.id,
          status: 'confirmed',
        },
        include: {
          room: true,
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      const serializedReservation = {
        ...reservation,
        rate: Number(reservation.rate),
        depositAmount: reservation.depositAmount
          ? Number(reservation.depositAmount)
          : null,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_reservation',
        entityType: 'reservation',
        entityId: reservation.id,
        afterState: serializedReservation,
        metadata: {
          reservationNumber,
        },
      });

      await createRoomLog({
        tenantId,
        roomId: data.roomId,
        type: 'reservation_created',
        summary: `Reservation ${reservationNumber} created for ${data.guestName}`,
        metadata: {
          reservationId: reservation.id,
          reservationNumber,
          checkInDate: checkIn.toISOString(),
          checkOutDate: checkOut.toISOString(),
          guestName: data.guestName,
        },
        user: {
          id: req.user?.id || null,
          name: getUserDisplayName(req.user),
        },
      });

      // Send confirmation email asynchronously (don't block response)
      if (data.guestEmail) {
        (async () => {
          try {
            const tenantSettings = await getTenantEmailSettings(tenantId);
            if (tenantSettings) {
              const emailData: ReservationEmailData = {
                reservationNumber,
                guestName: data.guestName,
                guestEmail: data.guestEmail!,
                checkInDate: checkIn,
                checkOutDate: checkOut,
                roomNumber: room.roomNumber || 'N/A',
                roomType: room.roomType || undefined,
                rate: data.rate,
                adults: data.adults,
                children: data.children,
                specialRequests: data.specialRequests || undefined,
                propertyName: tenantSettings.propertyName,
                propertyAddress: tenantSettings.propertyAddress || undefined,
                propertyPhone: tenantSettings.propertyPhone || undefined,
                propertyEmail: tenantSettings.propertyEmail || undefined,
              };

              const emailHtml = generateReservationConfirmationEmail(emailData);
              await sendEmail({
                to: data.guestEmail!,
                subject: `Reservation Confirmation - ${reservationNumber}`,
                html: emailHtml,
              });
            }
          } catch (emailError) {
            console.error('Failed to send reservation confirmation email:', emailError);
            // Don't throw - email failure shouldn't fail the reservation creation
          }
        })();
      }

      res.status(201).json({
        success: true,
        data: serializedReservation,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const message = error.errors?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') || 'Invalid reservation data';
        throw new AppError(message, 400);
      }
      console.error('Error creating reservation:', error);
      throw new AppError(
        `Failed to create reservation: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

reservationRouter.post(
  '/batch',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const data = createReservationBatchSchema.parse(req.body);

      const guestContext = await resolveGuestContext({
        tenantId,
        guestName: data.guestName,
        guestId: data.guestId,
        guestEmail: data.guestEmail ?? null,
        guestPhone: data.guestPhone ?? null,
      });

      const payloadWithGuest = {
        ...data,
        guestId: guestContext.guestId ?? undefined,
        guestEmail: guestContext.guestEmail ?? undefined,
        guestPhone: guestContext.guestPhone ?? undefined,
      };

      const result = await prisma.$transaction(async (tx) => {
        const actorUserId = await resolveTenantUserId(tenantId, req.user?.id, tx);
        const batch = await createBatchReservations({
          tenantId,
          data: payloadWithGuest,
          actorUserId,
          client: tx,
        });

        return batch;
      });

      const serializedReservations = result.reservations.map((reservation: any) => ({
        ...reservation,
        rate: decimalToNumber(reservation.rate),
        depositAmount: decimalToNumber(reservation.depositAmount),
      }));

      await Promise.all(
        serializedReservations.map(async (serializedReservation) => {
          const logGroupBookingId = result.groupBookingId ?? undefined;

          await createAuditLog({
            tenantId,
            userId: req.user!.id,
            action: 'create_reservation',
            entityType: 'reservation',
            entityId: serializedReservation.id,
            afterState: serializedReservation,
            metadata: {
              reservationNumber: serializedReservation.reservationNumber,
              groupBookingId: logGroupBookingId,
              batch: true,
            },
          });

          await createRoomLog({
            tenantId,
            roomId: serializedReservation.roomId,
            type: 'reservation_created',
            summary: `Reservation ${serializedReservation.reservationNumber} created for ${data.guestName}`,
            metadata: {
              reservationId: serializedReservation.id,
              reservationNumber: serializedReservation.reservationNumber,
              checkInDate: new Date(serializedReservation.checkInDate).toISOString(),
              checkOutDate: new Date(serializedReservation.checkOutDate).toISOString(),
              guestName: data.guestName,
              groupBookingId: logGroupBookingId,
            },
            user: {
              id: req.user?.id || null,
              name: getUserDisplayName(req.user),
            },
          });
        })
      );

      res.status(201).json({
        success: true,
        data: {
          groupBookingId: result.groupBookingId,
          reservationIds: serializedReservations.map((reservation) => reservation.id),
          reservations: serializedReservations.map((reservation) => serializeReservation(reservation)),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const message =
          error.errors?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') ||
          'Invalid reservation data';
        throw new AppError(message, 400);
      }
      console.error('Error creating batch reservations:', error);
      throw new AppError(
        `Failed to create reservations: ${error.message || 'Database connection error'}`,
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
      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const reservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          tenantId,
        },
        include: {
          room: true,
          creator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          checkInStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          checkOutStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          folios: {
            include: {
              charges: true,
              payments: true,
            },
          },
        },
      });

      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      const serializedReservation = {
        ...reservation,
        rate: decimalToNumber(reservation.rate),
        depositAmount: decimalToNumber(reservation.depositAmount),
        folios: reservation.folios.map((folio) => ({
          ...folio,
          totalCharges: decimalToNumber(folio.totalCharges) ?? 0,
          totalPayments: decimalToNumber(folio.totalPayments) ?? 0,
          balance: decimalToNumber(folio.balance) ?? 0,
          charges: folio.charges.map((charge) => ({
            ...charge,
            amount: decimalToNumber(charge.amount) ?? 0,
            total: decimalToNumber(charge.total) ?? 0,
            taxRate: decimalToNumber(charge.taxRate),
            taxAmount: decimalToNumber(charge.taxAmount),
          })),
          payments: folio.payments.map((payment) => ({
            ...payment,
            amount: decimalToNumber(payment.amount) ?? 0,
          })),
        })),
      };

      res.json({
        success: true,
        data: serializedReservation,
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
      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const { status, roomId, startDate, endDate } = req.query;

      const { page, limit } = getPaginationParams(req);

      const where: Prisma.ReservationWhereInput = {
        tenantId,
        ...(status ? { status: status as string } : {}),
        ...(roomId ? { roomId: roomId as string } : {}),
      };

      const dateFilters: Prisma.ReservationWhereInput[] = [];
      if (startDate) {
        const start = new Date(startDate as string);
        if (Number.isNaN(start.getTime())) {
          throw new AppError('Invalid start date', 400);
        }
        dateFilters.push({
          checkInDate: {
            gte: start,
          },
        });
      }
      if (endDate) {
        const end = new Date(endDate as string);
        if (Number.isNaN(end.getTime())) {
          throw new AppError('Invalid end date', 400);
        }
        dateFilters.push({
          checkOutDate: {
            lte: end,
          },
        });
      }

      if (dateFilters.length > 0) {
        where.AND = where.AND ? [...(Array.isArray(where.AND) ? where.AND : [where.AND]), ...dateFilters] : dateFilters;
      }

      const skip = (page - 1) * limit;

      const [reservations, total] = await Promise.all([
        prisma.reservation.findMany({
          where,
          include: {
            room: {
              select: {
                id: true,
                roomNumber: true,
                roomType: true,
              },
            },
          },
          orderBy: {
            checkInDate: 'desc',
          },
          take: limit,
          skip,
        }),
        prisma.reservation.count({ where }),
      ]);

      const serializedReservations = reservations.map((reservation) => ({
        ...reservation,
        rate: decimalToNumber(reservation.rate),
        depositAmount: decimalToNumber(reservation.depositAmount),
      }));

      const result = createPaginationResult(serializedReservations, total, page, limit);

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
      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const reservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          tenantId,
        },
        include: {
          room: true,
          folios: {
            include: {
              charges: true,
              payments: true,
            },
          },
        },
      });

      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservation.status !== 'confirmed') {
        throw new AppError('Reservation is not in confirmed status', 400);
      }

      if (!reservation.room) {
        throw new AppError('Reservation is missing room information', 400);
      }

      const beforeState = {
        ...serializeReservation(reservation),
        room: reservation.room,
        folios: reservation.folios.map(serializeFolio),
      };

      const checkInTime = new Date();
      const rateNumber = decimalToNumber(reservation.rate) ?? 0;

      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: 'checked_in',
            checkedInAt: checkInTime,
            checkedInBy: req.user!.id,
          },
        });

        await tx.room.update({
          where: { id: reservation.roomId },
          data: {
            status: 'occupied',
          },
        });

        const existingFolio = await tx.folio.findFirst({
          where: {
            reservationId,
          },
        });

        if (!existingFolio) {
          const folio = await tx.folio.create({
            data: {
              tenantId,
              reservationId,
              roomId: reservation.roomId,
              guestName: reservation.guestName,
              createdBy: req.user!.id,
              status: 'open',
              totalCharges: new Prisma.Decimal(rateNumber),
              totalPayments: new Prisma.Decimal(0),
              balance: new Prisma.Decimal(rateNumber),
            },
          });

          await tx.folioCharge.create({
            data: {
              folioId: folio.id,
              description: `Room rate - ${reservation.room.roomNumber || 'N/A'}`,
              category: 'room_rate',
              amount: new Prisma.Decimal(rateNumber),
              quantity: 1,
              total: new Prisma.Decimal(rateNumber),
            },
          });
        }
      });

      const updatedReservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          tenantId,
        },
        include: {
          room: true,
          folios: {
            include: {
              charges: true,
              payments: true,
            },
          },
        },
      });

      if (!updatedReservation) {
        throw new AppError('Reservation not found after check-in', 500);
      }

      const serializedReservation = {
        ...serializeReservation(updatedReservation),
        room: updatedReservation.room,
        folios: updatedReservation.folios.map(serializeFolio),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'checkin',
        entityType: 'reservation',
        entityId: reservationId,
        beforeState,
        afterState: serializedReservation,
        metadata: {
          photo: photo || null,
          roomId: reservation.roomId,
        },
      });

      await createRoomLog({
        tenantId,
        roomId: reservation.roomId,
        type: 'check_in',
        summary: `Guest checked in (Reservation ${updatedReservation.reservationNumber || reservationId})`,
        metadata: {
          reservationId,
          reservationNumber: updatedReservation.reservationNumber || null,
          guestName: updatedReservation.guestName || null,
        },
        user: {
          id: req.user?.id || null,
          name: getUserDisplayName(req.user),
        },
      });

      // Send check-in confirmation email asynchronously
      if (updatedReservation.guestEmail) {
        (async () => {
          try {
            const tenantSettings = await getTenantEmailSettings(tenantId);
            if (tenantSettings) {
              const emailData: ReservationEmailData = {
                reservationNumber: updatedReservation.reservationNumber || reservationId,
                guestName: updatedReservation.guestName || 'Guest',
                guestEmail: updatedReservation.guestEmail,
                checkInDate: updatedReservation.checkInDate,
                checkOutDate: updatedReservation.checkOutDate,
                roomNumber: updatedReservation.room?.roomNumber || 'N/A',
                roomType: updatedReservation.room?.roomType || undefined,
                rate: decimalToNumber(updatedReservation.rate) ?? 0,
                adults: updatedReservation.adults,
                children: updatedReservation.children,
                specialRequests: updatedReservation.specialRequests || undefined,
                propertyName: tenantSettings.propertyName,
                propertyAddress: tenantSettings.propertyAddress || undefined,
                propertyPhone: tenantSettings.propertyPhone || undefined,
                propertyEmail: tenantSettings.propertyEmail || undefined,
              };

              const emailHtml = generateCheckInReminderEmail(emailData);
              await sendEmail({
                to: updatedReservation.guestEmail,
                subject: `Welcome to ${tenantSettings.propertyName}!`,
                html: emailHtml,
              });
            }
          } catch (emailError) {
            console.error('Failed to send check-in confirmation email:', emailError);
            // Don't throw - email failure shouldn't fail the check-in
          }
        })();
      }

      res.json({
        success: true,
        data: serializedReservation,
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
      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const reservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          tenantId,
        },
        include: {
          room: true,
          folios: {
            include: {
              charges: true,
              payments: true,
            },
          },
        },
      });

      if (!reservation) {
        throw new AppError('Reservation not found', 404);
      }

      if (reservation.status !== 'checked_in') {
        throw new AppError('Reservation is not checked in', 400);
      }

      if (!reservation.room) {
        throw new AppError('Reservation is missing room information', 400);
      }

      const beforeState = {
        ...serializeReservation(reservation),
        room: reservation.room,
        folios: reservation.folios.map(serializeFolio),
      };

      const checkOutTime = new Date();

      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservation.id },
          data: {
            status: 'checked_out',
            checkedOutAt: checkOutTime,
            checkedOutBy: req.user!.id,
          },
        });

        await tx.room.update({
          where: { id: reservation.roomId },
          data: {
            status: 'dirty',
          },
        });

        await tx.folio.updateMany({
          where: { reservationId },
          data: {
            status: 'closed',
            closedAt: checkOutTime,
            closedBy: req.user!.id,
          },
        });
      });

      const updatedReservation = await prisma.reservation.findFirst({
        where: {
          id: reservationId,
          tenantId,
        },
        include: {
          room: true,
          folios: {
            include: {
              charges: true,
              payments: true,
            },
          },
        },
      });

      if (!updatedReservation) {
        throw new AppError('Reservation not found after checkout', 500);
      }

      const serializedReservation = {
        ...serializeReservation(updatedReservation),
        room: updatedReservation.room,
        folios: updatedReservation.folios.map(serializeFolio),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'checkout',
        entityType: 'reservation',
        entityId: reservationId,
        beforeState,
        afterState: serializedReservation,
        metadata: {
          finalCharges,
          paymentInfo,
        },
      });

      await createRoomLog({
        tenantId,
        roomId: reservation.roomId,
        type: 'check_out',
        summary: `Guest checked out (Reservation ${updatedReservation.reservationNumber || reservationId})`,
        metadata: {
          reservationId,
          reservationNumber: updatedReservation.reservationNumber || null,
          finalCharges: finalCharges || null,
          paymentInfo: paymentInfo || null,
        },
        user: {
          id: req.user?.id || null,
          name: getUserDisplayName(req.user),
        },
      });

      // Send checkout thank you email asynchronously
      if (updatedReservation.guestEmail) {
        (async () => {
          try {
            const tenantSettings = await getTenantEmailSettings(tenantId);
            if (tenantSettings) {
              const folioData = updatedReservation.folios[0];
              const emailData: ReservationEmailData & { totalCharges?: number } = {
                reservationNumber: updatedReservation.reservationNumber || reservationId,
                guestName: updatedReservation.guestName || 'Guest',
                guestEmail: updatedReservation.guestEmail,
                checkInDate: updatedReservation.checkInDate,
                checkOutDate: updatedReservation.checkOutDate,
                roomNumber: updatedReservation.room?.roomNumber || 'N/A',
                roomType: updatedReservation.room?.roomType || undefined,
                rate: decimalToNumber(updatedReservation.rate) ?? 0,
                adults: updatedReservation.adults,
                children: updatedReservation.children,
                specialRequests: updatedReservation.specialRequests || undefined,
                propertyName: tenantSettings.propertyName,
                propertyAddress: tenantSettings.propertyAddress || undefined,
                propertyPhone: tenantSettings.propertyPhone || undefined,
                propertyEmail: tenantSettings.propertyEmail || undefined,
                totalCharges: folioData
                  ? decimalToNumber(folioData.totalCharges) ?? undefined
                  : undefined,
              };

              const emailHtml = generateCheckOutThankYouEmail(emailData);
              await sendEmail({
                to: updatedReservation.guestEmail,
                subject: `Thank you for staying at ${tenantSettings.propertyName}!`,
                html: emailHtml,
              });
            }
          } catch (emailError) {
            console.error('Failed to send checkout thank you email:', emailError);
            // Don't throw - email failure shouldn't fail the checkout
          }
        })();
      }

      res.json({
        success: true,
        data: serializedReservation,
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
