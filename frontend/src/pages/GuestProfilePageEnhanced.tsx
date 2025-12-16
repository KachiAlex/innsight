import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import { 
  ArrowLeft, Mail, Phone, User, Calendar, MapPin, Star,
  Edit, Activity, FileText, Gift 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CardSkeleton } from '../components/LoadingSkeleton';
import { format } from 'date-fns';
import LoyaltyBadge from '../components/LoyaltyBadge';
import ActivityTimeline from '../components/ActivityTimeline';
import GuestNotes from '../components/GuestNotes';
import LoyaltySection from '../components/LoyaltySection';
import Button from '../components/Button';
import GuestFormModal from '../components/GuestFormModal';

interface GuestProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  dateOfBirth?: Date;
  nationality?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalNights: number;
  totalSpent: number;
  
  preferredRoomType?: string;
  preferredFloor?: number;
  smokingPreference?: boolean;
  bedPreference?: string;
  pillowPreference?: string;
  
  dietaryRestrictions?: string[];
  allergies?: string[];
  specialRequests?: string;
  
  isVIP: boolean;
  isBanned: boolean;
  bannedReason?: string;
  
  firstStayDate?: Date;
  lastStayDate?: Date;
  
  reservations: any[];
  activityLogs: any[];
  notes: any[];
  loyaltyTransactions: any[];
}

type TabType = 'overview' | 'activity' | 'notes' | 'loyalty';

