import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../middleware/errorHandler';
import { authenticate, requireTenantAccess, requireRole, AuthRequest } from '../middleware/auth';
import { createAuditLog } from '../utils/audit';
import { db, now, toDate } from '../utils/firestore';

export const settingsRouter = Router({ mergeParams: true });

const brandingSchema = z
  .object({
    primaryColor: z
      .string()
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
        message: 'primaryColor must be a valid hex color (e.g. #0f172a)',
      })
      .optional(),
    accentColor: z
      .string()
      .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
        message: 'accentColor must be a valid hex color (e.g. #7c3aed)',
      })
      .optional(),
    logoUrl: z.string().url().optional(),
  })
  .strict();

const updateSettingsSchema = z.object({
  currency: z.string().min(3).max(3).optional(), // ISO 4217 currency code
  currencySymbol: z.string().optional(),
  timezone: z.string().optional(),
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(), // '12h' or '24h'
  taxRate: z.number().min(0).max(100).optional(),
  vatEnabled: z.boolean().optional(),
  vatRate: z.number().min(0).max(100).optional(),
  invoicePrefix: z.string().optional(),
  invoiceNumberFormat: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  smsNotifications: z.boolean().optional(),
  autoCheckout: z.boolean().optional(),
  autoCheckoutTime: z.string().optional(), // HH:mm format
  otherSettings: z.record(z.any()).optional(), // For any other custom settings
  branding: brandingSchema.optional(),
});

// GET /api/tenants/:tenantId/settings
settingsRouter.get(
  '/',
  authenticate,
  requireTenantAccess,
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;

      const tenantDoc = await db.collection('tenants').doc(tenantId).get();

      if (!tenantDoc.exists) {
        throw new AppError('Tenant not found', 404);
      }

      const tenantData = tenantDoc.data();
      
      // Get settings from tenant document or return defaults
      const branding =
        tenantData?.branding ||
        tenantData?.settings?.branding || {
          primaryColor: '#0f172a',
          accentColor: '#7c3aed',
          logoUrl: null,
        };
      const settings = {
        currency: tenantData?.settings?.currency || 'NGN',
        currencySymbol: tenantData?.settings?.currencySymbol || '₦',
        timezone: tenantData?.settings?.timezone || 'Africa/Lagos',
        dateFormat: tenantData?.settings?.dateFormat || 'DD/MM/YYYY',
        timeFormat: tenantData?.settings?.timeFormat || '24h',
        taxRate: tenantData?.settings?.taxRate || 0,
        vatEnabled: tenantData?.settings?.vatEnabled || false,
        vatRate: tenantData?.settings?.vatRate || 0,
        invoicePrefix: tenantData?.settings?.invoicePrefix || 'INV',
        invoiceNumberFormat: tenantData?.settings?.invoiceNumberFormat || 'INV-{YYYY}-{MM}-{####}',
        emailNotifications: tenantData?.settings?.emailNotifications !== undefined ? tenantData.settings.emailNotifications : true,
        smsNotifications: tenantData?.settings?.smsNotifications !== undefined ? tenantData.settings.smsNotifications : false,
        autoCheckout: tenantData?.settings?.autoCheckout || false,
        autoCheckoutTime: tenantData?.settings?.autoCheckoutTime || '11:00',
        otherSettings: tenantData?.settings?.otherSettings || {},
        updatedAt: tenantData?.settings?.updatedAt ? toDate(tenantData.settings.updatedAt) : null,
        branding,
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
  requireRole('owner', 'general_manager'),
  async (req: AuthRequest, res) => {
    try {
      const tenantId = req.params.tenantId;
      const data = updateSettingsSchema.parse(req.body);

      const tenantDoc = await db.collection('tenants').doc(tenantId).get();

      if (!tenantDoc.exists) {
        throw new AppError('Tenant not found', 404);
      }

      const tenantData = tenantDoc.data();
      const beforeState = tenantData?.settings || {};

      // Update settings
      const currentSettings = tenantData?.settings || {};
      const currentBranding =
        (currentSettings?.branding as Record<string, any>) ||
        tenantData?.branding ||
        {};
      const mergedBranding = data.branding
        ? {
            ...currentBranding,
            ...data.branding,
          }
        : currentBranding;
      const updatedSettings = {
        ...currentSettings,
        ...data,
        branding: mergedBranding,
        updatedAt: now(),
      };

      await tenantDoc.ref.update({
        settings: updatedSettings,
        branding: Object.keys(mergedBranding).length ? mergedBranding : null,
        updatedAt: now(),
      });

      await createAuditLog({
        tenantId,
        userId: req.user!.id,
        action: 'update_settings',
        entityType: 'settings',
        entityId: tenantId,
        beforeState,
        afterState: updatedSettings,
      });

      res.json({
        success: true,
        data: {
          ...updatedSettings,
          updatedAt: toDate(updatedSettings.updatedAt),
        },
      });
    } catch (error: any) {
      if (error instanceof AppError) {
        throw error;
      }
      console.error('Error updating settings:', error);
      throw new AppError(
        `Failed to update settings: ${error.message || 'Database connection error'}`,
        500
      );
    }
  }
);

