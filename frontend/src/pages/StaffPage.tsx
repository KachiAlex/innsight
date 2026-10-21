import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Pencil, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import {
  Button,
  Column,
  ConfirmDialog,
  DataTable,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface Staff {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

const STAFF_ROLES: { value: string; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'general_manager', label: 'General Manager' },
  { value: 'front_desk', label: 'Front Desk' },
  { value: 'housekeeping_supervisor', label: 'Housekeeping Supervisor' },
  { value: 'housekeeping_staff', label: 'Housekeeping Staff' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'accountant', label: 'Accountant' },
];

const roleLabel = (role: string) =>
  STAFF_ROLES.find((r) => r.value === role)?.label ?? role.replace(/_/g, ' ');

interface FormState {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  phone: '',
  role: 'front_desk',
  isActive: true,
};

export default function StaffPage() {
  const { user } = useAuthStore();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [editingStaff, setEditingStaff] = useState<Staff | 'new' | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Staff | null>(null);

  const fetchStaff = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const params: any = {};
      if (filterRole) params.role = filterRole;
      if (filterActive) params.isActive = filterActive;
      if (debouncedSearchTerm) params.search = debouncedSearchTerm;
      const response = await api.get(`/tenants/${user.tenantId}/staff`, { params });
      setStaff(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filterRole, filterActive, debouncedSearchTerm]);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const openEdit = (member: Staff) => {
    setFormData({
      email: member.email,
      password: '',
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone || '',
      role: member.role,
      isActive: member.isActive,
    });
    setEditingStaff(member);
  };

  const handleSave = async () => {
    if (!formData.firstName || !formData.lastName || !formData.role) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (editingStaff === 'new' && (!formData.email || !formData.password)) {
      toast.error('Email and password are required for new staff');
      return;
    }
    setSaving(true);
    try {
      if (editingStaff === 'new') {
        const { isActive: _i, ...payload } = formData;
        await api.post(`/tenants/${user?.tenantId}/staff`, payload);
        toast.success('Staff member created');
      } else if (editingStaff) {
        const payload: any = { ...formData };
        if (!payload.password) delete payload.password;
        await api.patch(`/tenants/${user?.tenantId}/staff/${editingStaff.id}`, payload);
        toast.success('Staff member updated');
      }
      setEditingStaff(null);
      setFormData(EMPTY_FORM);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      await api.delete(`/tenants/${user?.tenantId}/staff/${deactivateTarget.id}`);
      toast.success('Staff member deactivated');
      setDeactivateTarget(null);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to deactivate staff member');
    } finally {
      setDeactivating(false);
    }
  };

  const columns: Column<Staff>[] = [
    {
      key: 'name',
      header: 'Staff member',
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
            {s.firstName} {s.lastName}
          </div>
          <div className="text-sm muted">{s.email}</div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (s) => s.phone || '—',
    },
    {
      key: 'role',
      header: 'Role',
      render: (s) => (
        <StatusBadge tone={s.role === 'owner' || s.role === 'general_manager' ? 'info' : 'neutral'}>
          {roleLabel(s.role)}
        </StatusBadge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <StatusBadge tone={s.isActive ? 'success' : 'neutral'} dot={false}>
          {s.isActive ? 'Active' : 'Inactive'}
        </StatusBadge>
      ),
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      render: (s) => (s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'Never'),
    },
    {
      key: 'actions',
      header: '',
      width: '1%',
      align: 'right',
      render: (s) => (
        <div className="row" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => openEdit(s)}>
            Edit
          </Button>
          {s.isActive && (
            <Button variant="ghost" size="sm" icon={<Ban size={14} />} onClick={() => setDeactivateTarget(s)}>
              Deactivate
            </Button>
          )}
        </div>
      ),
    },
  ];

  const activeFilterCount = (filterRole ? 1 : 0) + (filterActive ? 1 : 0);

  return (
    <Layout>
      <PageHeader
        title="Staff"
        subtitle={`${staff.filter((s) => s.isActive).length} active · ${staff.length} total`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => {
            setFormData(EMPTY_FORM);
            setEditingStaff('new');
          }}>
            Add staff
          </Button>
        }
      />

      <FilterBar
        search={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search staff…"
        activeCount={activeFilterCount}
        onClear={() => {
          setFilterRole('');
          setFilterActive('');
        }}
      >
        <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} aria-label="Filter by role">
          <option value="">All roles</option>
          {STAFF_ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </Select>
        <Select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </Select>
      </FilterBar>

      <DataTable<Staff>
        columns={columns}
        data={staff}
        rowKey={(s) => s.id}
        loading={loading}
        error={error ? { message: error } : undefined}
        onRetry={fetchStaff}
        onRowClick={openEdit}
        empty={{
          title: 'No staff found',
          description:
            debouncedSearchTerm || activeFilterCount > 0
              ? 'Try adjusting your search or filters'
              : 'Add your first staff member to get started',
          action:
            !debouncedSearchTerm && activeFilterCount === 0 ? (
              <Button variant="primary" onClick={() => setEditingStaff('new')}>
                Add staff
              </Button>
            ) : undefined,
        }}
      />

      <Modal
        open={editingStaff !== null}
        onClose={() => setEditingStaff(null)}
        title={editingStaff === 'new' ? 'Add staff member' : `Edit ${editingStaff?.firstName ?? 'staff member'}`}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingStaff(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editingStaff === 'new' ? 'Create account' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="grid2">
            <Field label="First name" required>
              <TextInput
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </Field>
            <Field label="Last name" required>
              <TextInput
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Email" required={editingStaff === 'new'}>
            <TextInput
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={editingStaff !== 'new'}
            />
          </Field>
          <Field
            label={editingStaff === 'new' ? 'Password' : 'Reset password'}
            required={editingStaff === 'new'}
            hint={editingStaff === 'new' ? 'Minimum 6 characters' : 'Leave blank to keep the current password'}
          >
            <TextInput
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="••••••••"
            />
          </Field>
          <div className="grid2">
            <Field label="Phone">
              <TextInput
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </Field>
            <Field label="Role" required>
              <Select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                {STAFF_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {editingStaff !== 'new' && (
            <label className="row text-sm" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              />
              Active account
            </label>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="Deactivate staff member"
        confirmLabel="Deactivate"
        loading={deactivating}
        destructive
      >
        {deactivateTarget && (
          <>
            Deactivate <strong>{deactivateTarget.firstName} {deactivateTarget.lastName}</strong>? They will
            immediately lose access to the system. You can reactivate their account later.
          </>
        )}
      </ConfirmDialog>
    </Layout>
  );
}
