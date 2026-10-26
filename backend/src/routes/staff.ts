import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { getPaginationParams, createPaginationResult } from '../utils/pagination';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';

export const staffRouter = Router({ mergeParams: true });

const STAFF_ROLES = [
  'owner',
  'general_manager',
  'front_desk',
  'housekeeping_supervisor',
  'housekeeping_staff',
  'maintenance',
  'accountant',
];

const serializeUser = (user: any) => {
  const { passwordHash, ...rest } = user;
  return rest;
};

const staffSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  permissions: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

const createStaffSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(STAFF_ROLES as [string, ...string[]]),
  permissions: z.any().optional(),
});

const updateStaffSchema = createStaffSchema.partial().omit({ password: true }).extend({
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

const managerRoles = ['owner', 'general_manager', 'iitech_admin'];

const requireManager = (req: AuthRequest) => {
  if (!req.user || !managerRoles.includes(req.user.role)) {
    throw new AppError('Only owners and managers can manage staff', 403);
  }
};

// GET /api/tenants/:tenantId/staff
staffRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const { role, isActive, search } = req.query;
      const { skip, take, page, limit } = getPaginationParams(req);

      const where: any = { tenantId, NOT: { role: 'iitech_admin' } };
      if (role) where.role = role;
      if (isActive !== undefined) where.isActive = isActive === 'true';
      if (search) {
        where.OR = [
          { email: { contains: search as string, mode: 'insensitive' } },
          { firstName: { contains: search as string, mode: 'insensitive' } },
          { lastName: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      const [staff, total] = await Promise.all([
        prisma.user.findMany({
          where,
          select: staffSelect,
          orderBy: { createdAt: 'desc' },
          skip,
          take,
        }),
        prisma.user.count({ where }),
      ]);

      res.json({ success: true, ...createPaginationResult(staff, total, page, limit) });
    } catch (error: any) {
      throw new AppError(`Failed to fetch staff: ${error.message}`, 500);
    }
  }
);

// GET /api/tenants/:tenantId/staff/:id
staffRouter.get(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId: req.params.tenantId, role: { not: 'iitech_admin' } },
        select: {
          ...staffSelect,
          shifts: {
            orderBy: { startTime: 'desc' },
            take: 10,
            select: {
              id: true,
              shiftType: true,
              startTime: true,
              endTime: true,
              status: true,
            },
          },
        },
      });
      if (!user) throw new AppError('Staff member not found', 404);
      res.json({ success: true, data: user });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to fetch staff member: ${error.message}`, 500);
    }
  }
);

// POST /api/tenants/:tenantId/staff
staffRouter.post(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      requireManager(req);
      const data = createStaffSchema.parse(req.body);

      const existing = await prisma.user.findUnique({
        where: { tenantId_email: { tenantId, email: data.email } },
      });
      if (existing) throw new AppError('A user with this email already exists', 409);

      const passwordHash = await hashPassword(data.password);
      const user = await prisma.user.create({
        data: {
          tenantId,
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          role: data.role,
          permissions: data.permissions ?? undefined,
          isActive: true,
        },
        select: staffSelect,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_staff',
        entityType: 'user',
        entityId: user.id,
        afterState: user,
      });

      res.status(201).json({ success: true, data: user });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to create staff member: ${error.message}`, 500);
    }
  }
);

// PATCH /api/tenants/:tenantId/staff/:id
staffRouter.patch(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      requireManager(req);

      const user = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId, role: { not: 'iitech_admin' } },
      });
      if (!user) throw new AppError('Staff member not found', 404);

      // Prevent managers from locking themselves out of the last owner account
      const data = updateStaffSchema.parse(req.body);
      if (
        (data.role !== undefined && data.role !== 'owner' && user.role === 'owner') ||
        (data.isActive === false && user.role === 'owner')
      ) {
        const otherOwners = await prisma.user.count({
          where: {
            tenantId,
            role: 'owner',
            isActive: true,
            id: { not: user.id },
          },
        });
        if (otherOwners === 0) {
          throw new AppError('Cannot demote or deactivate the last active owner', 400);
        }
      }

      const updateData: any = {
        ...(data.firstName !== undefined && { firstName: data.firstName }),
        ...(data.lastName !== undefined && { lastName: data.lastName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.role !== undefined && { role: data.role }),
        ...(data.permissions !== undefined && { permissions: data.permissions }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      };
      if (data.password) {
        updateData.passwordHash = await hashPassword(data.password);
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: updateData,
        select: staffSelect,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_staff',
        entityType: 'user',
        entityId: user.id,
        beforeState: serializeUser(user),
        afterState: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to update staff member: ${error.message}`, 500);
    }
  }
);

// DELETE /api/tenants/:tenantId/staff/:id — soft delete (deactivate)
staffRouter.delete(
  '/:id',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      requireManager(req);

      const user = await prisma.user.findFirst({
        where: { id: req.params.id, tenantId, role: { not: 'iitech_admin' } },
      });
      if (!user) throw new AppError('Staff member not found', 404);
      if (user.id === req.user!.id) {
        throw new AppError('You cannot deactivate your own account', 400);
      }

      if (user.role === 'owner' && user.isActive) {
        const otherOwners = await prisma.user.count({
          where: {
            tenantId,
            role: 'owner',
            isActive: true,
            id: { not: user.id },
          },
        });
        if (otherOwners === 0) {
          throw new AppError('Cannot deactivate the last active owner', 400);
        }
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
        select: staffSelect,
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'deactivate_staff',
        entityType: 'user',
        entityId: user.id,
        beforeState: serializeUser(user),
        afterState: updated,
      });

      res.json({ success: true, data: updated });
    } catch (error: any) {
      if (error instanceof AppError || error.name === 'ZodError') throw error;
      throw new AppError(`Failed to deactivate staff member: ${error.message}`, 500);
    }
  }
);
