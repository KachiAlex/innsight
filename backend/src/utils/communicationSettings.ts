import { createAuditLog } from './audit';

export interface EmailTemplate {
  id: string;
  name: string;
  category: 'reservation' | 'cancellation' | 'check-in' | 'check-out' | 'payment' | 'notification' | 'system' | 'other';
  subject: string;
  htmlContent: string;
  plainTextContent?: string;
  variables: string[]; // e.g., ['{{guestName}}', '{{bookingId}}']
  defaultTemplate: boolean;
  tenantId?: string; // if empty, it's a platform template
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
}

export interface NotificationChannel {
  id: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  name: string;
  enabled: boolean;
  config: {
    email?: {
      provider: 'smtp' | 'sendgrid' | 'aws-ses';
      from: string;
      replyTo?: string;
    };
    sms?: {
      provider: 'twilio' | 'aws-sns';
      fromNumber: string;
    };
    push?: {
      provider: 'onesignal';
      appId: string;
    };
    webhook?: {
      url: string;
      headers?: Record<string, string>;
      retryAttempts: number;
    };
  };
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: {
    event: string; // e.g., 'reservation.created', 'payment.received', 'guest.checkin'
    conditions?: Record<string, any>; // conditional logic
  };
  actions: {
    channel: string; // notification channel ID
    templateId: string; // email template ID
    delayMinutes?: number;
    recipients: ('guest' | 'staff' | 'custom')[];
    customEmails?: string[];
  }[];
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommunicationLog {
  id: string;
  type: 'email' | 'sms' | 'push' | 'webhook';
  templateId?: string;
  recipient: string;
  subject?: string;
  status: 'sent' | 'failed' | 'pending' | 'read';
  errorMessage?: string;
  sentAt?: string;
  readAt?: string;
  tenantId?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

// Mock storage
const templatesStorage = new Map<string, EmailTemplate>();
const channelsStorage = new Map<string, NotificationChannel>();
const rulesStorage = new Map<string, NotificationRule>();
const logsStorage: CommunicationLog[] = [];

// Initialize mock data
const initializeMockData = () => {
  if (templatesStorage.size === 0) {
    const now = Date.now();
    const mockTemplates: EmailTemplate[] = [
      {
        id: 'tpl-001',
        name: 'Reservation Confirmation',
        category: 'reservation',
        subject: 'Your Booking Confirmation - {{bookingId}}',
        htmlContent: `
<h1>Welcome to our Hotel!</h1>
<p>Dear {{guestName}},</p>
<p>Your reservation has been confirmed:</p>
<ul>
  <li>Booking ID: {{bookingId}}</li>
  <li>Check-in: {{checkInDate}}</li>
  <li>Check-out: {{checkOutDate}}</li>
  <li>Room Type: {{roomType}}</li>
  <li>Total Amount: {{totalAmount}}</li>
</ul>
<p>Thank you for choosing us!</p>
        `,
        variables: ['guestName', 'bookingId', 'checkInDate', 'checkOutDate', 'roomType', 'totalAmount'],
        defaultTemplate: true,
        enabled: true,
        createdAt: new Date(now - 2592000000).toISOString(),
        updatedAt: new Date(now - 2592000000).toISOString(),
        usageCount: 1250,
      },
      {
        id: 'tpl-002',
        name: 'Check-in Reminder',
        category: 'check-in',
        subject: 'Reminder: Check-in Today at {{hotelName}}',
        htmlContent: `
<h1>Check-in Reminder</h1>
<p>Hi {{guestName}},</p>
<p>We're excited to welcome you today! Check-in at {{checkInTime}}</p>
<p>Room: {{roomNumber}}</p>
        `,
        variables: ['guestName', 'hotelName', 'checkInTime', 'roomNumber'],
        defaultTemplate: true,
        enabled: true,
        createdAt: new Date(now - 2592000000).toISOString(),
        updatedAt: new Date(now - 2592000000).toISOString(),
        usageCount: 856,
      },
      {
        id: 'tpl-003',
        tenantId: 'tenant-1',
        name: 'Post-Stay Feedback',
        category: 'notification',
        subject: 'How was your stay at {{hotelName}}?',
        htmlContent: `
<h1>Your Feedback Matters!</h1>
<p>Dear {{guestName}},</p>
<p>Thank you for staying with us. Please share your experience: {{surveyLink}}</p>
        `,
        variables: ['guestName', 'hotelName', 'surveyLink'],
        defaultTemplate: false,
        enabled: true,
        createdAt: new Date(now - 1296000000).toISOString(),
        updatedAt: new Date(now - 604800000).toISOString(),
        usageCount: 432,
      },
    ];

    mockTemplates.forEach(tpl => {
      templatesStorage.set(tpl.id, tpl);
    });

    const mockChannels: NotificationChannel[] = [
      {
        id: 'ch-001',
        type: 'email',
        name: 'Production SMTP',
        enabled: true,
        config: {
          email: {
            provider: 'sendgrid',
            from: 'noreply@hotel.com',
            replyTo: 'support@hotel.com',
          },
        },
        createdAt: new Date(now - 2592000000).toISOString(),
        updatedAt: new Date(now - 2592000000).toISOString(),
      },
      {
        id: 'ch-002',
        tenantId: 'tenant-1',
        type: 'sms',
        name: 'Twilio SMS',
        enabled: true,
        config: {
          sms: {
            provider: 'twilio',
            fromNumber: '+1234567890',
          },
        },
        createdAt: new Date(now - 1296000000).toISOString(),
        updatedAt: new Date(now - 1296000000).toISOString(),
      },
    ];

    mockChannels.forEach(ch => {
      channelsStorage.set(ch.id, ch);
    });

    const mockRules: NotificationRule[] = [
      {
        id: 'rule-001',
        name: 'Send confirmation on booking',
        enabled: true,
        trigger: {
          event: 'reservation.created',
        },
        actions: [
          {
            channel: 'ch-001',
            templateId: 'tpl-001',
            recipients: ['guest'],
          },
        ],
        createdAt: new Date(now - 2592000000).toISOString(),
        updatedAt: new Date(now - 2592000000).toISOString(),
      },
      {
        id: 'rule-002',
        name: 'Send check-in reminder 24h before',
        enabled: true,
        trigger: {
          event: 'reservation.approaching',
          conditions: { hoursUntilCheckIn: 24 },
        },
        actions: [
          {
            channel: 'ch-001',
            templateId: 'tpl-002',
            delayMinutes: 0,
            recipients: ['guest'],
          },
        ],
        createdAt: new Date(now - 2592000000).toISOString(),
        updatedAt: new Date(now - 2592000000).toISOString(),
      },
    ];

    mockRules.forEach(rule => {
      rulesStorage.set(rule.id, rule);
    });

    const mockLogs: CommunicationLog[] = [
      {
        id: 'log-001',
        type: 'email',
        templateId: 'tpl-001',
        recipient: 'guest@example.com',
        subject: 'Your Booking Confirmation - BK123456',
        status: 'sent',
        sentAt: new Date(now - 86400000).toISOString(),
        createdAt: new Date(now - 86400000).toISOString(),
      },
      {
        id: 'log-002',
        type: 'email',
        templateId: 'tpl-002',
        recipient: 'guest@example.com',
        subject: 'Reminder: Check-in Today',
        status: 'read',
        sentAt: new Date(now - 3600000).toISOString(),
        readAt: new Date(now - 1800000).toISOString(),
        createdAt: new Date(now - 3600000).toISOString(),
      },
      {
        id: 'log-003',
        type: 'sms',
        recipient: '+15551234567',
        status: 'failed',
        errorMessage: 'Invalid phone number',
        createdAt: new Date(now - 7200000).toISOString(),
      },
    ];

    logsStorage.push(...mockLogs);
  }
};

export async function getEmailTemplates(tenantId?: string, limit: number = 50, offset: number = 0): Promise<EmailTemplate[]> {
  initializeMockData();
  
  let templates = Array.from(templatesStorage.values());

  if (tenantId !== undefined) {
    templates = templates.filter(t => t.tenantId === tenantId);
  }

  templates.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return templates.slice(offset, offset + limit);
}

export async function getEmailTemplate(templateId: string): Promise<EmailTemplate | null> {
  initializeMockData();
  return templatesStorage.get(templateId) || null;
}

export async function createEmailTemplate(data: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>): Promise<EmailTemplate> {
  initializeMockData();
  
  const id = `tpl-${Date.now()}`;
  const template: EmailTemplate = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  templatesStorage.set(id, template);

  await createAuditLog({
    action: 'CREATE_EMAIL_TEMPLATE',
    entityType: 'EmailTemplate',
    resourceId: id,
    changes: template,
    status: 'success'
  });

  return template;
}

export async function updateEmailTemplate(templateId: string, updates: Partial<Omit<EmailTemplate, 'id' | 'createdAt'>>): Promise<EmailTemplate | null> {
  initializeMockData();
  
  const template = templatesStorage.get(templateId);
  if (!template) return null;

  const updated = {
    ...template,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  templatesStorage.set(templateId, updated);

  await createAuditLog({
    action: 'UPDATE_EMAIL_TEMPLATE',
    entityType: 'EmailTemplate',
    resourceId: templateId,
    changes: updates,
    status: 'success'
  });

  return updated;
}

export async function deleteEmailTemplate(templateId: string): Promise<boolean> {
  initializeMockData();
  
  if (!templatesStorage.has(templateId)) return false;

  templatesStorage.delete(templateId);

  await createAuditLog({
    action: 'DELETE_EMAIL_TEMPLATE',
    entityType: 'EmailTemplate',
    resourceId: templateId,
    changes: { deleted: true },
    status: 'success'
  });

  return true;
}

export async function getNotificationChannels(tenantId?: string): Promise<NotificationChannel[]> {
  initializeMockData();
  
  let channels = Array.from(channelsStorage.values());

  if (tenantId !== undefined) {
    channels = channels.filter(c => c.tenantId === tenantId);
  }

  return channels;
}

export async function createNotificationChannel(data: Omit<NotificationChannel, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationChannel> {
  initializeMockData();
  
  const id = `ch-${Date.now()}`;
  const channel: NotificationChannel = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  channelsStorage.set(id, channel);

  await createAuditLog({
    action: 'CREATE_NOTIFICATION_CHANNEL',
    entityType: 'NotificationChannel',
    resourceId: id,
    changes: channel,
    status: 'success'
  });

  return channel;
}

export async function getNotificationRules(tenantId?: string): Promise<NotificationRule[]> {
  initializeMockData();
  
  let rules = Array.from(rulesStorage.values());

  if (tenantId !== undefined) {
    rules = rules.filter(r => r.tenantId === tenantId);
  }

  return rules;
}

export async function createNotificationRule(data: Omit<NotificationRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<NotificationRule> {
  initializeMockData();
  
  const id = `rule-${Date.now()}`;
  const rule: NotificationRule = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  rulesStorage.set(id, rule);

  await createAuditLog({
    action: 'CREATE_NOTIFICATION_RULE',
    entityType: 'NotificationRule',
    resourceId: id,
    changes: rule,
    status: 'success'
  });

  return rule;
}

export async function updateNotificationRule(ruleId: string, updates: Partial<Omit<NotificationRule, 'id' | 'createdAt'>>): Promise<NotificationRule | null> {
  initializeMockData();
  
  const rule = rulesStorage.get(ruleId);
  if (!rule) return null;

  const updated = {
    ...rule,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  rulesStorage.set(ruleId, updated);

  await createAuditLog({
    action: 'UPDATE_NOTIFICATION_RULE',
    entityType: 'NotificationRule',
    resourceId: ruleId,
    changes: updates,
    status: 'success'
  });

  return updated;
}

export async function getCommunicationLogs(tenantId?: string, limit: number = 100, offset: number = 0): Promise<CommunicationLog[]> {
  initializeMockData();
  
  let logs = logsStorage;

  if (tenantId !== undefined) {
    logs = logs.filter(l => l.tenantId === tenantId);
  }

  logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return logs.slice(offset, offset + limit);
}

export async function getCommunicationStats(tenantId?: string) {
  initializeMockData();
  
  let logs = logsStorage;

  if (tenantId !== undefined) {
    logs = logs.filter(l => l.tenantId === tenantId);
  }

  const templates = await getEmailTemplates(tenantId);
  const channels = await getNotificationChannels(tenantId);
  const rules = await getNotificationRules(tenantId);

  return {
    totalCommunications: logs.length,
    sentCount: logs.filter(l => l.status === 'sent').length,
    failedCount: logs.filter(l => l.status === 'failed').length,
    openedCount: logs.filter(l => l.status === 'read').length,
    pendingCount: logs.filter(l => l.status === 'pending').length,
    totalTemplates: templates.length,
    totalChannels: channels.length,
    enabledChannels: channels.filter(c => c.enabled).length,
    totalRules: rules.length,
    enabledRules: rules.filter(r => r.enabled).length,
    successRate: logs.length > 0 ? (logs.filter(l => l.status === 'sent').length / logs.length * 100).toFixed(2) + '%' : '0%',
  };
}
