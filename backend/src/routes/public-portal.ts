import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
// import admin from 'firebase-admin';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import {
  availabilityQuerySchema as sharedAvailabilityQuerySchema,
  fetchTenantAvailability,
  type AvailabilityQuery,
} from '../utils/sharedAvailability';
import { resolveTenantBySlug } from '../utils/tenantContext';
// import { db, now, toTimestamp, toDate } from '../utils/firestore';
import {
  ensureGuestSession,
  markSessionConverted,
  updateGuestSessionMetadata,
} from '../utils/guestSessions';
import { issueCustomerToken, verifyCustomerToken } from '../utils/customerAuth';
import {
  buildGatewayCredentialSet,
  getTenantPaymentSettings,
  initializeGatewayPayment,
  verifyGatewayPayment,
} from '../utils/publicPayments';
import {
  bookingRequestSchema,
  checkoutConfirmSchema,
  checkoutIntentSchema,
  convertMajorToMinor,
  createFolioWithCharge,
  determineChargeAmount,
  prepareBookingContext,
  resolveCheckoutPaymentConfig,
  CHECKOUT_INTENT_TTL_MS,
  type PricingSummary,
  type CheckoutIntentPayload,
} from '../utils/publicCheckout';
import {
  CHECKOUT_INTENT_COLLECTION,
  loadCheckoutIntent,
  markIntentStatus,
  type CheckoutIntentDoc,
} from '../utils/checkoutIntents';
import {
  createBatchReservations,
  resolveTenantUserId,
  type CreateReservationBatchInput,
} from '../utils/reservationBatch';

const reservationLoginSchema = z.object({
  reservationNumber: z.string().min(4),
  email: z.string().email().optional(),
  phone: z.string().min(6).optional(),
});

const otpRequestSchema = z.object({
  reservationNumber: z.string().min(4),
  channel: z.enum(['email', 'sms']).default('email'),
});

const otpVerifySchema = z.object({
  reservationNumber: z.string().min(4),
  code: z.string().min(4).max(6),
});

const customerRequestSchema = z.object({
  guestToken: z.string().optional(),
});

const GUEST_SESSION_HEADER = 'x-guest-session';
const OTP_COLLECTION = 'customer_otps';
const OTP_TTL_MS = Number(process.env.CUSTOMER_OTP_TTL_MS ?? 10 * 60 * 1000);
const OTP_MAX_ATTEMPTS = Number(process.env.CUSTOMER_OTP_MAX_ATTEMPTS ?? 5);

const getGuestSessionToken = (req: any) => {
  const headerToken = req.header?.(GUEST_SESSION_HEADER) || req.headers?.[GUEST_SESSION_HEADER];
  const cookieToken =
    req.cookies?.guestSession ||
    req.cookies?.guest_session ||
    req.cookies?.guest_session_token ||
    req.cookies?.guestSessionToken;
  const bodyToken = req.body?.guestSessionToken;
  return (headerToken || cookieToken || bodyToken || '').toString().trim() || undefined;
};

const setGuestSessionCookie = (res: any, token: string) => {
  if (!res.cookie || !token) return;
  res.cookie('guestSession', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const setCustomerTokenCookie = (res: any, token: string) => {
  if (!res.cookie || !token) return;
  res.cookie('customerToken', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  });
};

const getCustomerToken = (req: any) => {
  const headerToken =
    req.header?.('x-customer-token') || req.headers?.['x-customer-token'];
  const cookieToken =
    req.cookies?.customerToken ||
    req.cookies?.customer_token ||
    req.cookies?.customerTokenJwt;
  const bodyToken = req.body?.guestToken;
  return (headerToken || cookieToken || bodyToken || '').toString().trim() || undefined;
};

const maskContact = (value: string | null | undefined) => {
  if (!value) return null;
  if (value.includes('@')) {
    const [local, domain] = value.split('@');
    if (local.length <= 2) {
      return `${local[0] ?? ''}***@${domain}`;
    }
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
  }
  if (value.length <= 4) {
    return `***${value[value.length - 1] ?? ''}`;
  }
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
};

const serializeReservationForCustomer = (reservation: any) => ({
  id: reservation.id,
  reservationNumber: reservation.reservationNumber,
  status: reservation.status,
  checkInDate: reservation.checkInDate?.toISOString?.() ?? reservation.checkInDate,
  checkOutDate: reservation.checkOutDate?.toISOString?.() ?? reservation.checkOutDate,
  guestName: reservation.guestName,
  room: reservation.room
    ? {
        id: reservation.room.id,
        roomNumber: reservation.room.roomNumber,
        roomType: reservation.room.roomType,
      }
    : null,
  balance: reservation.balance ? decimalToNumber(reservation.balance) : null,
});

const fetchReservationForLogin = async (tenantId: string, reservationNumber: string) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }
  return prisma.reservation.findFirst({
    where: {
      tenantId,
      reservationNumber,
    },
    include: {
      guest: true,
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
    },
  });
};

