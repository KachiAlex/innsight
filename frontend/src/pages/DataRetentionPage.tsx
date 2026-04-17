import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Trash2, Plus, RefreshCw, AlertCircle, Clock, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface RetentionPolicy {
  id: string;
  tenantId: string;
  policyName: string;
  dataType: 'reservations' | 'audits' | 'analytics' | 'all';
  retentionDays: number;
  autoDelete: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
}

export default function DataRetentionPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [policies, setPolicies] = useState<RetentionPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    policyName: '',
    dataType: 'all' as const,
    retentionDays: 90,
    autoDelete: true,
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

    fetchPolicies();
  }, [user, isAuthenticated, navigate]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const response = await api.get('/superadmin/retention-policies');
      setPolicies(response.data?.data || []);
    } catch (error: any) {
      toast.error('Failed to load retention policies');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPolicy = async () => {
    try {
      await api.post('/superadmin/retention-policies', formData);
      toast.success('Policy created successfully');
      setFormData({ policyName: '', dataType: 'all', retentionDays: 90, autoDelete: true });
      setShowForm(false);
      fetchPolicies();
    } catch (error: any) {
      toast.error('Failed to create policy');
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    if (!window.confirm('Are you sure you want to delete this policy?')) return;

    try {
      await api.delete(`/superadmin/retention-policies/${policyId}`);
      toast.success('Policy deleted successfully');
      fetchPolicies();
    } catch (error: any) {
      toast.error('Failed to delete policy');
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
          <h1 className="text-3xl font-bold text-gray-900">Data Retention Policies</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" /> New Policy
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Create Retention Policy</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Policy Name"
                value={formData.policyName}
                onChange={(e) => setFormData({ ...formData, policyName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <select
                value={formData.dataType}
                onChange={(e) => setFormData({ ...formData, dataType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All Data</option>
                <option value="reservations">Reservations</option>
                <option value="audits">Audit Logs</option>
                <option value="analytics">Analytics</option>
              </select>
              <div>
                <label className="block text-sm font-medium mb-1">Retention Days</label>
                <input
                  type="number"
                  value={formData.retentionDays}
                  onChange={(e) => setFormData({ ...formData, retentionDays: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.autoDelete}
                  onChange={(e) => setFormData({ ...formData, autoDelete: e.target.checked })}
                  className="h-4 w-4"
                />
                <span>Auto-delete old data</span>
              </label>
              <button
                onClick={handleAddPolicy}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Create Policy
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-4">
          {policies.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>No retention policies configured</p>
            </div>
          ) : (
            policies.map((policy) => (
              <div key={policy.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{policy.policyName}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {policy.dataType}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded flex items-center">
                        <Calendar className="h-3 w-3 mr-1" /> {policy.retentionDays} days
                      </span>
                      {policy.autoDelete && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          Auto-delete enabled
                        </span>
                      )}
                    </div>
                    {policy.lastRunAt && (
                      <p className="text-sm text-gray-600 mt-2 flex items-center">
                        <Clock className="h-4 w-4 mr-1" />
                        Last run: {new Date(policy.lastRunAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeletePolicy(policy.id)}
                    className="text-red-600 hover:text-red-900 ml-4"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
