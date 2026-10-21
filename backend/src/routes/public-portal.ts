import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { issueCustomerToken, verifyCustomerToken } from '../utils/customerAuth';
import {
  ensureGuestSession,
  updateGuestSessionMetadata,
} from '../utils/guestSessions';
import {
  checkoutIntentSchema,
  checkoutConfirmSchema,
  prepareBookingContext,
  determineChargeAmount,
  convertMajorToMinor,
  resolveCheckoutPaymentConfig,
  completeCheckoutIntent,
  CHECKOUT_INTENT_TTL_MS,
  type CheckoutIntentPayload,
} from '../utils/publicCheckout';
import {
  loadCheckoutIntent,
  findCheckoutIntentByReference,
  markIntentStatus,
} from '../utils/checkoutIntents';
import {
  getTenantPaymentSettings,
  buildGatewayCredentialSet,
  initializeGatewayPayment,
  verifyGatewayPayment,
} from '../utils/publicPayments';
import { sendEmail } from '../utils/email';

export const publicPortalRouter = Router({ mergeParams: true });

const PUBLIC_GATEWAYS = ['paystack', 'flutterwave', 'stripe'] as const;

const requirePrisma = () => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }
  return prisma;
};

const resolveTenantBySlug = async (slug: string) => {
  const client = requirePrisma();
  const tenant = await client.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      phone: true,
      email: true,
      branding: true,
      subscriptionStatus: true,
    },
  });
  if (!tenant) {
    throw new AppError('Property not found', 404);
  }
  return tenant;
};

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const getGuestSessionTokenFromRequest = (req: any): string | undefined => {
  const header = req.headers['x-guest-session'];
  return typeof header === 'string' && header.trim() ? header.trim() : undefined;
};

const serializeGuestAccount = (account: any) => ({
  id: account.id,
  email: account.email,
  phone: account.phone,
  isEmailVerified: account.isEmailVerified,
  isPhoneVerified: account.isPhoneVerified,
  marketingOptIn: account.marketingOptIn,
  lastLoginAt: account.lastLoginAt,
});

const serializePortalReservation = (reservation: any) => ({
  id: reservation.id,
  reservationNumber: reservation.reservationNumber,
  status: reservation.status,
  checkInDate: reservation.checkInDate,
  checkOutDate: reservation.checkOutDate,
  guestName: reservation.guestName,
  room: reservation.room
    ? {
        id: reservation.room.id,
        roomNumber: reservation.room.roomNumber,
        roomType: reservation.room.roomType,
      }
    : null,
  balance: reservation.balance ?? null,
});

// GET /api/public/portal/:tenantSlug/summary
publicPortalRouter.get('/:tenantSlug/summary', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const settings = await getTenantPaymentSettings(tenant.id);

  const allowedGateways = (settings.allowedGateways || []).filter((g) =>
    (PUBLIC_GATEWAYS as readonly string[]).includes(g)
  );

  res.json({
    success: true,
    data: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      address: tenant.address,
      phone: tenant.phone,
      email: tenant.email,
      branding: tenant.branding || undefined,
      paymentGateways: {
        defaultGateway: (PUBLIC_GATEWAYS as readonly string[]).includes(settings.defaultGateway)
          ? settings.defaultGateway
          : allowedGateways[0] || 'paystack',
        allowedGateways,
        paystackPublicKey: settings.paystackPublicKey || null,
        flutterwavePublicKey: settings.flutterwavePublicKey || null,
        stripePublicKey: settings.stripePublicKey || null,
      },
    },
  });
});

// GET /api/public/portal/:tenantSlug/catalog
publicPortalRouter.get('/:tenantSlug/catalog', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const client = requirePrisma();

  const [roomCategories, ratePlans] = await Promise.all([
    client.roomCategory.findMany({
      where: { tenantId: tenant.id },
      orderBy: { name: 'asc' },
    }),
    client.ratePlan.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  res.json({
    success: true,
    data: {
      roomCategories: roomCategories.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        color: c.color,
        totalRooms: c.totalRooms,
      })),
      ratePlans: ratePlans.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        currency: p.currency,
        baseRate: toNumber(p.baseRate),
        categoryId: p.categoryId,
      })),
    },
  });
});

