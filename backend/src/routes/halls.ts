import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { prisma, isPrismaAvailable } from '../utils/prisma';

export const meetingHallRouter = Router({ mergeParams: true });

const ensurePrisma = () => {
  if (!isPrismaAvailable() || !prisma) {
    throw new AppError('Relational database is not configured for this environment', 500);
  }
  return prisma;
};

const hallPayloadSchema = z.object({
  name: z.string().min(1, 'Hall name is required'),
  description: z.string().max(1024).nullish(),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
  location: z.string().max(255).nullish(),
  assets: z.array(z.string().min(1)).optional(),
  isActive: z.boolean().optional(),
});

const toHallResponse = (hall: any) => {
  const amenitiesObject = (hall.amenities as Record<string, unknown> | null) ?? {};
  const assets = Array.isArray(amenitiesObject.assets)
    ? amenitiesObject.assets.filter((item) => typeof item === 'string')
    : [];

  return {
    id: hall.id,
    tenantId: hall.tenantId,
    name: hall.name,
    description: hall.description,
    capacity: hall.capacity,
    location: hall.location,
    assets,
    isActive: hall.isActive,
    createdAt: hall.createdAt,
    updatedAt: hall.updatedAt,
  };
};

meetingHallRouter.use(authenticate, requireTenantAccess);

meetingHallRouter.get('/', async (req: AuthRequest, res) => {
  const client = ensurePrisma();
  const tenantId = req.params.tenantId;

  const halls = await client.meetingHall.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
  });

  res.json({
    success: true,
    data: halls.map(toHallResponse),
  });
});

meetingHallRouter.post('/', async (req: AuthRequest, res) => {
  const client = ensurePrisma();
  const tenantId = req.params.tenantId;

  const payload = hallPayloadSchema.parse(req.body);

  const hall = await client.meetingHall.create({
    data: {
      tenantId,
      name: payload.name,
      description: payload.description ?? null,
      capacity: payload.capacity,
      location: payload.location ?? null,
      amenities: {
        assets: payload.assets ?? [],
      },
      isActive: payload.isActive ?? true,
    },
  });

  res.status(201).json({
    success: true,
    data: toHallResponse(hall),
  });
});

meetingHallRouter.put('/:hallId', async (req: AuthRequest, res) => {
  const client = ensurePrisma();
  const tenantId = req.params.tenantId;
  const hallId = req.params.hallId;

  const payload = hallPayloadSchema.partial().refine(
    (data) => Object.keys(data).length > 0,
    'At least one field is required for update'
  );

  const updates = payload.parse(req.body);

  const existing = await client.meetingHall.findFirst({
    where: { id: hallId, tenantId },
  });

  if (!existing) {
    throw new AppError('Hall not found', 404);
  }

  const hall = await client.meetingHall.update({
    where: { id: hallId },
    data: {
      name: updates.name ?? existing.name,
      description: updates.description ?? existing.description,
      capacity: updates.capacity ?? existing.capacity,
      location: updates.location ?? existing.location,
      amenities:
        updates.assets !== undefined
          ? {
              assets: updates.assets,
            }
          : existing.amenities,
      isActive: updates.isActive ?? existing.isActive,
    },
  });

  res.json({
    success: true,
    data: toHallResponse(hall),
  });
});

meetingHallRouter.delete('/:hallId', async (req: AuthRequest, res) => {
  const client = ensurePrisma();
  const tenantId = req.params.tenantId;
  const hallId = req.params.hallId;

  const hall = await client.meetingHall.findFirst({
    where: { id: hallId, tenantId },
  });

  if (!hall) {
    throw new AppError('Hall not found', 404);
  }

  await client.meetingHall.update({
    where: { id: hallId },
    data: { isActive: false },
  });

  res.json({
    success: true,
    message: 'Hall archived successfully',
  });
});
