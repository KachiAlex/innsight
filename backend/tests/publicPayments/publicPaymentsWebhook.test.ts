import express from 'express';
import crypto from 'crypto';
import request from 'supertest';

import { publicPaymentsRouter } from '../../src/routes/public-payments';
import {
  findCheckoutIntentByReference,
  markIntentStatus,
  type CheckoutIntentRecord,
} from '../../src/utils/checkoutIntents';
import {
  getTenantPaymentSettings,
  verifyGatewayPayment,
} from '../../src/utils/publicPayments';
import { completeCheckoutIntent } from '../../src/utils/publicCheckout';

jest.mock('../../src/utils/checkoutIntents', () => ({
  findCheckoutIntentByReference: jest.fn(),
  markIntentStatus: jest.fn(),
}));

jest.mock('../../src/utils/publicPayments', () => ({
  getTenantPaymentSettings: jest.fn(),
  verifyGatewayPayment: jest.fn(),
}));

jest.mock('../../src/utils/publicCheckout', () => ({
  completeCheckoutIntent: jest.fn(),
}));

const mockFindIntent = findCheckoutIntentByReference as jest.MockedFunction<
  typeof findCheckoutIntentByReference
>;
const mockMarkIntentStatus = markIntentStatus as jest.MockedFunction<
  typeof markIntentStatus
>;
const mockGetTenantPaymentSettings = getTenantPaymentSettings as jest.MockedFunction<
  typeof getTenantPaymentSettings
>;
const mockVerifyGatewayPayment = verifyGatewayPayment as jest.MockedFunction<
  typeof verifyGatewayPayment
>;
const mockCompleteCheckoutIntent = completeCheckoutIntent as jest.MockedFunction<
  typeof completeCheckoutIntent
>;

const buildTestApp = () => {
  const app = express();
  app.use('/api/public/payments', publicPaymentsRouter);
  return app;
};

const buildIntent = (overrides?: Partial<CheckoutIntentRecord>): CheckoutIntentRecord =>
  ({
    id: 'intent_123',
    tenantId: 'tenant_001',
    status: 'pending',
    amountMinor: 50000,
    amountMajor: 500,
    reference: 'PAY-ABC-123',
    reservationId: undefined,
    folioId: undefined,
    booking: {},
    pricing: { effectiveRate: 0, nights: 0, totalRoomAmount: 0 },
    gateway: 'paystack',
    currency: 'NGN',
    payDepositOnly: false,
    authorizationUrl: 'https://example.com',
    accessCode: 'code',
    expiresAt: new Date() as any,
    guest: { name: 'Jane Doe', email: 'jane@example.com' },
    roomSnapshot: { id: 'room', roomNumber: '101', roomType: 'Deluxe' },
    createdAt: new Date() as any,
    updatedAt: new Date() as any,
    ...overrides,
  }) as CheckoutIntentRecord;

