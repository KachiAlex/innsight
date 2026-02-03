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

    if (!prisma) {
      throw new AppError('Database connection not initialized', 500);
    }

    // Query PostgreSQL for user
    const whereClause: any = {
      email,
      isActive: true,
    };

    if (tenantId) {
      whereClause.tenantId = tenantId;
    }

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new AppError('Invalid credentials', 401);
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokenPayload = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
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

    if (!prisma) {
      throw new AppError('Database connection not initialized', 500);
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 401);
    }

    const tokenPayload = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
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
    if (!prisma) {
      throw new AppError('Database connection not initialized', 500);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            branding: true,
          },
        },
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || null,
        role: user.role,
        permissions: user.permissions || null,
        tenantId: user.tenantId,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
          branding: user.tenant.branding || null,
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

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, tenantId } = registerSchema.parse(req.body);

    if (!prisma) {
      throw new AppError('Database connection not initialized', 500);
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new AppError('Tenant not found', 404);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
        tenantId,
      },
    });

    if (existingUser) {
      throw new AppError('User already exists', 409);
    }

    // Create new user
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        tenantId,
        email,
        passwordHash,
        firstName,
        lastName,
        phone,
        role,
        isActive: true,
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    const tokenPayload = {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    res.status(201).json({
      success: true,
      data: {
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenantId: user.tenantId,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
          },
        },
      },
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Register error:', error);
    throw new AppError(error.message || 'Registration failed', 500);
  }
});

// POST /api/auth/create-admin - Create admin account in PostgreSQL (one-time setup, no auth required)
authRouter.post('/create-admin', async (req, res) => {
  try {
    if (!prisma) {
      throw new AppError('Database connection not initialized', 500);
    }

    // Find or create IITECH tenant
    let iitechTenant = await prisma.tenant.findUnique({
      where: { slug: 'iitech' },
    });

    if (!iitechTenant) {
      iitechTenant = await prisma.tenant.create({
        data: {
          name: 'IITECH Platform',
          slug: 'iitech',
          email: 'admin@iitech.com',
          phone: '+2341234567890',
          subscriptionStatus: 'active',
        },
      });
    }

    // Create or update admin user
    const passwordHash = await hashPassword('admin123');
    
    const existingUser = await prisma.user.findFirst({
      where: {
        tenantId: iitechTenant.id,
        email: 'admin@insight.com',
      },
    });

    let adminUser;
    if (existingUser) {
      // Update existing user
      adminUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          role: 'iitech_admin',
          isActive: true,
        },
      });
    } else {
      // Create new user
      adminUser = await prisma.user.create({
        data: {
          tenantId: iitechTenant.id,
          email: 'admin@insight.com',
          passwordHash,
          firstName: 'Admin',
          lastName: 'User',
          role: 'iitech_admin',
          isActive: true,
        },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Admin account created/updated successfully in PostgreSQL',
      data: {
        id: adminUser.id,
        email: adminUser.email,
        firstName: adminUser.firstName,
        lastName: adminUser.lastName,
        role: adminUser.role,
        tenantId: iitechTenant.id,
      },
    });
  } catch (error: any) {
    console.error('Error creating admin in PostgreSQL:', error);
    throw new AppError(`Failed to create admin account: ${error.message}`, 500);
  }
});
