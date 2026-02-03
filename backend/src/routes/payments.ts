import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate, toTimestamp } from '../utils/firestore';
import { 
  sendEmail, 
  generatePaymentReceiptEmail, 
  getTenantEmailSettings,
  type PaymentReceiptData,
} from '../utils/email';
import {
  paymentGatewayService,
  type PaymentGateway,
  type InitializePaymentParams,
} from '../utils/paymentGateway';
import {
  buildGatewayCredentialSet,
  getTenantPaymentSettings,
  upsertTenantPaymentSettings,
  type TenantPaymentSettings,
} from '../utils/publicPayments';
import { v4 as uuidv4 } from 'uuid';
// import admin from 'firebase-admin';
export const paymentRouter = Router({ mergeParams: true });

const createPaymentSchema = z.object({
  folioId: z.string().uuid(),
  amount: z.number().positive(),
  method: z.enum(['card', 'bank_transfer', 'cash', 'other']),
  reference: z.string().optional(),
  paymentGateway: z.enum(['paystack', 'flutterwave', 'stripe', 'manual']).optional(),
  gatewayTransactionId: z.string().optional(),
  notes: z.string().optional(),
});

const initializePaymentSchema = z.object({
  folioId: z.string().uuid(),
  gateway: z.enum(['paystack', 'flutterwave']),
  callbackUrl: z.string().url().optional(),
});

const verifyPaymentSchema = z.object({
  reference: z.string().min(1),
  gateway: z.enum(['paystack', 'flutterwave']),
});

const allowedGatewayValues = ['paystack', 'flutterwave', 'stripe', 'monnify'] as const;

const updateGatewaySettingsSchema = z
  .object({
    defaultGateway: z.enum(allowedGatewayValues).optional(),
    currency: z.string().min(3).max(3).optional(),
    callbackUrl: z.string().url().optional(),
    paystackPublicKey: z.string().min(10).optional(),
    paystackSecretKey: z.string().min(10).optional(),
    flutterwavePublicKey: z.string().min(10).optional(),
    flutterwaveSecretKey: z.string().min(10).optional(),
    monnifyApiKey: z.string().min(8).optional(),
    monnifySecretKey: z.string().min(8).optional(),
    monnifyContractCode: z.string().min(4).optional(),
    monnifyCollectionAccount: z.string().min(4).optional(),
    monnifyBaseUrl: z.string().url().optional(),
    stripePublicKey: z.string().min(10).optional(),
    stripeSecretKey: z.string().min(10).optional(),
    allowedGateways: z.array(z.enum(allowedGatewayValues)).min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one payment setting to update',
  });

const maskSecretFlag = (value?: string | null) => Boolean(value);

const assertGatewayCredentials = (settings: TenantPaymentSettings) => {
  const { defaultGateway } = settings;
  if (defaultGateway === 'paystack') {
    if (!settings.paystackPublicKey || !settings.paystackSecretKey) {
      throw new AppError(
        'Paystack is selected as default but missing public/secret keys. Provide both keys to continue.',
        400
      );
    }
  }

  if (defaultGateway === 'flutterwave') {
    if (!settings.flutterwavePublicKey || !settings.flutterwaveSecretKey) {
      throw new AppError(
        'Flutterwave is selected as default but missing public/secret keys. Provide both keys to continue.',
        400
      );
    }
  }

  if (defaultGateway === 'stripe') {
    if (!settings.stripePublicKey || !settings.stripeSecretKey) {
      throw new AppError(
        'Stripe is selected as default but missing publishable/secret keys. Provide both keys to continue.',
        400
      );
    }
  }

  if (defaultGateway === 'monnify') {
    if (
      !settings.monnifyApiKey ||
      !settings.monnifySecretKey ||
      !settings.monnifyContractCode ||
      !settings.monnifyCollectionAccount
    ) {
      throw new AppError(
        'Monnify is selected as default but missing API credentials. Provide API key, secret key, contract code, and collection account.',
        400
      );
    }
  }
};

