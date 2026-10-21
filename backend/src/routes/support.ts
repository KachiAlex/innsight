import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

router.use(authenticate, requireRole('iitech_admin'));

const serializeTicket = (t: any) => {
  const messages = Array.isArray(t.messages) ? t.messages : [];
  return {
    id: t.id,
    ticketNumber: `TKT-${t.id.slice(0, 8).toUpperCase()}`,
    subject: t.subject,
    description: t.description,
    category: t.category,
    priority: t.priority === 'critical' ? 'urgent' : t.priority,
    status: t.status === 'in-progress' ? 'in_progress' : t.status === 'waiting-customer' ? 'waiting_for_customer' : t.status,
    assignedTo: t.assignedTo ?? undefined,
    requesterEmail: t.requesterEmail,
    requesterName: t.requesterName,
    tenantId: t.tenantId ?? undefined,
    messages,
    responseCount: messages.length,
    resolutionNotes: t.resolutionNotes ?? undefined,
    createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
    updatedAt: t.updatedAt?.toISOString?.() ?? t.updatedAt,
    resolvedAt: t.resolvedAt?.toISOString?.() ?? undefined,
  };
};

const normalizeStatus = (s: string) =>
  s === 'in_progress' ? 'in-progress' : s === 'waiting_for_customer' ? 'waiting-customer' : s;

const normalizePriority = (p: string) => (p === 'urgent' ? 'critical' : p);

// GET /api/superadmin/support — list with filters
router.get('/', async (req: Request, res: Response) => {
  const { tenantId, status, priority, category, limit = '100', offset = '0' } = req.query;

  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  if (status) where.status = normalizeStatus(status as string);
  if (priority) where.priority = normalizePriority(priority as string);
  if (category) where.category = category;

  const tickets = await prisma.supportTicket.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.min(parseInt(limit as string) || 100, 500),
    skip: parseInt(offset as string) || 0,
  });

  res.json({ success: true, data: tickets.map(serializeTicket), count: tickets.length });
});

// GET /api/superadmin/support/stats
router.get('/stats', async (req: Request, res: Response) => {
  const { tenantId } = req.query;
  const where: any = tenantId ? { tenantId } : {};

  const rows = await prisma.supportTicket.findMany({
    where,
    select: {
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      satisfactionRating: true,
    },
  });

  const resolved = rows.filter((r) => r.resolvedAt);
  const avgResolutionHours = resolved.length
    ? resolved.reduce(
        (sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000,
        0
      ) / resolved.length
    : 0;
  const rated = rows.filter((r) => r.satisfactionRating !== null);

  res.json({
    success: true,
    data: {
      totalTickets: rows.length,
      openTickets: rows.filter((r) => r.status === 'open').length,
      inProgressTickets: rows.filter((r) => r.status === 'in-progress').length,
      resolvedTickets: resolved.length,
      closedTickets: rows.filter((r) => r.status === 'closed').length,
      averageResolutionTime: Math.round(avgResolutionHours * 10) / 10,
      averageResponseTime: 0, // requires first-response tracking
      satisfactionScore: rated.length
        ? rated.reduce((s, r) => s + (r.satisfactionRating ?? 0), 0) / rated.length
        : 0,
    },
  });
});

// GET /api/superadmin/support/:ticketId
router.get('/:ticketId', async (req: Request, res: Response) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.ticketId },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    return;
  }
  res.json({ success: true, data: serializeTicket(ticket) });
});

// POST /api/superadmin/support — create a ticket
router.post('/', async (req: Request, res: Response) => {
  const data = z
    .object({
      subject: z.string().min(1),
      description: z.string().min(1),
      category: z.string().min(1),
      priority: z.string().min(1),
      requesterEmail: z.string().email(),
      requesterName: z.string().min(1),
      tenantId: z.string().optional(),
    })
    .parse(req.body);

  const ticket = await prisma.supportTicket.create({
    data: {
      tenantId: data.tenantId ?? null,
      subject: data.subject,
      description: data.description,
      category: data.category,
      priority: normalizePriority(data.priority),
      status: 'open',
      requesterEmail: data.requesterEmail,
      requesterName: data.requesterName,
      messages: [],
    },
  });

  res.status(201).json({ success: true, data: serializeTicket(ticket) });
});

// POST /api/superadmin/support/:ticketId/responses — add a reply
router.post('/:ticketId/responses', async (req: Request, res: Response) => {
  const { message, senderType } = z
    .object({
      message: z.string().min(1),
      senderType: z.string().optional(),
      attachments: z.array(z.any()).optional(),
    })
    .parse(req.body);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.ticketId },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    return;
  }

  const messages = Array.isArray(ticket.messages) ? [...(ticket.messages as any[])] : [];
  messages.push({
    from: senderType === 'admin' ? 'support@innsight.io' : ticket.requesterEmail,
    senderType: senderType || 'admin',
    message,
    timestamp: new Date().toISOString(),
  });

  const status =
    senderType === 'admin' && ticket.status === 'open' ? 'waiting-customer' : ticket.status;

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: { messages, status },
  });

  res.json({ success: true, data: serializeTicket(updated) });
});

// PATCH /api/superadmin/support/:ticketId/status
router.patch('/:ticketId/status', async (req: Request, res: Response) => {
  const { status } = z.object({ status: z.string().min(1) }).parse(req.body);

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.ticketId },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    return;
  }

  const normalized = normalizeStatus(status);
  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      status: normalized,
      ...(normalized === 'resolved' && !ticket.resolvedAt && { resolvedAt: new Date() }),
    },
  });

  res.json({ success: true, data: serializeTicket(updated) });
});

// PATCH /api/superadmin/support/:ticketId — general update
router.patch('/:ticketId', async (req: Request, res: Response) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.params.ticketId },
  });
  if (!ticket) {
    res.status(404).json({ success: false, error: { message: 'Ticket not found' } });
    return;
  }

  const data = z
    .object({
      subject: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      priority: z.string().optional(),
      status: z.string().optional(),
      assignedTo: z.string().nullable().optional(),
      resolutionNotes: z.string().nullable().optional(),
      satisfactionRating: z.number().int().min(1).max(5).nullable().optional(),
    })
    .parse(req.body);

  const updated = await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.priority !== undefined && { priority: normalizePriority(data.priority) }),
      ...(data.status !== undefined && { status: normalizeStatus(data.status) }),
      ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
      ...(data.resolutionNotes !== undefined && { resolutionNotes: data.resolutionNotes }),
      ...(data.satisfactionRating !== undefined && {
        satisfactionRating: data.satisfactionRating,
      }),
      ...(data.status === 'resolved' && !ticket.resolvedAt && { resolvedAt: new Date() }),
    },
  });

  res.json({ success: true, data: serializeTicket(updated) });
});

export default router;
