import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Moon, Play, AlertTriangle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useTenantSettings } from '../hooks/useTenantSettings';
import { formatMoney } from '../lib/money';
import {
  AlertPanel,
  Button,
  ChargeSummary,
  DataTable,
  DetailDrawer,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  TextInput,
  useHasRole,
} from '../components/ui';
import type { Column } from '../components/ui/DataTable';

interface NightAudit {
  id: string;
  auditDate: string;
  status: 'completed' | 'completed_with_warnings';
  summary: {
    totalRooms: number;
    checkedIn: number;
    checkedOut: number;
    noShows: number;
    cancellations: number;
    roomNights: number;
    occupancyRate: number;
    totalRevenue: number;
    revenueByMethod: Record<string, number>;
    totalCharges: number;
    totalPayments: number;
    outstandingBalance: number;
    adr: number;
    revpar: number;
    openShifts: number;
    roomsUpdated: number;
  };
  discrepancies: string[] | null;
  auditDateTime: string | Date;
  performedByUser?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
}

export default function NightAuditPage() {
  const { user } = useAuthStore();
  const settings = useTenantSettings();
  const money = (n?: number | null) => formatMoney(n, settings.currencySymbol);

  const [audits, setAudits] = useState<NightAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningAudit, setRunningAudit] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<NightAudit | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [auditDate, setAuditDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));

  const canRunAudit = useHasRole(['owner', 'general_manager', 'accountant', 'iitech_admin']);

  const fetchAudits = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/tenants/${user.tenantId}/reports/night-audit`, {
        params: { limit: 50 },
      });
      setAudits(response.data.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Failed to fetch night audits');
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId]);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const handleRunAudit = async () => {
    if (!auditDate) {
      toast.error('Please select a date');
      return;
    }
    setRunningAudit(true);
    try {
      const response = await api.post(`/tenants/${user?.tenantId}/reports/night-audit`, {
        auditDate,
      });
      toast.success(response.data.message || 'Night audit completed successfully');
      setShowRunModal(false);
      fetchAudits();
      if (response.data.data?.discrepancies?.length > 0) {
        toast.error(`Audit completed with ${response.data.data.discrepancies.length} discrepancy(ies)`, {
          duration: 5000,
        });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to run night audit');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleViewAudit = async (date: string) => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/reports/night-audit/${date}`);
      setSelectedAudit(response.data.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to fetch audit details');
    }
  };

  const columns: Column<NightAudit>[] = [
    {
      key: 'date',
      header: 'Audit date',
      render: (a) => (
        <span style={{ fontWeight: 500, color: 'var(--text)' }}>
          {format(new Date(a.auditDate), 'MMM dd, yyyy')}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (a) => (
        <StatusBadge
          status={a.status === 'completed' ? 'completed' : 'warning'}
          tone={a.status === 'completed' ? 'success' : 'warning'}
        >
          {a.status === 'completed' ? 'Completed' : 'Warnings'}
        </StatusBadge>
      ),
    },
    {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      render: (a) => <span style={{ fontWeight: 600 }}>{money(a.summary.totalRevenue)}</span>,
    },
    {
      key: 'occupancy',
      header: 'Occupancy',
      align: 'right',
      render: (a) => `${a.summary.occupancyRate.toFixed(1)}%`,
    },
    {
      key: 'adr',
      header: 'ADR',
      align: 'right',
      render: (a) => money(a.summary.adr),
    },
    {
      key: 'revpar',
      header: 'RevPAR',
      align: 'right',
      render: (a) => money(a.summary.revpar),
    },
    {
      key: 'open',
      header: 'Outstanding',
      align: 'right',
      render: (a) => (
        <span style={{ color: a.summary.outstandingBalance > 0 ? 'var(--danger)' : 'var(--muted)' }}>
          {money(a.summary.outstandingBalance)}
        </span>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader
        title="Night audit"
        subtitle="Daily closing reports and transaction reconciliation"
        actions={
          canRunAudit ? (
            <Button variant="primary" icon={<Play size={15} />} onClick={() => setShowRunModal(true)}>
              Run night audit
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAudits} />
      ) : audits.length === 0 ? (
        <EmptyState
          icon={<Moon size={28} strokeWidth={1.6} />}
          title="No night audits yet"
          description={
            canRunAudit
              ? 'Run your first night audit to generate daily closing reports'
              : 'Contact your manager to run night audits'
          }
          action={
            canRunAudit ? (
              <Button variant="primary" onClick={() => setShowRunModal(true)}>
                Run night audit
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={audits}
          rowKey={(a) => a.id}
          onRowClick={(a) => handleViewAudit(a.auditDate)}
        />
      )}

      <Modal
        open={showRunModal}
        onClose={() => !runningAudit && setShowRunModal(false)}
        title="Run night audit"
        width="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRunModal(false)} disabled={runningAudit}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={runningAudit}
              disabled={!auditDate}
              onClick={handleRunAudit}
            >
              Run audit
            </Button>
          </>
        }
      >
        <div className="stack">
          <Field
            label="Audit date"
            required
            hint="Select the date to audit (typically yesterday). Today's date cannot be audited."
          >
            <TextInput
              type="date"
              value={auditDate}
              onChange={(e) => setAuditDate(e.target.value)}
              max={format(subDays(new Date(), 1), 'yyyy-MM-dd')}
            />
          </Field>
          <AlertPanel
            items={[
              {
                id: 'info',
                severity: 'info',
                title: 'What happens',
                description:
                  "The audit reconciles the day's folios, updates room statuses, and closes the business date. It produces a permanent report — this cannot be undone.",
              },
            ]}
          />
        </div>
      </Modal>

      <AuditDetailsDrawer audit={selectedAudit} money={money} onClose={() => setSelectedAudit(null)} />
    </Layout>
  );
}

function AuditDetailsDrawer({
  audit,
  money,
  onClose,
}: {
  audit: NightAudit | null;
  money: (n?: number | null) => string;
  onClose: () => void;
}) {
  return (
    <DetailDrawer
      open={!!audit}
      onClose={onClose}
      title={audit ? `Night audit — ${format(new Date(audit.auditDate), 'MMM dd, yyyy')}` : 'Audit'}
      width="lg"
      headerExtra={
        audit ? (
          <StatusBadge tone={audit.status === 'completed' ? 'success' : 'warning'}>
            {audit.status === 'completed' ? 'Completed' : 'Completed with warnings'}
          </StatusBadge>
        ) : undefined
      }
    >
      {audit && (
        <div className="stack-lg">
          {audit.discrepancies && audit.discrepancies.length > 0 && (
            <AlertPanel
              items={audit.discrepancies.map((disc, idx) => ({
                id: idx,
                severity: 'medium' as const,
                title: disc,
              }))}
            />
          )}

          <section>
            <h3 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>
              Activity
            </h3>
            <div className="grid3">
              <Metric label="Total rooms" value={audit.summary.totalRooms} />
              <Metric label="Checked in" value={audit.summary.checkedIn} />
              <Metric label="Checked out" value={audit.summary.checkedOut} />
              <Metric label="No shows" value={audit.summary.noShows} />
              <Metric label="Cancellations" value={audit.summary.cancellations} />
              <Metric label="Room nights" value={audit.summary.roomNights} />
            </div>
          </section>

          <section>
            <h3 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>
              Financials
            </h3>
            <div className="grid3">
              <Metric label="Occupancy" value={`${audit.summary.occupancyRate.toFixed(1)}%`} />
              <Metric label="Total revenue" value={money(audit.summary.totalRevenue)} />
              <Metric label="ADR" value={money(audit.summary.adr)} />
              <Metric label="RevPAR" value={money(audit.summary.revpar)} />
              <Metric label="Outstanding" value={money(audit.summary.outstandingBalance)} />
              <Metric label="Rooms updated" value={audit.summary.roomsUpdated} />
            </div>
          </section>

          {Object.keys(audit.summary.revenueByMethod).length > 0 && (
            <section>
              <h3 className="text-sm" style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>
                Revenue by payment method
              </h3>
              <ChargeSummary
                lines={Object.entries(audit.summary.revenueByMethod).map(([method, amount]) => ({
                  label: method.replace(/_/g, ' '),
                  amount: Number(amount),
                }))}
                total={audit.summary.totalRevenue}
                totalLabel="Total"
                currency=""
              />
            </section>
          )}

          <ChargeSummary
            title="Day totals"
            lines={[
              { label: 'Charges posted', amount: audit.summary.totalCharges },
              { label: 'Payments received', amount: audit.summary.totalPayments, negative: true },
            ]}
            total={audit.summary.outstandingBalance}
            totalLabel="Outstanding balance"
          />

          {audit.performedByUser && (
            <div className="text-xs muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 'var(--space-3)' }}>
              <AlertTriangle size={12} style={{ marginRight: 4, verticalAlign: -2 }} />
              Performed by {audit.performedByUser.firstName} {audit.performedByUser.lastName}
              {audit.auditDateTime &&
                ` on ${format(new Date(audit.auditDateTime), 'MMM dd, yyyy HH:mm')}`}
            </div>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: 'var(--space-3)',
        background: 'var(--surface-raised)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--line)',
      }}
    >
      <div className="text-xs muted" style={{ marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ color: 'var(--text)', fontSize: 'var(--fs-lg)', fontWeight: 600 }}>{value}</div>
    </div>
  );
}
