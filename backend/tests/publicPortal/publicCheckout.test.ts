import request from 'supertest';

const mockIntentDocSet = jest.fn();
const mockPaymentDocSet = jest.fn();

const buildTimestamp = (date: Date) =>
  ({
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getMilliseconds() % 1000) * 1_000_000,
    toDate: () => date,
    toMillis: () => date.getTime(),
    isEqual: (other: { toMillis(): number }) => other.toMillis() === date.getTime(),
    valueOf: () => date.getTime(),
  }) as any;

import { app } from '../../src/index';
import { resolveTenantBySlug } from '../../src/utils/tenantContext';
import {
  ensureGuestSession,
  markSessionConverted,
  updateGuestSessionMetadata,
} from '../../src/utils/guestSessions';
import {
  initializeGatewayPayment,
  verifyGatewayPayment,
} from '../../src/utils/publicPayments';
import {
  prepareBookingContext,
  determineChargeAmount,
  convertMajorToMinor,
  resolveCheckoutPaymentConfig,
  createFolioWithCharge,
  type CheckoutIntentPayload,
} from '../../src/utils/publicCheckout';
import {
  loadCheckoutIntent,
  markIntentStatus,
  type CheckoutIntentRecord,
} from '../../src/utils/checkoutIntents';
import { issueCustomerToken } from '../../src/utils/customerAuth';
import { prisma } from '../../src/utils/prisma';
import { createBatchReservations, resolveTenantUserId } from '../../src/utils/reservationBatch';

jest.mock('firebase-admin', () => ({
  firestore: {
    Timestamp: {
      fromMillis: (millis: number) => buildTimestamp(new Date(millis)),
    },
  },
}));

jest.mock('../../src/utils/firestore', () => {
  const buildDoc = (id: string, setFn: jest.Mock) => ({
    id,
    set: setFn,
    update: jest.fn(),
    get: jest.fn(),
  });

  const collection = jest.fn((name: string) => {
    if (name === 'payments') {
      return {
        doc: jest.fn(() => buildDoc('payment-doc-id', mockPaymentDocSet)),
      };
    }
    return {
      doc: jest.fn(() => buildDoc('intent-doc-id', mockIntentDocSet)),
    };
  });

  const timestampStub = buildTimestamp(new Date('2025-01-01T00:00:00.000Z'));

  return {
    db: {
      collection,
    },
    now: jest.fn(() => timestampStub),
    toTimestamp: jest.fn((value: Date | string | null | undefined) =>
      value ? buildTimestamp(new Date(value)) : timestampStub
    ),
    toDate: jest.fn((value: any) => (value instanceof Date ? value : new Date(value))),
  };
});

