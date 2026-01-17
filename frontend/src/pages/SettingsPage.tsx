import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Save, DollarSign, Clock, Bell, FileText, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';

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
  paystack: {
    publicKey: string | null;
    secretConfigured: boolean;
  };
  flutterwave: {
    publicKey: string | null;
    secretConfigured: boolean;
  };
  stripe: {
    publicKey: string | null;
    secretConfigured: boolean;
  };
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

  const fetchSettings = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/settings`);
      if (response.data.data) {
        setSettings(response.data.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to fetch settings');
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
      console.error('Failed to fetch payment gateway settings:', error);
      toast.error(
        error.response?.data?.error?.message ||
          error.response?.data?.message ||
          'Failed to fetch payment gateway settings'
      );
    } finally {
      setPaymentLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchGatewaySettings();
  }, [fetchGatewaySettings]);

  const toggleAllowedGateway = (gateway: PaymentGatewayOption) => {
    setGatewaySettings((prev) => {
      if (!prev) return prev;
      const exists = prev.allowedGateways.includes(gateway);
      let updatedAllowed = exists
        ? prev.allowedGateways.filter((g) => g !== gateway)
        : [...prev.allowedGateways, gateway];

      if (updatedAllowed.length === 0) {
        updatedAllowed = [prev.defaultGateway];
      }

      let defaultGateway = prev.defaultGateway;
      if (!updatedAllowed.includes(defaultGateway)) {
        defaultGateway = updatedAllowed[0];
      }

      return {
        ...prev,
        allowedGateways: updatedAllowed,
        defaultGateway,
      };
    });
  };

  const handleDefaultGatewayChange = (value: PaymentGatewayOption) => {
    setGatewaySettings((prev) => {
      if (!prev) return prev;
      const allowed = prev.allowedGateways.includes(value)
        ? prev.allowedGateways
        : [...prev.allowedGateways, value];

      return {
        ...prev,
        defaultGateway: value,
        allowedGateways: allowed,
      };
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

    if (gatewaySettings.paystackSecretKey) {
      payload.paystackSecretKey = gatewaySettings.paystackSecretKey;
    }
    if (gatewaySettings.flutterwaveSecretKey) {
      payload.flutterwaveSecretKey = gatewaySettings.flutterwaveSecretKey;
    }
    if (gatewaySettings.stripeSecretKey) {
      payload.stripeSecretKey = gatewaySettings.stripeSecretKey;
    }

    setPaymentSaving(true);
    try {
      await api.patch(`/tenants/${user.tenantId}/payments/gateway-settings`, payload);
      toast.success('Payment gateway settings saved');
      await fetchGatewaySettings();
    } catch (error: any) {
      console.error('Failed to save payment gateway settings:', error);
      toast.error(error.response?.data?.message || 'Failed to save gateway settings');
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
      console.error('Failed to save settings:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = (currencyCode: string) => {
    const currency = currencies.find((c) => c.code === currencyCode);
    setSettings({
      ...settings,
      currency: currencyCode,
      currencySymbol: currency?.symbol || currencyCode,
    });
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Settings</h1>
          <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1e293b' }}>Settings</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: saving ? '#94a3b8' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: '500',
            }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Currency Settings */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <DollarSign size={24} color="#3b82f6" />
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Currency Management</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Currency
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                >
                  {currencies.map((curr) => (
                    <option key={curr.code} value={curr.code}>
                      {curr.name} ({curr.code} {curr.symbol})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Currency Symbol
                </label>
                <input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Date & Time Settings */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Clock size={24} color="#3b82f6" />
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Date & Time</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Timezone
                </label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Date Format
                </label>
                <select
                  value={settings.dateFormat}
                  onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Time Format
                </label>
                <select
                  value={settings.timeFormat}
                  onChange={(e) => setSettings({ ...settings, timeFormat: e.target.value as '12h' | '24h' })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                >
                  <option value="24h">24 Hour</option>
                  <option value="12h">12 Hour</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tax & VAT Settings */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <FileText size={24} color="#3b82f6" />
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Tax & VAT</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={settings.vatEnabled}
                    onChange={(e) => setSettings({ ...settings, vatEnabled: e.target.checked })}
                  />
                  <span style={{ color: '#1e293b', fontWeight: '500' }}>Enable VAT</span>
                </label>
                {settings.vatEnabled && (
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings.vatRate}
                    onChange={(e) => setSettings({ ...settings, vatRate: parseFloat(e.target.value) || 0 })}
                    placeholder="VAT Rate (%)"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                      marginTop: '0.5rem',
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Invoice Settings */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h2 style={{ margin: '0 0 1.5rem', color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Invoice Settings</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Invoice Prefix
                </label>
                <input
                  type="text"
                  value={settings.invoicePrefix}
                  onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                  Invoice Number Format
                </label>
                <input
                  type="text"
                  value={settings.invoiceNumberFormat}
                  onChange={(e) => setSettings({ ...settings, invoiceNumberFormat: e.target.value })}
                  placeholder="INV-{YYYY}-{MM}-{####}"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '1rem',
                  }}
                />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Use {'{YYYY}'} for year, {'{MM}'} for month, {'{####}'} for number
                </div>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <Bell size={24} color="#3b82f6" />
              <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Notifications</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings({ ...settings, emailNotifications: e.target.checked })}
                />
                <span style={{ color: '#1e293b' }}>Enable Email Notifications</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.smsNotifications}
                  onChange={(e) => setSettings({ ...settings, smsNotifications: e.target.checked })}
                />
                <span style={{ color: '#1e293b' }}>Enable SMS Notifications</span>
              </label>
            </div>
          </div>

          {/* Payment Gateway Settings */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
              <CreditCard size={24} color="#3b82f6" />
              <div>
                <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Payment Gateways</h2>
                <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                  Configure Paystack, Flutterwave, and Stripe credentials for public checkout.
                </p>
              </div>
            </div>

            {paymentLoading || !gatewaySettings ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>Loading gateway settings...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Default Gateway
                    </label>
                    <select
                      value={gatewaySettings.defaultGateway}
                      onChange={(e) => handleDefaultGatewayChange(e.target.value as PaymentGatewayOption)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    >
                      {MANAGED_GATEWAYS.map((gateway) => (
                        <option key={gateway} value={gateway}>
                          {gatewayLabels[gateway]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Checkout Currency
                    </label>
                    <input
                      type="text"
                      value={gatewaySettings.currency}
                      onChange={(e) =>
                        setGatewaySettings((prev) =>
                          prev ? { ...prev, currency: e.target.value.toUpperCase() } : prev
                        )
                      }
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      Callback URL
                    </label>
                    <input
                      type="url"
                      value={gatewaySettings.callbackUrl}
                      placeholder="https://your-hotel.com/payments/callback"
                      onChange={(e) =>
                        setGatewaySettings((prev) =>
                          prev ? { ...prev, callbackUrl: e.target.value } : prev
                        )
                      }
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '1rem',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <p style={{ color: '#475569', fontWeight: '500', marginBottom: '0.75rem' }}>
                    Allowed Gateways
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {MANAGED_GATEWAYS.map((gateway) => {
                      const isEnabled = gatewaySettings.allowedGateways.includes(gateway);
                      return (
                        <button
                          key={gateway}
                          type="button"
                          onClick={() => toggleAllowedGateway(gateway)}
                          style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '999px',
                            border: isEnabled ? '1px solid #14b8a6' : '1px solid #cbd5e1',
                            background: isEnabled ? '#ccfbf1' : 'white',
                            color: isEnabled ? '#0f766e' : '#475569',
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                          }}
                        >
                          <span>{gatewayLabels[gateway]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '1rem' }}>
                  {/* Paystack Card */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#0f172a' }}>Paystack</h3>
                        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                          Provide publishable and secret keys.
                        </p>
                      </div>
                      {gatewaySettings.paystackSecretConfigured && (
                        <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Secret saved</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                          Public Key
                        </label>
                        <input
                          type="text"
                          value={gatewaySettings.paystackPublicKey}
                          onChange={(e) =>
                            setGatewaySettings((prev) =>
                              prev ? { ...prev, paystackPublicKey: e.target.value } : prev
                            )
                          }
                          placeholder="pk_live_..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                          Secret Key
                        </label>
                        <input
                          type="password"
                          value={gatewaySettings.paystackSecretKey}
                          onChange={(e) =>
                            setGatewaySettings((prev) =>
                              prev ? { ...prev, paystackSecretKey: e.target.value } : prev
                            )
                          }
                          placeholder="sk_live_..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Flutterwave */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#0f172a' }}>Flutterwave</h3>
                        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                          Provide public and secret keys.
                        </p>
                      </div>
                      {gatewaySettings.flutterwaveSecretConfigured && (
                        <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Secret saved</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                          Public Key
                        </label>
                        <input
                          type="text"
                          value={gatewaySettings.flutterwavePublicKey}
                          onChange={(e) =>
                            setGatewaySettings((prev) =>
                              prev ? { ...prev, flutterwavePublicKey: e.target.value } : prev
                            )
                          }
                          placeholder="FLWPUBK-..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                          Secret Key
                        </label>
                        <input
                          type="password"
                          value={gatewaySettings.flutterwaveSecretKey}
                          onChange={(e) =>
                            setGatewaySettings((prev) =>
                              prev ? { ...prev, flutterwaveSecretKey: e.target.value } : prev
                            )
                          }
                          placeholder="FLWSECK-..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Stripe */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#0f172a' }}>Stripe</h3>
                        <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                          Provide publishable and secret keys.
                        </p>
                      </div>
                      {gatewaySettings.stripeSecretConfigured && (
                        <span style={{ color: '#10b981', fontSize: '0.85rem' }}>Secret saved</span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                          Publishable Key
                        </label>
                        <input
                          type="text"
                          value={gatewaySettings.stripePublicKey}
                          onChange={(e) =>
                            setGatewaySettings((prev) =>
                              prev ? { ...prev, stripePublicKey: e.target.value } : prev
                            )
                          }
                          placeholder="pk_live_..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                          Secret Key
                        </label>
                        <input
                          type="password"
                          value={gatewaySettings.stripeSecretKey}
                          onChange={(e) =>
                            setGatewaySettings((prev) =>
                              prev ? { ...prev, stripeSecretKey: e.target.value } : prev
                            )
                          }
                          placeholder="sk_live_..."
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ margin: 0, color: '#334155', fontWeight: '500' }}>Gateway Status</p>
                    <p style={{ margin: '0.25rem 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                      Gateways configured and enabled for public checkout.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {gatewayOptions.map((option) => (
                      <div
                        key={option.name}
                        style={{
                          padding: '0.35rem 0.75rem',
                          borderRadius: '999px',
                          border: '1px solid #cbd5e1',
                          background: option.configured ? '#dcfce7' : '#fee2e2',
                          color: option.configured ? '#166534' : '#991b1b',
                          fontSize: '0.8rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        <span>{option.name}</span>
                        {option.allowedForPublicCheckout !== undefined && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              color: option.allowedForPublicCheckout ? '#0f766e' : '#9a3412',
                            }}
                          >
                            {option.allowedForPublicCheckout ? 'allowed' : 'disabled'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleGatewaySettingsSave}
                    disabled={paymentSaving}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1.5rem',
                      background: paymentSaving ? '#94a3b8' : '#0ea5e9',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: paymentSaving ? 'not-allowed' : 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    {paymentSaving ? 'Saving...' : 'Save Gateway Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Auto Checkout Settings */}
          <div style={{ background: 'white', borderRadius: '8px', padding: '1.5rem', border: '1px solid #e2e8f0' }}>
            <h2 style={{ margin: '0 0 1.5rem', color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>Auto Checkout</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.autoCheckout}
                  onChange={(e) => setSettings({ ...settings, autoCheckout: e.target.checked })}
                />
                <span style={{ color: '#1e293b' }}>Enable Automatic Checkout</span>
              </label>
              {settings.autoCheckout && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Auto Checkout Time
                  </label>
                  <input
                    type="time"
                    value={settings.autoCheckoutTime}
                    onChange={(e) => setSettings({ ...settings, autoCheckoutTime: e.target.value })}
                    style={{
                      width: '100%',
                      maxWidth: '200px',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}

