/**
 * Superadmin Users Management Routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  getSuperadminUsers,
  getSuperadminUser,
  createSuperadminUser,
  updateSuperadminUser,
  deactivateSuperadminUser,
  reactivateSuperadminUser,
  getAvailablePermissions,
} from '../utils/superadminUsers';
import { createAuditLog } from '../utils/audit';

export const superadminUsersRouter = Router();

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/superadmin/users - List all superadmin users
 */
superadminUsersRouter.get(
  '/',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const users = await getSuperadminUsers();
      res.json({
        success: true,
        data: users,
      });
    } catch (error: any) {
      console.error('Error fetching superadmin users:', error);
      throw new AppError('Failed to fetch users', 500);
    }
  }
);

/**
 * GET /api/superadmin/users/:id - Get specific superadmin user
 */
superadminUsersRouter.get(
  '/:id',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const user = await getSuperadminUser(req.params.id);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      res.json({
        success: true,
        data: user,
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error fetching user:', error);
      throw new AppError('Failed to fetch user', 500);
    }
  }
);

/**
 * POST /api/superadmin/users - Create new superadmin user
 */
superadminUsersRouter.post(
  '/',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const data = createUserSchema.parse(req.body);

      const user = await createSuperadminUser(
        data.email,
        data.password,
        data.firstName,
        data.lastName,
        data.phone
      );

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'create_superadmin_user',
          entityType: 'user',
          entityId: user.id,
          metadata: {
            email: user.email,
            name: `${user.firstName} ${user.lastName}`,
          },
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.status(201).json({
        success: true,
        data: user,
        message: 'Superadmin user created successfully',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new AppError(`Validation error: ${error.errors[0].message}`, 400);
      }
      if (error instanceof AppError) throw error;
      console.error('Error creating user:', error);
      throw new AppError(error.message || 'Failed to create user', 400);
    }
  }
);

/**
 * PATCH /api/superadmin/users/:id - Update superadmin user
 */
superadminUsersRouter.patch(
  '/:id',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const data = updateUserSchema.parse(req.body);

      const updated = await updateSuperadminUser(req.params.id, data);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'update_superadmin_user',
          entityType: 'user',
          entityId: req.params.id,
          metadata: {
            fields: Object.keys(data),
          },
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        data: updated,
        message: 'User updated successfully',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new AppError(`Validation error: ${error.errors[0].message}`, 400);
      }
      if (error instanceof AppError) throw error;
      console.error('Error updating user:', error);
      throw new AppError(error.message || 'Failed to update user', 400);
    }
  }
);

/**
 * POST /api/superadmin/users/:id/deactivate - Deactivate user
 */
superadminUsersRouter.post(
  '/:id/deactivate',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      if (req.params.id === req.user!.id) {
        throw new AppError('Cannot deactivate your own account', 400);
      }

      await deactivateSuperadminUser(req.params.id);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'deactivate_superadmin_user',
          entityType: 'user',
          entityId: req.params.id,
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error deactivating user:', error);
      throw new AppError('Failed to deactivate user', 500);
    }
  }
);

/**
 * POST /api/superadmin/users/:id/reactivate - Reactivate user
 */
superadminUsersRouter.post(
  '/:id/reactivate',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      await reactivateSuperadminUser(req.params.id);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'reactivate_superadmin_user',
          entityType: 'user',
          entityId: req.params.id,
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'User reactivated successfully',
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error reactivating user:', error);
      throw new AppError('Failed to reactivate user', 500);
    }
  }
);

/**
 * GET /api/superadmin/permissions - Get available permissions
 */
superadminUsersRouter.get(
  '/list/permissions',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const permissions = getAvailablePermissions();
      res.json({
        success: true,
        data: permissions,
      });
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      throw new AppError('Failed to fetch permissions', 500);
    }
  }
);