const fetchReservationById = async (tenantId: string, reservationId: string) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }
  return prisma.reservation.findFirst({
    where: {
      tenantId,
      id: reservationId,
    },
    include: {
      guest: true,
      room: {
        select: {
          id: true,
          roomNumber: true,
          roomType: true,
        },
      },
    },
  });
};

const normalizeEmail = (email?: string | null) => email?.trim().toLowerCase() ?? null;

const normalizePhone = (phone?: string | null) =>
  phone?.replace(/[^0-9+]/g, '').trim() ?? null;

const ensureContactMatch = (
  reservation: any,
  email?: string | null,
  phone?: string | null
) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    throw new AppError('Provide email or phone to verify reservation', 400);
  }

  const reservationEmail =
    normalizeEmail(reservation.guestEmail) || normalizeEmail(reservation.guest?.email);
  const reservationPhone =
    normalizePhone(reservation.guestPhone) || normalizePhone(reservation.guest?.phone);

  if (
    normalizedEmail &&
    (!reservationEmail || reservationEmail !== normalizedEmail)
  ) {
    throw new AppError('Contact information does not match reservation', 403);
  }

  if (
    normalizedPhone &&
    (!reservationPhone || reservationPhone !== normalizedPhone)
  ) {
    throw new AppError('Contact information does not match reservation', 403);
  }
};

type GuestProfileInput = {
  tenantId: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const upsertGuestProfile = async ({
  tenantId,
  name,
  email,
  phone,
}: GuestProfileInput) => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const normalizedEmail = normalizeEmail(email);
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedEmail && !normalizedPhone) {
    return null;
  }

  const guestName = name?.trim() || 'Guest';
  const contactFilters: Prisma.GuestWhereInput[] = [];
  if (normalizedEmail) {
    contactFilters.push({ email: normalizedEmail });
  }
  if (normalizedPhone) {
    contactFilters.push({ phone: normalizedPhone });
  }

  let existingGuest = await prisma.guest.findFirst({
    where: {
      tenantId,
      ...(contactFilters.length ? { OR: contactFilters } : {}),
    },
  });

  if (existingGuest) {
    const updates: Prisma.GuestUpdateInput = {};
    if (guestName && guestName !== existingGuest.name) {
      updates.name = guestName;
    }
    if (normalizedEmail && !existingGuest.email) {
      updates.email = normalizedEmail;
    }
    if (normalizedPhone && !existingGuest.phone) {
      updates.phone = normalizedPhone;
    }

    if (Object.keys(updates).length > 0) {
      existingGuest = await prisma.guest.update({
        where: { id: existingGuest.id },
        data: updates,
      });
    }

    return existingGuest;
  }

  return prisma.guest.create({
    data: {
      tenantId,
      name: guestName,
      email: normalizedEmail,
      phone: normalizedPhone,
    },
  });
};

