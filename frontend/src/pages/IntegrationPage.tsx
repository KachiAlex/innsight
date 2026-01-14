import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { PUBLIC_PORTAL_BASE_URL } from '../lib/publicApi';
import {
  Link as LinkIcon,
  Code2,
  Globe,
  Activity,
  ShieldCheck,
  Play,
  Trash2,
  Copy,
} from 'lucide-react';
import toast from 'react-hot-toast';

const PORTAL_ORIGIN =
  (import.meta as any).env?.VITE_PUBLIC_PORTAL_ORIGIN || 'https://innsight-2025.web.app';
const WIDGET_SCRIPT_URL =
  (import.meta as any).env?.VITE_PUBLIC_WIDGET_URL || `${PORTAL_ORIGIN}/widget.js`;

const buildHostedPortalUrl = (slug?: string | null) =>
  slug ? `${PORTAL_ORIGIN.replace(/\/$/, '')}/${slug}` : PORTAL_ORIGIN;

type TenantWebhook = {
  id: string;
  url: string;
  description?: string | null;
  eventTypes: string[];
  secret: string | null;
  active: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastTriggeredAt?: string | null;
  lastStatus?: string | null;
  lastEventType?: string | null;
  lastError?: string | null;
};

const EVENT_OPTIONS = [
  { value: 'reservation.confirmed', label: 'Reservation confirmed' },
  { value: 'payment.completed', label: 'Payment completed' },
];

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function IntegrationPage() {
  const { user } = useAuthStore();
  const tenantSlug = user?.tenant?.slug;
  const tenantId = user?.tenantId;
  const hostedPortalUrl = buildHostedPortalUrl(tenantSlug);
  const widgetTargetId = `innsight-portal-${tenantSlug || 'widget'}`;
  const widgetSnippet = `<div id="${widgetTargetId}"></div>
<script async src="${WIDGET_SCRIPT_URL}" data-tenant="${tenantSlug || ''}" data-target="${widgetTargetId}"></script>`;
  const integrationGuideUrl = '/innsight-portal-integration-guide.md';

  const [webhooks, setWebhooks] = useState<TenantWebhook[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [creatingWebhook, setCreatingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);
  const [updatingWebhookId, setUpdatingWebhookId] = useState<string | null>(null);
  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    url: '',
    description: '',
    eventTypes: ['reservation.confirmed'],
  });

  const copyToClipboard = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(successMessage);
    } catch {
      toast.error('Unable to copy to clipboard');
    }
  };

  const fetchWebhooks = useCallback(async () => {
    if (!tenantId) return;
    setWebhookLoading(true);
    try {
      const response = await api.get(`/tenants/${tenantId}/webhooks`);
      setWebhooks(response.data.data || []);
    } catch {
      toast.error('Unable to load webhooks');
    } finally {
      setWebhookLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreateWebhook = async () => {
    if (!tenantId) return;
    if (!webhookForm.url) {
      toast.error('Webhook URL is required');
      return;
    }
    if (!webhookForm.eventTypes.length) {
      toast.error('Select at least one event type');
      return;
    }
    setCreatingWebhook(true);
    try {
      await api.post(`/tenants/${tenantId}/webhooks`, {
        url: webhookForm.url,
        description: webhookForm.description || undefined,
        eventTypes: webhookForm.eventTypes,
      });
      toast.success('Webhook endpoint added');
      setWebhookForm({
        url: '',
        description: '',
        eventTypes: ['reservation.confirmed'],
      });
      fetchWebhooks();
    } catch {
      toast.error('Unable to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    if (!tenantId) return;
    setDeletingWebhookId(id);
    try {
      await api.delete(`/tenants/${tenantId}/webhooks/${id}`);
      toast.success('Webhook removed');
      fetchWebhooks();
    } catch {
      toast.error('Unable to delete webhook');
    } finally {
      setDeletingWebhookId(null);
    }
  };

  const handleToggleWebhook = async (hook: TenantWebhook) => {
    if (!tenantId) return;
    setUpdatingWebhookId(hook.id);
    try {
      await api.patch(`/tenants/${tenantId}/webhooks/${hook.id}`, {
        active: !hook.active,
      });
      toast.success(hook.active ? 'Webhook paused' : 'Webhook resumed');
      fetchWebhooks();
    } catch {
      toast.error('Unable to update webhook');
    } finally {
      setUpdatingWebhookId(null);
    }
  };

  const handleSendTest = async (hook: TenantWebhook) => {
    if (!tenantId) return;
    setTestingWebhookId(hook.id);
    try {
      await api.post(`/tenants/${tenantId}/webhooks/${hook.id}/test`, {
        eventType: hook.eventTypes[0] || 'reservation.confirmed',
      });
      toast.success('Test event dispatched');
    } catch {
      toast.error('Unable to send test event');
    } finally {
      setTestingWebhookId(null);
    }
  };

  const portalApiDocs = [
    {
      title: 'List available rooms',
      method: 'GET',
      path: `${PUBLIC_PORTAL_BASE_URL}/${tenantSlug ?? '<tenantSlug>'}/availability`,
      note: 'Requires check-in/check-out query params; respects tenant inventory and rate plans.',
    },
    {
      title: 'Create checkout intent',
      method: 'POST',
      path: `${PUBLIC_PORTAL_BASE_URL}/${tenantSlug ?? '<tenantSlug>'}/checkout/intent`,
      note: 'Begins payment flow and issues session token for guest widget.',
    },
    {
      title: 'Confirm reservation',
      method: 'POST',
      path: `${PUBLIC_PORTAL_BASE_URL}/${tenantSlug ?? '<tenantSlug>'}/checkout/confirm`,
      note: 'Verifies payment, auto-provisions guest accounts, and emits webhook events.',
    },
  ];

  const eventSelection = webhookForm.eventTypes;
  const handleEventToggle = (value: string) => {
    setWebhookForm((prev) => {
      const alreadySelected = prev.eventTypes.includes(value);
      const next = alreadySelected
        ? prev.eventTypes.filter((v) => v !== value)
        : [...prev.eventTypes, value];
      return {
        ...prev,
        eventTypes: next.length ? next : prev.eventTypes,
      };
    });
  };

  const webhookEmptyState = !webhookLoading && !webhooks.length;

  const webhookInstructions = useMemo(
    () =>
      `Verify deliveries by hashing the raw JSON body with the shared secret using HMAC-SHA256 and comparing against the x-innsight-signature header. Rotate secrets by deleting/re-adding endpoints.`,
    []
  );

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.5rem', color: '#0f172a' }}>Integrations</h1>
          <p style={{ color: '#475569', maxWidth: 640, lineHeight: 1.6 }}>
            Share the hosted guest portal, embed the booking widget, and subscribe to reservation webhooks—all scoped to your tenant account so the data stays isolated from other properties.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <LinkIcon size={20} color="#3b82f6" />
              Hosted Portal Link
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Drop this tenant-specific URL on a “Book Now” button or marketing email.
            </p>
            <input
              type="text"
              readOnly
              value={hostedPortalUrl}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5f5',
                borderRadius: '8px',
                fontSize: '0.95rem',
                color: '#0f172a',
              }}
            />
            <button
              onClick={() => copyToClipboard(hostedPortalUrl, 'Portal link copied')}
              style={{
                marginTop: '0.25rem',
                padding: '0.65rem',
                borderRadius: '8px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copy hosted link
            </button>
          </div>

          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <Code2 size={20} color="#0f172a" />
              Embeddable Widget
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Paste the snippet into any site. It auto-applies your branding via tenant settings and opens a modal checkout.
            </p>
            <textarea
              readOnly
              value={widgetSnippet}
              rows={5}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #cbd5f5',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                background: '#f8fafc',
                color: '#0f172a',
              }}
            />
            <button
              onClick={() => copyToClipboard(widgetSnippet, 'Widget snippet copied')}
              style={{
                padding: '0.65rem',
                borderRadius: '8px',
                border: 'none',
                background: '#0f172a',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Copy embed snippet
            </button>
          </div>

          <div
            style={{
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
              <ShieldCheck size={20} color="#3b82f6" />
              Integration Guide (PDF)
            </div>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              Hand this document to your agency or internal dev team. It covers widget embedding, public APIs, webhook payloads, and signature verification.
            </p>
            <a
              href={integrationGuideUrl}
              target="_blank"
              rel="noreferrer"
              download
              style={{
                marginTop: '0.5rem',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.35rem',
                padding: '0.7rem 1rem',
                borderRadius: '10px',
                fontWeight: 600,
                background: '#0f172a',
                color: '#fff',
                textDecoration: 'none',
              }}
            >
              Download guide
            </a>
          </div>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <Globe size={20} color="#3b82f6" />
            Public API endpoints
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
            The portal + widget talk to these routes. Use them directly if you have a custom front end.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {portalApiDocs.map((doc) => (
              <div
                key={doc.title}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1rem',
                  background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{doc.title}</span>
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: doc.method === 'POST' ? '#0f172a' : '#15803d',
                    }}
                  >
                    {doc.method}
                  </span>
                </div>
                <code
                  style={{
                    display: 'block',
                    wordBreak: 'break-all',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    marginBottom: '0.5rem',
                  }}
                >
                  {doc.path}
                </code>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>{doc.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={20} color="#0f172a" />
            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem' }}>Webhook notifications</h2>
          </div>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.6 }}>
            Create HTTPS endpoints to receive real-time reservation + payment events. Every delivery includes a shared secret so you can verify the signature.
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1.5rem',
            }}
          >
            <div style={{ flex: '2 1 420px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {webhookEmptyState && (
                <div
                  style={{
                    padding: '1.5rem',
                    border: '1px dashed #cbd5f5',
                    borderRadius: '12px',
                    background: '#f8fafc',
                    color: '#475569',
                  }}
                >
                  No webhooks yet. Add your first endpoint to receive reservation confirmations or payment completions.
                </div>
              )}
              {webhookLoading && (
                <div style={{ padding: '1rem', color: '#475569' }}>Loading webhooks…</div>
              )}
              {webhooks.map((hook) => (
                <div
                  key={hook.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: '#0f172a', wordBreak: 'break-all' }}>{hook.url}</p>
                      {hook.description ? (
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>{hook.description}</p>
                      ) : null}
                    </div>
                    <span
                      style={{
                        alignSelf: 'flex-start',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '999px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: hook.active ? 'rgba(34,197,94,0.15)' : 'rgba(148,163,184,0.2)',
                        color: hook.active ? '#15803d' : '#475569',
                      }}
                    >
                      {hook.active ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {hook.eventTypes.map((evt) => (
                      <span
                        key={evt}
                        style={{
                          padding: '0.25rem 0.6rem',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          background: 'rgba(191,219,254,0.5)',
                          color: '#1d4ed8',
                        }}
                      >
                        {evt === 'reservation.confirmed' ? 'Reservation confirmed' : 'Payment completed'}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>Last delivery</p>
                      <p style={{ margin: 0, color: '#0f172a' }}>{formatDate(hook.lastTriggeredAt)}</p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: '#94a3b8' }}>Last status</p>
                      <p style={{ margin: 0, color: hook.lastStatus === 'failed' ? '#b91c1c' : '#0f172a' }}>
                        {hook.lastStatus ? hook.lastStatus : '—'}
                      </p>
                    </div>
                  </div>
                  {hook.lastError && (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#b91c1c' }}>{hook.lastError}</p>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <button
                      onClick={() => hook.secret && copyToClipboard(hook.secret, 'Secret copied')}
                      disabled={!hook.secret}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        border: '1px solid #cbd5f5',
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        background: '#fff',
                        cursor: hook.secret ? 'pointer' : 'not-allowed',
                        color: '#0f172a',
                      }}
                    >
                      <Copy size={15} />
                      Secret
                    </button>
                    <button
                      onClick={() => handleSendTest(hook)}
                      disabled={testingWebhookId === hook.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        border: 'none',
                        background: '#0f172a',
                        color: '#fff',
                        cursor: 'pointer',
                        opacity: testingWebhookId === hook.id ? 0.6 : 1,
                      }}
                    >
                      <Play size={15} />
                      {testingWebhookId === hook.id ? 'Sending…' : 'Send test'}
                    </button>
                    <button
                      onClick={() => handleToggleWebhook(hook)}
                      disabled={updatingWebhookId === hook.id}
                      style={{
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        cursor: 'pointer',
                        opacity: updatingWebhookId === hook.id ? 0.6 : 1,
                      }}
                    >
                      {hook.active ? 'Pause' : 'Resume'}
                    </button>
                    <button
                      onClick={() => handleDeleteWebhook(hook.id)}
                      disabled={deletingWebhookId === hook.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        borderRadius: '8px',
                        padding: '0.45rem 0.85rem',
                        border: '1px solid rgba(248,113,113,0.6)',
                        background: '#fff5f5',
                        color: '#b91c1c',
                        cursor: 'pointer',
                        opacity: deletingWebhookId === hook.id ? 0.6 : 1,
                      }}
                    >
                      <Trash2 size={15} />
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                flex: '1 1 320px',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color="#3b82f6" />
                <strong style={{ color: '#0f172a' }}>Add endpoint</strong>
              </div>
              <label style={{ color: '#475569', fontSize: '0.9rem' }}>POST URL</label>
              <input
                type="url"
                placeholder="https://example.com/webhooks/innsight"
                value={webhookForm.url}
                onChange={(e) => setWebhookForm((prev) => ({ ...prev, url: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              />
              <label style={{ color: '#475569', fontSize: '0.9rem' }}>Description (optional)</label>
              <input
                type="text"
                placeholder="e.g. CRM reservation sync"
                value={webhookForm.description}
                onChange={(e) => setWebhookForm((prev) => ({ ...prev, description: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                }}
              />
              <label style={{ color: '#475569', fontSize: '0.9rem' }}>Events</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {EVENT_OPTIONS.map((option) => (
                  <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: '#0f172a' }}>
                    <input
                      type="checkbox"
                      checked={eventSelection.includes(option.value)}
                      onChange={() => handleEventToggle(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
              <button
                onClick={handleCreateWebhook}
                disabled={!webhookForm.url || creatingWebhook}
                style={{
                  marginTop: '0.5rem',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontWeight: 600,
                  background: '#0f172a',
                  color: '#fff',
                  cursor: webhookForm.url && !creatingWebhook ? 'pointer' : 'not-allowed',
                  opacity: !webhookForm.url || creatingWebhook ? 0.7 : 1,
                }}
              >
                {creatingWebhook ? 'Saving…' : 'Create webhook'}
              </button>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: '#475569',
                  lineHeight: 1.5,
                  background: '#f8fafc',
                  borderRadius: '8px',
                  padding: '0.75rem',
                }}
              >
                {webhookInstructions}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '12px',
            padding: '1.5rem',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem' }}>Implementation checklist</h2>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#475569', lineHeight: 1.65 }}>
            <li>Drop the hosted link or widget snippet onto your site (preferably on a dedicated “Book Now” page).</li>
            <li>Whitelist <code style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{PORTAL_ORIGIN}</code> inside your CMS if external scripts must be approved.</li>
            <li>After checkout, persist the returned <code style={{ fontFamily: 'monospace' }}>customerToken</code> if you plan to call tenant APIs directly.</li>
            <li>Use the form above to add webhook endpoints for reservation + payment activity, then verify deliveries with the shared secret.</li>
            <li>Need deeper automation (custom theming, folio sync, loyalty)? Contact InnSight support with your tenant slug for concierge onboarding.</li>
          </ol>
          <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1rem', border: '1px dashed #cbd5f5' }}>
            <p style={{ marginTop: 0, color: '#0f172a', fontWeight: 600 }}>Signature verification snippet (Node.js)</p>
            <pre
              style={{
                margin: 0,
                background: '#0f172a',
                color: '#e2e8f0',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                overflowX: 'auto',
              }}
            >{`const crypto = require('crypto');

const signature = req.headers['x-innsight-signature'];
const computed = crypto
  .createHmac('sha256', process.env.INNSIGHT_WEBHOOK_SECRET)
  .update(rawBody) // raw JSON string
  .digest('hex');

if (computed !== signature) {
  return res.status(401).send('invalid signature');
}`}</pre>
          </div>
        </div>
      </div>
    </Layout>
  );
}
