import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

router.use(authenticate, requireRole('iitech_admin'));

const TEMPLATE_CATEGORIES = ['booking', 'cancellation', 'reminder', 'feedback', 'other'];

const extractVariables = (body: string): string[] => {
  const matches = body.match(/\{\{\s*([\w.]+)\s*\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{\s*|\s*\}\}/g, '')))];
};

const serializeTemplate = (t: any) => ({
  id: t.id,
  name: t.name,
  subject: t.subject,
  category: t.category,
  body: t.body,
  variables: t.variables,
  active: t.active,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  category: z.enum(TEMPLATE_CATEGORIES as [string, ...string[]]).default('other'),
  body: z.string().min(1),
  variables: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

// GET /api/superadmin/communications/templates
router.get('/templates', async (req: Request, res: Response) => {
  const { category, active, limit = '100', offset = '0' } = req.query;

  const where: any = {};
  if (category) where.category = category;
  if (active !== undefined) where.active = active === 'true';

  const templates = await prisma.emailTemplate.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: Math.min(parseInt(limit as string) || 100, 500),
    skip: parseInt(offset as string) || 0,
  });

  res.json({ success: true, data: templates.map(serializeTemplate) });
});

// GET /api/superadmin/communications/templates/:templateId
router.get('/templates/:templateId', async (req: Request, res: Response) => {
  const template = await prisma.emailTemplate.findUnique({
    where: { id: req.params.templateId },
  });
  if (!template) {
    res.status(404).json({ success: false, error: { message: 'Template not found' } });
    return;
  }
  res.json({ success: true, data: serializeTemplate(template) });
});

// POST /api/superadmin/communications/templates
router.post('/templates', async (req: Request, res: Response) => {
  const data = templateSchema.parse(req.body);

  const existing = await prisma.emailTemplate.findUnique({ where: { name: data.name } });
  if (existing) {
    res.status(409)
      .json({ success: false, error: { message: 'A template with this name already exists' } });
    return;
  }

  const template = await prisma.emailTemplate.create({
    data: {
      name: data.name,
      subject: data.subject,
      body: data.body,
      category: data.category,
      variables: data.variables?.length ? data.variables : extractVariables(data.body),
      active: data.active ?? true,
    },
  });

  res.status(201).json({ success: true, data: serializeTemplate(template) });
});

// PATCH /api/superadmin/communications/templates/:templateId
router.patch('/templates/:templateId', async (req: Request, res: Response) => {
  const existing = await prisma.emailTemplate.findUnique({
    where: { id: req.params.templateId },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: { message: 'Template not found' } });
    return;
  }

  const data = templateSchema.partial().parse(req.body);

  const template = await prisma.emailTemplate.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.body !== undefined && {
        body: data.body,
        variables: data.variables?.length ? data.variables : extractVariables(data.body),
      }),
      ...(data.variables !== undefined && data.body === undefined && { variables: data.variables }),
      ...(data.active !== undefined && { active: data.active }),
    },
  });

  res.json({ success: true, data: serializeTemplate(template) });
});

// DELETE /api/superadmin/communications/templates/:templateId
router.delete('/templates/:templateId', async (req: Request, res: Response) => {
  const existing = await prisma.emailTemplate.findUnique({
    where: { id: req.params.templateId },
  });
  if (!existing) {
    res.status(404).json({ success: false, error: { message: 'Template not found' } });
    return;
  }

  await prisma.emailTemplate.delete({ where: { id: existing.id } });
  res.json({ success: true, message: 'Template deleted' });
});

// GET /api/superadmin/communications/metrics
router.get('/metrics', async (_req: Request, res: Response) => {
  const [templates, activeTemplates, emailSent, emailFailed, emailOpened, smsSent, smsFailed] =
    await Promise.all([
      prisma.emailTemplate.count(),
      prisma.emailTemplate.count({ where: { active: true } }),
      prisma.notificationLog.count({ where: { channel: 'email', status: 'sent' } }),
      prisma.notificationLog.count({ where: { channel: 'email', status: 'failed' } }),
      prisma.notificationLog.count({
        where: { channel: 'email', status: 'sent', openedAt: { not: null } },
      }),
      prisma.notificationLog.count({ where: { channel: 'sms', status: 'sent' } }),
      prisma.notificationLog.count({ where: { channel: 'sms', status: 'failed' } }),
    ]);

  res.json({
    success: true,
    data: {
      emailsSent: emailSent,
      emailOpenRate:
        emailSent > 0 ? Math.round((emailOpened / emailSent) * 100) : 0,
      smsDeliveryRate:
        smsSent + smsFailed > 0 ? Math.round((smsSent / (smsSent + smsFailed)) * 100) : 0,
      templates,
      activeTemplates,
      emailsFailed: emailFailed,
    },
  });
});

// GET /api/superadmin/communications/logs — outbound delivery log
router.get('/logs', async (req: Request, res: Response) => {
  const { channel, status, tenantId, limit = '100', offset = '0' } = req.query;

  const where: any = {};
  if (channel) where.channel = channel;
  if (status) where.status = status;
  if (tenantId) where.tenantId = tenantId;

  const logs = await prisma.notificationLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(parseInt(limit as string) || 100, 500),
    skip: parseInt(offset as string) || 0,
  });

  res.json({ success: true, data: logs, count: logs.length });
});

export default router;
