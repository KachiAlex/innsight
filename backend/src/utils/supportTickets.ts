import { prisma } from './prisma';
import { createAuditLog } from './audit';
import { AppError } from '../middleware/errorHandler';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketStatus = 'open' | 'in-progress' | 'waiting-customer' | 'resolved' | 'closed';
export type TicketCategory = 'billing' | 'technical' | 'feature-request' | 'bug' | 'other';

export interface SupportTicket {
  id: string;
  tenantId?: string; // empty for platform-level tickets
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  requesterEmail: string;
  requesterName: string;
  assignedTo?: string; // Staff member ID
  attachments?: {
    url: string;
    fileName: string;
    size: number;
  }[];
  messages: {
    from: string; // email
    message: string;
    attachments?: {
      url: string;
      fileName: string;
    }[];
    timestamp: string;
  }[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  satisfactionRating?: number; // 1-5 after resolution
  customFields?: Record<string, string>;
}

export interface TicketStats {
  totalTickets: number;
  openTickets: number;
  averageResolutionTime: number; // in hours
  averageResponseTime: number; // in hours
  satisfactionScore: number; // 1-5 average
  ticketsByPriority: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  ticketsByCategory: Record<TicketCategory, number>;
  ticketsByStatus: Record<TicketStatus, number>;
}

const requirePrisma = () => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }
  return prisma;
};

const toTicket = (row: any): SupportTicket => ({
  id: row.id,
  tenantId: row.tenantId ?? undefined,
  subject: row.subject,
  description: row.description,
  category: row.category,
  priority: row.priority,
  status: row.status,
  requesterEmail: row.requesterEmail,
  requesterName: row.requesterName,
  assignedTo: row.assignedTo ?? undefined,
  attachments: row.attachments ?? undefined,
  messages: row.messages ?? [],
  createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  resolvedAt: row.resolvedAt
    ? row.resolvedAt instanceof Date
      ? row.resolvedAt.toISOString()
      : row.resolvedAt
    : undefined,
  resolutionNotes: row.resolutionNotes ?? undefined,
  satisfactionRating: row.satisfactionRating ?? undefined,
  customFields: row.customFields ?? undefined,
});

const logTicketAudit = async (
  action: string,
  ticket: Pick<SupportTicket, 'id' | 'tenantId'>,
  afterState?: any
) => {
  if (!ticket.tenantId) {
    return;
  }
  await createAuditLog({
    tenantId: ticket.tenantId,
    action,
    entityType: 'SupportTicket',
    entityId: ticket.id,
    afterState,
  });
};

