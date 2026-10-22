import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

export const tenantAdminRouter = Router();

const createTenantAdminSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(6),
  phone: z.string().optional(),
});

const updateTenantAdminSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(), // Added password field
  isActive: z.boolean().optional(),
});

// Resolve the user who administers a tenant: owner first, then a manager,
// then the earliest active staff user. Never resolves platform accounts —
// iitech_admin password changes go through /auth/change-password instead.
const findTenantAdmin = async (tenantId: string) => {
  for (const role of ['owner', 'general_manager']) {
    const admin = await prisma?.user.findFirst({
      where: { tenantId, role, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (admin) return admin;
  }
  return prisma?.user.findFirst({
    where: { tenantId, isActive: true, role: { not: 'iitech_admin' } },
    orderBy: { createdAt: 'asc' },
  });
};

// POST /api/tenants/:id/admin - Create an owner account for a tenant that has
// no admin (IITECH admin only). Refuses if the tenant already has one.
tenantAdminRouter.post('/:id/admin', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;
    const data = createTenantAdminSchema.parse(req.body);

    const tenant = await prisma?.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const existingAdmin = await findTenantAdmin(tenantId);
    if (existingAdmin) {
      throw new AppError('Tenant already has an admin account', 409);
    }

    const emailTaken = await prisma?.user.findFirst({
      where: { email: data.email },
    });
    if (emailTaken) {
      throw new AppError('Email is already registered', 400);
    }

    const admin = await prisma?.user.create({
      data: {
        tenantId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone || null,
        passwordHash: await hashPassword(data.password),
        role: 'owner',
        isActive: true,
      },
    });

    if (!admin) {
      throw new AppError('Failed to create tenant admin', 500);
    }

    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'create_tenant_admin',
        entityType: 'user',
        entityId: admin.id,
        afterState: {
          email: admin.email,
          firstName: admin.firstName,
          lastName: admin.lastName,
          role: admin.role,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    res.status(201).json({
      success: true,
      data: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        isActive: admin.isActive,
      },
      message: 'Tenant admin created successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error instanceof z.ZodError) {
      throw new AppError(error.errors[0]?.message || 'Invalid request', 400);
    }
    console.error('Error creating tenant admin:', error);
    throw new AppError(`Failed to create tenant admin: ${error.message}`, 500);
  }
});

// GET /api/tenants/:id/admin - Get tenant admin details (IITECH admin only)
tenantAdminRouter.get('/:id/admin', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;

    // Verify tenant exists
    const tenant = await prisma?.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const admin = await findTenantAdmin(tenantId);

    if (!admin) {
      throw new AppError('Tenant admin not found', 404);
    }

    const tenantAdmin = {
      id: admin.id,
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone || null,
      role: admin.role,
      isActive: admin.isActive,
      lastLogin: admin.lastLogin,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };

    res.json({
      success: true,
      data: tenantAdmin,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching tenant admin:', error);
    throw new AppError(`Failed to fetch tenant admin: ${error.message}`, 500);
  }
});

// PATCH /api/tenants/:id/admin - Update tenant admin details (IITECH admin only)
tenantAdminRouter.patch('/:id/admin', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;
    const data = updateTenantAdminSchema.parse(req.body);

    // Verify tenant exists
    const tenant = await prisma?.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const admin = await findTenantAdmin(tenantId);

    if (!admin) {
      throw new AppError('Tenant admin not found', 404);
    }

    const beforeState = {
      email: admin.email,
      firstName: admin.firstName,
      lastName: admin.lastName,
      phone: admin.phone || null,
      isActive: admin.isActive,
    };

    // Check if email is being changed and if it already exists
    if (data.email && data.email !== admin.email) {
      const existingUser = await prisma?.user.findFirst({
        where: {
          email: data.email,
          tenantId,
          id: { not: admin.id },
        },
      });

      if (existingUser) {
        throw new AppError('Email already exists in this tenant', 400);
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.email !== undefined) updateData.email = data.email;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    // Handle password update
    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
    }

    // Update admin
    const updatedAdmin = await prisma?.user.update({
      where: { id: admin.id },
      data: updateData,
    });

    if (!updatedAdmin) {
      throw new AppError('Failed to update admin', 500);
    }

    const updated = {
      id: updatedAdmin.id,
      email: updatedAdmin.email,
      firstName: updatedAdmin.firstName,
      lastName: updatedAdmin.lastName,
      phone: updatedAdmin.phone || null,
      role: updatedAdmin.role,
      isActive: updatedAdmin.isActive,
      lastLogin: updatedAdmin.lastLogin,
      createdAt: updatedAdmin.createdAt,
      updatedAt: updatedAdmin.updatedAt,
    };

    // Create audit log
    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_tenant_admin',
        entityType: 'user',
        entityId: admin.id,
        beforeState,
        afterState: {
          email: updated.email,
          firstName: updated.firstName,
          lastName: updated.lastName,
          phone: updated.phone || null,
          isActive: updated.isActive,
          passwordChanged: !!data.password,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    res.json({
      success: true,
      data: updated,
      message: data.password ? 'Admin details and password updated successfully' : 'Admin details updated successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating tenant admin:', error);
    throw new AppError(`Failed to update tenant admin: ${error.message}`, 500);
  }
});

// POST /api/tenants/:id/admin/reset-password - Reset tenant admin password (IITECH admin only)
tenantAdminRouter.post('/:id/admin/reset-password', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;
    const { newPassword } = z.object({ newPassword: z.string().min(6) }).parse(req.body);

    // Verify tenant exists
    const tenant = await prisma?.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const admin = await findTenantAdmin(tenantId);

    if (!admin) {
      throw new AppError('Tenant admin not found', 404);
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prisma?.user.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    // Create audit log
    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'reset_tenant_admin_password',
        entityType: 'user',
        entityId: admin.id,
        metadata: {
          email: admin.email,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error resetting tenant admin password:', error);
    throw new AppError(`Failed to reset tenant admin password: ${error.message}`, 500);
  }
});
