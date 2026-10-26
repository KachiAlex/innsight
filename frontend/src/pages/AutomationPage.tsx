import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
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

interface ConditionRow {
  field: string;
  op: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: string;
}

interface ActionRow {
  type: string;
  params: string;
}

interface Rule {
  id: string;
  ruleName: string;
  ruleType: string;
  triggerEvent: string;
  conditions?: ConditionRow[] | Record<string, unknown> | null;
  actions?: ActionRow[] | Record<string, unknown> | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  creator?: { firstName: string; lastName: string };
}

interface Meta {
  ruleTypes: string[];
  triggerEvents: string[];
}

const OPERATORS = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
];

const ACTION_PRESETS = [
  'send_notification',
  'create_housekeeping_task',
  'create_maintenance_ticket',
  'apply_charge',
  'assign_staff',
  'update_room_status',
];

const EVENT_LABELS: Record<string, string> = {
  'reservation.created': 'Reservation created',
  'reservation.checked_in': 'Guest checked in',
  'reservation.checked_out': 'Guest checked out',
  'reservation.cancelled': 'Reservation cancelled',
  'payment.completed': 'Payment completed',
  'payment.failed': 'Payment failed',
  'room.status_changed': 'Room status changed',
  'scheduled.daily': 'Daily (scheduled)',
};

const TYPE_LABELS: Record<string, string> = {
  housekeeping: 'Housekeeping',
  notification: 'Notification',
  reservation: 'Reservation',
  payment: 'Payment',
  maintenance: 'Maintenance',
};

const EMPTY_FORM = {
  ruleName: '',
  ruleType: 'housekeeping',
  triggerEvent: 'reservation.created',
  priority: '0',
  isActive: true,
};

