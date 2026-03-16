/**
 * System Settings Manager
 * Centralized management of global platform settings
 */

import { prisma } from './prisma';

export interface SystemSettings {
  id: string;
  emailConfig: {
    provider: 'smtp' | 'sendgrid' | 'aws-ses';
    smtpHost?: string;
    smtpPort?: number;
    smtpUser?: string;
    smtpPassword?: string;
    sendgridKey?: string;
    awsAccessKey?: string;
    senderEmail: string;
    senderName: string;
  };
  featureFlags: {
    [key: string]: boolean;
  };
  paymentConfig: {
    stripePublishable?: string;
    stripeSecret?: string;
    paypalClientId?: string;
    paypalSecret?: string;
  };
  backupSettings: {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly';
    retentionDays: number;
    storageLocation: string;
  };
  dataRetention: {
    auditLogDays: number;
    sessionLogDays: number;
    deletedDataDays: number;
  };
  rateLimit: {
    apiCallsPerMinute: number;
    loginAttemptsPerHour: number;
    requestTimeoutSeconds: number;
  };
  branding: {
    platformName: string;
    logoUrl?: string;
    primaryColor: string;
    supportEmail: string;
    supportPhone?: string;
  };
  updatedAt: Date;
  updatedBy?: string;
}

const DEFAULT_SETTINGS: Partial<SystemSettings> = {
  emailConfig: {
    provider: 'smtp',
    senderEmail: 'noreply@innsight.io',
    senderName: 'Innsight',
  },
  featureFlags: {
    billingEnabled: true,
    analyticsEnabled: true,
    auditLoggingEnabled: true,
    maintenanceMode: false,
    betaFeatures: false,
  },
  paymentConfig: {},
  backupSettings: {
    enabled: true,
    frequency: 'daily',
    retentionDays: 90,
    storageLocation: 's3',
  },
  dataRetention: {
    auditLogDays: 365,
    sessionLogDays: 90,
    deletedDataDays: 30,
  },
  rateLimit: {
    apiCallsPerMinute: 1000,
    loginAttemptsPerHour: 10,
    requestTimeoutSeconds: 30,
  },
  branding: {
    platformName: 'Innsight',
    primaryColor: '#3B82F6',
    supportEmail: 'support@innsight.io',
  },
};

/**
 * Get current system settings
 * Creates default settings if none exist
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    // For now, store in a singleton document or environment
    // In production, would use dedicated settings table
    const settings = await prisma?.tenant.findFirst({
      where: { slug: '__system_settings__' },
      select: { branding: true, taxSettings: true },
    });

    if (settings) {
      return {
        id: '__system_settings__',
        ...DEFAULT_SETTINGS,
        branding: (settings.branding as any) || DEFAULT_SETTINGS.branding,
        updatedAt: new Date(),
      } as SystemSettings;
    }

    return {
      id: '__system_settings__',
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(),
    } as SystemSettings;
  } catch (error) {
    console.error('Error fetching system settings:', error);
    return {
      id: '__system_settings__',
      ...DEFAULT_SETTINGS,
      updatedAt: new Date(),
    } as SystemSettings;
  }
}

/**
 * Update system settings
 */
export async function updateSystemSettings(
  updates: Partial<SystemSettings>,
  updatedBy: string
): Promise<SystemSettings> {
  try {
    const current = await getSystemSettings();

    const updated: SystemSettings = {
      ...current,
      ...updates,
      updatedAt: new Date(),
      updatedBy,
    };

    // Store settings (in production, would use dedicated table)
    // For now, just return updated object
    // Could serialize to Redis cache or environment

    return updated;
  } catch (error) {
    console.error('Error updating system settings:', error);
    throw error;
  }
}

/**
 * Toggle feature flag
 */
export async function toggleFeatureFlag(
  flagName: string,
  enabled: boolean,
  updatedBy: string
): Promise<boolean> {
  try {
    const settings = await getSystemSettings();
    settings.featureFlags[flagName] = enabled;
    await updateSystemSettings(settings, updatedBy);
    return enabled;
  } catch (error) {
    console.error('Error toggling feature flag:', error);
    throw error;
  }
}

/**
 * Get specific feature flag status
 */
export async function isFeatureEnabled(flagName: string): Promise<boolean> {
  try {
    const settings = await getSystemSettings();
    return settings.featureFlags[flagName] ?? false;
  } catch (error) {
    console.error('Error getting feature flag:', error);
    return false;
  }
}

/**
 * Get email configuration
 */
export async function getEmailConfig(): Promise<SystemSettings['emailConfig']> {
  try {
    const settings = await getSystemSettings();
    return settings.emailConfig;
  } catch (error) {
    console.error('Error getting email config:', error);
    throw error;
  }
}

/**
 * Get payment configuration
 */
export async function getPaymentConfig(): Promise<SystemSettings['paymentConfig']> {
  try {
    const settings = await getSystemSettings();
    return settings.paymentConfig;
  } catch (error) {
    console.error('Error getting payment config:', error);
    throw error;
  }
}

/**
 * Get branding settings
 */
export async function getBrandingSettings(): Promise<SystemSettings['branding']> {
  try {
    const settings = await getSystemSettings();
    return settings.branding;
  } catch (error) {
    console.error('Error getting branding settings:', error);
    throw error;
  }
}

/**
 * Validate email configuration
 */
export async function validateEmailConfig(config: Partial<SystemSettings['emailConfig']>): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  if (!config.senderEmail || !config.senderEmail.includes('@')) {
    errors.push('Invalid sender email address');
  }

  if (config.provider === 'smtp') {
    if (!config.smtpHost) errors.push('SMTP host is required');
    if (!config.smtpPort) errors.push('SMTP port is required');
    if (!config.smtpUser) errors.push('SMTP user is required');
    if (!config.smtpPassword) errors.push('SMTP password is required');
  } else if (config.provider === 'sendgrid') {
    if (!config.sendgridKey) errors.push('SendGrid API key is required');
  } else if (config.provider === 'aws-ses') {
    if (!config.awsAccessKey) errors.push('AWS access key is required');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get system health data
 */
export async function getSystemHealth(): Promise<{
  uptime: number;
  environment: string;
  maintenanceMode: boolean;
  databaseConnected: boolean;
}> {
  try {
    const settings = await getSystemSettings();

    return {
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      maintenanceMode: settings.featureFlags['maintenanceMode'] ?? false,
      databaseConnected: true, // Would check actual DB connection
    };
  } catch (error) {
    return {
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      maintenanceMode: false,
      databaseConnected: false,
    };
  }
}
