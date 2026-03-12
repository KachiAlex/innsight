import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { invalidateTenantSlugCache } from '../utils/tenantContext';
import { initializeTenant } from '../utils/tenantInitialization';

export const tenantRouter = Router();

const ensurePrismaClient = () => {
  if (!prisma) {
    throw new AppError('Database connection not initialized', 500);
  }
  return prisma;
};

/**
 * Helper to format error response with specific error codes
 */
const formatErrorResponse = (code: string, message: string, field?: string) => {
  return {
    success: false,
    error: {
      code,
      message,
      field,
    },
  };
};

const formatTenantResponse = (tenant: any) => ({
  id: tenant.id,
  name: tenant.name,
  slug: tenant.slug,
  email: tenant.email,
  phone: tenant.phone || null,
  address: tenant.address || null,
  branding: tenant.branding || null,
  taxSettings: tenant.taxSettings || null,
  subscriptionStatus: tenant.subscriptionStatus,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt,
  _count: tenant._count
    ? {
        users: tenant._count.users ?? 0,
        rooms: tenant._count.rooms ?? 0,
        reservations: tenant._count.reservations ?? 0,
      }
    : tenant._count,
});

const createTenantSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  email: z.string().email(),
  phone: z.string().optional(),
  address: z.string().optional(),
  branding: z.any().optional(),
  taxSettings: z.any().optional(),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  ownerFirstName: z.string().min(1),
  ownerLastName: z.string().min(1),
});

const updateTenantAdminSchema = z.object({
  email: z.string().email().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  branding: z.any().optional(),
  taxSettings: z.any().optional(),
  subscriptionStatus: z.enum(['active', 'suspended', 'cancelled']).optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
});

// GET /api/tenants/check-slug/:slug - Check if slug is available
tenantRouter.get('/check-slug/:slug', async (req: AuthRequest, res) => {
  try {
    const { slug } = req.params;
    const normalizedSlug = slug.toLowerCase().trim();

    if (!normalizedSlug || normalizedSlug.length < 2) {
      res.json({
        available: false,
        reason: 'Slug must be at least 2 characters',
      });
      return;
    }

    const prismaClient = ensurePrismaClient();
    const existingTenant = await prismaClient.tenant.findUnique({
      where: { slug: normalizedSlug },
    });

    res.json({
      available: !existingTenant,
      suggestion: existingTenant
        ? `Try "${normalizedSlug}-${Math.floor(Math.random() * 1000)}" or similar`
        : undefined,
    });
  } catch (error: any) {
    console.error('Error checking slug availability:', error);
    throw new AppError(`Failed to check slug availability: ${error.message}`, 500);
  }
});

