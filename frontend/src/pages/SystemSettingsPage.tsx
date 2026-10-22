import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Mail, Shield, Save, RefreshCw, Palette, Gauge } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  ErrorState,
  Field,
  PageHeader,
  Panel,
  Select,
  SkeletonCard,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface SystemSettings {
  emailConfig: {
    provider: 'smtp' | 'sendgrid' | 'aws-ses';
    senderEmail: string;
    senderName: string;
  };
  featureFlags: Record<string, boolean>;
  rateLimit: {
    apiCallsPerMinute: number;
    loginAttemptsPerHour: number;
    requestTimeoutSeconds: number;
  };
  branding: {
    platformName: string;
    primaryColor: string;
    supportEmail: string;
    supportPhone?: string;
  };
}

type Tab = 'email' | 'features' | 'branding' | 'rate-limit';

const TABS: Array<{ id: Tab; label: string; icon: typeof Mail }> = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'features', label: 'Feature flags', icon: Shield },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'rate-limit', label: 'Rate limits', icon: Gauge },
];

export default function SystemSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('email');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/superadmin/settings');
      setSettings(response.data.data);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/superadmin-dashboard', { replace: true });
      return;
    }
    fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const update = <K extends keyof SystemSettings>(key: K, patch: Partial<SystemSettings[K]>) =>
    setSettings((prev) => (prev ? { ...prev, [key]: { ...prev[key], ...patch } } : null));

  const save = async (path: string, payload: unknown, success: string) => {
    try {
      setSaving(true);
      await api.patch(path, payload);
      toast.success(success);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (flagName: string, enabled: boolean) => {
    try {
      setSaving(true);
      await api.patch('/superadmin/settings/feature-flags', { [flagName]: enabled });
      setSettings((prev) =>
        prev ? { ...prev, featureFlags: { ...prev.featureFlags, [flagName]: enabled } } : null
      );
      toast.success(`Feature ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update feature');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="System settings"
        subtitle="Platform-wide email, features, branding, and limits"
        actions={
          <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchSettings} loading={loading}>
            Refresh
          </Button>
        }
      />

      <div className="tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonCard />
      ) : error || !settings ? (
        <ErrorState title="Couldn't load settings" message={error?.message || 'Settings unavailable'} onRetry={fetchSettings} />
      ) : (
        <>
          {activeTab === 'email' && (
            <Panel title="Email configuration" subtitle="How transactional mail is sent">
              <div className="stack" style={{ gap: 'var(--space-4)' }}>
                <div className="grid2">
                  <Field label="Sender email" required>
                    <TextInput type="email" value={settings.emailConfig.senderEmail} onChange={(e) => update('emailConfig', { senderEmail: e.target.value })} />
                  </Field>
                  <Field label="Sender name" required>
                    <TextInput value={settings.emailConfig.senderName} onChange={(e) => update('emailConfig', { senderName: e.target.value })} />
                  </Field>
                </div>
                <Field label="Provider">
                  <Select value={settings.emailConfig.provider} onChange={(e) => update('emailConfig', { provider: e.target.value as SystemSettings['emailConfig']['provider'] })}>
                    <option value="smtp">SMTP</option>
                    <option value="sendgrid">SendGrid</option>
                    <option value="aws-ses">AWS SES</option>
                  </Select>
                </Field>
                <div>
                  <Button variant="primary" icon={<Save size={15} />} onClick={() => save('/superadmin/settings/email', settings.emailConfig, 'Email configuration saved')} loading={saving}>
                    Save email settings
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {activeTab === 'features' && (
            <Panel title="Feature flags" subtitle="Toggle platform capabilities">
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {Object.entries(settings.featureFlags).map(([flag, enabled]) => (
                  <div key={flag} className="row-between" style={{ padding: 'var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <p className="text-sm" style={{ margin: 0, fontWeight: 600, textTransform: 'capitalize' }}>{flag.replace(/_/g, ' ')}</p>
                      <StatusBadge status={enabled ? 'enabled' : 'disabled'} tone={enabled ? 'success' : 'neutral'} dot={false} />
                    </div>
                    <Button variant={enabled ? 'secondary' : 'primary'} size="sm" onClick={() => handleToggleFeature(flag, !enabled)} loading={saving}>
                      {enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {activeTab === 'branding' && (
            <Panel title="Branding" subtitle="Platform identity shown to tenants and guests">
              <div className="stack" style={{ gap: 'var(--space-4)' }}>
                <Field label="Platform name">
                  <TextInput value={settings.branding.platformName} onChange={(e) => update('branding', { platformName: e.target.value })} />
                </Field>
                <Field label="Primary color">
                  <div className="row">
                    <input
                      type="color"
                      value={settings.branding.primaryColor}
                      onChange={(e) => update('branding', { primaryColor: e.target.value })}
                      style={{ height: 38, width: 64, border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: 2 }}
                    />
                    <TextInput value={settings.branding.primaryColor} onChange={(e) => update('branding', { primaryColor: e.target.value })} style={{ flex: 1, fontFamily: 'monospace' }} />
                  </div>
                </Field>
                <div className="grid2">
                  <Field label="Support email">
                    <TextInput type="email" value={settings.branding.supportEmail} onChange={(e) => update('branding', { supportEmail: e.target.value })} />
                  </Field>
                  <Field label="Support phone">
                    <TextInput value={settings.branding.supportPhone || ''} onChange={(e) => update('branding', { supportPhone: e.target.value })} />
                  </Field>
                </div>
                <div>
                  <Button variant="primary" icon={<Save size={15} />} onClick={() => save('/superadmin/settings/branding', settings.branding, 'Branding updated')} loading={saving}>
                    Save branding
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {activeTab === 'rate-limit' && (
            <Panel title="Rate limiting" subtitle="Platform request thresholds">
              <div className="stack" style={{ gap: 'var(--space-4)' }}>
                <div className="grid2">
                  <Field label="API calls / minute">
                    <TextInput type="number" min={1} value={settings.rateLimit.apiCallsPerMinute} onChange={(e) => update('rateLimit', { apiCallsPerMinute: parseInt(e.target.value, 10) })} />
                  </Field>
                  <Field label="Login attempts / hour">
                    <TextInput type="number" min={1} value={settings.rateLimit.loginAttemptsPerHour} onChange={(e) => update('rateLimit', { loginAttemptsPerHour: parseInt(e.target.value, 10) })} />
                  </Field>
                </div>
                <Field label="Request timeout (seconds)">
                  <TextInput type="number" min={1} value={settings.rateLimit.requestTimeoutSeconds} onChange={(e) => update('rateLimit', { requestTimeoutSeconds: parseInt(e.target.value, 10) })} />
                </Field>
                <div>
                  <Button variant="primary" icon={<Save size={15} />} onClick={() => save('/superadmin/settings/rate-limit', settings.rateLimit, 'Rate limits updated')} loading={saving}>
                    Save rate limits
                  </Button>
                </div>
              </div>
            </Panel>
          )}
        </>
      )}
    </Layout>
  );
}
