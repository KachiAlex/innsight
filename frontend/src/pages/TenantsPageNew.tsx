import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Building2, Plus, Users, DoorOpen, Search, Edit, CheckCircle, RefreshCw, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  DataTable,
  ErrorState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  StatCard,
  StatusBadge,
  Stepper,
  TextInput,
  Textarea,
} from '../components/ui';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  email: string;
  phone?: string;
  address?: string;
  subscriptionStatus: string;
  createdAt: string;
  userCount?: number;
  roomsCount?: number;
  admin?: { id: string; email: string; firstName?: string; lastName?: string; role: string } | null;
  _count?: { users: number; rooms: number };
}

interface ValidationState {
  name?: string;
  slug?: string;
  email?: string;
  password?: string;
  ownerEmail?: string;
  ownerFirstName?: string;
  ownerLastName?: string;
}

const emptyForm = {
  name: '', slug: '', email: '', phone: '', address: '',
  ownerEmail: '', ownerPassword: '', ownerFirstName: '', ownerLastName: '',
};

const STEPS = [
  { key: 'details', label: 'Details' },
  { key: 'owner', label: 'Owner' },
  { key: 'review', label: 'Review' },
  { key: 'done', label: 'Done' },
];

export default function TenantsPageNew() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [createStep, setCreateStep] = useState(0);
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationState>({});
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [createdTenant, setCreatedTenant] = useState<any>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [editFormData, setEditFormData] = useState({ name: '', slug: '', email: '', phone: '', address: '' });
  const [resetTenant, setResetTenant] = useState<Tenant | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/tenants');
      setTenants(response.data?.data || []);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to fetch tenants'));
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
    fetchTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.length < 2) {
      setSlugAvailable(null);
      return;
    }
    setCheckingSlug(true);
    try {
      const response = await api.get(`/tenants/check-slug/${slug}`);
      setSlugAvailable(response.data.available);
      setValidationErrors((prev) => {
        const next = { ...prev };
        if (!response.data.available) next.slug = `Slug "${slug}" is already taken`;
        else delete next.slug;
        return next;
      });
    } catch {
      setSlugAvailable(null);
    } finally {
      setCheckingSlug(false);
    }
  };

  const validateStep = (step: number): boolean => {
    const errors: ValidationState = {};
    if (step === 0) {
      if (!formData.name.trim()) errors.name = 'Tenant name is required';
      if (!formData.slug.trim()) errors.slug = 'Slug is required';
      if (!formData.email.trim()) errors.email = 'Email is required';
      if (slugAvailable === false) errors.slug = 'This slug is already taken';
    } else if (step === 1) {
      if (!formData.ownerEmail.trim()) errors.ownerEmail = 'Owner email is required';
      if (!formData.ownerFirstName.trim()) errors.ownerFirstName = 'First name is required';
      if (!formData.ownerLastName.trim()) errors.ownerLastName = 'Last name is required';
      if (!formData.ownerPassword.trim()) errors.password = 'Password is required';
      else if (formData.ownerPassword.length < 6) errors.password = 'Password must be at least 6 characters';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep(createStep)) setCreateStep(createStep + 1);
  };

  const handleCreateTenant = async () => {
    if (!validateStep(1)) return;
    setCreateError('');
    setCreateLoading(true);
    try {
      const response = await api.post('/tenants', formData);
      setCreatedTenant(response.data.data);
      setCreateStep(3);
      toast.success('Tenant created');
      fetchTenants();
    } catch (err: any) {
      setCreateError(err.response?.data?.error?.message || 'Failed to create tenant');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleResetForm = () => {
    setFormData(emptyForm);
    setValidationErrors({});
    setSlugAvailable(null);
    setCreateStep(0);
    setCreateError('');
    setCreatedTenant(null);
  };

  const handleCloseCreateModal = () => {
    setShowCreateModal(false);
    setTimeout(handleResetForm, 300);
  };

  const handleEditTenant = (tenant: Tenant) => {
    setEditingTenant(tenant);
    setEditFormData({
      name: tenant.name,
      slug: tenant.slug,
      email: tenant.email,
      phone: tenant.phone || '',
      address: tenant.address || '',
    });
    setShowEditModal(true);
  };

  const handleUpdateTenant = async () => {
    if (!editingTenant) return;
    try {
      setEditLoading(true);
      await api.patch(`/tenants/${editingTenant.id}`, editFormData);
      toast.success('Tenant updated');
      setShowEditModal(false);
      setEditingTenant(null);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update tenant');
    } finally {
      setEditLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTenant || resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      setResetLoading(true);
      await api.post(`/tenants/${resetTenant.id}/admin/reset-password`, { newPassword: resetPassword });
      toast.success(`Password updated for ${resetTenant.admin?.email}`);
      setResetTenant(null);
      setResetPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to reset password');
    } finally {
      setResetLoading(false);
    }
  };

  const filteredTenants = tenants.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUsers = tenants.reduce((s, t) => s + (t.userCount ?? t._count?.users ?? 0), 0);
  const totalRooms = tenants.reduce((s, t) => s + (t.roomsCount ?? t._count?.rooms ?? 0), 0);

  return (
    <Layout>
      <PageHeader
        title="Provision tenants"
        subtitle="Create and configure hotels on the platform"
        actions={
          <>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchTenants} loading={loading}>Refresh</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => { handleResetForm(); setShowCreateModal(true); }}>
              Create tenant
            </Button>
          </>
        }
      />

      <div className="stats-grid">
        <StatCard label="Total tenants" value={tenants.length} icon={<Building2 size={18} />} />
        <StatCard label="Total users" value={totalUsers} icon={<Users size={18} />} />
        <StatCard label="Total rooms" value={totalRooms} icon={<DoorOpen size={18} />} />
        <StatCard label="Active" value={tenants.filter((t) => t.subscriptionStatus === 'active').length} tone="good" />
      </div>

      <FilterBar>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <TextInput placeholder="Search tenants…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
        </div>
      </FilterBar>

      <DataTable
        data={filteredTenants}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchTenants}
        empty={{
          title: 'No tenants',
          description: 'Create the first tenant to get started.',
          action: <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreateModal(true)}>Create tenant</Button>,
        }}
        columns={[
          { key: 'name', header: 'Name', render: (t: Tenant) => <span style={{ fontWeight: 600 }}>{t.name}</span> },
          { key: 'slug', header: 'Slug', render: (t: Tenant) => <code className="text-xs muted" style={{ fontFamily: 'monospace' }}>{t.slug}</code> },
          { key: 'email', header: 'Contact', render: (t: Tenant) => <span className="text-sm muted">{t.email}</span> },
          { key: 'admin', header: 'Admin', render: (t: Tenant) => (
            t.admin
              ? <span className="text-sm">{t.admin.email}<span className="text-xs muted"> · {t.admin.role.replace(/_/g, ' ')}</span></span>
              : <span className="text-sm muted">No admin</span>
          ) },
          { key: 'subscriptionStatus', header: 'Status', render: (t: Tenant) => <StatusBadge status={t.subscriptionStatus} dot={false}>{t.subscriptionStatus}</StatusBadge> },
          { key: 'users', header: 'Users', align: 'center', render: (t: Tenant) => t.userCount ?? t._count?.users ?? 0 },
          { key: 'rooms', header: 'Rooms', align: 'center', render: (t: Tenant) => t.roomsCount ?? t._count?.rooms ?? 0 },
          { key: 'createdAt', header: 'Created', render: (t: Tenant) => <span className="text-sm muted">{new Date(t.createdAt).toLocaleDateString()}</span> },
          { key: 'actions', header: '', align: 'right', render: (t: Tenant) => (
            <div className="row" style={{ gap: 'var(--space-1)', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" icon={<Edit size={14} />} onClick={() => handleEditTenant(t)}>Edit</Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<KeyRound size={14} />}
                onClick={() => { setResetTenant(t); setResetPassword(''); }}
                disabled={!t.admin}
                title={t.admin ? `Reset password for ${t.admin.email}` : 'This tenant has no admin account'}
              >
                Reset password
              </Button>
            </div>
          ) },
        ]}
      />

      <Modal open={showCreateModal} onClose={handleCloseCreateModal} title="Create tenant" width="lg">
        <Stepper steps={STEPS} current={createStep} />

        <div style={{ marginTop: 'var(--space-4)' }}>
          {createError && <ErrorState message={createError} />}

          {createStep === 0 && (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <Field label="Tenant name" required error={validationErrors.name}>
                <TextInput value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Grand Hotel" />
              </Field>
              <Field
                label="Slug"
                required
                error={validationErrors.slug}
                hint={checkingSlug ? 'Checking availability…' : slugAvailable === true ? 'Available' : undefined}
              >
                <TextInput
                  value={formData.slug}
                  onChange={(e) => {
                    const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                    setFormData({ ...formData, slug: v });
                    checkSlugAvailability(v);
                  }}
                  placeholder="e.g. grand-hotel"
                  style={{ fontFamily: 'monospace' }}
                />
              </Field>
              <Field label="Email" required error={validationErrors.email}>
                <TextInput type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </Field>
              <Field label="Phone">
                <TextInput type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </Field>
              <Field label="Address">
                <Textarea rows={2} value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
              </Field>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={handleCloseCreateModal}>Cancel</Button>
                <Button variant="primary" onClick={handleNextStep}>Next</Button>
              </div>
            </div>
          )}

          {createStep === 1 && (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <Field label="Owner email" required error={validationErrors.ownerEmail}>
                <TextInput type="email" value={formData.ownerEmail} onChange={(e) => setFormData({ ...formData, ownerEmail: e.target.value })} />
              </Field>
              <div className="grid2">
                <Field label="First name" required error={validationErrors.ownerFirstName}>
                  <TextInput value={formData.ownerFirstName} onChange={(e) => setFormData({ ...formData, ownerFirstName: e.target.value })} />
                </Field>
                <Field label="Last name" required error={validationErrors.ownerLastName}>
                  <TextInput value={formData.ownerLastName} onChange={(e) => setFormData({ ...formData, ownerLastName: e.target.value })} />
                </Field>
              </div>
              <Field
                label="Password"
                required
                error={validationErrors.password}
                hint={`Strength: ${formData.ownerPassword.length === 0 ? 'none' : formData.ownerPassword.length < 6 ? 'weak' : formData.ownerPassword.length < 12 ? 'medium' : 'strong'}`}
              >
                <TextInput type="password" value={formData.ownerPassword} onChange={(e) => setFormData({ ...formData, ownerPassword: e.target.value })} autoComplete="new-password" />
              </Field>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setCreateStep(0)}>Back</Button>
                <Button variant="primary" onClick={handleNextStep}>Review</Button>
              </div>
            </div>
          )}

          {createStep === 2 && (
            <div className="stack" style={{ gap: 'var(--space-3)' }}>
              <div style={{ background: 'var(--surface-sunken)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)' }} className="stack">
                <div className="grid2">
                  <span className="text-sm muted">Tenant</span><span className="text-sm" style={{ fontWeight: 600 }}>{formData.name}</span>
                  <span className="text-sm muted">Slug</span><code className="text-sm" style={{ fontFamily: 'monospace' }}>{formData.slug}</code>
                  <span className="text-sm muted">Email</span><span className="text-sm">{formData.email}</span>
                  <span className="text-sm muted">Owner</span><span className="text-sm">{formData.ownerFirstName} {formData.ownerLastName}</span>
                  <span className="text-sm muted">Owner email</span><span className="text-sm">{formData.ownerEmail}</span>
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="ghost" onClick={() => setCreateStep(1)}>Back</Button>
                <Button variant="primary" onClick={handleCreateTenant} loading={createLoading}>Create tenant</Button>
              </div>
            </div>
          )}

          {createStep === 3 && (
            <div className="stack" style={{ gap: 'var(--space-4)', textAlign: 'center' }}>
              <CheckCircle size={48} style={{ color: 'var(--success)', margin: '0 auto' }} />
              <div>
                <h3 style={{ margin: '0 0 var(--space-1)' }}>Tenant created</h3>
                <p className="text-sm muted" style={{ margin: 0 }}>
                  <strong>{createdTenant?.name || formData.name}</strong> is live at <code>{formData.slug}</code>
                </p>
              </div>
              <div className="row" style={{ justifyContent: 'center' }}>
                <Button variant="secondary" onClick={handleResetForm}>Create another</Button>
                <Button variant="primary" onClick={handleCloseCreateModal}>Done</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit ${editingTenant?.name || 'tenant'}`}
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEditModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdateTenant} loading={editLoading}>Save changes</Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Tenant name" required>
            <TextInput value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
          </Field>
          <Field label="Slug" hint="Changing the slug changes the public URL">
            <TextInput value={editFormData.slug} onChange={(e) => setEditFormData({ ...editFormData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} style={{ fontFamily: 'monospace' }} />
          </Field>
          <Field label="Email" required>
            <TextInput type="email" value={editFormData.email} onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })} />
          </Field>
          <Field label="Phone">
            <TextInput type="tel" value={editFormData.phone} onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })} />
          </Field>
          <Field label="Address">
            <Textarea rows={2} value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={!!resetTenant}
        onClose={() => setResetTenant(null)}
        title="Reset tenant admin password"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetTenant(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleResetPassword} loading={resetLoading} disabled={resetPassword.length < 6}>
              Reset password
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <p className="text-sm muted" style={{ margin: 0 }}>
            Sets a new password for <strong>{resetTenant?.admin?.email}</strong>. They are not notified automatically — share it securely.
          </p>
          <Field label="New password" required hint="Minimum 6 characters">
            <TextInput
              type="password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Enter new password"
            />
          </Field>
        </div>
      </Modal>
    </Layout>
  );
}
