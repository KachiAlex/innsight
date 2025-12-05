import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { Moon, Calendar, CheckCircle, AlertTriangle, Eye, Play } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/LoadingSkeleton';

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
  const [audits, setAudits] = useState<NightAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAudit, setRunningAudit] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<NightAudit | null>(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [auditDate, setAuditDate] = useState(format(subDays(new Date(), 1), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchAudits();
  }, [user]);

  const fetchAudits = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tenants/${user?.tenantId}/reports/night-audit`, {
        params: { limit: 50 },
      });
      setAudits(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch night audits:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch night audits');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAudit = async () => {
    if (!auditDate) {
      toast.error('Please select a date');
      return;
    }

    try {
      setRunningAudit(true);
      const response = await api.post(`/tenants/${user?.tenantId}/reports/night-audit`, {
        auditDate,
      });
      toast.success(response.data.message || 'Night audit completed successfully');
      setShowRunModal(false);
      fetchAudits();
      
      // If there are discrepancies, show them
      if (response.data.data?.discrepancies?.length > 0) {
        toast.error(`Audit completed with ${response.data.data.discrepancies.length} discrepancy(ies)`, {
          duration: 5000,
        });
      }
    } catch (error: any) {
      console.error('Failed to run night audit:', error);
      toast.error(error.response?.data?.message || 'Failed to run night audit');
    } finally {
      setRunningAudit(false);
    }
  };

  const handleViewAudit = async (auditDate: string) => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/reports/night-audit/${auditDate}`);
      setSelectedAudit(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch audit details:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch audit details');
    }
  };

  // Check if user has permission (owner, general_manager, accountant)
  const canRunAudit = user?.role === 'owner' || 
                      user?.role === 'general_manager' || 
                      user?.role === 'accountant' || 
                      user?.role === 'iitech_admin';

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '2rem' }}>
          <TableSkeleton />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.875rem', fontWeight: '700', color: '#000' }}>
              Night Audit
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              Daily closing reports and transaction reconciliation
            </p>
          </div>
          {canRunAudit && (
            <button
              onClick={() => setShowRunModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                background: '#000',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#333';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#000';
              }}
            >
              <Play size={16} />
              Run Night Audit
            </button>
          )}
        </div>

        {audits.length === 0 ? (
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '3rem',
              textAlign: 'center',
              border: '1px solid #e2e8f0',
            }}
          >
            <Moon size={48} style={{ margin: '0 auto 1rem', color: '#cbd5e1' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#000', fontSize: '1.25rem' }}>
              No Night Audits Yet
            </h3>
            <p style={{ margin: 0, color: '#64748b' }}>
              {canRunAudit
                ? 'Run your first night audit to generate daily closing reports'
                : 'Contact your manager to run night audits'}
            </p>
          </div>
        ) : (
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000', fontSize: '0.875rem' }}>
                    Audit Date
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#000', fontSize: '0.875rem' }}>
                    Status
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: '#000', fontSize: '0.875rem' }}>
                    Revenue
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: '#000', fontSize: '0.875rem' }}>
                    Occupancy
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: '#000', fontSize: '0.875rem' }}>
                    ADR
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'right', fontWeight: '600', color: '#000', fontSize: '0.875rem' }}>
                    RevPAR
                  </th>
                  <th style={{ padding: '1rem', textAlign: 'center', fontWeight: '600', color: '#000', fontSize: '0.875rem' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr
                    key={audit.id}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                    }}
                  >
                    <td style={{ padding: '1rem', color: '#000' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={16} style={{ color: '#64748b' }} />
                        {format(new Date(audit.auditDate), 'MMM dd, yyyy')}
                      </div>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {audit.status === 'completed' ? (
                          <>
                            <CheckCircle size={16} style={{ color: '#10b981' }} />
                            <span style={{ color: '#10b981', fontSize: '0.875rem' }}>Completed</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
                            <span style={{ color: '#f59e0b', fontSize: '0.875rem' }}>Warnings</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: '#000', fontWeight: '500' }}>
                      ₦{audit.summary.totalRevenue.toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: '#000' }}>
                      {audit.summary.occupancyRate.toFixed(1)}%
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: '#000' }}>
                      ₦{audit.summary.adr.toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: '#000' }}>
                      ₦{audit.summary.revpar.toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button
                        onClick={() => handleViewAudit(audit.auditDate)}
                        style={{
                          padding: '0.5rem',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#64748b',
                        }}
                        title="View Details"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#000';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#64748b';
                        }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Run Audit Modal */}
        {showRunModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1000,
            }}
            onClick={() => setShowRunModal(false)}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '8px',
                padding: '2rem',
                width: '90%',
                maxWidth: '500px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#000', fontSize: '1.5rem', fontWeight: '700' }}>
                Run Night Audit
              </h2>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#000', fontWeight: '500' }}>
                  Audit Date
                </label>
                <input
                  type="date"
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                  max={format(subDays(new Date(), 1), 'yyyy-MM-dd')}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#000';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                  }}
                />
                <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.75rem' }}>
                  Select the date to audit (typically yesterday). Today's date cannot be audited.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowRunModal(false)}
                  disabled={runningAudit}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#f1f5f9',
                    color: '#000',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: runningAudit ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    opacity: runningAudit ? 0.5 : 1,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRunAudit}
                  disabled={runningAudit || !auditDate}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: runningAudit ? '#94a3b8' : '#000',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: runningAudit ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                  }}
                >
                  {runningAudit ? 'Running...' : 'Run Audit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Audit Details Modal */}
        {selectedAudit && (
          <AuditDetailsModal audit={selectedAudit} onClose={() => setSelectedAudit(null)} />
        )}
      </div>
    </Layout>
  );
}

