import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { AlertCircle, CheckCircle, Filter } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/LoadingSkeleton';
import EmptyState from '../components/EmptyState';

interface Alert {
  id: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  resolvedAt?: string;
  resolver?: {
    firstName: string;
    lastName: string;
  };
}

export default function AlertsPage() {
  const { user } = useAuthStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    severity: '',
    alertType: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [resolvingAlerts, setResolvingAlerts] = useState<Set<string>>(new Set());

  const fetchAlerts = useCallback(async () => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      if (filters.alertType) params.alertType = filters.alertType;

      const response = await api.get(`/tenants/${user.tenantId}/alerts`, { params });
      setAlerts(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to fetch alerts:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to fetch alerts');
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, filters]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleResolve = async (alertId: string) => {
    setResolvingAlerts(prev => new Set(prev).add(alertId));
    try {
      await api.post(`/tenants/${user?.tenantId}/alerts/${alertId}/resolve`);
      toast.success('Alert resolved successfully');
      fetchAlerts();
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setResolvingAlerts(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      critical: { bg: '#fee2e2', text: '#991b1b' },
      high: { bg: '#fef3c7', text: '#92400e' },
      medium: { bg: '#dbeafe', text: '#1e40af' },
      low: { bg: '#d1fae5', text: '#065f46' },
    };
    return colors[severity] || colors.medium;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      open: { bg: '#fee2e2', text: '#991b1b' },
      acknowledged: { bg: '#fef3c7', text: '#92400e' },
      resolved: { bg: '#d1fae5', text: '#065f46' },
    };
    return colors[status] || colors.open;
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Alerts</h1>
          <TableSkeleton rows={8} columns={6} />
        </div>
      </Layout>
    );
  }

  const openAlerts = alerts.filter((a) => a.status === 'open').length;
  const criticalAlerts = alerts.filter((a) => a.severity === 'critical' && a.status === 'open').length;

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#1e293b' }}>Alerts</h1>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              <span>{alerts.length} total alerts</span>
              {openAlerts > 0 && (
                <span style={{ color: '#ef4444', fontWeight: '500' }}>{openAlerts} open</span>
              )}
              {criticalAlerts > 0 && (
                <span style={{ color: '#991b1b', fontWeight: '500' }}>{criticalAlerts} critical</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              background: showFilters ? '#3b82f6' : '#f1f5f9',
              color: showFilters ? 'white' : '#475569',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
          >
            <Filter size={20} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div
            style={{
              background: 'white',
              padding: '1.5rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
              display: 'flex',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                Severity
              </label>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">All</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => setFilters({ status: '', severity: '', alertType: '' })}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          {!loading && alerts.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title={filters.status || filters.severity || filters.alertType ? 'No alerts match your filters' : 'No alerts yet'}
              description={filters.status || filters.severity || filters.alertType
                ? 'Try adjusting your filter criteria'
                : 'Alerts will appear here when system events occur'}
            />
          ) : alerts.length > 0 ? (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Severity</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Type</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Title</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Message</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Date</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const severityColor = getSeverityColor(alert.severity);
                  const statusColor = getStatusColor(alert.status);
                  return (
                    <tr key={alert.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            background: severityColor.bg,
                            color: severityColor.text,
                          }}
                        >
                          {alert.severity.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#1e293b' }}>
                        {alert.alertType.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                      </td>
                      <td style={{ padding: '1rem', color: '#1e293b', fontWeight: '500' }}>{alert.title}</td>
                      <td style={{ padding: '1rem', color: '#64748b', maxWidth: '300px' }}>{alert.message}</td>
                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            background: statusColor.bg,
                            color: statusColor.text,
                          }}
                        >
                          {alert.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                        {format(new Date(alert.createdAt), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {alert.status !== 'resolved' && (
                          <button
                            onClick={() => handleResolve(alert.id)}
                            disabled={resolvingAlerts.has(alert.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem 1rem',
                              background: resolvingAlerts.has(alert.id) ? '#94a3b8' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: resolvingAlerts.has(alert.id) ? 'not-allowed' : 'pointer',
                              opacity: resolvingAlerts.has(alert.id) ? 0.6 : 1,
                              fontSize: '0.875rem',
                            }}
                          >
                            <CheckCircle size={16} />
                            {resolvingAlerts.has(alert.id) ? 'Resolving...' : 'Resolve'}
                          </button>
                        )}
                        {alert.resolver && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            Resolved by {alert.resolver.firstName} {alert.resolver.lastName}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}