export default function GuestProfilePageEnhanced() {
  const { identifier } = useParams<{ identifier: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showEditModal, setShowEditModal] = useState(false);

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

  const handleUpdateGuest = async (data: any) => {
    try {
      await api.post(`/tenants/${user?.tenantId}/guests`, data);
      toast.success('Guest updated successfully');
      setShowEditModal(false);
      fetchGuestProfile();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update guest');
      throw error;
    }
  };

  const handleToggleVIP = async () => {
    if (!profile) return;
    
    try {
      await api.post(`/tenants/${user?.tenantId}/guests`, {
        ...profile,
        isVIP: !profile.isVIP,
      });
      toast.success(profile.isVIP ? 'VIP status removed' : 'Marked as VIP');
      fetchGuestProfile();
    } catch (error: any) {
      toast.error('Failed to update VIP status');
    }
  };

  const handleAddNote = async (noteData: any) => {
    try {
      await api.post(`/tenants/${user?.tenantId}/guests/${identifier}/notes`, noteData);
      fetchGuestProfile();
    } catch (error: any) {
      toast.error('Failed to add note');
      throw error;
    }
  };

  const handleUpdateNote = async (noteId: string, noteData: any) => {
    try {
      await api.put(`/tenants/${user?.tenantId}/guests/${identifier}/notes/${noteId}`, noteData);
      fetchGuestProfile();
    } catch (error: any) {
      toast.error('Failed to update note');
      throw error;
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await api.delete(`/tenants/${user?.tenantId}/guests/${identifier}/notes/${noteId}`);
      fetchGuestProfile();
    } catch (error: any) {
      toast.error('Failed to delete note');
      throw error;
    }
  };

  const handleAwardPoints = async (points: number, description: string) => {
    try {
      await api.post(`/tenants/${user?.tenantId}/guests/${identifier}/loyalty`, {
        points,
        description,
      });
      fetchGuestProfile();
    } catch (error: any) {
      toast.error('Failed to process points');
      throw error;
    }
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
          <p>Guest not found</p>
        </div>
      </Layout>
    );
  }

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

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'notes', label: 'Notes', icon: FileText },
    { id: 'loyalty', label: 'Loyalty', icon: Gift },
  ];

  return (
    <Layout>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <button
            onClick={() => navigate('/guests')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#64748b',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              padding: '0.5rem 0',
            }}
          >
            <ArrowLeft size={16} />
            Back to Guests
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                <h1 style={{ margin: 0, color: '#1e293b' }}>{profile.name}</h1>
                {profile.isVIP && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.375rem 0.75rem',
                    backgroundColor: '#faf5ff',
                    color: '#9333ea',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    border: '1px solid #e9d5ff',
                  }}>
                    <Star size={14} fill="#9333ea" />
                    VIP Guest
                  </div>
                )}
                <LoyaltyBadge tier={profile.loyaltyTier as any} />
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', color: '#64748b', fontSize: '0.875rem' }}>
                {profile.email && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Mail size={16} />
                    {profile.email}
                  </div>
                )}
                {profile.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Phone size={16} />
                    {profile.phone}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button variant="secondary" onClick={() => setShowEditModal(true)}>
                <Edit size={16} />
                Edit
              </Button>
              <Button 
                variant={profile.isVIP ? "ghost" : "primary"} 
                onClick={handleToggleVIP}
              >
                <Star size={16} fill={profile.isVIP ? "currentColor" : "none"} />
                {profile.isVIP ? 'Remove VIP' : 'Mark as VIP'}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{
          borderBottom: '2px solid #e2e8f0',
          marginBottom: '2rem',
          display: 'flex',
          gap: '2rem',
        }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '1rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9375rem',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? '#3b82f6' : '#64748b',
                  borderBottom: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  marginBottom: '-2px',
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gap: '1.5rem' }}>
            {/* Statistics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Stays</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>{profile.totalStays}</div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Nights</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>{profile.totalNights}</div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Total Spent</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e293b' }}>₦{profile.totalSpent?.toLocaleString()}</div>
              </div>
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>Loyalty Points</div>
                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#9333ea' }}>{profile.loyaltyPoints?.toLocaleString()}</div>
              </div>
            </div>

            {/* Guest Information */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1.5rem' }}>
              {/* Personal Info */}
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={20} />
                  Personal Information
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                  {profile.idNumber && (
                    <div>
                      <span style={{ color: '#64748b' }}>ID Number:</span> <span style={{ fontWeight: '500' }}>{profile.idNumber}</span>
                    </div>
                  )}
                  {profile.dateOfBirth && (
                    <div>
                      <span style={{ color: '#64748b' }}>Date of Birth:</span> <span style={{ fontWeight: '500' }}>{format(new Date(profile.dateOfBirth), 'MMM d, yyyy')}</span>
                    </div>
                  )}
                  {profile.nationality && (
                    <div>
                      <span style={{ color: '#64748b' }}>Nationality:</span> <span style={{ fontWeight: '500' }}>{profile.nationality}</span>
                    </div>
                  )}
                  {(profile.firstStayDate || profile.lastStayDate) && (
                    <>
                      {profile.firstStayDate && (
                        <div>
                          <span style={{ color: '#64748b' }}>First Stay:</span> <span style={{ fontWeight: '500' }}>{format(new Date(profile.firstStayDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {profile.lastStayDate && (
                        <div>
                          <span style={{ color: '#64748b' }}>Last Stay:</span> <span style={{ fontWeight: '500' }}>{format(new Date(profile.lastStayDate), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Address */}
              {(profile.address || profile.city || profile.country) && (
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <MapPin size={20} />
                    Address
                  </h3>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: '1.6' }}>
                    {profile.address && <div>{profile.address}</div>}
                    <div>
                      {[profile.city, profile.state, profile.postalCode].filter(Boolean).join(', ')}
                    </div>
                    {profile.country && <div>{profile.country}</div>}
                  </div>
                </div>
              )}

              {/* Preferences */}
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Calendar size={20} />
                  Preferences
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
                  {profile.preferredRoomType && (
                    <div>
                      <span style={{ color: '#64748b' }}>Room Type:</span> <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{profile.preferredRoomType}</span>
                    </div>
                  )}
                  {profile.preferredFloor && (
                    <div>
                      <span style={{ color: '#64748b' }}>Floor:</span> <span style={{ fontWeight: '500' }}>{profile.preferredFloor}</span>
                    </div>
                  )}
                  {profile.bedPreference && (
                    <div>
                      <span style={{ color: '#64748b' }}>Bed:</span> <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{profile.bedPreference}</span>
                    </div>
                  )}
                  {profile.pillowPreference && (
                    <div>
                      <span style={{ color: '#64748b' }}>Pillow:</span> <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>{profile.pillowPreference}</span>
                    </div>
                  )}
                  {profile.smokingPreference && (
                    <div style={{ color: '#f59e0b', fontWeight: '500' }}>Smoking Preference</div>
                  )}
                </div>
              </div>

              {/* Dietary & Allergies */}
              {((profile.dietaryRestrictions && profile.dietaryRestrictions.length > 0) || 
                (profile.allergies && profile.allergies.length > 0) ||
                profile.specialRequests) && (
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Dietary & Special Requests</h3>
                  {profile.dietaryRestrictions && profile.dietaryRestrictions.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem' }}>Dietary Restrictions:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {profile.dietaryRestrictions.map((item, idx) => (
                          <span key={idx} style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '4px',
                          }}>{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.allergies && profile.allergies.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#ef4444', marginBottom: '0.25rem', fontWeight: '600' }}>⚠️ Allergies:</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {profile.allergies.map((item, idx) => (
                          <span key={idx} style={{
                            fontSize: '0.75rem',
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '4px',
                            fontWeight: '600',
                          }}>{item}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.specialRequests && (
                    <div style={{ fontSize: '0.875rem', color: '#64748b', fontStyle: 'italic' }}>
                      "{profile.specialRequests}"
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Reservations */}
            {profile.reservations && profile.reservations.length > 0 && (
              <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>Recent Reservations</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {profile.reservations.slice(0, 5).map((reservation) => (
                    <div
                      key={reservation.id}
                      style={{
                        padding: '1rem',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                          {reservation.reservationNumber}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                          {reservation.checkInDate && format(new Date(reservation.checkInDate), 'MMM d')} - {reservation.checkOutDate && format(new Date(reservation.checkOutDate), 'MMM d, yyyy')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: `${getStatusColor(reservation.status)}15`,
                            color: getStatusColor(reservation.status),
                            textTransform: 'capitalize',
                            marginBottom: '0.25rem',
                          }}
                        >
                          {reservation.status.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>
                          ₦{reservation.rate?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <ActivityTimeline activities={profile.activityLogs || []} />
          </div>
        )}

        {activeTab === 'notes' && (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <GuestNotes
              notes={profile.notes || []}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
            />
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div style={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <LoyaltySection
              currentPoints={profile.loyaltyPoints || 0}
              loyaltyTier={profile.loyaltyTier}
              transactions={profile.loyaltyTransactions || []}
              onAwardPoints={handleAwardPoints}
            />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <GuestFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdateGuest}
        initialData={profile}
        isLoading={loading}
      />
    </Layout>
  );
}