export async function getTickets(
  filters?: {
    tenantId?: string;
    status?: TicketStatus;
    priority?: TicketPriority;
    category?: TicketCategory;
    assignedTo?: string;
  },
  limit: number = 50,
  offset: number = 0
): Promise<SupportTicket[]> {
  const client = requirePrisma();

  const rows = await client.supportTicket.findMany({
    where: {
      tenantId: filters?.tenantId,
      status: filters?.status,
      priority: filters?.priority,
      category: filters?.category,
      assignedTo: filters?.assignedTo,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Sort by priority then by date (priority ordering is app-level, not SQL)
  const priorityOrder: Record<TicketPriority, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const tickets = rows
    .map(toTicket)
    .sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return tickets.slice(offset, offset + limit);
}

export async function getTicket(ticketId: string): Promise<SupportTicket | null> {
  const client = requirePrisma();
  const row = await client.supportTicket.findUnique({ where: { id: ticketId } });
  return row ? toTicket(row) : null;
}

export async function createTicket(
  data: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'messages'>
): Promise<SupportTicket> {
  const client = requirePrisma();

  const row = await client.supportTicket.create({
    data: {
      tenantId: data.tenantId ?? null,
      subject: data.subject,
      description: data.description,
      category: data.category,
      priority: data.priority,
      status: data.status ?? 'open',
      requesterEmail: data.requesterEmail,
      requesterName: data.requesterName,
      assignedTo: data.assignedTo ?? null,
      attachments: data.attachments ?? undefined,
      messages: [],
      customFields: data.customFields ?? undefined,
    },
  });

  const ticket = toTicket(row);
  await logTicketAudit('CREATE_TICKET', ticket, ticket);
  return ticket;
}

export async function updateTicket(
  ticketId: string,
  updates: Partial<Omit<SupportTicket, 'id' | 'createdAt' | 'messages'>>
): Promise<SupportTicket | null> {
  const client = requirePrisma();

  const existing = await client.supportTicket.findUnique({ where: { id: ticketId } });
  if (!existing) return null;

  const resolvedAt =
    updates.resolvedAt !== undefined
      ? updates.resolvedAt
      : updates.status === 'resolved' && !existing.resolvedAt
        ? new Date().toISOString()
        : undefined;

  const row = await client.supportTicket.update({
    where: { id: ticketId },
    data: {
      ...(updates.subject !== undefined && { subject: updates.subject }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.priority !== undefined && { priority: updates.priority }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.requesterEmail !== undefined && { requesterEmail: updates.requesterEmail }),
      ...(updates.requesterName !== undefined && { requesterName: updates.requesterName }),
      ...(updates.assignedTo !== undefined && { assignedTo: updates.assignedTo }),
      ...(updates.attachments !== undefined && { attachments: updates.attachments }),
      ...(updates.resolutionNotes !== undefined && { resolutionNotes: updates.resolutionNotes }),
      ...(updates.satisfactionRating !== undefined && { satisfactionRating: updates.satisfactionRating }),
      ...(updates.customFields !== undefined && { customFields: updates.customFields }),
      ...(resolvedAt !== undefined && { resolvedAt: new Date(resolvedAt) }),
    },
  });

  const ticket = toTicket(row);
  await logTicketAudit('UPDATE_TICKET', ticket, updates);
  return ticket;
}

export async function addTicketMessage(
  ticketId: string,
  message: {
    from: string;
    message: string;
    attachments?: { url: string; fileName: string }[];
  }
): Promise<SupportTicket | null> {
  const client = requirePrisma();

  const existing = await client.supportTicket.findUnique({ where: { id: ticketId } });
  if (!existing) return null;

  const messages = Array.isArray(existing.messages) ? [...(existing.messages as any[])] : [];
  messages.push({ ...message, timestamp: new Date().toISOString() });

  // Auto-update status based on reply
  let status = existing.status;
  if (message.from.includes('support@')) {
    status = 'waiting-customer';
  } else if (message.from !== existing.requesterEmail) {
    status = 'in-progress';
  }

  const row = await client.supportTicket.update({
    where: { id: ticketId },
    data: { messages, status },
  });

  const ticket = toTicket(row);
  await logTicketAudit('ADD_MESSAGE', ticket, { message });
  return ticket;
}

export async function getTicketStats(tenantId?: string): Promise<TicketStats> {
  const client = requirePrisma();

  const rows = await client.supportTicket.findMany({
    where: tenantId ? { tenantId } : undefined,
    select: {
      status: true,
      priority: true,
      category: true,
      satisfactionRating: true,
      createdAt: true,
      resolvedAt: true,
    },
  });

  const resolved = rows.filter((r) => r.resolvedAt);
  const averageResolutionTime = resolved.length
    ? resolved.reduce(
        (sum, r) => sum + (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3_600_000,
        0
      ) / resolved.length
    : 0;
  const rated = rows.filter((r) => r.satisfactionRating !== null);
  const satisfactionScore = rated.length
    ? rated.reduce((sum, r) => sum + (r.satisfactionRating ?? 0), 0) / rated.length
    : 0;

  const count = <T extends string>(key: 'priority' | 'category' | 'status', values: readonly T[]) =>
    Object.fromEntries(values.map((v) => [v, rows.filter((r) => r[key] === v).length])) as Record<T, number>;

  return {
    totalTickets: rows.length,
    openTickets: rows.filter((r) => r.status !== 'closed' && r.status !== 'resolved').length,
    averageResolutionTime,
    averageResponseTime: 0, // requires first-response tracking
    satisfactionScore,
    ticketsByPriority: count('priority', ['low', 'medium', 'high', 'critical'] as const),
    ticketsByCategory: count('category', ['billing', 'technical', 'feature-request', 'bug', 'other'] as const),
    ticketsByStatus: count('status', ['open', 'in-progress', 'waiting-customer', 'resolved', 'closed'] as const),
  };
}