function AuditDetailsModal({ audit, onClose }: { audit: NightAudit; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '8px',
          padding: '2rem',
          width: '100%',
          maxWidth: '900px',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700', color: '#000' }}>
              Night Audit Report
            </h2>
            <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
              {format(new Date(audit.auditDate), 'MMMM dd, yyyy')}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
            }}
          >
            ✕
          </button>
        </div>

        {audit.discrepancies && audit.discrepancies.length > 0 && (
          <div
            style={{
              background: '#fef3c7',
              border: '1px solid #fbbf24',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '2rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
              <h3 style={{ margin: 0, color: '#92400e', fontSize: '1rem', fontWeight: '600' }}>
                Discrepancies Found
              </h3>
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#92400e' }}>
              {audit.discrepancies.map((disc, idx) => (
                <li key={idx} style={{ marginBottom: '0.25rem' }}>
                  {disc}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <MetricCard label="Total Rooms" value={audit.summary.totalRooms.toString()} />
          <MetricCard label="Checked In" value={audit.summary.checkedIn.toString()} />
          <MetricCard label="Checked Out" value={audit.summary.checkedOut.toString()} />
          <MetricCard label="No Shows" value={audit.summary.noShows.toString()} />
          <MetricCard label="Cancellations" value={audit.summary.cancellations.toString()} />
          <MetricCard label="Room Nights" value={audit.summary.roomNights.toString()} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <MetricCard label="Occupancy Rate" value={`${audit.summary.occupancyRate.toFixed(1)}%`} />
          <MetricCard label="Total Revenue" value={`₦${audit.summary.totalRevenue.toLocaleString()}`} />
          <MetricCard label="ADR" value={`₦${audit.summary.adr.toLocaleString()}`} />
          <MetricCard label="RevPAR" value={`₦${audit.summary.revpar.toLocaleString()}`} />
          <MetricCard label="Outstanding Balance" value={`₦${audit.summary.outstandingBalance.toLocaleString()}`} />
          <MetricCard label="Rooms Updated" value={audit.summary.roomsUpdated.toString()} />
        </div>

        {Object.keys(audit.summary.revenueByMethod).length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#000', fontSize: '1rem', fontWeight: '600' }}>
              Revenue by Payment Method
            </h3>
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {Object.entries(audit.summary.revenueByMethod).map(([method, amount]) => (
                <div
                  key={method}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    background: '#f8fafc',
                    borderRadius: '6px',
                  }}
                >
                  <span style={{ color: '#64748b', textTransform: 'capitalize' }}>{method.replace('_', ' ')}</span>
                  <span style={{ color: '#000', fontWeight: '500' }}>₦{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {audit.performedByUser && (
          <div style={{ paddingTop: '1rem', borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: '0.875rem' }}>
            Performed by: {audit.performedByUser.firstName} {audit.performedByUser.lastName}
            {audit.auditDateTime && (
              <> on {format(new Date(audit.auditDateTime), 'MMM dd, yyyy HH:mm')}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '1rem',
        background: '#f8fafc',
        borderRadius: '6px',
        border: '1px solid #e2e8f0',
      }}
    >
      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ color: '#000', fontSize: '1.25rem', fontWeight: '600' }}>{value}</div>
    </div>
  );
}

