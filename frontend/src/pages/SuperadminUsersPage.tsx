import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Edit2, UserX, UserCheck, Mail, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  Modal,
  PageHeader,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface SuperadminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

const emptyForm = { email: '', password: '', firstName: '', lastName: '', phone: '' };

export default function SuperadminUsersPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [users, setUsers] = useState<SuperadminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingUser, setEditingUser] = useState<SuperadminUser | null>(null);
  const [confirm, setConfirm] = useState<{ user: SuperadminUser; action: 'deactivate' | 'reactivate' } | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/superadmin/users');
      setUsers(response.data.data);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }
    if (user?.role !== 'iitech_admin') {
      navigate('/dashboard', { replace: true });
      return;
    }
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const handleCreate = async () => {
    try {
      setSaving(true);
      await api.post('/superadmin/users', formData);
      toast.success('Superadmin user created');
      setModal(null);
      setFormData(emptyForm);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editingUser) return;
    try {
      setSaving(true);
      const updateData: any = {};
      if (formData.firstName !== editingUser.firstName) updateData.firstName = formData.firstName;
      if (formData.lastName !== editingUser.lastName) updateData.lastName = formData.lastName;
      if (formData.phone !== (editingUser.phone || '')) updateData.phone = formData.phone;
      if (formData.password) updateData.password = formData.password;

      await api.patch(`/superadmin/users/${editingUser.id}`, updateData);
      toast.success('User updated');
      setModal(null);
      setEditingUser(null);
      setFormData(emptyForm);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!confirm) return;
    try {
      setSaving(true);
      await api.post(`/superadmin/users/${confirm.user.id}/${confirm.action}`);
      toast.success(confirm.action === 'deactivate' ? 'User deactivated' : 'User reactivated');
      setConfirm(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (u: SuperadminUser) => {
    setEditingUser(u);
    setFormData({ email: u.email, password: '', firstName: u.firstName, lastName: u.lastName, phone: u.phone || '' });
    setModal('edit');
  };

  const userForm = (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      {modal === 'create' && (
        <>
          <Field label="Email" required>
            <TextInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
          </Field>
          <Field label="Password" required>
            <TextInput type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required autoComplete="new-password" />
          </Field>
        </>
      )}
      <div className="grid2">
        <Field label="First name" required>
          <TextInput value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} required />
        </Field>
        <Field label="Last name" required>
          <TextInput value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} required />
        </Field>
      </div>
      <Field label="Phone">
        <TextInput type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
      </Field>
      {modal === 'edit' && (
        <Field label="New password" hint="Leave blank to keep the current password">
          <TextInput type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} autoComplete="new-password" />
        </Field>
      )}
    </div>
  );

  return (
    <Layout>
      <PageHeader
        title="Platform users"
        subtitle="Superadmin accounts with platform-wide access"
        actions={
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => { setFormData(emptyForm); setModal('create'); }}>
            Create user
          </Button>
        }
      />

      <DataTable
        data={users}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchUsers}
        empty={{ title: 'No users', description: 'Create the first superadmin account.' }}
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (u: SuperadminUser) => (
              <div>
                <div style={{ fontWeight: 600 }}>{u.firstName} {u.lastName}</div>
                <div className="text-xs muted row"><Mail size={12} /> {u.email}</div>
              </div>
            ),
          },
          {
            key: 'phone',
            header: 'Phone',
            render: (u: SuperadminUser) =>
              u.phone ? <span className="text-sm muted row"><Phone size={13} /> {u.phone}</span> : <span className="muted">—</span>,
          },
          {
            key: 'isActive',
            header: 'Status',
            render: (u: SuperadminUser) => (
              <StatusBadge status={u.isActive ? 'active' : 'inactive'} dot={false}>
                {u.isActive ? 'Active' : 'Inactive'}
              </StatusBadge>
            ),
          },
          {
            key: 'lastLogin',
            header: 'Last sign-in',
            render: (u: SuperadminUser) => (
              <span className="text-sm muted">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never'}</span>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (u: SuperadminUser) => (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => openEdit(u)}>Edit</Button>
                {u.isActive ? (
                  <Button variant="ghost" size="sm" icon={<UserX size={14} />} onClick={() => setConfirm({ user: u, action: 'deactivate' })}>Deactivate</Button>
                ) : (
                  <Button variant="ghost" size="sm" icon={<UserCheck size={14} />} onClick={() => setConfirm({ user: u, action: 'reactivate' })}>Reactivate</Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <Modal
        open={modal === 'create'}
        onClose={() => setModal(null)}
        title="Create superadmin user"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate} loading={saving} disabled={!formData.email || !formData.password || !formData.firstName}>
              Create
            </Button>
          </>
        }
      >
        {userForm}
      </Modal>

      <Modal
        open={modal === 'edit'}
        onClose={() => setModal(null)}
        title={`Edit ${editingUser?.firstName} ${editingUser?.lastName}`}
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleEdit} loading={saving}>
              Save changes
            </Button>
          </>
        }
      >
        {userForm}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.action === 'deactivate' ? 'Deactivate user?' : 'Reactivate user?'}
        destructive={confirm?.action === 'deactivate'}
        confirmLabel={confirm?.action === 'deactivate' ? 'Deactivate' : 'Reactivate'}
        loading={saving}
        onConfirm={handleToggleActive}
        onClose={() => setConfirm(null)}
      >
        {confirm?.action === 'deactivate' ? (
          <p><strong>{confirm.user.firstName} {confirm.user.lastName}</strong> will lose platform access immediately.</p>
        ) : (
          <p>Restore platform access for <strong>{confirm?.user.firstName} {confirm?.user.lastName}</strong>?</p>
        )}
      </ConfirmDialog>
    </Layout>
  );
}
