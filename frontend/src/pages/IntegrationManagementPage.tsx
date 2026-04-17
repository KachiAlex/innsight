import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Edit, Trash2, RefreshCw, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import toast from 'react-hot-toast';

interface Integration {
  id: string;
  tenantId: string;
  name: string;
  type: 'payment' | 'email' | 'sms' | 'messaging' | 'analytics' | 'custom';
  status: 'active' | 'inactive' | 'error';
  apiKeyMasked: string;
  config: Record<string, any>;
  lastTestedAt?: string;
  createdAt: string;
}

export default function IntegrationManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: Integration['type'];
    apiKey: string;
    config: string;
  }>({
    name: '',
    type: 'payment',
    apiKey: '',
    config: '',
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role !== 'iitech_admin') {
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard', { replace: true });
      return;
    }

    fetchIntegrations();
  }, [user, isAuthenticated, navigate]);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/integrations');
      setIntegrations(response.data?.data || []);
    } catch (error: any) {
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIntegration = async () => {
    try {
      const config = formData.config ? JSON.parse(formData.config) : {};
      const payload = {
        name: formData.name,
        type: formData.type,
        apiKey: formData.apiKey,
        config,
      };

      if (editingId) {
        await api.patch(`/superadmin/integrations/${editingId}`, payload);
        toast.success('Integration updated successfully');
      } else {
        await api.post('/superadmin/integrations', payload);
        toast.success('Integration created successfully');
      }

      setFormData({ name: '', type: 'payment', apiKey: '', config: '' });
      setShowForm(false);
      setEditingId(null);
      fetchIntegrations();
    } catch (error: any) {
      toast.error('Failed to save integration');
    }
  };

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!window.confirm('Are you sure you want to delete this integration?')) return;

    try {
      await api.delete(`/superadmin/integrations/${integrationId}`);
      toast.success('Integration deleted successfully');
      fetchIntegrations();
    } catch (error: any) {
      toast.error('Failed to delete integration');
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    try {
      await api.post(`/superadmin/integrations/${integrationId}/test`);
      toast.success('Connection test successful');
      fetchIntegrations();
    } catch (error: any) {
      toast.error('Connection test failed');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'payment':
        return '💳';
      case 'email':
        return '📧';
      case 'sms':
        return '📱';
      case 'messaging':
        return '💬';
      case 'analytics':
        return '📊';
      default:
        return '⚙️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-50';
      case 'inactive':
        return 'text-gray-600 bg-gray-50';
      case 'error':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Integration Management</h1>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({ name: '', type: 'payment', apiKey: '', config: '' });
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" /> New Integration
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">
              {editingId ? 'Edit Integration' : 'Create New Integration'}
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Integration Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as Integration['type'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="payment">Payment</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="messaging">Messaging</option>
                <option value="analytics">Analytics</option>
                <option value="custom">Custom</option>
              </select>
              <input
                type="password"
                placeholder="API Key"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <textarea
                placeholder="Configuration (JSON)"
                value={formData.config}
                onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveIntegration}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
                >
                  {editingId ? 'Update Integration' : 'Create Integration'}
                </button>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {integrations.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No integrations configured</p>
            </div>
          ) : (
            integrations.map((integration) => (
              <div key={integration.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-2xl">{getTypeIcon(integration.type)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                        <p className="text-sm text-gray-600">{integration.type}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium flex items-center ${getStatusColor(integration.status)}`}>
                        {integration.status === 'active' ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : integration.status === 'error' ? (
                          <AlertCircle className="h-3 w-3 mr-1" />
                        ) : null}
                        {integration.status}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                        Key: {integration.apiKeyMasked}
                      </span>
                    </div>
                    {integration.lastTestedAt && (
                      <p className="text-xs text-gray-500 mt-2">
                        Last tested: {new Date(integration.lastTestedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleTestConnection(integration.id)}
                      className="text-blue-600 hover:text-blue-900"
                      title="Test connection"
                    >
                      <Zap className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(integration.id);
                        setFormData({
                          name: integration.name,
                          type: integration.type,
                          apiKey: '',
                          config: JSON.stringify(integration.config),
                        });
                        setShowForm(true);
                      }}
                      className="text-gray-600 hover:text-gray-900"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteIntegration(integration.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
