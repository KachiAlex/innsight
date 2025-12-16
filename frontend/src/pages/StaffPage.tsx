import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Edit, Trash2, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';

interface Staff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  roleClassification: 'normal_staff' | 'supervisor' | 'manager' | 'senior_executive' | null;
  roleDescription?: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

const roleClassificationLabels: Record<string, string> = {
  normal_staff: 'Normal Staff',
  supervisor: 'Supervisor',
  manager: 'Manager',
  senior_executive: 'Senior Executive',
};

export default function StaffPage() {
  const { user } = useAuthStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterClassification, setFilterClassification] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: string;
    roleClassification: 'normal_staff' | 'supervisor' | 'manager' | 'senior_executive';
    roleDescription: string;
    isActive: boolean;
  }>({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: '',
    roleClassification: 'normal_staff',
    roleDescription: '',
    isActive: true,
  });

  const fetchStaff = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (filterRole) params.role = filterRole;
      if (filterClassification) params.roleClassification = filterClassification;
      if (filterActive !== null) params.isActive = filterActive.toString();
      if (debouncedSearchTerm) params.search = debouncedSearchTerm;

      const response = await api.get(`/tenants/${user.tenantId}/staff`, { params });
      setStaff(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch staff:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to fetch staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filterRole, filterClassification, filterActive, debouncedSearchTerm]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleCreate = async () => {
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/staff`, formData);
      toast.success('Staff member created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchStaff();
    } catch (error: any) {
      console.error('Failed to create staff:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to create staff');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedStaff) return;

    if (!formData.firstName || !formData.lastName || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const updateData: any = { ...formData };
      if (!updateData.password) delete updateData.password;

      await api.patch(`/tenants/${user?.tenantId}/staff/${selectedStaff.id}`, updateData);
      toast.success('Staff member updated successfully');
      setShowEditModal(false);
      setSelectedStaff(null);
      resetForm();
      fetchStaff();
    } catch (error: any) {
      console.error('Failed to update staff:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to update staff');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (staffId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this staff member?')) return;

    setDeletingStaff(prev => new Set(prev).add(staffId));
    try {
      await api.delete(`/tenants/${user?.tenantId}/staff/${staffId}`);
      toast.success('Staff member deactivated successfully');
      fetchStaff();
    } catch (error: any) {
      console.error('Failed to delete staff:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to deactivate staff');
    } finally {
      setDeletingStaff(prev => {
        const next = new Set(prev);
        next.delete(staffId);
        return next;
      });
    }
  };

  const handleEditClick = (staffMember: Staff) => {
    setSelectedStaff(staffMember);
    setFormData({
      email: staffMember.email,
      password: '',
      firstName: staffMember.firstName,
      lastName: staffMember.lastName,
      phone: staffMember.phone || '',
      role: staffMember.role,
      roleClassification: (staffMember.roleClassification || 'normal_staff'),
      roleDescription: staffMember.roleDescription || '',
      isActive: staffMember.isActive,
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormData({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: '',
      roleClassification: 'normal_staff',
      roleDescription: '',
      isActive: true,
    });
  };

  const filteredStaff = useMemo(() => staff.filter((s) => {
    if (!debouncedSearchTerm) return true;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(searchLower) ||
      s.lastName.toLowerCase().includes(searchLower) ||
      s.email.toLowerCase().includes(searchLower) ||
      s.phone?.toLowerCase().includes(searchLower) ||
      s.role.toLowerCase().includes(searchLower)
    );
  }), [staff, debouncedSearchTerm]);

  // Get unique roles and classifications for filters
  const uniqueRoles = [...new Set(staff.map(s => s.role))].sort();
  const uniqueClassifications = [...new Set(staff.map(s => s.roleClassification).filter(Boolean))].sort();

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Staff Management</h1>
          <TableSkeleton />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1e293b' }}>Staff Management</h1>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Plus size={20} />
            Add Staff
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <SearchInput
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(value) => setSearchTerm(value)}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <option value="">All Roles</option>
              {uniqueRoles.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <select
              value={filterClassification}
              onChange={(e) => setFilterClassification(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: 'white',
                color: '#64748b',
                cursor: 'pointer',
              }}
            >
              <option value="">All Classifications</option>
              {uniqueClassifications.filter(Boolean).map((classification) => (
                <option key={classification!} value={classification!}>
                  {roleClassificationLabels[classification!] || classification}
                </option>
              ))}
            </select>
            <button
              onClick={() => setFilterActive(null)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: filterActive === null ? '#3b82f6' : 'white',
                color: filterActive === null ? 'white' : '#64748b',
                cursor: 'pointer',
              }}
            >
              All
            </button>
            <button
              onClick={() => setFilterActive(true)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: filterActive === true ? '#10b981' : 'white',
                color: filterActive === true ? 'white' : '#64748b',
                cursor: 'pointer',
              }}
            >
              Active
            </button>
            <button
              onClick={() => setFilterActive(false)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                background: filterActive === false ? '#ef4444' : 'white',
                color: filterActive === false ? 'white' : '#64748b',
                cursor: 'pointer',
              }}
            >
              Inactive
            </button>
          </div>
        </div>

        {!loading && filteredStaff.length === 0 ? (
          <EmptyState
            icon={Users}
            title={searchTerm || filterRole || filterClassification ? 'No staff match your filters' : 'No staff members yet'}
            description={searchTerm || filterRole || filterClassification
              ? 'Try adjusting your search or filter criteria'
              : 'Add your first staff member to get started'}
            action={searchTerm || filterRole || filterClassification ? undefined : {
              label: 'Add Staff',
              onClick: () => {
                resetForm();
                setShowCreateModal(true);
              },
            }}
          />
        ) : (
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
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Email</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Role</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Classification</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: '#000' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((staffMember) => (
                  <tr key={staffMember.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem', color: '#000', fontWeight: '500' }}>
                      {staffMember.firstName} {staffMember.lastName}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>{staffMember.email}</td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      <div>{staffMember.role}</div>
                      {staffMember.roleDescription && (
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                          {staffMember.roleDescription}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem', color: '#64748b' }}>
                      {staffMember.roleClassification ? roleClassificationLabels[staffMember.roleClassification] : '-'}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          background: staffMember.isActive ? '#d1fae5' : '#fee2e2',
                          color: staffMember.isActive ? '#065f46' : '#991b1b',
                        }}
                      >
                        {staffMember.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => handleEditClick(staffMember)}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#64748b',
                          }}
                          title="Edit"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(staffMember.id)}
                          disabled={deletingStaff.has(staffMember.id)}
                          style={{
                            padding: '0.5rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: deletingStaff.has(staffMember.id) ? 'not-allowed' : 'pointer',
                            color: deletingStaff.has(staffMember.id) ? '#94a3b8' : '#ef4444',
                            opacity: deletingStaff.has(staffMember.id) ? 0.6 : 1,
                          }}
                          title="Deactivate"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create Modal */}
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
                width: '90%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Add Staff Member</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} color="#64748b" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                    minLength={6}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
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
                      fontSize: '1rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Role *
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    placeholder="e.g., Chef, Housekeeper, Front Desk"
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
                    Role Description
                  </label>
                  <input
                    type="text"
                    value={formData.roleDescription}
                    onChange={(e) => setFormData({ ...formData, roleDescription: e.target.value })}
                    placeholder="Optional description for this role"
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
                    Role Classification *
                  </label>
                  <select
                    value={formData.roleClassification}
                    onChange={(e) => setFormData({ ...formData, roleClassification: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="normal_staff">Normal Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="senior_executive">Senior Executive</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span style={{ color: '#1e293b' }}>Active</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      background: 'white',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: saving ? '#94a3b8' : '#3b82f6',
                      color: 'white',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                      fontWeight: '500',
                    }}
                  >
                    {saving ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && selectedStaff && (
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
            onClick={() => {
              setShowEditModal(false);
              setSelectedStaff(null);
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                width: '90%',
                maxWidth: '600px',
                maxHeight: '90vh',
                overflow: 'auto',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, color: '#1e293b' }}>Edit Staff Member</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedStaff(null);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={20} color="#64748b" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                      First Name *
                    </label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
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
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                    New Password (leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                    minLength={6}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
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
                      fontSize: '1rem',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#1e293b', fontWeight: '500' }}>
                    Role *
                  </label>
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
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
                    Role Description
                  </label>
                  <input
                    type="text"
                    value={formData.roleDescription}
                    onChange={(e) => setFormData({ ...formData, roleDescription: e.target.value })}
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
                    Role Classification *
                  </label>
                  <select
                    value={formData.roleClassification}
                    onChange={(e) => setFormData({ ...formData, roleClassification: e.target.value as any })}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      fontSize: '1rem',
                    }}
                  >
                    <option value="normal_staff">Normal Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="senior_executive">Senior Executive</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <span style={{ color: '#1e293b' }}>Active</span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedStaff(null);
                    }}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      background: 'white',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontWeight: '500',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={saving}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: saving ? '#94a3b8' : '#3b82f6',
                      color: 'white',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.6 : 1,
                      fontWeight: '500',
                    }}
                  >
                    {saving ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

