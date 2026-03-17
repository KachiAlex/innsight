import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import {
  BarChart3,
  Plus,
  Edit2,
  Save,
  X,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Tenant {
  id: string;
  name: string;
  email: string;
}

interface ResourceQuota {
  id: string;
  tenantId: string;
  maxRooms: number;
  maxUsers: number;
  maxReservations: number;
  maxStorageGB: number;
  maxApiCallsPerDay: number;
}

interface ResourceUsage {
  roomsUsed: number;
  usersUsed: number;
  reservationsUsed: number;
  storageUsedGB: number;
  apiCallsUsedToday: number;
}

export default function TenantQuotasPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [quotes, setQuotas] = useState<ResourceQuota | null>(null);
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<ResourceQuota>>({});

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

    fetchTenants();
  }, [user, isAuthenticated, navigate]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const response = await api.get('/tenants');
      setTenants(response.data?.data || []);
    } catch (error: any) {
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantQuotas = async (tenantId: string) => {
    try {
      const [quotasRes, usageRes] = await Promise.all([
        api.get(`/superadmin/tenant-quotas/${tenantId}`),
        api.get(`/superadmin/tenant-quotas/${tenantId}/usage`),
      ]);

      setQuotas(quotasRes.data?.data);
      setUsage(usageRes.data?.data);
      setFormData(quotasRes.data?.data || {});
    } catch (error: any) {
      toast.error('Failed to load quotas');
    }
  };

  const handleSelectTenant = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setEditing(false);
    fetchTenantQuotas(tenant.id);
  };

  const handleSaveQuotas = async () => {
    if (!selectedTenant) return;

    try {
      await api.patch(`/superadmin/tenant-quotas/${selectedTenant.id}`, formData);
      toast.success('Quotas updated successfully');
      setEditing(false);
      fetchTenantQuotas(selectedTenant.id);
    } catch (error: any) {
      toast.error('Failed to update quotas');
    }
  };

  const getUsagePercentage = (used: number, quota: number) => {
    return Math.round((used / quota) * 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
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
        <h1 className="text-3xl font-bold text-gray-900">Tenant Resource Quotas</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tenant List */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Tenants</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelectTenant(tenant)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition ${
                    selectedTenant?.id === tenant.id
                      ? 'bg-blue-100 text-blue-900'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <p className="font-medium">{tenant.name}</p>
                  <p className="text-sm text-gray-600">{tenant.email}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Quota Details */}
          {selectedTenant && quotes && usage && (
            <div className="lg:col-span-2 space-y-6">
              {/* Quotas */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold">Resource Quotas</h2>
                  {!editing && (
                    <button
                      onClick={() => setEditing(true)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-3">
                    {[
                      { key: 'maxRooms', label: 'Max Rooms' },
                      { key: 'maxUsers', label: 'Max Users' },
                      { key: 'maxReservations', label: 'Max Reservations' },
                      { key: 'maxStorageGB', label: 'Max Storage (GB)' },
                      { key: 'maxApiCallsPerDay', label: 'Max API Calls/Day' },
                    ].map((field) => (
                      <input
                        key={field.key}
                        type="number"
                        value={formData[field.key as keyof ResourceQuota] || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            [field.key]: parseInt(e.target.value),
                          })
                        }
                        placeholder={field.label}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    ))}
                    <div className="flex space-x-2">
                      <button
                        onClick={handleSaveQuotas}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center"
                      >
                        <Save className="h-4 w-4 mr-2" /> Save
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="flex-1 bg-gray-300 text-gray-900 px-4 py-2 rounded-md hover:bg-gray-400 flex items-center justify-center"
                      >
                        <X className="h-4 w-4 mr-2" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p>Rooms: <span className="font-bold">{quotes.maxRooms}</span></p>
                    <p>Users: <span className="font-bold">{quotes.maxUsers}</span></p>
                    <p>Reservations: <span className="font-bold">{quotes.maxReservations}</span></p>
                    <p>Storage: <span className="font-bold">{quotes.maxStorageGB} GB</span></p>
                    <p>API Calls/Day: <span className="font-bold">{quotes.maxApiCallsPerDay}</span></p>
                  </div>
                )}
              </div>

              {/* Usage */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" /> Current Usage
                </h2>
                <div className="space-y-4">
                  {[
                    { label: 'Rooms', used: usage.roomsUsed, max: quotes.maxRooms },
                    { label: 'Users', used: usage.usersUsed, max: quotes.maxUsers },
                    { label: 'Reservations', used: usage.reservationsUsed, max: quotes.maxReservations },
                    { label: 'Storage (GB)', used: usage.storageUsedGB, max: quotes.maxStorageGB },
                  ].map((item) => {
                    const percentage = getUsagePercentage(item.used, item.max);
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className={`text-sm font-bold px-2 py-1 rounded ${getUsageColor(percentage)}`}>
                            {percentage}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition ${
                              percentage >= 90
                                ? 'bg-red-600'
                                : percentage >= 70
                                ? 'bg-yellow-600'
                                : 'bg-green-600'
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          {item.used} / {item.max}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
