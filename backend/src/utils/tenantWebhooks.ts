import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { prisma } from './prisma';

export const TENANT_WEBHOOK_EVENT_TYPES = [
  'reservation.confirmed',
  'payment.completed',
  'alert.created',
  '*',
] as const;

export type TenantWebhookEventType = (typeof TENANT_WEBHOOK_EVENT_TYPES)[number];

const matchesEvent = (events: string[] | undefined, event: TenantWebhookEventType) => {
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
  const webhooks = await prisma.webhook.findMany({
    where: { tenantId, isActive: true },
  });

  const matching = webhooks.filter((wh) => matchesEvent(wh.events, eventType));
  if (matching.length === 0) return;

  const body = JSON.stringify({
    event: eventType,
    tenantId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  await Promise.allSettled(
    matching.map(async (webhook) => {
      const headers: Record<string, string> = {};
      if (webhook.secret) {
        headers['X-InnSight-Signature'] = crypto
          .createHmac('sha256', webhook.secret)
          .update(body)
          .digest('hex');
      }

      let status: string;
      try {
        await sendWebhookRequest(webhook.url, body, headers);
        status = 'success';
      } catch (error: any) {
        status = `failed: ${(error?.message || 'unknown error').slice(0, 200)}`;
        console.error(`Webhook delivery failed for ${webhook.id} (${webhook.url}):`, error?.message);
      }

      await prisma.webhook
        .update({
          where: { id: webhook.id },
          data: { lastTriggeredAt: new Date(), lastStatus: status },
        })
        .catch(() => {});
    })
  );
};
