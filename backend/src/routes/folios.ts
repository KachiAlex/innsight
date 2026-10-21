import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';

export const foliosRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializeFolio = (folio: any) => ({
  ...folio,
  totalCharges: toNumber(folio.totalCharges) ?? 0,
  totalPayments: toNumber(folio.totalPayments) ?? 0,
  balance: toNumber(folio.balance) ?? 0,
  charges: (folio.charges ?? []).map((c: any) => ({
    ...c,
    amount: toNumber(c.amount) ?? 0,
    total: toNumber(c.total) ?? 0,
    taxRate: toNumber(c.taxRate),
    taxAmount: toNumber(c.taxAmount),
  })),
  payments: (folio.payments ?? []).map((p: any) => ({
    ...p,
    amount: toNumber(p.amount) ?? 0,
  })),
});

const folioInclude = {
  room: { select: { id: true, roomNumber: true, roomType: true } },
  reservation: {
    select: {
      id: true,
      reservationNumber: true,
      checkInDate: true,
      checkOutDate: true,
      status: true,
    },
  },
};

const recalcFolioTotals = async (folioId: string) => {
  const [chargeAgg, paymentAgg] = await Promise.all([
    prisma.folioCharge.aggregate({ where: { folioId }, _sum: { total: true } }),
    prisma.payment.aggregate({
      where: { folioId, status: 'completed' },
      _sum: { amount: true },
    }),
  ]);
  const totalCharges = chargeAgg._sum.total ?? new Prisma.Decimal(0);
  const totalPayments = paymentAgg._sum.amount ?? new Prisma.Decimal(0);
  return prisma.folio.update({
    where: { id: folioId },
    data: {
      totalCharges,
      totalPayments,
      balance: totalCharges.minus(totalPayments),
    },
  });
};

// GET /api/tenants/:tenantId/folios
foliosRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, roomId, reservationId, search } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (roomId) where.roomId = roomId;
      if (reservationId) where.reservationId = reservationId;
      if (search) where.guestName = { contains: search as string, mode: 'insensitive' };

      const [folios, total] = await Promise.all([
        prisma.folio.findMany({
          where,
          include: folioInclude,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.folio.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(folios.map(serializeFolio), total, page, limit) });
      return;
    } catch (error: any) {
      throw new AppError(`Failed to fetch folios: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/folios/:id
foliosRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const folio = await prisma.folio.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        include: {
          ...folioInclude,
          charges: { orderBy: { createdAt: 'asc' } },
          payments: { orderBy: { createdAt: 'desc' } },
        },
      });
      if (!folio) throw new AppError('Folio not found', 404);
      res.json({ success: true, data: serializeFolio(folio) });
      return;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch folio: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/folios
foliosRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = z
        .object({
          roomId: z.string().uuid(),
          guestName: z.string().min(1),
          reservationId: z.string().uuid().optional(),
          currency: z.string().optional(),
        })
        .parse(req.body);

      const room = await prisma.room.findFirst({
        where: { id: data.roomId, tenantId },
      });
      if (!room) throw new AppError('Room not found', 404);

      const folio = await prisma.folio.create({
        data: {
          tenantId,
          roomId: data.roomId,
          reservationId: data.reservationId ?? null,
          guestName: data.guestName,
          currency: data.currency || 'NGN',
          createdBy: req.user!.id,
        },
        include: folioInclude,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_folio',
        entityType: 'folio',
        entityId: folio.id,
        afterState: serializeFolio(folio),
      });

      res.status(201).json({ success: true, data: serializeFolio(folio) });
      return;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create folio: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/folios/:id/charges
foliosRouter.post(
  '/:id/charges',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const folio = await prisma.folio.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!folio) throw new AppError('Folio not found', 404);
      if (folio.status === 'closed') throw new AppError('Folio is closed', 400);

      const data = z
        .object({
          description: z.string().min(1),
          category: z.string().min(1),
          amount: z.number().nonnegative(),
          quantity: z.number().int().min(1).default(1),
          taxRate: z.number().nonnegative().optional(),
        })
        .parse(req.body);

      const total = new Prisma.Decimal(data.amount).mul(data.quantity);
      const taxAmount = data.taxRate
        ? total.mul(new Prisma.Decimal(data.taxRate)).div(100)
        : null;

      const charge = await prisma.folioCharge.create({
        data: {
          folioId: folio.id,
          description: data.description,
          category: data.category,
          amount: new Prisma.Decimal(data.amount),
          quantity: data.quantity,
          total: taxAmount ? total.plus(taxAmount) : total,
          taxRate: data.taxRate !== undefined ? new Prisma.Decimal(data.taxRate) : null,
          taxAmount,
        },
      });

      const updatedFolio = await recalcFolioTotals(folio.id);

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'add_folio_charge',
        entityType: 'folio_charge',
        entityId: charge.id,
        afterState: { charge, folioId: folio.id },
      });

      res.status(201).json({
        success: true,
        data: {
          charge: {
            ...charge,
            amount: toNumber(charge.amount),
            total: toNumber(charge.total),
            taxRate: toNumber(charge.taxRate),
            taxAmount: toNumber(charge.taxAmount),
          },
          folio: serializeFolio(updatedFolio),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to add charge: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/folios/:id/charges/:chargeId
foliosRouter.delete(
  '/:id/charges/:chargeId',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const folio = await prisma.folio.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!folio) throw new AppError('Folio not found', 404);
      if (folio.status === 'closed') throw new AppError('Folio is closed', 400);

      const charge = await prisma.folioCharge.findFirst({
        where: { id: req.params.chargeId, folioId: folio.id },
      });
      if (!charge) throw new AppError('Charge not found', 404);

      await prisma.folioCharge.delete({ where: { id: charge.id } });
      const updatedFolio = await recalcFolioTotals(folio.id);

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_folio_charge',
        entityType: 'folio_charge',
        entityId: charge.id,
        beforeState: charge,
      });

      res.json({ success: true, data: serializeFolio(updatedFolio) });
      return;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to remove charge: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/folios/:id/close
foliosRouter.post(
  '/:id/close',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const folio = await prisma.folio.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!folio) throw new AppError('Folio not found', 404);
      if (folio.status === 'closed') {
        res.json({ success: true, data: serializeFolio(folio) });
        return;
      }

      const updated = await prisma.folio.update({
        where: { id: folio.id },
        data: { status: 'closed', closedAt: new Date(), closedBy: req.user!.id },
        include: { ...folioInclude, charges: true, payments: true },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'close_folio',
        entityType: 'folio',
        entityId: folio.id,
        beforeState: serializeFolio(folio),
        afterState: serializeFolio(updated),
      });

      res.json({ success: true, data: serializeFolio(updated) });
      return;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to close folio: ${error.message}`, 500);
    }
  }
);
