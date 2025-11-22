import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Building2, Plus, Users, DoorOpen, Search, Edit, Trash2 } from 'lucide-react';
import { DashboardSkeleton } from '../components/LoadingSkeleton';
import toast from 'react-hot-toast';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  subscriptionStatus: string;
  createdAt: string;
  _count?: {
    users: number;
    rooms: number;
  };
}

export default function TenantsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    address: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerFirstName: '',
    ownerLastName: '',
  });

  useEffect(() => {
    console.log('TenantsPage useEffect - isAuthenticated:', isAuthenticated, 'user:', user);
    
    // Check authentication
    if (!isAuthenticated) {
      console.log('Not authenticated, redirecting to login');
      navigate('/login', { replace: true });
      return;
    }

    // Check admin role
    if (user?.role !== 'iitech_admin') {
      console.log('Not admin, redirecting to dashboard. Role:', user?.role);
      toast.error('Access denied. Admin privileges required.');
      navigate('/dashboard', { replace: true });
      return;
    }

    // Fetch tenants if authenticated and admin
    if (isAuthenticated && user?.role === 'iitech_admin') {
      console.log('Fetching tenants...');
      fetchTenants();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      console.log('Making API call to /tenants');
      const response = await api.get('/tenants');
      console.log('Tenants API response:', response.data);
      setTenants(response.data?.data || []);
    } catch (error: any) {
      console.error('Failed to fetch tenants:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to fetch tenants';
      toast.error(errorMessage);
      setTenants([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/tenants', formData);
      toast.success('Tenant created successfully');
      setShowCreateModal(false);
      setFormData({
        name: '',
        slug: '',
        email: '',
        phone: '',
        address: '',
        ownerEmail: '',
        ownerPassword: '',
        ownerFirstName: '',
        ownerLastName: '',
      });
      fetchTenants();
    } catch (error: any) {
      console.error('Failed to create tenant:', error);
      const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to create tenant';
      toast.error(errorMessage);
    }
  };

  const filteredTenants = tenants.filter(
    (tenant) =>
      tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Early return if not authenticated or not admin - show loading skeleton
  if (!isAuthenticated || user?.role !== 'iitech_admin') {
    return (
      <Layout>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', padding: '3rem' }}>
          <DashboardSkeleton />
        </div>
      </Layout>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
            <DashboardSkeleton />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: 0, color: '#1e293b', fontSize: '2rem', fontWeight: '700' }}>Tenants Management</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#000',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.875rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000';
            }}
          >
            <Plus size={20} />
            Create Tenant
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              placeholder="Search tenants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem 1rem 0.75rem 2.5rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '0.875rem',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#000';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#e2e8f0';
              }}
            />
          </div>
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Building2 size={24} color="#000" />
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Tenants</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000' }}>{tenants.length}</div>
          </div>
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <Users size={24} color="#000" />
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Users</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000' }}>
              {tenants.reduce((sum, t) => sum + (t._count?.users || 0), 0)}
            </div>
          </div>
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <DoorOpen size={24} color="#000" />
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Total Rooms</div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#000' }}>
              {tenants.reduce((sum, t) => sum + (t._count?.rooms || 0), 0)}
            </div>
          </div>
        </div>

        {/* Tenants Table */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Slug</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Users</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Rooms</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Created</th>
                <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: '#000' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    {tenants.length === 0 ? 'No tenants found. Create your first tenant to get started.' : 'No tenants match your search.'}
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem', color: '#000', fontWeight: '500' }}>{tenant.name}</td>
                    <td style={{ padding: '1rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {tenant.slug}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{tenant.email}</td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '600',
                          background: tenant.subscriptionStatus === 'active' ? '#d1fae5' : '#fee2e2',
                          color: tenant.subscriptionStatus === 'active' ? '#065f46' : '#991b1b',
                        }}
                      >
                        {tenant.subscriptionStatus}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{tenant._count?.users || 0}</td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{tenant._count?.rooms || 0}</td>
                    <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                      {new Date(tenant.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                          }}
                          title="Edit"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#000';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#64748b';
                          }}
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#ef4444',
                          }}
                          title="Delete"
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#dc2626';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Create Tenant Modal */}
        {showCreateModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowCreateModal(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#000', fontSize: '1.5rem', fontWeight: '700' }}>
                Create New Tenant
              </h2>
              <form onSubmit={handleCreateTenant}>
                <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                      Tenant Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                      Slug *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) =>
                        setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })
                      }
                      placeholder="e.g., grand-hotel"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                      Address
                    </label>
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        resize: 'vertical',
                        fontSize: '0.875rem',
                        outline: 'none',
                      }}
                      rows={3}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#000';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                      }}
                    />
                  </div>
                  <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                    <h3 style={{ marginBottom: '1rem', color: '#000', fontSize: '1rem', fontWeight: '600' }}>
                      Owner Account
                    </h3>
                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                          Owner Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={formData.ownerEmail}
                          onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            outline: 'none',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#000';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                          }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                            First Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.ownerFirstName}
                            onChange={(e) => setFormData({ ...formData, ownerFirstName: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              outline: 'none',
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = '#000';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                            Last Name *
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.ownerLastName}
                            onChange={(e) => setFormData({ ...formData, ownerLastName: e.target.value })}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              outline: 'none',
                            }}
                            onFocus={(e) => {
                              e.currentTarget.style.borderColor = '#000';
                            }}
                            onBlur={(e) => {
                              e.currentTarget.style.borderColor = '#e2e8f0';
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                          Password *
                        </label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          value={formData.ownerPassword}
                          onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            outline: 'none',
                          }}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = '#000';
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#f1f5f9',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e2e8f0';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#000',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#333';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#000';
                    }}
                  >
                    Create Tenant
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
