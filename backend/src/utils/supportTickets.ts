import { prisma } from './prisma';
import { createAuditLog } from './audit';

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

// Mock storage - in production would use Firestore/PostgreSQL
const ticketsStorage = new Map<string, SupportTicket>();

// Generate mock tickets for demo
const initializeMockTickets = () => {
  if (ticketsStorage.size === 0) {
    const mockTickets: SupportTicket[] = [
      {
        id: 'tk-001',
        tenantId: 'tenant-1',
        subject: 'Payment processing issue',
        description: 'Unable to process credit card payments',
        category: 'billing',
        priority: 'high',
        status: 'in-progress',
        requesterEmail: 'john@hotel1.com',
        requesterName: 'John Doe',
        assignedTo: 'staff-1',
        messages: [
          {
            from: 'john@hotel1.com',
            message: 'We are unable to process any payments today',
            timestamp: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            from: 'support@innsight.com',
            message: 'Thank you for reporting this. We are investigating.',
            timestamp: new Date(Date.now() - 72000000).toISOString(),
          },
        ],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'tk-002',
        tenantId: 'tenant-2',
        subject: 'Room category not showing',
        description: 'Custom room categories not displaying in the system',
        category: 'bug',
        priority: 'medium',
        status: 'waiting-customer',
        requesterEmail: 'manager@hotel2.com',
        requesterName: 'Jane Smith',
        assignedTo: 'staff-2',
        messages: [
          {
            from: 'manager@hotel2.com',
            message: 'The new room categories I created are not showing up',
            timestamp: new Date(Date.now() - 172800000).toISOString(),
          },
          {
            from: 'support@innsight.com',
            message: 'Can you try clearing your browser cache? Reply with results.',
            timestamp: new Date(Date.now() - 169200000).toISOString(),
          },
        ],
        createdAt: new Date(Date.now() - 172800000).toISOString(),
        updatedAt: new Date(Date.now() - 169200000).toISOString(),
      },
      {
        id: 'tk-003',
        subject: 'API rate limit increased',
        description: 'Request for higher API rate limits for bulk operations',
        category: 'feature-request',
        priority: 'low',
        status: 'open',
        requesterEmail: 'dev@partner.com',
        requesterName: 'Developer Partner',
        messages: [
          {
            from: 'dev@partner.com',
            message: 'We need to increase our API rate limit to 10k requests/min',
            timestamp: new Date(Date.now() - 259200000).toISOString(),
          },
        ],
        createdAt: new Date(Date.now() - 259200000).toISOString(),
        updatedAt: new Date(Date.now() - 259200000).toISOString(),
      },
    ];

    mockTickets.forEach(ticket => {
      ticketsStorage.set(ticket.id, ticket);
    });
  }
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
  initializeMockTickets();
  
  let tickets = Array.from(ticketsStorage.values());

  if (filters) {
    if (filters.tenantId) {
      tickets = tickets.filter(t => t.tenantId === filters.tenantId);
    }
    if (filters.status) {
      tickets = tickets.filter(t => t.status === filters.status);
    }
    if (filters.priority) {
      tickets = tickets.filter(t => t.priority === filters.priority);
    }
    if (filters.category) {
      tickets = tickets.filter(t => t.category === filters.category);
    }
    if (filters.assignedTo) {
      tickets = tickets.filter(t => t.assignedTo === filters.assignedTo);
    }
  }

  // Sort by priority then by date
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  tickets.sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return tickets.slice(offset, offset + limit);
}

export async function getTicket(ticketId: string): Promise<SupportTicket | null> {
  initializeMockTickets();
  return ticketsStorage.get(ticketId) || null;
}

export async function createTicket(
  data: Omit<SupportTicket, 'id' | 'createdAt' | 'updatedAt' | 'messages'>
): Promise<SupportTicket> {
  initializeMockTickets();
  
  const id = `tk-${Date.now()}`;
  const now = new Date().toISOString();

  const ticket: SupportTicket = {
    ...data,
    id,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };

  ticketsStorage.set(id, ticket);

  await createAuditLog({
    action: 'CREATE_TICKET',
    entityType: 'SupportTicket',
    resourceId: id,
    changes: ticket,
    status: 'success'
  });

  return ticket;
}

export async function updateTicket(
  ticketId: string,
  updates: Partial<Omit<SupportTicket, 'id' | 'createdAt' | 'messages'>>
): Promise<SupportTicket | null> {
  initializeMockTickets();
  
  const ticket = ticketsStorage.get(ticketId);
  if (!ticket) return null;

  const updated = {
    ...ticket,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  ticketsStorage.set(ticketId, updated);

  await createAuditLog({
    action: 'UPDATE_TICKET',
    entityType: 'SupportTicket',
    resourceId: ticketId,
    changes: updates,
    status: 'success'
  });

  return updated;
}

export async function addTicketMessage(
  ticketId: string,
  message: {
    from: string;
    message: string;
    attachments?: { url: string; fileName: string }[];
  }
): Promise<SupportTicket | null> {
  initializeMockTickets();
  
  const ticket = ticketsStorage.get(ticketId);
  if (!ticket) return null;

  const newMessage = {
    ...message,
    timestamp: new Date().toISOString(),
  };

  ticket.messages.push(newMessage);
  ticket.updatedAt = new Date().toISOString();

  // Auto-update status based on reply
  if (message.from.includes('support@')) {
    ticket.status = 'waiting-customer';
  } else if (message.from !== ticket.requesterEmail) {
    ticket.status = 'in-progress';
  }

  ticketsStorage.set(ticketId, ticket);

  await createAuditLog({
    action: 'ADD_MESSAGE',
    entityType: 'SupportTicket',
    resourceId: ticketId,
    changes: { message: newMessage },
    status: 'success'
  });

  return ticket;
}

export async function getTicketStats(tenantId?: string): Promise<TicketStats> {
  initializeMockTickets();
  
  let tickets = Array.from(ticketsStorage.values());
  
  if (tenantId) {
    tickets = tickets.filter(t => t.tenantId === tenantId);
  }

  const stats: TicketStats = {
    totalTickets: tickets.length,
    openTickets: tickets.filter(t => t.status !== 'closed' && t.status !== 'resolved').length,
    averageResolutionTime: 24, // Mock: 24 hours
    averageResponseTime: 2, // Mock: 2 hours
    satisfactionScore: 4.2,
    ticketsByPriority: {
      low: tickets.filter(t => t.priority === 'low').length,
      medium: tickets.filter(t => t.priority === 'medium').length,
      high: tickets.filter(t => t.priority === 'high').length,
      critical: tickets.filter(t => t.priority === 'critical').length,
    },
    ticketsByCategory: {
      billing: tickets.filter(t => t.category === 'billing').length,
      technical: tickets.filter(t => t.category === 'technical').length,
      'feature-request': tickets.filter(t => t.category === 'feature-request').length,
      bug: tickets.filter(t => t.category === 'bug').length,
      other: tickets.filter(t => t.category === 'other').length,
    },
    ticketsByStatus: {
      open: tickets.filter(t => t.status === 'open').length,
      'in-progress': tickets.filter(t => t.status === 'in-progress').length,
      'waiting-customer': tickets.filter(t => t.status === 'waiting-customer').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
      closed: tickets.filter(t => t.status === 'closed').length,
    },
  };

  return stats;
}
