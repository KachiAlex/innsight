import express, { Router } from 'express';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import {
  verifyGatewayPayment,
  getTenantPaymentSettings,
} from '../utils/publicPayments';
import {
  findCheckoutIntentByReference,
  markIntentStatus,
  type CheckoutIntentRecord,
} from '../utils/checkoutIntents';
import { completeCheckoutIntent } from '../utils/publicCheckout';

type LogLevel = 'info' | 'warn' | 'error';

const logWebhookEvent = (
  level: LogLevel,
  message: string,
  meta: Record<string, any>
) => {
  const entry = {
    scope: 'public_payments_webhook',
    ...meta,
  };

  if (level === 'info') {
    console.info('[PublicPaymentsWebhook]', message, entry);
  } else if (level === 'warn') {
    console.warn('[PublicPaymentsWebhook]', message, entry);
  } else {
    console.error('[PublicPaymentsWebhook]', message, entry);
  }
};

const webhookRawMiddleware = express.raw({ type: '*/*' });

type GatewayResult =
  | { processed: true; reservationId: string; folioId: string }
  | { processed: false; reason: string; details?: Record<string, any> };

const reconcileCheckoutIntent = async ({
  gateway,
  reference,
  tenantId,
}: {
  gateway: 'paystack' | 'flutterwave';
  reference: string;
  tenantId: string;
}): Promise<GatewayResult> => {
  const startedAt = Date.now();
  const intent = await findCheckoutIntentByReference(reference);
  if (!intent) {
    logWebhookEvent('warn', 'intent_not_found', {
      gateway,
      tenantId,
      reference,
    });
    return { processed: false, reason: 'intent_not_found' };
  }

  if (intent.tenantId !== tenantId) {
    logWebhookEvent('warn', 'tenant_mismatch', {
      gateway,
      expectedTenantId: intent.tenantId,
      payloadTenantId: tenantId,
      reference,
    });
    return {
      processed: false,
      reason: 'tenant_mismatch',
      details: { intentTenantId: intent.tenantId, payloadTenantId: tenantId },
    };
  }

  if (intent.status === 'confirmed' && intent.reservationId && intent.folioId) {
    logWebhookEvent('info', 'intent_already_confirmed', {
      gateway,
      tenantId,
      reference,
      reservationId: intent.reservationId,
      folioId: intent.folioId,
    });
    return {
      processed: false,
      reason: 'already_confirmed',
      details: {
        reservationId: intent.reservationId,
        folioId: intent.folioId,
      },
    };
  }

  const verification = await verifyGatewayPayment(gateway, reference);

  if (verification.status !== 'success') {
    await markIntentStatus(intent.id, 'failed', {
      failureReason: verification.status,
    });
    logWebhookEvent('warn', 'verification_not_success', {
      gateway,
      tenantId,
      reference,
      verificationStatus: verification.status,
      durationMs: Date.now() - startedAt,
    });
    return {
      processed: false,
      reason: 'verification_not_success',
      details: { status: verification.status },
    };
  }

  if (Math.abs(verification.amount - intent.amountMinor) > 1) {
    await markIntentStatus(intent.id, 'failed', {
      failureReason: 'amount_mismatch',
      verifiedAmount: verification.amount,
    });
    logWebhookEvent('warn', 'amount_mismatch', {
      gateway,
      tenantId,
      reference,
      expectedAmount: intent.amountMinor,
      verifiedAmount: verification.amount,
      durationMs: Date.now() - startedAt,
    });
    return {
      processed: false,
      reason: 'amount_mismatch',
      details: {
        expectedAmount: intent.amountMinor,
        verifiedAmount: verification.amount,
      },
    };
  }

  const completion = await completeCheckoutIntent({
    tenantId: intent.tenantId,
    intent: intent as CheckoutIntentRecord,
    verification,
  });

  logWebhookEvent('info', 'intent_reconciled', {
    gateway,
    tenantId,
    reference,
    reservationId: completion.reservation.id,
    folioId: completion.folioId,
    durationMs: Date.now() - startedAt,
  });

  return {
    processed: true,
    reservationId: completion.reservation.id,
    folioId: completion.folioId,
  };
};

const toBuffer = (body: unknown): Buffer => {
  if (!body) return Buffer.from('');
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body, 'utf8');
  return Buffer.from(body as any);
};

const parseJsonBody = (buffer: Buffer) => {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    throw new AppError('Invalid JSON payload', 400);
  }
};

const publicPaymentsRouter = Router();

