import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';

export const wagePlanRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializePlan = (p: any) => ({
  ...p,
  amount: toNumber(p.amount),
});

const planSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  payType: z.enum(['hourly', 'daily', 'weekly', 'monthly', 'salary']).optional(),
  amount: z.number().nonnegative(),
  currency: z.string().optional(),
  payFrequency: z.enum(['weekly', 'biweekly', 'monthly']).optional(),
  isActive: z.boolean().optional(),
});

const managerRoles = ['owner', 'general_manager', 'iitech_admin'];
const requireManager = (req: AuthRequest) => {
  if (!req.user || !managerRoles.includes(req.user.role)) {
    throw new AppError('Only owners and managers can manage wage plans', 403);
  }
};

// GET /api/tenants/:tenantId/wage-plans
wagePlanRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { isActive } = req.query;

      const where: any = { tenantId };
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const plans = await prisma.wagePlan.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      // Attach assigned staff counts/names via permissions wagePlanId marker
      const users = await prisma.user.findMany({
        where: { tenantId, isActive: true },
        select: { id: true, firstName: true, lastName: true, permissions: true, role: true },
      });

      const data = plans.map((p) => {
        const assignedStaff = users.filter(
          (u) => (u.permissions as any)?.wagePlanId === p.id
        );
        return {
          ...serializePlan(p),
          assignedStaff: assignedStaff.map((u) => ({
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
          })),
          assignedCount: assignedStaff.length,
        };
      });

      res.json({ success: true, data });
    } catch (error: any) {
      throw new AppError(`Failed to fetch wage plans: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/wage-plans
wagePlanRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      requireManager(req);
      const data = planSchema.parse(req.body);

      const existing = await prisma.wagePlan.findUnique({
        where: { tenantId_name: { tenantId, name: data.name } },
      });
      if (existing) throw new AppError('A wage plan with this name already exists', 409);

      const plan = await prisma.wagePlan.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description ?? null,
          payType: data.payType || 'monthly',
          amount: data.amount,
          currency: data.currency || 'NGN',
          payFrequency: data.payFrequency || 'monthly',
          isActive: data.isActive ?? true,
          createdBy: req.user!.id,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_wage_plan',
        entityType: 'wage_plan',
        entityId: plan.id,
        afterState: serializePlan(plan),
      });

      res.status(201).json({ success: true, data: serializePlan(plan) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create wage plan: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/wage-plans/:id
wagePlanRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      requireManager(req);

      const plan = await prisma.wagePlan.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!plan) throw new AppError('Wage plan not found', 404);

      const data = planSchema.partial().parse(req.body);
      const updated = await prisma.wagePlan.update({
        where: { id: plan.id },
        data,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_wage_plan',
        entityType: 'wage_plan',
        entityId: plan.id,
        beforeState: serializePlan(plan),
        afterState: serializePlan(updated),
      });

      res.json({ success: true, data: serializePlan(updated) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update wage plan: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/wage-plans/:id
wagePlanRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      requireManager(req);

      const plan = await prisma.wagePlan.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!plan) throw new AppError('Wage plan not found', 404);

      // Unassign staff on this plan
      const assigned = await prisma.user.findMany({
        where: { tenantId },
        select: { id: true, permissions: true },
      });
      for (const u of assigned) {
        if ((u.permissions as any)?.wagePlanId === plan.id) {
          const { wagePlanId, ...rest } = (u.permissions as any) || {};
          await prisma.user.update({
            where: { id: u.id },
            data: { permissions: rest },
          });
        }
      }

      await prisma.wagePlan.delete({ where: { id: plan.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_wage_plan',
        entityType: 'wage_plan',
        entityId: plan.id,
        beforeState: serializePlan(plan),
      });

      res.json({ success: true, message: 'Wage plan deleted' });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete wage plan: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/wage-plans/:id/assign-to-staff/:userId
wagePlanRouter.post(
  '/:id/assign-to-staff/:userId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      requireManager(req);

      const plan = await prisma.wagePlan.findFirst({
        where: { id: req.params.id, tenantId, isActive: true },
      });
      if (!plan) throw new AppError('Wage plan not found or inactive', 404);

      const user = await prisma.user.findFirst({
        where: { id: req.params.userId, tenantId },
      });
      if (!user) throw new AppError('Staff member not found', 404);

      const permissions = { ...((user.permissions as any) || {}), wagePlanId: plan.id };
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { permissions },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
          permissions: true,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'assign_wage_plan',
        entityType: 'user',
        entityId: user.id,
        afterState: { wagePlanId: plan.id, wagePlanName: plan.name },
      });

      res.json({ success: true, data: { user: updated, wagePlan: serializePlan(plan) } });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to assign wage plan: ${error.message}`, 500);
    }
  }
);
