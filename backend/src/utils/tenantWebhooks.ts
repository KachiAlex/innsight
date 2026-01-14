import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { db, now } from './firestore';

export const TENANT_WEBHOOK_COLLECTION = 'tenant_webhooks';
export const TENANT_WEBHOOK_EVENT_TYPES = ['reservation.confirmed', 'payment.completed', '*'] as const;

export type TenantWebhookEventType = (typeof TENANT_WEBHOOK_EVENT_TYPES)[number];

type TenantWebhookDoc = {
  tenantId: string;
  url: string;
  description?: string | null;
  eventTypes?: TenantWebhookEventType[];
  secret: string;
  active?: boolean;
};

const matchesEvent = (events: TenantWebhookEventType[] | undefined, event: TenantWebhookEventType) => {
  if (!events || events.length === 0) return event === 'reservation.confirmed';
  return events.includes('*') || events.includes(event);
};

const sendWebhookRequest = (urlString: string, body: string, headers: Record<string, string>) =>
  new Promise<void>((resolve, reject) => {
    try {
      const url = new URL(urlString);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      const options: https.RequestOptions = {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
      };

      const request = client.request(options, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            const responseBody = Buffer.concat(chunks).toString('utf8');
            reject(
              new Error(
                `Webhook responded with ${response.statusCode ?? 0}: ${
                  responseBody?.slice(0, 200) || 'no body'
                }`
              )
            );
          }
        });
      });

      request.on('error', reject);
      request.setTimeout(5000, () => {
        request.destroy(new Error('Webhook request timed out'));
      });
      request.write(body);
      request.end();
    } catch (error) {
      reject(error);
    }
  });

export const triggerTenantWebhookEvent = async ({
  tenantId,
  eventType,
  payload,
}: {
  tenantId: string;
  eventType: TenantWebhookEventType;
  payload: Record<string, any>;
}) => {
  const snapshot = await db
    .collection(TENANT_WEBHOOK_COLLECTION)
    .where('tenantId', '==', tenantId)
    .where('active', '==', true)
    .get();

  if (snapshot.empty) {
    return;
  }

  const bodyBase = {
    tenantId,
    eventType,
    sentAt: new Date().toISOString(),
    data: payload,
  };
  const bodyString = JSON.stringify(bodyBase);

  const deliveries = snapshot.docs.map(async (doc) => {
    const data = doc.data() as TenantWebhookDoc;
    if (!matchesEvent(data.eventTypes, eventType)) {
      return;
    }
    const secret = data.secret;
    const signature = crypto.createHmac('sha256', secret).update(bodyString).digest('hex');
    try {
      await sendWebhookRequest(data.url, bodyString, {
        'x-innsight-signature': signature,
      });
      await doc.ref.update({
        lastTriggeredAt: now(),
        lastStatus: 'ok',
        lastEventType: eventType,
        lastError: null,
      });
    } catch (error: any) {
      await doc.ref.update({
        lastTriggeredAt: now(),
        lastStatus: 'failed',
        lastEventType: eventType,
        lastError: error?.message?.slice(0, 500) ?? 'unknown_error',
      });
    }
  });

  await Promise.allSettled(deliveries);
};
