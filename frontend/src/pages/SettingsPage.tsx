import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import toast from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  Field,
  Modal,
  PageHeader,
  Panel,
  Select,
  Skeleton,
  StatusBadge,
  TextInput,
} from '../components/ui';
import { Plus, Trash2, X } from 'lucide-react';

interface TenantSettings {
  currency: string;
  currencySymbol: string;
  timezone: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  taxRate: number;
  vatEnabled: boolean;
  vatRate: number;
  invoicePrefix: string;
  invoiceNumberFormat: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  autoCheckout: boolean;
  autoCheckoutTime: string;
  otherSettings: Record<string, any>;
  branding: {
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
  };
}

type PaymentGatewayOption = 'paystack' | 'flutterwave' | 'stripe';

interface GatewaySettingsResponse {
  defaultGateway: PaymentGatewayOption;
  currency: string;
  callbackUrl: string | null;
  allowedGateways: PaymentGatewayOption[];
  paystack: { publicKey: string | null; secretConfigured: boolean };
  flutterwave: { publicKey: string | null; secretConfigured: boolean };
  stripe: { publicKey: string | null; secretConfigured: boolean };
}

interface GatewayOptionStatus {
  name: PaymentGatewayOption | 'manual' | 'monnify';
  configured: boolean;
  allowedForPublicCheckout?: boolean;
}

interface GatewaySettingsForm {
  defaultGateway: PaymentGatewayOption;
  currency: string;
  callbackUrl: string;
  allowedGateways: PaymentGatewayOption[];
  paystackPublicKey: string;
  paystackSecretKey: string;
  paystackSecretConfigured: boolean;
  flutterwavePublicKey: string;
  flutterwaveSecretKey: string;
  flutterwaveSecretConfigured: boolean;
  stripePublicKey: string;
  stripeSecretKey: string;
  stripeSecretConfigured: boolean;
}

interface OverbookingSetting {
  id: string;
  roomCategoryId?: string | null;
  roomType?: string | null;
  maxOverbookingPercent: number;
  maxOverbookingCount?: number | null;
  alertThresholdPercent: number;
  criticalThresholdPercent: number;
  allowOverbooking: boolean;
  requireManagerApproval: boolean;
  blackoutDates: string[];
}

interface OverbookingAlert {
  id: string;
  date: string;
  roomType?: string | null;
  overbookingPercent?: number | null;
  status: string;
}

interface RoomCategory {
  id: string;
  name: string;
}

const ROOM_TYPES = ['single', 'double', 'twin', 'suite', 'deluxe'];

const EMPTY_OVERBOOKING_FORM = {
  target: 'all' as 'all' | 'category' | 'roomType',
  roomCategoryId: '',
  roomType: 'single',
  allowOverbooking: false,
  maxOverbookingPercent: '10',
  maxOverbookingCount: '',
  alertThresholdPercent: '5',
  criticalThresholdPercent: '8',
  requireManagerApproval: true,
  blackoutDates: [] as string[],
  newBlackout: '',
};

const MANAGED_GATEWAYS: PaymentGatewayOption[] = ['paystack', 'flutterwave', 'stripe'];

const gatewayLabels: Record<PaymentGatewayOption, string> = {
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  stripe: 'Stripe',
};

const currencies = [
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
];

const timezones = [
  'Africa/Lagos', 'Africa/Accra', 'Africa/Nairobi', 'Africa/Johannesburg',
  'Africa/Cairo', 'Africa/Casablanca', 'UTC', 'America/New_York',
  'Europe/London', 'Asia/Dubai',
];

const inputStyle = { width: '100%' };

