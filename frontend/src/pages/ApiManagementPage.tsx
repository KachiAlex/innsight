import { useEffect, useState } from 'react';
import {
  Key,
  Plus,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  TrendingUp,
  Clock,
  Shield,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  status: 'active' | 'revoked';
  scopes: string[];
  rateLimit: number;
  lastUsedAt?: string;
  createdAt: string;
}

interface ApiMetrics {
  totalKeys: number;
  activeKeys: number;
  revokedKeys: number;
  totalRequests: number;
  totalErrors: number;
  topEndpoints: Array<{ endpoint: string; count: number }>;
  usageByKey: Array<{ keyName: string; requestCount: number; errorRate: number }>;
}

export default function ApiManagementPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [metrics, setMetrics] = useState<ApiMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const [newKeyForm, setNewKeyForm] = useState({
    name: '',
    scopes: [] as string[],
    rateLimit: 1000,
  });

  const availableScopes = [
    { value: 'rooms.read', label: 'Read Rooms' },
    { value: 'rooms.write', label: 'Manage Rooms' },
    { value: 'reservations.read', label: 'Read Reservations' },
    { value: 'reservations.write', label: 'Manage Reservations' },
    { value: 'guests.read', label: 'Read Guests' },
    { value: 'guests.write', label: 'Manage Guests' },
    { value: 'payments.read', label: 'Read Payments' },
    { value: 'payments.write', label: 'Process Payments' },
    { value: 'reports.read', label: 'Read Reports' },
    { value: '*', label: 'All Scopes' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const [keysRes, metricsRes] = await Promise.all([
        api.get('/superadmin/api-keys'),
        api.get('/superadmin/api-metrics'),
      ]);

      setApiKeys(keysRes.data.data || []);
      setMetrics(metricsRes.data.data || null);
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load API management data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyForm.name.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    try {
      await api.post('/superadmin/api-keys', {
        name: newKeyForm.name,
        scopes: newKeyForm.scopes,
        rateLimit: newKeyForm.rateLimit,
      });

      toast.success('API key created successfully');
      setNewKeyForm({ name: '', scopes: [], rateLimit: 1000 });
      setShowCreateModal(false);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to create API key');
    }
  };

  const handleToggleScope = (scope: string) => {
    if (scope === '*') {
      setNewKeyForm(prev => ({
        ...prev,
        scopes: prev.scopes.includes('*') ? [] : ['*'],
      }));
    } else {
      setNewKeyForm(prev => ({
        ...prev,
        scopes: prev.scopes.includes(scope)
          ? prev.scopes.filter(s => s !== scope)
          : [...prev.scopes, scope],
      }));
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('API key copied to clipboard');
  };

  const handleToggleVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    try {
      await api.post(`/superadmin/api-keys/${keyId}/revoke`);
      toast.success('API key revoked');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to revoke API key');
    }
  };

  const maskKey = (key: string): string => {
    if (key.length < 12) return key;
    return key.substring(0, 7) + '...' + key.substring(key.length - 4);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-600 text-white rounded-lg">
              <Key className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">API Management</h1>
              <p className="text-gray-600">Create and manage API keys for secure access</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="h-5 w-5" />
            Generate Key
          </button>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Keys</div>
              <div className="text-3xl font-bold text-green-600">{metrics.totalKeys}</div>
              <div className="text-xs text-gray-500 mt-1">{metrics.activeKeys} active</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Total Requests</div>
              <div className="text-3xl font-bold text-blue-600">{metrics.totalRequests.toLocaleString()}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Error Rate</div>
              <div className="text-3xl font-bold text-red-600">
                {metrics.totalRequests > 0
                  ? ((metrics.totalErrors / metrics.totalRequests) * 100).toFixed(2)
                  : 0}
                %
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Revoked Keys</div>
              <div className="text-3xl font-bold text-gray-600">{metrics.revokedKeys}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-gray-600 text-sm mb-1">Top Endpoint</div>
              <div className="text-lg font-bold text-gray-900">
                {metrics.topEndpoints[0]?.endpoint?.split('/').pop() || 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* API Keys Table */}
        {loading ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <div className="text-gray-500">Loading API keys...</div>
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Key className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <div className="text-gray-500 mb-4">No API keys yet</div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              Create Your First Key
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Key</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Rate Limit</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Last Used</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {apiKeys.map(key => (
                  <tr key={key.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{key.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">
                          {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                        </code>
                        <button
                          onClick={() => handleToggleVisibility(key.id)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {visibleKeys.has(key.id) ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleCopyKey(key.key)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                          key.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {key.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <TrendingUp className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">{key.rateLimit}/min</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {key.lastUsedAt ? (
                        <span className="text-sm text-gray-600">
                          {new Date(key.lastUsedAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {new Date(key.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {key.status === 'active' && (
                          <button
                            onClick={() => handleRevokeKey(key.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                            title="Revoke key"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Top Endpoints Section */}
        {metrics && metrics.topEndpoints.length > 0 && (
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Top Endpoints
              </h3>
              <div className="space-y-3">
                {metrics.topEndpoints.map((endpoint, idx) => (
                  <div key={idx} className="flex justify-between items-center pb-2 border-b last:border-b-0">
                    <span className="text-sm text-gray-600">{endpoint.endpoint}</span>
                    <span className="font-medium text-gray-900">{endpoint.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-purple-600" />
                Key Usage
              </h3>
              <div className="space-y-3">
                {metrics.usageByKey.map((usage, idx) => (
                  <div key={idx} className="pb-2 border-b last:border-b-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-900">{usage.keyName}</span>
                      <span className="text-xs text-gray-500">{usage.requestCount.toLocaleString()} req</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full"
                        style={{ width: `${Math.min(usage.errorRate * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Error rate: {(usage.errorRate * 100).toFixed(2)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Generate API Key</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Production API"
                    value={newKeyForm.name}
                    onChange={e => setNewKeyForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Scopes</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {availableScopes.map(scope => (
                      <label key={scope.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newKeyForm.scopes.includes(scope.value)}
                          onChange={() => handleToggleScope(scope.value)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{scope.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Limit</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      step={100}
                      value={newKeyForm.rateLimit}
                      onChange={e =>
                        setNewKeyForm(prev => ({ ...prev, rateLimit: parseInt(e.target.value) }))
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-600">/min</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCreateKey}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
                  >
                    Generate Key
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
