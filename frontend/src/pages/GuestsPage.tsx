import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { User, Mail, Phone, Star, Filter } from 'lucide-react';
import { useDebounce } from '../hooks/useDebounce';
import LoyaltyBadge from '../components/LoyaltyBadge';
import Pagination from '../components/Pagination';
import {
  Button,
  EmptyState,
  ErrorState,
  Field,
  FilterBar,
  PageHeader,
  Panel,
  Select,
  Skeleton,
} from '../components/ui';
import styles from './GuestsPage.module.css';

export default function GuestsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const fetchGuests = useCallback(
    async (page = pagination.page, search = '') => {
      if (!user?.tenantId) return;
      try {
        setLoading(true);
        setError(null);
        const params: any = { page, limit: pagination.limit };
        if (search.trim()) {
          params.search = search.trim();
          setIsSearching(true);
        } else {
          setIsSearching(false);
        }
        if (filters.loyaltyTier) params.loyaltyTier = filters.loyaltyTier;
        if (filters.isVIP) params.isVIP = filters.isVIP;

        const response = await api.get(`/tenants/${user.tenantId}/guests-enhanced`, { params });
        setGuests(response.data.data || []);
        if (response.data.pagination) setPagination(response.data.pagination);
      } catch (err: any) {
        setError(
          err.response?.data?.error?.message || err.response?.data?.message || 'Failed to fetch guests'
        );
        setGuests([]);
      } finally {
        setLoading(false);
      }
    },
    [user?.tenantId, pagination.limit, filters]
  );

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

  const activeFilterCount = (filters.loyaltyTier ? 1 : 0) + (filters.isVIP ? 1 : 0);

  return (
    <Layout>
      <PageHeader
        title="Guests"
        subtitle="Guests sync automatically from reservations, group bookings, and the guest portal"
        actions={
          <Button
            variant={showFilters ? 'primary' : 'secondary'}
            icon={<Filter size={15} />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
        }
      />

      {showFilters && (
        <Panel style={{ marginBottom: 'var(--space-4)' }}>
          <div className="grid3">
            <Field label="Loyalty tier">
              <Select
                value={filters.loyaltyTier}
                onChange={(e) => setFilters({ ...filters, loyaltyTier: e.target.value })}
              >
                <option value="">All tiers</option>
                <option value="bronze">Bronze</option>
                <option value="silver">Silver</option>
                <option value="gold">Gold</option>
                <option value="platinum">Platinum</option>
                <option value="vip">VIP</option>
              </Select>
            </Field>
            <Field label="Guest type">
              <Select
                value={filters.isVIP}
                onChange={(e) => setFilters({ ...filters, isVIP: e.target.value })}
              >
                <option value="">All guests</option>
                <option value="true">VIP only</option>
                <option value="false">Regular only</option>
              </Select>
            </Field>
          </div>
          <div className="row" style={{ marginTop: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters({ loyaltyTier: '', isVIP: '' });
                setShowFilters(false);
              }}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                fetchGuests(1, searchQuery);
                setShowFilters(false);
              }}
            >
              Apply filters
            </Button>
          </div>
        </Panel>
      )}

      <FilterBar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name, email, or phone…"
      />

      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height="180px" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => fetchGuests(pagination.page, searchQuery)} />
      ) : guests.length === 0 ? (
        <EmptyState
          icon={<User size={28} strokeWidth={1.6} />}
          title={isSearching ? 'No guests found' : 'No guests yet'}
          description={
            isSearching
              ? 'Try adjusting your search terms'
              : 'Guests appear automatically once they book through any channel'
          }
        />
      ) : (
        <>
          <div className={styles.grid}>
            {guests.map((guest, idx) => {
              const identifier = guest.id || guest.email || guest.phone || guest.name;
              return (
                <button
                  type="button"
                  key={guest.id ?? idx}
                  onClick={() => navigate(`/guests/${encodeURIComponent(identifier)}`)}
                  className={`${styles.card} ${guest.isVIP ? styles.cardVip : ''}`}
                >
                  {guest.isVIP && (
                    <div className={styles.vipBadge}>
                      <Star size={11} fill="currentColor" />
                      VIP
                    </div>
                  )}
                  <h3 className={styles.name}>{guest.name}</h3>
                  <div className={styles.loyalty}>
                    {guest.loyaltyTier && <LoyaltyBadge tier={guest.loyaltyTier} size="sm" />}
                  </div>
                  <div className={styles.contact}>
                    {guest.email && (
                      <div className={styles.contactRow}>
                        <Mail size={14} />
                        {guest.email}
                      </div>
                    )}
                    {guest.phone && (
                      <div className={styles.contactRow}>
                        <Phone size={14} />
                        {guest.phone}
                      </div>
                    )}
                  </div>
                  <div className={styles.stats}>
                    <div>
                      <div className={styles.statLabel}>Stays</div>
                      <div className={styles.statValue}>{guest.totalStays || 0}</div>
                    </div>
                    <div>
                      <div className={styles.statLabel}>Points</div>
                      <div className={styles.statValueAccent}>
                        {guest.loyaltyPoints?.toLocaleString() || 0}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {!isSearching && pagination.totalPages > 1 && (
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                limit={pagination.limit}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              />
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