const sanitizePaymentSettings = (settings: TenantPaymentSettings) => ({
  defaultGateway: settings.defaultGateway,
  currency: settings.currency,
  callbackUrl: settings.callbackUrl || null,
  allowedGateways: settings.allowedGateways,
  paystack: {
    publicKey: settings.paystackPublicKey || null,
    secretConfigured: maskSecretFlag(settings.paystackSecretKey),
  },
  flutterwave: {
    publicKey: settings.flutterwavePublicKey || null,
    secretConfigured: maskSecretFlag(settings.flutterwaveSecretKey),
  },
  monnify: {
    apiKeyConfigured: maskSecretFlag(settings.monnifyApiKey),
    secretConfigured: maskSecretFlag(settings.monnifySecretKey),
    contractCode: settings.monnifyContractCode || null,
    collectionAccount: settings.monnifyCollectionAccount || null,
    baseUrl: settings.monnifyBaseUrl || null,
  },
  stripe: {
    publicKey: settings.stripePublicKey || null,
    secretConfigured: maskSecretFlag(settings.stripeSecretKey),
  },
});

// GET /api/tenants/:tenantId/payments/gateway-settings
paymentRouter.get(
  '/gateway-settings',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const settings = await getTenantPaymentSettings(tenantId);

      res.json({
        success: true,
        data: sanitizePaymentSettings(settings),
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching gateway settings:', error);
      throw new AppError(
        `Failed to fetch gateway settings: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// PATCH /api/tenants/:tenantId/payments/gateway-settings
paymentRouter.patch(
  '/gateway-settings',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const updates = updateGatewaySettingsSchema.parse(req.body);

      const currentSettings = await getTenantPaymentSettings(tenantId);
      const mergedSettings: TenantPaymentSettings = {
        ...currentSettings,
        ...updates,
      };

      assertGatewayCredentials(mergedSettings);

      const updatedSettings = await upsertTenantPaymentSettings(tenantId, updates);

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_gateway_settings',
        entityType: 'payment_settings',
        entityId: tenantId,
        beforeState: sanitizePaymentSettings(currentSettings),
        afterState: sanitizePaymentSettings(updatedSettings),
      });

      res.json({
        success: true,
        data: sanitizePaymentSettings(updatedSettings),
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const message =
          error.errors?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') ||
          'Invalid gateway settings';
        throw new AppError(message, 400);
      }
      console.error('Error updating gateway settings:', error);
      throw new AppError(
        `Failed to update gateway settings: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/payments
paymentRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, method, reconciled, folioId, startDate, endDate } = req.query;

      const { page, limit } = getPaginationParams(req);

      // Build Firestore query
      let query: admin.firestore.Query = db.collection('payments')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }
      if (method) {
        query = query.where('method', '==', method);
      }
      if (reconciled !== undefined) {
        query = query.where('reconciled', '==', reconciled === 'true');
      }
      if (folioId) {
        query = query.where('folioId', '==', folioId);
      }

      // Get all payments first (for date filtering)
      const allPaymentsSnapshot = await query.get();

      // Filter by date range if provided
      let filteredPayments = allPaymentsSnapshot.docs;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : null;
        const end = endDate ? new Date(endDate as string) : null;

        filteredPayments = filteredPayments.filter(doc => {
          const paymentData = doc.data();
          const createdAt = toDate(paymentData.createdAt);
          if (!createdAt) return false;

          if (start && createdAt < start) return false;
          if (end && createdAt > end) return false;

          return true;
        });
      }

      const total = filteredPayments.length;

      // Apply pagination and sorting
      const skip = (page - 1) * limit;
      const paginatedPayments = filteredPayments
        .sort((a, b) => {
          const aCreated = toDate(a.data().createdAt);
          const bCreated = toDate(b.data().createdAt);
          if (!aCreated || !bCreated) return 0;
          return bCreated.getTime() - aCreated.getTime(); // Descending
        })
        .slice(skip, skip + limit);

      // Enrich with folio, room, and user data
      const payments = await Promise.all(
        paginatedPayments.map(async (doc) => {
          const paymentData = doc.data();
          
          // Get folio and room data
          let roomNumber = null;
          if (paymentData.folioId) {
            const folioDoc = await db.collection('folios').doc(paymentData.folioId).get();
            if (folioDoc.exists && folioDoc.data()?.roomId) {
              const roomDoc = await db.collection('rooms').doc(folioDoc.data()?.roomId).get();
              if (roomDoc.exists) {
                roomNumber = roomDoc.data()?.roomNumber || null;
              }
            }
          }

          // Get user data
          let user: { firstName: any; lastName: any } | null = null;
          if (paymentData.processedBy) {
            const userDoc = await db.collection('users').doc(paymentData.processedBy).get();
            if (userDoc.exists) {
              user = {
                firstName: userDoc.data()?.firstName || null,
                lastName: userDoc.data()?.lastName || null,
              };
            }
          }

          return {
            id: doc.id,
            ...paymentData,
            folio: paymentData.folioId ? {
              id: paymentData.folioId,
              room: roomNumber ? { roomNumber } : null,
            } : null,
            user,
            createdAt: toDate(paymentData.createdAt),
            reconciledAt: toDate(paymentData.reconciledAt),
          };
        })
      );

      const result = createPaginationResult(payments, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      throw new AppError(
        `Failed to fetch payments: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/payments
paymentRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createPaymentSchema.parse(req.body);

      const folioDoc = await db.collection('folios').doc(data.folioId).get();

      if (!folioDoc.exists) {
        throw new AppError('Folio not found', 404);
      }

      const folioData = folioDoc.data();
      if (folioData?.tenantId !== tenantId) {
        throw new AppError('Folio not found', 404);
      }

      if (folioData.status !== 'open') {
        throw new AppError('Cannot add payment to closed or voided folio', 400);
      }

      const paymentReference = data.reference || `PAY-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;

      // Use Firestore batch for atomic operations
      const batch = db.batch();

      // Create payment
      const paymentRef = db.collection('payments').doc();
      batch.set(paymentRef, {
        tenantId,
        folioId: data.folioId,
        amount: data.amount,
        method: data.method,
        reference: paymentReference,
        paymentGateway: data.paymentGateway || 'manual',
        gatewayTransactionId: data.gatewayTransactionId || null,
        notes: data.notes || null,
        processedBy: req.user!.id,
        status: 'completed',
        reconciled: false,
        createdAt: now(),
      });

      // Update folio
      const currentTotalPayments = Number(folioData.totalPayments || 0);
      const currentBalance = Number(folioData.balance || 0);

      batch.update(folioDoc.ref, {
        totalPayments: currentTotalPayments + data.amount,
        balance: currentBalance - data.amount,
        updatedAt: now(),
      });

      await batch.commit();

      // Get created payment
      const paymentDoc = await paymentRef.get();
      const payment = {
        id: paymentDoc.id,
        ...paymentDoc.data(),
        createdAt: toDate(paymentDoc.data()?.createdAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_payment',
        entityType: 'payment',
        entityId: paymentRef.id,
        afterState: payment,
        metadata: {
          folioId: data.folioId,
          reference: paymentReference,
        },
      });

      // Send payment receipt email asynchronously
      (async () => {
        try {
          const tenantSettings = await getTenantEmailSettings(tenantId);
          if (tenantSettings && folioData.guestName && folioData.guestEmail) {
            // Get reservation if exists
            let reservationNumber: string | undefined;
            if (folioData.reservationId) {
              const reservationDoc = await db.collection('reservations').doc(folioData.reservationId).get();
              if (reservationDoc.exists) {
                reservationNumber = reservationDoc.data()?.reservationNumber;
              }
            }

            const receiptData: PaymentReceiptData = {
              guestName: folioData.guestName,
              guestEmail: folioData.guestEmail,
              reservationNumber,
              paymentAmount: data.amount,
              paymentMethod: data.method,
              paymentDate: toDate(paymentDoc.data()?.createdAt)!,
              transactionId: paymentReference,
              propertyName: tenantSettings.propertyName,
              propertyAddress: tenantSettings.propertyAddress || undefined,
              propertyPhone: tenantSettings.propertyPhone || undefined,
              propertyEmail: tenantSettings.propertyEmail || undefined,
              description: data.notes || undefined,
            };

            const emailHtml = generatePaymentReceiptEmail(receiptData);
            await sendEmail({
              to: folioData.guestEmail,
              subject: `Payment Receipt - ${paymentReference}`,
              html: emailHtml,
            });
          }
        } catch (emailError) {
          console.error('Failed to send payment receipt email:', emailError);
          // Don't throw - email failure shouldn't fail the payment
        }
      })();

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating payment:', error);
      throw new AppError(
        `Failed to create payment: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/payments/reconcile
paymentRouter.get(
  '/reconcile',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate } = req.query;

      // Get unmatched payments
      const paymentsSnapshot = await db.collection('payments')
        .where('tenantId', '==', tenantId)
        .where('reconciled', '==', false)
        .get();

      // Filter by date range if provided
      let filteredPayments = paymentsSnapshot.docs;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : null;
        const end = endDate ? new Date(endDate as string) : null;

        filteredPayments = filteredPayments.filter(doc => {
          const paymentData = doc.data();
          const createdAt = toDate(paymentData.createdAt);
          if (!createdAt) return false;

          if (start && createdAt < start) return false;
          if (end && createdAt > end) return false;

          return true;
        });
      }

      // Sort and enrich with folio, room, and user data
      const unmatchedPayments = await Promise.all(
        filteredPayments
          .sort((a, b) => {
            const aCreated = toDate(a.data().createdAt);
            const bCreated = toDate(b.data().createdAt);
            if (!aCreated || !bCreated) return 0;
            return bCreated.getTime() - aCreated.getTime(); // Descending
          })
          .map(async (doc) => {
            const paymentData = doc.data();
            
            // Get folio and room data
            let roomNumber = null;
            if (paymentData.folioId) {
              const folioDoc = await db.collection('folios').doc(paymentData.folioId).get();
              if (folioDoc.exists && folioDoc.data()?.roomId) {
                const roomDoc = await db.collection('rooms').doc(folioDoc.data()?.roomId).get();
                if (roomDoc.exists) {
                  roomNumber = roomDoc.data()?.roomNumber || null;
                }
              }
            }

            // Get user data
            let user: { firstName: any; lastName: any } | null = null;
            if (paymentData.processedBy) {
              const userDoc = await db.collection('users').doc(paymentData.processedBy).get();
              if (userDoc.exists) {
                user = {
                  firstName: userDoc.data()?.firstName || null,
                  lastName: userDoc.data()?.lastName || null,
                };
              }
            }

            return {
              id: doc.id,
              ...paymentData,
              folio: paymentData.folioId ? {
                id: paymentData.folioId,
                room: roomNumber ? { roomNumber } : null,
              } : null,
              user,
              createdAt: toDate(paymentData.createdAt),
            };
          })
      );

      res.json({
        success: true,
        data: unmatchedPayments,
      });
    } catch (error: any) {
      console.error('Error fetching unmatched payments:', error);
      throw new AppError(
        `Failed to fetch unmatched payments: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/payments/:id/reconcile
paymentRouter.post(
  '/:id/reconcile',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const paymentId = req.params.id;

      const paymentDoc = await db.collection('payments').doc(paymentId).get();

      if (!paymentDoc.exists) {
        throw new AppError('Payment not found', 404);
      }

      const paymentData = paymentDoc.data();
      if (paymentData?.tenantId !== tenantId) {
        throw new AppError('Payment not found', 404);
      }

      // Update payment
      await paymentDoc.ref.update({
        reconciled: true,
        reconciledAt: now(),
        reconciledBy: req.user!.id,
      });

      // Get updated payment
      const updatedDoc = await db.collection('payments').doc(paymentId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        createdAt: toDate(updatedData?.createdAt),
        reconciledAt: toDate(updatedData?.reconciledAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'reconcile_payment',
        entityType: 'payment',
        entityId: paymentId,
        afterState: updated,
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error reconciling payment:', error);
      throw new AppError(
        `Failed to reconcile payment: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/payments/initialize
paymentRouter.post(
  '/initialize',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = initializePaymentSchema.parse(req.body);

      // Get folio
      const folioDoc = await db.collection('folios').doc(data.folioId).get();
      if (!folioDoc.exists) {
        throw new AppError('Folio not found', 404);
      }

      const folioData = folioDoc.data();
      if (folioData?.tenantId !== tenantId) {
        throw new AppError('Folio not found', 404);
      }

      if (folioData.status !== 'open') {
        throw new AppError('Cannot initialize payment for closed or voided folio', 400);
      }

      // Check if gateway is configured
      if (!paymentGatewayService.isGatewayConfigured(data.gateway)) {
        throw new AppError(`${data.gateway} is not configured. Please set the required environment variables.`, 400);
      }

      // Calculate amount to pay (balance or specified amount)
      const balance = Number(folioData.balance || 0);
      if (balance <= 0) {
        throw new AppError('Folio has no outstanding balance', 400);
      }

      // Get guest email from reservation or folio
      let guestEmail = folioData.guestEmail;
      let guestName = folioData.guestName;
      let guestPhone = folioData.guestPhone;

      if (!guestEmail && folioData.reservationId) {
        const reservationDoc = await db.collection('reservations').doc(folioData.reservationId).get();
        if (reservationDoc.exists) {
          const resData = reservationDoc.data();
          guestEmail = resData?.guestEmail || guestEmail;
          guestName = resData?.guestName || guestName;
          guestPhone = resData?.guestPhone || guestPhone;
        }
      }

      if (!guestEmail) {
        throw new AppError('Guest email is required for gateway payment', 400);
      }

      // Initialize payment with gateway
      const amountInKobo = Math.round(balance * 100); // Convert to smallest currency unit (kobo for NGN)

      const initParams: InitializePaymentParams = {
        gateway: data.gateway,
        amount: amountInKobo,
        email: guestEmail,
        metadata: {
          tenantId,
          folioId: data.folioId,
          reservationId: folioData.reservationId || null,
          guestName: guestName || null,
        },
        callbackUrl: data.callbackUrl,
        currency: 'NGN',
        customerName: guestName || undefined,
        customerPhone: guestPhone || undefined,
      };

      const paymentInit = await paymentGatewayService.initializePayment(initParams);

      // Store pending payment record
      const pendingPaymentRef = db.collection('payments').doc();
      await pendingPaymentRef.set({
        tenantId,
        folioId: data.folioId,
        amount: balance,
        method: 'card',
        reference: paymentInit.reference,
        paymentGateway: data.gateway,
        gatewayTransactionId: paymentInit.accessCode,
        status: 'pending',
        processedBy: req.user!.id,
        reconciled: false,
        createdAt: now(),
        updatedAt: now(),
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'initialize_gateway_payment',
        entityType: 'payment',
        entityId: pendingPaymentRef.id,
        afterState: {
          reference: paymentInit.reference,
          gateway: data.gateway,
          amount: balance,
        },
        metadata: {
          folioId: data.folioId,
          authorizationUrl: paymentInit.authorizationUrl,
        },
      });

      res.json({
        success: true,
        data: {
          authorizationUrl: paymentInit.authorizationUrl,
          reference: paymentInit.reference,
          gateway: paymentInit.gateway,
          amount: balance,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const message = error.errors?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') || 'Invalid payment initialization data';
        throw new AppError(message, 400);
      }
      console.error('Error initializing payment:', error);
      throw new AppError(
        `Failed to initialize payment: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/payments/verify
paymentRouter.post(
  '/verify',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = verifyPaymentSchema.parse(req.body);

      // Verify payment with gateway
      const verification = await paymentGatewayService.verifyPayment({
        gateway: data.gateway,
        reference: data.reference,
      });

      // Find pending payment by reference
      const paymentsSnapshot = await db.collection('payments')
        .where('tenantId', '==', tenantId)
        .where('reference', '==', data.reference)
        .limit(1)
        .get();

      if (paymentsSnapshot.empty) {
        throw new AppError('Payment record not found', 404);
      }

      const paymentDoc = paymentsSnapshot.docs[0];
      const paymentData = paymentDoc.data();

      // Get folio
      const folioDoc = await db.collection('folios').doc(paymentData.folioId).get();
      if (!folioDoc.exists) {
        throw new AppError('Folio not found', 404);
      }

      const folioData = folioDoc.data();
      if (folioData?.tenantId !== tenantId) {
        throw new AppError('Folio not found', 404);
      }

      const batch = db.batch();

      // Update payment status
      const paymentStatus = verification.status === 'success' ? 'completed' : verification.status === 'failed' ? 'failed' : 'pending';
      batch.update(paymentDoc.ref, {
        status: paymentStatus,
        gatewayTransactionId: verification.gatewayTransactionId,
        updatedAt: now(),
        ...(verification.paidAt && { paidAt: toTimestamp(verification.paidAt) }),
      });

      // If payment successful, update folio
      if (verification.status === 'success') {
        const currentTotalPayments = Number(folioData.totalPayments || 0);
        const currentBalance = Number(folioData.balance || 0);
        const paymentAmount = verification.amount / 100; // Convert from kobo to currency unit

        batch.update(folioDoc.ref, {
          totalPayments: currentTotalPayments + paymentAmount,
          balance: currentBalance - paymentAmount,
          updatedAt: now(),
        });
      }

      await batch.commit();

      // Get updated payment
      const updatedDoc = await db.collection('payments').doc(paymentDoc.id).get();
      const updated = {
        id: updatedDoc.id,
        ...updatedDoc.data(),
        createdAt: toDate(updatedDoc.data()?.createdAt),
        paidAt: toDate(updatedDoc.data()?.paidAt),
        updatedAt: toDate(updatedDoc.data()?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'verify_gateway_payment',
        entityType: 'payment',
        entityId: paymentDoc.id,
        afterState: updated,
        metadata: {
          verificationStatus: verification.status,
          gateway: data.gateway,
        },
      });

      // Send receipt email if payment successful
      if (verification.status === 'success' && folioData.guestEmail) {
        (async () => {
          try {
            const tenantSettings = await getTenantEmailSettings(tenantId);
            if (tenantSettings) {
              let reservationNumber: string | undefined;
              if (folioData.reservationId) {
                const reservationDoc = await db.collection('reservations').doc(folioData.reservationId).get();
                if (reservationDoc.exists) {
                  reservationNumber = reservationDoc.data()?.reservationNumber;
                }
              }

              const receiptData: PaymentReceiptData = {
                guestName: folioData.guestName || 'Guest',
                guestEmail: folioData.guestEmail,
                reservationNumber,
                paymentAmount: verification.amount / 100,
                paymentMethod: data.gateway,
                paymentDate: verification.paidAt || new Date(),
                transactionId: data.reference,
                propertyName: tenantSettings.propertyName,
                propertyAddress: tenantSettings.propertyAddress || undefined,
                propertyPhone: tenantSettings.propertyPhone || undefined,
                propertyEmail: tenantSettings.propertyEmail || undefined,
              };

              const emailHtml = generatePaymentReceiptEmail(receiptData);
              await sendEmail({
                to: folioData.guestEmail,
                subject: `Payment Receipt - ${data.reference}`,
                html: emailHtml,
              });
            }
          } catch (emailError) {
            console.error('Failed to send payment receipt email:', emailError);
          }
        })();
      }

      res.json({
        success: true,
        data: {
          payment: updated,
          verification: {
            status: verification.status,
            amount: verification.amount / 100,
            currency: verification.currency,
            reference: verification.reference,
            gateway: verification.gateway,
          },
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof z.ZodError) {
        const message = error.errors?.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(', ') || 'Invalid verification data';
        throw new AppError(message, 400);
      }
      console.error('Error verifying payment:', error);
      throw new AppError(
        `Failed to verify payment: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/payments/webhook/:gateway
// Webhook endpoint (no authentication required - uses gateway signature verification)
paymentRouter.post(
  '/webhook/:gateway',
  async (req, res): Promise<void> => {
    try {
      const gateway = req.params.gateway as PaymentGateway;
      const tenantId = req.body?.data?.metadata?.tenantId || req.body?.meta?.tenantId;

      if (!tenantId) {
        console.error('Webhook received without tenantId in metadata');
        res.status(400).json({ success: false, message: 'Missing tenantId in metadata' });
        return;
      }

      // Verify webhook signature (gateway-specific)
      // For production, implement proper signature verification
      // For now, we'll process the webhook and verify the payment

      let reference: string;
      if (gateway === 'paystack') {
        reference = req.body.data?.reference;
      } else if (gateway === 'flutterwave') {
        reference = req.body.data?.tx_ref;
      } else {
        res.status(400).json({ success: false, message: 'Unsupported gateway' });
        return;
      }

      if (!reference) {
        res.status(400).json({ success: false, message: 'Missing payment reference' });
        return;
      }

      // Verify payment
      const verification = await paymentGatewayService.verifyPayment({
        gateway,
        reference,
      });

      // Find and update payment
      const paymentsSnapshot = await db.collection('payments')
        .where('tenantId', '==', tenantId)
        .where('reference', '==', reference)
        .limit(1)
        .get();

      if (!paymentsSnapshot.empty) {
        const paymentDoc = paymentsSnapshot.docs[0];
        const paymentData = paymentDoc.data();

        // Get folio
        const folioDoc = await db.collection('folios').doc(paymentData.folioId).get();
        if (folioDoc.exists) {
          const folioData = folioDoc.data();
          const batch = db.batch();

          // Update payment
          const paymentStatus = verification.status === 'success' ? 'completed' : verification.status === 'failed' ? 'failed' : 'pending';
          batch.update(paymentDoc.ref, {
            status: paymentStatus,
            gatewayTransactionId: verification.gatewayTransactionId,
            updatedAt: now(),
            ...(verification.paidAt && { paidAt: toTimestamp(verification.paidAt) }),
          });

          // If payment successful, update folio
          if (verification.status === 'success' && paymentData.status !== 'completed') {
            const currentTotalPayments = Number(folioData?.totalPayments || 0);
            const currentBalance = Number(folioData?.balance || 0);
            const paymentAmount = verification.amount / 100;

            batch.update(folioDoc.ref, {
              totalPayments: currentTotalPayments + paymentAmount,
              balance: currentBalance - paymentAmount,
              updatedAt: now(),
            });
          }

          await batch.commit();

          // Send receipt email if payment successful
          if (verification.status === 'success' && folioData?.guestEmail && paymentData.status !== 'completed') {
            (async () => {
              try {
                const tenantSettings = await getTenantEmailSettings(tenantId);
                if (tenantSettings) {
                  let reservationNumber: string | undefined;
                  if (folioData.reservationId) {
                    const reservationDoc = await db.collection('reservations').doc(folioData.reservationId).get();
                    if (reservationDoc.exists) {
                      reservationNumber = reservationDoc.data()?.reservationNumber;
                    }
                  }

                  const receiptData: PaymentReceiptData = {
                    guestName: folioData.guestName || 'Guest',
                    guestEmail: folioData.guestEmail,
                    reservationNumber,
                    paymentAmount: verification.amount / 100,
                    paymentMethod: gateway,
                    paymentDate: verification.paidAt || new Date(),
                    transactionId: reference,
                    propertyName: tenantSettings.propertyName,
                    propertyAddress: tenantSettings.propertyAddress || undefined,
                    propertyPhone: tenantSettings.propertyPhone || undefined,
                    propertyEmail: tenantSettings.propertyEmail || undefined,
                  };

                  const emailHtml = generatePaymentReceiptEmail(receiptData);
                  await sendEmail({
                    to: folioData.guestEmail,
                    subject: `Payment Receipt - ${reference}`,
                    html: emailHtml,
                  });
                }
              } catch (emailError) {
                console.error('Failed to send payment receipt email:', emailError);
              }
            })();
          }
        }
      }

      // Return success to gateway
      res.json({ success: true });
    } catch (error: any) {
      console.error('Webhook processing error:', error);
      // Still return success to gateway to prevent retries
      res.json({ success: false, error: error.message });
    }
  }
);

// GET /api/tenants/:tenantId/payments/gateways
paymentRouter.get(
  '/gateways',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const settings = await getTenantPaymentSettings(tenantId);
      const availableGateways = paymentGatewayService.getAvailableGateways();
      const allowedSet = new Set(settings.allowedGateways || []);

      res.json({
        success: true,
        data: {
          gateways: availableGateways.map((gateway) => {
            const credentials = buildGatewayCredentialSet(settings, gateway);
            return {
              name: gateway,
              configured: paymentGatewayService.isGatewayConfigured(gateway, credentials),
              allowedForPublicCheckout: allowedSet.has(gateway),
            };
          }),
        },
      });
    } catch (error: any) {
      console.error('Error fetching available gateways:', error);
      throw new AppError(
        `Failed to fetch gateways: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);
