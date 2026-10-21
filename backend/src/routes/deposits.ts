import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';

export const depositsRouter = Router({ mergeParams: true });
export const depositPoliciesRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializePolicy = (p: any) => ({
  ...p,
  depositValue: toNumber(p.depositValue),
  maxDepositAmount: toNumber(p.maxDepositAmount),
  minDepositAmount: toNumber(p.minDepositAmount),
  cancellationFee: toNumber(p.cancellationFee),
});

const policySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  appliesToAllRooms: z.boolean().optional(),
  roomCategoryIds: z.array(z.string()).optional(),
  ratePlanIds: z.array(z.string()).optional(),
  depositType: z.enum(['percentage', 'fixed', 'first_night']),
  depositValue: z.number().nonnegative(),
  maxDepositAmount: z.number().nonnegative().nullable().optional(),
  minDepositAmount: z.number().nonnegative().nullable().optional(),
  dueDaysBeforeCheckIn: z.number().int().min(0).default(0),
  refundableAfterDays: z.number().int().min(0).nullable().optional(),
  cancellationFee: z.number().nonnegative().nullable().optional(),
  requiresForWeekends: z.boolean().optional(),
  requiresForHolidays: z.boolean().optional(),
  requiresForPeakSeason: z.boolean().optional(),
});

// --- Deposit policies CRUD (mounted at /policies and /deposit-policies) ---

// GET /
depositPoliciesRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { isActive } = req.query;

      const where: any = { tenantId };
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const policies = await prisma.depositPolicy.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: policies.map(serializePolicy) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch deposit policies: ${error.message}`, 500);
    }
  }
);

// POST /
depositPoliciesRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = policySchema.parse(req.body);

      const existing = await prisma.depositPolicy.findUnique({
        where: { tenantId_name: { tenantId, name: data.name } },
      });
      if (existing) throw new AppError('A policy with this name already exists', 409);

      const policy = await prisma.depositPolicy.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description ?? null,
          isActive: data.isActive ?? true,
          appliesToAllRooms: data.appliesToAllRooms ?? true,
          roomCategoryIds: data.roomCategoryIds ?? [],
          ratePlanIds: data.ratePlanIds ?? [],
          depositType: data.depositType,
          depositValue: data.depositValue,
          maxDepositAmount: data.maxDepositAmount ?? null,
          minDepositAmount: data.minDepositAmount ?? null,
          dueDaysBeforeCheckIn: data.dueDaysBeforeCheckIn,
          refundableAfterDays: data.refundableAfterDays ?? null,
          cancellationFee: data.cancellationFee ?? null,
          requiresForWeekends: data.requiresForWeekends ?? false,
          requiresForHolidays: data.requiresForHolidays ?? false,
          requiresForPeakSeason: data.requiresForPeakSeason ?? false,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_deposit_policy',
        entityType: 'deposit_policy',
        entityId: policy.id,
        afterState: serializePolicy(policy),
      });

      res.status(201).json({ success: true, data: serializePolicy(policy) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create deposit policy: ${error.message}`, 500);
    }
  }
);

// PATCH /:id
depositPoliciesRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const policy = await prisma.depositPolicy.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!policy) throw new AppError('Policy not found', 404);

      const data = policySchema.partial().parse(req.body);
      const updated = await prisma.depositPolicy.update({
        where: { id: policy.id },
        data,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_deposit_policy',
        entityType: 'deposit_policy',
        entityId: policy.id,
        beforeState: serializePolicy(policy),
        afterState: serializePolicy(updated),
      });

      res.json({ success: true, data: serializePolicy(updated) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update deposit policy: ${error.message}`, 500);
    }
  }
);

// DELETE /:id
depositPoliciesRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const policy = await prisma.depositPolicy.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!policy) throw new AppError('Policy not found', 404);

      await prisma.depositPolicy.delete({ where: { id: policy.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_deposit_policy',
        entityType: 'deposit_policy',
        entityId: policy.id,
        beforeState: serializePolicy(policy),
      });

      res.json({ success: true, message: 'Policy deleted' });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete deposit policy: ${error.message}`, 500);
    }
  }
);

// Mount policies under /policies inside the deposits router
depositsRouter.use('/policies', depositPoliciesRouter);

// POST /api/tenants/:tenantId/deposits/calculate
depositsRouter.post(
  '/calculate',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = z
        .object({
          roomId: z.string().uuid().optional(),
          roomCategoryId: z.string().uuid().optional(),
          ratePlanId: z.string().uuid().optional(),
          checkInDate: z.string().optional(),
          totalAmount: z.number().positive(),
          nightlyRate: z.number().nonnegative().optional(),
        })
        .parse(req.body);

      // Resolve category/ratePlan from room when only roomId given
      let categoryId = data.roomCategoryId;
      let ratePlanId = data.ratePlanId;
      if (data.roomId && (!categoryId || !ratePlanId)) {
        const room = await prisma.room.findFirst({
          where: { id: data.roomId, tenantId },
          select: { categoryId: true, ratePlanId: true },
        });
        if (room) {
          categoryId = categoryId ?? room.categoryId ?? undefined;
          ratePlanId = ratePlanId ?? room.ratePlanId ?? undefined;
        }
      }

      const policies = await prisma.depositPolicy.findMany({
        where: { tenantId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });

      const checkIn = data.checkInDate ? new Date(data.checkInDate) : null;
      const isWeekend = checkIn ? [0, 6].includes(checkIn.getDay()) : false;

      const applicable = policies.filter((p) => {
        if (!p.appliesToAllRooms) {
          const catMatch = categoryId && p.roomCategoryIds.includes(categoryId);
          const planMatch = ratePlanId && p.ratePlanIds.includes(ratePlanId);
          if (!catMatch && !planMatch) return false;
        }
        if (p.requiresForWeekends && !isWeekend) return false;
        return true;
      });

      const calculations = applicable.map((p) => {
        let amount = 0;
        if (p.depositType === 'percentage') {
          amount = (data.totalAmount * Number(p.depositValue)) / 100;
        } else if (p.depositType === 'fixed') {
          amount = Number(p.depositValue);
        } else if (p.depositType === 'first_night') {
          amount = data.nightlyRate ?? Number(p.depositValue);
        }
        if (p.minDepositAmount) amount = Math.max(amount, Number(p.minDepositAmount));
        if (p.maxDepositAmount) amount = Math.min(amount, Number(p.maxDepositAmount));
        return { policy: serializePolicy(p), depositAmount: Math.round(amount * 100) / 100 };
      });

      const required = calculations.length
        ? Math.max(...calculations.map((c) => c.depositAmount))
        : 0;

      res.json({
        success: true,
        data: {
          depositRequired: calculations.length > 0,
          depositAmount: required,
          appliedPolicies: calculations,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to calculate deposit: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/deposits/payments — deposit payment records
depositsRouter.get(
  '/payments',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, reservationId } = req.query;

      const where: any = { tenantId };
      if (status) where.status = status;
      if (reservationId) where.reservationId = reservationId;

      const payments = await prisma.depositPayment.findMany({
        where,
        include: {
          reservation: {
            select: {
              id: true,
              reservationNumber: true,
              guestName: true,
              checkInDate: true,
              checkOutDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      res.json({
        success: true,
        data: payments.map((p) => ({
          ...p,
          amount: toNumber(p.amount),
          refundAmount: toNumber(p.refundAmount),
        })),
      });
    } catch (error: any) {
      throw new AppError(`Failed to fetch deposit payments: ${error.message}`, 500);
    }
  }
);
