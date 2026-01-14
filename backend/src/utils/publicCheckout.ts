import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import admin from 'firebase-admin';
import { AppError } from '../middleware/errorHandler';
import { prisma } from './prisma';
import { db, now, toTimestamp } from './firestore';
import { getTenantPaymentSettings } from './publicPayments';
import {
  CheckoutIntentRecord,
  type CheckoutIntentDoc,
} from './checkoutIntents';
import {
  markSessionConverted,
  updateGuestSessionMetadata,
} from './guestSessions';
import type { VerifyPaymentResponse } from './paymentGateway';
import { markIntentStatus } from './checkoutIntents';
import { triggerTenantWebhookEvent } from './tenantWebhooks';

export const bookingRequestSchema = z.object({
  roomId: z.string().uuid(),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  guestIdNumber: z.string().optional(),
  specialRequests: z.string().optional(),
  rate: z.number().positive().optional(),
  depositAmount: z.number().nonnegative().optional(),
  source: z.enum(['web_portal', 'mobile_portal']).default('web_portal'),
});

export const checkoutIntentSchema = bookingRequestSchema.extend({
  gateway: z.enum(['paystack', 'flutterwave']).optional(),
  currency: z.string().optional(),
  payDepositOnly: z.coerce.boolean().optional(),
});

export const checkoutConfirmSchema = z.object({
  intentId: z.string().min(10),
  gateway: z.enum(['paystack', 'flutterwave']).optional(),
  reference: z.string().min(4),
});

export type BookingPayload = z.infer<typeof bookingRequestSchema>;
export type CheckoutIntentPayload = z.infer<typeof checkoutIntentSchema>;

export type PricingSummary = {
  effectiveRate: number;
  nights: number;
  totalRoomAmount: number;
};

