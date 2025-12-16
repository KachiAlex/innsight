import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { CreditCard, CheckCircle, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/LoadingSkeleton';
import Pagination from '../components/Pagination';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference?: string;
  paymentGateway?: string;
  gatewayTransactionId?: string;
  reconciled: boolean;
  reconciledAt?: string;
  createdAt: string;
  folio: {
    id: string;
    guestName: string;
    room: {
      roomNumber: string;
    };
  };
  user: {
    firstName: string;
    lastName: string;
  };
}

export default function PaymentsPage() {
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const [reconcilingPayments, setReconcilingPayments] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    reconciled: '',
    startDate: '',
    endDate: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'reconcile'>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchPayments = useCallback(async (page = pagination.page) => {
    if (!user?.tenantId) return;
    setLoading(true);
    try {
      let response;
      if (activeTab === 'reconcile') {
        response = await api.get(`/tenants/${user.tenantId}/payments/reconcile`, {
          params: { page, limit: pagination.limit },
        });
      } else {
        const params: any = { page, limit: pagination.limit };
        if (filters.status) params.status = filters.status;
        if (filters.method) params.method = filters.method;
        if (filters.reconciled) params.reconciled = filters.reconciled;
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
        response = await api.get(`/tenants/${user.tenantId}/payments`, { params });
      }
      setPayments(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      console.error('Failed to fetch payments:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to fetch payments');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, activeTab, filters, pagination.limit]);

  useEffect(() => {
    fetchPayments(pagination.page);
  }, [fetchPayments, pagination.page]);

  const handleReconcile = async (paymentId: string) => {
    setReconcilingPayments(prev => new Set(prev).add(paymentId));
    try {
      await api.post(`/tenants/${user?.tenantId}/payments/${paymentId}/reconcile`);
      toast.success('Payment reconciled successfully');
      fetchPayments();
    } catch (error: any) {
      // Error handled by API interceptor
    } finally {
      setReconcilingPayments(prev => {
        const next = new Set(prev);
        next.delete(paymentId);
        return next;
      });
    }
  };

  const filteredPayments = useMemo(() => payments.filter((payment) => {
    if (!debouncedSearchTerm) return true;
    const searchLower = debouncedSearchTerm.toLowerCase();
    return (
      payment.reference?.toLowerCase().includes(searchLower) ||
      payment.folio.guestName.toLowerCase().includes(searchLower) ||
      payment.folio.room.roomNumber.toLowerCase().includes(searchLower) ||
      payment.gatewayTransactionId?.toLowerCase().includes(searchLower) ||
      `${payment.user.firstName} ${payment.user.lastName}`.toLowerCase().includes(searchLower)
    );
  }), [payments, debouncedSearchTerm]);

  const getMethodColor = (method: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      card: { bg: '#dbeafe', text: '#1e40af' },
      bank_transfer: { bg: '#d1fae5', text: '#065f46' },
      cash: { bg: '#fef3c7', text: '#92400e' },
      other: { bg: '#e5e7eb', text: '#374151' },
    };
    return colors[method] || colors.other;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      completed: { bg: '#d1fae5', text: '#065f46' },
      pending: { bg: '#fef3c7', text: '#92400e' },
      failed: { bg: '#fee2e2', text: '#991b1b' },
      refunded: { bg: '#e5e7eb', text: '#374151' },
    };
    return colors[status] || colors.completed;
  };

  const totalAmount = filteredPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const unreconciledCount = payments.filter((p) => !p.reconciled).length;

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Payments</h1>
          <TableSkeleton rows={8} columns={8} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#1e293b' }}>Payments</h1>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>
              <span>{payments.length} total payments</span>
              <span style={{ fontWeight: '500', color: '#1e293b' }}>
                Total: ₦{totalAmount.toLocaleString()}
              </span>
              {unreconciledCount > 0 && (
                <span style={{ color: '#f59e0b', fontWeight: '500' }}>{unreconciledCount} unreconciled</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
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
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '2px solid #e2e8f0',
          }}
        >
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'all' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'all' ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              fontWeight: activeTab === 'all' ? '500' : '400',
              marginBottom: '-2px',
            }}
          >
            All Payments
          </button>
          <button
            onClick={() => setActiveTab('reconcile')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'reconcile' ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === 'reconcile' ? '#3b82f6' : '#64748b',
              cursor: 'pointer',
              fontWeight: activeTab === 'reconcile' ? '500' : '400',
              marginBottom: '-2px',
            }}
          >
            Reconciliation
            {unreconciledCount > 0 && (
              <span
                style={{
                  marginLeft: '0.5rem',
                  padding: '0.125rem 0.5rem',
                  background: '#f59e0b',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                }}
              >
                {unreconciledCount}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <Search
              size={20}
              style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by reference, guest name, room, or transaction ID..."
              style={{
                width: '100%',
                padding: '0.75rem 0.75rem 0.75rem 2.5rem',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '0.875rem',
              }}
            />
          </div>
        </div>

        {/* Filters */}
        {showFilters && activeTab === 'all' && (
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
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                Method
              </label>
              <select
                value={filters.method}
                onChange={(e) => setFilters({ ...filters, method: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">All</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                Reconciled
              </label>
              <select
                value={filters.reconciled}
                onChange={(e) => setFilters({ ...filters, reconciled: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                <option value="">All</option>
                <option value="true">Reconciled</option>
                <option value="false">Unreconciled</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                Date From
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                Date To
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                style={{
                  padding: '0.5rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                onClick={() => setFilters({ status: '', method: '', reconciled: '', startDate: '', endDate: '' })}
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

        {/* Payments Table */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          {filteredPayments.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
              <CreditCard size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
              {filteredPayments.length === 0 ? (
                <EmptyState
                  icon={CreditCard}
                  title={searchTerm || filters.status || filters.method || filters.startDate 
                    ? 'No payments match your filters' 
                    : 'No payments yet'}
                  description={searchTerm || filters.status || filters.method || filters.startDate
                    ? 'Try adjusting your search or filter criteria'
                    : 'Payments will appear here when guests make transactions'}
                />
              ) : null}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Date</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Guest</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Room</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Amount</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Method</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Reference</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Status</th>
                  <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => {
                  const methodColor = getMethodColor(payment.method);
                  const statusColor = getStatusColor(payment.status);
                  return (
                    <tr key={payment.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem' }}>
                        {format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td style={{ padding: '1rem', color: '#1e293b' }}>{payment.folio.guestName}</td>
                      <td style={{ padding: '1rem', color: '#1e293b' }}>{payment.folio.room.roomNumber}</td>
                      <td style={{ padding: '1rem', color: '#1e293b', fontWeight: '500' }}>
                        ₦{Number(payment.amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.75rem',
                            borderRadius: '12px',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            background: methodColor.bg,
                            color: methodColor.text,
                          }}
                        >
                          {payment.method.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', color: '#64748b', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                        {payment.reference || '-'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span
                            style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              background: statusColor.bg,
                              color: statusColor.text,
                              width: 'fit-content',
                            }}
                          >
                            {payment.status.toUpperCase()}
                          </span>
                          {!payment.reconciled && (
                            <span
                              style={{
                                padding: '0.125rem 0.5rem',
                                borderRadius: '8px',
                                fontSize: '0.7rem',
                                background: '#fef3c7',
                                color: '#92400e',
                                width: 'fit-content',
                              }}
                            >
                              UNRECONCILED
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {!payment.reconciled && activeTab === 'reconcile' && (
                          <button
                            onClick={() => handleReconcile(payment.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.5rem 1rem',
                              background: reconcilingPayments.has(payment.id) ? '#94a3b8' : '#10b981',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: reconcilingPayments.has(payment.id) ? 'not-allowed' : 'pointer',
                              opacity: reconcilingPayments.has(payment.id) ? 0.6 : 1,
                              fontSize: '0.875rem',
                            }}
                          >
                            <CheckCircle size={16} />
                            {reconcilingPayments.has(payment.id) ? 'Reconciling...' : 'Reconcile'}
                          </button>
                        )}
                        {payment.reconciled && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                            Reconciled {payment.reconciledAt && format(new Date(payment.reconciledAt), 'MMM dd')}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {pagination.totalPages > 1 && filteredPayments.length > 0 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => {
                setPagination({ ...pagination, page: newPage });
                fetchPayments(newPage);
              }}
            />
          )}
        </div>
      </div>
    </Layout>
  );
}

