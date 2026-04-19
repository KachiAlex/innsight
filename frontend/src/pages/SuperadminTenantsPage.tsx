import { useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Search, ArrowLeft, Eye, Ban, CheckCircle, Users, Building, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  slug: string;
  subscriptionStatus: 'active' | 'suspended' | 'trial' | 'inactive';
  createdAt: string;
  _count: {
    users: number;
    rooms: number;
  };
}

interface TenantsResponse {
  tenants: Tenant[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function SuperadminTenantsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }

    fetchTenants();
  }, [user, isAuthenticated, navigate, page, statusFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const response = await api.get(`/superadmin/tenants?${params}`);
      const data: TenantsResponse = response.data.data;
      setTenants(data.tenants);
      setTotalPages(data.pagination.totalPages);
    } catch (err: any) {
      console.error('Error fetching tenants:', err);
      toast.error('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchTenants();
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const updateTenantStatus = async (tenantId: string, status: string) => {
    try {
      await api.patch(`/superadmin/tenants/${tenantId}/status`, { status });
      toast.success('Tenant status updated');
      fetchTenants();
    } catch (err: any) {
      console.error('Error updating tenant status:', err);
      toast.error('Failed to update tenant status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'suspended': return 'bg-red-100 text-red-800 border-red-200';
      case 'trial': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <Layout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <button
              onClick={() => navigate('/superadmin-dashboard')}
              className="flex items-center gap-2 text-black hover:text-blue-600 mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="text-sm font-medium">Back to Dashboard</span>
            </button>
            <h1 className="text-3xl font-bold text-black">Tenant Management</h1>
            <p className="text-black mt-1">Manage all platform tenants</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-400 rounded-xl p-4 shadow-sm mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-black" />
                <input
                  type="text"
                  placeholder="Search by name, email, or slug..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full pl-10 pr-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black placeholder-gray-600"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={handleStatusChange}
                className="w-full px-4 py-3 border border-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black bg-white"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="trial">Trial</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Tenants Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-black font-medium">Loading tenants...</div>
          </div>
        ) : tenants.length === 0 ? (
          <div className="flex items-center justify-center py-12 bg-white border border-gray-400 rounded-xl">
            <div className="text-black font-medium">No tenants found</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="bg-white border border-gray-400 rounded-xl shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Card Header */}
                  <div className="p-6 border-b border-gray-400">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-black">{tenant.name}</h3>
                        <p className="text-sm text-black mt-1">{tenant.email}</p>
                        <p className="text-xs text-black mt-1">{tenant.slug}</p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-bold rounded-full border ${getStatusColor(tenant.subscriptionStatus)}`}>
                        {tenant.subscriptionStatus}
                      </span>
                    </div>
                  </div>

                  {/* Card Body - Stats */}
                  <div className="p-6 grid grid-cols-3 gap-4 border-b border-gray-400">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-black mb-1">
                        <Users className="h-4 w-4" />
                      </div>
                      <div className="text-xl font-bold text-black">{tenant._count.users}</div>
                      <div className="text-xs text-black">Users</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-black mb-1">
                        <Building className="h-4 w-4" />
                      </div>
                      <div className="text-xl font-bold text-black">{tenant._count.rooms}</div>
                      <div className="text-xs text-black">Rooms</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-black mb-1">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div className="text-xl font-bold text-black">
                        {new Date(tenant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-xs text-black">Created</div>
                    </div>
                  </div>

                  {/* Card Footer - Actions */}
                  <div className="p-4 bg-gray-100 rounded-b-xl flex items-center justify-between">
                    <button
                      onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                      className="flex items-center gap-2 text-blue-700 hover:text-blue-900 font-medium text-sm transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View Details
                    </button>
                    {tenant.subscriptionStatus === 'active' ? (
                      <button
                        onClick={() => updateTenantStatus(tenant.id, 'suspended')}
                        className="flex items-center gap-2 text-red-700 hover:text-red-900 font-medium text-sm transition-colors"
                      >
                        <Ban className="h-4 w-4" />
                        Suspend
                      </button>
                    ) : tenant.subscriptionStatus === 'suspended' ? (
                      <button
                        onClick={() => updateTenantStatus(tenant.id, 'active')}
                        className="flex items-center gap-2 text-green-700 hover:text-green-900 font-medium text-sm transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Activate
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="mt-6 flex items-center justify-between bg-white border border-gray-400 rounded-xl px-6 py-4">
              <div className="text-sm font-medium text-black">
                Page {page} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border border-gray-400 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border border-gray-400 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
