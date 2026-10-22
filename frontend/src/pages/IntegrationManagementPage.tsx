import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Edit, Trash2, RefreshCw, Zap, CreditCard, Mail, MessageSquare, Send, BarChart3, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';

interface Integration {
  id: string;
  tenantId: string;
  name: string;
  type: 'payment' | 'email' | 'sms' | 'messaging' | 'analytics' | 'custom';
  status: 'active' | 'inactive' | 'error';
  apiKeyMasked: string;
  config: Record<string, any>;
  lastTestedAt?: string;
  createdAt: string;
}

const TYPE_ICONS: Record<string, typeof CreditCard> = {
  payment: CreditCard,
  email: Mail,
  sms: Send,
  messaging: MessageSquare,
  analytics: BarChart3,
  custom: Settings2,
};

const emptyForm = { name: '', type: 'payment' as Integration['type'], apiKey: '', config: '' };

export default function IntegrationManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Integration | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [configError, setConfigError] = useState('');

  const fetchIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/superadmin/integrations');
      setIntegrations(response.data?.data || []);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load integrations'));
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
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const handleSaveIntegration = async () => {
    if (!formData.name.trim()) {
      toast.error('Enter an integration name');
      return;
    }
    let config = {};
    if (formData.config.trim()) {
      try {
        config = JSON.parse(formData.config);
        setConfigError('');
      } catch {
        setConfigError('Config must be valid JSON');
        return;
      }
    }
    try {
      setSaving(true);
      const payload = { name: formData.name, type: formData.type, apiKey: formData.apiKey, config };
      if (editingId) {
        await api.patch(`/superadmin/integrations/${editingId}`, payload);
        toast.success('Integration updated');
      } else {
        await api.post('/superadmin/integrations', payload);
        toast.success('Integration created');
      }
      setFormData(emptyForm);
      setModal(null);
      setEditingId(null);
      fetchIntegrations();
    } catch {
      toast.error('Failed to save integration');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteIntegration = async () => {
    if (!deleting) return;
    try {
      setSaving(true);
      await api.delete(`/superadmin/integrations/${deleting.id}`);
      toast.success('Integration deleted');
      setDeleting(null);
      fetchIntegrations();
    } catch {
      toast.error('Failed to delete integration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (integrationId: string) => {
    try {
      setTesting(integrationId);
      await api.post(`/superadmin/integrations/${integrationId}/test`);
      toast.success('Connection test passed');
      fetchIntegrations();
    } catch {
      toast.error('Connection test failed');
    } finally {
      setTesting(null);
    }
  };

  const openEdit = (integration: Integration) => {
    setEditingId(integration.id);
    setFormData({
      name: integration.name,
      type: integration.type,
      apiKey: '',
      config: JSON.stringify(integration.config, null, 2),
    });
    setConfigError('');
    setModal('edit');
  };

  return (
    <Layout>
      <PageHeader
        title="Integrations"
        subtitle="Platform-level third-party connections"
        actions={
          <>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchIntegrations} loading={loading}>Refresh</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => { setEditingId(null); setFormData(emptyForm); setConfigError(''); setModal('create'); }}>
              New integration
            </Button>
          </>
        }
      />

      <DataTable
        data={integrations}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchIntegrations}
        empty={{ title: 'No integrations', description: 'Connect payments, messaging, or analytics providers.' }}
        columns={[
          { key: 'name', header: 'Integration', render: (i: Integration) => {
            const Icon = TYPE_ICONS[i.type] || Settings2;
            return (
              <span className="row">
                <Icon size={16} style={{ color: 'var(--teal-700)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>{i.name}</div>
                  <div className="text-xs muted" style={{ textTransform: 'capitalize' }}>{i.type}</div>
                </div>
              </span>
            );
          } },
          { key: 'status', header: 'Status', render: (i: Integration) => <StatusBadge status={i.status} dot={false}>{i.status}</StatusBadge> },
          { key: 'apiKeyMasked', header: 'Key', render: (i: Integration) => <code className="text-xs muted" style={{ fontFamily: 'monospace' }}>{i.apiKeyMasked}</code> },
          { key: 'lastTestedAt', header: 'Last tested', render: (i: Integration) => <span className="text-sm muted">{i.lastTestedAt ? new Date(i.lastTestedAt).toLocaleString() : 'Never'}</span> },
          { key: 'actions', header: '', align: 'right', render: (i: Integration) => (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" icon={<Zap size={14} />} onClick={() => handleTestConnection(i.id)} loading={testing === i.id}>Test</Button>
              <Button variant="ghost" size="sm" icon={<Edit size={14} />} onClick={() => openEdit(i)}>Edit</Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleting(i)}>Delete</Button>
            </div>
          ) },
        ]}
      />

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Edit integration' : 'New integration'}
        width="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveIntegration} loading={saving} disabled={!formData.name.trim()}>
              {modal === 'edit' ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Integration name" required>
            <TextInput placeholder="e.g. Paystack production" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </Field>
          <Field label="Type">
            <Select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value as Integration['type'] })}>
              <option value="payment">Payment</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="messaging">Messaging</option>
              <option value="analytics">Analytics</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <Field label="API key" hint={modal === 'edit' ? 'Leave blank to keep the current key' : undefined}>
            <TextInput type="password" value={formData.apiKey} onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })} autoComplete="off" />
          </Field>
          <Field label="Configuration (JSON)" error={configError || undefined}>
            <Textarea rows={5} value={formData.config} onChange={(e) => setFormData({ ...formData, config: e.target.value })} placeholder='{"key": "value"}' style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete integration?"
        destructive
        confirmLabel="Delete"
        loading={saving}
        onConfirm={handleDeleteIntegration}
        onClose={() => setDeleting(null)}
      >
        <p><strong>{deleting?.name}</strong> will be removed and can no longer process requests.</p>
      </ConfirmDialog>
    </Layout>
  );
}
