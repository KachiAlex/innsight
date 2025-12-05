import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { db, now, toDate } from '../utils/firestore';

export const wagePlanRouter = Router({ mergeParams: true });

const roleClassifications = ['normal_staff', 'supervisor', 'manager', 'senior_executive'] as const;
const wageTypes = ['hourly', 'daily', 'weekly', 'monthly', 'annual'] as const;

const createWagePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  roleClassification: z.enum(roleClassifications),
  role: z.string().optional(), // Specific role (e.g., 'chef', 'housekeeper') - optional for general plans
  wageType: z.enum(wageTypes),
  baseAmount: z.number().positive(),
  currency: z.string().min(3).max(3).default('NGN'),
  overtimeRate: z.number().min(0).optional(), // Multiplier for overtime (e.g., 1.5 for 1.5x)
  benefits: z.array(z.string()).optional(), // Array of benefit descriptions
  isActive: z.boolean().default(true),
});

const updateWagePlanSchema = createWagePlanSchema.partial();

// GET /api/tenants/:tenantId/wage-plans
wagePlanRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { roleClassification, role, isActive } = req.query;

      let query: FirebaseFirestore.Query = db.collection('wagePlans')
        .where('tenantId', '==', tenantId);

      if (roleClassification) {
        query = query.where('roleClassification', '==', roleClassification);
      }

      if (role) {
        query = query.where('role', '==', role);
      }

      if (isActive !== undefined) {
        query = query.where('isActive', '==', isActive === 'true');
      }

      const snapshot = await query.get();
      const wagePlans = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          description: data.description || null,
          roleClassification: data.roleClassification,
          role: data.role || null,
          wageType: data.wageType,
          baseAmount: Number(data.baseAmount || 0),
          currency: data.currency || 'NGN',
          overtimeRate: data.overtimeRate ? Number(data.overtimeRate) : null,
          benefits: data.benefits || [],
          isActive: data.isActive !== undefined ? data.isActive : true,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
        };
      });

      res.json({
        success: true,
        data: wagePlans,
      });
    } catch (error: any) {
      console.error('Error fetching wage plans:', error);
      throw new AppError(
        `Failed to fetch wage plans: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// GET /api/tenants/:tenantId/wage-plans/:id
wagePlanRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const wagePlanId = req.params.id;

      const wagePlanDoc = await db.collection('wagePlans').doc(wagePlanId).get();

      if (!wagePlanDoc.exists) {
        throw new AppError('Wage plan not found', 404);
      }

      const wagePlanData = wagePlanDoc.data();
      if (wagePlanData?.tenantId !== tenantId) {
        throw new AppError('Wage plan not found', 404);
      }

      const wagePlan = {
        id: wagePlanDoc.id,
        name: wagePlanData.name,
        description: wagePlanData.description || null,
        roleClassification: wagePlanData.roleClassification,
        role: wagePlanData.role || null,
        wageType: wagePlanData.wageType,
        baseAmount: Number(wagePlanData.baseAmount || 0),
        currency: wagePlanData.currency || 'NGN',
        overtimeRate: wagePlanData.overtimeRate ? Number(wagePlanData.overtimeRate) : null,
        benefits: wagePlanData.benefits || [],
        isActive: wagePlanData.isActive !== undefined ? wagePlanData.isActive : true,
        createdAt: toDate(wagePlanData.createdAt),
        updatedAt: toDate(wagePlanData.updatedAt),
      };

      res.json({
        success: true,
        data: wagePlan,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching wage plan:', error);
      throw new AppError(
        `Failed to fetch wage plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/wage-plans
wagePlanRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = createWagePlanSchema.parse(req.body);

      // Check if wage plan name already exists for this classification/role combination
      let query: FirebaseFirestore.Query = db.collection('wagePlans')
        .where('tenantId', '==', tenantId)
        .where('name', '==', data.name)
        .where('roleClassification', '==', data.roleClassification);

      if (data.role) {
        query = query.where('role', '==', data.role);
      } else {
        query = query.where('role', '==', null);
      }

      const existingSnapshot = await query.limit(1).get();

      if (!existingSnapshot.empty) {
        throw new AppError('Wage plan with this name already exists for this role classification', 400);
      }

      // Create wage plan
      const wagePlanRef = db.collection('wagePlans').doc();
      const wagePlanData = {
        tenantId,
        name: data.name,
        description: data.description || null,
        roleClassification: data.roleClassification,
        role: data.role || null,
        wageType: data.wageType,
        baseAmount: data.baseAmount,
        currency: data.currency || 'NGN',
        overtimeRate: data.overtimeRate || null,
        benefits: data.benefits || [],
        isActive: data.isActive !== undefined ? data.isActive : true,
        createdAt: now(),
        updatedAt: now(),
      };

      await wagePlanRef.set(wagePlanData);

      const wagePlan = {
        id: wagePlanRef.id,
        ...wagePlanData,
        baseAmount: Number(wagePlanData.baseAmount),
        overtimeRate: wagePlanData.overtimeRate ? Number(wagePlanData.overtimeRate) : null,
        createdAt: toDate(wagePlanData.createdAt),
        updatedAt: toDate(wagePlanData.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_wage_plan',
        entityType: 'wage_plan',
        entityId: wagePlanRef.id,
        afterState: wagePlan,
      });

      res.status(201).json({
        success: true,
        data: wagePlan,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating wage plan:', error);
      throw new AppError(
        `Failed to create wage plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// PATCH /api/tenants/:tenantId/wage-plans/:id
wagePlanRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const wagePlanId = req.params.id;
      const data = updateWagePlanSchema.parse(req.body);

      const wagePlanDoc = await db.collection('wagePlans').doc(wagePlanId).get();

      if (!wagePlanDoc.exists) {
        throw new AppError('Wage plan not found', 404);
      }

      const wagePlanData = wagePlanDoc.data();
      if (wagePlanData?.tenantId !== tenantId) {
        throw new AppError('Wage plan not found', 404);
      }

      // Check name uniqueness if name is being updated
      if (data.name && data.name !== wagePlanData.name) {
        const roleClassification = data.roleClassification || wagePlanData.roleClassification;
        const role = data.role !== undefined ? data.role : wagePlanData.role;

        let query: FirebaseFirestore.Query = db.collection('wagePlans')
          .where('tenantId', '==', tenantId)
          .where('name', '==', data.name)
          .where('roleClassification', '==', roleClassification);

        if (role) {
          query = query.where('role', '==', role);
        } else {
          query = query.where('role', '==', null);
        }

        const existingSnapshot = await query.limit(1).get();

        if (!existingSnapshot.empty) {
          throw new AppError('Wage plan with this name already exists for this role classification', 400);
        }
      }

      const beforeState = {
        id: wagePlanDoc.id,
        ...wagePlanData,
        baseAmount: Number(wagePlanData.baseAmount || 0),
        overtimeRate: wagePlanData.overtimeRate ? Number(wagePlanData.overtimeRate) : null,
        createdAt: toDate(wagePlanData.createdAt),
        updatedAt: toDate(wagePlanData.updatedAt),
      };

      // Update wage plan
      const updateData: any = {
        updatedAt: now(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.roleClassification !== undefined) updateData.roleClassification = data.roleClassification;
      if (data.role !== undefined) updateData.role = data.role || null;
      if (data.wageType !== undefined) updateData.wageType = data.wageType;
      if (data.baseAmount !== undefined) updateData.baseAmount = data.baseAmount;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.overtimeRate !== undefined) updateData.overtimeRate = data.overtimeRate || null;
      if (data.benefits !== undefined) updateData.benefits = data.benefits || [];
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      await wagePlanDoc.ref.update(updateData);

      // Get updated wage plan
      const updatedDoc = await db.collection('wagePlans').doc(wagePlanId).get();
      const updatedData = updatedDoc.data();

      const updated = {
        id: updatedDoc.id,
        ...updatedData,
        baseAmount: Number(updatedData?.baseAmount || 0),
        overtimeRate: updatedData?.overtimeRate ? Number(updatedData.overtimeRate) : null,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_wage_plan',
        entityType: 'wage_plan',
        entityId: wagePlanId,
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
      console.error('Error updating wage plan:', error);
      throw new AppError(
        `Failed to update wage plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// DELETE /api/tenants/:tenantId/wage-plans/:id
wagePlanRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const wagePlanId = req.params.id;

      const wagePlanDoc = await db.collection('wagePlans').doc(wagePlanId).get();

      if (!wagePlanDoc.exists) {
        throw new AppError('Wage plan not found', 404);
      }

      const wagePlanData = wagePlanDoc.data();
      if (wagePlanData?.tenantId !== tenantId) {
        throw new AppError('Wage plan not found', 404);
      }

      // Check if wage plan is assigned to any staff
      const staffSnapshot = await db.collection('users')
        .where('tenantId', '==', tenantId)
        .where('wagePlanId', '==', wagePlanId)
        .limit(1)
        .get();

      if (!staffSnapshot.empty) {
        throw new AppError('Cannot delete wage plan that is assigned to staff members', 400);
      }

      const beforeState = {
        id: wagePlanDoc.id,
        ...wagePlanData,
        baseAmount: Number(wagePlanData.baseAmount || 0),
        createdAt: toDate(wagePlanData.createdAt),
        updatedAt: toDate(wagePlanData.updatedAt),
      };

      await wagePlanDoc.ref.delete();

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_wage_plan',
        entityType: 'wage_plan',
        entityId: wagePlanId,
        beforeState,
        afterState: null,
      });

      res.json({
        success: true,
        message: 'Wage plan deleted successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error deleting wage plan:', error);
      throw new AppError(
        `Failed to delete wage plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// POST /api/tenants/:tenantId/wage-plans/:id/assign-to-staff/:staffId
wagePlanRouter.post(
  '/:id/assign-to-staff/:staffId',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const wagePlanId = req.params.id;
      const staffId = req.params.staffId;

      // Verify wage plan exists
      const wagePlanDoc = await db.collection('wagePlans').doc(wagePlanId).get();
      if (!wagePlanDoc.exists || wagePlanDoc.data()?.tenantId !== tenantId) {
        throw new AppError('Wage plan not found', 404);
      }

      // Verify staff exists
      const staffDoc = await db.collection('users').doc(staffId).get();
      if (!staffDoc.exists || staffDoc.data()?.tenantId !== tenantId || staffDoc.data()?.role === 'owner') {
        throw new AppError('Staff member not found', 404);
      }

      // Assign wage plan to staff
      await staffDoc.ref.update({
        wagePlanId,
        updatedAt: now(),
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'assign_wage_plan',
        entityType: 'user',
        entityId: staffId,
        afterState: { wagePlanId },
      });

      res.json({
        success: true,
        message: 'Wage plan assigned to staff member successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error assigning wage plan:', error);
      throw new AppError(
        `Failed to assign wage plan: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