export default function AutomationPage() {
  const { user } = useAuthStore();
  const [rules, setRules] = useState<Rule[]>([]);
  const [meta, setMeta] = useState<Meta>({ ruleTypes: [], triggerEvents: [] });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rule | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (filterType) params.ruleType = filterType;
      if (filterActive) params.isActive = filterActive;
      const [rulesRes, metaRes] = await Promise.all([
        api.get(`/tenants/${user.tenantId}/automation/rules`, { params }),
        api.get(`/tenants/${user.tenantId}/automation/meta`),
      ]);
      setRules(rulesRes.data.data || []);
      setMeta(metaRes.data.data);
    } catch {
      toast.error('Failed to load automation rules');
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filterType, filterActive]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openEdit = (rule: Rule | 'new') => {
    if (rule === 'new') {
      setForm(EMPTY_FORM);
      setConditions([]);
      setActions([]);
    } else {
      setForm({
        ruleName: rule.ruleName,
        ruleType: rule.ruleType,
        triggerEvent: rule.triggerEvent,
        priority: String(rule.priority ?? 0),
        isActive: rule.isActive,
      });
      setConditions(Array.isArray(rule.conditions) ? (rule.conditions as ConditionRow[]) : []);
      setActions(
        Array.isArray(rule.actions)
          ? (rule.actions as ActionRow[]).map((a) => ({
              type: a.type ?? '',
              params: typeof a.params === 'string' ? a.params : JSON.stringify(a.params ?? {}, null, 2),
            }))
          : []
      );
    }
    setEditing(rule);
  };

  const handleSubmit = async () => {
    if (!form.ruleName.trim()) {
      toast.error('Rule name is required');
      return;
    }
    const parsedActions = [];
    for (const a of actions) {
      if (!a.type.trim()) continue;
      let params: unknown = {};
      if (a.params.trim()) {
        try {
          params = JSON.parse(a.params);
        } catch {
          toast.error(`Invalid JSON in action "${a.type}" params`);
          return;
        }
      }
      parsedActions.push({ type: a.type.trim(), params });
    }
    const payload = {
      ruleName: form.ruleName.trim(),
      ruleType: form.ruleType,
      triggerEvent: form.triggerEvent,
      priority: Number(form.priority) || 0,
      isActive: form.isActive,
      conditions: conditions.filter((c) => c.field.trim()),
      actions: parsedActions,
    };

    setSaving(true);
    try {
      if (editing === 'new') {
        await api.post(`/tenants/${user?.tenantId}/automation/rules`, payload);
        toast.success('Rule created');
      } else if (editing) {
        await api.patch(`/tenants/${user?.tenantId}/automation/rules/${editing.id}`, payload);
        toast.success('Rule updated');
      }
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (rule: Rule) => {
    try {
      await api.patch(`/tenants/${user?.tenantId}/automation/rules/${rule.id}`, {
        isActive: !rule.isActive,
      });
      toast.success(rule.isActive ? 'Rule disabled' : 'Rule enabled');
      fetchData();
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/tenants/${user?.tenantId}/automation/rules/${deleteTarget.id}`);
      toast.success('Rule deleted');
      setDeleteTarget(null);
      fetchData();
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const summarizeList = (value: Rule['conditions'] | Rule['actions']) => {
    if (!value) return '—';
    if (Array.isArray(value)) return `${value.length} configured`;
    return `${Object.keys(value).length} configured`;
  };

  const columns: Column<Rule>[] = [
    {
      key: 'rule',
      header: 'Rule',
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text)' }}>{r.ruleName}</div>
          <div className="text-sm muted">
            {TYPE_LABELS[r.ruleType] ?? r.ruleType}
            {r.creator && ` · by ${r.creator.firstName} ${r.creator.lastName}`}
          </div>
        </div>
      ),
    },
    {
      key: 'trigger',
      header: 'When',
      render: (r) => (
        <StatusBadge tone="info" dot={false}>
          {EVENT_LABELS[r.triggerEvent] ?? r.triggerEvent}
        </StatusBadge>
      ),
    },
    {
      key: 'conditions',
      header: 'Conditions',
      render: (r) => summarizeList(r.conditions),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => summarizeList(r.actions),
    },
    {
      key: 'priority',
      header: 'Priority',
      width: '1%',
      align: 'center',
      render: (r) => r.priority,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <StatusBadge tone={r.isActive ? 'success' : 'neutral'} dot={false}>
          {r.isActive ? 'Active' : 'Disabled'}
        </StatusBadge>
      ),
    },
    {
      key: 'actions2',
      header: '',
      width: '1%',
      align: 'right',
      render: (r) => (
        <div className="row" style={{ justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleToggleActive(r); }}>
            {r.isActive ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={(e) => { e.stopPropagation(); setDeleteTarget(r); }}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  const activeFilterCount = (filterType ? 1 : 0) + (filterActive ? 1 : 0);

  return (
    <Layout>
      <PageHeader
        title="Automation"
        subtitle={`${rules.filter((r) => r.isActive).length} active rules`}
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => openEdit('new')}>
            New rule
          </Button>
        }
      />

      <FilterBar
        activeCount={activeFilterCount}
        onClear={() => {
          setFilterType('');
          setFilterActive('');
        }}
      >
        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by type">
          <option value="">All types</option>
          {meta.ruleTypes.map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
          ))}
        </Select>
        <Select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </Select>
      </FilterBar>

      <DataTable<Rule>
        columns={columns}
        data={rules}
        rowKey={(r) => r.id}
        loading={loading}
        onRetry={fetchData}
        empty={{
          title: 'No automation rules',
          description:
            activeFilterCount > 0
              ? 'No rules match the current filters'
              : 'Create rules that react to events like check-ins, payments, and room status changes',
          action: activeFilterCount === 0 ? (
            <Button variant="primary" onClick={() => openEdit('new')}>New rule</Button>
          ) : undefined,
        }}
      />

      {/* Create / edit */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New automation rule' : 'Edit rule'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>
              {editing === 'new' ? 'Create rule' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field label="Rule name" required>
            <TextInput
              value={form.ruleName}
              onChange={(e) => setForm({ ...form, ruleName: e.target.value })}
              placeholder="e.g. Dirty room after checkout"
            />
          </Field>
          <div className="grid2">
            <Field label="Type" required>
              <Select value={form.ruleType} onChange={(e) => setForm({ ...form, ruleType: e.target.value })}>
                {meta.ruleTypes.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Trigger event" required>
              <Select value={form.triggerEvent} onChange={(e) => setForm({ ...form, triggerEvent: e.target.value })}>
                {meta.triggerEvents.map((ev) => (
                  <option key={ev} value={ev}>{EVENT_LABELS[ev] ?? ev}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid2">
            <Field label="Priority" hint="Higher runs first">
              <TextInput
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </Field>
            <Field label="Status">
              <Select
                value={form.isActive ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
              >
                <option value="true">Active</option>
                <option value="false">Disabled</option>
              </Select>
            </Field>
          </div>

          <div>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <strong className="text-sm">Conditions <span className="muted">(optional — all must match)</span></strong>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setConditions([...conditions, { field: '', op: 'equals', value: '' }])}
              >
                Add condition
              </Button>
            </div>
            {conditions.length === 0 ? (
              <p className="text-sm muted" style={{ margin: 0 }}>Runs on every matching event.</p>
            ) : (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {conditions.map((c, i) => (
                  <div key={i} className="row" style={{ gap: 'var(--space-2)' }}>
                    <TextInput
                      placeholder="field (e.g. roomType)"
                      value={c.field}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}
                      style={{ flex: 1 }}
                    />
                    <Select
                      value={c.op}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, op: e.target.value as ConditionRow['op'] } : x)))}
                      style={{ flex: 1 }}
                    >
                      {OPERATORS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                    <TextInput
                      placeholder="value"
                      value={c.value}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                      style={{ flex: 1 }}
                    />
                    <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => setConditions(conditions.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
              <strong className="text-sm">Actions <span className="muted">(what happens when it fires)</span></strong>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setActions([...actions, { type: '', params: '' }])}
              >
                Add action
              </Button>
            </div>
            {actions.length === 0 ? (
              <p className="text-sm muted" style={{ margin: 0 }}>No actions configured.</p>
            ) : (
              <div className="stack" style={{ gap: 'var(--space-2)' }}>
                {actions.map((a, i) => (
                  <div key={i} className="row" style={{ gap: 'var(--space-2)', alignItems: 'flex-start' }}>
                    <Select
                      value={a.type}
                      onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                      style={{ flex: 1 }}
                    >
                      <option value="">Select action…</option>
                      {ACTION_PRESETS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </Select>
                    <TextInput
                      placeholder='params JSON, e.g. {"message":"Clean room"}'
                      value={a.params}
                      onChange={(e) => setActions(actions.map((x, j) => (j === i ? { ...x, params: e.target.value } : x)))}
                      style={{ flex: 2 }}
                    />
                    <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => setActions(actions.filter((_, j) => j !== i))}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete automation rule"
        confirmLabel="Delete"
        destructive
      >
        Delete &ldquo;{deleteTarget?.ruleName}&rdquo;? This cannot be undone.
      </ConfirmDialog>
    </Layout>
  );
}
