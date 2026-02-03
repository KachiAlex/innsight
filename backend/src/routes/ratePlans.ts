import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';

export const ratePlanRouter = Router({ mergeParams: true });

const createRatePlanSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  baseRate: z.number().positive(),
  currency: z.string().default('NGN'),
  seasonalRules: z.any().optional(),
  isActive: z.boolean().default(true),
  categoryId: z.string().optional(),
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
      const { isActive, categoryId } = req.query;

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Build where clause
      const where: any = { tenantId };

      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      if (categoryId !== undefined) {
        if (categoryId === 'none' || categoryId === 'null') {
          where.categoryId = null;
        } else {
          where.categoryId = categoryId;
        }
      }

      const ratePlans = await prisma.ratePlan.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
        orderBy: {
          name: 'asc',
        },
      });

      // Transform to match expected format
      const transformedRatePlans = ratePlans.map(rp => ({
        id: rp.id,
        name: rp.name,
        description: rp.description,
        baseRate: Number(rp.baseRate),
        currency: rp.currency,
        seasonalRules: rp.seasonalRules,
        isActive: rp.isActive,
        categoryId: rp.categoryId,
        category: rp.category,
        createdAt: rp.createdAt,
        updatedAt: rp.updatedAt,
      }));

      res.json({
        success: true,
        data: transformedRatePlans,
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

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const ratePlan = await prisma.ratePlan.findUnique({
        where: { id: ratePlanId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          rooms: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!ratePlan || ratePlan.tenantId !== tenantId) {
        throw new AppError('Rate plan not found', 404);
      }

      const transformedRatePlan = {
        id: ratePlan.id,
        name: ratePlan.name,
        description: ratePlan.description,
        baseRate: Number(ratePlan.baseRate),
        currency: ratePlan.currency,
        seasonalRules: ratePlan.seasonalRules,
        isActive: ratePlan.isActive,
        categoryId: ratePlan.categoryId,
        category: ratePlan.category,
        roomCount: ratePlan.rooms.length,
        createdAt: ratePlan.createdAt,
        updatedAt: ratePlan.updatedAt,
      };

      res.json({
        success: true,
        data: transformedRatePlan,
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

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Check if rate plan name already exists
      const existing = await prisma.ratePlan.findFirst({
        where: {
          tenantId,
          name: data.name,
        },
      });

      if (existing) {
        throw new AppError('Rate plan name already exists', 400);
      }

      // Validate category if provided
      if (data.categoryId) {
        const category = await prisma.roomCategory.findUnique({
          where: { id: data.categoryId },
        });
        
        if (!category || category.tenantId !== tenantId) {
          throw new AppError('Invalid category', 400);
        }
      }

      // Create rate plan
      const ratePlan = await prisma.ratePlan.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description,
          baseRate: data.baseRate,
          currency: data.currency || 'NGN',
          seasonalRules: data.seasonalRules,
          isActive: data.isActive !== undefined ? data.isActive : true,
          categoryId: data.categoryId,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      const transformedRatePlan = {
        id: ratePlan.id,
        name: ratePlan.name,
        description: ratePlan.description,
        baseRate: Number(ratePlan.baseRate),
        currency: ratePlan.currency,
        seasonalRules: ratePlan.seasonalRules,
        isActive: ratePlan.isActive,
        categoryId: ratePlan.categoryId,
        category: ratePlan.category,
        createdAt: ratePlan.createdAt,
        updatedAt: ratePlan.updatedAt,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_rate_plan',
        entityType: 'rate_plan',
        entityId: ratePlan.id,
        afterState: transformedRatePlan,
      });

      res.status(201).json({
        success: true,
        data: transformedRatePlan,
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

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      // Get existing rate plan
      const existing = await prisma.ratePlan.findUnique({
        where: { id: ratePlanId },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      if (!existing || existing.tenantId !== tenantId) {
        throw new AppError('Rate plan not found', 404);
      }

      // Check name uniqueness if name is being updated
      if (data.name && data.name !== existing.name) {
        const duplicate = await prisma.ratePlan.findFirst({
          where: {
            tenantId,
            name: data.name,
            id: { not: ratePlanId },
          },
        });

        if (duplicate) {
          throw new AppError('Rate plan name already exists', 400);
        }
      }

      // Validate category if being updated
      if (data.categoryId !== undefined) {
        if (data.categoryId) {
          const category = await prisma.roomCategory.findUnique({
            where: { id: data.categoryId },
          });
          
          if (!category || category.tenantId !== tenantId) {
            throw new AppError('Invalid category', 400);
          }
        }
      }

      const beforeState = {
        id: existing.id,
        name: existing.name,
        description: existing.description,
        baseRate: Number(existing.baseRate),
        currency: existing.currency,
        seasonalRules: existing.seasonalRules,
        isActive: existing.isActive,
        categoryId: existing.categoryId,
        category: existing.category,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };

      // Update rate plan
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.baseRate !== undefined) updateData.baseRate = data.baseRate;
      if (data.currency !== undefined) updateData.currency = data.currency;
      if (data.seasonalRules !== undefined) updateData.seasonalRules = data.seasonalRules;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;

      const updated = await prisma.ratePlan.update({
        where: { id: ratePlanId },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      });

      const afterState = {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        baseRate: Number(updated.baseRate),
        currency: updated.currency,
        seasonalRules: updated.seasonalRules,
        isActive: updated.isActive,
        categoryId: updated.categoryId,
        category: updated.category,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_rate_plan',
        entityType: 'rate_plan',
        entityId: ratePlanId,
        beforeState,
        afterState,
      });

      res.json({
        success: true,
        data: afterState,
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

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const ratePlan = await prisma.ratePlan.findUnique({
        where: { id: ratePlanId },
        include: {
          rooms: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!ratePlan || ratePlan.tenantId !== tenantId) {
        throw new AppError('Rate plan not found', 404);
      }

      // Check if rate plan is in use
      if (ratePlan.rooms.length > 0) {
        throw new AppError('Cannot delete rate plan that is assigned to rooms', 400);
      }

      const beforeState = {
        id: ratePlan.id,
        name: ratePlan.name,
        description: ratePlan.description,
        baseRate: Number(ratePlan.baseRate),
        currency: ratePlan.currency,
        seasonalRules: ratePlan.seasonalRules,
        isActive: ratePlan.isActive,
        categoryId: ratePlan.categoryId,
        createdAt: ratePlan.createdAt,
        updatedAt: ratePlan.updatedAt,
      };

      await prisma.ratePlan.delete({
        where: { id: ratePlanId },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_rate_plan',
        entityType: 'rate_plan',
        entityId: ratePlanId,
        beforeState,
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