describe('public payments webhook router', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reconciles Paystack payments when signature and verification succeed', async () => {
    const tenantId = 'tenant_paystack';
    const intent = buildIntent({
      tenantId,
      reference: 'PAY-OK-123',
    });

    mockGetTenantPaymentSettings.mockResolvedValue({
      tenantId,
      defaultGateway: 'paystack',
      currency: 'NGN',
      callbackUrl: undefined,
      paystackPublicKey: 'public',
      paystackSecretKey: 'secret-key',
      flutterwavePublicKey: undefined,
      flutterwaveSecretKey: undefined,
      monnifyApiKey: undefined,
      monnifySecretKey: undefined,
      monnifyContractCode: undefined,
      monnifyCollectionAccount: undefined,
      monnifyBaseUrl: undefined,
    });

    mockFindIntent.mockResolvedValue(intent);
    mockVerifyGatewayPayment.mockResolvedValue({
      status: 'success',
      amount: intent.amountMinor,
      currency: 'NGN',
      reference: intent.reference,
      gateway: 'paystack',
      gatewayTransactionId: 'paystack-gw-123',
      paidAt: new Date(),
    });
    mockCompleteCheckoutIntent.mockResolvedValue({
      reservation: { id: 'res_1' },
      folioId: 'folio_1',
      paymentDocumentId: 'payment_1',
    });

    const payload = {
      event: 'charge.success',
      data: {
        reference: intent.reference,
        metadata: { tenantId },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha512', 'secret-key')
      .update(rawBody)
      .digest('hex');

    const response = await request(buildTestApp())
      .post('/api/public/payments/webhook/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', signature)
      .send(rawBody)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      processed: true,
      reservationId: 'res_1',
      folioId: 'folio_1',
    });
    expect(mockVerifyGatewayPayment).toHaveBeenCalledWith('paystack', intent.reference);
    expect(mockCompleteCheckoutIntent).toHaveBeenCalledWith({
      tenantId,
      intent,
      verification: expect.objectContaining({ status: 'success' }),
    });
    expect(mockMarkIntentStatus).not.toHaveBeenCalled();
  });

  it('rejects Paystack webhooks when signatures do not match', async () => {
    const tenantId = 'tenant_invalid_signature';
    mockGetTenantPaymentSettings.mockResolvedValue({
      tenantId,
      defaultGateway: 'paystack',
      currency: 'NGN',
      callbackUrl: undefined,
      paystackPublicKey: 'public',
      paystackSecretKey: 'secret-key',
      flutterwavePublicKey: undefined,
      flutterwaveSecretKey: undefined,
      monnifyApiKey: undefined,
      monnifySecretKey: undefined,
      monnifyContractCode: undefined,
      monnifyCollectionAccount: undefined,
      monnifyBaseUrl: undefined,
    });

    const payload = {
      event: 'charge.success',
      data: {
        reference: 'PAY-BAD-123',
        metadata: { tenantId },
      },
    };

    const response = await request(buildTestApp())
      .post('/api/public/payments/webhook/paystack')
      .set('Content-Type', 'application/json')
      .set('x-paystack-signature', 'invalid-signature')
      .send(JSON.stringify(payload))
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      message: 'Invalid signature',
    });
    expect(mockFindIntent).not.toHaveBeenCalled();
    expect(mockVerifyGatewayPayment).not.toHaveBeenCalled();
  });

  it('marks intents as failed when Flutterwave verification detects amount mismatch', async () => {
    const tenantId = 'tenant_flutterwave';
    const intent = buildIntent({
      tenantId,
      reference: 'FLW-REF-123',
      amountMinor: 25000,
      gateway: 'flutterwave',
    });

    mockGetTenantPaymentSettings.mockResolvedValue({
      tenantId,
      defaultGateway: 'paystack',
      currency: 'NGN',
      callbackUrl: undefined,
      paystackPublicKey: undefined,
      paystackSecretKey: undefined,
      flutterwavePublicKey: 'public',
      flutterwaveSecretKey: 'flutterwave-secret',
      monnifyApiKey: undefined,
      monnifySecretKey: undefined,
      monnifyContractCode: undefined,
      monnifyCollectionAccount: undefined,
      monnifyBaseUrl: undefined,
    });

    mockFindIntent.mockResolvedValue(intent);
    mockVerifyGatewayPayment.mockResolvedValue({
      status: 'success',
      amount: 35000,
      currency: 'NGN',
      reference: intent.reference,
      gateway: 'flutterwave',
      gatewayTransactionId: 'flutterwave-gw-123',
      paidAt: new Date(),
    });

    const payload = {
      event: 'charge.completed',
      data: {
        tx_ref: intent.reference,
        meta: { tenantId },
      },
    };

    const rawBody = JSON.stringify(payload);
    const signature = crypto
      .createHmac('sha256', 'flutterwave-secret')
      .update(rawBody)
      .digest('hex');

    const response = await request(buildTestApp())
      .post('/api/public/payments/webhook/flutterwave')
      .set('Content-Type', 'application/json')
      .set('verif-hash', signature)
      .send(rawBody)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      processed: false,
      reason: 'amount_mismatch',
    });
    expect(mockMarkIntentStatus).toHaveBeenCalledWith(intent.id, 'failed', {
      failureReason: 'amount_mismatch',
      verifiedAmount: 35000,
    });
    expect(mockCompleteCheckoutIntent).not.toHaveBeenCalled();
  });
});
