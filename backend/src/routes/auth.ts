import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../utils/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import { AppError } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantId: z.string().uuid().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(['owner', 'general_manager', 'front_desk', 'housekeeping_supervisor', 'housekeeping_staff', 'maintenance', 'accountant']),
  tenantId: z.string().uuid(),
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password, tenantId } = loginSchema.parse(req.body);

    // Use Firestore instead of Prisma
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const db = admin.firestore();

    // Query Firestore for user
    let userQuery = db.collection('users')
      .where('email', '==', email)
      .where('isActive', '==', true);

    if (tenantId) {
      userQuery = userQuery.where('tenantId', '==', tenantId);
    }

    const userSnapshot = await userQuery.limit(1).get();

    if (userSnapshot.empty) {
      throw new AppError('Invalid credentials', 401);
    }

    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    const userId = userDoc.id;

    // Verify password
    const isValidPassword = await comparePassword(password, userData.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Get tenant information
    const tenantDoc = await db.collection('tenants').doc(userData.tenantId).get();
    if (!tenantDoc.exists) {
      throw new AppError('Tenant not found', 404);
    }
    const tenantData = tenantDoc.data();

    // Update last login
    await userDoc.ref.update({
      lastLoginAt: admin.firestore.Timestamp.now(),
    });

    const tokenPayload = {
      id: userId,
      tenantId: userData.tenantId,
      email: userData.email,
      role: userData.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: userId,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          role: userData.role,
          tenantId: userData.tenantId,
          tenant: {
            id: userData.tenantId,
            name: tenantData?.name || '',
            slug: tenantData?.slug || '',
          },
        },
      },
    });
  } catch (error: any) {
    // If it's already an AppError, rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    // Otherwise, wrap it
    console.error('Login error:', error);
    throw new AppError(error.message || 'Login failed', 500);
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET not configured');
    }

    const decoded = require('jsonwebtoken').verify(refreshToken, secret) as {
      id: string;
      tenantId: string;
      email: string;
      role: string;
    };

    // Use Firestore instead of Prisma
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const db = admin.firestore();

    const userDoc = await db.collection('users').doc(decoded.id).get();

    if (!userDoc.exists) {
      throw new AppError('User not found or inactive', 401);
    }

    const userData = userDoc.data();
    if (!userData || !userData.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    const tokenPayload = {
      id: decoded.id,
      tenantId: userData.tenantId,
      email: userData.email,
      role: userData.role,
    };

    const newToken = generateToken(tokenPayload);

    res.json({
      success: true,
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    throw new AppError('Invalid refresh token', 401);
  }
});

// GET /api/auth/me
authRouter.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    // Use Firestore instead of Prisma
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    const db = admin.firestore();

    const userDoc = await db.collection('users').doc(req.user!.id).get();

    if (!userDoc.exists) {
      throw new AppError('User not found', 404);
    }

    const userData = userDoc.data();
    const tenantDoc = await db.collection('tenants').doc(userData!.tenantId).get();
    const tenantData = tenantDoc.exists ? tenantDoc.data() : null;

    res.json({
      success: true,
      data: {
        id: req.user!.id,
        email: userData!.email,
        firstName: userData!.firstName,
        lastName: userData!.lastName,
        phone: userData!.phone || null,
        role: userData!.role,
        permissions: userData!.permissions || null,
        tenantId: userData!.tenantId,
        tenant: {
          id: userData!.tenantId,
          name: tenantData?.name || '',
          slug: tenantData?.slug || '',
          branding: tenantData?.branding || null,
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Get me error:', error);
    throw new AppError(error.message || 'Failed to get user', 500);
  }
});

// POST /api/auth/create-admin - Create admin account in Firestore (one-time setup, no auth required)
authRouter.post('/create-admin', async (req, res) => {
  try {
    // Use Firestore instead of Prisma
    const admin = require('firebase-admin');
    const bcrypt = require('bcryptjs');
    
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      admin.initializeApp();
    }
    
    const db = admin.firestore();
    
    // Find or create IITECH tenant
    const tenantsRef = db.collection('tenants');
    let iitechTenantId: string;
    
    const tenantSnapshot = await tenantsRef.where('slug', '==', 'iitech').limit(1).get();
    
    if (!tenantSnapshot.empty) {
      iitechTenantId = tenantSnapshot.docs[0].id;
    } else {
      const now = admin.firestore.Timestamp.now();
      const newTenant = {
        name: 'IITECH Platform',
        slug: 'iitech',
        email: 'admin@iitech.com',
        phone: '+2341234567890',
        subscriptionStatus: 'active',
        createdAt: now,
        updatedAt: now,
      };
      const tenantRef = await tenantsRef.add(newTenant);
      iitechTenantId = tenantRef.id;
    }

    // Create or update admin user
    const passwordHash = await bcrypt.hash('admin123', 12);
    const usersRef = db.collection('users');
    
    const userSnapshot = await usersRef
      .where('tenantId', '==', iitechTenantId)
      .where('email', '==', 'admin@insight.com')
      .limit(1)
      .get();

    const now = admin.firestore.Timestamp.now();
    let adminUserId: string;
    let adminUserData: any;

    if (!userSnapshot.empty) {
      // Update existing user
      const userDoc = userSnapshot.docs[0];
      await userDoc.ref.update({
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'iitech_admin',
        isActive: true,
        updatedAt: now,
      });
      adminUserId = userDoc.id;
      adminUserData = { ...userDoc.data(), passwordHash, firstName: 'Admin', lastName: 'User', role: 'iitech_admin', isActive: true };
    } else {
      // Create new user
      const newUser = {
        tenantId: iitechTenantId,
        email: 'admin@insight.com',
        passwordHash,
        firstName: 'Admin',
        lastName: 'User',
        role: 'iitech_admin',
        isActive: true,
        createdAt: now,
        updatedAt: now,
      };
      const userRef = await usersRef.add(newUser);
      adminUserId = userRef.id;
      adminUserData = newUser;
    }

    res.status(201).json({
      success: true,
      message: 'Admin account created/updated successfully in Firestore',
      data: {
        id: adminUserId,
        email: adminUserData.email,
        firstName: adminUserData.firstName,
        lastName: adminUserData.lastName,
        role: adminUserData.role,
        tenantId: iitechTenantId,
      },
    });
  } catch (error: any) {
    console.error('Error creating admin in Firestore:', error);
    throw new AppError(`Failed to create admin account: ${error.message}`, 500);
  }
});