const issueCustomerAuthResponse = async ({
  tenantId,
  reservation,
  req,
  res,
  sessionTokenOverride,
}: {
  tenantId: string;
  reservation: any;
  req: any;
  res: any;
  sessionTokenOverride?: string;
}) => {
  const sessionToken = sessionTokenOverride ?? getGuestSessionToken(req);
  const { sessionToken: ensuredToken } = await ensureGuestSession({
    tenantId,
    sessionToken,
    guest: {
      id: reservation.guestId ?? undefined,
      name: reservation.guestName ?? reservation.guest?.name ?? undefined,
      email: reservation.guestEmail ?? reservation.guest?.email ?? undefined,
      phone: reservation.guestPhone ?? reservation.guest?.phone ?? undefined,
    },
  });

  await updateGuestSessionMetadata(ensuredToken, {
    lastReservationId: reservation.id,
  });

  const customerToken = issueCustomerToken({
    tenantId,
    guestId: reservation.guestId ?? null,
    sessionToken: ensuredToken,
    reservationId: reservation.id ?? null,
  });

  setCustomerTokenCookie(res, customerToken);
  setGuestSessionCookie(res, ensuredToken);

  return {
    token: customerToken,
    guestSessionToken: ensuredToken,
    reservation: serializeReservationForCustomer(reservation),
  };
};

const getOtpDocRef = (tenantId: string, reservationNumber: string) =>
  db.collection(OTP_COLLECTION).doc(`${tenantId}_${reservationNumber}`);

const generateOtpCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const customerAuthMiddleware = async (req: any, tenantId: string) => {
  const token = getCustomerToken(req);
  if (!token) {
    throw new AppError('Customer token required', 401);
  }
  const payload = verifyCustomerToken(token);
  if (payload.tenantId !== tenantId) {
    throw new AppError('Token does not match tenant', 403);
  }
  return payload;
};

export const publicPortalRouter = Router();

const decimalToNumber = (value?: Prisma.Decimal | number | null) =>
  value !== null && value !== undefined ? Number(value) : null;

const fetchFirestoreRoomCategories = async (tenantId: string) => {
  try {
    const snapshot = await db
      .collection('roomCategories')
      .where('tenantId', '==', tenantId)
      .get();

    return snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          name: data.name,
          description: data.description ?? null,
          color: data.color ?? null,
          totalRooms: data.totalRooms ?? null,
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) {
    console.warn('Failed to fetch room categories from Firestore:', error);
    return [];
  }
};

const fetchFirestoreRatePlans = async (tenantId: string) => {
  try {
    const snapshot = await db
      .collection('ratePlans')
      .where('tenantId', '==', tenantId)
      .where('isActive', '==', true)
      .get();

    return snapshot.docs
      .map((doc) => {
        const data = doc.data() || {};
        return {
          id: doc.id,
          name: data.name,
          description: data.description ?? null,
          currency: data.currency ?? 'NGN',
          baseRate: Number(data.baseRate ?? 0) || null,
          categoryId: data.categoryId ?? null,
        };
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } catch (error) {
    console.warn('Failed to fetch rate plans from Firestore:', error);
    return [];
  }
};

const availabilityQuerySchema = sharedAvailabilityQuerySchema.pick({
  startDate: true,
  endDate: true,
  categoryId: true,
  minOccupancy: true,
  includeOutOfOrder: true,
}) as unknown as z.ZodType<AvailabilityQuery>;

const serviceRequestSchema = z.object({
  requestType: z.enum(['amenities', 'maintenance', 'housekeeping', 'concierge', 'other']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  title: z.string().min(1),
  description: z.string().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  guestId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  roomNumber: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

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

publicPortalRouter.get('/:tenantSlug/summary', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const paymentSettings = await getTenantPaymentSettings(tenant.id);

  const allowedGateways = paymentSettings.allowedGateways || [];

  res.json({
    success: true,
    data: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      phone: tenant.phone,
      address: tenant.address,
      branding: tenant.branding,
      paymentGateways: {
        defaultGateway: paymentSettings.defaultGateway,
        allowedGateways,
        paystackPublicKey: paymentSettings.paystackPublicKey || null,
        flutterwavePublicKey: paymentSettings.flutterwavePublicKey || null,
        stripePublicKey: paymentSettings.stripePublicKey || null,
      },
    },
  });
});

publicPortalRouter.get('/:tenantSlug/catalog', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);

  if (prisma) {
    const [roomCategories, ratePlans, meetingHalls] = await Promise.all([
      prisma.roomCategory.findMany({
        where: { tenantId: tenant.id },
        orderBy: { name: 'asc' },
      }),
      prisma.ratePlan.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.meetingHall.findMany({
        where: { tenantId: tenant.id, isActive: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    res.json({
      success: true,
      data: {
        roomCategories: roomCategories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          color: category.color,
          totalRooms: category.totalRooms,
        })),
        ratePlans: ratePlans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          description: plan.description,
          currency: plan.currency,
          baseRate: decimalToNumber(plan.baseRate),
          categoryId: plan.categoryId,
        })),
        meetingHalls: meetingHalls.map((hall) => ({
          id: hall.id,
          name: hall.name,
          description: hall.description,
          capacity: hall.capacity,
          location: hall.location,
          amenities: hall.amenities,
        })),
      },
    });
    return;
  }

  const [roomCategories, ratePlans] = await Promise.all([
    fetchFirestoreRoomCategories(tenant.id),
    fetchFirestoreRatePlans(tenant.id),
  ]);

  res.json({
    success: true,
    data: {
      roomCategories,
      ratePlans,
      meetingHalls: [],
    },
  });
});

