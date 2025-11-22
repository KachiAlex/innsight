import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';

export const maintenanceRouter = Router({ mergeParams: true });

const createTicketSchema = z.object({
  roomId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  photos: z.array(z.string()).optional(),
});

// GET /api/tenants/:tenantId/maintenance
maintenanceRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const { status, priority, roomId } = req.query;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (roomId) where.roomId = roomId;

    const { skip, take, page, limit } = getPaginationParams(req);

    const [tickets, total] = await Promise.all([
      prisma.maintenanceTicket.findMany({
        where,
        include: {
          room: {
            select: {
              id: true,
              roomNumber: true,
            },
          },
          reporter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          assignedStaff: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip,
        take,
      }),
      prisma.maintenanceTicket.count({ where }),
    ]);

    const result = createPaginationResult(tickets, total, page, limit);

    res.json({
      success: true,
      ...result,
    });
  }
);

// POST /api/tenants/:tenantId/maintenance
maintenanceRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const data = createTicketSchema.parse(req.body);

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        tenantId,
        roomId: data.roomId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        photos: data.photos || undefined,
        reportedBy: req.user!.id,
      },
      include: {
        room: true,
        reporter: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'create_maintenance_ticket',
      entityType: 'maintenance_ticket',
      entityId: ticket.id,
      afterState: ticket,
    });

    res.status(201).json({
      success: true,
      data: ticket,
    });
  }
);

// PATCH /api/tenants/:tenantId/maintenance/:id
maintenanceRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const ticketId = req.params.id;

    const ticket = await prisma.maintenanceTicket.findFirst({
      where: {
        id: ticketId,
        tenantId,
      },
    });

    if (!ticket) {
      throw new AppError('Ticket not found', 404);
    }

    const beforeState = { ...ticket };
    const updated = await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: req.body,
    });

    await createAuditLog({
      tenantId,
      userId: req.user!.id,
      action: 'update_maintenance_ticket',
      entityType: 'maintenance_ticket',
      entityId: ticketId,
      beforeState,
      afterState: updated,
    });

    res.json({
      success: true,
      data: updated,
    });
  }
);
