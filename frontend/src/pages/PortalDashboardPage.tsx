import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  LogOut,
  Mail,
  Phone,
  RefreshCcw,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import toast from 'react-hot-toast';
import GuestSignupModal from '../components/GuestSignupModal';
import { useCustomerSession } from '../hooks/useCustomerSession';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
};

const statusColorMap: Record<string, string> = {
  confirmed: '#22d3ee',
  checked_in: '#34d399',
  checked_out: '#a855f7',
  canceled: '#f87171',
};

const PortalDashboardPage = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const navigate = useNavigate();
  const { loading, error, profile, hasReservation, hasGuestAccount, refresh } = useCustomerSession(tenantSlug);
  const clearAuth = useCustomerAuthStore((state) => state.clear);
  const [signupOpen, setSignupOpen] = useState(false);

  const reservations = useMemo(() => {
    const list = [...(profile?.reservations || [])];
    if (profile?.reservation) {
      const exists = list.find((res) => res.id === profile.reservation!.id);
      if (!exists) {
        list.unshift(profile.reservation);
      }
    }
    return list.sort((a, b) => {
      const aDate = new Date(a.checkInDate || 0).getTime();
      const bDate = new Date(b.checkInDate || 0).getTime();
      return aDate - bDate;
    });
  }, [profile]);

  const primaryReservation = reservations[0];
  const guestAccount = profile?.guestAccount;
  const guestName =
    primaryReservation?.guestName || guestAccount?.email?.split('@')?.[0] || 'Guest';

  const handleSignOut = () => {
    clearAuth();
    toast.success('Signed out of guest portal.');
    if (tenantSlug) {
      navigate(`/portal/${tenantSlug}/access`, { replace: true });
    } else {
      navigate('/');
    }
  };

  const pristineState = !loading && !hasReservation && !hasGuestAccount;

  const renderReservationCard = (reservation: any) => {
    const statusColor = statusColorMap[reservation.status || ''] || '#94a3b8';
    return (
      <div
        key={reservation.id}
        style={{
          borderRadius: '20px',
          padding: '1.25rem',
          background: 'rgba(255,255,255,0.96)',
          border: '1px solid rgba(15,23,42,0.08)',
          boxShadow: '0 15px 30px rgba(15,23,42,0.08)',
          display: 'grid',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} color="#0f172a" />
            <p style={{ margin: 0, fontWeight: 600 }}>{reservation.reservationNumber || 'Reservation'}</p>
          </div>
          <span
            style={{
              padding: '0.25rem 0.85rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: statusColor === '#94a3b8' ? '#0f172a' : '#0f172a',
              background: `${statusColor}33`,
              border: `1px solid ${statusColor}55`,
            }}
          >
            {reservation.status?.replace('_', ' ') || 'pending'}
          </span>
        </div>
        <p style={{ margin: 0, color: '#475569' }}>
          {formatDate(reservation.checkInDate)} → {formatDate(reservation.checkOutDate)}
        </p>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.9rem' }}>
          {reservation.room?.roomNumber
            ? `Room ${reservation.room.roomNumber}`
            : reservation.room?.roomType || 'Room assigned on arrival'}
        </p>
        {typeof reservation.balance === 'number' && (
          <p style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>
            Outstanding balance: ₦{reservation.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 0% 0%, rgba(14,165,233,0.25), transparent 55%), radial-gradient(circle at 100% 0%, rgba(244,114,182,0.2), transparent 45%), #f8fafc',
        padding: '2rem 1rem',
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gap: '1.5rem' }}>
        <header
          style={{
            borderRadius: '32px',
            padding: '2rem',
            background: '#0f172a',
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p style={{ margin: 0, letterSpacing: '0.2em', fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                DIY PORTAL
              </p>
              <h1 style={{ margin: '0.3rem 0 0', fontSize: '2.2rem', letterSpacing: '-0.03em' }}>
                Welcome back, {guestName}
              </h1>
              <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.7)' }}>
                {tenantSlug?.replace(/[-_]/g, ' ') || 'Your stay'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.7rem 1.3rem',
                  background: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
                onClick={() => refresh()}
              >
                <RefreshCcw size={16} />
                Refresh
              </button>
              <button
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  padding: '0.7rem 1.3rem',
                  background: 'rgba(244,114,182,0.2)',
                  color: '#fff',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
                onClick={handleSignOut}
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div
              style={{
                borderRadius: '999px',
                padding: '0.35rem 0.9rem',
                background: 'rgba(255,255,255,0.15)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.9rem',
              }}
            >
              <Mail size={16} />
              {guestAccount?.email || primaryReservation?.guestEmail || 'No email on file'}
            </div>
            {primaryReservation?.guestPhone && (
              <div
                style={{
                  borderRadius: '999px',
                  padding: '0.35rem 0.9rem',
                  background: 'rgba(255,255,255,0.15)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.9rem',
                }}
              >
                <Phone size={16} />
                {primaryReservation.guestPhone}
              </div>
            )}
            <div
              style={{
                borderRadius: '999px',
                padding: '0.35rem 0.9rem',
                background: guestAccount?.isEmailVerified ? 'rgba(34,197,94,0.25)' : 'rgba(250,204,21,0.25)',
                color: guestAccount?.isEmailVerified ? '#bbf7d0' : '#fef9c3',
                fontSize: '0.9rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <ShieldCheck size={16} />
              {guestAccount?.isEmailVerified ? 'Email verified' : 'Email not verified'}
            </div>
          </div>
        </header>

        {error && (
          <div
            style={{
              borderRadius: '20px',
              padding: '1rem',
              background: 'rgba(248,113,113,0.12)',
              color: '#b91c1c',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              flexWrap: 'wrap',
            }}
          >
            <span>{error}</span>
            <button
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '0.5rem 1.2rem',
                background: '#b91c1c',
                color: '#fff',
                cursor: 'pointer',
              }}
              onClick={() => refresh()}
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div
            style={{
              borderRadius: '24px',
              padding: '2rem',
              background: '#fff',
              border: '1px solid rgba(15,23,42,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
            }}
          >
            <LoaderSpinner />
            <span style={{ color: '#475569' }}>Loading your dashboard…</span>
          </div>
        )}

        {!loading && pristineState && (
          <div
            style={{
              borderRadius: '28px',
              padding: '2rem',
              background: '#fff',
              border: '1px dashed rgba(15,23,42,0.2)',
              textAlign: 'center',
              color: '#475569',
            }}
          >
            <UserRound size={36} color="#0f172a" />
            <h2 style={{ margin: '1rem 0 0.5rem', color: '#0f172a' }}>No activity yet</h2>
            <p style={{ margin: 0 }}>Link a reservation or create an account to see your stays here.</p>
          </div>
        )}

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div
              style={{
                borderRadius: '24px',
                padding: '1.5rem',
                background: '#fff',
                border: '1px solid rgba(15,23,42,0.08)',
                minHeight: '240px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <CheckCircle2 color="#0f172a" />
                <h3 style={{ margin: 0, color: '#0f172a' }}>Reservations</h3>
              </div>
              <p style={{ margin: '0.5rem 0 1rem', color: '#64748b' }}>
                Track your upcoming and recent stays.
              </p>
              {reservations.length === 0 && (
                <p style={{ margin: 0, color: '#94a3b8' }}>
                  Nothing here yet. Link a reservation from the access page.
                </p>
              )}
              <div style={{ display: 'grid', gap: '1rem' }}>
                {reservations.map(renderReservationCard)}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div
              style={{
                borderRadius: '24px',
                padding: '1.5rem',
                background: '#fff',
                border: '1px solid rgba(15,23,42,0.08)',
                minHeight: '200px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShieldCheck color="#0f172a" />
                <h3 style={{ margin: 0, color: '#0f172a' }}>Account security</h3>
              </div>
              <p style={{ margin: '0.5rem 0 1rem', color: '#64748b' }}>
                {hasGuestAccount
                  ? 'Your account is active. Keep your contact details up to date.'
                  : 'Create a password to save preferences and download receipts anytime.'}
              </p>
              {!hasGuestAccount && tenantSlug && (
                <button
                  style={{
                    border: 'none',
                    borderRadius: '999px',
                    padding: '0.85rem 1.5rem',
                    background: '#0f172a',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSignupOpen(true)}
                >
                  Secure my account
                </button>
              )}
              {hasGuestAccount && (
                <div style={{ display: 'grid', gap: '0.5rem', color: '#475569' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Mail size={16} />
                    Email {guestAccount?.isEmailVerified ? 'verified' : 'not verified'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Phone size={16} />
                    {guestAccount?.phone || 'No phone on file'}
                  </div>
                </div>
              )}
            </div>

            {primaryReservation && !hasGuestAccount && (
              <div
                style={{
                  borderRadius: '24px',
                  padding: '1.5rem',
                  background: 'rgba(14,165,233,0.08)',
                  border: '1px dashed rgba(14,165,233,0.4)',
                }}
              >
                <h3 style={{ margin: '0 0 0.4rem', color: '#0f172a' }}>Save this booking</h3>
                <p style={{ margin: 0, color: '#475569' }}>
                  Create a password so you never lose access to reservation {primaryReservation.reservationNumber}.
                </p>
                <button
                  style={{
                    border: 'none',
                    marginTop: '0.9rem',
                    borderRadius: '999px',
                    padding: '0.75rem 1.4rem',
                    background: '#0f172a',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSignupOpen(true)}
                >
                  Create my account
                </button>
              </div>
            )}
          </div>
        </section>
      </div>

      <GuestSignupModal
        tenantSlug={tenantSlug}
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        defaultName={primaryReservation?.guestName}
        defaultEmail={guestAccount?.email || primaryReservation?.guestEmail}
        defaultPhone={guestAccount?.phone || primaryReservation?.guestPhone}
        autoRedirect={false}
        onSuccess={() => {
          toast.success('Account linked successfully.');
          refresh();
        }}
      />
    </div>
  );
};

const LoaderSpinner = () => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <circle cx="12" cy="12" r="10" stroke="#0f172a" strokeWidth="3" opacity="0.2" />
      <path d="M22 12a10 10 0 00-10-10" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  </div>
);

export default PortalDashboardPage;