publicPortalRouter.get('/:tenantSlug/availability', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);

  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const parsed = availabilityQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    throw new AppError('Invalid availability query parameters', 400);
  }

  const data = await fetchTenantAvailability(tenant.id, parsed.data as AvailabilityQuery);

  res.json({
    success: true,
    data,
  });
});

publicPortalRouter.post('/:tenantSlug/bookings', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);

  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const parsed = bookingRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError('Invalid booking payload', 400);
  }

  const booking = parsed.data;

  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);

  if (checkOut <= checkIn) {
    throw new AppError('Check-out date must be after check-in date', 400);
  }

  const room = await prisma.room.findFirst({
    where: {
      id: booking.roomId,
      tenantId: tenant.id,
    },
    include: {
      ratePlan: true,
    },
  });

  if (!room) {
    throw new AppError('Room not found for this tenant', 404);
  }

  if (room.status && ['out_of_order', 'maintenance'].includes(room.status)) {
    throw new AppError('Room is not available for booking', 400);
  }

  const overlapping = await prisma.reservation.findFirst({
    where: {
      tenantId: tenant.id,
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

  const effectiveRate = booking.rate ?? resolveRoomEffectiveRate(room);
  if (effectiveRate === null) {
    throw new AppError('Unable to determine room rate', 400);
  }

  const reservationNumber = `WEB-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;
  const createdBy = await resolveTenantUserId(tenant.id);

  const sessionToken = getGuestSessionToken(req);
  const { sessionToken: ensuredToken } = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken,
    guest: {
      id: undefined,
      name: booking.guestName,
      email: booking.guestEmail,
      phone: booking.guestPhone,
    },
  });

  const reservation = await prisma.reservation.create({
    data: {
      tenantId: tenant.id,
      roomId: booking.roomId,
      reservationNumber,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail ?? null,
      guestPhone: booking.guestPhone ?? null,
      guestIdNumber: booking.guestIdNumber ?? null,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adults: booking.adults,
      children: booking.children,
      rate: new Prisma.Decimal(effectiveRate),
      depositAmount: booking.depositAmount !== undefined ? new Prisma.Decimal(booking.depositAmount) : null,
      depositStatus: booking.depositAmount ? 'pending' : null,
      depositRequired: Boolean(booking.depositAmount),
      source: booking.source === 'mobile_portal' ? 'web' : 'web',
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

  await markSessionConverted(ensuredToken, reservation.id);

  res.status(201).json({
    success: true,
    data: {
      id: reservation.id,
      reservationNumber: reservation.reservationNumber,
      status: reservation.status,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      guestName: reservation.guestName,
      guestEmail: reservation.guestEmail,
      guestPhone: reservation.guestPhone,
      rate: decimalToNumber(reservation.rate),
      depositAmount: decimalToNumber(reservation.depositAmount),
      depositStatus: reservation.depositStatus,
      room: reservation.room,
      guestSessionToken: ensuredToken,
    },
  });

  setGuestSessionCookie(res, ensuredToken);
});

publicPortalRouter.post('/:tenantSlug/checkout/intent', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const parsed = checkoutIntentSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError('Invalid checkout intent payload', 400);
  }

  const booking = parsed.data;

  if (!booking.guestEmail) {
    throw new AppError('Guest email is required to start checkout', 400);
  }

  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const bookingContext = await prepareBookingContext(tenant.id, booking);
  const pricing: PricingSummary = {
    effectiveRate: bookingContext.effectiveRate,
    nights: bookingContext.nights,
    totalRoomAmount: bookingContext.totalRoomAmount,
  };

  const payDepositOnly = Boolean(booking.payDepositOnly);
  const amountMajor = determineChargeAmount({ booking, pricing, payDepositOnly });

  if (!amountMajor || amountMajor <= 0) {
    throw new AppError('Charge amount must be greater than zero', 400);
  }

  const amountMinor = convertMajorToMinor(amountMajor);
  const { settings, gateway, currency, credentials } = await resolveCheckoutPaymentConfig(tenant.id, booking);
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + CHECKOUT_INTENT_TTL_MS);

  const sessionToken = getGuestSessionToken(req);
  const { sessionToken: ensuredToken } = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken,
    guest: {
      name: booking.guestName,
      email: booking.guestEmail,
      phone: booking.guestPhone ?? undefined,
    },
  });

  const docRef = db.collection(CHECKOUT_INTENT_COLLECTION).doc();
  const paymentReference = `CKO-${Date.now()}-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
  const paymentInit = await initializeGatewayPayment({
    gateway,
    amount: amountMinor,
    email: booking.guestEmail,
    reference: paymentReference,
    metadata: {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      checkoutIntentId: docRef.id,
      roomId: booking.roomId,
    },
    callbackUrl: settings.callbackUrl,
    currency,
    customerName: booking.guestName,
    customerPhone: booking.guestPhone,
    credentials,
  });

  const timestamp = now();

  const intentRecord: CheckoutIntentDoc = {
    tenantId: tenant.id,
    slug: tenant.slug,
    status: 'pending',
    booking,
    pricing,
    gateway,
    currency,
    amountMajor,
    amountMinor,
    payDepositOnly,
    reference: paymentInit.reference,
    authorizationUrl: paymentInit.authorizationUrl,
    accessCode: paymentInit.accessCode,
    expiresAt,
    guest: {
      name: booking.guestName,
      email: booking.guestEmail,
      phone: booking.guestPhone ?? null,
    },
    roomSnapshot: {
      id: bookingContext.room.id,
      roomNumber: bookingContext.room.roomNumber,
      roomType: bookingContext.room.roomType,
    },
    sessionToken: ensuredToken,
    reservationId: undefined,
    folioId: undefined,
    paymentDocumentId: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docRef.set(intentRecord);

  await updateGuestSessionMetadata(ensuredToken, {
    lastCheckoutIntentId: docRef.id,
    lastCheckoutIntentAt: timestamp,
  });

  setGuestSessionCookie(res, ensuredToken);

  res.status(201).json({
    success: true,
    data: {
      intentId: docRef.id,
      authorizationUrl: paymentInit.authorizationUrl,
      reference: paymentInit.reference,
      gateway,
      currency,
      amount: amountMajor,
      expiresAt: expiresAt.toDate(),
      guestSessionToken: ensuredToken,
    },
  });
});

publicPortalRouter.post('/:tenantSlug/checkout/confirm', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const parsed = checkoutConfirmSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError('Invalid checkout confirmation payload', 400);
  }

  const { intentId, gateway: providedGateway, reference } = parsed.data;
  const intent = await loadCheckoutIntent(intentId);

  if (intent.tenantId !== tenant.id) {
    throw new AppError('Checkout intent not found for this tenant', 404);
  }

  if (intent.status === 'confirmed' && intent.reservationId) {
    const reservation = await fetchReservationById(tenant.id, intent.reservationId);
    if (!reservation) {
      throw new AppError('Reservation not found for confirmed intent', 404);
    }
    const authResponse = await issueCustomerAuthResponse({
      tenantId: tenant.id,
      reservation,
      req,
      res,
      sessionTokenOverride: intent.sessionToken ?? undefined,
    });
    return res.json({
      success: true,
      data: {
        intentId,
        status: intent.status,
        reservation: authResponse.reservation,
        customerToken: authResponse.token,
        guestSessionToken: authResponse.guestSessionToken,
      },
    });
  }

  if (intent.status !== 'pending') {
    throw new AppError(`Checkout intent is ${intent.status}`, 400);
  }

  const nowDate = new Date();
  if (intent.expiresAt.toDate() < nowDate) {
    await markIntentStatus(intent.id, 'expired');
    return res.status(410).json({
      success: false,
      message: 'Checkout intent has expired',
    });
  }

  if (intent.reference !== reference) {
    return res.status(400).json({
      success: false,
      message: 'Checkout reference does not match intent',
    });
  }

  const gatewayToUse = providedGateway ?? intent.gateway;
  if (gatewayToUse !== intent.gateway) {
    return res.status(400).json({
      success: false,
      message: 'Gateway does not match checkout intent',
    });
  }

  const tenantPaymentSettings = await getTenantPaymentSettings(tenant.id);
  const verificationCredentials = buildGatewayCredentialSet(tenantPaymentSettings, gatewayToUse);

  let verification;
  try {
    verification = await verifyGatewayPayment(gatewayToUse, reference, verificationCredentials);
  } catch (error: any) {
    await markIntentStatus(intent.id, 'failed', {
      failureReason: error?.message ?? 'verification_failed',
    });
    throw error;
  }

  if (verification.status !== 'success') {
    await markIntentStatus(intent.id, 'failed', {
      failureReason: verification.status,
    });
    throw new AppError('Payment has not been completed yet', 402);
  }

  if (Math.abs(verification.amount - intent.amountMinor) > 1) {
    await markIntentStatus(intent.id, 'failed', {
      failureReason: 'amount_mismatch',
    });
    return res.status(400).json({
      success: false,
      message: 'Payment amount does not match checkout intent',
    });
  }

  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }

  const booking = intent.booking as CheckoutIntentPayload;
  const bookingContext = await prepareBookingContext(tenant.id, booking);
  const createdBy = await resolveTenantUserId(tenant.id);

  const depositAmountValue = intent.payDepositOnly
    ? intent.amountMajor
    : booking.depositAmount ?? null;
  const depositRequired = intent.payDepositOnly || Boolean(booking.depositAmount);
  const depositStatus = depositRequired ? (intent.payDepositOnly ? 'paid' : 'pending') : null;

  const guestProfile = await upsertGuestProfile({
    tenantId: tenant.id,
    name: booking.guestName,
    email: booking.guestEmail,
    phone: booking.guestPhone,
  });

  const guestInfoForSession = {
    id: guestProfile?.id,
    name: guestProfile?.name ?? booking.guestName,
    email: guestProfile?.email ?? booking.guestEmail ?? undefined,
    phone: guestProfile?.phone ?? booking.guestPhone ?? undefined,
  };

  const batchPayload: CreateReservationBatchInput = {
    guestName: booking.guestName,
    guestId: guestProfile?.id ?? undefined,
    guestEmail: booking.guestEmail ?? undefined,
    guestPhone: booking.guestPhone ?? undefined,
    guestIdNumber: booking.guestIdNumber ?? undefined,
    checkInDate: bookingContext.checkIn.toISOString(),
    checkOutDate: bookingContext.checkOut.toISOString(),
    adults: booking.adults,
    children: booking.children,
    depositAmount: depositAmountValue ?? undefined,
    source: booking.source ?? 'public_portal',
    specialRequests: booking.specialRequests ?? undefined,
    rooms: [
      {
        roomId: booking.roomId,
        rate: bookingContext.effectiveRate,
      },
    ],
  };

  const { reservations } = await prisma.$transaction((tx) =>
    createBatchReservations({
      tenantId: tenant.id,
      data: batchPayload,
      actorUserId: createdBy,
      client: tx,
      overrides: {
        reservationNumberFactory: () =>
          `WEB-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`,
        depositStatus,
        depositRequired,
      },
    })
  );

  const reservation = reservations[0];

  if (!reservation) {
    throw new AppError('Failed to create reservation', 500);
  }

  const folioCurrency = intent.currency || verification.currency || 'NGN';

  const folio = await createFolioWithCharge({
    tenantId: tenant.id,
    reservation,
    pricing: intent.pricing,
    paymentAmountMajor: intent.amountMajor,
    currency: folioCurrency,
    createdBy,
  });

  const paymentDocRef = db.collection('payments').doc();
  const paymentTimestamp = now();
  await paymentDocRef.set({
    tenantId: tenant.id,
    folioId: folio.id,
    amount: intent.amountMajor,
    method: 'card',
    reference,
    paymentGateway: intent.gateway,
    gatewayTransactionId: verification.gatewayTransactionId,
    status: 'completed',
    processedBy: 'public_portal',
    reconciled: false,
    createdAt: paymentTimestamp,
    updatedAt: paymentTimestamp,
    paidAt: verification.paidAt ? toTimestamp(verification.paidAt) : paymentTimestamp,
  });

  if (intent.sessionToken) {
    await ensureGuestSession({
      tenantId: tenant.id,
      sessionToken: intent.sessionToken,
      guest: guestInfoForSession,
    });
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

  const authResponse = await issueCustomerAuthResponse({
    tenantId: tenant.id,
    reservation,
    req,
    res,
    sessionTokenOverride: intent.sessionToken ?? undefined,
  });

  return res.json({
    success: true,
    data: {
      intentId,
      status: 'confirmed',
      reservation: authResponse.reservation,
      customerToken: authResponse.token,
      guestSessionToken: authResponse.guestSessionToken,
    },
  });
});

