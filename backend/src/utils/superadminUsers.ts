/**
 * Superadmin User Management
 * Create and manage iitech_admin accounts
 */

import { prisma } from './prisma';
import { hashPassword } from './password';

export interface SuperadminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'iitech_admin';
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  permissions: string[];
}

export interface SuperadminPermission {
  id: string;
  name: string;
  description: string;
  category: 'tenant' | 'settings' | 'billing' | 'analytics' | 'support';
}

const DEFAULT_PERMISSIONS: SuperadminPermission[] = [
  // Tenant Management
  { id: 'tenant.create', name: 'Create Tenants', description: 'Create new tenant organizations', category: 'tenant' },
  { id: 'tenant.read', name: 'View Tenants', description: 'View tenant information', category: 'tenant' },
  { id: 'tenant.update', name: 'Edit Tenants', description: 'Update tenant details', category: 'tenant' },
  { id: 'tenant.delete', name: 'Delete Tenants', description: 'Delete tenant organizations', category: 'tenant' },
  { id: 'tenant.admin', name: 'Manage Tenant Admins', description: 'Reset passwords and manage tenant owners', category: 'tenant' },
  
  // Settings
  { id: 'settings.read', name: 'View Settings', description: 'View system settings', category: 'settings' },
  { id: 'settings.update', name: 'Edit Settings', description: 'Update system configuration', category: 'settings' },
  { id: 'settings.email', name: 'Manage Email Config', description: 'Configure email settings', category: 'settings' },
  { id: 'settings.features', name: 'Toggle Features', description: 'Enable/disable platform features', category: 'settings' },
  
  // Billing
  { id: 'billing.read', name: 'View Billing', description: 'View billing and subscription data', category: 'billing' },
  { id: 'billing.manage', name: 'Manage Billing', description: 'Update subscription plans', category: 'billing' },
  { id: 'billing.invoices', name: 'Manage Invoices', description: 'Create and view invoices', category: 'billing' },
  
  // Analytics
  { id: 'analytics.read', name: 'View Analytics', description: 'View platform analytics', category: 'analytics' },
  { id: 'analytics.reports', name: 'Generate Reports', description: 'Create custom reports', category: 'analytics' },
  
  // Support
  { id: 'support.tickets', name: 'View Support Tickets', description: 'View customer support tickets', category: 'support' },
  { id: 'support.respond', name: 'Respond to Tickets', description: 'Reply to support tickets', category: 'support' },
];

/**
 * Get all superadmin users
 */
export async function getSuperadminUsers(): Promise<SuperadminUser[]> {
  try {
    const users = await prisma?.user.findMany({
      where: {
        role: 'iitech_admin',
        tenantId: null, // Platform-level users have no tenant
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return (users || []).map((u: any) => ({
      ...u,
      permissions: DEFAULT_PERMISSIONS.map((p) => p.id), // For now, all superadmins have all permissions
    }));
  } catch (error) {
    console.error('Error fetching superadmin users:', error);
    return [];
  }
}

/**
 * Get superadmin user by ID
 */
export async function getSuperadminUser(userId: string): Promise<SuperadminUser | null> {
  try {
    const user = await prisma?.user.findFirst({
      where: {
        id: userId,
        role: 'iitech_admin',
        tenantId: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return null;

    return {
      ...user,
      permissions: DEFAULT_PERMISSIONS.map((p) => p.id),
    };
  } catch (error) {
    console.error('Error fetching superadmin user:', error);
    return null;
  }
}

/**
 * Create new superadmin user
 */
export async function createSuperadminUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  phone?: string
): Promise<SuperadminUser> {
  try {
    // Check if email already exists (across all users)
    const existing = await prisma?.user.findFirst({
      where: { email },
    });

    if (existing) {
      throw new Error(`Email ${email} is already registered`);
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma?.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        phone: phone || null,
        role: 'iitech_admin',
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...user,
      permissions: DEFAULT_PERMISSIONS.map((p) => p.id),
    };
  } catch (error: any) {
    console.error('Error creating superadmin user:', error);
    throw error;
  }
}

/**
 * Update superadmin user
 */
export async function updateSuperadminUser(
  userId: string,
  updates: Partial<{
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    isActive: boolean;
    password: string;
  }>
): Promise<SuperadminUser> {
  try {
    const user = await getSuperadminUser(userId);
    if (!user) throw new Error('Superadmin user not found');

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (updates.email && updates.email !== user.email) {
      const existing = await prisma?.user.findFirst({
        where: {
          email: updates.email,
          id: { not: userId },
        },
      });
      if (existing) throw new Error(`Email ${updates.email} is already in use`);
      updateData.email = updates.email;
    }

    if (updates.firstName) updateData.firstName = updates.firstName;
    if (updates.lastName) updateData.lastName = updates.lastName;
    if (updates.phone !== undefined) updateData.phone = updates.phone || null;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    
    if (updates.password) {
      updateData.passwordHash = await hashPassword(updates.password);
    }

    const updated = await prisma?.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...updated,
      permissions: DEFAULT_PERMISSIONS.map((p) => p.id),
    };
  } catch (error) {
    console.error('Error updating superadmin user:', error);
    throw error;
  }
}

/**
 * Deactivate superadmin user (soft delete)
 */
export async function deactivateSuperadminUser(userId: string): Promise<void> {
  try {
    await prisma?.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error deactivating superadmin user:', error);
    throw error;
  }
}

/**
 * Reactivate superadmin user
 */
export async function reactivateSuperadminUser(userId: string): Promise<void> {
  try {
    await prisma?.user.update({
      where: { id: userId },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error reactivating superadmin user:', error);
    throw error;
  }
}

/**
 * Get superadmin activity log
 */
export async function getSuperadminActivityLog(
  userId: string,
  limit: number = 50
): Promise<Array<{ action: string; timestamp: Date; details?: string }>> {
  try {
    // This would query from audit logs
    // For now, return empty array
    return [];
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return [];
  }
}

/**
 * Get all available permissions
 */
export function getAvailablePermissions(): SuperadminPermission[] {
  return DEFAULT_PERMISSIONS;
}
