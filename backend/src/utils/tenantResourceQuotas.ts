/**
 * Tenant Resource Quotas Management
 * Manage resource limits and usage for tenants
 */

import { prisma } from './prisma';
import { createAuditLog } from './audit';

export interface ResourceQuota {
  id: string;
  tenantId: string;
  maxRooms: number;
  maxUsers: number;
  maxReservations: number;
  maxStorageGB: number;
  maxApiCallsPerDay: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResourceUsage {
  tenantId: string;
  roomsUsed: number;
  usersUsed: number;
  reservationsUsed: number;
  storageUsedGB: number;
  apiCallsUsedToday: number;
}

// Get quotas for a tenant
export const getTenantQuotas = async (tenantId: string): Promise<ResourceQuota | null> => {
  try {
    return await prisma.resourceQuota.findUnique({
      where: { tenantId },
    });
  } catch (error) {
    console.error('Error getting tenant quotas:', error);
    throw error;
  }
};

// Set or update quotas for a tenant
export const updateTenantQuotas = async (
  tenantId: string,
  quotaData: Partial<ResourceQuota>,
  userId?: string
) => {
  try {
    const existing = await prisma.resourceQuota.findUnique({
      where: { tenantId },
    });

    const quota = existing
      ? await prisma.resourceQuota.update({
          where: { tenantId },
          data: quotaData,
        })
      : await prisma.resourceQuota.create({
          data: {
            tenantId,
            ...quotaData,
            maxRooms: quotaData.maxRooms || 50,
            maxUsers: quotaData.maxUsers || 100,
            maxReservations: quotaData.maxReservations || 1000,
            maxStorageGB: quotaData.maxStorageGB || 100,
            maxApiCallsPerDay: quotaData.maxApiCallsPerDay || 10000,
          },
        });

    // Audit log
    await createAuditLog({
      tenantId,
      userId,
      action: 'UPDATE_QUOTAS',
      entityType: 'ResourceQuota',
      entityId: tenantId,
      beforeState: existing,
      afterState: quota,
    });

    return quota;
  } catch (error) {
    console.error('Error updating tenant quotas:', error);
    throw error;
  }
};

// Get resource usage for a tenant
export const getTenantResourceUsage = async (tenantId: string): Promise<ResourceUsage> => {
  try {
    const [roomsCount, usersCount, reservationsCount] = await Promise.all([
      prisma.room.count({ where: { tenantId } }),
      prisma.user.count({ where: { tenantId } }),
      prisma.reservation.count({ where: { tenantId } }),
    ]);

    return {
      tenantId,
      roomsUsed: roomsCount,
      usersUsed: usersCount,
      reservationsUsed: reservationsCount,
      storageUsedGB: 0, // Would need actual file tracking
      apiCallsUsedToday: 0, // Would need API call logging
    };
  } catch (error) {
    console.error('Error getting tenant resource usage:', error);
    throw error;
  }
};

// Check if tenant is approaching quota limits
export const checkQuotaWarnings = async (tenantId: string) => {
  try {
    const [quotas, usage] = await Promise.all([
      getTenantQuotas(tenantId),
      getTenantResourceUsage(tenantId),
    ]);

    if (!quotas) return [];

    const warnings: Array<{ resource: string; percentage: number; message: string }> = [];

    const roomsPercentage = (usage.roomsUsed / quotas.maxRooms) * 100;
    if (roomsPercentage > 80) {
      warnings.push({
        resource: 'Rooms',
        percentage: roomsPercentage,
        message: `Rooms quota at ${Math.round(roomsPercentage)}%`,
      });
    }

    const usersPercentage = (usage.usersUsed / quotas.maxUsers) * 100;
    if (usersPercentage > 80) {
      warnings.push({
        resource: 'Users',
        percentage: usersPercentage,
        message: `Users quota at ${Math.round(usersPercentage)}%`,
      });
    }

    const reservationsPercentage = (usage.reservationsUsed / quotas.maxReservations) * 100;
    if (reservationsPercentage > 80) {
      warnings.push({
        resource: 'Reservations',
        percentage: reservationsPercentage,
        message: `Reservations quota at ${Math.round(reservationsPercentage)}%`,
      });
    }

    return warnings;
  } catch (error) {
    console.error('Error checking quota warnings:', error);
    return [];
  }
};

// Get usage percentages for display
export const getQuotaUsagePercentages = async (
  tenantId: string
): Promise<{ [key: string]: number } | null> => {
  try {
    const [quotas, usage] = await Promise.all([
      getTenantQuotas(tenantId),
      getTenantResourceUsage(tenantId),
    ]);

    if (!quotas) return null;

    return {
      rooms: Math.round((usage.roomsUsed / quotas.maxRooms) * 100),
      users: Math.round((usage.usersUsed / quotas.maxUsers) * 100),
      reservations: Math.round((usage.reservationsUsed / quotas.maxReservations) * 100),
      storage: Math.round((usage.storageUsedGB / quotas.maxStorageGB) * 100),
      apiCalls: Math.round((usage.apiCallsUsedToday / quotas.maxApiCallsPerDay) * 100),
    };
  } catch (error) {
    console.error('Error getting quota usage percentages:', error);
    return null;
  }
};
