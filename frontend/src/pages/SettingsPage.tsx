import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Save, DollarSign, Clock, Bell, FileText } from 'lucide-react';
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
}

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
  });

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
    const currency = currencies.find(c => c.code === currencyCode);
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
            <Save size={20} />
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

