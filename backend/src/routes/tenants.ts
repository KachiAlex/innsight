import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
// import { db, toDate, now } from '../utils/firestore';

export const tenantRouter = Router();

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
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
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

// GET /api/tenants/:id/admin - Get tenant admin details (IITECH admin only)
tenantRouter.get('/:id/admin', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;

    // Verify tenant exists
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new AppError('Tenant not found', 404);
    }

    // Find tenant admin (owner role)
    const adminSnapshot = await db.collection('users')
      .where('tenantId', '==', tenantId)
      .where('role', '==', 'owner')
      .limit(1)
      .get();

    if (adminSnapshot.empty) {
      throw new AppError('Tenant admin not found', 404);
    }

    const adminDoc = adminSnapshot.docs[0];
    const adminData = adminDoc.data();

    const tenantAdmin = {
      id: adminDoc.id,
      email: adminData.email,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      phone: adminData.phone || null,
      role: adminData.role,
      isActive: adminData.isActive,
      lastLoginAt: adminData.lastLoginAt ? toDate(adminData.lastLoginAt) : null,
      createdAt: toDate(adminData.createdAt),
      updatedAt: toDate(adminData.updatedAt),
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
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new AppError('Tenant not found', 404);
    }

    // Find tenant admin (owner role)
    const adminSnapshot = await db.collection('users')
      .where('tenantId', '==', tenantId)
      .where('role', '==', 'owner')
      .limit(1)
      .get();

    if (adminSnapshot.empty) {
      throw new AppError('Tenant admin not found', 404);
    }

    const adminDoc = adminSnapshot.docs[0];
    const adminData = adminDoc.data();
    const beforeState = {
      email: adminData.email,
      firstName: adminData.firstName,
      lastName: adminData.lastName,
      phone: adminData.phone || null,
    };

    // Check if email is being changed and if it already exists
    if (data.email && data.email !== adminData.email) {
      const emailCheckSnapshot = await db.collection('users')
        .where('email', '==', data.email)
        .where('tenantId', '==', tenantId)
        .limit(1)
        .get();

      if (!emailCheckSnapshot.empty) {
        throw new AppError('Email already exists for this tenant', 400);
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: now(),
    };

    if (data.email !== undefined) updateData.email = data.email;
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone || null;

    // Update admin
    await adminDoc.ref.update(updateData);

    // Get updated admin
    const updatedDoc = await db.collection('users').doc(adminDoc.id).get();
    const updatedData = updatedDoc.data();

    const updated = {
      id: updatedDoc.id,
      email: updatedData?.email,
      firstName: updatedData?.firstName,
      lastName: updatedData?.lastName,
      phone: updatedData?.phone || null,
      role: updatedData?.role,
      isActive: updatedData?.isActive,
      lastLoginAt: updatedData?.lastLoginAt ? toDate(updatedData.lastLoginAt) : null,
      createdAt: toDate(updatedData?.createdAt),
      updatedAt: toDate(updatedData?.updatedAt),
    };

    // Create audit log
    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_tenant_admin',
        entityType: 'user',
        entityId: adminDoc.id,
        beforeState,
        afterState: {
          email: updated.email,
          firstName: updated.firstName,
          lastName: updated.lastName,
          phone: updated.phone,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    res.json({
      success: true,
      data: updated,
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

    // Verify tenant exists
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new AppError('Tenant not found', 404);
    }

    // Find tenant admin (owner role)
    const adminSnapshot = await db.collection('users')
      .where('tenantId', '==', tenantId)
      .where('role', '==', 'owner')
      .limit(1)
      .get();

    if (adminSnapshot.empty) {
      throw new AppError('Tenant admin not found', 404);
    }

    const adminDoc = adminSnapshot.docs[0];
    const adminData = adminDoc.data();

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await adminDoc.ref.update({
      passwordHash,
      updatedAt: now(),
    });

    // Create audit log
    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'reset_tenant_admin_password',
        entityType: 'user',
        entityId: adminDoc.id,
        metadata: {
          email: adminData.email,
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

// POST /api/tenants - Create new tenant (IITECH admin only)
tenantRouter.post('/', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const data = createTenantSchema.parse(req.body);

    // Use Firestore instead of Prisma
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const db = admin.firestore();

    // Check if slug exists
    const existingTenantSnapshot = await db.collection('tenants')
      .where('slug', '==', data.slug)
      .limit(1)
      .get();

    if (!existingTenantSnapshot.empty) {
      throw new AppError('Tenant slug already exists', 400);
    }

    // Create tenant and owner user
    const now = admin.firestore.Timestamp.now();
    
    // Create tenant
    const tenantRef = db.collection('tenants').doc();
    const tenantData = {
      name: data.name,
      slug: data.slug,
      email: data.email,
      phone: data.phone || null,
      address: data.address || null,
      branding: data.branding || null,
      taxSettings: data.taxSettings || null,
      subscriptionStatus: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await tenantRef.set(tenantData);

    // Create owner user
    const passwordHash = await hashPassword(data.ownerPassword);
    const ownerRef = db.collection('users').doc();
    const ownerData = {
      tenantId: tenantRef.id,
      email: data.ownerEmail,
      passwordHash,
      firstName: data.ownerFirstName,
      lastName: data.ownerLastName,
      role: 'owner',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
    await ownerRef.set(ownerData);

    // Create audit log (if audit logging is needed)
    try {
      await createAuditLog({
        tenantId: tenantRef.id,
        userId: req.user!.id,
        action: 'create_tenant',
        entityType: 'tenant',
        entityId: tenantRef.id,
        afterState: tenantData,
      });
    } catch (auditError) {
      // Log but don't fail if audit logging fails
      console.error('Failed to create audit log:', auditError);
    }

    res.status(201).json({
      success: true,
      data: {
        tenant: {
          id: tenantRef.id,
          ...tenantData,
          createdAt: tenantData.createdAt.toDate().toISOString(),
          updatedAt: tenantData.updatedAt.toDate().toISOString(),
        },
        owner: {
          id: ownerRef.id,
          email: ownerData.email,
          firstName: ownerData.firstName,
          lastName: ownerData.lastName,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error creating tenant:', error);
    throw new AppError(`Failed to create tenant: ${error.message}`, 500);
  }
});

// PATCH /api/tenants/:id - Update tenant details (IITECH admin only)
tenantRouter.patch('/:id', authenticate, requireRole('iitech_admin'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.params.id;
    const data = updateTenantSchema.parse(req.body);

    // Verify tenant exists
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new AppError('Tenant not found', 404);
    }

    const tenantData = tenantDoc.data();
    const beforeState = {
      name: tenantData?.name,
      slug: tenantData?.slug,
      email: tenantData?.email,
      phone: tenantData?.phone || null,
      address: tenantData?.address || null,
      subscriptionStatus: tenantData?.subscriptionStatus,
    };

    // Check if slug is being changed and if it already exists
    if (data.slug && data.slug !== tenantData?.slug) {
      const slugCheckSnapshot = await db.collection('tenants')
        .where('slug', '==', data.slug)
        .limit(1)
        .get();

      if (!slugCheckSnapshot.empty) {
        throw new AppError('Tenant slug already exists', 400);
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: now(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.address !== undefined) updateData.address = data.address || null;
    if (data.branding !== undefined) updateData.branding = data.branding || null;
    if (data.taxSettings !== undefined) updateData.taxSettings = data.taxSettings || null;
    if (data.subscriptionStatus !== undefined) updateData.subscriptionStatus = data.subscriptionStatus;

    // Update tenant
    await tenantDoc.ref.update(updateData);

    // Get updated tenant
    const updatedDoc = await db.collection('tenants').doc(tenantId).get();
    const updatedData = updatedDoc.data();

    // Get counts
    const [usersSnapshot, roomsSnapshot, reservationsSnapshot] = await Promise.all([
      db.collection('users').where('tenantId', '==', tenantId).get(),
      db.collection('rooms').where('tenantId', '==', tenantId).get(),
      db.collection('reservations').where('tenantId', '==', tenantId).get(),
    ]);

    const updated = {
      id: tenantId,
      name: updatedData?.name,
      slug: updatedData?.slug,
      email: updatedData?.email,
      phone: updatedData?.phone || null,
      address: updatedData?.address || null,
      branding: updatedData?.branding || null,
      taxSettings: updatedData?.taxSettings || null,
      subscriptionStatus: updatedData?.subscriptionStatus,
      createdAt: updatedData?.createdAt?.toDate?.()?.toISOString() || updatedData?.createdAt,
      updatedAt: updatedData?.updatedAt?.toDate?.()?.toISOString() || updatedData?.updatedAt,
      _count: {
        users: usersSnapshot.size,
        rooms: roomsSnapshot.size,
        reservations: reservationsSnapshot.size,
      },
    };

    // Create audit log
    try {
      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_tenant',
        entityType: 'tenant',
        entityId: tenantId,
        beforeState,
        afterState: {
          name: updated.name,
          slug: updated.slug,
          email: updated.email,
          phone: updated.phone || null,
          address: updated.address || null,
          subscriptionStatus: updated.subscriptionStatus,
        },
      });
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError);
    }

    res.json({
      success: true,
      data: updated,
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
    // Use Firestore instead of Prisma
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const db = admin.firestore();

    const tenantDoc = await db.collection('tenants').doc(req.params.id).get();

    if (!tenantDoc.exists) {
      throw new AppError('Tenant not found', 404);
    }

    const tenantData = tenantDoc.data();
    const tenantId = tenantDoc.id;

    // Get counts
    const [usersSnapshot, roomsSnapshot, reservationsSnapshot] = await Promise.all([
      db.collection('users').where('tenantId', '==', tenantId).get(),
      db.collection('rooms').where('tenantId', '==', tenantId).get(),
      db.collection('reservations').where('tenantId', '==', tenantId).get(),
    ]);

    const tenant = {
      id: tenantId,
      ...tenantData,
      createdAt: tenantData?.createdAt?.toDate?.()?.toISOString() || tenantData?.createdAt,
      updatedAt: tenantData?.updatedAt?.toDate?.()?.toISOString() || tenantData?.updatedAt,
      _count: {
        users: usersSnapshot.size,
        rooms: roomsSnapshot.size,
        reservations: reservationsSnapshot.size,
      },
    };

    res.json({
      success: true,
      data: tenant,
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
