import crypto from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTenantAccess, requireRole, AuthRequest } from '../middleware/auth';
import { db, now } from '../utils/firestore';
import { AppError } from '../middleware/errorHandler';
import {
  TENANT_WEBHOOK_COLLECTION,
  TENANT_WEBHOOK_EVENT_TYPES,
  triggerTenantWebhookEvent,
  TenantWebhookEventType,
} from '../utils/tenantWebhooks';

const WEBHOOK_COLLECTION = TENANT_WEBHOOK_COLLECTION;
const webhookEventTypes = TENANT_WEBHOOK_EVENT_TYPES;

const createWebhookSchema = z.object({
  url: z.string().url(),
  description: z.string().max(240).optional(),
  eventTypes: z.array(z.enum(webhookEventTypes)).optional(),
});

const updateWebhookSchema = z
  .object({
    url: z.string().url().optional(),
    description: z.string().max(240).optional(),
    eventTypes: z.array(z.enum(webhookEventTypes)).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be updated',
  });

const testWebhookSchema = z.object({
  eventType: z.enum(webhookEventTypes).optional(),
  payload: z.record(z.any()).optional(),
});

export const webhooksRouter = Router({ mergeParams: true });

const mapWebhookDoc = (doc: FirebaseFirestore.DocumentSnapshot) => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    url: data.url,
    description: data.description || null,
    eventTypes: data.eventTypes || [],
    secret: data.secret || null,
    active: data.active !== false,
    createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
    lastTriggeredAt: data.lastTriggeredAt?.toDate?.()?.toISOString() ?? null,
    lastStatus: data.lastStatus || null,
    lastEventType: data.lastEventType || null,
    lastError: data.lastError || null,
  };
};

webhooksRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const snapshot = await db
      .collection(WEBHOOK_COLLECTION)
      .where('tenantId', '==', tenantId)
      .orderBy('createdAt', 'desc')
      .get();

    const items = snapshot.docs.map(mapWebhookDoc);

    res.json({
      success: true,
      data: items,
    });
  }
);

webhooksRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager', 'iitech_admin'),
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const parsed = createWebhookSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.errors?.[0]?.message || 'Invalid webhook payload', 400);
    }

    const data = parsed.data;
    const docRef = db.collection(WEBHOOK_COLLECTION).doc();
    const secret = crypto.randomBytes(32).toString('hex');
    const eventTypes = data.eventTypes && data.eventTypes.length ? data.eventTypes : ['reservation.confirmed'];

    const nowTs = now();
    await docRef.set({
      tenantId,
      url: data.url,
      description: data.description || null,
      eventTypes,
      secret,
      active: true,
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    const createdDoc = await docRef.get();

    res.status(201).json({
      success: true,
      data: mapWebhookDoc(createdDoc),
    });
  }
);

webhooksRouter.patch(
  '/:webhookId',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager', 'iitech_admin'),
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const webhookId = req.params.webhookId;
    const updates = updateWebhookSchema.parse(req.body);

    const docRef = db.collection(WEBHOOK_COLLECTION).doc(webhookId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.tenantId !== tenantId) {
      throw new AppError('Webhook not found for this tenant', 404);
    }

    await docRef.update({
      ...updates,
      updatedAt: now(),
    });

    const updatedDoc = await docRef.get();
    res.json({
      success: true,
      data: mapWebhookDoc(updatedDoc),
    });
  }
);

webhooksRouter.post(
  '/:webhookId/test',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager', 'iitech_admin'),
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const webhookId = req.params.webhookId;
    const { eventType = 'reservation.confirmed', payload } = testWebhookSchema.parse(req.body);

    const docRef = db.collection(WEBHOOK_COLLECTION).doc(webhookId);
    const doc = await docRef.get();
    if (!doc.exists || doc.data()?.tenantId !== tenantId) {
      throw new AppError('Webhook not found for this tenant', 404);
    }

    await triggerTenantWebhookEvent({
      tenantId,
      eventType: eventType as TenantWebhookEventType,
      payload: payload || {
        test: true,
        webhookId,
        message: 'This is a test event from InnSight.',
      },
    });

    res.json({
      success: true,
      message: 'Test event dispatched',
    });
  }
);

webhooksRouter.delete(
  '/:webhookId',
  authenticate,
  requireTenantAccess,
  requireRole('owner', 'general_manager', 'iitech_admin'),
  async (req: AuthRequest, res) => {
    const tenantId = req.params.tenantId;
    const webhookId = req.params.webhookId;
    const docRef = db.collection(WEBHOOK_COLLECTION).doc(webhookId);
    const doc = await docRef.get();

    if (!doc.exists || doc.data()?.tenantId !== tenantId) {
      throw new AppError('Webhook not found for this tenant', 404);
    }

    await docRef.delete();

    res.json({
      success: true,
      data: { id: webhookId },
    });
  }
);
