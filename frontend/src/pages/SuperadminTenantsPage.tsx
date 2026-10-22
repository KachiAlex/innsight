import { useCallback, useEffect, useState } from 'react';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Search, Eye, Ban, CheckCircle, Users, Building, Calendar, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Pagination from '../components/Pagination';
import {
  Button,
  ConfirmDialog,
  DataTable,
  FilterBar,
  PageHeader,
  Select,
  StatusBadge,
  TextInput,
} from '../components/ui';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  slug: string;
  subscriptionStatus: 'active' | 'suspended' | 'trial' | 'inactive';
  createdAt: string;
  _count: { users: number; rooms: number };
}

const LIMIT = 20;

export default function SuperadminTenantsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirm, setConfirm] = useState<{ tenant: Tenant; status: 'active' | 'suspended' } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ page: page.toString(), limit: LIMIT.toString() });
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const response = await api.get(`/superadmin/tenants?${params}`);
      const data = response.data.data;
      setTenants(data.tenants);
      setTotal(data.pagination.total);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load tenants'));
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

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
  }, [user, isAuthenticated, navigate, page, statusFilter]);

  const updateTenantStatus = async () => {
    if (!confirm) return;
    try {
      setActionLoading(true);
      await api.patch(`/superadmin/tenants/${confirm.tenant.id}/status`, { status: confirm.status });
      toast.success(`Tenant ${confirm.status === 'suspended' ? 'suspended' : 'activated'}`);
      setConfirm(null);
      fetchTenants();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to update tenant status');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Hotels & tenants"
        subtitle={`${total} tenants on the platform`}
        actions={
          <Button variant="secondary" icon={<Settings2 size={15} />} onClick={() => navigate('/tenants')}>
            Tenant provisioning
          </Button>
        }
      />

      <FilterBar>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <TextInput
              placeholder="Search name, email, or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchTenants())}
              style={{ paddingLeft: 32 }}
            />
          </div>
        </div>
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          style={{ width: 170 }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="inactive">Inactive</option>
        </Select>
        <Button variant="secondary" onClick={() => { setPage(1); fetchTenants(); }} loading={loading}>
          Search
        </Button>
      </FilterBar>

      <DataTable
        data={tenants}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchTenants}
        empty={{
          title: 'No tenants found',
          description: search || statusFilter ? 'Try widening your filters.' : 'Tenants appear here once provisioned.',
        }}
        columns={[
          {
            key: 'name',
            header: 'Tenant',
            render: (t: Tenant) => (
              <div>
                <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--teal-700)' }} onClick={() => navigate(`/superadmin/tenants/${t.id}`)}>{t.name}</div>
                <div className="text-xs muted">{t.email} · {t.slug}</div>
              </div>
            ),
          },
          {
            key: 'subscriptionStatus',
            header: 'Subscription',
            render: (t: Tenant) => <StatusBadge status={t.subscriptionStatus} dot={false}>{t.subscriptionStatus}</StatusBadge>,
          },
          {
            key: 'usage',
            header: 'Usage',
            render: (t: Tenant) => (
              <span className="text-sm muted row">
                <Users size={13} /> {t._count.users}
                <Building size={13} style={{ marginLeft: 6 }} /> {t._count.rooms}
              </span>
            ),
          },
          {
            key: 'createdAt',
            header: 'Created',
            render: (t: Tenant) => (
              <span className="text-sm muted row">
                <Calendar size={13} />
                {new Date(t.createdAt).toLocaleDateString()}
              </span>
            ),
          },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: (t: Tenant) => (
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => navigate(`/superadmin/tenants/${t.id}`)}>
                  View
                </Button>
                {t.subscriptionStatus === 'active' && (
                  <Button variant="ghost" size="sm" icon={<Ban size={14} />} onClick={() => setConfirm({ tenant: t, status: 'suspended' })}>
                    Suspend
                  </Button>
                )}
                {t.subscriptionStatus === 'suspended' && (
                  <Button variant="ghost" size="sm" icon={<CheckCircle size={14} />} onClick={() => setConfirm({ tenant: t, status: 'active' })}>
                    Activate
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <Pagination page={page} limit={LIMIT} total={total} totalPages={Math.ceil(total / LIMIT)} onPageChange={setPage} />

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.status === 'suspended' ? 'Suspend tenant?' : 'Activate tenant?'}
        destructive={confirm?.status === 'suspended'}
        confirmLabel={confirm?.status === 'suspended' ? 'Suspend' : 'Activate'}
        loading={actionLoading}
        onConfirm={updateTenantStatus}
        onClose={() => setConfirm(null)}
      >
        {confirm?.status === 'suspended' ? (
          <p>
            <strong>{confirm.tenant.name}</strong> will lose access to the platform immediately.
            Staff will not be able to sign in until the tenant is reactivated.
          </p>
        ) : (
          <p>
            Restore <strong>{confirm?.tenant.name}</strong>'s access to the platform?
          </p>
        )}
      </ConfirmDialog>
    </Layout>
  );
}