// GET /api/public/portal/:tenantSlug/availability?startDate&endDate&categoryId
publicPortalRouter.get('/:tenantSlug/availability', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const client = requirePrisma();

  const startDate = new Date(req.query.startDate as string);
  const endDate = new Date(req.query.endDate as string);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    throw new AppError('Valid startDate and endDate query params are required', 400);
  }

  const categoryId = req.query.categoryId as string | undefined;

  const where: any = {
    tenantId: tenant.id,
    status: { notIn: ['out_of_order', 'maintenance', 'blocked'] },
  };
  if (categoryId && categoryId !== 'all') {
    where.categoryId = categoryId;
  }

  const rooms = await client.room.findMany({
    where,
    include: {
      ratePlan: {
        select: { id: true, name: true, baseRate: true, currency: true },
      },
      category: { select: { id: true, name: true } },
    },
    orderBy: { roomNumber: 'asc' },
  });

  const booked = await client.reservation.findMany({
    where: {
      tenantId: tenant.id,
      roomId: { in: rooms.map((r) => r.id) },
      status: { in: ['confirmed', 'checked_in'] },
      checkInDate: { lt: endDate },
      checkOutDate: { gt: startDate },
    },
    select: { roomId: true },
  });
  const bookedRoomIds = new Set(booked.map((r) => r.roomId));

  const availableRooms = rooms
    .filter((r) => !bookedRoomIds.has(r.id))
    .map((r) => {
      const customRate = toNumber(r.customRate);
      const planRate = toNumber(r.ratePlan?.baseRate);
      return {
        id: r.id,
        roomNumber: r.roomNumber,
        roomType: r.roomType,
        amenities: Array.isArray(r.amenities) ? r.amenities : [],
        maxOccupancy: r.maxOccupancy,
        effectiveRate: customRate ?? planRate,
        customRate,
        category: r.category ? { id: r.category.id, name: r.category.name } : null,
        ratePlan: r.ratePlan
          ? {
              id: r.ratePlan.id,
              name: r.ratePlan.name,
              baseRate: planRate,
              currency: r.ratePlan.currency,
            }
          : null,
      };
    });

  res.json({
    success: true,
    data: {
      availableRooms,
      currency: rooms[0]?.ratePlan?.currency || 'NGN',
    },
  });
});

