import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { db, now, toDate } from '../utils/firestore';
export const ratePlanRouter = Router({ mergeParams: true });

const createRatePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  baseRate: z.number().positive(),
  currency: z.string().default('NGN'),
  seasonalRules: z.any().optional(),
  isActive: z.boolean().default(true),
});

const updateRatePlanSchema = createRatePlanSchema.partial();

// GET /api/tenants/:tenantId/rate-plans
ratePlanRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { isActive } = req.query;

      let query: firestore.Query = db.collection('ratePlans')
        .where('tenantId', '==', tenantId);

      if (isActive !== undefined) {
        query = query.where('isActive', '==', isActive === 'true');
      }

      const snapshot = await query.get();
      const ratePlans = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        baseRate: Number(doc.data().baseRate || 0),
        createdAt: toDate(doc.data().createdAt),
        updatedAt: toDate(doc.data().updatedAt),
      }));

      res.json({
        success: true,
        data: ratePlans,
      });
    } catch (error: any) {
      console.error('Error fetching rate plans:', error);
      throw new AppError(
        `Failed to fetch rate plans: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/rate-plans/:id
ratePlanRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const ratePlanId = req.params.id;

      const ratePlanDoc = await db.collection('ratePlans').doc(ratePlanId).get();

      if (!ratePlanDoc.exists) {
        throw new AppError('Rate plan not found', 404);
      }

      const ratePlanData = ratePlanDoc.data();
      if (ratePlanData?.tenantId !== tenantId) {
        throw new AppError('Rate plan not found', 404);
      }

      // Get rooms using this rate plan
      const roomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .where('ratePlanId', '==', ratePlanId)
        .get();

      const ratePlan = {
        id: ratePlanDoc.id,
        ...ratePlanData,
        baseRate: Number(ratePlanData.baseRate || 0),
        roomCount: roomsSnapshot.size,
        createdAt: toDate(ratePlanData.createdAt),
        updatedAt: toDate(ratePlanData.updatedAt),
      };

      res.json({
        success: true,
        data: ratePlan,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching rate plan:', error);
      throw new AppError(
        `Failed to fetch rate plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/rate-plans
ratePlanRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createRatePlanSchema.parse(req.body);

      // Check if rate plan name already exists
      const existingSnapshot = await db.collection('ratePlans')
        .where('tenantId', '==', tenantId)
        .where('name', '==', data.name)
        .limit(1)
        .get();

      if (!existingSnapshot.empty) {
        throw new AppError('Rate plan name already exists', 400);
      }

      // Create rate plan
      const ratePlanRef = db.collection('ratePlans').doc();
      const ratePlanData = {
        tenantId,
        name: data.name,
        description: data.description || null,
        baseRate: data.baseRate,
        currency: data.currency || 'NGN',
        seasonalRules: data.seasonalRules || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now(),
        updatedAt: now(),
      };

      await ratePlanRef.set(ratePlanData);

      const ratePlan = {
        id: ratePlanRef.id,
        ...ratePlanData,
        baseRate: Number(ratePlanData.baseRate),
        createdAt: toDate(ratePlanData.createdAt),
        updatedAt: toDate(ratePlanData.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_rate_plan',
        entityType: 'rate_plan',
        entityId: ratePlanRef.id,
        afterState: ratePlan,
      });

      res.status(201).json({
        success: true,
        data: ratePlan,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating rate plan:', error);
      throw new AppError(
        `Failed to create rate plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// PATCH /api/tenants/:tenantId/rate-plans/:id
ratePlanRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const ratePlanId = req.params.id;
      const data = updateRatePlanSchema.parse(req.body);

      const ratePlanDoc = await db.collection('ratePlans').doc(ratePlanId).get();

      if (!ratePlanDoc.exists) {
        throw new AppError('Rate plan not found', 404);
      }

      const ratePlanData = ratePlanDoc.data();
      if (ratePlanData?.tenantId !== tenantId) {
        throw new AppError('Rate plan not found', 404);
      }

      // Check name uniqueness if name is being updated
      if (data.name && data.name !== ratePlanData.name) {
        const existingSnapshot = await db.collection('ratePlans')
          .where('tenantId', '==', tenantId)
          .where('name', '==', data.name)
          .limit(1)
          .get();

        if (!existingSnapshot.empty) {
          throw new AppError('Rate plan name already exists', 400);
        }
      }

      const beforeState = {
        id: ratePlanDoc.id,
        ...ratePlanData,
        baseRate: Number(ratePlanData.baseRate || 0),
        createdAt: toDate(ratePlanData.createdAt),
        updatedAt: toDate(ratePlanData.updatedAt),
      };

      // Update rate plan
      const updateData: any = {
        updatedAt: now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.baseRate !== undefined) updateData.baseRate = data.baseRate;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.seasonalRules !== undefined) updateData.seasonalRules = data.seasonalRules || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await ratePlanDoc.ref.update(updateData);

      // Get updated rate plan
      const updatedDoc = await db.collection('ratePlans').doc(ratePlanId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        baseRate: Number(updatedData?.baseRate || 0),
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_rate_plan',
        entityType: 'rate_plan',
        entityId: ratePlanId,
        beforeState,
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
      console.error('Error updating rate plan:', error);
      throw new AppError(
        `Failed to update rate plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// DELETE /api/tenants/:tenantId/rate-plans/:id
ratePlanRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const ratePlanId = req.params.id;

      const ratePlanDoc = await db.collection('ratePlans').doc(ratePlanId).get();

      if (!ratePlanDoc.exists) {
        throw new AppError('Rate plan not found', 404);
      }

      const ratePlanData = ratePlanDoc.data();
      if (ratePlanData?.tenantId !== tenantId) {
        throw new AppError('Rate plan not found', 404);
      }

      // Check if rate plan is in use
      const roomsSnapshot = await db.collection('rooms')
        .where('tenantId', '==', tenantId)
        .where('ratePlanId', '==', ratePlanId)
        .limit(1)
        .get();

      if (!roomsSnapshot.empty) {
        throw new AppError('Cannot delete rate plan that is assigned to rooms', 400);
      }

      const beforeState = {
        id: ratePlanDoc.id,
        ...ratePlanData,
        baseRate: Number(ratePlanData.baseRate || 0),
        createdAt: toDate(ratePlanData.createdAt),
        updatedAt: toDate(ratePlanData.updatedAt),
      };

      await ratePlanDoc.ref.delete();

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_rate_plan',
        entityType: 'rate_plan',
        entityId: ratePlanId,
        beforeState,
        afterState: null,
      });

      res.json({
        success: true,
        message: 'Rate plan deleted successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting rate plan:', error);
      throw new AppError(
        `Failed to delete rate plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