publicPaymentsRouter.post(
  '/webhook/paystack',
  webhookRawMiddleware,
  async (req, res) => {
    const receivedAt = Date.now();
    const rawBody = toBuffer(req.body);
    const payload = parseJsonBody(rawBody);
    const signatureHeader = req.headers['x-paystack-signature'];

    if (!signatureHeader || typeof signatureHeader !== 'string') {
      return res
        .status(400)
        .json({ success: false, message: 'Missing Paystack signature' });
    }

    const tenantId = payload?.data?.metadata?.tenantId;
    if (!tenantId) {
      logWebhookEvent('warn', 'missing_tenant_metadata', {
        gateway: 'paystack',
        durationMs: Date.now() - receivedAt,
      });
      return res
        .status(400)
        .json({ success: false, message: 'Missing tenantId in metadata' });
    }

    const settings = await getTenantPaymentSettings(tenantId);
    const paystackSecret =
      settings.paystackSecretKey || process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      logWebhookEvent('error', 'missing_paystack_secret', {
        tenantId,
        gateway: 'paystack',
      });
      return res.status(500).json({
        success: false,
        message: 'Paystack secret key not configured for tenant',
      });
    }

    const computedHash = crypto
      .createHmac('sha512', paystackSecret)
      .update(rawBody)
      .digest('hex');

    if (computedHash !== signatureHeader) {
      logWebhookEvent('warn', 'signature_mismatch', {
        gateway: 'paystack',
        tenantId,
        durationMs: Date.now() - receivedAt,
      });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const reference = payload?.data?.reference;
    if (!reference) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing payment reference' });
    }

    try {
      const result = await reconcileCheckoutIntent({
        gateway: 'paystack',
        reference,
        tenantId,
      });

      return res.json({ success: true, ...result });
    } catch (error: any) {
      logWebhookEvent('error', 'paystack_webhook_error', {
        tenantId,
        reference,
        message: error?.message,
        durationMs: Date.now() - receivedAt,
      });
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to process webhook',
      });
    }
  }
);

publicPaymentsRouter.post(
  '/webhook/flutterwave',
  webhookRawMiddleware,
  async (req, res) => {
    const receivedAt = Date.now();
    const rawBody = toBuffer(req.body);
    const payload = parseJsonBody(rawBody);
    const signatureHeader = req.headers['verif-hash'];

    if (!signatureHeader || typeof signatureHeader !== 'string') {
      return res
        .status(400)
        .json({ success: false, message: 'Missing Flutterwave signature' });
    }

    const tenantId =
      payload?.data?.meta?.tenantId ||
      payload?.data?.meta?.metadata?.tenantId ||
      payload?.data?.metadata?.tenantId;

    if (!tenantId) {
      logWebhookEvent('warn', 'missing_tenant_metadata', {
        gateway: 'flutterwave',
        durationMs: Date.now() - receivedAt,
      });
      return res
        .status(400)
        .json({ success: false, message: 'Missing tenantId in metadata' });
    }

    const settings = await getTenantPaymentSettings(tenantId);
    const flutterwaveSecret =
      settings.flutterwaveSecretKey || process.env.FLUTTERWAVE_SECRET_KEY;

    if (!flutterwaveSecret) {
      logWebhookEvent('error', 'missing_flutterwave_secret', {
        gateway: 'flutterwave',
        tenantId,
      });
      return res.status(500).json({
        success: false,
        message: 'Flutterwave secret key not configured for tenant',
      });
    }

    const computedHash = crypto
      .createHmac('sha256', flutterwaveSecret)
      .update(rawBody)
      .digest('hex');

    if (computedHash !== signatureHeader) {
      logWebhookEvent('warn', 'signature_mismatch', {
        gateway: 'flutterwave',
        tenantId,
        durationMs: Date.now() - receivedAt,
      });
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const reference =
      payload?.data?.tx_ref || payload?.data?.meta?.reference || payload?.data?.reference;

    if (!reference) {
      return res
        .status(400)
        .json({ success: false, message: 'Missing payment reference' });
    }

    try {
      const result = await reconcileCheckoutIntent({
        gateway: 'flutterwave',
        reference,
        tenantId,
      });

      return res.json({ success: true, ...result });
    } catch (error: any) {
      logWebhookEvent('error', 'flutterwave_webhook_error', {
        tenantId,
        reference,
        message: error?.message,
        durationMs: Date.now() - receivedAt,
      });
      return res.status(500).json({
        success: false,
        message: error?.message || 'Failed to process webhook',
      });
    }
  }
);

export { publicPaymentsRouter };
