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

// Expected failures (e.g. batch op on a missing tenant) are warnings, not errors
const logActionError = (action: string, error: unknown) => {
  const code = (error as { code?: string })?.code;
  if (code === 'P2025' || code === 'P2003') {
    console.warn(`Tenant ${action}: ${(error as Error)?.message || error}`);
    return;
  }
  console.error(`Error in tenant ${action}:`, error);
};

const mergeTenantMetadata = async (
  tenantId: string,
  patch: Record<string, unknown>
) => {
  const current = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { metadata: true },
  });
  const existing =
    current?.metadata && typeof current.metadata === 'object'
      ? (current.metadata as Record<string, unknown>)
      : {};
  return { ...existing, ...patch, lastActionAt: new Date().toISOString() };
};

// Suspend a tenant (disable all access)
export const suspendTenant = async (tenantId: string, reason?: string, userId?: string) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: 'suspended',
        metadata: await mergeTenantMetadata(tenantId, {
          suspendedAt: new Date().toISOString(),
          suspensionReason: reason || 'Admin suspension',
        }),
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
    logActionError('suspend', error);
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
        metadata: await mergeTenantMetadata(tenantId, {
          reactivatedAt: new Date().toISOString(),
        }),
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
    logActionError('reactivate', error);
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
        metadata: await mergeTenantMetadata(tenantId, {
          deletedAt: new Date().toISOString(),
        }),
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
    logActionError('delete', error);
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

type BatchActionResult =
  | { tenantId: string; success: true; tenant: unknown }
  | { tenantId: string; success: false; error: string };

// Batch actions
export const batchSuspendTenants = async (tenantIds: string[], reason?: string, userId?: string) => {
  const results: BatchActionResult[] = [];

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
  const results: BatchActionResult[] = [];

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