jest.mock('../../src/utils/prisma', () => {
  const prismaMock: any = {
    reservation: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    guest: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  prismaMock.$transaction = jest.fn((fn: any) => fn(prismaMock));

  return { prisma: prismaMock };
});

const { prisma: mockPrisma } = jest.requireMock('../../src/utils/prisma') as {
  prisma: typeof prisma;
};

jest.mock('../../src/utils/tenantContext', () => ({
  resolveTenantBySlug: jest.fn(),
}));

jest.mock('../../src/utils/guestSessions', () => ({
  ensureGuestSession: jest.fn(),
  markSessionConverted: jest.fn(),
  updateGuestSessionMetadata: jest.fn(),
}));

jest.mock('../../src/utils/publicPayments', () => ({
  initializeGatewayPayment: jest.fn(),
  verifyGatewayPayment: jest.fn(),
}));

jest.mock('../../src/utils/publicCheckout', () => {
  const actual = jest.requireActual('../../src/utils/publicCheckout');
  return {
    ...actual,
    prepareBookingContext: jest.fn(),
    determineChargeAmount: jest.fn(),
    convertMajorToMinor: jest.fn(),
    resolveCheckoutPaymentConfig: jest.fn(),
    createFolioWithCharge: jest.fn(),
    CHECKOUT_INTENT_TTL_MS: 15 * 60 * 1000,
  };
});

jest.mock('../../src/utils/checkoutIntents', () => ({
  loadCheckoutIntent: jest.fn(),
  markIntentStatus: jest.fn(),
}));

jest.mock('../../src/utils/customerAuth', () => ({
  issueCustomerToken: jest.fn(),
}));

jest.mock('../../src/utils/reservationBatch', () => ({
  createBatchReservations: jest.fn(),
  resolveTenantUserId: jest.fn(),
}));

const mockResolveTenantBySlug = resolveTenantBySlug as jest.MockedFunction<
  typeof resolveTenantBySlug
>;
const mockEnsureGuestSession = ensureGuestSession as jest.MockedFunction<
  typeof ensureGuestSession
>;
const mockUpdateGuestSessionMetadata = updateGuestSessionMetadata as jest.MockedFunction<
  typeof updateGuestSessionMetadata
>;
const mockInitializeGatewayPayment = initializeGatewayPayment as jest.MockedFunction<
  typeof initializeGatewayPayment
>;
const mockPrepareBookingContext = prepareBookingContext as jest.MockedFunction<
  typeof prepareBookingContext
>;
const mockDetermineChargeAmount = determineChargeAmount as jest.MockedFunction<
  typeof determineChargeAmount
>;
const mockConvertMajorToMinor = convertMajorToMinor as jest.MockedFunction<
  typeof convertMajorToMinor
>;
const mockResolveCheckoutPaymentConfig =
  resolveCheckoutPaymentConfig as jest.MockedFunction<typeof resolveCheckoutPaymentConfig>;
const mockLoadCheckoutIntent = loadCheckoutIntent as jest.MockedFunction<
  typeof loadCheckoutIntent
>;
const mockVerifyGatewayPayment = verifyGatewayPayment as jest.MockedFunction<
  typeof verifyGatewayPayment
>;
const mockCreateFolioWithCharge = createFolioWithCharge as jest.MockedFunction<
  typeof createFolioWithCharge
>;
const mockMarkIntentStatus = markIntentStatus as jest.MockedFunction<typeof markIntentStatus>;
const mockMarkSessionConverted = markSessionConverted as jest.MockedFunction<
  typeof markSessionConverted
>;
const mockIssueCustomerToken = issueCustomerToken as jest.Mock<
  ReturnType<typeof issueCustomerToken>,
  Parameters<typeof issueCustomerToken>
>;
const mockCreateBatchReservations = createBatchReservations as jest.MockedFunction<
  typeof createBatchReservations
>;
const mockResolveTenantUserId = resolveTenantUserId as jest.MockedFunction<
  typeof resolveTenantUserId
>;

const buildIntentRecord = (
  overrides?: Partial<CheckoutIntentRecord<CheckoutIntentPayload>>
): CheckoutIntentRecord<CheckoutIntentPayload> => {
  const now = buildTimestamp(new Date('2025-01-01T12:00:00.000Z'));
  return {
    id: 'intent-seed',
    tenantId: baseTenant.id,
    slug: baseTenant.slug,
    status: 'pending',
    booking: baseBookingPayload,
    pricing: basePricing,
    gateway: 'paystack',
    currency: 'NGN',
    amountMajor: basePricing.totalRoomAmount,
    amountMinor: basePricing.totalRoomAmount * 100,
    payDepositOnly: false,
    reference: 'CKO-REF',
    authorizationUrl: 'https://pay.example/authorize',
    accessCode: 'ACCESS',
    expiresAt: buildTimestamp(new Date(Date.now() + 10 * 60 * 1000)),
    guest: {
      name: baseBookingPayload.guestName,
      email: baseBookingPayload.guestEmail,
      phone: baseBookingPayload.guestPhone,
    },
    roomSnapshot: {
      id: 'room-1',
      roomNumber: '101',
      roomType: 'Deluxe',
    },
    sessionToken: 'guest-session',
    reservationId: undefined,
    folioId: undefined,
    paymentDocumentId: undefined,
    createdAt: now,
    updatedAt: now,
    ...(overrides || {}),
  };
};

const baseTenant = {
  id: 'tenant-123',
  slug: 'test-tenant',
  name: 'Test Hotel',
  email: 'contact@test-hotel.com',
  phone: '+2348012345678',
  address: '123 Street',
  branding: null,
};

const baseBookingPayload = {
  roomId: '11111111-1111-1111-1111-111111111111',
  checkInDate: '2025-02-01T15:00:00.000Z',
  checkOutDate: '2025-02-04T11:00:00.000Z',
  adults: 2,
  children: 0,
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestPhone: '+2348012345678',
  rate: 50000,
  depositAmount: 25000,
  source: 'web_portal' as const,
};

const basePricing = {
  effectiveRate: 50000,
  nights: 3,
  totalRoomAmount: 150000,
};

describe('Public portal checkout flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIntentDocSet.mockClear();
    mockPaymentDocSet.mockClear();

    mockResolveTenantBySlug.mockResolvedValue(baseTenant);
    mockEnsureGuestSession.mockResolvedValue({ sessionToken: 'guest-session', isNew: true });
    mockUpdateGuestSessionMetadata.mockResolvedValue(undefined);
    mockInitializeGatewayPayment.mockResolvedValue({
      authorizationUrl: 'https://pay.example/authorize',
      reference: 'CKO-REF',
      accessCode: 'ACCESS',
      gateway: 'paystack',
    });
    mockPrepareBookingContext.mockResolvedValue({
      ...basePricing,
      room: {
        id: 'room-1',
        roomNumber: '101',
        roomType: 'Deluxe',
        status: 'available',
        customRate: null,
        ratePlan: {
          id: 'rate-plan-1',
          baseRate: basePricing.effectiveRate,
          currency: 'NGN',
        },
      },
      checkIn: new Date(baseBookingPayload.checkInDate),
      checkOut: new Date(baseBookingPayload.checkOutDate),
    });
    mockDetermineChargeAmount.mockReturnValue(basePricing.totalRoomAmount);
    mockConvertMajorToMinor.mockReturnValue(basePricing.totalRoomAmount * 100);
    mockResolveCheckoutPaymentConfig.mockResolvedValue({
      settings: {
        tenantId: baseTenant.id,
        defaultGateway: 'paystack',
        currency: 'NGN',
        callbackUrl: 'https://portal.test/callback',
      },
      gateway: 'paystack',
      currency: 'NGN',
    });
    mockPrisma.guest.findFirst.mockResolvedValue(null);
    mockPrisma.guest.create.mockResolvedValue({
      id: 'guest-1',
      name: baseBookingPayload.guestName,
      email: baseBookingPayload.guestEmail,
      phone: baseBookingPayload.guestPhone,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'system-user' });
    mockPrisma.user.create.mockResolvedValue({ id: 'system-user' });
    mockPrisma.reservation.create.mockReset();
    mockPrisma.reservation.findFirst.mockReset();
    mockPrisma.$transaction.mockClear();
    mockCreateFolioWithCharge.mockResolvedValue({ id: 'folio-123' });
    mockIssueCustomerToken.mockReturnValue('customer-token' as ReturnType<typeof issueCustomerToken>);
    mockResolveTenantUserId.mockResolvedValue('system-user');
    mockCreateBatchReservations.mockResolvedValue({
      groupBookingId: null,
      reservations: [
        {
          id: 'reservation-1',
          tenantId: baseTenant.id,
          reservationNumber: 'WEB-123456',
          guestName: baseBookingPayload.guestName,
          guestEmail: baseBookingPayload.guestEmail,
          guestPhone: baseBookingPayload.guestPhone,
          guestIdNumber: baseBookingPayload.guestIdNumber ?? null,
          checkInDate: baseBookingPayload.checkInDate,
          checkOutDate: baseBookingPayload.checkOutDate,
          adults: baseBookingPayload.adults,
          children: baseBookingPayload.children,
          status: 'confirmed',
          roomId: baseBookingPayload.roomId,
          room: {
            id: 'room-1',
            roomNumber: '101',
            roomType: 'Deluxe',
          },
          rate: basePricing.effectiveRate,
          depositAmount: null,
          depositStatus: null,
          depositRequired: false,
        },
      ],
    });
  });

  it('creates a checkout intent and persists the Firestore record', async () => {
    const response = await request(app)
      .post(`/api/public/portal/${baseTenant.slug}/checkout/intent`)
      .send(baseBookingPayload);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      intentId: expect.any(String),
      authorizationUrl: 'https://pay.example/authorize',
      reference: 'CKO-REF',
      amount: basePricing.totalRoomAmount,
      gateway: 'paystack',
    });
    expect(mockResolveTenantBySlug).toHaveBeenCalledWith(baseTenant.slug);
    expect(mockPrepareBookingContext).toHaveBeenCalledWith(baseTenant.id, baseBookingPayload);
    expect(mockDetermineChargeAmount).toHaveBeenCalledWith({
      booking: baseBookingPayload,
      pricing: basePricing,
      payDepositOnly: false,
    });
    expect(mockIntentDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: baseTenant.id,
        booking: baseBookingPayload,
        pricing: basePricing,
        gateway: 'paystack',
        amountMajor: basePricing.totalRoomAmount,
        amountMinor: basePricing.totalRoomAmount * 100,
        sessionToken: 'guest-session',
      })
    );
    expect(mockInitializeGatewayPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: basePricing.totalRoomAmount * 100,
        email: baseBookingPayload.guestEmail,
        reference: expect.stringMatching(/^CKO-/),
      })
    );
    const cookiesHeader = response.headers['set-cookie'];
    const cookies = Array.isArray(cookiesHeader)
      ? cookiesHeader
      : cookiesHeader
        ? [cookiesHeader]
        : [];
    expect(cookies.some((cookie) => cookie.includes('guestSession=guest-session'))).toBe(true);
  });

  it('confirms a checkout intent and creates reservation + folio', async () => {
    const futureTimestamp = buildTimestamp(new Date(Date.now() + 5 * 60 * 1000));

    mockLoadCheckoutIntent.mockResolvedValue(
      buildIntentRecord({
        id: 'intent-abc',
        expiresAt: futureTimestamp,
      })
    );

    mockVerifyGatewayPayment.mockResolvedValue({
      status: 'success',
      amount: basePricing.totalRoomAmount * 100,
      currency: 'NGN',
      reference: 'CKO-REF',
      gateway: 'paystack',
      paidAt: new Date('2025-02-01T16:00:00.000Z'),
      gatewayTransactionId: 'GW-123',
    });

    const response = await request(app)
      .post(`/api/public/portal/${baseTenant.slug}/checkout/confirm`)
      .send({
        intentId: 'intent-abc',
        gateway: 'paystack',
        reference: 'CKO-REF',
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      intentId: 'intent-abc',
      status: 'confirmed',
      reservation: expect.objectContaining({
        id: 'reservation-1',
        guestName: baseBookingPayload.guestName,
      }),
      customerToken: 'customer-token',
    });
    expect(mockVerifyGatewayPayment).toHaveBeenCalledWith('paystack', 'CKO-REF');
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockCreateBatchReservations).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: baseTenant.id,
        actorUserId: 'system-user',
        data: expect.objectContaining({
          guestName: baseBookingPayload.guestName,
          rooms: [
            expect.objectContaining({
              roomId: baseBookingPayload.roomId,
              rate: basePricing.effectiveRate,
            }),
          ],
        }),
        overrides: expect.objectContaining({
          depositRequired: expect.any(Boolean),
          depositStatus: 'pending',
          reservationNumberFactory: expect.any(Function),
        }),
      })
    );
    expect(mockCreateFolioWithCharge).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: baseTenant.id,
        paymentAmountMajor: basePricing.totalRoomAmount,
      })
    );
    expect(mockPaymentDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'CKO-REF',
        paymentGateway: 'paystack',
        amount: basePricing.totalRoomAmount,
      })
    );
    expect(mockMarkIntentStatus).toHaveBeenCalledWith('intent-abc', 'confirmed', {
      reservationId: 'reservation-1',
      folioId: 'folio-123',
      paymentDocumentId: 'payment-doc-id',
    });
    expect(mockMarkSessionConverted).toHaveBeenCalledWith('guest-session', 'reservation-1');
    expect(mockUpdateGuestSessionMetadata).toHaveBeenCalledWith(
      'guest-session',
      expect.objectContaining({
        lastCheckoutIntentStatus: 'confirmed',
      })
    );
  });

  it('rejects confirmation when the checkout intent has expired', async () => {
    const pastTimestamp = buildTimestamp(new Date(Date.now() - 60 * 1000));

    mockLoadCheckoutIntent.mockResolvedValue(
      buildIntentRecord({
        id: 'intent-expired',
        expiresAt: pastTimestamp,
      })
    );

    const response = await request(app)
      .post(`/api/public/portal/${baseTenant.slug}/checkout/confirm`)
      .send({
        intentId: 'intent-expired',
        reference: 'CKO-REF',
      });

    expect(response.status).toBe(410);

    expect(mockMarkIntentStatus).toHaveBeenCalledWith('intent-expired', 'expired');
    expect(mockVerifyGatewayPayment).not.toHaveBeenCalled();
  });

  it('rejects confirmation when the reference does not match the intent', async () => {
    const futureTimestamp = buildTimestamp(new Date(Date.now() + 5 * 60 * 1000));

    mockLoadCheckoutIntent.mockResolvedValue(
      buildIntentRecord({
        id: 'intent-ref-mismatch',
        reference: 'EXPECTED-REF',
        expiresAt: futureTimestamp,
      })
    );

    const response = await request(app)
      .post(`/api/public/portal/${baseTenant.slug}/checkout/confirm`)
      .send({
        intentId: 'intent-ref-mismatch',
        reference: 'WRONG-REF',
      });

    expect(response.status).toBe(400);

    expect(mockVerifyGatewayPayment).not.toHaveBeenCalled();
    expect(mockMarkIntentStatus).not.toHaveBeenCalled();
  });

  it('marks intent as failed when payment amount mismatches on confirmation', async () => {
    const futureTimestamp = buildTimestamp(new Date(Date.now() + 5 * 60 * 1000));

    mockLoadCheckoutIntent.mockResolvedValue(
      buildIntentRecord({
        id: 'intent-amount-mismatch',
        expiresAt: futureTimestamp,
      })
    );

    mockVerifyGatewayPayment.mockResolvedValue({
      status: 'success',
      amount: 12345,
      currency: 'NGN',
      reference: 'CKO-REF',
      gateway: 'paystack',
      paidAt: new Date(),
      gatewayTransactionId: 'GW-123',
    });

    const response = await request(app)
      .post(`/api/public/portal/${baseTenant.slug}/checkout/confirm`)
      .send({
        intentId: 'intent-amount-mismatch',
        reference: 'CKO-REF',
      });

    expect(response.status).toBe(400);

    expect(mockMarkIntentStatus).toHaveBeenCalledWith('intent-amount-mismatch', 'failed', {
      failureReason: 'amount_mismatch',
    });
  });
});