publicPortalRouter.post('/:tenantSlug/login/reservation', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const parsed = reservationLoginSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError('Invalid reservation login payload', 400);
  }

  const { reservationNumber, email, phone } = parsed.data;
  const reservation = await fetchReservationForLogin(tenant.id, reservationNumber);

  if (!reservation) {
    throw new AppError('Reservation not found', 404);
  }

  ensureContactMatch(reservation, email, phone);

  const authResponse = await issueCustomerAuthResponse({
    tenantId: tenant.id,
    reservation,
    req,
    res,
  });

  res.json({
    success: true,
    data: authResponse,
  });
});

publicPortalRouter.post('/:tenantSlug/login/otp/request', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const parsed = otpRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError('Invalid OTP request payload', 400);
  }

  const { reservationNumber, channel } = parsed.data;
  const reservation = await fetchReservationForLogin(tenant.id, reservationNumber);

  if (!reservation) {
    throw new AppError('Reservation not found', 404);
  }

  const reservationEmail =
    normalizeEmail(reservation.guestEmail) || normalizeEmail(reservation.guest?.email);
  const reservationPhone =
    normalizePhone(reservation.guestPhone) || normalizePhone(reservation.guest?.phone);

  if (channel === 'email' && !reservationEmail) {
    throw new AppError('Reservation does not have an email on file', 400);
  }
  if (channel === 'sms' && !reservationPhone) {
    throw new AppError('Reservation does not have a phone number on file', 400);
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + OTP_TTL_MS));
  const otpDocRef = getOtpDocRef(tenant.id, reservationNumber);

  await otpDocRef.set({
    tenantId: tenant.id,
    reservationId: reservation.id,
    codeHash,
    attempts: 0,
    channel,
    expiresAt,
    createdAt: now(),
    updatedAt: now(),
  });

  return res.json({
    success: true,
    data: {
      reservationNumber,
      channel,
      destination:
        channel === 'email' ? maskContact(reservationEmail) : maskContact(reservationPhone),
      expiresInMs: OTP_TTL_MS,
    },
  });
});

