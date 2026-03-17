/**
 * Integration Management
 * Manage third-party integrations and webhooks for tenants
 */

import { prisma } from './prisma';
import { createAuditLog } from './audit';

export interface Integration {
  id: string;
  tenantId: string;
  name: string;
  type: 'payment' | 'email' | 'sms' | 'messaging' | 'analytics' | 'custom';
  status: 'active' | 'inactive' | 'error';
  config: any; // Integration-specific configuration
  apiKey?: string;
  webhookUrl?: string;
  lastSyncAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Create integration
export const createIntegration = async (
  tenantId: string,
  integrationData: Partial<Integration>,
  userId?: string
) => {
  try {
    const integration = await prisma.integration.create({
      data: {
        tenantId,
        name: integrationData.name || 'New Integration',
        type: integrationData.type || 'custom',
        status: 'inactive',
        config: integrationData.config || {},
        apiKey: integrationData.apiKey,
        webhookUrl: integrationData.webhookUrl,
      },
    });

    await createAuditLog({
      tenantId,
      userId,
      action: 'CREATE_INTEGRATION',
      entityType: 'Integration',
      entityId: integration.id,
      afterState: integration,
    });

    return integration;
  } catch (error) {
    console.error('Error creating integration:', error);
    throw error;
  }
};

// Get tenant integrations
export const getTenantIntegrations = async (tenantId: string): Promise<Integration[]> => {
  try {
    return await prisma.integration.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        // Don't select apiKey for security
      },
    });
  } catch (error) {
    console.error('Error getting tenant integrations:', error);
    throw error;
  }
};

// Update integration
export const updateIntegration = async (
  integrationId: string,
  updateData: Partial<Integration>,
  userId?: string
) => {
  try {
    const before = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    const updated = await prisma.integration.update({
      where: { id: integrationId },
      data: updateData,
    });

    if (before) {
      await createAuditLog({
        tenantId: updated.tenantId,
        userId,
        action: 'UPDATE_INTEGRATION',
        entityType: 'Integration',
        entityId: integrationId,
        beforeState: before,
        afterState: updated,
      });
    }

    return updated;
  } catch (error) {
    console.error('Error updating integration:', error);
    throw error;
  }
};

// Delete integration
export const deleteIntegration = async (integrationId: string, userId?: string) => {
  try {
    const integration = await prisma.integration.delete({
      where: { id: integrationId },
    });

    await createAuditLog({
      tenantId: integration.tenantId,
      userId,
      action: 'DELETE_INTEGRATION',
      entityType: 'Integration',
      entityId: integrationId,
      beforeState: integration,
    });

    return integration;
  } catch (error) {
    console.error('Error deleting integration:', error);
    throw error;
  }
};

// Test integration connection
export const testIntegrationConnection = async (integrationId: string) => {
  try {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new Error('Integration not found');
    }

    // Simulate connection test (actual implementation would vary by type)
    const isConnected = !!integration.apiKey;

    if (isConnected) {
      await updateIntegration(integrationId, {
        status: 'active',
        lastSyncAt: new Date(),
      });

      return { success: true, message: 'Connection successful' };
    } else {
      await updateIntegration(integrationId, {
        status: 'error',
        errorMessage: 'Missing API key',
      });

      return { success: false, message: 'Missing API credentials' };
    }
  } catch (error) {
    console.error('Error testing integration:', error);
    throw error;
  }
};

// Get integration statistics
export const getIntegrationStats = async (tenantId: string) => {
  try {
    const integrations = await getTenantIntegrations(tenantId);

    return {
      total: integrations.length,
      active: integrations.filter((i) => i.status === 'active').length,
      inactive: integrations.filter((i) => i.status === 'inactive').length,
      errors: integrations.filter((i) => i.status === 'error').length,
      byType: integrations.reduce(
        (acc, i) => {
          acc[i.type] = (acc[i.type] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number }
      ),
    };
  } catch (error) {
    console.error('Error getting integration stats:', error);
    throw error;
  }
};
