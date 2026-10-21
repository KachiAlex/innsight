import { prisma } from './prisma';
import { sendEmail } from './email';
import { triggerTenantWebhookEvent } from './tenantWebhooks';

export interface AlertParams {
  tenantId: string;
  alertType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  metadata?: any;
}

const EMAIL_SEVERITIES = new Set(['high', 'critical']);

// Email tenant owners/general managers for high & critical alerts
const notifyTenantManagers = async (params: AlertParams) => {
  const managers = await prisma.user.findMany({
    where: {
      tenantId: params.tenantId,
      role: { in: ['owner', 'general_manager'] },
      isActive: true,
    },
    select: { email: true },
    take: 10,
  });

  const recipients = managers.map((m) => m.email);

  if (recipients.length === 0) return;

  const subject = `[${params.severity.toUpperCase()}] ${params.title}`;
  await sendEmail({
    to: recipients,
    subject,
    tenantId: params.tenantId,
    trackOpens: false,
    html: `
      <h2>${params.title}</h2>
      <p><strong>Severity:</strong> ${params.severity.toUpperCase()}</p>
      <p><strong>Type:</strong> ${params.alertType}</p>
      <p>${params.message}</p>
      <p style="color:#888;font-size:12px">This is an automated alert from InnSight.</p>
    `,
  });
};

export const createAlert = async (params: AlertParams) => {
  try {
    if (!prisma) {
      console.warn('Prisma client not initialized, skipping alert creation');
      return;
    }

    const alertData = {
      tenantId: params.tenantId,
      alertType: params.alertType,
      severity: params.severity,
      title: params.title,
      message: params.message,
      metadata: params.metadata || null,
      status: 'open' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const alert = await prisma.alert.create({ data: alertData });

    // Fan-out delivery — fire-and-forget so alert creation never blocks
    const deliveries: Promise<unknown>[] = [
      triggerTenantWebhookEvent({
        tenantId: params.tenantId,
        eventType: 'alert.created',
        payload: {
          alertId: alert.id,
          alertType: params.alertType,
          severity: params.severity,
          title: params.title,
          message: params.message,
          metadata: params.metadata,
        },
      }),
    ];

    if (EMAIL_SEVERITIES.has(params.severity)) {
      deliveries.push(notifyTenantManagers(params));
    }

    await Promise.allSettled(deliveries);
  } catch (error) {
    console.error('Failed to create alert:', error);
  }
};
