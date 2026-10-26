import { prisma } from './prisma';

export interface AuditLogParams {
  tenantId?: string | null;
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: any;
  afterState?: any;
  metadata?: any;
}

export const createAuditLog = async (params: AuditLogParams) => {
  const buildData = (userId: string | null | undefined) => ({
    tenantId: params.tenantId,
    userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    beforeState: params.beforeState ? JSON.parse(JSON.stringify(params.beforeState)) : null,
    afterState: params.afterState ? JSON.parse(JSON.stringify(params.afterState)) : null,
    metadata: params.metadata || null,
  });

  try {
    await prisma.audit.create({ data: buildData(params.userId) });
  } catch (error: any) {
    // If the JWT references a user that no longer exists, retry unattributed
    // rather than losing the audit record entirely.
    if (params.userId && error?.code === 'P2003') {
      try {
        await prisma.audit.create({ data: buildData(null) });
        console.warn(
          `Audit log stored unattributed: userId ${params.userId} no longer exists ` +
            `(action=${params.action} ${params.entityType}/${params.entityId})`
        );
        return;
      } catch (retryError) {
        console.error('Failed to create audit log (unattributed retry):', retryError);
        return;
      }
    }
    // Don't fail the main operation if audit logging fails
    console.error('Failed to create audit log:', error);
  }
};
