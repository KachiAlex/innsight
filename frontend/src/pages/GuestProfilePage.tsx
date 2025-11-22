import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { ArrowLeft, Mail, Phone, User, Calendar, DollarSign, Moon, TrendingUp, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { format } from 'date-fns';
import SearchInput from '../components/SearchInput';

interface GuestProfile {
  name: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  statistics: {
    totalStays: number;
    totalNights: number;
    totalSpent: number;
    averageStayLength: number;
    averageSpent: number;
    firstStay?: Date;
    lastStay?: Date;
  };
  preferences: {
    preferredRoomType?: string;
    roomTypeFrequency: Record<string, number>;
    commonSpecialRequests: string[];
    preferredSource?: string;
  };
  reservations: Array<{
    id: string;
    reservationNumber: string;
    checkInDate?: Date;
    checkOutDate?: Date;
    status: string;
    rate: number;
    room?: {
      roomNumber?: string;
      roomType?: string;
    };
  }>;
  folios: Array<{
    id: string;
    totalCharges: number;
    totalPayments: number;
    balance: number;
    status: string;
  }>;
}

export default function GuestProfilePage() {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user?.tenantId || !identifier) return;
    fetchGuestProfile();
  }, [user, identifier]);

  const fetchGuestProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/tenants/${user?.tenantId}/guests/${identifier}`);
      setProfile(response.data.data);
    } catch (error: any) {
      console.error('Failed to fetch guest profile:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch guest profile');
      if (error.response?.status === 404) {
        navigate('/guests');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user?.tenantId) return;
    navigate(`/guests/${encodeURIComponent(searchQuery.trim())}`);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: '#3b82f6',
      checked_in: '#10b981',
      checked_out: '#64748b',
      cancelled: '#ef4444',
      no_show: '#f59e0b',
    };
    return colors[status] || '#94a3b8';
  };

  if (loading) {
    return (
      <Layout>
        <div>
          <CardSkeleton count={3} />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <User size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: '#64748b' }} />
          <p style={{ color: '#64748b', fontSize: '1.125rem' }}>Guest not found</p>
          <button
            onClick={() => navigate('/guests')}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Back to Guests
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <button
          onClick={() => navigate('/guests')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1.5rem',
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >
          <ArrowLeft size={16} />
          Back to Guests
        </button>

        {/* Guest Header */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <h1 style={{ margin: 0, color: '#1e293b', fontSize: '2rem', fontWeight: '700' }}>
                {profile.name}
              </h1>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
                {profile.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <Mail size={16} />
                    <span>{profile.email}</span>
                  </div>
                )}
                {profile.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <Phone size={16} />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.idNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                    <User size={16} />
                    <span>ID: {profile.idNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Statistics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Stays</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                {profile.statistics.totalStays}
              </div>
            </div>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Nights</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                {profile.statistics.totalNights}
              </div>
            </div>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Spent</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                ₦{profile.statistics.totalSpent.toLocaleString()}
              </div>
            </div>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px' }}>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Avg. Stay Length</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
                {profile.statistics.averageStayLength} nights
              </div>
            </div>
            {profile.statistics.firstStay && (
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>First Stay</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                  {format(profile.statistics.firstStay, 'MMM d, yyyy')}
                </div>
              </div>
            )}
            {profile.statistics.lastStay && (
              <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '6px' }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Last Stay</div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                  {format(profile.statistics.lastStay, 'MMM d, yyyy')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preferences */}
        {Object.keys(profile.preferences.roomTypeFrequency).length > 0 && (
          <div
            style={{
              background: 'white',
              borderRadius: '8px',
              padding: '1.5rem',
              marginBottom: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <h2 style={{ margin: '0 0 1rem', color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>
              Preferences
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
              {profile.preferences.preferredRoomType && (
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Preferred Room Type</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                    {profile.preferences.preferredRoomType}
                  </div>
                </div>
              )}
              {profile.preferences.preferredSource && (
                <div>
                  <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Preferred Source</div>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1e293b' }}>
                    {profile.preferences.preferredSource}
                  </div>
                </div>
              )}
            </div>
            {profile.preferences.commonSpecialRequests.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '0.5rem' }}>Common Requests</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {profile.preferences.commonSpecialRequests.map((request, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '0.25rem 0.75rem',
                        background: '#f1f5f9',
                        borderRadius: '12px',
                        fontSize: '0.875rem',
                        color: '#475569',
                      }}
                    >
                      {request}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reservation History */}
        <div
          style={{
            background: 'white',
            borderRadius: '8px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          <h2 style={{ margin: '0 0 1rem', color: '#1e293b', fontSize: '1.25rem', fontWeight: '600' }}>
            Reservation History ({profile.reservations.length})
          </h2>
          {profile.reservations.length === 0 ? (
            <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>No reservations found</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {profile.reservations.map((reservation) => (
                <div
                  key={reservation.id}
                  style={{
                    padding: '1rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: '#1e293b', marginBottom: '0.25rem' }}>
                          {reservation.reservationNumber}
                        </div>
                        {reservation.room && (
                          <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                            Room {reservation.room.roomNumber} • {reservation.room.roomType}
                          </div>
                        )}
                      </div>
                      {reservation.checkInDate && reservation.checkOutDate && (
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          <Calendar size={14} style={{ display: 'inline', marginRight: '0.25rem' }} />
                          {format(reservation.checkInDate, 'MMM d')} - {format(reservation.checkOutDate, 'MMM d, yyyy')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '600', color: '#1e293b' }}>₦{reservation.rate.toLocaleString()}</div>
                      <span
                        style={{
                          padding: '0.25rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          background: getStatusColor(reservation.status) + '20',
                          color: getStatusColor(reservation.status),
                        }}
                      >
                        {reservation.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


