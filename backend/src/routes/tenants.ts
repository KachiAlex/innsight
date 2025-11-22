import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword } from '../utils/password';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';

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
    // Use Firestore instead of Prisma
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const db = admin.firestore();

    // Get all tenants
    const tenantsSnapshot = await db.collection('tenants')
      .orderBy('createdAt', 'desc')
      .get();

    // Get counts for each tenant
    const tenantsWithCounts = await Promise.all(
      tenantsSnapshot.docs.map(async (doc) => {
        const tenantData = doc.data();
        const tenantId = doc.id;

        // Get user count
        const usersSnapshot = await db.collection('users')
          .where('tenantId', '==', tenantId)
          .get();

        // Get rooms count
        const roomsSnapshot = await db.collection('rooms')
          .where('tenantId', '==', tenantId)
          .get();

        return {
          id: tenantId,
          ...tenantData,
          createdAt: tenantData.createdAt?.toDate?.()?.toISOString() || tenantData.createdAt,
          updatedAt: tenantData.updatedAt?.toDate?.()?.toISOString() || tenantData.updatedAt,
          _count: {
            users: usersSnapshot.size,
            rooms: roomsSnapshot.size,
          },
        };
      })
    );

    res.json({
      success: true,
      data: tenantsWithCounts,
    });
  } catch (error: any) {
    console.error('Error fetching tenants:', error);
    throw new AppError(`Failed to fetch tenants: ${error.message}`, 500);
  }
});
