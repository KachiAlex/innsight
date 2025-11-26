import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate, toTimestamp } from '../utils/firestore';
import { v4 as uuidv4 } from 'uuid';
import admin from 'firebase-admin';
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
