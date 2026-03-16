/**
 * System Settings API Routes
 * Manage global platform configuration
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import {
  getSystemSettings,
  updateSystemSettings,
  toggleFeatureFlag,
  validateEmailConfig,
  getSystemHealth,
} from '../utils/systemSettings';
import { createAuditLog } from '../utils/audit';

export const settingsRouter = Router();

const emailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'aws-ses']),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPassword: z.string().optional(),
  sendgridKey: z.string().optional(),
  awsAccessKey: z.string().optional(),
  senderEmail: z.string().email(),
  senderName: z.string(),
});

const brandingSchema = z.object({
  platformName: z.string().min(1),
  logoUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  supportEmail: z.string().email(),
  supportPhone: z.string().optional(),
});

const featureFlagsSchema = z.record(z.string(), z.boolean());

const rateLimitSchema = z.object({
  apiCallsPerMinute: z.number().min(1),
  loginAttemptsPerHour: z.number().min(1),
  requestTimeoutSeconds: z.number().min(1),
});

/**
 * GET /api/settings - Get all system settings (superadmin only)
 */
settingsRouter.get(
  '/',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const settings = await getSystemSettings();
      
      // Mask sensitive data
      const safeSettings = {
        ...settings,
        emailConfig: {
          ...settings.emailConfig,
          smtpPassword: settings.emailConfig.smtpPassword ? '***' : undefined,
          sendgridKey: settings.emailConfig.sendgridKey ? '***' : undefined,
          awsAccessKey: settings.emailConfig.awsAccessKey ? '***' : undefined,
        },
        paymentConfig: {
          stripeSecret: settings.paymentConfig.stripeSecret ? '***' : undefined,
          paypalSecret: settings.paymentConfig.paypalSecret ? '***' : undefined,
        },
      };

      res.json({
        success: true,
        data: safeSettings,
      });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      throw new AppError('Failed to fetch system settings', 500);
    }
  }
);

/**
 * PATCH /api/settings/email - Update email configuration
 */
settingsRouter.patch(
  '/email',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const config = emailConfigSchema.parse(req.body);
      
      const validation = await validateEmailConfig(config);
      if (!validation.valid) {
        throw new AppError(`Invalid email config: ${validation.errors.join(', ')}`, 400);
      }

      const settings = await getSystemSettings();
      settings.emailConfig = config;
      
      await updateSystemSettings(settings, req.user!.id);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'update_email_config',
          entityType: 'settings',
          entityId: 'email',
          metadata: { provider: config.provider },
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'Email configuration updated',
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new AppError(`Validation error: ${error.errors[0].message}`, 400);
      }
      if (error instanceof AppError) throw error;
      console.error('Error updating email config:', error);
      throw new AppError('Failed to update email configuration', 500);
    }
  }
);

/**
 * PATCH /api/settings/branding - Update branding settings
 */
settingsRouter.patch(
  '/branding',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const branding = brandingSchema.parse(req.body);
      const settings = await getSystemSettings();
      settings.branding = branding;
      
      await updateSystemSettings(settings, req.user!.id);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'update_branding',
          entityType: 'settings',
          entityId: 'branding',
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'Branding updated',
        data: branding,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new AppError(`Validation error: ${error.errors[0].message}`, 400);
      }
      if (error instanceof AppError) throw error;
      console.error('Error updating branding:', error);
      throw new AppError('Failed to update branding', 500);
    }
  }
);

/**
 * PATCH /api/settings/feature-flags - Update feature flags
 */
settingsRouter.patch(
  '/feature-flags',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const flags = featureFlagsSchema.parse(req.body);
      const settings = await getSystemSettings();
      settings.featureFlags = { ...settings.featureFlags, ...flags };
      
      await updateSystemSettings(settings, req.user!.id);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'update_feature_flags',
          entityType: 'settings',
          entityId: 'feature_flags',
          metadata: { flags },
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'Feature flags updated',
        data: flags,
      });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      console.error('Error updating feature flags:', error);
      throw new AppError('Failed to update feature flags', 500);
    }
  }
);

/**
 * PATCH /api/settings/rate-limit - Update rate limiting
 */
settingsRouter.patch(
  '/rate-limit',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const limits = rateLimitSchema.parse(req.body);
      const settings = await getSystemSettings();
      settings.rateLimit = limits;
      
      await updateSystemSettings(settings, req.user!.id);

      try {
        await createAuditLog({
          tenantId: '__system__',
          userId: req.user!.id,
          action: 'update_rate_limits',
          entityType: 'settings',
          entityId: 'rate_limits',
        });
      } catch (auditError) {
        console.error('Audit log error:', auditError);
      }

      res.json({
        success: true,
        message: 'Rate limits updated',
        data: limits,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new AppError(`Validation error: ${error.errors[0].message}`, 400);
      }
      if (error instanceof AppError) throw error;
      console.error('Error updating rate limits:', error);
      throw new AppError('Failed to update rate limits', 500);
    }
  }
);

/**
 * GET /api/settings/health - Get system health
 */
settingsRouter.get(
  '/health',
  authenticate,
  requireRole('iitech_admin'),
  async (req: AuthRequest, res) => {
    try {
      const health = await getSystemHealth();
      res.json({
        success: true,
        data: health,
      });
    } catch (error: any) {
      console.error('Error getting system health:', error);
      throw new AppError('Failed to get system health', 500);
    }
  }
);
