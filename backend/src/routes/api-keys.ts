import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../utils/prisma';

const router = Router();

router.use(authenticate, requireRole('iitech_admin'));

const hashKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

const serializeKey = (k: any) => ({
  id: k.id,
  key: k.keyPrefix, // only the prefix is stored/readable after creation
  name: k.name,
  status: k.status,
  scopes: k.scopes,
  rateLimit: k.rateLimit,
  tenantId: k.tenantId ?? undefined,
  lastUsedAt: k.lastUsedAt?.toISOString(),
  createdAt: k.createdAt.toISOString(),
});

// GET /api/superadmin/api-keys
router.get('/', async (req: Request, res: Response) => {
  const { tenantId, limit = '50', offset = '0' } = req.query;

  const keys = await prisma.apiKey.findMany({
    where: tenantId ? { tenantId: tenantId as string } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Math.min(parseInt(limit as string) || 50, 200),
    skip: parseInt(offset as string) || 0,
  });

  res.json({ success: true, data: keys.map(serializeKey), count: keys.length });
});

// GET /api/superadmin/api-keys/:keyId
router.get('/:keyId', async (req: Request, res: Response) => {
  const key = await prisma.apiKey.findUnique({ where: { id: req.params.keyId } });
  if (!key) {
    res.status(404).json({ success: false, error: { message: 'API key not found' } });
    return;
  }
  res.json({ success: true, data: serializeKey(key) });
});

// POST /api/superadmin/api-keys — returns the full plaintext key once
router.post('/', async (req: Request, res: Response) => {
  const data = z
    .object({
      name: z.string().min(1),
      scopes: z.array(z.string()).default([]),
      rateLimit: z.number().int().positive().default(1000),
      tenantId: z.string().optional(),
      expiresAt: z.string().datetime().optional(),
    })
    .parse(req.body);

  const plaintext = `ink_${crypto.randomBytes(24).toString('hex')}`;
  const keyPrefix = `${plaintext.slice(0, 12)}...${plaintext.slice(-4)}`;

  const key = await prisma.apiKey.create({
    data: {
      name: data.name,
      keyPrefix,
      keyHash: hashKey(plaintext),
      scopes: data.scopes,
      rateLimit: data.rateLimit,
      tenantId: data.tenantId ?? null,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      createdBy: (req as any).user?.id ?? null,
    },
  });

  res.status(201).json({
    success: true,
    data: { ...serializeKey(key), secret: plaintext },
  });
});

// POST /api/superadmin/api-keys/:keyId/revoke
router.post('/:keyId/revoke', async (req: Request, res: Response) => {
  const existing = await prisma.apiKey.findUnique({ where: { id: req.params.keyId } });
  if (!existing) {
    res.status(404).json({ success: false, error: { message: 'API key not found' } });
    return;
  }

  const key = await prisma.apiKey.update({
    where: { id: existing.id },
    data: { status: 'revoked', revokedAt: new Date() },
  });

  res.json({ success: true, data: serializeKey(key) });
});

// PATCH /api/superadmin/api-keys/:keyId
router.patch('/:keyId', async (req: Request, res: Response) => {
  const existing = await prisma.apiKey.findUnique({ where: { id: req.params.keyId } });
  if (!existing) {
    res.status(404).json({ success: false, error: { message: 'API key not found' } });
    return;
  }

  const data = z
    .object({
      name: z.string().min(1).optional(),
      scopes: z.array(z.string()).optional(),
      rateLimit: z.number().int().positive().optional(),
      expiresAt: z.string().datetime().nullable().optional(),
    })
    .parse(req.body);

  const key = await prisma.apiKey.update({
    where: { id: existing.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.scopes !== undefined && { scopes: data.scopes }),
      ...(data.rateLimit !== undefined && { rateLimit: data.rateLimit }),
      ...(data.expiresAt !== undefined && {
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      }),
    },
  });

  res.json({ success: true, data: serializeKey(key) });
});

// GET /api/superadmin/api-metrics — mounted separately at /api/superadmin
export const apiMetricsRouter = Router();
apiMetricsRouter.use(authenticate, requireRole('iitech_admin'));

apiMetricsRouter.get('/', async (_req: Request, res: Response) => {
  const [keys, usage] = await Promise.all([
    prisma.apiKey.findMany({
      select: { id: true, name: true, status: true },
    }),
    prisma.apiUsage.findMany({
      select: { keyId: true, endpoint: true, method: true, statusCode: true },
    }),
  ]);

  const endpointMap = new Map<string, number>();
  const usageByKey = new Map<string, { total: number; errors: number }>();
  for (const u of usage) {
    endpointMap.set(u.endpoint, (endpointMap.get(u.endpoint) || 0) + 1);
    const bucket = usageByKey.get(u.keyId) || { total: 0, errors: 0 };
    bucket.total += 1;
    if (u.statusCode >= 400) bucket.errors += 1;
    usageByKey.set(u.keyId, bucket);
  }

  res.json({
    success: true,
    data: {
      totalKeys: keys.length,
      activeKeys: keys.filter((k) => k.status === 'active').length,
      revokedKeys: keys.filter((k) => k.status === 'revoked').length,
      totalRequests: usage.length,
      totalErrors: usage.filter((u) => u.statusCode >= 400).length,
      topEndpoints: Array.from(endpointMap.entries())
        .map(([endpoint, count]) => ({ endpoint, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      usageByKey: keys.map((k) => ({
        keyName: k.name,
        requestCount: usageByKey.get(k.id)?.total || 0,
        errorRate:
          (usageByKey.get(k.id)?.total || 0) > 0
            ? Math.round(
                ((usageByKey.get(k.id)!.errors / usageByKey.get(k.id)!.total) * 100 + Number.EPSILON) *
                  100
              ) / 100
            : 0,
      })),
    },
  });
});

export default router;