publicPortalRouter.post('/:tenantSlug/login/otp/verify', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const parsed = otpVerifySchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError('Invalid OTP verify payload', 400);
  }

  const { reservationNumber, code } = parsed.data;
  const otpDocRef = getOtpDocRef(tenant.id, reservationNumber);
  const snapshot = await otpDocRef.get();

  if (!snapshot.exists) {
    throw new AppError('OTP not found or expired', 404);
  }

  const data = snapshot.data() as {
    reservationId: string;
    codeHash: string;
    attempts: number;
    expiresAt: admin.firestore.Timestamp;
  };

  const nowDate = new Date();
  if (data.expiresAt.toDate() < nowDate) {
    await otpDocRef.delete();
    throw new AppError('OTP expired', 400);
  }

  if (data.attempts >= OTP_MAX_ATTEMPTS) {
    await otpDocRef.delete();
    throw new AppError('Too many attempts. Request a new OTP.', 429);
  }

  const isValid = await bcrypt.compare(code, data.codeHash);
  if (!isValid) {
    await otpDocRef.update({
      attempts: admin.firestore.FieldValue.increment(1),
      updatedAt: now(),
    });
    throw new AppError('Invalid OTP code', 401);
  }

  await otpDocRef.delete();

  const reservation = await fetchReservationById(tenant.id, data.reservationId);
  if (!reservation) {
    throw new AppError('Reservation not found', 404);
  }

  const authResponse = await issueCustomerAuthResponse({
    tenantId: tenant.id,
    reservation,
    req,
    res,
  });

  res.json({
    success: true,
    data: authResponse,
  });
});

