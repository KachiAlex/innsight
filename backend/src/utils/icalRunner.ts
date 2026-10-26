import crypto from 'crypto';
import { prisma } from './prisma';
import { parseIcs } from './ical';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
const MAX_FEED_BYTES = 3 * 1024 * 1024;
const EXT_SOURCE = 'ical';

const feedPrefix = (feedId: string) => `EXT-${feedId.slice(0, 8)}-`;

// Pick a user to attribute imported reservations to (owner -> manager -> staff).
const resolveActor = async (tenantId: string): Promise<string | null> => {
  const user = await prisma.user.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, role: true },
  });
  return user?.id ?? null;
};

const markFeed = async (feedId: string, data: Record<string, unknown>) =>
  prisma.icalFeed.update({ where: { id: feedId }, data }).catch(() => {});

export const syncIcalFeed = async (feedId: string): Promise<{ imported: number; cancelled: number }> => {
  const feed = await prisma.icalFeed.findUnique({
    where: { id: feedId },
    include: { room: { select: { roomNumber: true } } },
  });
  if (!feed?.importUrl) {
    return { imported: 0, cancelled: 0 };
  }

  let text: string;
  try {
    const response = await fetch(feed.importUrl, {
      signal: AbortSignal.timeout(20_000),
      headers: { 'User-Agent': 'InnSight-PMS/1.0 (+iCal sync)' },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    text = await response.text();
    if (text.length > MAX_FEED_BYTES) {
      throw new Error('Feed exceeds 3MB limit');
    }
  } catch (error: any) {
    await markFeed(feed.id, { lastError: `Fetch failed: ${error?.message || error}`, lastSyncedAt: new Date() });
    throw new Error(`iCal fetch failed: ${error?.message || error}`);
  }

  const actorId = await resolveActor(feed.tenantId);
  if (!actorId) {
    await markFeed(feed.id, { lastError: 'No active user to attribute imported reservations to', lastSyncedAt: new Date() });
    throw new Error('No active user on tenant for imported reservations');
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const events = parseIcs(text).filter((e) => e.end > cutoff);
  const prefix = feedPrefix(feed.id);
  const label = feed.name ? `${feed.name} booking` : 'External booking';
  const seenNumbers = new Set<string>();
  let imported = 0;

  for (const ev of events) {
    const reservationNumber =
      prefix + crypto.createHash('sha1').update(ev.uid).digest('hex').slice(0, 12).toUpperCase();
    seenNumbers.add(reservationNumber);
    await prisma.reservation.upsert({
      where: { reservationNumber },
      create: {
        reservationNumber,
        tenantId: feed.tenantId,
        roomId: feed.roomId,
        guestName: label,
        checkInDate: ev.start,
        checkOutDate: ev.end,
        adults: 1,
        status: 'confirmed',
        source: EXT_SOURCE,
        rate: 0,
        depositRequired: false,
        specialRequests: ev.summary || null,
        createdBy: actorId,
      },
      update: {
        checkInDate: ev.start,
        checkOutDate: ev.end,
        status: 'confirmed',
        specialRequests: ev.summary || null,
      },
    });
    imported++;
  }

  // Events removed from the feed cancel their imported reservations.
  const stale = await prisma.reservation.updateMany({
    where: {
      tenantId: feed.tenantId,
      roomId: feed.roomId,
      reservationNumber: { startsWith: prefix },
      NOT: { reservationNumber: { in: [...seenNumbers] } },
      status: { in: ['confirmed', 'checked_in'] },
      checkOutDate: { gte: new Date() },
    },
    data: { status: 'cancelled' },
  });

  await markFeed(feed.id, {
    lastSyncedAt: new Date(),
    lastError: null,
    lastSummary: `${imported} event${imported === 1 ? '' : 's'} imported, ${stale.count} cancelled`,
  });
  return { imported, cancelled: stale.count };
};

// Called periodically — syncs every active feed whose last sync is stale.
export const syncDueIcalFeeds = async () => {
  const staleBefore = new Date(Date.now() - SYNC_INTERVAL_MS);
  const feeds = await prisma.icalFeed.findMany({
    where: {
      isActive: true,
      importUrl: { not: null },
      OR: [{ lastSyncedAt: null }, { lastSyncedAt: { lt: staleBefore } }],
    },
    select: { id: true },
    take: 50,
  });
  for (const feed of feeds) {
    await syncIcalFeed(feed.id).catch((error) => {
      console.error(`[ical] feed ${feed.id} sync failed:`, error?.message || error);
    });
  }
};
