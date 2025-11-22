import { prisma } from './prisma';

export interface AlertParams {
  tenantId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata?: any;
}

export const createAlert = async (params: AlertParams) => {
  try {
    await prisma.alert.create({
      data: {
        tenantId: params.tenantId,
        alertType: params.alertType,
        severity: params.severity,
        title: params.title,
        message: params.message,
        metadata: params.metadata || null,
      },
    });

    // TODO: Send email/SMS/push notification based on severity
    // For MVP, alerts are stored and can be viewed in dashboard
  } catch (error) {
    console.error('Failed to create alert:', error);
  }
};
