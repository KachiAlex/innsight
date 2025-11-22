import { prisma } from './prisma';

export interface AuditLogParams {
  tenantId: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  metadata?: any;
}

export const createAuditLog = async (params: AuditLogParams) => {
  try {
    await prisma.audit.create({
      data: {
        tenantId: params.tenantId,
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        beforeState: params.beforeState ? JSON.parse(JSON.stringify(params.beforeState)) : null,
        afterState: params.afterState ? JSON.parse(JSON.stringify(params.afterState)) : null,
        metadata: params.metadata || null,
      },
    });
  } catch (error) {
    // Don't fail the main operation if audit logging fails
    console.error('Failed to create audit log:', error);
  }
};
