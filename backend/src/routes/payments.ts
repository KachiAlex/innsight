import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import {
  getTenantPaymentSettings,
  upsertTenantPaymentSettings,
} from '../utils/publicPayments';

export const paymentsRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializePayment = (p: any) => ({ ...p, amount: toNumber(p.amount) ?? 0 });

const paymentInclude = {
  folio: {
    select: {
      id: true,
      guestName: true,
      status: true,
      room: { select: { roomNumber: true } },
    },
  },
};

const recalcFolio = async (folioId: string) => {
  const [chargeAgg, paymentAgg] = await Promise.all([
    prisma.folioCharge.aggregate({ where: { folioId }, _sum: { total: true } }),
    prisma.payment.aggregate({
      where: { folioId, status: 'completed' },
      _sum: { amount: true },
    }),
  ]);
  const totalCharges = chargeAgg._sum.total ?? 0;
  const totalPayments = paymentAgg._sum.amount ?? 0;
  await prisma.folio.update({
    where: { id: folioId },
    data: {
      totalCharges,
      totalPayments,
      balance: Number(totalCharges) - Number(totalPayments),
    },
  });
};

// GET /api/tenants/:tenantId/payments
paymentsRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, method, folioId, reconciled, search, from, to } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (method) where.method = method;
      if (folioId) where.folioId = folioId;
      if (reconciled !== undefined) where.reconciled = reconciled === 'true';
      if (search) {
        where.OR = [
          { reference: { contains: search as string, mode: 'insensitive' } },
          { folio: { guestName: { contains: search as string, mode: 'insensitive' } } },
        ];
      }
      if (from || to) {
        where.createdAt = {};
        if (from) where.createdAt.gte = new Date(from as string);
        if (to) where.createdAt.lte = new Date(to as string);
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          include: paymentInclude,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.payment.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(payments.map(serializePayment), total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch payments: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/payments/gateways
paymentsRouter.get(
  '/gateways',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const settings = await getTenantPaymentSettings(req.params.tenantId);
      res.json({
        success: true,
        data: {
          allowedGateways: settings.allowedGateways,
          defaultGateway: settings.defaultGateway,
          currency: settings.currency,
        },
      });
    } catch (error: any) {
      throw new AppError(`Failed to fetch gateways: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/payments/gateway-settings
paymentsRouter.get(
  '/gateway-settings',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const settings = await getTenantPaymentSettings(req.params.tenantId);
      // Never expose secret keys to the client — return masked indicators
      res.json({
        success: true,
        data: {
          ...settings,
          paystackSecretKey: settings.paystackSecretKey ? '••••••••' : undefined,
          flutterwaveSecretKey: settings.flutterwaveSecretKey ? '••••••••' : undefined,
          flutterwaveSecretHash: settings.flutterwaveSecretHash ? '••••••••' : undefined,
          monnifySecretKey: settings.monnifySecretKey ? '••••••••' : undefined,
          stripeSecretKey: settings.stripeSecretKey ? '••••••••' : undefined,
        },
      });
    } catch (error: any) {
      throw new AppError(`Failed to fetch gateway settings: ${error.message}`, 500);
    }
  }
);

// PUT /api/tenants/:tenantId/payments/gateway-settings
paymentsRouter.put(
  '/gateway-settings',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const body = { ...(req.body || {}) };
      // Ignore masked placeholders sent back by the client
      for (const key of [
        'paystackSecretKey',
        'flutterwaveSecretKey',
        'flutterwaveSecretHash',
        'monnifySecretKey',
        'stripeSecretKey',
      ]) {
        if (body[key] === '••••••••') delete body[key];
      }

      const updated = await upsertTenantPaymentSettings(tenantId, body);

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_gateway_settings',
        entityType: 'tenant',
        entityId: tenantId,
        afterState: { allowedGateways: updated.allowedGateways, defaultGateway: updated.defaultGateway },
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update gateway settings: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/payments — record a manual payment
paymentsRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = z
        .object({
          folioId: z.string().uuid(),
          amount: z.number().positive(),
          method: z.enum(['cash', 'card', 'bank_transfer', 'pos', 'online', 'other']),
          reference: z.string().optional(),
          status: z.enum(['pending', 'completed', 'failed']).optional(),
          notes: z.string().optional(),
        })
        .parse(req.body);

      const folio = await prisma.folio.findFirst({
        where: { id: data.folioId, tenantId },
      });
      if (!folio) throw new AppError('Folio not found', 404);
      if (folio.status === 'closed') throw new AppError('Folio is closed', 400);

      const payment = await prisma.payment.create({
        data: {
          tenantId,
          folioId: data.folioId,
          amount: data.amount,
          method: data.method,
          reference: data.reference ?? `PAY-${Date.now()}`,
          status: data.status || 'completed',
          currency: folio.currency,
          userId: req.user!.id,
          notes: data.notes,
        },
        include: paymentInclude,
      });

      await recalcFolio(data.folioId);

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'record_payment',
        entityType: 'payment',
        entityId: payment.id,
        afterState: serializePayment(payment),
      });

      res.status(201).json({ success: true, data: serializePayment(payment) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to record payment: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/payments/reconcile — bulk reconcile by ids
paymentsRouter.post(
  '/reconcile',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { paymentIds } = z
        .object({ paymentIds: z.array(z.string().uuid()).min(1).max(500) })
        .parse(req.body);

      const result = await prisma.payment.updateMany({
        where: { id: { in: paymentIds }, tenantId, reconciled: false },
        data: { reconciled: true, reconciledAt: new Date(), reconciledBy: req.user!.id },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'reconcile_payments',
        entityType: 'payment',
        entityId: tenantId,
        afterState: { requested: paymentIds.length, reconciled: result.count },
      });

      res.json({ success: true, data: { reconciled: result.count } });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to reconcile payments: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/payments/:id/reconcile
paymentsRouter.post(
  '/:id/reconcile',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const payment = await prisma.payment.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!payment) throw new AppError('Payment not found', 404);

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          reconciled: !payment.reconciled,
          reconciledAt: payment.reconciled ? null : new Date(),
          reconciledBy: payment.reconciled ? null : req.user!.id,
        },
        include: paymentInclude,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: updated.reconciled ? 'reconcile_payment' : 'unreconcile_payment',
        entityType: 'payment',
        entityId: payment.id,
        beforeState: serializePayment(payment),
        afterState: serializePayment(updated),
      });

      res.json({ success: true, data: serializePayment(updated) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to reconcile payment: ${error.message}`, 500);
    }
  }
);
