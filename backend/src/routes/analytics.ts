import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const analyticsRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? 0 : Number(v));

const PERIOD_DAYS: Record<string, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

// GET /api/tenants/:tenantId/analytics/dashboard?period=week
analyticsRouter.get(
  '/dashboard',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const period = (req.query.period as string) || 'week';
      const days = PERIOD_DAYS[period] ?? 7;

      const now = new Date();
      const periodStart = new Date(now.getTime() - days * 86400000);
      const prevStart = new Date(periodStart.getTime() - days * 86400000);
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart.getTime() + 86400000);

      const [
        totalRooms,
        periodReservations,
        prevReservations,
        periodPayments,
        prevPayments,
        arrivalsToday,
        departuresToday,
        inHouse,
        openTasks,
        openTickets,
      ] = await Promise.all([
        prisma.room.count({ where: { tenantId } }),
        prisma.reservation.findMany({
          where: { tenantId, createdAt: { gte: periodStart } },
          select: { status: true, rate: true, createdAt: true, checkInDate: true, checkOutDate: true },
        }),
        prisma.reservation.findMany({
          where: { tenantId, createdAt: { gte: prevStart, lt: periodStart } },
          select: { rate: true },
        }),
        prisma.payment.findMany({
          where: { tenantId, status: 'completed', createdAt: { gte: periodStart } },
          select: { amount: true, createdAt: true, method: true },
        }),
        prisma.payment.aggregate({
          where: { tenantId, status: 'completed', createdAt: { gte: prevStart, lt: periodStart } },
          _sum: { amount: true },
        }),
        prisma.reservation.count({
          where: {
            tenantId,
            checkInDate: { gte: todayStart, lt: todayEnd },
            status: { in: ['confirmed', 'checked_in'] },
          },
        }),
        prisma.reservation.count({
          where: {
            tenantId,
            checkOutDate: { gte: todayStart, lt: todayEnd },
            status: { in: ['checked_in', 'confirmed'] },
          },
        }),
        prisma.reservation.count({
          where: {
            tenantId,
            checkInDate: { lt: todayEnd },
            checkOutDate: { gt: todayStart },
            status: 'checked_in',
          },
        }),
        prisma.housekeepingTask.count({ where: { tenantId, status: { not: 'completed' } } }),
        prisma.maintenanceTicket.count({
          where: { tenantId, status: { notIn: ['resolved', 'closed'] } },
        }),
      ]);

      const revenue = periodPayments.reduce((s, p) => s + toNumber(p.amount), 0);
      const prevRevenue = toNumber(prevPayments._sum.amount);
      const bookingsRevenue = periodReservations.reduce((s, r) => s + toNumber(r.rate), 0);
      const prevBookingsRevenue = prevReservations.reduce((s, r) => s + toNumber(r.rate), 0);

      const occupiedRoomNights = periodReservations
        .filter((r) => ['confirmed', 'checked_in', 'checked_out'].includes(r.status))
        .reduce((s, r) => {
          const ci = r.checkInDate > periodStart ? r.checkInDate : periodStart;
          const co = r.checkOutDate < now ? r.checkOutDate : now;
          return s + Math.max(0, Math.ceil((co.getTime() - ci.getTime()) / 86400000));
        }, 0);
      const availableRoomNights = totalRooms * days;

      // Daily revenue series
      const dailyMap = new Map<string, number>();
      for (const p of periodPayments) {
        const day = p.createdAt.toISOString().slice(0, 10);
        dailyMap.set(day, (dailyMap.get(day) || 0) + toNumber(p.amount));
      }
      const revenueByDay = Array.from(dailyMap.entries())
        .map(([date, amount]) => ({ date, amount: Math.round(amount * 100) / 100 }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // Bookings by status
      const statusMap = new Map<string, number>();
      for (const r of periodReservations) {
        statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
      }

      const pctChange = (current: number, previous: number) =>
        previous === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - previous) / previous) * 10000) / 100;

      res.json({
        success: true,
        data: {
          period,
          days,
          totalRooms,
          occupancy: {
            roomNightsSold: occupiedRoomNights,
            availableRoomNights,
            occupancyRate: availableRoomNights
              ? Math.round((occupiedRoomNights / availableRoomNights) * 10000) / 100
              : 0,
            currentlyInHouse: inHouse,
          },
          revenue: {
            total: Math.round(revenue * 100) / 100,
            previousPeriod: Math.round(prevRevenue * 100) / 100,
            changePercent: pctChange(revenue, prevRevenue),
            bookingsValue: Math.round(bookingsRevenue * 100) / 100,
            previousBookingsValue: Math.round(prevBookingsRevenue * 100) / 100,
            byDay: revenueByDay,
          },
          bookings: {
            total: periodReservations.length,
            byStatus: Object.fromEntries(statusMap),
            cancelled: periodReservations.filter((r) => r.status === 'cancelled').length,
          },
          today: {
            arrivals: arrivalsToday,
            departures: departuresToday,
            inHouse,
          },
          operations: {
            openHousekeepingTasks: openTasks,
            openMaintenanceTickets: openTickets,
          },
        },
      });
    } catch (error: any) {
      throw new AppError(`Failed to load analytics: ${error.message}`, 500);
    }
  }
);
