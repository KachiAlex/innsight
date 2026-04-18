import { Router } from 'express';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const settingsRouter = Router({ mergeParams: true });

// GET /api/tenants/:tenantId/settings
settingsRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;

      if (!prisma) {
        throw new AppError('Database connection not initialized', 500);
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      const settings = {
        currency: 'NGN',
        currencySymbol: '₦',
        timezone: 'Africa/Lagos',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        taxRate: 0,
        vatEnabled: false,
        vatRate: 0,
        invoicePrefix: 'INV',
        invoiceNumberFormat: 'INV-{YYYY}-{MM}-{####}',
        emailNotifications: true,
        smsNotifications: false,
        autoCheckout: false,
        autoCheckoutTime: '11:00',
        otherSettings: {},
        branding: tenant.branding || {
          primaryColor: '#0f172a',
          accentColor: '#7c3aed',
          logoUrl: null,
        },
        updatedAt: null,
      };

      res.json({
        success: true,
        data: settings,
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error fetching settings:', error);
      throw new AppError(
        `Failed to fetch settings: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

// PATCH /api/tenants/:tenantId/settings
settingsRouter.patch(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    throw new AppError('Settings update is currently unavailable. It needs to be migrated from Firebase to PostgreSQL.', 503);
  }
);