// POST /api/tenants - Create new tenant (IITECH admin only)
tenantRouter.post('/', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const prismaClient = ensurePrismaClient();
    const data = createTenantSchema.parse(req.body);

    const existingTenant = await prismaClient.tenant.findUnique({
      where: { slug: data.slug },
    });

    if (existingTenant) {
      res.status(400).json(
        formatErrorResponse(
          'DUPLICATE_SLUG',
          `Slug "${data.slug}" is already in use. Choose a different slug.`,
          'slug'
        )
      );
      return;
    }

    // Check for duplicate owner email across all tenants
    const existingOwner = await prismaClient.user.findFirst({
      where: {
        email: data.ownerEmail,
      },
    });

    if (existingOwner) {
      res.status(400).json(
        formatErrorResponse(
          'DUPLICATE_OWNER_EMAIL',
          `Email "${data.ownerEmail}" is already registered as a user.`,
          'ownerEmail'
        )
      );
      return;
    }

    const passwordHash = await hashPassword(data.ownerPassword);

    const result = await prismaClient.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          email: data.email,
          phone: data.phone || null,
          address: data.address || null,
          branding: data.branding || null,
          taxSettings: data.taxSettings || null,
          subscriptionStatus: 'active',
        },
      });

      const owner = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: data.ownerEmail,
          passwordHash,
          firstName: data.ownerFirstName,
          lastName: data.ownerLastName,
          role: 'owner',
          isActive: true,
        },
      });

      return { tenant, owner };
    });

    // Initialize tenant with default data (non-blocking)
    initializeTenant(result.tenant.id).catch((error) => {
      console.error('Tenant initialization warning:', error);
      // Don't fail the request - initialization is optional
    });

    // Invalidate tenant slug cache
    invalidateTenantSlugCache(data.slug);

    try {
      await createAuditLog({
        tenantId: result.tenant.id,
        userId: req.user!.id,
        action: 'create_tenant',
        entityType: 'tenant',
        entityId: result.tenant.id,
        afterState: {
          name: result.tenant.name,
          slug: result.tenant.slug,
          email: result.tenant.email,
          phone: result.tenant.phone,
          address: result.tenant.address,
          subscriptionStatus: result.tenant.subscriptionStatus,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    res.status(201).json({
      success: true,
      data: {
        tenant: formatTenantResponse({ ...result.tenant, _count: { users: 1, rooms: 0, reservations: 0 } }),
        owner: {
          id: result.owner.id,
          email: result.owner.email,
          firstName: result.owner.firstName,
          lastName: result.owner.lastName,
        },
      },
      message: 'Tenant created successfully. Owner account setup complete.',
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    if (error.name === 'ZodError') {
      const fieldError = error.errors[0];
      res.status(400).json(
        formatErrorResponse(
          'VALIDATION_ERROR',
          `Invalid ${fieldError.path.join('.')}: ${fieldError.message}`,
          fieldError.path.join('.')
        )
      );
      return;
    }
    console.error('Error creating tenant:', error);
    throw new AppError(`Failed to create tenant: ${error.message}`, 500);
  }
});

// GET /api/tenants/:id/admin - Get tenant admin details (IITECH admin only)
tenantRouter.get('/:id/admin', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;

    // Verify tenant exists
    const tenant = await prisma?.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Find tenant admin (owner role)
    const admin = await prisma?.user.findFirst({
      where: {
        tenantId,
        role: 'owner',
      },
    });

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
tenantRouter.patch('/:id/admin', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
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

    // Find tenant admin (owner role)
    const admin = await prisma?.user.findFirst({
      where: {
        tenantId,
        role: 'owner',
      },
    });

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
tenantRouter.post('/:id/admin/reset-password', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;
    const { newPassword } = resetPasswordSchema.parse(req.body);

    const prismaClient = ensurePrismaClient();

    const tenant = await prismaClient.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    const adminUser = await prismaClient.user.findFirst({
      where: {
        tenantId,
        role: 'owner',
      },
    });

    if (!adminUser) {
      throw new AppError('Tenant admin not found', 404);
    }

    const passwordHash = await hashPassword(newPassword);

    await prismaClient.user.update({
      where: { id: adminUser.id },
      data: {
        passwordHash,
        updatedAt: new Date(),
      },
    });

    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'reset_tenant_admin_password',
        entityType: 'user',
        entityId: adminUser.id,
        metadata: {
          email: adminUser.email,
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

// PATCH /api/tenants/:id - Update tenant details (IITECH admin only)
tenantRouter.patch('/:id', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;
    const prismaClient = ensurePrismaClient();
    const data = updateTenantSchema.parse(req.body);

    const tenant = await prismaClient.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    if (data.slug && data.slug !== tenant.slug) {
      const slugCheck = await prismaClient.tenant.findUnique({
        where: { slug: data.slug },
      });

      if (slugCheck && slugCheck.id !== tenantId) {
        throw new AppError('Tenant slug already exists', 400);
      }
    }

    const beforeState = {
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      phone: tenant.phone || null,
      address: tenant.address || null,
      subscriptionStatus: tenant.subscriptionStatus,
    };

    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.branding !== undefined) updateData.branding = data.branding || null;
    if (data.taxSettings !== undefined) updateData.taxSettings = data.taxSettings || null;
    if (data.subscriptionStatus !== undefined) updateData.subscriptionStatus = data.subscriptionStatus;

    const updatedTenant = await prismaClient.tenant.update({
      where: { id: tenantId },
      data: updateData,
      include: {
        _count: {
          select: {
            users: true,
            rooms: true,
            reservations: true,
          },
        },
      },
    });

    const formattedTenant = formatTenantResponse(updatedTenant);

    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_tenant',
        entityType: 'tenant',
        entityId: tenantId,
        beforeState,
        afterState: {
          name: formattedTenant.name,
          slug: formattedTenant.slug,
          email: formattedTenant.email,
          phone: formattedTenant.phone,
          address: formattedTenant.address,
          subscriptionStatus: formattedTenant.subscriptionStatus,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    res.json({
      success: true,
      data: formattedTenant,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error updating tenant:', error);
    throw new AppError(`Failed to update tenant: ${error.message}`, 500);
  }
});

// GET /api/tenants/:id
tenantRouter.get('/:id', authenticate, requireRole('iitech_admin'), async (req, res) => {
  try {
    const prismaClient = ensurePrismaClient();

    const tenant = await prismaClient.tenant.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: {
            users: true,
            rooms: true,
            reservations: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    res.json({
      success: true,
      data: formatTenantResponse(tenant),
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error fetching tenant:', error);
    throw new AppError(`Failed to fetch tenant: ${error.message}`, 500);
  }
});

// GET /api/tenants - List all tenants (IITECH admin)
tenantRouter.get('/', authenticate, requireRole('iitech_admin'), async (req, res) => {
  try {
    if (!prisma) {
      throw new AppError('Database connection not initialized', 500);
    }

    // Get all tenants from PostgreSQL
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            users: true,
            rooms: true,
          },
        },
      },
    });

    // Format the response
    const tenantsWithCounts = tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      phone: tenant.phone,
      address: tenant.address,
      subscriptionStatus: tenant.subscriptionStatus,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      userCount: tenant._count.users,
      roomsCount: tenant._count.rooms,
    }));

    res.json({
      success: true,
      data: tenantsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching tenants:', error);
    throw new AppError(
      `Failed to fetch tenants: ${error.message || 'Unknown error'}`,
      500
    );
  }
});