export type BookingContext = {
  room: {
    id: string;
    roomNumber: string | null;
    roomType: string | null;
    status: string | null;
    customRate: Prisma.Decimal | number | null;
    ratePlan?: {
      id: string;
      baseRate: Prisma.Decimal | number | null;
      currency?: string | null;
    } | null;
  };
  checkIn: Date;
  checkOut: Date;
  nights: number;
  effectiveRate: number;
  totalRoomAmount: number;
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export const CHECKOUT_INTENT_TTL_MS = Number(
  process.env.CHECKOUT_INTENT_TTL_MS ?? 30 * 60 * 1000
);

export const calculateNights = (checkIn: Date, checkOut: Date) =>
  Math.max(1, Math.ceil((checkOut.getTime() - checkIn.getTime()) / DAY_IN_MS));

const resolveRoomEffectiveRate = (room: {
  customRate?: Prisma.Decimal | number | null;
  ratePlan?: { baseRate?: Prisma.Decimal | number | null } | null;
}) => {
  const customRate =
    room.customRate !== null && room.customRate !== undefined
      ? Number(room.customRate as Prisma.Decimal)
      : null;
  if (customRate !== null) {
    return customRate;
  }
  const baseRate =
    room.ratePlan?.baseRate !== null && room.ratePlan?.baseRate !== undefined
      ? Number(room.ratePlan?.baseRate as Prisma.Decimal)
      : null;
  return baseRate;
};

export const prepareBookingContext = async (
  tenantId: string,
  booking: BookingPayload,
  options?: { skipAvailabilityCheck?: boolean }
): Promise<BookingContext> => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);

  if (
    !(checkIn instanceof Date) ||
    !(checkOut instanceof Date) ||
    Number.isNaN(checkIn.valueOf()) ||
    Number.isNaN(checkOut.valueOf())
  ) {
    throw new AppError('Invalid check-in or check-out date', 400);
  }

  if (checkOut <= checkIn) {
    throw new AppError('Check-out date must be after check-in date', 400);
  }

  const room = await prisma.room.findFirst({
    where: {
      id: booking.roomId,
      tenantId,
    },
    include: {
      ratePlan: {
        select: {
          id: true,
          baseRate: true,
          currency: true,
        },
      },
    },
  });

  if (!room) {
    throw new AppError('Room not found for this tenant', 404);
  }

  if (room.status && ['out_of_order', 'maintenance'].includes(room.status)) {
    throw new AppError('Room is not available for booking', 400);
  }

  if (!options?.skipAvailabilityCheck) {
    const overlapping = await prisma.reservation.findFirst({
      where: {
        tenantId,
        roomId: booking.roomId,
        status: { in: ['confirmed', 'checked_in'] },
        AND: [
          { checkInDate: { lt: checkOut } },
          { checkOutDate: { gt: checkIn } },
        ],
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new AppError('Room is not available for the selected dates', 409);
    }
  }

  const effectiveRate = booking.rate ?? resolveRoomEffectiveRate(room);
  if (effectiveRate === null || effectiveRate === undefined) {
    throw new AppError('Unable to determine room rate', 400);
  }

  const nights = calculateNights(checkIn, checkOut);
  const totalRoomAmount = effectiveRate * nights;

  return {
    room,
    checkIn,
    checkOut,
    nights,
    effectiveRate,
    totalRoomAmount,
  };
};

export const determineChargeAmount = ({
  booking,
  pricing,
  payDepositOnly,
}: {
  booking: BookingPayload;
  pricing: PricingSummary;
  payDepositOnly: boolean;
}) => {
  if (!payDepositOnly) {
    return pricing.totalRoomAmount;
  }

  if (booking.depositAmount && booking.depositAmount > 0) {
    return booking.depositAmount;
  }

  return Math.round(pricing.totalRoomAmount * 0.5 * 100) / 100;
};

export const convertMajorToMinor = (amount: number) => Math.round(amount * 100);

export const resolveCheckoutPaymentConfig = async (
  tenantId: string,
  booking: CheckoutIntentPayload
) => {
  const settings = await getTenantPaymentSettings(tenantId);
  const requestedGateway = booking.gateway ?? settings.defaultGateway;
  if (!['paystack', 'flutterwave'].includes(requestedGateway)) {
    throw new AppError(
      'Selected payment gateway is not supported for public checkout',
      400
    );
  }
  const currency = (booking.currency || settings.currency || 'NGN').toUpperCase();

  return {
    settings,
    gateway: requestedGateway as 'paystack' | 'flutterwave',
    currency,
  };
};

const resolveSystemUserId = async (tenantId: string): Promise<string> => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const fallbackUser = await prisma.user.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (fallbackUser) {
    return fallbackUser.id;
  }

  const sanitizedTenantSegment = tenantId
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .slice(0, 12);
  const systemEmail = `system+${sanitizedTenantSegment || 'tenant'}@innsight.local`;

  const systemUser = await prisma.user.create({
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
  });

  return systemUser.id;
};

export const createFolioWithCharge = async ({
  tenantId,
  reservation,
  pricing,
  paymentAmountMajor,
  currency,
  createdBy,
}: {
  tenantId: string;
  reservation: any;
  pricing: PricingSummary;
  paymentAmountMajor: number;
  currency: string;
  createdBy: string;
}) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  return prisma.$transaction(async (tx) => {
    const folio = await tx.folio.create({
      data: {
        tenantId,
        reservationId: reservation.id,
        roomId: reservation.roomId,
        guestName: reservation.guestName,
        createdBy,
        status: 'open',
        currency,
        totalCharges: new Prisma.Decimal(pricing.totalRoomAmount),
        totalPayments: new Prisma.Decimal(paymentAmountMajor),
        balance: new Prisma.Decimal(
          Math.max(pricing.totalRoomAmount - paymentAmountMajor, 0)
        ),
      },
    });

    await tx.folioCharge.create({
      data: {
        folioId: folio.id,
        description: `Room rate - ${reservation.room?.roomNumber || 'N/A'}`,
        category: 'room_rate',
        amount: new Prisma.Decimal(pricing.effectiveRate),
        quantity: pricing.nights,
        total: new Prisma.Decimal(pricing.totalRoomAmount),
      },
    });

    return folio;
  });
};

type CompleteCheckoutResult = {
  reservation: any;
  folioId: string;
  paymentDocumentId: string;
};

