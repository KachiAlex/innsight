import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Pencil, Ban, Clock } from 'lucide-react';
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

interface Shift {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  shiftType: string;
  cashFloat?: number | null;
  cashReceived?: number | null;
  cashCounted?: number | null;
  variance?: number | null;
  status: string;
  notes?: string;
  user: { firstName: string; lastName: string; email: string };
}

const SHIFT_TYPES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'night', label: 'Night' },
];

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

  // Shifts tab
  const [activeTab, setActiveTab] = useState<'staff' | 'shifts'>('staff');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [shiftStatusFilter, setShiftStatusFilter] = useState('');
  const [openShiftModal, setOpenShiftModal] = useState(false);
  const [closeShiftTarget, setCloseShiftTarget] = useState<Shift | null>(null);
  const [shiftForm, setShiftForm] = useState({ userId: '', shiftType: 'morning', cashFloat: '' });
  const [closeForm, setCloseForm] = useState({ cashReceived: '', cashCounted: '', notes: '' });
  const [shiftSaving, setShiftSaving] = useState(false);

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

  const fetchShifts = useCallback(async () => {
    if (!user?.tenantId) return;
    setShiftsLoading(true);
    try {
      const params: any = {};
      if (shiftStatusFilter) params.status = shiftStatusFilter;
      const response = await api.get(`/tenants/${user.tenantId}/shifts`, { params });
      setShifts(response.data.data || []);
    } catch {
      toast.error('Failed to load shifts');
      setShifts([]);
    } finally {
      setShiftsLoading(false);
    }
  }, [user?.tenantId, shiftStatusFilter]);

  useEffect(() => {
    if (activeTab === 'shifts') fetchShifts();
  }, [activeTab, fetchShifts]);

  const handleOpenShift = async () => {
    if (!shiftForm.userId) {
      toast.error('Select a staff member');
      return;
    }
    setShiftSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/shifts`, {
        userId: shiftForm.userId,
        shiftType: shiftForm.shiftType,
        ...(shiftForm.cashFloat && { cashFloat: Number(shiftForm.cashFloat) }),
      });
      toast.success('Shift opened');
      setOpenShiftModal(false);
      setShiftForm({ userId: '', shiftType: 'morning', cashFloat: '' });
      fetchShifts();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to open shift');
    } finally {
      setShiftSaving(false);
    }
  };

  const handleCloseShift = async () => {
    if (!closeShiftTarget) return;
    setShiftSaving(true);
    try {
      await api.post(`/tenants/${user?.tenantId}/shifts/${closeShiftTarget.id}/close`, {
        ...(closeForm.cashReceived && { cashReceived: Number(closeForm.cashReceived) }),
        ...(closeForm.cashCounted && { cashCounted: Number(closeForm.cashCounted) }),
        ...(closeForm.notes && { notes: closeForm.notes }),
      });
      toast.success('Shift closed');
      setCloseShiftTarget(null);
      setCloseForm({ cashReceived: '', cashCounted: '', notes: '' });
      fetchShifts();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to close shift');
    } finally {
      setShiftSaving(false);
    }
  };

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

  const shiftColumns: Column<Shift>[] = [
    {
      key: 'staff',
      header: 'Staff member',
      render: (s) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
            {s.user.firstName} {s.user.lastName}
          </div>
          <div className="text-sm muted">{s.user.email}</div>
        </div>
      ),
    },
    {
      key: 'shiftType',
      header: 'Shift',
      render: (s) => (
        <StatusBadge tone="info" dot={false}>
          {s.shiftType.charAt(0).toUpperCase() + s.shiftType.slice(1)}
        </StatusBadge>
      ),
    },
    {
      key: 'startTime',
      header: 'Started',
      render: (s) => new Date(s.startTime).toLocaleString(),
    },
    {
      key: 'endTime',
      header: 'Ended',
      render: (s) => (s.endTime ? new Date(s.endTime).toLocaleString() : '—'),
    },
    {
      key: 'cashFloat',
      header: 'Float',
      render: (s) => (s.cashFloat != null ? `₦${Number(s.cashFloat).toLocaleString()}` : '—'),
    },
    {
      key: 'variance',
      header: 'Variance',
      render: (s) =>
        s.variance != null ? (
          <span style={{ color: Math.abs(Number(s.variance)) > 0 ? 'var(--danger)' : 'inherit' }}>
            ₦{Number(s.variance).toLocaleString()}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s) => (
        <StatusBadge tone={s.status === 'open' ? 'warning' : 'neutral'} dot={false}>
          {s.status === 'open' ? 'Open' : 'Closed'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '1%',
      align: 'right',
      render: (s) =>
        s.status === 'open' ? (
          <Button
            variant="ghost"
            size="sm"
            icon={<Clock size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              setCloseShiftTarget(s);
            }}
          >
            Close shift
          </Button>
        ) : null,
    },
  ];

  const activeFilterCount = (filterRole ? 1 : 0) + (filterActive ? 1 : 0);
  const openShiftCount = shifts.filter((s) => s.status === 'open').length;

  return (
    <Layout>
      <PageHeader
        title="Staff & Shifts"
        subtitle={
          activeTab === 'staff'
            ? `${staff.filter((s) => s.isActive).length} active · ${staff.length} total`
            : `${openShiftCount} open · ${shifts.length} total`
        }
        actions={
          activeTab === 'staff' ? (
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => {
              setFormData(EMPTY_FORM);
              setEditingStaff('new');
            }}>
              Add staff
            </Button>
          ) : (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setOpenShiftModal(true)}
            >
              Open shift
            </Button>
          )
        }
      />

      <div className="tabs" role="tablist" style={{ marginBottom: 'var(--space-5)' }}>
        {(['staff', 'shifts'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={activeTab === t}
            className={`tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'staff' ? 'Staff' : 'Shifts'}
          </button>
        ))}
      </div>

      {activeTab === 'staff' && (
      <>
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
      </>
      )}

      {activeTab === 'shifts' && (
        <>
          <FilterBar
            activeCount={shiftStatusFilter ? 1 : 0}
            onClear={() => setShiftStatusFilter('')}
          >
            <Select
              value={shiftStatusFilter}
              onChange={(e) => setShiftStatusFilter(e.target.value)}
              aria-label="Filter by shift status"
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </Select>
          </FilterBar>

          <DataTable<Shift>
            columns={shiftColumns}
            data={shifts}
            rowKey={(s) => s.id}
            loading={shiftsLoading}
            onRetry={fetchShifts}
            empty={{
              title: 'No shifts found',
              description:
                shiftStatusFilter
                  ? 'No shifts match this filter'
                  : 'Open the first shift to start tracking staff hours and cash floats',
              action: !shiftStatusFilter ? (
                <Button variant="primary" onClick={() => setOpenShiftModal(true)}>
                  Open shift
                </Button>
              ) : undefined,
            }}
          />
        </>
      )}

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

      {/* Open shift */}
      <Modal
        open={openShiftModal}
        onClose={() => setOpenShiftModal(false)}
        title="Open a shift"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpenShiftModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={shiftSaving} onClick={handleOpenShift}>
              Open shift
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Staff member" required>
            <Select
              value={shiftForm.userId}
              onChange={(e) => setShiftForm({ ...shiftForm, userId: e.target.value })}
            >
              <option value="">Select staff…</option>
              {staff
                .filter((s) => s.isActive)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} — {roleLabel(s.role)}
                  </option>
                ))}
            </Select>
          </Field>
          <div className="grid2">
            <Field label="Shift" required>
              <Select
                value={shiftForm.shiftType}
                onChange={(e) => setShiftForm({ ...shiftForm, shiftType: e.target.value })}
              >
                {SHIFT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cash float (₦)" hint="Starting cash in the till">
              <TextInput
                type="number"
                min={0}
                value={shiftForm.cashFloat}
                onChange={(e) => setShiftForm({ ...shiftForm, cashFloat: e.target.value })}
                placeholder="0"
              />
            </Field>
          </div>
        </div>
      </Modal>

      {/* Close shift */}
      <Modal
        open={!!closeShiftTarget}
        onClose={() => setCloseShiftTarget(null)}
        title={`Close ${closeShiftTarget?.shiftType ?? ''} shift — ${closeShiftTarget?.user.firstName ?? ''}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseShiftTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={shiftSaving} onClick={handleCloseShift}>
              Close shift
            </Button>
          </>
        }
      >
        <div className="stack">
          <div className="grid2">
            <Field label="Cash received (₦)" hint="Payments taken during the shift">
              <TextInput
                type="number"
                min={0}
                value={closeForm.cashReceived}
                onChange={(e) => setCloseForm({ ...closeForm, cashReceived: e.target.value })}
              />
            </Field>
            <Field label="Cash counted (₦)" hint="Actual cash in the till now">
              <TextInput
                type="number"
                min={0}
                value={closeForm.cashCounted}
                onChange={(e) => setCloseForm({ ...closeForm, cashCounted: e.target.value })}
              />
            </Field>
          </div>
          {closeShiftTarget?.cashFloat != null && (
            <p className="text-sm muted" style={{ margin: 0 }}>
              Opening float: ₦{Number(closeShiftTarget.cashFloat).toLocaleString()}
            </p>
          )}
          <Field label="Notes">
            <TextInput
              value={closeForm.notes}
              onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })}
              placeholder="Handover notes, discrepancies…"
            />
          </Field>
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
