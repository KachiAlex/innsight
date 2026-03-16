import { prisma } from './prisma';
import { createAuditLog } from './audit';

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_FOR_CUSTOMER = 'waiting_for_customer',
  ON_HOLD = 'on_hold',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  tenantId: string;
  userId: string;
  subject: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo?: string;
  tags: string[];
  attachmentUrls: string[];
  responses: TicketResponse[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolutionNotes?: string;
}

export interface TicketResponse {
  id: string;
  ticketId: string;
  senderId: string;
  senderType: 'customer' | 'support' | 'admin';
  message: string;
  attachmentUrls: string[];
  createdAt: Date;
}

export interface TicketStats {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  resolvedTickets: number;
  closedTickets: number;
  averageResolutionTime: number; // hours
  averageResponseTime: number; // hours
  topCategories: Array<{ category: string; count: number }>;
  priorityDistribution: Record<TicketPriority, number>;
  statusDistribution: Record<TicketStatus, number>;
}

const DEFAULT_TICKETS: SupportTicket[] = [
  {
    id: '1',
    ticketNumber: 'TKT-001',
    tenantId: 'hotel-1',
    userId: 'user-1',
    subject: 'Room booking system not working',
    description: 'Unable to complete room bookings. Getting 500 error.',
    category: 'Technical Support',
    priority: TicketPriority.HIGH,
    status: TicketStatus.IN_PROGRESS,
    assignedTo: 'support-1',
    tags: ['booking', 'critical', 'urgent'],
    attachmentUrls: ['error-screenshot.png'],
    responses: [
      {
        id: 'resp-1',
        ticketId: '1',
        senderId: 'user-1',
        senderType: 'customer',
        message: 'The booking system went down this morning around 10 AM.',
        attachmentUrls: [],
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: 'resp-2',
        ticketId: '1',
        senderId: 'support-1',
        senderType: 'support',
        message: 'Looking into this now. Can you provide more details about your browser?',
        attachmentUrls: [],
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
  {
    id: '2',
    ticketNumber: 'TKT-002',
    tenantId: 'hotel-2',
    userId: 'user-2',
    subject: 'Billing inquiry',
    description: 'Questions about last month invoice charges.',
    category: 'Billing',
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.WAITING_FOR_CUSTOMER,
    assignedTo: 'support-2',
    tags: ['billing', 'invoice'],
    attachmentUrls: [],
    responses: [],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
  {
    id: '3',
    ticketNumber: 'TKT-003',
    tenantId: 'hotel-3',
    userId: 'user-3',
    subject: 'Feature request: Guest preferences',
    description: 'Request to add guest preference tracking to improve service.',
    category: 'Feature Request',
    priority: TicketPriority.LOW,
    status: TicketStatus.OPEN,
    tags: ['feature', 'enhancement'],
    attachmentUrls: [],
    responses: [],
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
];

export async function getTickets(
  tenantId?: string,
  status?: TicketStatus,
  priority?: TicketPriority,
  limit?: number,
  offset?: number
): Promise<SupportTicket[]> {
  // Mock implementation - in production, query from database
  let filtered = [...DEFAULT_TICKETS];

  if (tenantId) {
    filtered = filtered.filter(t => t.tenantId === tenantId);
  }

  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }

  if (priority) {
    filtered = filtered.filter(t => t.priority === priority);
  }

  const start = offset || 0;
  const end = start + (limit || 10);

  return filtered.slice(start, end);
}

export async function getTicket(ticketId: string): Promise<SupportTicket | null> {
  return DEFAULT_TICKETS.find(t => t.id === ticketId) || null;
}

export async function createTicket(
  tenantId: string,
  userId: string,
  data: {
    subject: string;
    description: string;
    category: string;
    priority: TicketPriority;
    tags?: string[];
  }
): Promise<SupportTicket> {
  // Mock implementation
  const ticketNumber = `TKT-${String(DEFAULT_TICKETS.length + 1).padStart(3, '0')}`;

  const ticket: SupportTicket = {
    id: `ticket-${Date.now()}`,
    ticketNumber,
    tenantId,
    userId,
    subject: data.subject,
    description: data.description,
    category: data.category,
    priority: data.priority,
    status: TicketStatus.OPEN,
    tags: data.tags || [],
    attachmentUrls: [],
    responses: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  DEFAULT_TICKETS.push(ticket);
  return ticket;
}

export async function updateTicketStatus(
  ticketId: string,
  status: TicketStatus,
  resolutionNotes?: string
): Promise<SupportTicket | null> {
  const ticket = DEFAULT_TICKETS.find(t => t.id === ticketId);

  if (!ticket) return null;

  ticket.status = status;
  ticket.updatedAt = new Date();

  if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
    ticket.resolvedAt = new Date();
    ticket.resolutionNotes = resolutionNotes;
  }

  return ticket;
}

export async function assignTicket(
  ticketId: string,
  supportAgentId: string
): Promise<SupportTicket | null> {
  const ticket = DEFAULT_TICKETS.find(t => t.id === ticketId);

  if (!ticket) return null;

  ticket.assignedTo = supportAgentId;
  ticket.status = TicketStatus.IN_PROGRESS;
  ticket.updatedAt = new Date();

  return ticket;
}

export async function addTicketResponse(
  ticketId: string,
  senderId: string,
  senderType: 'customer' | 'support' | 'admin',
  message: string,
  attachmentUrls?: string[]
): Promise<TicketResponse> {
  const ticket = DEFAULT_TICKETS.find(t => t.id === ticketId);

  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const response: TicketResponse = {
    id: `resp-${Date.now()}`,
    ticketId,
    senderId,
    senderType,
    message,
    attachmentUrls: attachmentUrls || [],
    createdAt: new Date(),
  };

  ticket.responses.push(response);
  ticket.updatedAt = new Date();

  return response;
}

export async function getTicketStats(tenantId?: string): Promise<TicketStats> {
  let tickets = [...DEFAULT_TICKETS];

  if (tenantId) {
    tickets = tickets.filter(t => t.tenantId === tenantId);
  }

  const categories = new Map<string, number>();
  const priorityCounts: Record<TicketPriority, number> = {
    [TicketPriority.LOW]: 0,
    [TicketPriority.MEDIUM]: 0,
    [TicketPriority.HIGH]: 0,
    [TicketPriority.URGENT]: 0,
  };
  const statusCounts: Record<TicketStatus, number> = {
    [TicketStatus.OPEN]: 0,
    [TicketStatus.IN_PROGRESS]: 0,
    [TicketStatus.WAITING_FOR_CUSTOMER]: 0,
    [TicketStatus.ON_HOLD]: 0,
    [TicketStatus.RESOLVED]: 0,
    [TicketStatus.CLOSED]: 0,
  };

  let totalResolutionTime = 0;
  let totalResponseTime = 0;
  let resolvedCount = 0;
  let respondedCount = 0;

  for (const ticket of tickets) {
    // Category counts
    categories.set(ticket.category, (categories.get(ticket.category) || 0) + 1);

    // Priority and status counts
    priorityCounts[ticket.priority]++;
    statusCounts[ticket.status]++;

    // Resolution time (if resolved)
    if (ticket.resolvedAt) {
      const resolutionTime = (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
      totalResolutionTime += resolutionTime;
      resolvedCount++;
    }

    // Response time (if has responses)
    if (ticket.responses.length > 0) {
      const responseTime = (ticket.responses[0].createdAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60 * 60);
      totalResponseTime += responseTime;
      respondedCount++;
    }
  }

  const topCategories = Array.from(categories.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalTickets: tickets.length,
    openTickets: statusCounts[TicketStatus.OPEN],
    inProgressTickets: statusCounts[TicketStatus.IN_PROGRESS],
    resolvedTickets: statusCounts[TicketStatus.RESOLVED],
    closedTickets: statusCounts[TicketStatus.CLOSED],
    averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
    averageResponseTime: respondedCount > 0 ? totalResponseTime / respondedCount : 0,
    topCategories,
    priorityDistribution: priorityCounts,
    statusDistribution: statusCounts,
  };
}

export async function searchTickets(
  query: string,
  tenantId?: string
): Promise<SupportTicket[]> {
  const lowerQuery = query.toLowerCase();
  let tickets = [...DEFAULT_TICKETS];

  if (tenantId) {
    tickets = tickets.filter(t => t.tenantId === tenantId);
  }

  return tickets.filter(
    t =>
      t.ticketNumber.toLowerCase().includes(lowerQuery) ||
      t.subject.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
