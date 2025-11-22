import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate, toTimestamp } from '../utils/firestore';

export const folioRouter = Router({ mergeParams: true });

const addChargeSchema = z.object({
  description: z.string().min(1),
  category: z.enum(['room_rate', 'extra', 'tax', 'discount', 'other']),
  amount: z.number(),
  quantity: z.number().int().min(1).default(1),
  taxRate: z.number().nonnegative().optional(),
});

// GET /api/tenants/:tenantId/folios/:id
folioRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const folioId = req.params.id;

      const folioDoc = await db.collection('folios').doc(folioId).get();

      if (!folioDoc.exists) {
        throw new AppError('Folio not found', 404);
      }

      const folioData = folioDoc.data();
      if (folioData?.tenantId !== tenantId) {
        throw new AppError('Folio not found', 404);
      }

      // Get related data
      const [roomDoc, reservationDoc, creatorDoc, chargesSnapshot, paymentsSnapshot] = await Promise.all([
        folioData.roomId ? db.collection('rooms').doc(folioData.roomId).get() : Promise.resolve(null),
        folioData.reservationId ? db.collection('reservations').doc(folioData.reservationId).get() : Promise.resolve(null),
        folioData.createdBy ? db.collection('users').doc(folioData.createdBy).get() : Promise.resolve(null),
        db.collection('folioCharges').where('folioId', '==', folioId).orderBy('createdAt', 'asc').get(),
        db.collection('payments').where('folioId', '==', folioId).orderBy('createdAt', 'asc').get(),
      ]);

      const room = roomDoc?.exists ? {
        id: roomDoc.id,
        ...roomDoc.data(),
      } : null;

      const reservation = reservationDoc?.exists ? {
        id: reservationDoc.id,
        ...reservationDoc.data(),
        checkInDate: toDate(reservationDoc.data()?.checkInDate),
        checkOutDate: toDate(reservationDoc.data()?.checkOutDate),
      } : null;

      const creator: { id: string; firstName: any; lastName: any } | null = creatorDoc?.exists ? {
        id: creatorDoc.id,
        firstName: creatorDoc.data()?.firstName || null,
        lastName: creatorDoc.data()?.lastName || null,
      } : null;

      // Get charges
      const charges = chargesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: toDate(doc.data().createdAt),
      }));

      // Get payments with user data
      const payments = await Promise.all(
        paymentsSnapshot.docs.map(async (doc) => {
          const paymentData = doc.data();
          let user: { id: string; firstName: any; lastName: any } | null = null;
          if (paymentData.processedBy) {
            const userDoc = await db.collection('users').doc(paymentData.processedBy).get();
            if (userDoc.exists) {
              user = {
                id: userDoc.id,
                firstName: userDoc.data()?.firstName || null,
                lastName: userDoc.data()?.lastName || null,
              };
            }
          }

          return {
            id: doc.id,
            ...paymentData,
            user,
            createdAt: toDate(paymentData.createdAt),
          };
        })
      );

      const folio = {
        id: folioDoc.id,
        ...folioData,
        room,
        reservation,
        creator,
        charges,
        payments,
        createdAt: toDate(folioData?.createdAt),
        updatedAt: toDate(folioData?.updatedAt),
        closedAt: toDate(folioData?.closedAt),
      };

      res.json({
        success: true,
        data: folio,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching folio:', error);
      throw new AppError(
        `Failed to fetch folio: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/folios
folioRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, roomId, reservationId, startDate, endDate } = req.query;

      const { page, limit } = getPaginationParams(req);

      // Build Firestore query
      let query: FirebaseFirestore.Query = db.collection('folios')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }
      if (roomId) {
        query = query.where('roomId', '==', roomId);
      }
      if (reservationId) {
        query = query.where('reservationId', '==', reservationId);
      }

      // Get all folios first (for date filtering)
      const allFoliosSnapshot = await query.get();

      // Filter by date range if provided
      let filteredFolios = allFoliosSnapshot.docs;
      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : null;
        const end = endDate ? new Date(endDate as string) : null;

        filteredFolios = filteredFolios.filter(doc => {
          const folioData = doc.data();
          const createdAt = toDate(folioData.createdAt);
          if (!createdAt) return false;

          if (start && createdAt < start) return false;
          if (end && createdAt > end) return false;

          return true;
        });
      }

      const total = filteredFolios.length;

      // Apply pagination and sorting
      const skip = (page - 1) * limit;
      const paginatedFolios = filteredFolios
        .sort((a, b) => {
          const aCreated = toDate(a.data().createdAt);
          const bCreated = toDate(b.data().createdAt);
          if (!aCreated || !bCreated) return 0;
          return bCreated.getTime() - aCreated.getTime(); // Descending
        })
        .slice(skip, skip + limit);

      // Enrich with room data
      const folios = await Promise.all(
        paginatedFolios.map(async (doc) => {
          const folioData = doc.data();
          let room: { id: string; roomNumber: any } | null = null;
          if (folioData.roomId) {
            const roomDoc = await db.collection('rooms').doc(folioData.roomId).get();
            if (roomDoc.exists) {
              room = {
                id: roomDoc.id,
                roomNumber: roomDoc.data()?.roomNumber || null,
              };
            }
          }

          return {
            id: doc.id,
            ...folioData,
            room,
            createdAt: toDate(folioData.createdAt),
            updatedAt: toDate(folioData.updatedAt),
            closedAt: toDate(folioData.closedAt),
          };
        })
      );

      const result = createPaginationResult(folios, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching folios:', error);
      throw new AppError(
        `Failed to fetch folios: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/folios/:id/charges
folioRouter.post(
  '/:id/charges',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const folioId = req.params.id;
      const data = addChargeSchema.parse(req.body);

      const folioDoc = await db.collection('folios').doc(folioId).get();

      if (!folioDoc.exists) {
        throw new AppError('Folio not found', 404);
      }

      const folioData = folioDoc.data();
      if (folioData?.tenantId !== tenantId) {
        throw new AppError('Folio not found', 404);
      }

      if (folioData.status !== 'open') {
        throw new AppError('Cannot add charges to closed or voided folio', 400);
      }

      const total = data.amount * data.quantity;
      const taxAmount = data.taxRate ? (total * data.taxRate) / 100 : null;
      const finalTotal = total + (taxAmount || 0);

      // Use Firestore batch for atomic operations
      const batch = db.batch();

      // Create charge
      const chargeRef = db.collection('folioCharges').doc();
      batch.set(chargeRef, {
        folioId,
        description: data.description,
        category: data.category,
        amount: data.amount,
        quantity: data.quantity,
        total: finalTotal,
        taxRate: data.taxRate || null,
        taxAmount: taxAmount || null,
        createdAt: now(),
      });

      // Update folio totals
      const currentTotalCharges = Number(folioData.totalCharges || 0);
      const currentBalance = Number(folioData.balance || 0);

      batch.update(folioDoc.ref, {
        totalCharges: currentTotalCharges + finalTotal,
        balance: currentBalance + finalTotal,
        updatedAt: now(),
      });

      await batch.commit();

      // Get created charge
      const chargeDoc = await chargeRef.get();
      const charge = {
        id: chargeDoc.id,
        ...chargeDoc.data(),
        createdAt: toDate(chargeDoc.data()?.createdAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'add_folio_charge',
        entityType: 'folio',
        entityId: folioId,
        afterState: charge,
      });

      res.status(201).json({
        success: true,
        data: charge,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error adding folio charge:', error);
      throw new AppError(
        `Failed to add folio charge: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/folios/:id/void
folioRouter.post(
  '/:id/void',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager', 'accountant'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const folioId = req.params.id;
      const { reason } = req.body;

      const folioDoc = await db.collection('folios').doc(folioId).get();

      if (!folioDoc.exists) {
        throw new AppError('Folio not found', 404);
      }

      const folioData = folioDoc.data();
      if (folioData?.tenantId !== tenantId) {
        throw new AppError('Folio not found', 404);
      }

      const beforeState = {
        id: folioDoc.id,
        ...folioData,
        createdAt: toDate(folioData?.createdAt),
        updatedAt: toDate(folioData?.updatedAt),
      };

      // Update folio status
      await folioDoc.ref.update({
        status: 'voided',
        updatedAt: now(),
      });

      // Get updated folio
      const updatedDoc = await db.collection('folios').doc(folioId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
        closedAt: toDate(updatedData?.closedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'void_folio',
        entityType: 'folio',
        entityId: folioId,
        beforeState,
        afterState: updated,
        metadata: { reason },
      });

      res.json({
        success: true,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error voiding folio:', error);
      throw new AppError(
        `Failed to void folio: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);
