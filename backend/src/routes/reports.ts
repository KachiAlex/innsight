import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';

export const reportsRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? 0 : Number(v));

const dateRange = (req: AuthRequest) => {
  const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new AppError('Invalid date range', 400);
  return { from, to };
};

const ACTIVE = ['confirmed', 'checked_in', 'checked_out'];

// GET /api/tenants/:tenantId/reports/occupancy
reportsRouter.get(
  '/occupancy',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { from, to } = dateRange(req);

      const [totalRooms, reservations] = await Promise.all([
        prisma.room.count({ where: { tenantId } }),
        prisma.reservation.findMany({
          where: {
            tenantId,
            status: { in: ACTIVE },
            checkInDate: { lte: to },
            checkOutDate: { gt: from },
          },
          select: { checkInDate: true, checkOutDate: true, rate: true, status: true },
        }),
      ]);

      // Per-day occupancy
      const days: { date: string; occupiedRooms: number; occupancyRate: number }[] = [];
      for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400000)) {
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const occupied = reservations.filter(
          (r) => r.checkInDate < new Date(dayStart.getTime() + 86400000) && r.checkOutDate > dayStart
        ).length;
        days.push({
          date: dayStart.toISOString().slice(0, 10),
          occupiedRooms: occupied,
          occupancyRate: totalRooms ? Math.round((occupied / totalRooms) * 10000) / 100 : 0,
        });
      }

      const totalRoomNights = days.reduce((s, d) => s + d.occupiedRooms, 0);
      const availableRoomNights = days.length * totalRooms;
      const revenue = reservations.reduce((s, r) => s + toNumber(r.rate), 0);

      res.json({
        success: true,
        data: {
          from,
          to,
          totalRooms,
          averageOccupancyRate: availableRoomNights
            ? Math.round((totalRoomNights / availableRoomNights) * 10000) / 100
            : 0,
          totalRoomNightsSold: totalRoomNights,
          adr: totalRoomNights ? Math.round((revenue / totalRoomNights) * 100) / 100 : 0,
          revpar: availableRoomNights
            ? Math.round((revenue / availableRoomNights) * 100) / 100
            : 0,
          daily: days,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to generate occupancy report: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/reports/revenue
reportsRouter.get(
  '/revenue',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { from, to } = dateRange(req);

      const payments = await prisma.payment.findMany({
        where: { tenantId, status: 'completed', createdAt: { gte: from, lte: to } },
        select: { amount: true, method: true, createdAt: true, currency: true },
      });

      const byMethod: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      let total = 0;
      for (const p of payments) {
        const amt = toNumber(p.amount);
        total += amt;
        byMethod[p.method] = (byMethod[p.method] || 0) + amt;
        const day = p.createdAt.toISOString().slice(0, 10);
        byDay[day] = (byDay[day] || 0) + amt;
      }

      res.json({
        success: true,
        data: {
          from,
          to,
          totalRevenue: Math.round(total * 100) / 100,
          paymentCount: payments.length,
          byMethod,
          daily: Object.entries(byDay)
            .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to generate revenue report: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/reports/financial
reportsRouter.get(
  '/financial',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { from, to } = dateRange(req);

      const [payments, openFolios, deposits] = await Promise.all([
        prisma.payment.aggregate({
          where: { tenantId, status: 'completed', createdAt: { gte: from, lte: to } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.folio.findMany({
          where: { tenantId, status: 'open' },
          select: { balance: true },
        }),
        prisma.depositPayment.aggregate({
          where: { tenantId, status: 'completed' },
          _sum: { amount: true },
        }),
      ]);

      const outstandingBalance = openFolios.reduce((s, f) => s + toNumber(f.balance), 0);

      res.json({
        success: true,
        data: {
          from,
          to,
          totalRevenue: toNumber(payments._sum.amount),
          paymentCount: payments._count,
          outstandingBalance: Math.round(outstandingBalance * 100) / 100,
          openFolioCount: openFolios.length,
          depositsHeld: toNumber(deposits._sum.amount),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to generate financial report: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/reports/performance-metrics
reportsRouter.get(
  '/performance-metrics',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { from, to } = dateRange(req);

      const [totalRooms, reservations, hkOpen, maintOpen] = await Promise.all([
        prisma.room.count({ where: { tenantId } }),
        prisma.reservation.findMany({
          where: { tenantId, createdAt: { gte: from, lte: to } },
          select: { status: true, rate: true },
        }),
        prisma.housekeepingTask.count({ where: { tenantId, status: { not: 'completed' } } }),
        prisma.maintenanceTicket.count({ where: { tenantId, status: { notIn: ['resolved', 'closed'] } } }),
      ]);

      const active = reservations.filter((r) => ACTIVE.includes(r.status));
      const cancelled = reservations.filter((r) => r.status === 'cancelled').length;

      res.json({
        success: true,
        data: {
          from,
          to,
          totalRooms,
          newReservations: reservations.length,
          activeReservations: active.length,
          cancellations: cancelled,
          cancellationRate: reservations.length
            ? Math.round((cancelled / reservations.length) * 10000) / 100
            : 0,
          openHousekeepingTasks: hkOpen,
          openMaintenanceTickets: maintOpen,
          bookingsRevenue: Math.round(active.reduce((s, r) => s + toNumber(r.rate), 0) * 100) / 100,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to generate performance metrics: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/reports/guest-feedback — via support tickets / lost items proxy
reportsRouter.get(
  '/guest-feedback',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { from, to } = dateRange(req);

      const [requests, tickets] = await Promise.all([
        prisma.guestRequest.groupBy({
          by: ['status'],
          where: { tenantId, createdAt: { gte: from, lte: to } },
          _count: true,
        }),
        prisma.supportTicket.findMany({
          where: { tenantId, createdAt: { gte: from, lte: to }, satisfactionRating: { not: null } },
          select: { satisfactionRating: true },
        }),
      ]);

      const ratings = tickets.map((t) => t.satisfactionRating!).filter(Boolean);

      res.json({
        success: true,
        data: {
          from,
          to,
          guestRequestsByStatus: requests.map((r) => ({ status: r.status, count: r._count })),
          ratedTickets: ratings.length,
          averageSatisfaction: ratings.length
            ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
            : null,
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to generate guest feedback report: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/reports/custom — run a custom aggregation
reportsRouter.post(
  '/custom',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = z
        .object({
          entity: z.enum(['reservations', 'payments', 'folios', 'rooms']),
          from: z.string().optional(),
          to: z.string().optional(),
          groupBy: z.enum(['status', 'day', 'method']).optional(),
        })
        .parse(req.body);

      const from = data.from ? new Date(data.from) : new Date(Date.now() - 30 * 86400000);
      const to = data.to ? new Date(data.to) : new Date();
      const createdRange = { gte: from, lte: to };

      let result: any;
      if (data.entity === 'reservations') {
        const rows = await prisma.reservation.findMany({
          where: { tenantId, createdAt: createdRange },
          select: { status: true, rate: true, createdAt: true },
        });
        result = groupRows(rows, data.groupBy, (r) => toNumber(r.rate));
      } else if (data.entity === 'payments') {
        const rows = await prisma.payment.findMany({
          where: { tenantId, createdAt: createdRange },
          select: { status: true, method: true, amount: true, createdAt: true },
        });
        result = groupRows(rows, data.groupBy, (r) => toNumber(r.amount));
      } else if (data.entity === 'folios') {
        const rows = await prisma.folio.findMany({
          where: { tenantId, createdAt: createdRange },
          select: { status: true, balance: true, createdAt: true },
        });
        result = groupRows(rows, data.groupBy, (r) => toNumber(r.balance));
      } else {
        const rows = await prisma.room.findMany({
          where: { tenantId },
          select: { status: true, roomType: true, createdAt: true },
        });
        result = groupRows(rows, 'status', () => 1);
      }

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'run_custom_report',
        entityType: 'report',
        entityId: data.entity,
        metadata: data,
      });

      res.json({ success: true, data: { entity: data.entity, from, to, rows: result } });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to run custom report: ${error.message}`, 500);
    }
  }
);

function groupRows(rows: any[], groupBy: string | undefined, valueFn: (r: any) => number) {
  const keyFn = (r: any) =>
    groupBy === 'day'
      ? r.createdAt.toISOString().slice(0, 10)
      : groupBy === 'method'
      ? r.method ?? 'unknown'
      : r.status ?? r.roomType ?? 'unknown';

  const map = new Map<string, { count: number; total: number }>();
  for (const r of rows) {
    const k = keyFn(r);
    const e = map.get(k) || { count: 0, total: 0 };
    e.count++;
    e.total += valueFn(r);
    map.set(k, e);
  }
  return Array.from(map.entries())
    .map(([key, v]) => ({ key, count: v.count, total: Math.round(v.total * 100) / 100 }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

// GET /api/tenants/:tenantId/reports/night-audit — list audits
reportsRouter.get(
  '/night-audit',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { skip, take, page, limit } = getPaginationParams(req);

      const [audits, total] = await Promise.all([
        prisma.nightAudit.findMany({
          where: { tenantId },
          include: { performer: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { auditDate: 'desc' },
          skip,
          take,
        }),
        prisma.nightAudit.count({ where: { tenantId } }),
      ]);

      res.json({ success: true, ...createPaginationResult(audits, total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch night audits: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/reports/night-audit/:id
reportsRouter.get(
  '/night-audit/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const audit = await prisma.nightAudit.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        include: { performer: { select: { id: true, firstName: true, lastName: true } } },
      });
      if (!audit) throw new AppError('Night audit not found', 404);
      res.json({ success: true, data: audit });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch night audit: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/reports/night-audit — run a night audit for a date
reportsRouter.post(
  '/night-audit',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { auditDate } = z
        .object({ auditDate: z.string().optional() })
        .parse(req.body || {});

      const day = auditDate ? new Date(auditDate) : new Date();
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day.getTime() + 86400000);

      const [arrivals, departures, inHouse, dayPayments, openFolios] = await Promise.all([
        prisma.reservation.count({
          where: {
            tenantId,
            checkInDate: { gte: day, lt: nextDay },
            status: { in: ['confirmed', 'checked_in'] },
          },
        }),
        prisma.reservation.count({
          where: {
            tenantId,
            checkOutDate: { gte: day, lt: nextDay },
            status: { in: ['checked_in', 'checked_out'] },
          },
        }),
        prisma.reservation.count({
          where: {
            tenantId,
            checkInDate: { lt: nextDay },
            checkOutDate: { gt: day },
            status: 'checked_in',
          },
        }),
        prisma.payment.aggregate({
          where: { tenantId, status: 'completed', createdAt: { gte: day, lt: nextDay } },
          _sum: { amount: true },
          _count: true,
        }),
        prisma.folio.findMany({
          where: { tenantId, status: 'open', balance: { gt: 0 } },
          select: { id: true, guestName: true, balance: true, roomId: true },
        }),
      ]);

      const discrepancies = openFolios.map((f) => ({
        type: 'open_balance',
        folioId: f.id,
        guestName: f.guestName,
        balance: toNumber(f.balance),
      }));

      const audit = await prisma.nightAudit.upsert({
        where: { id: `${tenantId}-${day.toISOString().slice(0, 10)}` },
        create: {
          id: `${tenantId}-${day.toISOString().slice(0, 10)}`,
          tenantId,
          auditDate: day,
          auditDateTime: new Date(),
          performedBy: req.user!.id,
          status: 'completed',
          summary: {
            arrivals,
            departures,
            inHouse,
            paymentsTotal: toNumber(dayPayments._sum.amount),
            paymentCount: dayPayments._count,
            openFolioCount: openFolios.length,
          },
          discrepancies,
        },
        update: {
          auditDateTime: new Date(),
          performedBy: req.user!.id,
          status: 'completed',
          summary: {
            arrivals,
            departures,
            inHouse,
            paymentsTotal: toNumber(dayPayments._sum.amount),
            paymentCount: dayPayments._count,
            openFolioCount: openFolios.length,
          },
          discrepancies,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'run_night_audit',
        entityType: 'night_audit',
        entityId: audit.id,
        afterState: audit.summary,
      });

      res.status(201).json({ success: true, data: audit });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to run night audit: ${error.message}`, 500);
    }
  }
);