// POST /api/public/portal/:tenantSlug/checkout/intent
publicPortalRouter.post('/:tenantSlug/checkout/intent', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const client = requirePrisma();

  const booking = checkoutIntentSchema.parse(req.body) as CheckoutIntentPayload;
  const bookingContext = await prepareBookingContext(tenant.id, booking);
  const { settings, gateway, currency, credentials } = await resolveCheckoutPaymentConfig(
    tenant.id,
    booking
  );

  const payDepositOnly = Boolean(booking.payDepositOnly);
  const amountMajor = determineChargeAmount({
    booking,
    pricing: {
      effectiveRate: bookingContext.effectiveRate,
      nights: bookingContext.nights,
      totalRoomAmount: bookingContext.totalRoomAmount,
    },
    payDepositOnly,
  });
  const amountMinor = convertMajorToMinor(amountMajor);

  const reference = `INN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const expiresAt = new Date(Date.now() + CHECKOUT_INTENT_TTL_MS);

  const sessionToken = getGuestSessionTokenFromRequest(req);
  const session = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken,
    guest: {
      name: booking.guestName,
      email: booking.guestEmail,
      phone: booking.guestPhone,
    },
  });

  const callbackUrl =
    settings.callbackUrl ||
    `${process.env.PUBLIC_PORTAL_BASE_URL || 'http://67.211.210.8:3061'}/public/${tenant.slug}`;

  const initialized = await initializeGatewayPayment({
    gateway,
    amount: amountMinor,
    email: booking.guestEmail || `guest-${tenant.id}@innsight.local`,
    reference,
    currency,
    customerName: booking.guestName,
    customerPhone: booking.guestPhone,
    callbackUrl,
    credentials,
    metadata: {
      tenantId: tenant.id,
      guestName: booking.guestName,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
    },
  });

  const intent = await client.checkoutIntent.create({
    data: {
      tenantId: tenant.id,
      slug: tenant.slug,
      status: 'pending',
      booking: JSON.parse(JSON.stringify(booking)),
      pricing: {
        effectiveRate: bookingContext.effectiveRate,
        nights: bookingContext.nights,
        totalRoomAmount: bookingContext.totalRoomAmount,
      },
      gateway,
      currency,
      amountMajor: new Prisma.Decimal(amountMajor),
      amountMinor,
      payDepositOnly,
      reference: initialized.reference || reference,
      authorizationUrl: initialized.authorizationUrl,
      accessCode: initialized.accessCode,
      expiresAt,
      guest: {
        name: booking.guestName,
        email: booking.guestEmail ?? null,
        phone: booking.guestPhone ?? null,
      },
      roomSnapshot: {
        id: bookingContext.room.id,
        roomNumber: bookingContext.room.roomNumber,
        roomType: bookingContext.room.roomType,
      },
      sessionToken: session.sessionToken,
    },
  });

  res.status(201).json({
    success: true,
    data: {
      intentId: intent.id,
      authorizationUrl: initialized.authorizationUrl,
      reference: intent.reference,
      gateway,
      currency,
      amount: amountMajor,
      expiresAt: intent.expiresAt.toISOString(),
      guestSessionToken: session.sessionToken,
    },
  });
});

// POST /api/public/portal/:tenantSlug/checkout/confirm
publicPortalRouter.post('/:tenantSlug/checkout/confirm', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const { intentId, gateway, reference } = checkoutConfirmSchema.parse(req.body);

  const intent = await loadCheckoutIntent<CheckoutIntentPayload>(intentId);
  if (intent.tenantId !== tenant.id) {
    throw new AppError('Checkout intent not found', 404);
  }
  if (intent.reference !== reference) {
    throw new AppError('Payment reference does not match this checkout intent', 400);
  }
  if (gateway && gateway !== intent.gateway) {
    throw new AppError('Payment gateway does not match this checkout intent', 400);
  }

  if (intent.status === 'confirmed' && intent.reservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: intent.reservationId },
      include: { room: { select: { id: true, roomNumber: true, roomType: true } } },
    });
    const customerToken = issueCustomerToken({
      tenantId: tenant.id,
      reservationId: intent.reservationId,
      sessionToken: intent.sessionToken,
    });
    res.json({
      success: true,
      data: {
        status: 'confirmed',
        reservation: reservation ? serializePortalReservation(reservation) : undefined,
        customerToken,
        guestSessionToken: intent.sessionToken,
      },
    });
    return;
  }

  const credentials = buildGatewayCredentialSet(
    await getTenantPaymentSettings(tenant.id),
    intent.gateway
  );
  const verification = await verifyGatewayPayment(intent.gateway, reference, credentials);

  if (verification.status === 'pending') {
    res.json({
      success: true,
      data: { status: 'pending' },
    });
    return;
  }

  if (verification.status !== 'success') {
    await markIntentStatus(intent.id, 'failed', {
      failureReason: verification.metadata?.reason || 'Payment verification failed',
    });
    throw new AppError('Payment could not be verified', 402);
  }

  const expectedMinor = Math.round(Number(intent.amountMajor) * 100);
  if (verification.amount < expectedMinor) {
    await markIntentStatus(intent.id, 'failed', {
      failureReason: 'Payment amount mismatch',
    });
    throw new AppError('Payment amount does not match the booking amount', 402);
  }

  const result = await completeCheckoutIntent({
    tenantId: tenant.id,
    intent,
    verification,
  });

  const customerToken = issueCustomerToken({
    tenantId: tenant.id,
    reservationId: result.reservation.id,
    sessionToken: intent.sessionToken,
  });

  res.json({
    success: true,
    data: {
      status: 'confirmed',
      reservation: serializePortalReservation(result.reservation),
      customerToken,
      guestSessionToken: intent.sessionToken,
    },
  });
});

// --- Guest account auth ---

const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  marketingOptIn: z.boolean().optional(),
});

// POST /api/public/portal/:tenantSlug/signup
publicPortalRouter.post('/:tenantSlug/signup', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const client = requirePrisma();
  const data = signupSchema.parse(req.body);
  const email = data.email.trim().toLowerCase();

  const existing = await client.guestAccount.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email } },
  });
  if (existing) {
    throw new AppError('An account with this email already exists. Please sign in.', 409);
  }

  // Link to an existing Guest record when the email/phone matches
  const guest = await client.guest.findFirst({
    where: {
      tenantId: tenant.id,
      OR: [
        { email },
        ...(data.phone ? [{ phone: data.phone }] : []),
      ],
    },
    select: { id: true },
  });

  const account = await client.guestAccount.create({
    data: {
      tenantId: tenant.id,
      guestId: guest?.id ?? null,
      email,
      phone: data.phone ?? null,
      passwordHash: await hashPassword(data.password),
      marketingOptIn: data.marketingOptIn ?? true,
      lastLoginAt: new Date(),
    },
  });

  const session = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken: getGuestSessionTokenFromRequest(req),
    guest: { id: guest?.id, name: data.name, email, phone: data.phone },
  });

  const token = issueCustomerToken({
    tenantId: tenant.id,
    guestAccountId: account.id,
    guestId: guest?.id ?? null,
    sessionToken: session.sessionToken,
  });

  res.status(201).json({
    success: true,
    token,
    guestSessionToken: session.sessionToken,
    data: { guestAccount: serializeGuestAccount(account) },
  });
});

// POST /api/public/portal/:tenantSlug/login/password
publicPortalRouter.post('/:tenantSlug/login/password', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const client = requirePrisma();
  const { email, password } = z
    .object({ email: z.string().email(), password: z.string().min(1) })
    .parse(req.body);

  const account = await client.guestAccount.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: email.trim().toLowerCase() } },
  });
  if (!account || !(await comparePassword(password, account.passwordHash))) {
    throw new AppError('Invalid email or password', 401);
  }

  await client.guestAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
  });

  const reservations = await client.reservation.findMany({
    where: {
      tenantId: tenant.id,
      OR: [
        { guestId: account.guestId || '__none__' },
        { guestEmail: account.email },
      ],
    },
    include: { room: { select: { id: true, roomNumber: true, roomType: true } } },
    orderBy: { checkInDate: 'desc' },
    take: 20,
  });

  const session = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken: getGuestSessionTokenFromRequest(req),
    guest: { id: account.guestId ?? undefined, email: account.email, phone: account.phone ?? undefined },
  });

  const token = issueCustomerToken({
    tenantId: tenant.id,
    guestAccountId: account.id,
    guestId: account.guestId,
    reservationId: reservations[0]?.id ?? null,
    sessionToken: session.sessionToken,
  });

  res.json({
    success: true,
    token,
    guestSessionToken: session.sessionToken,
    data: {
      guestAccount: serializeGuestAccount(account),
      reservations: reservations.map(serializePortalReservation),
    },
  });
});

const findReservationForLogin = async (tenantId: string, reservationNumber: string) => {
  const client = requirePrisma();
  const reservation = await client.reservation.findFirst({
    where: {
      tenantId,
      reservationNumber: reservationNumber.trim(),
    },
    include: { room: { select: { id: true, roomNumber: true, roomType: true } } },
  });
  if (!reservation) {
    throw new AppError('Reservation not found. Check the reservation number and try again.', 404);
  }
  return reservation;
};

// POST /api/public/portal/:tenantSlug/login/reservation
publicPortalRouter.post('/:tenantSlug/login/reservation', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const { reservationNumber, email, phone } = z
    .object({
      reservationNumber: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .parse(req.body);

  const reservation = await findReservationForLogin(tenant.id, reservationNumber);

  const emailMatch =
    email && reservation.guestEmail?.toLowerCase() === email.trim().toLowerCase();
  const phoneMatch = phone && reservation.guestPhone === phone.trim();
  if (!emailMatch && !phoneMatch) {
    throw new AppError('Reservation details do not match our records', 401);
  }

  const session = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken: getGuestSessionTokenFromRequest(req),
    guest: {
      id: reservation.guestId ?? undefined,
      name: reservation.guestName,
      email: reservation.guestEmail ?? undefined,
      phone: reservation.guestPhone ?? undefined,
    },
  });

  const token = issueCustomerToken({
    tenantId: tenant.id,
    guestId: reservation.guestId,
    reservationId: reservation.id,
    sessionToken: session.sessionToken,
  });

  res.json({
    success: true,
    token,
    guestSessionToken: session.sessionToken,
    data: { reservation: serializePortalReservation(reservation) },
  });
});

// POST /api/public/portal/:tenantSlug/login/otp/request
publicPortalRouter.post('/:tenantSlug/login/otp/request', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const { reservationNumber, channel } = z
    .object({
      reservationNumber: z.string().min(1),
      channel: z.enum(['email', 'sms']),
    })
    .parse(req.body);

  const reservation = await findReservationForLogin(tenant.id, reservationNumber);

  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  const session = await ensureGuestSession({
    tenantId: tenant.id,
    sessionToken: getGuestSessionTokenFromRequest(req),
    guest: {
      id: reservation.guestId ?? undefined,
      name: reservation.guestName,
      email: reservation.guestEmail ?? undefined,
      phone: reservation.guestPhone ?? undefined,
    },
  });

  await updateGuestSessionMetadata(session.sessionToken, {
    otp: {
      codeHash,
      reservationId: reservation.id,
      expiresAt: expiresAt.toISOString(),
      attempts: 0,
      channel,
    },
  });

  if (channel === 'email' && reservation.guestEmail) {
    await sendEmail({
      to: reservation.guestEmail,
      subject: `${tenant.name} - Your sign-in code`,
      html: `<p>Hi ${reservation.guestName},</p><p>Your InnSight portal sign-in code is <strong>${code}</strong>. It expires in 10 minutes.</p>`,
      tenantId: tenant.id,
      trackOpens: false,
    });
  }

  res.json({
    success: true,
    guestSessionToken: session.sessionToken,
    data: { sent: true, channel, expiresAt: expiresAt.toISOString() },
  });
});

// POST /api/public/portal/:tenantSlug/login/otp/verify
publicPortalRouter.post('/:tenantSlug/login/otp/verify', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const client = requirePrisma();
  const { reservationNumber, code } = z
    .object({ reservationNumber: z.string().min(1), code: z.string().min(4) })
    .parse(req.body);

  const sessionToken = getGuestSessionTokenFromRequest(req);
  if (!sessionToken) {
    throw new AppError('Session expired. Request a new code.', 401);
  }

  const session = await client.guestSession.findUnique({
    where: { sessionToken },
  });
  const otp = (session?.metadata as any)?.otp;
  if (!session || session.tenantId !== tenant.id || !otp) {
    throw new AppError('No sign-in code found. Request a new one.', 400);
  }

  if ((otp.attempts || 0) >= 5) {
    throw new AppError('Too many attempts. Request a new code.', 429);
  }

  if (new Date(otp.expiresAt) < new Date()) {
    throw new AppError('Code has expired. Request a new one.', 410);
  }

  const codeHash = crypto.createHash('sha256').update(code.trim()).digest('hex');
  const reservation = await findReservationForLogin(tenant.id, reservationNumber);

  if (otp.codeHash !== codeHash || otp.reservationId !== reservation.id) {
    await updateGuestSessionMetadata(sessionToken, {
      otp: { ...otp, attempts: (otp.attempts || 0) + 1 },
    });
    throw new AppError('Incorrect code', 401);
  }

  // Clear the OTP once used
  await updateGuestSessionMetadata(sessionToken, { otp: null });

  const token = issueCustomerToken({
    tenantId: tenant.id,
    guestId: reservation.guestId,
    reservationId: reservation.id,
    sessionToken,
  });

  res.json({
    success: true,
    token,
    guestSessionToken: sessionToken,
    data: { reservation: serializePortalReservation(reservation) },
  });
});

// GET /api/public/portal/:tenantSlug/me
publicPortalRouter.get('/:tenantSlug/me', async (req, res) => {
  const tenant = await resolveTenantBySlug(req.params.tenantSlug);
  const client = requirePrisma();

  const token = req.headers['x-customer-token'];
  if (!token || typeof token !== 'string') {
    throw new AppError('Authentication required', 401);
  }

  const payload = verifyCustomerToken(token);
  if (payload.tenantId !== tenant.id) {
    throw new AppError('Session does not belong to this property', 403);
  }

  const guestAccount = payload.guestAccountId
    ? await client.guestAccount.findUnique({ where: { id: payload.guestAccountId } })
    : null;

  const reservationWhere: any = { tenantId: tenant.id };
  if (guestAccount?.guestId) {
    reservationWhere.OR = [{ guestId: guestAccount.guestId }, { guestEmail: guestAccount.email }];
  } else if (payload.guestId) {
    reservationWhere.guestId = payload.guestId;
  } else if (payload.reservationId) {
    reservationWhere.id = payload.reservationId;
  } else {
    reservationWhere.id = '__none__';
  }

  const reservations = await client.reservation.findMany({
    where: reservationWhere,
    include: { room: { select: { id: true, roomNumber: true, roomType: true } } },
    orderBy: { checkInDate: 'desc' },
    take: 20,
  });

  const primary = payload.reservationId
    ? reservations.find((r) => r.id === payload.reservationId) ?? reservations[0]
    : reservations[0];

  res.json({
    success: true,
    data: {
      reservation: primary ? serializePortalReservation(primary) : null,
      guestAccount: guestAccount ? serializeGuestAccount(guestAccount) : null,
      reservations: reservations.map(serializePortalReservation),
      guestSessionToken: payload.sessionToken ?? null,
    },
  });
});
