import { prisma } from './prisma';
import { sendEmail } from './email';

interface DigestConfig {
  enabled?: boolean;
  hour?: number; // UTC hour to send (0-23)
  recipients?: string | string[];
  lastSentDate?: string;
}

const CLOSED_TASK_STATUSES = ['completed', 'resolved', 'closed', 'done', 'cancelled'];

const dayStart = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

const formatMoney = (amount: number, symbol = '₦') =>
  `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const buildDigestHtml = (tenantName: string, stats: {
  occupancy: { occupied: number; total: number };
  arrivals: Array<{ guestName: string; roomNumber: string }>;
  departures: Array<{ guestName: string; roomNumber: string }>;
  revenueYesterday: number;
  currencySymbol: string;
  openHousekeeping: number;
  openMaintenance: number;
  date: string;
}) => {
  const list = (rows: Array<{ guestName: string; roomNumber: string }>, empty: string) =>
    rows.length === 0
      ? `<li style="color:#94a3b8">${empty}</li>`
      : rows
          .slice(0, 10)
          .map((r) => `<li>${r.guestName} — <strong>Room ${r.roomNumber}</strong></li>`)
          .join('') +
        (rows.length > 10 ? `<li style="color:#64748b">…and ${rows.length - 10} more</li>` : '');

  return `
  <div style="font-family:sans-serif;max-width:560px;margin:auto;color:#1e293b">
    <h2 style="margin-bottom:4px">Morning digest — ${tenantName}</h2>
    <p style="color:#64748b;margin-top:0">${stats.date}</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
      <tr>
        <td style="padding:12px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:24px;font-weight:700">${stats.occupancy.occupied}/${stats.occupancy.total}</div>
          <div style="font-size:12px;color:#64748b">Rooms occupied</div>
        </td>
        <td style="padding:12px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:24px;font-weight:700">${stats.arrivals.length}</div>
          <div style="font-size:12px;color:#64748b">Arrivals today</div>
        </td>
        <td style="padding:12px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:24px;font-weight:700">${stats.departures.length}</div>
          <div style="font-size:12px;color:#64748b">Departures today</div>
        </td>
      </tr>
      <tr>
        <td style="padding:12px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:24px;font-weight:700">${formatMoney(stats.revenueYesterday, stats.currencySymbol)}</div>
          <div style="font-size:12px;color:#64748b">Revenue yesterday</div>
        </td>
        <td style="padding:12px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:24px;font-weight:700">${stats.openHousekeeping}</div>
          <div style="font-size:12px;color:#64748b">Open housekeeping</div>
        </td>
        <td style="padding:12px;border:1px solid #e2e8f0;text-align:center">
          <div style="font-size:24px;font-weight:700">${stats.openMaintenance}</div>
          <div style="font-size:12px;color:#64748b">Open maintenance</div>
        </td>
      </tr>
    </table>
    <h3 style="font-size:15px">Arrivals</h3>
    <ul style="margin-top:4px">${list(stats.arrivals, 'No arrivals today')}</ul>
    <h3 style="font-size:15px">Departures</h3>
    <ul style="margin-top:4px">${list(stats.departures, 'No departures today')}</ul>
    <p style="font-size:12px;color:#94a3b8;margin-top:24px">Sent by InnSight daily digest — configure in Settings → Daily digest.</p>
  </div>`;
};

const sendTenantDigest = async (tenant: { id: string; name: string; taxSettings: any }, digest: DigestConfig) => {
  const now = new Date();
  const today = dayStart(now);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  const [arrivals, departures, roomStats, revenue, openHousekeeping, openMaintenance] =
    await Promise.all([
      prisma.reservation.findMany({
        where: {
          tenantId: tenant.id,
          checkInDate: { gte: today, lt: tomorrow },
          status: { in: ['confirmed', 'checked_in'] },
        },
        select: { guestName: true, room: { select: { roomNumber: true } } },
        orderBy: { checkInDate: 'asc' },
      }),
      prisma.reservation.findMany({
        where: {
          tenantId: tenant.id,
          checkOutDate: { gte: today, lt: tomorrow },
          status: { in: ['confirmed', 'checked_in'] },
        },
        select: { guestName: true, room: { select: { roomNumber: true } } },
        orderBy: { checkOutDate: 'asc' },
      }),
      prisma.room.groupBy({
        by: ['status'],
        where: { tenantId: tenant.id },
        _count: { _all: true },
      }),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: {
          tenantId: tenant.id,
          status: 'completed',
          createdAt: { gte: yesterday, lt: today },
        },
      }),
      prisma.housekeepingTask.count({
        where: { tenantId: tenant.id, status: { notIn: CLOSED_TASK_STATUSES } },
      }),
      prisma.maintenanceTicket.count({
        where: { tenantId: tenant.id, status: { notIn: CLOSED_TASK_STATUSES } },
      }),
    ]);

  const totalRooms = roomStats.reduce((s, r) => s + r._count._all, 0);
  const occupied = roomStats.find((r) => r.status === 'occupied')?._count._all ?? 0;
  const currencySymbol = (tenant.taxSettings as any)?.currencySymbol || '₦';

  // Recipients: configured list, else all active owner/GM emails.
  let recipients: string[] = [];
  if (digest.recipients) {
    recipients = Array.isArray(digest.recipients)
      ? digest.recipients
      : digest.recipients.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (recipients.length === 0) {
    const managers = await prisma.user.findMany({
      where: {
        tenantId: tenant.id,
        isActive: true,
        role: { in: ['owner', 'general_manager'] },
      },
      select: { email: true },
    });
    recipients = managers.map((u) => u.email).filter(Boolean);
  }
  if (recipients.length === 0) return;

  const html = buildDigestHtml(tenant.name, {
    occupancy: { occupied, total: totalRooms },
    arrivals: arrivals.map((a) => ({ guestName: a.guestName, roomNumber: a.room.roomNumber })),
    departures: departures.map((d) => ({ guestName: d.guestName, roomNumber: d.room.roomNumber })),
    revenueYesterday: Number(revenue._sum.amount || 0),
    currencySymbol,
    openHousekeeping,
    openMaintenance,
    date: now.toUTCString().slice(0, 16),
  });

  const sent = await sendEmail({
    to: recipients,
    subject: `InnSight daily digest — ${tenant.name} (${today.toISOString().slice(0, 10)})`,
    html,
    tenantId: tenant.id,
    template: 'daily_digest',
    trackOpens: false,
  });

  // Only record the send on success — a failed send (e.g. SMTP down) should
  // be retried by the next tick rather than suppressed for the whole day.
  if (!sent) return;

  const settings = (tenant.taxSettings as any) || {};
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      taxSettings: {
        ...settings,
        digest: { ...(settings.digest || {}), lastSentDate: now.toISOString() },
      },
    },
  });
};

export const runDueDigests = async () => {
  const tenants = await prisma.tenant.findMany({
    where: { subscriptionStatus: 'active' },
    select: { id: true, name: true, taxSettings: true },
  });

  const now = new Date();
  const todayStart = dayStart(now);

  for (const tenant of tenants) {
    const digest: DigestConfig = (tenant.taxSettings as any)?.digest || {};
    if (!digest.enabled) continue;

    const hour = typeof digest.hour === 'number' ? digest.hour : 7;
    if (now.getUTCHours() !== hour) continue;
    if (digest.lastSentDate && new Date(digest.lastSentDate) >= todayStart) continue;

    await sendTenantDigest(tenant, digest).catch((error) => {
      console.error(`[digest] tenant ${tenant.id} digest failed:`, error?.message || error);
    });
  }
};