export const completeCheckoutIntent = async ({
  tenantId,
  intent,
  verification,
}: {
  tenantId: string;
  intent: CheckoutIntentRecord<CheckoutIntentPayload>;
  verification: VerifyPaymentResponse;
}): Promise<CompleteCheckoutResult> => {
  if (intent.status === 'confirmed' && intent.reservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: intent.reservationId },
      include: {
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new AppError('Reservation not found for confirmed intent', 404);
    }

    return {
      reservation,
      folioId: intent.folioId!,
      paymentDocumentId: intent.paymentDocumentId!,
    };
  }

  const booking = intent.booking as CheckoutIntentPayload;
  const bookingContext = await prepareBookingContext(tenantId, booking);
  const reservationNumber = `WEB-${Date.now()}-${uuidv4()
    .substring(0, 6)
    .toUpperCase()}`;
  const createdBy = await resolveSystemUserId(tenantId);

  const depositAmountValue = intent.payDepositOnly
    ? intent.amountMajor
    : booking.depositAmount ?? null;
  const depositRequired = intent.payDepositOnly || Boolean(booking.depositAmount);
  const depositStatus = depositRequired
    ? intent.payDepositOnly
      ? 'paid'
      : 'pending'
    : null;

  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const reservation = await prisma.reservation.create({
    data: {
      tenantId,
      roomId: booking.roomId,
      reservationNumber,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail ?? null,
      guestPhone: booking.guestPhone ?? null,
      guestIdNumber: booking.guestIdNumber ?? null,
      checkInDate: bookingContext.checkIn,
      checkOutDate: bookingContext.checkOut,
      adults: booking.adults,
      children: booking.children,
      rate: new Prisma.Decimal(bookingContext.effectiveRate),
      depositAmount:
        depositAmountValue !== null ? new Prisma.Decimal(depositAmountValue) : null,
      depositStatus,
      depositRequired,
      source: booking.source ?? 'web_portal',
      specialRequests: booking.specialRequests ?? null,
      createdBy,
      status: 'confirmed',
    },
    include: {
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
    },
  });

  const folio = await createFolioWithCharge({
    tenantId,
    reservation,
    pricing: intent.pricing,
    paymentAmountMajor: intent.amountMajor,
    currency: intent.currency,
    createdBy,
  });

  const paymentDocRef = db.collection('payments').doc();
  const paymentTimestamp = now();
  await paymentDocRef.set({
    tenantId,
    folioId: folio.id,
    amount: intent.amountMajor,
    method: 'card',
    reference: verification.reference,
    paymentGateway: intent.gateway,
    gatewayTransactionId: verification.gatewayTransactionId,
    status: 'completed',
    processedBy: 'public_portal',
    reconciled: false,
    createdAt: paymentTimestamp,
    updatedAt: paymentTimestamp,
    paidAt: verification.paidAt ? toTimestamp(verification.paidAt) : paymentTimestamp,
  });

  await triggerTenantWebhookEvent({
    tenantId,
    eventType: 'payment.completed',
    payload: {
      paymentId: paymentDocRef.id,
      folioId: folio.id,
      reservationId: reservation.id,
      amount: intent.amountMajor,
      currency: intent.currency,
      gateway: intent.gateway,
      reference: verification.reference,
      paidAt: verification.paidAt ?? paymentTimestamp.toDate(),
    },
  });

  if (intent.sessionToken) {
    await markSessionConverted(intent.sessionToken, reservation.id);
    await updateGuestSessionMetadata(intent.sessionToken, {
      lastReservationId: reservation.id,
      lastCheckoutIntentId: intent.id,
      lastCheckoutIntentStatus: 'confirmed',
    });
  }

  await markIntentStatus(intent.id, 'confirmed', {
    reservationId: reservation.id,
    folioId: folio.id,
    paymentDocumentId: paymentDocRef.id,
  });

  await triggerTenantWebhookEvent({
    tenantId,
    eventType: 'reservation.confirmed',
    payload: {
      reservationId: reservation.id,
      reservationNumber,
      guest: {
        name: reservation.guestName,
        email: reservation.guestEmail,
        phone: reservation.guestPhone,
      },
      room: {
        id: reservation.room?.id,
        roomNumber: reservation.room?.roomNumber,
        roomType: reservation.room?.roomType,
      },
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      adults: reservation.adults,
      children: reservation.children,
      folioId: folio.id,
      amountPaid: intent.amountMajor,
      currency: intent.currency,
    },
  });

  return {
    reservation,
    folioId: folio.id,
    paymentDocumentId: paymentDocRef.id,
  };
};
