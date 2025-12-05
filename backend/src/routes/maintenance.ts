import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createRoomLog } from '../utils/roomLogs';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { db, now, toDate } from '../utils/firestore';
import admin from 'firebase-admin';

export const maintenanceRouter = Router({ mergeParams: true });

const getUserDisplayName = (user?: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}) => {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || null;
};

const createTicketSchema = z.object({
  roomId: z.string().optional(),
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
    try {
      const tenantId = req.params.tenantId;
      const { status, priority, roomId } = req.query;
      const { page, limit } = getPaginationParams(req);

      // Build Firestore query
      let query: admin.firestore.Query = db.collection('maintenanceTickets')
        .where('tenantId', '==', tenantId);

      if (status) {
        query = query.where('status', '==', status);
      }
      if (priority) {
        query = query.where('priority', '==', priority);
      }
      if (roomId) {
        query = query.where('roomId', '==', roomId);
      }

      // Get all tickets first (for sorting)
      const allTicketsSnapshot = await query.get();
      const total = allTicketsSnapshot.size;

      // Sort by priority (desc) and createdAt (desc)
      const sortedTickets = allTicketsSnapshot.docs.sort((a, b) => {
        const aData = a.data();
        const bData = b.data();
        
        // Priority order: urgent > high > medium > low
        const priorityOrder: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = (priorityOrder[bData.priority] || 0) - (priorityOrder[aData.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;

        // Then by createdAt (desc)
        const aCreated = toDate(aData.createdAt);
        const bCreated = toDate(bData.createdAt);
        if (!aCreated || !bCreated) return 0;
        return bCreated.getTime() - aCreated.getTime();
      });

      // Apply pagination
      const skip = (page - 1) * limit;
      const paginatedTickets = sortedTickets.slice(skip, skip + limit);

      // Enrich with related data
      const tickets = await Promise.all(
        paginatedTickets.map(async (doc) => {
          const data = doc.data();
          const ticket: any = {
            id: doc.id,
            roomId: data.roomId || null,
            title: data.title,
            description: data.description,
            priority: data.priority || 'medium',
            status: data.status || 'open',
            photos: data.photos || [],
            reportedBy: data.reportedBy || null,
            assignedTo: data.assignedTo || null,
            createdAt: toDate(data.createdAt),
            updatedAt: toDate(data.updatedAt),
            resolvedAt: data.resolvedAt ? toDate(data.resolvedAt) : null,
          };

          // Fetch room data
          if (data.roomId) {
            try {
              const roomDoc = await db.collection('rooms').doc(data.roomId).get();
              if (roomDoc.exists) {
                const roomData = roomDoc.data();
                ticket.room = {
                  id: roomDoc.id,
                  roomNumber: roomData?.roomNumber || null,
                };
              }
            } catch (error) {
              console.error('Error fetching room:', error);
            }
          }

          // Fetch reporter data
          if (data.reportedBy) {
            try {
              const reporterDoc = await db.collection('users').doc(data.reportedBy).get();
              if (reporterDoc.exists) {
                const reporterData = reporterDoc.data();
                ticket.reporter = {
                  id: reporterDoc.id,
                  firstName: reporterData?.firstName || null,
                  lastName: reporterData?.lastName || null,
                };
              }
            } catch (error) {
              console.error('Error fetching reporter:', error);
            }
          }

          // Fetch assigned staff data
          if (data.assignedTo) {
            try {
              const staffDoc = await db.collection('users').doc(data.assignedTo).get();
              if (staffDoc.exists) {
                const staffData = staffDoc.data();
                ticket.assignedStaff = {
                  id: staffDoc.id,
                  firstName: staffData?.firstName || null,
                  lastName: staffData?.lastName || null,
                };
              }
            } catch (error) {
              console.error('Error fetching assigned staff:', error);
            }
          }

          return ticket;
        })
      );

      const result = createPaginationResult(tickets, total, page, limit);

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching maintenance tickets:', error);
      throw new AppError(
        `Failed to fetch maintenance tickets: ${error.message || 'Database connection error'}`,
        500
      );
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
      const data = createTicketSchema.parse(req.body);

      const ticketRef = db.collection('maintenanceTickets').doc();
      const ticketData = {
        tenantId,
        roomId: data.roomId || null,
        title: data.title,
        description: data.description,
        priority: data.priority,
        photos: data.photos || [],
        status: 'open',
        reportedBy: req.user!.id,
        assignedTo: null,
        createdAt: now(),
        updatedAt: now(),
        resolvedAt: null,
      };

      await ticketRef.set(ticketData);

      // Fetch room data if roomId provided
      let room: { id: string; roomNumber: string | null } | null = null;
      if (data.roomId) {
        try {
          const roomDoc = await db.collection('rooms').doc(data.roomId).get();
          if (roomDoc.exists) {
            const roomData = roomDoc.data();
            room = {
              id: roomDoc.id,
              roomNumber: roomData?.roomNumber || null,
            };
          }
        } catch (error) {
          console.error('Error fetching room:', error);
        }
      }

      // Fetch reporter data
      let reporter: { id: string; firstName: string | null; lastName: string | null } | null = null;
      try {
        const reporterDoc = await db.collection('users').doc(req.user!.id).get();
        if (reporterDoc.exists) {
          const reporterData = reporterDoc.data();
          reporter = {
            id: reporterDoc.id,
            firstName: reporterData?.firstName || null,
            lastName: reporterData?.lastName || null,
          };
        }
      } catch (error) {
        console.error('Error fetching reporter:', error);
      }

      const ticket = {
        id: ticketRef.id,
        ...ticketData,
        room,
        reporter,
        createdAt: toDate(ticketData.createdAt),
        updatedAt: toDate(ticketData.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_maintenance_ticket',
        entityType: 'maintenance_ticket',
        entityId: ticketRef.id,
        afterState: ticket,
      });

      res.status(201).json({
        success: true,
        data: ticket,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error creating maintenance ticket:', error);
      throw new AppError(
        `Failed to create maintenance ticket: ${error.message || 'Database connection error'}`,
        500
      );
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
      const ticketId = req.params.id;

      const ticketDoc = await db.collection('maintenanceTickets').doc(ticketId).get();

      if (!ticketDoc.exists) {
        throw new AppError('Ticket not found', 404);
      }

      const ticketData = ticketDoc.data();
      if (ticketData?.tenantId !== tenantId) {
        throw new AppError('Ticket not found', 404);
      }

      const beforeState: any = {
        id: ticketDoc.id,
        ...ticketData,
        createdAt: toDate(ticketData.createdAt),
        updatedAt: toDate(ticketData.updatedAt),
      };

      // Update ticket
      const updateData: any = {
        updatedAt: now(),
      };

      if (req.body.status !== undefined) updateData.status = req.body.status;
      if (req.body.priority !== undefined) updateData.priority = req.body.priority;
      if (req.body.assignedTo !== undefined) updateData.assignedTo = req.body.assignedTo || null;
      if (req.body.title !== undefined) updateData.title = req.body.title;
      if (req.body.description !== undefined) updateData.description = req.body.description;
      if (req.body.photos !== undefined) updateData.photos = req.body.photos || [];

      if (req.body.status === 'resolved' || req.body.status === 'closed') {
        updateData.resolvedAt = now();
      }

      await ticketDoc.ref.update(updateData);

      // Get updated ticket
      const updatedDoc = await db.collection('maintenanceTickets').doc(ticketId).get();
      const updatedData = updatedDoc.data();

      const afterState: any = {
        id: updatedDoc.id,
        ...updatedData,
        createdAt: toDate(updatedData?.createdAt),
        updatedAt: toDate(updatedData?.updatedAt),
      };

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_maintenance_ticket',
        entityType: 'maintenance_ticket',
        entityId: ticketId,
        beforeState,
        afterState,
      });

      // Create room log if status changed to resolved/closed
      if (
        ticketData.roomId &&
        beforeState.status !== afterState.status &&
        ['resolved', 'closed'].includes(afterState.status)
      ) {
        await createRoomLog({
          tenantId,
          roomId: ticketData.roomId,
          type: 'maintenance_completed',
          summary: `Maintenance ticket "${ticketData.title}" marked ${afterState.status}`,
          metadata: {
            ticketId,
            status: afterState.status,
          },
          user: {
            id: req.user?.id || null,
            name: getUserDisplayName(req.user),
          },
        });
      }

      res.json({
        success: true,
        data: afterState,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating maintenance ticket:', error);
      throw new AppError(
        `Failed to update maintenance ticket: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);
