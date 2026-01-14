import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { User, Mail, Phone, Search, Star, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { useDebounce } from '../hooks/useDebounce';
import EmptyState from '../components/EmptyState';
import Pagination from '../components/Pagination';
import Button from '../components/Button';
import LoyaltyBadge from '../components/LoyaltyBadge';

export default function GuestsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    loyaltyTier: '',
    isVIP: '',
  });

  const fetchGuests = useCallback(async (page = pagination.page, search = '') => {
    if (!user?.tenantId) return;
    
    try {
      setLoading(true);
      
      const params: any = {
        page,
        limit: pagination.limit,
      };

      if (search.trim()) {
        params.search = search.trim();
        setIsSearching(true);
      } else {
        setIsSearching(false);
      }

      if (filters.loyaltyTier) {
        params.loyaltyTier = filters.loyaltyTier;
      }

      if (filters.isVIP) {
        params.isVIP = filters.isVIP;
      }

      const response = await api.get(`/tenants/${user.tenantId}/guests-enhanced`, { params });
      setGuests(response.data.data || []);
      
      if (response.data.pagination) {
        setPagination(response.data.pagination);
      }
    } catch (error: any) {
      console.error('Failed to fetch guests:', error);
      toast.error(error.response?.data?.error?.message || error.response?.data?.message || 'Failed to fetch guests');
      setGuests([]);
    } finally {
      setLoading(false);
    }
  }, [user?.tenantId, pagination.limit, filters]);

  useEffect(() => {
    if (!user?.tenantId) return;
    if (!debouncedSearchQuery.trim()) {
      fetchGuests(pagination.page, '');
    }
  }, [user?.tenantId, pagination.page, fetchGuests]);

  useEffect(() => {
    if (!user?.tenantId) return;
    if (debouncedSearchQuery.trim()) {
      fetchGuests(1, debouncedSearchQuery);
    } else if (searchQuery === '' && debouncedSearchQuery === '') {
      fetchGuests(1, '');
    }
  }, [debouncedSearchQuery, user?.tenantId, fetchGuests, searchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    fetchGuests(1, '');
  }, [fetchGuests]);

  const handlePageChange = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }));
  }, []);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 style={{ color: '#1e293b', margin: 0 }}>Guests</h1>
        </div>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
          Guests are automatically synced from reservations, group bookings, and the DIY portal.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search by name, email, or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    fetchGuests(1, searchQuery);
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem 0.75rem 2.5rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '1rem',
                }}
              />
              <Search
                size={18}
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
          
          <Button
            variant={showFilters ? "primary" : "secondary"}
            size="md"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            Filters
          </Button>

          {searchQuery && (
            <Button
              variant="ghost"
              size="md"
              onClick={handleClearSearch}
              disabled={loading}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div style={{
            backgroundColor: '#f8fafc',
            padding: '1rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            border: '1px solid #e2e8f0',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Loyalty Tier
                </label>
                <select
                  value={filters.loyaltyTier}
                  onChange={(e) => setFilters({ ...filters, loyaltyTier: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">All Tiers</option>
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                  <option value="vip">VIP</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                  Guest Type
                </label>
                <select
                  value={filters.isVIP}
                  onChange={(e) => setFilters({ ...filters, isVIP: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="">All Guests</option>
                  <option value="true">VIP Only</option>
                  <option value="false">Regular Only</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({ loyaltyTier: '', isVIP: '' });
                  setShowFilters(false);
                }}
              >
                Clear Filters
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  fetchGuests(1, searchQuery);
                  setShowFilters(false);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        )}

        {!loading && guests.length === 0 ? (
          <EmptyState
            icon={User}
            title={isSearching ? 'No guests found' : 'No guests yet'}
            description={isSearching ? 'Try adjusting your search terms' : 'Guests will show up automatically once they book through any channel'}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {guests.map((guest, idx) => {
              const identifier = guest.id || guest.email || guest.phone || guest.name;
              return (
                <div
                  key={idx}
                  onClick={() => navigate(`/guests/${encodeURIComponent(identifier)}`)}
                  style={{
                    background: 'white',
                    border: guest.isVIP ? '2px solid #9333ea' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '1.5rem',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
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
                  {/* VIP Badge */}
                  {guest.isVIP && (
                    <div style={{
                      position: 'absolute',
                      top: '1rem',
                      right: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.5rem',
                      backgroundColor: '#faf5ff',
                      color: '#9333ea',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                    }}>
                      <Star size={12} fill="#9333ea" />
                      VIP
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.125rem', fontWeight: '600' }}>
                      {guest.name}
                    </h3>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    {guest.loyaltyTier && (
                      <LoyaltyBadge tier={guest.loyaltyTier} size="sm" />
                    )}
                  </div>

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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Stays</div>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>{guest.totalStays || 0}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Points</div>
                      <div style={{ fontWeight: '600', color: '#9333ea' }}>{guest.loyaltyPoints?.toLocaleString() || 0}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!isSearching && pagination.totalPages > 1 && (
          <div style={{ marginTop: '2rem' }}>
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              limit={pagination.limit}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}

