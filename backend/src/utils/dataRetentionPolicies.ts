/**
 * Data Retention Policies Management
 * Define and enforce data retention rules for tenants
 */

import { prisma } from './prisma';
import { createAuditLog } from './audit';

export interface RetentionPolicy {
  id: string;
  tenantId: string;
  policyName: string;
  dataType: 'reservations' | 'audits' | 'analytics' | 'all';
  retentionDays: number;
  autoDelete: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RetentionStats {
  policiesActive: number;
  lastCleanupDate?: Date;
  recordsDeletedTotal: number;
  dataRetentionGB: number;
}

// Create or update retention policy
export const upsertRetentionPolicy = async (
  tenantId: string,
  policy: Partial<RetentionPolicy>,
  userId?: string
) => {
  try {
    const existing = await prisma.retentionPolicy.findUnique({
      where: { tenantId_policyName: { tenantId, policyName: policy.policyName || '' } },
    });

    const updatedPolicy = existing
      ? await prisma.retentionPolicy.update({
          where: { id: existing.id },
          data: {
            ...policy,
            nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        })
      : await prisma.retentionPolicy.create({
          data: {
            tenantId,
            policyName: policy.policyName || 'Default Policy',
            dataType: policy.dataType || 'all',
            retentionDays: policy.retentionDays || 90,
            autoDelete: policy.autoDelete ?? true,
            nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });

    await createAuditLog({
      tenantId,
      userId,
      action: 'UPDATE_RETENTION_POLICY',
      entityType: 'RetentionPolicy',
      entityId: updatedPolicy.id,
      beforeState: existing,
      afterState: updatedPolicy,
    });

    return updatedPolicy;
  } catch (error) {
    console.error('Error upserting retention policy:', error);
    throw error;
  }
};

// Get all retention policies for tenant
export const getTenantRetentionPolicies = async (tenantId: string): Promise<RetentionPolicy[]> => {
  try {
    return await prisma.retentionPolicy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error getting retention policies:', error);
    throw error;
  }
};

// Get retention stats
export const getRetentionStats = async (tenantId: string): Promise<RetentionStats> => {
  try {
    const policies = await getTenantRetentionPolicies(tenantId);

    return {
      policiesActive: policies.filter((p) => p.autoDelete).length,
      lastCleanupDate: policies[0]?.lastRunAt,
      recordsDeletedTotal: 0, // Would track from audit logs
      dataRetentionGB: 0, // Would calculate from actual storage
    };
  } catch (error) {
    console.error('Error getting retention stats:', error);
    throw error;
  }
};

// Simulate data cleanup (actual implementation would delete old records)
export const cleanupOldData = async (tenantId: string, daysOld: number = 90) => {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    // Count records that would be deleted (for auditing)
    const oldAudits = await prisma.audit.count({
      where: {
        tenantId,
        createdAt: { lt: cutoffDate },
      },
    });

    // In production, would actually delete here
    // await prisma.audit.deleteMany({...})

    return {
      itemsDeleted: oldAudits,
      cutoffDate,
      cleanedUpAt: new Date(),
    };
  } catch (error) {
    console.error('Error cleaning up old data:', error);
    throw error;
  }
};

// Delete a retention policy
export const deleteRetentionPolicy = async (policyId: string, userId?: string) => {
  try {
    const policy = await prisma.retentionPolicy.delete({
      where: { id: policyId },
    });

    await createAuditLog({
      tenantId: policy.tenantId,
      userId,
      action: 'DELETE_RETENTION_POLICY',
      entityType: 'RetentionPolicy',
      entityId: policyId,
      beforeState: policy,
    });

    return policy;
  } catch (error) {
    console.error('Error deleting retention policy:', error);
    throw error;
  }
};
