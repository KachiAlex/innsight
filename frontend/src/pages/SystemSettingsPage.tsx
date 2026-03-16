import { useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  Settings,
  Mail,
  Shield,
  AlertCircle,
  Save,
} from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function SystemSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<'email' | 'features' | 'branding' | 'rate-limit'>('email');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role !== 'iitech_admin') {
      toast.error('Access denied. Admin privileges required.');
      navigate('/superadmin-dashboard', { replace: true });
      return;
    }

    fetchSettings();
  }, [user, isAuthenticated, navigate]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/settings');
      setSettings(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEmail = async () => {
    if (!settings?.emailConfig) return;
    try {
      setSaving(true);
      await api.patch('/superadmin/settings/email', settings.emailConfig);
      toast.success('Email configuration saved');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    if (!settings?.branding) return;
    try {
      setSaving(true);
      await api.patch('/superadmin/settings/branding', settings.branding);
      toast.success('Branding updated');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFeature = async (flagName: string, enabled: boolean) => {
    try {
      setSaving(true);
      await api.patch('/superadmin/settings/feature-flags', { [flagName]: enabled });
      setSettings(prev => prev ? {
        ...prev,
        featureFlags: { ...prev.featureFlags, [flagName]: enabled }
      } : null);
      toast.success(`Feature ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      toast.error('Failed to update feature');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRateLimits = async () => {
    if (!settings?.rateLimit) return;
    try {
      setSaving(true);
      await api.patch('/superadmin/settings/rate-limit', settings.rateLimit);
      toast.success('Rate limits updated');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <Layout>
        <div className="text-center py-12">Loading settings...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          {['email', 'features', 'branding', 'rate-limit'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 font-medium border-b-2 transition ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'email' && <Mail className="inline h-4 w-4 mr-2" />}
              {tab === 'features' && <Shield className="inline h-4 w-4 mr-2" />}
              {tab === 'branding' && <Settings className="inline h-4 w-4 mr-2" />}
              {tab === 'rate-limit' && <AlertCircle className="inline h-4 w-4 mr-2" />}
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Email Configuration */}
        {activeTab === 'email' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Email Configuration</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sender Email
              </label>
              <input
                type="email"
                value={settings.emailConfig.senderEmail}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  emailConfig: { ...prev.emailConfig, senderEmail: e.target.value }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sender Name
              </label>
              <input
                type="text"
                value={settings.emailConfig.senderName}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  emailConfig: { ...prev.emailConfig, senderName: e.target.value }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Provider
              </label>
              <select
                value={settings.emailConfig.provider}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  emailConfig: { ...prev.emailConfig, provider: e.target.value as any }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="smtp">SMTP</option>
                <option value="sendgrid">SendGrid</option>
                <option value="aws-ses">AWS SES</option>
              </select>
            </div>

            <button
              onClick={handleSaveEmail}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Email Configuration
            </button>
          </div>
        )}

        {/* Feature Flags */}
        {activeTab === 'features' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Feature Flags</h2>
            
            {Object.entries(settings.featureFlags).map(([flag, enabled]) => (
              <div key={flag} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{flag.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-600">Status: {enabled ? 'Enabled' : 'Disabled'}</p>
                </div>
                <button
                  onClick={() => handleToggleFeature(flag, !enabled)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Branding */}
        {activeTab === 'branding' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Branding</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Name
              </label>
              <input
                type="text"
                value={settings.branding.platformName}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  branding: { ...prev.branding, platformName: e.target.value }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Primary Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={settings.branding.primaryColor}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    branding: { ...prev.branding, primaryColor: e.target.value }
                  } : null)}
                  className="h-10 w-20 border border-gray-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={settings.branding.primaryColor}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    branding: { ...prev.branding, primaryColor: e.target.value }
                  } : null)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Email
              </label>
              <input
                type="email"
                value={settings.branding.supportEmail}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  branding: { ...prev.branding, supportEmail: e.target.value }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleSaveBranding}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Branding
            </button>
          </div>
        )}

        {/* Rate Limiting */}
        {activeTab === 'rate-limit' && (
          <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">Rate Limiting</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Calls Per Minute
              </label>
              <input
                type="number"
                value={settings.rateLimit.apiCallsPerMinute}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  rateLimit: { ...prev.rateLimit, apiCallsPerMinute: parseInt(e.target.value) }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Login Attempts Per Hour
              </label>
              <input
                type="number"
                value={settings.rateLimit.loginAttemptsPerHour}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  rateLimit: { ...prev.rateLimit, loginAttemptsPerHour: parseInt(e.target.value) }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request Timeout (Seconds)
              </label>
              <input
                type="number"
                value={settings.rateLimit.requestTimeoutSeconds}
                onChange={(e) => setSettings(prev => prev ? {
                  ...prev,
                  rateLimit: { ...prev.rateLimit, requestTimeoutSeconds: parseInt(e.target.value) }
                } : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={handleSaveRateLimits}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              Save Rate Limits
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