publicPortalRouter.get('/:tenantSlug/me', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const payload = await customerAuthMiddleware(req, tenant.id);

  if (!payload.reservationId) {
    throw new AppError('Reservation context missing in token', 400);
  }

  const reservation = await fetchReservationById(tenant.id, payload.reservationId);
  if (!reservation) {
    throw new AppError('Reservation not found', 404);
  }

  res.json({
    success: true,
    data: {
      reservation: serializeReservationForCustomer(reservation),
      guestSessionToken: payload.sessionToken ?? null,
    },
  });
});

publicPortalRouter.post('/:tenantSlug/service-requests', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const parsed = serviceRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new AppError('Invalid service request payload', 400);
  }

  const payload = parsed.data;
  let resolvedRoomId = payload.roomId || null;

  if (payload.reservationId && prisma) {
    const reservation = await prisma.reservation.findFirst({
      where: {
        id: payload.reservationId,
        tenantId: tenant.id,
      },
      select: {
        id: true,
        roomId: true,
      },
    });

    if (!reservation) {
      throw new AppError('Reservation not found for this tenant', 404);
    }

    if (!resolvedRoomId && reservation.roomId) {
      resolvedRoomId = reservation.roomId;
    }
  }

  const timestamp = now();
  const requestCreatedDate = timestamp.toDate();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const requestNumber = `GR-${dateStr}-${uuidv4().substring(0, 6).toUpperCase()}`;

  const requestRecord = {
    tenantId: tenant.id,
    guestId: payload.guestId || null,
    reservationId: payload.reservationId || null,
    roomId: resolvedRoomId,
    requestType: payload.requestType,
    priority: payload.priority,
    title: payload.title,
    description: payload.description,
    status: 'pending',
    guestName: payload.guestName,
    guestPhone: payload.guestPhone || null,
    guestEmail: payload.guestEmail || null,
    roomNumber: payload.roomNumber || null,
    assignedTo: null,
    department: null,
    estimatedCompletion: null,
    guestNotified: false,
    source: 'public_portal',
    tags: payload.tags || [],
    createdBy: 'public_portal',
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const docRef = await db.collection('guest_requests').add(requestRecord);

  await db.collection('guest_request_updates').add({
    tenantId: tenant.id,
    guestRequestId: docRef.id,
    previousStatus: null,
    newStatus: 'pending',
    updateType: 'status_change',
    notes: 'Request created via public portal',
    performedBy: 'public_portal',
    createdAt: timestamp,
  });

  const sessionToken = getGuestSessionToken(req);
  const { sessionToken: ensuredToken } = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken,
    guest: {
      id: payload.guestId,
      name: payload.guestName,
      email: payload.guestEmail,
      phone: payload.guestPhone,
    },
  });

  await updateGuestSessionMetadata(ensuredToken, {
    lastServiceRequestId: docRef.id,
    lastServiceRequestType: payload.requestType,
  });

  res.status(201).json({
    success: true,
    data: {
      id: docRef.id,
      requestNumber,
      ...requestRecord,
      createdAt: requestCreatedDate,
      updatedAt: requestCreatedDate,
      guestSessionToken: ensuredToken,
    },
  });

  setGuestSessionCookie(res, ensuredToken);
});