function GatewayCard({
  title,
  hint,
  publicKey,
  secretKey,
  secretConfigured,
  publicPlaceholder,
  secretPlaceholder,
  onPublicKeyChange,
  onSecretKeyChange,
}: {
  title: string;
  hint: string;
  publicKey: string;
  secretKey: string;
  secretConfigured: boolean;
  publicPlaceholder: string;
  secretPlaceholder: string;
  onPublicKeyChange: (v: string) => void;
  onSecretKeyChange: (v: string) => void;
}) {
  return (
    <Panel>
      <div className="row-between" style={{ marginBottom: 'var(--space-3)' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text)' }}>{title}</h3>
          <p className="text-sm muted" style={{ margin: '2px 0 0' }}>{hint}</p>
        </div>
        {secretConfigured && <StatusBadge tone="success" dot={false}>Secret saved</StatusBadge>}
      </div>
      <div className="grid2">
        <Field label="Public key">
          <TextInput
            value={publicKey}
            onChange={(e) => onPublicKeyChange(e.target.value)}
            placeholder={publicPlaceholder}
          />
        </Field>
        <Field label="Secret key" hint={secretConfigured ? 'Leave blank to keep the saved secret' : undefined}>
          <TextInput
            type="password"
            value={secretKey}
            onChange={(e) => onSecretKeyChange(e.target.value)}
            placeholder={secretPlaceholder}
            autoComplete="new-password"
          />
        </Field>
      </div>
    </Panel>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TenantSettings>({
    currency: 'NGN',
    currencySymbol: '₦',
    timezone: 'Africa/Lagos',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    taxRate: 0,
    vatEnabled: false,
    vatRate: 0,
    invoicePrefix: 'INV',
    invoiceNumberFormat: 'INV-{YYYY}-{MM}-{####}',
    emailNotifications: true,
    smsNotifications: false,
    autoCheckout: false,
    autoCheckoutTime: '11:00',
    otherSettings: {},
    branding: {
      primaryColor: '#0f172a',
      accentColor: '#7c3aed',
      logoUrl: null,
    },
  });
  const [gatewaySettings, setGatewaySettings] = useState<GatewaySettingsForm | null>(null);
  const [gatewayOptions, setGatewayOptions] = useState<GatewayOptionStatus[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(true);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const [obSettings, setObSettings] = useState<OverbookingSetting[]>([]);
  const [obAlerts, setObAlerts] = useState<OverbookingAlert[]>([]);
  const [roomCategories, setRoomCategories] = useState<RoomCategory[]>([]);
  const [obLoading, setObLoading] = useState(true);
  const [obSaving, setObSaving] = useState(false);
  const [obModal, setObModal] = useState(false);
  const [obForm, setObForm] = useState(EMPTY_OVERBOOKING_FORM);
  const [obDeleteTarget, setObDeleteTarget] = useState<OverbookingSetting | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/settings`);
      if (response.data.data) setSettings(response.data.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const fetchGatewaySettings = useCallback(async () => {
    if (!user?.tenantId) return;
    setPaymentLoading(true);
    try {
      const [settingsResponse, gatewaysResponse] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/payments/gateway-settings`),
        api.get(`/tenants/${user.tenantId}/payments/gateways`),
      ]);

      const data: GatewaySettingsResponse = settingsResponse.data.data;
      const normalizedAllowedGateways = (data.allowedGateways?.length ? data.allowedGateways : [data.defaultGateway])
        .filter((gateway): gateway is PaymentGatewayOption =>
          (MANAGED_GATEWAYS as readonly string[]).includes(gateway)
        );

      setGatewaySettings({
        defaultGateway: data.defaultGateway,
        currency: data.currency || 'NGN',
        callbackUrl: data.callbackUrl || '',
        allowedGateways:
          normalizedAllowedGateways.length > 0 ? normalizedAllowedGateways : [data.defaultGateway],
        paystackPublicKey: data.paystack.publicKey || '',
        paystackSecretKey: '',
        paystackSecretConfigured: data.paystack.secretConfigured,
        flutterwavePublicKey: data.flutterwave.publicKey || '',
        flutterwaveSecretKey: '',
        flutterwaveSecretConfigured: data.flutterwave.secretConfigured,
        stripePublicKey: data.stripe.publicKey || '',
        stripeSecretKey: '',
        stripeSecretConfigured: data.stripe.secretConfigured,
      });

      setGatewayOptions(gatewaysResponse.data.data?.gateways || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to fetch payment gateway settings');
    } finally {
      setPaymentLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchGatewaySettings();
  }, [fetchGatewaySettings]);

  const fetchOverbooking = useCallback(async () => {
    if (!user?.tenantId) return;
    setObLoading(true);
    try {
      const [settingsRes, alertsRes, categoriesRes] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/overbooking/settings`),
        api.get(`/tenants/${user.tenantId}/overbooking/alerts`, { params: { status: 'open' } }),
        api.get(`/tenants/${user.tenantId}/room-categories`),
      ]);
      setObSettings(settingsRes.data.data || []);
      setObAlerts(alertsRes.data.data || []);
      setRoomCategories(categoriesRes.data.data || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to load overbooking settings');
    } finally {
      setObLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchOverbooking();
  }, [fetchOverbooking]);

  const openObModal = (existing?: OverbookingSetting) => {
    if (existing) {
      setObForm({
        target: existing.roomCategoryId ? 'category' : existing.roomType ? 'roomType' : 'all',
        roomCategoryId: existing.roomCategoryId ?? '',
        roomType: existing.roomType ?? 'single',
        allowOverbooking: existing.allowOverbooking,
        maxOverbookingPercent: String(existing.maxOverbookingPercent),
        maxOverbookingCount: existing.maxOverbookingCount != null ? String(existing.maxOverbookingCount) : '',
        alertThresholdPercent: String(existing.alertThresholdPercent),
        criticalThresholdPercent: String(existing.criticalThresholdPercent),
        requireManagerApproval: existing.requireManagerApproval,
        blackoutDates: (existing.blackoutDates ?? []).map((d) => new Date(d).toISOString().slice(0, 10)),
        newBlackout: '',
      });
    } else {
      setObForm(EMPTY_OVERBOOKING_FORM);
    }
    setObModal(true);
  };

  const handleObSave = async () => {
    if (!user?.tenantId) return;
    setObSaving(true);
    try {
      await api.post(`/tenants/${user.tenantId}/overbooking/settings`, {
        roomCategoryId: obForm.target === 'category' && obForm.roomCategoryId ? obForm.roomCategoryId : null,
        roomType: obForm.target === 'roomType' ? obForm.roomType : null,
        allowOverbooking: obForm.allowOverbooking,
        maxOverbookingPercent: Number(obForm.maxOverbookingPercent) || 0,
        maxOverbookingCount: obForm.maxOverbookingCount ? Number(obForm.maxOverbookingCount) : null,
        alertThresholdPercent: Number(obForm.alertThresholdPercent) || 0,
        criticalThresholdPercent: Number(obForm.criticalThresholdPercent) || 0,
        requireManagerApproval: obForm.requireManagerApproval,
        blackoutDates: obForm.blackoutDates,
      });
      toast.success('Overbooking rule saved');
      setObModal(false);
      fetchOverbooking();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save overbooking rule');
    } finally {
      setObSaving(false);
    }
  };

  const handleObDelete = async () => {
    if (!obDeleteTarget || !user?.tenantId) return;
    try {
      await api.delete(`/tenants/${user.tenantId}/overbooking/settings/${obDeleteTarget.id}`);
      toast.success('Overbooking rule deleted');
      setObDeleteTarget(null);
      fetchOverbooking();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to delete rule');
    }
  };

  const handleObResolve = async (alertId: string) => {
    if (!user?.tenantId) return;
    try {
      await api.post(`/tenants/${user.tenantId}/overbooking/alerts/${alertId}/resolve`, {});
      toast.success('Alert resolved');
      fetchOverbooking();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to resolve alert');
    }
  };

  const obTargetLabel = (s: OverbookingSetting) => {
    if (s.roomCategoryId) return roomCategories.find((c) => c.id === s.roomCategoryId)?.name ?? 'Category';
    if (s.roomType) return s.roomType.charAt(0).toUpperCase() + s.roomType.slice(1);
    return 'All rooms';
  };

  const toggleAllowedGateway = (gateway: PaymentGatewayOption) => {
    setGatewaySettings((prev) => {
      if (!prev) return prev;
      const exists = prev.allowedGateways.includes(gateway);
      let updatedAllowed = exists
        ? prev.allowedGateways.filter((g) => g !== gateway)
        : [...prev.allowedGateways, gateway];
      if (updatedAllowed.length === 0) updatedAllowed = [prev.defaultGateway];
      let defaultGateway = prev.defaultGateway;
      if (!updatedAllowed.includes(defaultGateway)) defaultGateway = updatedAllowed[0];
      return { ...prev, allowedGateways: updatedAllowed, defaultGateway };
    });
  };

  const handleDefaultGatewayChange = (value: PaymentGatewayOption) => {
    setGatewaySettings((prev) => {
      if (!prev) return prev;
      const allowed = prev.allowedGateways.includes(value)
        ? prev.allowedGateways
        : [...prev.allowedGateways, value];
      return { ...prev, defaultGateway: value, allowedGateways: allowed };
    });
  };

  const handleGatewaySettingsSave = async () => {
    if (!gatewaySettings || !user?.tenantId) return;
    if (!gatewaySettings.allowedGateways.length) {
      toast.error('Select at least one allowed gateway.');
      return;
    }
    const payload: Record<string, any> = {
      defaultGateway: gatewaySettings.defaultGateway,
      allowedGateways: gatewaySettings.allowedGateways,
      currency: gatewaySettings.currency,
      callbackUrl: gatewaySettings.callbackUrl || undefined,
      paystackPublicKey: gatewaySettings.paystackPublicKey || undefined,
      flutterwavePublicKey: gatewaySettings.flutterwavePublicKey || undefined,
      stripePublicKey: gatewaySettings.stripePublicKey || undefined,
    };
    if (gatewaySettings.paystackSecretKey) payload.paystackSecretKey = gatewaySettings.paystackSecretKey;
    if (gatewaySettings.flutterwaveSecretKey) payload.flutterwaveSecretKey = gatewaySettings.flutterwaveSecretKey;
    if (gatewaySettings.stripeSecretKey) payload.stripeSecretKey = gatewaySettings.stripeSecretKey;

    setPaymentSaving(true);
    try {
      await api.put(`/tenants/${user.tenantId}/payments/gateway-settings`, payload);
      toast.success('Payment gateway settings saved');
      await fetchGatewaySettings();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save gateway settings');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.patch(`/tenants/${user?.tenantId}/settings`, settings);
      toast.success('Settings saved successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = currencies.find((c) => c.code === currencyCode);
    setSettings({ ...settings, currency: currencyCode, currencySymbol: currency?.symbol || currencyCode });
  };

  const set = <K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) =>
    setSettings({ ...settings, [key]: value });

  return (
    <Layout>
      <PageHeader
        title="Hotel settings"
        subtitle="Currency, tax, invoicing, notifications, and payment gateways"
        actions={
          <Button variant="primary" loading={saving} onClick={handleSave}>
            Save settings
          </Button>
        }
      />

      {loading ? (
        <div className="stack">
          <Skeleton height="140px" />
          <Skeleton height="140px" />
          <Skeleton height="140px" />
        </div>
      ) : (
        <div className="stack">
          <Panel title="Currency">
            <div className="grid2">
              <Field label="Currency" required>
                <Select style={inputStyle} value={settings.currency} onChange={(e) => handleCurrencyChange(e.target.value)}>
                  {currencies.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.symbol})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency symbol">
                <TextInput
                  style={inputStyle}
                  value={settings.currencySymbol}
                  onChange={(e) => set('currencySymbol', e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Date & time">
            <div className="grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
              <Field label="Timezone">
                <Select style={inputStyle} value={settings.timezone} onChange={(e) => set('timezone', e.target.value)}>
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Date format">
                <Select style={inputStyle} value={settings.dateFormat} onChange={(e) => set('dateFormat', e.target.value)}>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </Select>
              </Field>
              <Field label="Time format">
                <Select style={inputStyle} value={settings.timeFormat} onChange={(e) => set('timeFormat', e.target.value as '12h' | '24h')}>
                  <option value="12h">12-hour</option>
                  <option value="24h">24-hour</option>
                </Select>
              </Field>
            </div>
          </Panel>

          <Panel title="Tax & VAT">
            <div className="grid2">
              <Field label="Tax rate (%)">
                <TextInput
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.taxRate}
                  onChange={(e) => set('taxRate', parseFloat(e.target.value) || 0)}
                />
              </Field>
              <Field label="VAT">
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  <label className="row text-sm" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={settings.vatEnabled}
                      onChange={(e) => set('vatEnabled', e.target.checked)}
                    />
                    Enable VAT
                  </label>
                  {settings.vatEnabled && (
                    <TextInput
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      value={settings.vatRate}
                      onChange={(e) => set('vatRate', parseFloat(e.target.value) || 0)}
                      placeholder="VAT rate %"
                    />
                  )}
                </div>
              </Field>
            </div>
          </Panel>

          <Panel title="Invoice settings">
            <div className="grid2">
              <Field label="Invoice prefix">
                <TextInput
                  style={inputStyle}
                  value={settings.invoicePrefix}
                  onChange={(e) => set('invoicePrefix', e.target.value)}
                />
              </Field>
              <Field label="Number format" hint="Use {YYYY}, {MM}, {####} placeholders">
                <TextInput
                  style={inputStyle}
                  value={settings.invoiceNumberFormat}
                  onChange={(e) => set('invoiceNumberFormat', e.target.value)}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="Notifications">
            <div className="stack" style={{ gap: 'var(--space-2)' }}>
              <label className="row text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => set('emailNotifications', e.target.checked)}
                />
                Email notifications
              </label>
              <label className="row text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={(e) => set('smsNotifications', e.target.checked)}
                />
                SMS notifications
              </label>
            </div>
          </Panel>

          <Panel
            title="Payment gateways"
            subtitle="Configure Paystack, Flutterwave, and Stripe for public checkout"
          >
            {paymentLoading || !gatewaySettings ? (
              <Skeleton height="160px" />
            ) : (
              <div className="stack">
                <div className="grid3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                  <Field label="Default gateway">
                    <Select
                      style={inputStyle}
                      value={gatewaySettings.defaultGateway}
                      onChange={(e) => handleDefaultGatewayChange(e.target.value as PaymentGatewayOption)}
                    >
                      {MANAGED_GATEWAYS.map((g) => (
                        <option key={g} value={g}>{gatewayLabels[g]}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Checkout currency">
                    <TextInput
                      style={inputStyle}
                      value={gatewaySettings.currency}
                      onChange={(e) =>
                        setGatewaySettings((prev) => (prev ? { ...prev, currency: e.target.value.toUpperCase() } : prev))
                      }
                    />
                  </Field>
                  <Field label="Callback URL">
                    <TextInput
                      style={inputStyle}
                      type="url"
                      value={gatewaySettings.callbackUrl}
                      placeholder="https://your-hotel.com/payments/callback"
                      onChange={(e) =>
                        setGatewaySettings((prev) => (prev ? { ...prev, callbackUrl: e.target.value } : prev))
                      }
                    />
                  </Field>
                </div>

                <Field label="Allowed gateways">
                  <div className="row" style={{ flexWrap: 'wrap' }}>
                    {MANAGED_GATEWAYS.map((gateway) => {
                      const isEnabled = gatewaySettings.allowedGateways.includes(gateway);
                      return (
                        <Button
                          key={gateway}
                          variant={isEnabled ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => toggleAllowedGateway(gateway)}
                        >
                          {gatewayLabels[gateway]}
                        </Button>
                      );
                    })}
                  </div>
                </Field>

                <GatewayCard
                  title="Paystack"
                  hint="Provide publishable and secret keys"
                  publicKey={gatewaySettings.paystackPublicKey}
                  secretKey={gatewaySettings.paystackSecretKey}
                  secretConfigured={gatewaySettings.paystackSecretConfigured}
                  publicPlaceholder="pk_live_..."
                  secretPlaceholder="sk_live_..."
                  onPublicKeyChange={(v) => setGatewaySettings((p) => (p ? { ...p, paystackPublicKey: v } : p))}
                  onSecretKeyChange={(v) => setGatewaySettings((p) => (p ? { ...p, paystackSecretKey: v } : p))}
                />
                <GatewayCard
                  title="Flutterwave"
                  hint="Provide public and secret keys"
                  publicKey={gatewaySettings.flutterwavePublicKey}
                  secretKey={gatewaySettings.flutterwaveSecretKey}
                  secretConfigured={gatewaySettings.flutterwaveSecretConfigured}
                  publicPlaceholder="FLWPUBK-..."
                  secretPlaceholder="FLWSECK-..."
                  onPublicKeyChange={(v) => setGatewaySettings((p) => (p ? { ...p, flutterwavePublicKey: v } : p))}
                  onSecretKeyChange={(v) => setGatewaySettings((p) => (p ? { ...p, flutterwaveSecretKey: v } : p))}
                />
                <GatewayCard
                  title="Stripe"
                  hint="Provide publishable and secret keys"
                  publicKey={gatewaySettings.stripePublicKey}
                  secretKey={gatewaySettings.stripeSecretKey}
                  secretConfigured={gatewaySettings.stripeSecretConfigured}
                  publicPlaceholder="pk_live_..."
                  secretPlaceholder="sk_live_..."
                  onPublicKeyChange={(v) => setGatewaySettings((p) => (p ? { ...p, stripePublicKey: v } : p))}
                  onSecretKeyChange={(v) => setGatewaySettings((p) => (p ? { ...p, stripeSecretKey: v } : p))}
                />

                {gatewayOptions.length > 0 && (
                  <div>
                    <p className="text-sm" style={{ fontWeight: 500, marginBottom: 'var(--space-2)' }}>Gateway status</p>
                    <div className="row" style={{ flexWrap: 'wrap' }}>
                      {gatewayOptions.map((option) => (
                        <StatusBadge key={option.name} tone={option.configured ? 'success' : 'danger'} dot={false}>
                          {option.name}
                          {option.allowedForPublicCheckout !== undefined &&
                            ` · ${option.allowedForPublicCheckout ? 'allowed' : 'disabled'}`}
                        </StatusBadge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  <Button variant="primary" loading={paymentSaving} onClick={handleGatewaySettingsSave}>
                    Save gateway settings
                  </Button>
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Auto checkout">
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <label className="row text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.autoCheckout}
                  onChange={(e) => set('autoCheckout', e.target.checked)}
                />
                Automatically check out guests past their departure date
              </label>
              {settings.autoCheckout && (
                <Field label="Auto checkout time">
                  <TextInput
                    style={inputStyle}
                    type="time"
                    value={settings.autoCheckoutTime}
                    onChange={(e) => set('autoCheckoutTime', e.target.value)}
                  />
                </Field>
              )}
            </div>
          </Panel>

          <Panel
            title="Overbooking"
            subtitle="Control how far each room type can be booked past capacity"
            actions={
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => openObModal()}>
                Add rule
              </Button>
            }
          >
            {obLoading ? (
              <Skeleton height="120px" />
            ) : (
              <div className="stack">
                {obAlerts.length > 0 && (
                  <div>
                    <p className="text-sm" style={{ fontWeight: 500, marginBottom: 'var(--space-2)' }}>
                      Open alerts ({obAlerts.length})
                    </p>
                    <div className="stack" style={{ gap: 'var(--space-2)' }}>
                      {obAlerts.map((a) => (
                        <div key={a.id} className="row-between" style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)' }}>
                          <div className="row" style={{ gap: 'var(--space-2)' }}>
                            <StatusBadge tone="danger" dot={false}>
                              {a.overbookingPercent != null ? `${Number(a.overbookingPercent).toFixed(0)}% over` : 'Overbooked'}
                            </StatusBadge>
                            <span className="text-sm">
                              {a.roomType ?? 'All types'} — {new Date(a.date).toLocaleDateString()}
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleObResolve(a.id)}>
                            Resolve
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {obSettings.length === 0 ? (
                  <p className="text-sm muted" style={{ margin: 0 }}>
                    No overbooking rules — bookings stop at capacity for every room type.
                  </p>
                ) : (
                  <div className="stack" style={{ gap: 'var(--space-2)' }}>
                    {obSettings.map((s) => (
                      <div key={s.id} className="row-between" style={{ padding: 'var(--space-2) var(--space-3)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)' }}>
                        <div className="row" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                          <strong className="text-sm">{obTargetLabel(s)}</strong>
                          <StatusBadge tone={s.allowOverbooking ? 'success' : 'neutral'} dot={false}>
                            {s.allowOverbooking ? `${Number(s.maxOverbookingPercent)}% allowed` : 'Not allowed'}
                          </StatusBadge>
                          {s.maxOverbookingCount != null && (
                            <span className="text-sm muted">max {s.maxOverbookingCount} rooms</span>
                          )}
                          <span className="text-sm muted">
                            warn at {Number(s.alertThresholdPercent)}% · critical at {Number(s.criticalThresholdPercent)}%
                          </span>
                          {s.requireManagerApproval && (
                            <span className="text-sm muted">requires manager approval</span>
                          )}
                          {s.blackoutDates?.length > 0 && (
                            <span className="text-sm muted">{s.blackoutDates.length} blackout date{s.blackoutDates.length === 1 ? '' : 's'}</span>
                          )}
                        </div>
                        <div className="row" style={{ gap: 'var(--space-2)' }}>
                          <Button variant="ghost" size="sm" onClick={() => openObModal(s)}>
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setObDeleteTarget(s)}>
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>
      )}

      <Modal
        open={obModal}
        onClose={() => setObModal(false)}
        title="Overbooking rule"
        footer={
          <>
            <Button variant="ghost" onClick={() => setObModal(false)}>Cancel</Button>
            <Button variant="primary" loading={obSaving} onClick={handleObSave}>
              Save rule
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Applies to" required>
            <Select
              style={inputStyle}
              value={obForm.target}
              onChange={(e) => setObForm({ ...obForm, target: e.target.value as typeof obForm.target })}
            >
              <option value="all">All rooms (default rule)</option>
              <option value="category">Specific room category</option>
              <option value="roomType">Specific room type</option>
            </Select>
          </Field>
          {obForm.target === 'category' && (
            <Field label="Room category" required>
              <Select
                style={inputStyle}
                value={obForm.roomCategoryId}
                onChange={(e) => setObForm({ ...obForm, roomCategoryId: e.target.value })}
              >
                <option value="">Select category…</option>
                {roomCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          )}
          {obForm.target === 'roomType' && (
            <Field label="Room type" required>
              <Select
                style={inputStyle}
                value={obForm.roomType}
                onChange={(e) => setObForm({ ...obForm, roomType: e.target.value })}
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </Select>
            </Field>
          )}

          <label className="row text-sm" style={{ cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={obForm.allowOverbooking}
              onChange={(e) => setObForm({ ...obForm, allowOverbooking: e.target.checked })}
            />
            Allow overbooking for this target
          </label>

          {obForm.allowOverbooking && (
            <>
              <div className="grid2">
                <Field label="Max overbooking (%)" hint="Percentage above capacity">
                  <TextInput
                    style={inputStyle}
                    type="number"
                    min="0"
                    max="100"
                    value={obForm.maxOverbookingPercent}
                    onChange={(e) => setObForm({ ...obForm, maxOverbookingPercent: e.target.value })}
                  />
                </Field>
                <Field label="Max extra rooms" hint="Optional hard cap">
                  <TextInput
                    style={inputStyle}
                    type="number"
                    min="0"
                    value={obForm.maxOverbookingCount}
                    onChange={(e) => setObForm({ ...obForm, maxOverbookingCount: e.target.value })}
                    placeholder="No cap"
                  />
                </Field>
              </div>
              <div className="grid2">
                <Field label="Warning threshold (%)">
                  <TextInput
                    style={inputStyle}
                    type="number"
                    min="0"
                    max="100"
                    value={obForm.alertThresholdPercent}
                    onChange={(e) => setObForm({ ...obForm, alertThresholdPercent: e.target.value })}
                  />
                </Field>
                <Field label="Critical threshold (%)">
                  <TextInput
                    style={inputStyle}
                    type="number"
                    min="0"
                    max="100"
                    value={obForm.criticalThresholdPercent}
                    onChange={(e) => setObForm({ ...obForm, criticalThresholdPercent: e.target.value })}
                  />
                </Field>
              </div>
              <label className="row text-sm" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={obForm.requireManagerApproval}
                  onChange={(e) => setObForm({ ...obForm, requireManagerApproval: e.target.checked })}
                />
                Require manager approval for overbooked reservations
              </label>

              <Field label="Blackout dates" hint="Overbooking is never allowed on these dates">
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  <div className="row" style={{ gap: 'var(--space-2)' }}>
                    <TextInput
                      style={inputStyle}
                      type="date"
                      value={obForm.newBlackout}
                      onChange={(e) => setObForm({ ...obForm, newBlackout: e.target.value })}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        if (obForm.newBlackout && !obForm.blackoutDates.includes(obForm.newBlackout)) {
                          setObForm({ ...obForm, blackoutDates: [...obForm.blackoutDates, obForm.newBlackout], newBlackout: '' });
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  {obForm.blackoutDates.length > 0 && (
                    <div className="row" style={{ flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                      {obForm.blackoutDates.map((d) => (
                        <StatusBadge key={d} tone="neutral" dot={false}>
                          {new Date(d).toLocaleDateString()}{' '}
                          <X
                            size={12}
                            style={{ cursor: 'pointer', verticalAlign: 'middle' }}
                            onClick={() => setObForm({ ...obForm, blackoutDates: obForm.blackoutDates.filter((x) => x !== d) })}
                          />
                        </StatusBadge>
                      ))}
                    </div>
                  )}
                </div>
              </Field>
            </>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!obDeleteTarget}
        onClose={() => setObDeleteTarget(null)}
        onConfirm={handleObDelete}
        title="Delete overbooking rule"
        confirmLabel="Delete"
        destructive
      >
        Delete the overbooking rule for <strong>{obDeleteTarget ? obTargetLabel(obDeleteTarget) : ''}</strong>?
        Bookings for that target will stop at capacity.
      </ConfirmDialog>
    </Layout>
  );
}
