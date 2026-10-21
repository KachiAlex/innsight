import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { prisma } from '../utils/prisma';

export const settingsRouter = Router({ mergeParams: true });

const DEFAULT_SETTINGS = {
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
};

const DEFAULT_BRANDING = {
  primaryColor: '#0f172a',
  accentColor: '#7c3aed',
  logoUrl: null,
};

const settingsSchema = z
  .object({
    currency: z.string().optional(),
    currencySymbol: z.string().optional(),
    timezone: z.string().optional(),
    dateFormat: z.string().optional(),
    timeFormat: z.string().optional(),
    taxRate: z.number().min(0).optional(),
    vatEnabled: z.boolean().optional(),
    vatRate: z.number().min(0).optional(),
    invoicePrefix: z.string().optional(),
    invoiceNumberFormat: z.string().optional(),
    emailNotifications: z.boolean().optional(),
    smsNotifications: z.boolean().optional(),
    autoCheckout: z.boolean().optional(),
    autoCheckoutTime: z.string().optional(),
    otherSettings: z.any().optional(),
    branding: z
      .object({
        primaryColor: z.string().optional(),
        accentColor: z.string().optional(),
        logoUrl: z.string().nullable().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const buildSettings = (tenant: any) => ({
  ...DEFAULT_SETTINGS,
  ...((tenant.taxSettings as any) || {}),
  branding: { ...DEFAULT_BRANDING, ...((tenant.branding as any) || {}) },
  updatedAt: tenant.updatedAt,
});

// GET /api/tenants/:tenantId/settings
settingsRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.params.tenantId },
      });
      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      res.json({ success: true, data: buildSettings(tenant) });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
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
    try {
      const tenantId = req.params.tenantId;
      const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
      if (!tenant) {
        throw new AppError('Tenant not found', 404);
      }

      const { branding, updatedAt, ...rest } = settingsSchema.parse(req.body);

      const mergedTaxSettings = {
        ...((tenant.taxSettings as any) || {}),
        ...rest,
      };
      const mergedBranding = branding
        ? { ...((tenant.branding as any) || {}), ...branding }
        : undefined;

      const updated = await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          taxSettings: mergedTaxSettings,
          ...(mergedBranding && { branding: mergedBranding }),
        },
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_tenant_settings',
        entityType: 'tenant',
        entityId: tenantId,
        beforeState: tenant.taxSettings,
        afterState: updated.taxSettings,
      });

      res.json({ success: true, data: buildSettings(updated) });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(`Failed to update settings: ${error.message}`, 500);
    }
  }
);
