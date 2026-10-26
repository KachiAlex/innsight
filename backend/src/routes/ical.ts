import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { generateIcs } from '../utils/ical';
import { syncIcalFeed } from '../utils/icalRunner';

export const icalPublicRouter = Router();
export const icalRouter = Router({ mergeParams: true });

const ACTIVE_STATUSES = ['confirmed', 'checked_in'];

// GET /api/public/ical/rooms/:token.ics — unguessable per-room export feed.
// OTAs poll this for InnSight availability.
icalPublicRouter.get('/rooms/:token.ics', async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { icalToken: req.params.token },
    include: { tenant: { select: { name: true } } },
  });
  if (!room) {
    res.status(404).send('Not found');
    return;
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      roomId: room.id,
      status: { in: ACTIVE_STATUSES },
      checkOutDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, checkInDate: true, checkOutDate: true },
    orderBy: { checkInDate: 'asc' },
  });

  const events = reservations.map((r) => ({
    uid: `innsight-res-${r.id}@innsight`,
    start: r.checkInDate,
    end: r.checkOutDate,
    summary: `Reserved — ${room.roomNumber}`,
  }));

  res
    .set('Content-Type', 'text/calendar; charset=utf-8')
    .set('Cache-Control', 'no-cache')
    .send(generateIcs(`${room.tenant.name} — Room ${room.roomNumber}`, events));
});

const feedSchema = z.object({
  roomId: z.string().uuid(),
  name: z.string().min(1).max(60).optional(),
  importUrl: z.string().url().max(2000).nullable().optional(),
});

// GET /api/tenants/:tenantId/ical-feeds?roomId= — feeds + export tokens.
icalRouter.get('/', authenticate, requireTenantAccess, async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.params.tenantId;
    const roomId = req.query.roomId as string | undefined;

    const [feeds, rooms] = await Promise.all([
      prisma.icalFeed.findMany({
        where: { tenantId, ...(roomId ? { roomId } : {}) },
        include: { room: { select: { id: true, roomNumber: true, icalToken: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.room.findMany({
        where: { tenantId },
        select: { id: true, roomNumber: true, icalToken: true },
        orderBy: { roomNumber: 'asc' },
      }),
    ]);

    res.json({ success: true, data: { feeds, rooms } });
  } catch (error) {
    next(error);
  }
});

// POST /api/tenants/:tenantId/ical-feeds — attach an external calendar to a room.
icalRouter.post('/', authenticate, requireTenantAccess, async (req: AuthRequest, res, next) => {
  try {
    const tenantId = req.params.tenantId;
    const data = feedSchema.parse(req.body);

    const room = await prisma.room.findFirst({ where: { id: data.roomId, tenantId } });
    if (!room) throw new AppError('Room not found', 404);

    const feed = await prisma.icalFeed.create({
      data: {
        tenantId,
        roomId: room.id,
        name: data.name || null,
        importUrl: data.importUrl || null,
      },
      include: { room: { select: { id: true, roomNumber: true, icalToken: true } } },
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'create_ical_feed',
      entityType: 'ical_feed',
      entityId: feed.id,
      afterState: { roomId: room.id, name: feed.name, importUrl: feed.importUrl },
    });

    res.status(201).json({ success: true, data: feed });
  } catch (error: any) {
    if (error instanceof AppError || error.name === 'ZodError') throw error;
    next(error);
  }
});

// DELETE /api/tenants/:tenantId/ical-feeds/:feedId — detach a feed and
// cancel the reservations it imported.
icalRouter.delete('/:feedId', authenticate, requireTenantAccess, async (req: AuthRequest, res, next) => {
  try {
    const { tenantId, feedId } = req.params;
    const feed = await prisma.icalFeed.findFirst({ where: { id: feedId, tenantId } });
    if (!feed) throw new AppError('Feed not found', 404);

    const prefix = `EXT-${feed.id.slice(0, 8)}-`;
    await prisma.$transaction([
      prisma.reservation.updateMany({
        where: {
          tenantId,
          roomId: feed.roomId,
          reservationNumber: { startsWith: prefix },
          status: { in: ACTIVE_STATUSES },
          checkOutDate: { gte: new Date() },
        },
        data: { status: 'cancelled' },
      }),
      prisma.icalFeed.delete({ where: { id: feed.id } }),
    ]);

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'delete_ical_feed',
      entityType: 'ical_feed',
      entityId: feedId,
      beforeState: { roomId: feed.roomId, name: feed.name, importUrl: feed.importUrl },
    });

    res.json({ success: true, message: 'Feed removed; its imported reservations were cancelled' });
  } catch (error) {
    next(error);
  }
});

// POST /api/tenants/:tenantId/ical-feeds/:feedId/sync — pull the feed now.
icalRouter.post('/:feedId/sync', authenticate, requireTenantAccess, async (req: AuthRequest, res, next) => {
  try {
    const { tenantId, feedId } = req.params;
    const feed = await prisma.icalFeed.findFirst({ where: { id: feedId, tenantId } });
    if (!feed) throw new AppError('Feed not found', 404);
    if (!feed.importUrl) throw new AppError('Feed has no import URL', 400);

    const result = await syncIcalFeed(feed.id);
    const fresh = await prisma.icalFeed.findUnique({
      where: { id: feed.id },
      include: { room: { select: { id: true, roomNumber: true, icalToken: true } } },
    });
    res.json({ success: true, data: { result, feed: fresh } });
  } catch (error: any) {
    if (error instanceof AppError) throw error;
    next(new AppError(`Sync failed: ${error?.message || 'Unknown error'}`, 502));
  }
});
