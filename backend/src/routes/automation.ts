import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';

export const automationRouter = Router({ mergeParams: true });

const RULE_TYPES = ['housekeeping', 'notification', 'reservation', 'payment', 'maintenance'];
const TRIGGER_EVENTS = [
  'reservation.created',
  'reservation.checked_in',
  'reservation.checked_out',
  'reservation.cancelled',
  'payment.completed',
  'payment.failed',
  'room.status_changed',
  'scheduled.daily',
];

const ruleSchema = z.object({
  ruleName: z.string().min(1),
  ruleType: z.enum(RULE_TYPES as [string, ...string[]]),
  triggerEvent: z.enum(TRIGGER_EVENTS as [string, ...string[]]),
  conditions: z.any().optional(),
  actions: z.any().optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/tenants/:tenantId/automation/rules
automationRouter.get(
  '/rules',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { ruleType, isActive } = req.query;

      const where: any = { tenantId };
      if (ruleType) where.ruleType = ruleType;
      if (isActive !== undefined) where.isActive = isActive === 'true';

      const rules = await prisma.workflowRule.findMany({
        where,
        include: { creator: { select: { id: true, firstName: true, lastName: true } } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      });

      res.json({ success: true, data: rules });
    } catch (error: any) {
      throw new AppError(`Failed to fetch automation rules: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/automation/meta — available types/events for the UI
automationRouter.get(
  '/meta',
  authenticate,
  requireTenantAccess,
  async (_req: AuthRequest, res) => {
    res.json({ success: true, data: { ruleTypes: RULE_TYPES, triggerEvents: TRIGGER_EVENTS } });
  }
);

// POST /api/tenants/:tenantId/automation/rules
automationRouter.post(
  '/rules',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = ruleSchema.parse(req.body);

      const rule = await prisma.workflowRule.create({
        data: {
          tenantId,
          ruleName: data.ruleName,
          ruleType: data.ruleType,
          triggerEvent: data.triggerEvent,
          conditions: data.conditions ?? undefined,
          actions: data.actions ?? undefined,
          priority: data.priority ?? 0,
          isActive: data.isActive ?? true,
          createdBy: req.user!.id,
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_workflow_rule',
        entityType: 'workflow_rule',
        entityId: rule.id,
        afterState: rule,
      });

      res.status(201).json({ success: true, data: rule });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to create automation rule: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/automation/rules/:id
automationRouter.patch(
  '/rules/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const rule = await prisma.workflowRule.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!rule) throw new AppError('Rule not found', 404);

      const data = ruleSchema.partial().parse(req.body);
      const updated = await prisma.workflowRule.update({
        where: { id: rule.id },
        data,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_workflow_rule',
        entityType: 'workflow_rule',
        entityId: rule.id,
        beforeState: rule,
        afterState: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to update automation rule: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/automation/rules/:id
automationRouter.delete(
  '/rules/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const rule = await prisma.workflowRule.findFirst({
        where: { id: req.params.id, tenantId },
      });
      if (!rule) throw new AppError('Rule not found', 404);

      await prisma.workflowRule.delete({ where: { id: rule.id } });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'delete_workflow_rule',
        entityType: 'workflow_rule',
        entityId: rule.id,
        beforeState: rule,
      });

      res.json({ success: true, message: 'Rule deleted' });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw new AppError(`Failed to delete automation rule: ${error.message}`, 500);
    }
  }
);
