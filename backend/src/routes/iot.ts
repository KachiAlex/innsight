import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { createAlert } from '../utils/alerts';

export const iotRouter = Router();

const eventSchema = z.object({
  gatewayId: z.string(),
  sensorId: z.string(),
  roomId: z.string().uuid().optional(),
  eventType: z.enum(['occupied', 'vacant', 'door_open', 'door_close']),
  timestamp: z.string().datetime(),
  metadata: z.any().optional(),
});

// POST /api/iot/{gatewayId}/event - Ingest occupancy events
iotRouter.post('/:gatewayId/event', authenticate, async (req: AuthRequest, res) => {
  const gatewayId = req.params.gatewayId;
  const data = eventSchema.parse(req.body);

  // Find gateway and tenant
  const gateway = await prisma.ioTGateway.findUnique({
    where: { gatewayId },
    include: { tenant: true },
  });

  if (!gateway) {
    throw new AppError('Gateway not found', 404);
  }

  const tenantId = gateway.tenantId;

  // Create IoT event
  const event = await prisma.ioTEvent.create({
    data: {
      tenantId,
      gatewayId,
      sensorId: data.sensorId,
      roomId: data.roomId,
      eventType: data.eventType,
      timestamp: new Date(data.timestamp),
      metadata: data.metadata || null,
    },
  });

  // If room is specified, check for mismatches
  if (data.roomId) {
    const room = await prisma.room.findUnique({
      where: { id: data.roomId },
      include: {
        reservations: {
          where: {
            status: {
              in: ['confirmed', 'checked_in'],
            },
            checkInDate: { lte: new Date() },
            checkOutDate: { gte: new Date() },
          },
        },
      },
    });

    if (room) {
      // Check for occupancy mismatch
      if (data.eventType === 'occupied' && room.status !== 'occupied' && room.reservations.length === 0) {
        await createAlert({
          tenantId,
          alertType: 'occupancy_mismatch',
          severity: 'medium',
          title: 'Occupancy Mismatch Detected',
          message: `Room ${room.roomNumber} shows occupied but has no active reservation`,
          metadata: {
            roomId: data.roomId,
            eventType: data.eventType,
            roomStatus: room.status,
          },
        });
      }

      // Update room status based on event
      if (data.eventType === 'occupied') {
        await prisma.room.update({
          where: { id: data.roomId },
          data: { status: 'occupied' },
        });
      } else if (data.eventType === 'vacant') {
        await prisma.room.update({
          where: { id: data.roomId },
          data: { status: 'dirty' },
        });
      }
    }
  }

  res.status(201).json({
    success: true,
    data: event,
  });
});

// GET /api/tenants/:tenantId/rooms/:roomId/occupancy
iotRouter.get(
  '/rooms/:roomId/occupancy',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const roomId = req.params.roomId;

    const latestEvent = await prisma.ioTEvent.findFirst({
      where: {
        tenantId,
        roomId,
      },
      orderBy: { timestamp: 'desc' },
    });

    const room = await prisma.room.findFirst({
      where: {
        id: roomId,
        tenantId,
      },
    });

    res.json({
      success: true,
      data: {
        roomId,
        currentStatus: room?.status || 'unknown',
        lastEvent: latestEvent,
      },
    });
  }
);

// GET /api/tenants/:tenantId/iot/alerts
iotRouter.get(
  '/alerts',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;

    const alerts = await prisma.alert.findMany({
      where: {
        tenantId,
        alertType: {
          in: ['occupancy_mismatch', 'occupancy_not_matched'],
        },
        status: 'open',
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      data: alerts,
    });
  }
);
