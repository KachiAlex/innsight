import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';
import { createRoomLog } from '../utils/roomLogs';

export const calendarRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const BLOCKED_ROOM_STATUSES = new Set(['blocked', 'maintenance', 'out_of_order']);
const ACTIVE_RESERVATION_STATUSES = ['confirmed', 'checked_in', 'pending'];

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

// GET /api/tenants/:tenantId/calendar
calendarRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { startDate, endDate, roomType, status, categoryId } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('startDate and endDate are required', 400);
      }
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
        throw new AppError('Invalid date range', 400);
      }
      if (end.getTime() - start.getTime() > 62 * 86400000) {
        throw new AppError('Date range too large (max 62 days)', 400);
      }

      const roomWhere: any = { tenantId };
      if (roomType) roomWhere.roomType = roomType;
      if (status) roomWhere.status = status;
      if (categoryId) roomWhere.categoryId = categoryId;

      const [rooms, reservations] = await Promise.all([
        prisma.room.findMany({
          where: roomWhere,
          include: {
            category: { select: { id: true, name: true, color: true } },
            ratePlan: { select: { baseRate: true } },
          },
          orderBy: { roomNumber: 'asc' },
        }),
        prisma.reservation.findMany({
          where: {
            tenantId,
            status: { in: ACTIVE_RESERVATION_STATUSES.concat('checked_out') },
            checkInDate: { lte: end },
            checkOutDate: { gt: start },
          },
          include: {
            groupBooking: {
              select: { id: true, groupBookingNumber: true, groupName: true, totalRooms: true },
            },
          },
        }),
      ]);

      // Build day list
      const days: string[] = [];
      for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86400000)) {
        days.push(dayKey(d));
      }

      const reservationsByRoom = new Map<string, typeof reservations>();
      for (const r of reservations) {
        const list = reservationsByRoom.get(r.roomId) || [];
        list.push(r);
        reservationsByRoom.set(r.roomId, list);
      }

      const roomEntries = rooms.map((room) => {
        const nightlyRate = toNumber(room.customRate) ?? toNumber(room.ratePlan?.baseRate);
        const availability = days.map((day) => {
          const dayRes = (reservationsByRoom.get(room.id) || []).find((r) => {
            const ci = dayKey(r.checkInDate);
            const co = dayKey(r.checkOutDate);
            return day >= ci && day < co;
          });

          let dayStatus: string;
          if (dayRes) {
            if (dayKey(dayRes.checkInDate) === day && dayRes.status === 'confirmed') {
              dayStatus = 'check_in';
            } else if (dayKey(dayRes.checkOutDate) === day) {
              dayStatus = 'check_out';
            } else {
              dayStatus = 'occupied';
            }
          } else if (BLOCKED_ROOM_STATUSES.has(room.status)) {
            dayStatus = 'blocked';
          } else {
            dayStatus = 'available';
          }

          return {
            date: day,
            status: dayStatus,
            reservation: dayRes
              ? {
                  id: dayRes.id,
                  guestName: dayRes.guestName,
                  checkInDate: dayRes.checkInDate,
                  checkOutDate: dayRes.checkOutDate,
                  status: dayRes.status,
                  rate: toNumber(dayRes.rate),
                  groupBookingId: dayRes.groupBookingId,
                  groupBooking: dayRes.groupBooking,
                }
              : null,
          };
        });

        return {
          room: {
            id: room.id,
            roomNumber: room.roomNumber,
            roomType: room.roomType,
            status: room.status,
            maxOccupancy: room.maxOccupancy,
            category: room.category
              ? { id: room.category.id, name: room.category.name, color: room.category.color }
              : null,
            pricing: {
              nightlyRate,
              source: room.customRate != null ? 'custom' : room.ratePlan ? 'rate_plan' : 'none',
            },
          },
          availability,
        };
      });

      // Category summaries
      const categoryMap = new Map<string, { name: string; color: string | null; rates: number[]; count: number }>();
      for (const room of rooms) {
        const key = room.category?.id || 'none';
        const entry = categoryMap.get(key) || {
          name: room.category?.name || 'Uncategorized',
          color: room.category?.color ?? null,
          rates: [] as number[],
          count: 0,
        };
        entry.count++;
        const rate = toNumber(room.customRate) ?? toNumber(room.ratePlan?.baseRate);
        if (rate !== null) entry.rates.push(rate);
        categoryMap.set(key, entry);
      }

      const categories = Array.from(categoryMap.entries()).map(([id, e]) => ({
        id,
        name: e.name,
        color: e.color,
        roomCount: e.count,
        minRate: e.rates.length ? Math.min(...e.rates) : null,
        maxRate: e.rates.length ? Math.max(...e.rates) : null,
      }));

      res.json({
        success: true,
        data: { startDate: dayKey(start), endDate: dayKey(end), categories, rooms: roomEntries },
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch calendar: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/calendar/move-reservation
calendarRouter.post(
  '/move-reservation',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { reservationId, newRoomId, newCheckInDate, newCheckOutDate } = z
        .object({
          reservationId: z.string().uuid(),
          newRoomId: z.string().uuid(),
          newCheckInDate: z.string(),
          newCheckOutDate: z.string(),
        })
        .parse(req.body);

      const reservation = await prisma.reservation.findFirst({
        where: { id: reservationId, tenantId },
      });
      if (!reservation) throw new AppError('Reservation not found', 404);
      if (['checked_out', 'cancelled'].includes(reservation.status)) {
        throw new AppError(`Cannot move a ${reservation.status} reservation`, 400);
      }

      const checkIn = new Date(newCheckInDate);
      const checkOut = new Date(newCheckOutDate);
      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime()) || checkOut <= checkIn) {
        throw new AppError('Invalid date range', 400);
      }

      const room = await prisma.room.findFirst({
        where: { id: newRoomId, tenantId },
      });
      if (!room) throw new AppError('Target room not found', 404);
      if (BLOCKED_ROOM_STATUSES.has(room.status)) {
        throw new AppError(`Room ${room.roomNumber} is ${room.status}`, 400);
      }

      // Prevent double-booking the target room
      const conflict = await prisma.reservation.findFirst({
        where: {
          tenantId,
          roomId: newRoomId,
          id: { not: reservationId },
          status: { in: ACTIVE_RESERVATION_STATUSES },
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
        },
      });
      if (conflict) {
        throw new AppError(
          `Room ${room.roomNumber} already has a reservation overlapping those dates`,
          409
        );
      }

      const updated = await prisma.reservation.update({
        where: { id: reservationId },
        data: { roomId: newRoomId, checkInDate: checkIn, checkOutDate: checkOut },
        include: {
          room: { select: { id: true, roomNumber: true, roomType: true } },
        },
      });

      await createRoomLog({
        tenantId,
        roomId: newRoomId,
        type: 'reservation_moved',
        summary: `Reservation ${reservation.reservationNumber} moved to this room (${newCheckInDate.slice(0, 10)} → ${newCheckOutDate.slice(0, 10)})`,
        user: { id: req.user!.id, name: req.user!.email },
      }).catch(() => undefined);

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'move_reservation',
        entityType: 'reservation',
        entityId: reservationId,
        beforeState: {
          roomId: reservation.roomId,
          checkInDate: reservation.checkInDate,
          checkOutDate: reservation.checkOutDate,
        },
        afterState: { roomId: newRoomId, checkInDate: checkIn, checkOutDate: checkOut },
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to move reservation: ${error.message}`, 500);
    }
  }
);
