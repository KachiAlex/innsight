import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { X, Filter, Printer } from 'lucide-react';
import { format, subDays } from 'date-fns';
import toast from 'react-hot-toast';
import { TableSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';
import Pagination from '../components/Pagination';
import { printFolio } from '../utils/print';

interface Folio {
  id: string;
  guestName: string;
  status: string;
  totalCharges: number;
  totalPayments: number;
  balance: number;
  room: {
    roomNumber: string;
  };
  charges: any[];
  payments: any[];
}

export default function FoliosPage() {
  const { user } = useAuthStore();
  const [folios, setFolios] = useState<Folio[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolio, setSelectedFolio] = useState<Folio | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchFolios(pagination.page);
  }, [user, pagination.page, filters]);

  const fetchFolios = async (page = pagination.page) => {
    try {
      const params: any = {
        page,
        limit: pagination.limit,
      };
      if (filters.status) params.status = filters.status;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;

      const response = await api.get(`/tenants/${user?.tenantId}/folios`, { params });
      setFolios(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch folios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (folioId: string) => {
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/folios/${folioId}`);
      setSelectedFolio(response.data.data);
    } catch (error) {
      console.error('Failed to fetch folio details:', error);
    }
  };

  const handleRefreshFolio = async () => {
    if (selectedFolio) {
      await handleViewDetails(selectedFolio.id);
    }
  };

  const filteredFolios = folios.filter((folio) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      folio.guestName.toLowerCase().includes(searchLower) ||
      folio.room?.roomNumber.toLowerCase().includes(searchLower) ||
      folio.status.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Folios</h1>
          <TableSkeleton rows={8} columns={7} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ margin: 0, color: '#1e293b' }}>Folios</h1>
            {pagination.total > 0 && (
              <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.875rem' }}>
                {pagination.total} total folio{pagination.total !== 1 ? 's' : ''}
              </p>
            )}
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
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#1e293b', fontSize: '1rem', fontWeight: '600' }}>Filter Folios</h3>
              <button
                onClick={() => {
                  setFilters({ status: '', startDate: '', endDate: '' });
                  setPagination({ ...pagination, page: 1 });
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <X size={16} />
                Clear All
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => {
                    setFilters({ ...filters, status: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                  <option value="voided">Voided</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                  Date From
                </label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => {
                    setFilters({ ...filters, startDate: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  style={{
                    width: '100%',
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
                  onChange={(e) => {
                    setFilters({ ...filters, endDate: e.target.value });
                    setPagination({ ...pagination, page: 1 });
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setFilters({
                    status: '',
                    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                  });
                  setPagination({ ...pagination, page: 1 });
                }}
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
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  setFilters({
                    status: '',
                    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
                    endDate: format(new Date(), 'yyyy-MM-dd'),
                  });
                  setPagination({ ...pagination, page: 1 });
                }}
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
                Last 30 Days
              </button>
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search by guest name, room number, or status..."
            />
          </div>
        </div>

        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Guest</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Room</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Charges</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Payments</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Balance</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', fontWeight: '600', color: '#475569' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredFolios.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>
                    {searchTerm ? 'No folios match your search' : 'No folios found'}
                  </td>
                </tr>
              ) : (
                filteredFolios.map((folio) => (
                  <tr key={folio.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '1rem', color: '#1e293b' }}>{folio.guestName}</td>
                    <td style={{ padding: '1rem', color: '#1e293b' }}>{folio.room?.roomNumber}</td>
                    <td style={{ padding: '1rem', color: '#1e293b', fontWeight: '500' }}>
                      ₦{Number(folio.totalCharges).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem', color: '#10b981', fontWeight: '500' }}>
                      ₦{Number(folio.totalPayments).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: '1rem',
                        color: Number(folio.balance) > 0 ? '#ef4444' : '#10b981',
                        fontWeight: '500',
                      }}
                    >
                      ₦{Number(folio.balance).toLocaleString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          background:
                            folio.status === 'open'
                              ? '#dbeafe'
                              : folio.status === 'closed'
                              ? '#d1fae5'
                              : '#fee2e2',
                          color:
                            folio.status === 'open'
                              ? '#1e40af'
                              : folio.status === 'closed'
                              ? '#065f46'
                              : '#991b1b',
                        }}
                      >
                        {folio.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1rem' }}>
                      <button
                        onClick={() => handleViewDetails(folio.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={(newPage) => {
                setPagination({ ...pagination, page: newPage });
                fetchFolios(newPage);
              }}
            />
          )}
        </div>

        {selectedFolio && (
          <FolioDetailsModal 
            folio={selectedFolio} 
            onClose={() => setSelectedFolio(null)}
            onRefresh={handleRefreshFolio}
          />
        )}
      </div>
    </Layout>
  );
}

function FolioDetailsModal({ 
  folio, 
  onClose, 
  onRefresh 
}: { 
  folio: Folio; 
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

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
        alignItems: 'center',
        justifyContent: 'center',
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
          maxWidth: '800px',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b' }}>Folio Details</h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              onClick={() => printFolio(folio)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: '#64748b',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              <Printer size={18} />
              Print
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            ×
          </button>
          </div>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Guest</div>
              <div style={{ fontWeight: '500', color: '#1e293b' }}>{folio.guestName}</div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.875rem' }}>Room</div>
              <div style={{ fontWeight: '500', color: '#1e293b' }}>{folio.room?.roomNumber}</div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '1rem',
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '6px',
            }}
          >
            <div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Total Charges</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1e293b' }}>
                ₦{Number(folio.totalCharges).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Total Payments</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#10b981' }}>
                ₦{Number(folio.totalPayments).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Balance</div>
              <div
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 'bold',
                  color: Number(folio.balance) > 0 ? '#ef4444' : '#10b981',
                }}
              >
                ₦{Number(folio.balance).toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setShowAddCharge(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Add Charge
          </button>
          <button
            onClick={() => setShowAddPayment(true)}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Add Payment
          </button>
        </div>

        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Charges</h3>
          <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '1rem' }}>
            {folio.charges?.length === 0 ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>No charges</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.875rem' }}>
                      Description
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.875rem' }}>
                      Category
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontSize: '0.875rem' }}>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {folio.charges?.map((charge: any) => (
                    <tr key={charge.id}>
                      <td style={{ padding: '0.5rem', color: '#1e293b' }}>{charge.description}</td>
                      <td style={{ padding: '0.5rem', color: '#64748b' }}>{charge.category}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#1e293b' }}>
                        ₦{Number(charge.total).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div>
          <h3 style={{ marginBottom: '1rem', color: '#1e293b' }}>Payments</h3>
          <div style={{ background: '#f8fafc', borderRadius: '6px', padding: '1rem' }}>
            {folio.payments?.length === 0 ? (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: '1rem' }}>No payments</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.875rem' }}>
                      Date
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.875rem' }}>
                      Method
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#64748b', fontSize: '0.875rem' }}>
                      Amount
                    </th>
                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#64748b', fontSize: '0.875rem' }}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {folio.payments?.map((payment: any) => (
                    <tr key={payment.id}>
                      <td style={{ padding: '0.5rem', color: '#1e293b' }}>
                        {format(new Date(payment.createdAt), 'MMM dd, yyyy HH:mm')}
                      </td>
                      <td style={{ padding: '0.5rem', color: '#64748b' }}>{payment.method}</td>
                      <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '500', color: '#10b981' }}>
                        ₦{Number(payment.amount).toLocaleString()}
                      </td>
                      <td style={{ padding: '0.5rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            background: payment.status === 'completed' ? '#d1fae5' : '#fee2e2',
                            color: payment.status === 'completed' ? '#065f46' : '#991b1b',
                          }}
                        >
                          {payment.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {showAddCharge && (
          <AddChargeModal
            folioId={folio.id}
            onClose={() => setShowAddCharge(false)}
            onSuccess={() => {
              setShowAddCharge(false);
              onRefresh();
            }}
          />
        )}

        {showAddPayment && (
          <AddPaymentModal
            folioId={folio.id}
            onClose={() => setShowAddPayment(false)}
            onSuccess={() => {
              setShowAddPayment(false);
              onRefresh();
            }}
          />
        )}
      </div>
    </div>
  );
}

function AddChargeModal({
  folioId,
  onClose,
  onSuccess,
}: {
  folioId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    description: '',
    category: 'other' as 'room_rate' | 'extra' | 'tax' | 'discount' | 'other',
    amount: '',
    quantity: '1',
    taxRate: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/tenants/${user?.tenantId}/folios/${folioId}/charges`, {
        description: formData.description,
        category: formData.category,
        amount: parseFloat(formData.amount),
        quantity: parseInt(formData.quantity),
        taxRate: formData.taxRate ? parseFloat(formData.taxRate) : undefined,
      });
      toast.success('Charge added successfully');
      onSuccess();
    } catch (error: any) {
      // Error is handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
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
          maxWidth: '500px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b' }}>Add Charge</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Description *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
                placeholder="e.g., Room service, Mini bar, etc."
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="room_rate">Room Rate</option>
                <option value="extra">Extra</option>
                <option value="tax">Tax</option>
                <option value="discount">Discount</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Amount (₦) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
                placeholder="Optional"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#94a3b8' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {loading ? 'Adding...' : 'Add Charge'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddPaymentModal({
  folioId,
  onClose,
  onSuccess,
}: {
  folioId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuthStore();
  const [formData, setFormData] = useState({
    amount: '',
    method: 'cash' as 'card' | 'bank_transfer' | 'cash' | 'other',
    reference: '',
    paymentGateway: 'manual' as 'paystack' | 'flutterwave' | 'stripe' | 'manual',
    gatewayTransactionId: '',
    notes: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.post(`/tenants/${user?.tenantId}/payments`, {
        folioId,
        amount: parseFloat(formData.amount),
        method: formData.method,
        reference: formData.reference || undefined,
        paymentGateway: formData.paymentGateway !== 'manual' ? formData.paymentGateway : undefined,
        gatewayTransactionId: formData.gatewayTransactionId || undefined,
        notes: formData.notes || undefined,
      });
      toast.success('Payment added successfully');
      onSuccess();
    } catch (error: any) {
      // Error is handled by API interceptor
    } finally {
      setLoading(false);
    }
  };

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
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
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
          maxWidth: '500px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#1e293b' }}>Add Payment</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.5rem',
              cursor: 'pointer',
              color: '#94a3b8',
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Amount (₦) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
                placeholder="0.00"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Payment Method *
              </label>
              <select
                value={formData.method}
                onChange={(e) => setFormData({ ...formData, method: e.target.value as any })}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Payment Gateway
              </label>
              <select
                value={formData.paymentGateway}
                onChange={(e) => setFormData({ ...formData, paymentGateway: e.target.value as any })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              >
                <option value="manual">Manual Entry</option>
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
                <option value="stripe">Stripe</option>
              </select>
            </div>

            {formData.paymentGateway !== 'manual' && (
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                  Gateway Transaction ID
                </label>
                <input
                  type="text"
                  value={formData.gatewayTransactionId}
                  onChange={(e) => setFormData({ ...formData, gatewayTransactionId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                  }}
                  placeholder="Transaction ID from gateway"
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Reference Number
              </label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
                placeholder="Optional reference number"
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#475569', fontWeight: '500' }}>
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  resize: 'vertical',
                }}
                placeholder="Optional notes"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f1f5f9',
                  color: '#475569',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: loading ? '#94a3b8' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: '500',
                }}
              >
                {loading ? 'Adding...' : 'Add Payment'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
