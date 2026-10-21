import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { PUBLIC_PORTAL_BASE_URL } from '../lib/publicApi';
import {
  Link as LinkIcon,
  Code2,
  Globe,
  ShieldCheck,
  Play,
  Trash2,
  Copy,
  Pause,
  Webhook,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  PageHeader,
  Panel,
  Skeleton,
  StatusBadge,
  TextInput,
} from '../components/ui';
import styles from './IntegrationPage.module.css';

const PORTAL_ORIGIN =
  (import.meta as any).env?.VITE_PUBLIC_PORTAL_ORIGIN || 'http://67.211.210.8:3061';
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
  const [deleteTarget, setDeleteTarget] = useState<TenantWebhook | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
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
    setCreatingWebhook(true);
    try {
      await api.post(`/tenants/${tenantId}/webhooks`, {
        url: webhookForm.url,
        description: webhookForm.description || undefined,
        eventTypes: webhookForm.eventTypes,
      });
      toast.success('Webhook endpoint added');
      setWebhookForm({ url: '', description: '', eventTypes: ['reservation.confirmed'] });
      setShowCreate(false);
      fetchWebhooks();
    } catch {
      toast.error('Unable to create webhook');
    } finally {
      setCreatingWebhook(false);
    }
  };

  const handleDeleteWebhook = async () => {
    if (!tenantId || !deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/tenants/${tenantId}/webhooks/${deleteTarget.id}`);
      toast.success('Webhook removed');
      setDeleteTarget(null);
      fetchWebhooks();
    } catch {
      toast.error('Unable to delete webhook');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleWebhook = async (hook: TenantWebhook) => {
    if (!tenantId) return;
    setUpdatingWebhookId(hook.id);
    try {
      await api.patch(`/tenants/${tenantId}/webhooks/${hook.id}`, { active: !hook.active });
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

  const handleEventToggle = (value: string) => {
    setWebhookForm((prev) => {
      const alreadySelected = prev.eventTypes.includes(value);
      const next = alreadySelected
        ? prev.eventTypes.filter((v) => v !== value)
        : [...prev.eventTypes, value];
      return { ...prev, eventTypes: next.length ? next : prev.eventTypes };
    });
  };

  return (
    <Layout>
      <PageHeader
        title="Integrations"
        subtitle="Hosted portal, booking widget, and webhooks — scoped to your property"
      />

      <div className="stack">
        <div className={styles.cardGrid}>
          <Panel>
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div className="row" style={{ fontWeight: 600 }}>
                <LinkIcon size={18} />
                Hosted portal link
              </div>
              <p className="text-sm muted" style={{ margin: 0 }}>
                Drop this tenant-specific URL on a "Book Now" button or marketing email.
              </p>
              <input type="text" readOnly value={hostedPortalUrl} className={styles.codeBox} />
              <Button
                variant="primary"
                icon={<Copy size={14} />}
                onClick={() => copyToClipboard(hostedPortalUrl, 'Portal link copied')}
              >
                Copy hosted link
              </Button>
            </div>
          </Panel>

          <Panel>
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div className="row" style={{ fontWeight: 600 }}>
                <Code2 size={18} />
                Embeddable widget
              </div>
              <p className="text-sm muted" style={{ margin: 0 }}>
                Paste the snippet into any site — it applies your branding and opens a modal checkout.
              </p>
              <textarea readOnly value={widgetSnippet} rows={4} className={styles.codeBox} />
              <Button
                variant="secondary"
                icon={<Copy size={14} />}
                onClick={() => copyToClipboard(widgetSnippet, 'Widget snippet copied')}
              >
                Copy embed snippet
              </Button>
            </div>
          </Panel>

          <Panel>
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div className="row" style={{ fontWeight: 600 }}>
                <ShieldCheck size={18} />
                Integration guide
              </div>
              <p className="text-sm muted" style={{ margin: 0 }}>
                Covers widget embedding, public APIs, webhook payloads, and signature verification.
              </p>
              <a href={integrationGuideUrl} target="_blank" rel="noreferrer" download>
                <Button variant="secondary" block>
                  Download guide
                </Button>
              </a>
            </div>
          </Panel>
        </div>

        <Panel title="Public API endpoints" subtitle="Use these directly for a custom front end">
          <div className="stack" style={{ gap: 'var(--space-3)' }}>
            {portalApiDocs.map((doc) => (
              <div key={doc.title} className={styles.apiDoc}>
                <div className={styles.apiDocHead}>
                  <span className={styles.apiDocTitle}>{doc.title}</span>
                  <span className={`${styles.method} ${doc.method === 'POST' ? styles.methodPost : styles.methodGet}`}>
                    {doc.method}
                  </span>
                </div>
                <code className={styles.apiDocPath}>{doc.path}</code>
                <p className="text-sm muted" style={{ margin: 0 }}>{doc.note}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel
          title="Webhook notifications"
          subtitle="Receive real-time reservation and payment events. Verify deliveries with the shared secret (HMAC-SHA256 against the x-innsight-signature header)."
          actions={
            <Button
              variant="primary"
              size="sm"
              icon={<Webhook size={14} />}
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? 'Cancel' : 'Add endpoint'}
            </Button>
          }
        >
          <div className="stack">
            {showCreate && (
              <div className={styles.webhookCard} style={{ background: 'var(--cloud)' }}>
                <div className="grid2">
                  <Field label="Endpoint URL" required>
                    <TextInput
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm({ ...webhookForm, url: e.target.value })}
                      placeholder="https://example.com/webhooks/innsight"
                    />
                  </Field>
                  <Field label="Description">
                    <TextInput
                      value={webhookForm.description}
                      onChange={(e) => setWebhookForm({ ...webhookForm, description: e.target.value })}
                      placeholder="Optional"
                    />
                  </Field>
                </div>
                <Field label="Events">
                  <div className="row">
                    {EVENT_OPTIONS.map((opt) => (
                      <label key={opt.value} className="row text-sm" style={{ cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={webhookForm.eventTypes.includes(opt.value)}
                          onChange={() => handleEventToggle(opt.value)}
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </Field>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Button variant="primary" loading={creatingWebhook} onClick={handleCreateWebhook}>
                    Create endpoint
                  </Button>
                </div>
              </div>
            )}

            {webhookLoading ? (
              <Skeleton height="120px" />
            ) : webhooks.length === 0 ? (
              <EmptyState
                icon={<Globe size={28} strokeWidth={1.6} />}
                title="No webhooks yet"
                description="Add your first endpoint to receive reservation confirmations or payment completions."
              />
            ) : (
              webhooks.map((hook) => (
                <div key={hook.id} className={styles.webhookCard}>
                  <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <div>
                      <p className={styles.webhookUrl}>{hook.url}</p>
                      {hook.description && <p className="text-sm muted" style={{ margin: 0 }}>{hook.description}</p>}
                    </div>
                    <StatusBadge tone={hook.active ? 'success' : 'neutral'} dot={false}>
                      {hook.active ? 'Active' : 'Paused'}
                    </StatusBadge>
                  </div>

                  <div className="row">
                    {hook.eventTypes.map((evt) => (
                      <StatusBadge key={evt} tone="info" dot={false}>
                        {evt === 'reservation.confirmed' ? 'Reservation confirmed' : 'Payment completed'}
                      </StatusBadge>
                    ))}
                  </div>

                  <div className={styles.metaGrid}>
                    <div>
                      <p className={styles.metaLabel}>Last delivery</p>
                      <p className={styles.metaValue}>{formatDate(hook.lastTriggeredAt)}</p>
                    </div>
                    <div>
                      <p className={styles.metaLabel}>Last status</p>
                      <p className={styles.metaValue} style={{ color: hook.lastStatus === 'failed' ? 'var(--danger)' : undefined }}>
                        {hook.lastStatus ?? '—'}
                      </p>
                    </div>
                  </div>

                  {hook.lastError && <p className="text-sm" style={{ margin: 0, color: 'var(--danger)' }}>{hook.lastError}</p>}

                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Copy size={14} />}
                      disabled={!hook.secret}
                      onClick={() => hook.secret && copyToClipboard(hook.secret, 'Secret copied')}
                    >
                      Copy secret
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Play size={14} />}
                      loading={testingWebhookId === hook.id}
                      onClick={() => handleSendTest(hook)}
                    >
                      Send test
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Pause size={14} />}
                      loading={updatingWebhookId === hook.id}
                      onClick={() => handleToggleWebhook(hook)}
                    >
                      {hook.active ? 'Pause' : 'Resume'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 size={14} />}
                      onClick={() => setDeleteTarget(hook)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteWebhook}
        title="Delete webhook"
        confirmLabel="Delete webhook"
        loading={deleting}
        destructive
      >
        Delete the endpoint <strong>{deleteTarget?.url}</strong>? Events will stop being delivered immediately.
      </ConfirmDialog>
    </Layout>
  );
}
