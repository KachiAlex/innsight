/**
 * Tenant Quick Actions
 * Utility functions for immediate tenant admin actions
 */

import { prisma } from './prisma';
import { createAuditLog } from './audit';

export interface TenantQuickAction {
  tenantId: string;
  action: 'suspend' | 'reactivate' | 'delete';
  reason?: string;
  performedBy?: string;
}

// Suspend a tenant (disable all access)
export const suspendTenant = async (tenantId: string, reason?: string, userId?: string) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'suspended',
        metadata: {
          suspendedAt: new Date().toISOString(),
          suspensionReason: reason || 'Admin suspension',
        },
      },
    });

    // Log the action
    await createAuditLog({
      tenantId,
      userId,
      action: 'SUSPEND_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      beforeState: { status: 'active' },
      afterState: { status: 'suspended' },
      metadata: { reason },
    });

    return tenant;
  } catch (error) {
    console.error('Error suspending tenant:', error);
    throw error;
  }
};

// Reactivate a suspended tenant
export const reactivateTenant = async (tenantId: string, userId?: string) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'active',
        metadata: {
          reactivatedAt: new Date().toISOString(),
        },
      },
    });

    // Log the action
    await createAuditLog({
      tenantId,
      userId,
      action: 'REACTIVATE_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      beforeState: { status: 'suspended' },
      afterState: { status: 'active' },
    });

    return tenant;
  } catch (error) {
    console.error('Error reactivating tenant:', error);
    throw error;
  }
};

// Delete a tenant (hard delete - use with caution)
export const deleteTenant = async (tenantId: string, userId?: string) => {
  try {
    // Soft delete - mark as deleted instead of hard delete
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'deleted',
        metadata: {
          deletedAt: new Date().toISOString(),
        },
      },
    });

    // Log the action
    await createAuditLog({
      tenantId,
      userId,
      action: 'DELETE_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      beforeState: { status: 'active' },
      afterState: { status: 'deleted' },
    });

    return tenant;
  } catch (error) {
    console.error('Error deleting tenant:', error);
    throw error;
  }
};

// Get tenant status summary for quick view
export const getTenantQuickStatus = async (tenantId: string) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      status: tenant.subscriptionStatus,
      email: tenant.email,
      createdAt: tenant.createdAt,
      lastActionAt: tenant.metadata?.lastActionAt,
      suspended: tenant.subscriptionStatus === 'suspended',
      canSuspend: tenant.subscriptionStatus === 'active',
      canReactivate: tenant.subscriptionStatus === 'suspended',
    };
  } catch (error) {
    console.error('Error getting tenant status:', error);
    throw error;
  }
};

// Batch actions
export const batchSuspendTenants = async (tenantIds: string[], reason?: string, userId?: string) => {
  const results = [];

  for (const tenantId of tenantIds) {
    try {
      const result = await suspendTenant(tenantId, reason, userId);
      results.push({ tenantId, success: true, tenant: result });
    } catch (error) {
      results.push({ tenantId, success: false, error: String(error) });
    }
  }

  return results;
};

export const batchReactivateTenants = async (tenantIds: string[], userId?: string) => {
  const results = [];

  for (const tenantId of tenantIds) {
    try {
      const result = await reactivateTenant(tenantId, userId);
      results.push({ tenantId, success: true, tenant: result });
    } catch (error) {
      results.push({ tenantId, success: false, error: String(error) });
    }
  }

  return results;
};
