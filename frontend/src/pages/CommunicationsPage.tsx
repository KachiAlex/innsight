import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useIsAuthenticated } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Mail, Plus, Edit2, Trash2, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Select,
  StatCard,
  StatusBadge,
  TextInput,
  Textarea,
} from '../components/ui';

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  category: 'booking' | 'cancellation' | 'reminder' | 'feedback' | 'other';
  body: string;
  variables: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommunicationsMetrics {
  emailsSent: number;
  emailOpenRate: number;
  smsDeliveryRate: number;
  templates: number;
  activeTemplates: number;
}

const emptyForm = { name: '', subject: '', category: 'booking', body: '' };

export default function CommunicationsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAuthenticated = useIsAuthenticated();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [metrics, setMetrics] = useState<CommunicationsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [deleting, setDeleting] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [templatesRes, metricsRes] = await Promise.all([
        api.get('/superadmin/communications/templates'),
        api.get('/superadmin/communications/metrics'),
      ]);
      setTemplates(templatesRes.data?.data || []);
      setMetrics(metricsRes.data?.data || null);
    } catch (err: any) {
      setError(new Error(err.response?.data?.error?.message || 'Failed to load communications'));
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
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAuthenticated, navigate]);

  const handleSaveTemplate = async () => {
    if (!formData.name.trim() || !formData.subject.trim() || !formData.body.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      setSaving(true);
      if (modal === 'edit' && selectedTemplate) {
        await api.patch(`/superadmin/communications/templates/${selectedTemplate.id}`, formData);
        toast.success('Template updated');
      } else {
        await api.post('/superadmin/communications/templates', formData);
        toast.success('Template created');
      }
      setModal(null);
      setSelectedTemplate(null);
      setFormData(emptyForm);
      fetchData();
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deleting) return;
    try {
      setSaving(true);
      await api.delete(`/superadmin/communications/templates/${deleting.id}`);
      toast.success('Template deleted');
      setDeleting(null);
      fetchData();
    } catch {
      toast.error('Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
      <PageHeader
        title="Communications"
        subtitle="Email templates used across tenant workflows"
        actions={
          <>
            <Button variant="ghost" icon={<RefreshCw size={15} />} onClick={fetchData} loading={loading}>Refresh</Button>
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => { setSelectedTemplate(null); setFormData(emptyForm); setModal('create'); }}>
              New template
            </Button>
          </>
        }
      />

      {metrics && (
        <div className="stats-grid">
          <StatCard label="Emails sent" value={metrics.emailsSent} icon={<Mail size={18} />} />
          <StatCard label="Open rate" value={`${metrics.emailOpenRate}%`} tone="good" />
          <StatCard label="SMS delivery" value={`${metrics.smsDeliveryRate}%`} />
          <StatCard label="Templates" value={metrics.templates} />
          <StatCard label="Active" value={metrics.activeTemplates} />
        </div>
      )}

      <FilterBar>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <TextInput placeholder="Search templates…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
        </div>
      </FilterBar>

      <DataTable
        data={filteredTemplates}
        rowKey={(row) => row.id}
        loading={loading}
        error={error}
        onRetry={fetchData}
        empty={{ title: 'No templates', description: 'Create email templates for tenant notifications.' }}
        columns={[
          { key: 'name', header: 'Template', render: (t: EmailTemplate) => (
            <div>
              <div style={{ fontWeight: 600 }}>{t.name}</div>
              <div className="text-xs muted">{t.subject}</div>
            </div>
          ) },
          { key: 'category', header: 'Category', render: (t: EmailTemplate) => <StatusBadge status={t.category} dot={false}>{t.category}</StatusBadge> },
          { key: 'active', header: 'Status', render: (t: EmailTemplate) => <StatusBadge status={t.active ? 'active' : 'inactive'} dot={false}>{t.active ? 'Active' : 'Inactive'}</StatusBadge> },
          { key: 'updatedAt', header: 'Updated', render: (t: EmailTemplate) => <span className="text-sm muted">{new Date(t.updatedAt).toLocaleDateString()}</span> },
          { key: 'actions', header: '', align: 'right', render: (t: EmailTemplate) => (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" icon={<Edit2 size={14} />} onClick={() => {
                setSelectedTemplate(t);
                setFormData({ name: t.name, subject: t.subject, category: t.category, body: t.body });
                setModal('edit');
              }}>Edit</Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleting(t)}>Delete</Button>
            </div>
          ) },
        ]}
      />

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? `Edit ${selectedTemplate?.name}` : 'Create template'}
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveTemplate} loading={saving}>
              {modal === 'edit' ? 'Update' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Template name" required>
            <TextInput placeholder="e.g. Booking confirmation" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
          </Field>
          <Field label="Email subject" required>
            <TextInput placeholder="e.g. Your booking is confirmed" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
          </Field>
          <Field label="Category">
            <Select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}>
              <option value="booking">Booking</option>
              <option value="cancellation">Cancellation</option>
              <option value="reminder">Reminder</option>
              <option value="feedback">Feedback</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Email body" required hint="Template variables are supported — e.g. {{guestName}}">
            <Textarea rows={8} value={formData.body} onChange={(e) => setFormData({ ...formData, body: e.target.value })} placeholder="Enter the email template content…" />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete template?"
        destructive
        confirmLabel="Delete"
        loading={saving}
        onConfirm={handleDeleteTemplate}
        onClose={() => setDeleting(null)}
      >
        <p><strong>{deleting?.name}</strong> will be permanently removed. Tenants using this template will fall back to defaults.</p>
      </ConfirmDialog>
    </Layout>
  );
}
