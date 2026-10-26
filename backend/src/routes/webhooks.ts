import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';

export const webhooksRouter = Router({ mergeParams: true });

const webhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string().min(1)).min(1),
  secret: z.string().optional(),
  isActive: z.boolean().optional(),
});

const WEBHOOK_EVENTS = [
  'reservation.created',
  'reservation.updated',
  'reservation.checked_in',
  'reservation.checked_out',
  'reservation.cancelled',
  'payment.completed',
  'payment.failed',
  'guest_request.created',
  'guest_request.updated',
  'housekeeping.completed',
];

const signPayload = (payload: string, secret: string) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

// GET /api/tenants/:tenantId/webhooks
webhooksRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { tenantId: req.params.tenantId },
        orderBy: { createdAt: 'desc' },
      });
      // Never echo secrets back
      res.json({
        success: true,
        data: webhooks.map((w) => ({ ...w, secret: w.secret ? '••••••••' : null })),
      });
    } catch (error: any) {
      throw new AppError(`Failed to fetch webhooks: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/webhooks/events — supported event types
webhooksRouter.get(
  '/events',
  authenticate,
  requireTenantAccess,
  async (_req: AuthRequest, res) => {
    res.json({ success: true, data: WEBHOOK_EVENTS });
  }
);

// POST /api/tenants/:tenantId/webhooks
webhooksRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = webhookSchema.parse(req.body);

      const invalid = data.events.filter((e) => !WEBHOOK_EVENTS.includes(e));
      if (invalid.length) {
        throw new AppError(`Unknown event types: ${invalid.join(', ')}`, 400);
      }

      const webhook = await prisma.webhook.create({
        data: {
          tenantId,
          name: data.name,
          url: data.url,
          events: data.events,
          secret: data.secret || crypto.randomBytes(24).toString('hex'),
          isActive: data.isActive ?? true,
          createdBy: req.user!.id,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_webhook',
        entityType: 'webhook',
        entityId: webhook.id,
        afterState: { name: webhook.name, url: webhook.url, events: webhook.events },
      });

      res.status(201).json({ success: true, data: { ...webhook, secret: '••••••••' } });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to create webhook: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/webhooks/:id
webhooksRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!webhook) throw new AppError('Webhook not found', 404);

      const data = webhookSchema.partial().parse(req.body);
      const updated = await prisma.webhook.update({
        where: { id: webhook.id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.url !== undefined && { url: data.url }),
          ...(data.events !== undefined && { events: data.events }),
          ...(data.secret !== undefined && data.secret !== '••••••••' && { secret: data.secret }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_webhook',
        entityType: 'webhook',
        entityId: webhook.id,
        beforeState: { name: webhook.name, url: webhook.url, events: webhook.events },
        afterState: { name: updated.name, url: updated.url, events: updated.events },
      });

      res.json({ success: true, data: { ...updated, secret: '••••••••' } });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to update webhook: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/webhooks/:id
webhooksRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!webhook) throw new AppError('Webhook not found', 404);

      await prisma.webhook.delete({ where: { id: webhook.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_webhook',
        entityType: 'webhook',
        entityId: webhook.id,
        beforeState: { name: webhook.name, url: webhook.url },
      });

      res.json({ success: true, message: 'Webhook deleted' });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to delete webhook: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/webhooks/:id/test — fire a test event
webhooksRouter.post(
  '/:id/test',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const webhook = await prisma.webhook.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!webhook) throw new AppError('Webhook not found', 404);

      const payload = JSON.stringify({
        event: 'test',
        tenantId,
        webhookId: webhook.id,
        timestamp: new Date().toISOString(),
        data: { message: 'InnSight webhook test delivery' },
      });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (webhook.secret) {
        headers['X-InnSight-Signature'] = signPayload(payload, webhook.secret);
      }

      let status: string;
      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: payload,
          signal: AbortSignal.timeout(10000),
        });
        status = `${response.status}`;
      } catch (err: any) {
        status = `failed: ${err.message}`;
      }

      await prisma.webhook.update({
        where: { id: webhook.id },
        data: { lastTriggeredAt: new Date(), lastStatus: status },
      });

      res.json({
        success: true,
        data: { delivered: !status.startsWith('failed'), status },
      });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to test webhook: ${error.message}`, 500);
    }
  }
);
