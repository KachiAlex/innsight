import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';

export const overbookingRouter = Router({ mergeParams: true });

const toNumber = (v: any) => (v === null || v === undefined ? null : Number(v));

const serializeSetting = (s: any) => ({
  ...s,
  maxOverbookingPercent: toNumber(s.maxOverbookingPercent),
  alertThresholdPercent: toNumber(s.alertThresholdPercent),
  criticalThresholdPercent: toNumber(s.criticalThresholdPercent),
});

const serializeAlert = (a: any) => ({
  ...a,
  overbookingPercent: toNumber(a.overbookingPercent),
});

const settingSchema = z.object({
  roomCategoryId: z.string().uuid().nullable().optional(),
  roomType: z.string().nullable().optional(),
  maxOverbookingPercent: z.number().min(0).max(100).optional(),
  maxOverbookingCount: z.number().int().min(0).nullable().optional(),
  alertThresholdPercent: z.number().min(0).max(100).optional(),
  criticalThresholdPercent: z.number().min(0).max(100).optional(),
  allowOverbooking: z.boolean().optional(),
  requireManagerApproval: z.boolean().optional(),
  blackoutDates: z.array(z.string()).optional(),
});

// GET /api/tenants/:tenantId/overbooking/settings
overbookingRouter.get(
  '/settings',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const settings = await prisma.overbookingSetting.findMany({
        where: { tenantId: req.params.tenantId },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ success: true, data: settings.map(serializeSetting) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch overbooking settings: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/overbooking/settings
overbookingRouter.post(
  '/settings',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = settingSchema.parse(req.body);

      const existing = await prisma.overbookingSetting.findFirst({
        where: {
          tenantId,
          roomCategoryId: data.roomCategoryId ?? null,
          roomType: data.roomType ?? null,
        },
      });

      const setting = existing
        ? await prisma.overbookingSetting.update({
            where: { id: existing.id },
            data: {
              ...(data.maxOverbookingPercent !== undefined && {
                maxOverbookingPercent: data.maxOverbookingPercent,
              }),
              ...(data.maxOverbookingCount !== undefined && {
                maxOverbookingCount: data.maxOverbookingCount,
              }),
              ...(data.alertThresholdPercent !== undefined && {
                alertThresholdPercent: data.alertThresholdPercent,
              }),
              ...(data.criticalThresholdPercent !== undefined && {
                criticalThresholdPercent: data.criticalThresholdPercent,
              }),
              ...(data.allowOverbooking !== undefined && {
                allowOverbooking: data.allowOverbooking,
              }),
              ...(data.requireManagerApproval !== undefined && {
                requireManagerApproval: data.requireManagerApproval,
              }),
              ...(data.blackoutDates !== undefined && {
                blackoutDates: data.blackoutDates.map((d) => new Date(d)),
              }),
            },
          })
        : await prisma.overbookingSetting.create({
            data: {
              tenantId,
              roomCategoryId: data.roomCategoryId ?? null,
              roomType: data.roomType ?? null,
              maxOverbookingPercent: data.maxOverbookingPercent ?? 10,
              maxOverbookingCount: data.maxOverbookingCount ?? null,
              alertThresholdPercent: data.alertThresholdPercent ?? 5,
              criticalThresholdPercent: data.criticalThresholdPercent ?? 8,
              allowOverbooking: data.allowOverbooking ?? false,
              requireManagerApproval: data.requireManagerApproval ?? true,
              blackoutDates: (data.blackoutDates ?? []).map((d) => new Date(d)),
            },
          });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'upsert_overbooking_setting',
        entityType: 'overbooking_setting',
        entityId: setting.id,
        afterState: serializeSetting(setting),
      });

      res.status(201).json({ success: true, data: serializeSetting(setting) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to save overbooking setting: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/overbooking/settings/:id
overbookingRouter.delete(
  '/settings/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const setting = await prisma.overbookingSetting.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!setting) throw new AppError('Setting not found', 404);

      await prisma.overbookingSetting.delete({ where: { id: setting.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_overbooking_setting',
        entityType: 'overbooking_setting',
        entityId: setting.id,
        beforeState: serializeSetting(setting),
      });

      res.json({ success: true, message: 'Setting deleted' });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete overbooking setting: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/overbooking/alerts
overbookingRouter.get(
  '/alerts',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { status } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId };
      if (status) where.status = status;

      const [alerts, total] = await Promise.all([
        prisma.overbookingAlert.findMany({
          where,
          orderBy: { date: 'desc' },
          skip,
          take,
        }),
        prisma.overbookingAlert.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(alerts.map(serializeAlert), total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch overbooking alerts: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/overbooking/alerts/:id/resolve
overbookingRouter.post(
  '/alerts/:id/resolve',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const alert = await prisma.overbookingAlert.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!alert) throw new AppError('Alert not found', 404);

      const updated = await prisma.overbookingAlert.update({
        where: { id: alert.id },
        data: {
          status: 'resolved',
          resolvedAt: new Date(),
          resolvedBy: req.user!.id,
          resolutionNotes: req.body?.resolutionNotes ?? null,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'resolve_overbooking_alert',
        entityType: 'overbooking_alert',
        entityId: alert.id,
        beforeState: serializeAlert(alert),
        afterState: serializeAlert(updated),
      });

      res.json({ success: true, data: serializeAlert(updated) });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to resolve overbooking alert: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/overbooking/check?date=YYYY-MM-DD — current booking vs capacity per room type
overbookingRouter.get(
  '/check',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const dateParam = (req.query.date as string) || new Date().toISOString().slice(0, 10);
      const day = new Date(dateParam);
      if (isNaN(day.getTime())) throw new AppError('Invalid date', 400);
      const nextDay = new Date(day.getTime() + 86400000);

      const [rooms, reservations] = await Promise.all([
        prisma.room.groupBy({
          by: ['roomType'],
          where: { tenantId, status: { notIn: ['blocked', 'out_of_order'] } },
          _count: true,
        }),
        prisma.reservation.groupBy({
          by: ['roomId'],
          where: {
            tenantId,
            status: { in: ['confirmed', 'checked_in'] },
            checkInDate: { lt: nextDay },
            checkOutDate: { gt: day },
          },
          _count: true,
        }),
      ]);

      // Map roomId → roomType for booked counts
      const roomTypes = await prisma.room.findMany({
        where: { id: { in: reservations.map((r) => r.roomId) }, tenantId },
        select: { id: true, roomType: true },
      });
      const roomTypeById = new Map<string, string>(
        roomTypes.map((r) => [r.id, r.roomType])
      );

      const bookedByType = new Map<string, number>();
      for (const r of reservations) {
        const rt = roomTypeById.get(r.roomId) || 'unknown';
        bookedByType.set(rt, (bookedByType.get(rt) || 0) + r._count._all);
      }

      const settings = await prisma.overbookingSetting.findMany({ where: { tenantId } });

      const data = rooms.map((g) => {
        const capacity = g._count._all;
        const booked = bookedByType.get(g.roomType) || 0;
        const setting = settings.find(
          (s) => s.roomType === g.roomType || (s.roomType === null && s.roomCategoryId === null)
        );
        const maxPercent = setting ? Number(setting.maxOverbookingPercent) : 0;
        const allowed = setting?.allowOverbooking
          ? Math.floor((capacity * maxPercent) / 100)
          : 0;
        const overbooked = Math.max(0, booked - capacity);
        return {
          roomType: g.roomType,
          date: dateParam,
          capacity,
          booked,
          available: Math.max(0, capacity - booked),
          overbooked,
          overbookingAllowed: overbooked === 0 ? allowed : Math.max(0, allowed - overbooked),
          exceedsLimit: overbooked > allowed,
        };
      });

      res.json({ success: true, data });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to check overbooking: ${error.message}`, 500);
    }
  }
);
