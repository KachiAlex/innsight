import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import { createRoomLog } from '../utils/roomLogs';

export const maintenanceRouter = Router({ mergeParams: true });

const staffSelect = {
  select: { id: true, firstName: true, lastName: true, email: true },
};

const ticketInclude = {
  room: { select: { id: true, roomNumber: true, roomType: true, floor: true, status: true } },
  assignedStaff: staffSelect,
  reporter: staffSelect,
  resolver: staffSelect,
};

const ticketSchema = z.object({
  roomId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  status: z.string().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  photos: z.any().optional(),
  notes: z.string().nullable().optional(),
});

// GET /api/tenants/:tenantId/maintenance
maintenanceRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status, priority, roomId, assignedTo } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (roomId) where.roomId = roomId;
      if (assignedTo) where.assignedTo = assignedTo;

      const [tickets, total] = await Promise.all([
        prisma.maintenanceTicket.findMany({
          where,
          include: ticketInclude,
          orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
          skip,
          take,
        }),
        prisma.maintenanceTicket.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(tickets, total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch maintenance tickets: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/maintenance/:id
maintenanceRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const ticket = await prisma.maintenanceTicket.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId },
        include: ticketInclude,
      });
      if (!ticket) throw new AppError('Ticket not found', 404);
      res.json({ success: true, data: ticket });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to fetch ticket: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/maintenance
maintenanceRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = ticketSchema.parse(req.body);

      if (data.roomId) {
        const room = await prisma.room.findFirst({
          where: { id: data.roomId, tenantId },
        });
        if (!room) throw new AppError('Room not found', 404);
      }

      const ticket = await prisma.maintenanceTicket.create({
        data: {
          tenantId,
          roomId: data.roomId ?? null,
          title: data.title,
          description: data.description,
          priority: data.priority || 'medium',
          status: data.status || 'open',
          assignedTo: data.assignedTo ?? null,
          reportedBy: req.user!.id,
          photos: data.photos ?? undefined,
          notes: data.notes ?? null,
        },
        include: ticketInclude,
      });

      if (data.roomId) {
        await createRoomLog({
          tenantId,
          roomId: data.roomId,
          type: 'maintenance',
          summary: `Maintenance ticket opened: ${data.title}`,
          user: { id: req.user!.id, name: req.user!.email },
        }).catch(() => undefined);
      }

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_maintenance_ticket',
        entityType: 'maintenance_ticket',
        entityId: ticket.id,
        afterState: ticket,
      });

      res.status(201).json({ success: true, data: ticket });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create maintenance ticket: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/maintenance/:id
maintenanceRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const ticket = await prisma.maintenanceTicket.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!ticket) throw new AppError('Ticket not found', 404);

      const data = ticketSchema.partial().parse(req.body);
      const resolving = data.status === 'resolved' && ticket.status !== 'resolved';

      const updated = await prisma.maintenanceTicket.update({
        where: { id: ticket.id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo }),
          ...(data.roomId !== undefined && { roomId: data.roomId }),
          ...(data.photos !== undefined && { photos: data.photos }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(resolving && { resolvedBy: req.user!.id, resolvedAt: new Date() }),
        },
        include: ticketInclude,
      });

      if (resolving && ticket.roomId) {
        await prisma.room.updateMany({
          where: { id: ticket.roomId, status: 'maintenance' },
          data: { status: 'available', lastStatusUpdate: new Date(), lastStatusUpdateBy: req.user!.id },
        });
        await createRoomLog({
          tenantId,
          roomId: ticket.roomId,
          type: 'maintenance',
          summary: `Maintenance ticket resolved: ${ticket.title}`,
          user: { id: req.user!.id, name: req.user!.email },
        }).catch(() => undefined);
      }

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_maintenance_ticket',
        entityType: 'maintenance_ticket',
        entityId: ticket.id,
        beforeState: ticket,
        afterState: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update maintenance ticket: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/maintenance/:id
maintenanceRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const ticket = await prisma.maintenanceTicket.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!ticket) throw new AppError('Ticket not found', 404);

      await prisma.maintenanceTicket.delete({ where: { id: ticket.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_maintenance_ticket',
        entityType: 'maintenance_ticket',
        entityId: ticket.id,
        beforeState: ticket,
      });

      res.json({ success: true, message: 'Ticket deleted' });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete maintenance ticket: ${error.message}`, 500);
    }
  }
);
