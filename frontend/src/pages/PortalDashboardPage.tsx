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
import { Button, EmptyState, Panel, Skeleton, StatusBadge } from '../components/ui';
import styles from './PortalDashboardPage.module.css';

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
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
      if (!exists) list.unshift(profile.reservation);
    }
    return list.sort((a, b) => {
      const aDate = new Date(a.checkInDate || 0).getTime();
      const bDate = new Date(b.checkInDate || 0).getTime();
      return aDate - bDate;
    });
  }, [profile]);

  const primaryReservation = reservations[0];
  const guestAccount = profile?.guestAccount;
  const guestName = primaryReservation?.guestName || guestAccount?.email?.split('@')?.[0] || 'Guest';

  const handleSignOut = () => {
    clearAuth();
    toast.success('Signed out of guest portal.');
    navigate(tenantSlug ? `/portal/${tenantSlug}/access` : '/', { replace: true });
  };

  const pristineState = !loading && !hasReservation && !hasGuestAccount;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cloud)', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }} className="stack">
        <header className={styles.hero}>
          <div className={styles.heroRow}>
            <div>
              <p className={styles.heroEyebrow}>GUEST PORTAL</p>
              <h1 className={styles.heroTitle}>Welcome back, {guestName}</h1>
              <p className={styles.heroSub}>{tenantSlug?.replace(/[-_]/g, ' ') || 'Your stay'}</p>
            </div>
            <div className="row">
              <button className={styles.heroBtn} onClick={() => refresh()}>
                <RefreshCcw size={15} />
                Refresh
              </button>
              <button className={styles.heroBtn} onClick={handleSignOut}>
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          </div>
          <div className={styles.heroChips}>
            <span className={styles.chip}>
              <Mail size={14} />
              {guestAccount?.email || primaryReservation?.guestEmail || 'No email on file'}
            </span>
            {primaryReservation?.guestPhone && (
              <span className={styles.chip}>
                <Phone size={14} />
                {primaryReservation.guestPhone}
              </span>
            )}
            <span className={`${styles.chip} ${guestAccount?.isEmailVerified ? styles.chipOk : styles.chipWarn}`}>
              <ShieldCheck size={14} />
              {guestAccount?.isEmailVerified ? 'Email verified' : 'Email not verified'}
            </span>
          </div>
        </header>

        {error && (
          <div className="row-between" style={{ padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)', background: 'rgba(185,28,28,0.08)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
            <span className="text-sm">{error}</span>
            <Button variant="danger" size="sm" onClick={() => refresh()}>Retry</Button>
          </div>
        )}

        {loading && <Skeleton height="220px" />}

        {pristineState && (
          <Panel>
            <EmptyState
              icon={<UserRound size={28} strokeWidth={1.6} />}
              title="No activity yet"
              description="Link a reservation or create an account to see your stays here."
            />
          </Panel>
        )}

        {!loading && !pristineState && (
          <section className={styles.resGrid}>
            <Panel title="Reservations" subtitle="Your upcoming and recent stays">
              {reservations.length === 0 ? (
                <p className="text-sm muted">Nothing here yet. Link a reservation from the access page.</p>
              ) : (
                <div className="stack" style={{ gap: 'var(--space-3)' }}>
                  {reservations.map((reservation: any) => (
                    <div key={reservation.id} className={styles.resCard}>
                      <div className="row-between">
                        <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={15} />
                          {reservation.reservationNumber || 'Reservation'}
                        </span>
                        <StatusBadge status={reservation.status} dot={false}>
                          {reservation.status?.replace(/_/g, ' ') || 'pending'}
                        </StatusBadge>
                      </div>
                      <p className="text-sm muted" style={{ margin: 0 }}>
                        {formatDate(reservation.checkInDate)} → {formatDate(reservation.checkOutDate)}
                      </p>
                      <p className="text-xs muted" style={{ margin: 0 }}>
                        {reservation.room?.roomNumber
                          ? `Room ${reservation.room.roomNumber}`
                          : reservation.room?.roomType || 'Room assigned on arrival'}
                      </p>
                      {typeof reservation.balance === 'number' && (
                        <p className="text-sm" style={{ margin: 0, fontWeight: 600 }}>
                          Outstanding balance: ₦{reservation.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <div className="stack">
              <Panel title="Account security">
                <p className="text-sm muted">
                  {hasGuestAccount
                    ? 'Your account is active. Keep your contact details up to date.'
                    : 'Create a password to save preferences and download receipts anytime.'}
                </p>
                {!hasGuestAccount && tenantSlug && (
                  <Button variant="primary" onClick={() => setSignupOpen(true)}>
                    Secure my account
                  </Button>
                )}
                {hasGuestAccount && (
                  <div className="stack" style={{ gap: 'var(--space-2)' }}>
                    <span className="text-sm row">
                      <Mail size={15} />
                      Email {guestAccount?.isEmailVerified ? 'verified' : 'not verified'}
                    </span>
                    <span className="text-sm row">
                      <Phone size={15} />
                      {guestAccount?.phone || 'No phone on file'}
                    </span>
                  </div>
                )}
              </Panel>

              {primaryReservation && !hasGuestAccount && (
                <Panel>
                  <div className="row" style={{ marginBottom: 'var(--space-2)' }}>
                    <CheckCircle2 size={18} />
                    <strong>Save this booking</strong>
                  </div>
                  <p className="text-sm muted">
                    Create a password so you never lose access to reservation {primaryReservation.reservationNumber}.
                  </p>
                  <Button variant="secondary" onClick={() => setSignupOpen(true)}>
                    Create my account
                  </Button>
                </Panel>
              )}
            </div>
          </section>
        )}
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

export default PortalDashboardPage;
