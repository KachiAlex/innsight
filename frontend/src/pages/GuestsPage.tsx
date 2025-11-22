import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { User, Mail, Phone, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import SearchInput from '../components/SearchInput';

export default function GuestsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (!user?.tenantId) return;
    fetchGuests();
  }, [user, pagination.page]);

  const fetchGuests = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tenants/${user?.tenantId}/guests`, {
        params: {
          page: pagination.page,
          limit: pagination.limit,
        },
      });
      setGuests(response.data.data || []);
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      console.error('Failed to fetch guests:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch guests');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.tenantId) return;
    try {
      const response = await api.get(`/tenants/${user?.tenantId}/guests/search`, {
        params: { q: searchQuery.trim() },
      });
      setGuests(response.data.data || []);
    } catch (error: any) {
      console.error('Failed to search guests:', error);
      toast.error(error.response?.data?.message || 'Failed to search guests');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <h1 style={{ marginBottom: '1.5rem', color: '#1e293b' }}>Guests</h1>
          <CardSkeleton count={6} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#1e293b' }}>Guests</h1>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ flex: 1, maxWidth: '400px' }}>
            <SearchInput
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(value) => setSearchQuery(value)}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Search size={20} />
            Search
          </button>
        </div>

        {guests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <User size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>No guests found</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {guests.map((guest, idx) => {
              const identifier = guest.email || guest.phone || guest.name;
              return (
                <div
                  key={idx}
                  onClick={() => navigate(`/guests/${encodeURIComponent(identifier)}`)}
                  style={{
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b', fontSize: '1.125rem', fontWeight: '600' }}>
                    {guest.name}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                    {guest.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                        <Mail size={14} />
                        {guest.email}
                      </div>
                    )}
                    {guest.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                        <Phone size={14} />
                        {guest.phone}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Stays</div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{guest.totalStays}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Nights</div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{guest.totalNights}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Spent</div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>₦{guest.totalSpent.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

