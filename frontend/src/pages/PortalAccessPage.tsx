import { FormEvent, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  loginWithReservationDetails,
  loginCustomerWithPassword,
  requestReservationOtp,
  verifyReservationOtp,
} from '../lib/publicCustomerApi';
import GuestSignupModal from '../components/GuestSignupModal';
import { useCustomerAuthStore } from '../store/customerAuthStore';

const wrapperStyle: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top, rgba(14,165,233,0.2), transparent 45%), radial-gradient(circle at 20% 20%, rgba(168,85,247,0.2), transparent 35%), #f8fafc',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '2rem 1rem',
  fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
};

const cardStyle: React.CSSProperties = {
  width: 'min(960px, 100%)',
  background: '#fff',
  borderRadius: '32px',
  padding: '2.5rem',
  boxShadow: '0 40px 120px rgba(15, 23, 42, 0.18)',
  display: 'grid',
  gap: '2rem',
};

const tabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap',
};

const tabButton = (active: boolean): React.CSSProperties => ({
  flex: 1,
  minWidth: '140px',
  borderRadius: '999px',
  border: '1px solid rgba(15,23,42,0.12)',
  background: active ? '#0f172a' : '#fff',
  color: active ? '#fff' : '#0f172a',
  padding: '0.9rem 1rem',
  fontWeight: 600,
  cursor: 'pointer',
});

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 600,
  marginBottom: '0.3rem',
  color: '#0f172a',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '16px',
  border: '1px solid rgba(15,23,42,0.12)',
  padding: '0.9rem 1rem',
  fontSize: '0.95rem',
  outline: 'none',
};

const submitButtonStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: '999px',
  border: 'none',
  padding: '1rem',
  fontWeight: 600,
  background: 'linear-gradient(120deg, #0f172a, #1d4ed8)',
  color: '#fff',
  cursor: 'pointer',
};

type AccessTab = 'reservation' | 'otp' | 'password';

const PortalAccessPage = () => {
  const { tenantSlug } = useParams();
  const navigate = useNavigate();
  const setAuthFromResponse = useCustomerAuthStore((state) => state.setAuthFromResponse);
  const [activeTab, setActiveTab] = useState<AccessTab>('reservation');
  const [signupOpen, setSignupOpen] = useState(false);

  const [reservationForm, setReservationForm] = useState({
    reservationNumber: '',
    email: '',
    phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({ email: '', password: '' });
  const [otpRequest, setOtpRequest] = useState({ reservationNumber: '', channel: 'email' as 'email' | 'sms' });
  const [otpVerify, setOtpVerify] = useState({ code: '', reservationNumber: '', channel: 'email' as 'email' | 'sms' });
  const [otpStage, setOtpStage] = useState<'request' | 'verify'>('request');
  const [otpDestination, setOtpDestination] = useState<string | null>(null);

  const [loading, setLoading] = useState<AccessTab | 'otp-request' | 'otp-verify' | null>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const heading = useMemo(() => {
    if (!tenantSlug) return 'Access your stay';
    const formatted = tenantSlug.replace(/[-_]/g, ' ');
    return `Access your stay at ${formatted}`;
  }, [tenantSlug]);

  const ensureTenant = () => {
    if (!tenantSlug) {
      toast.error('Missing property information. Please use the invite link.');
      return false;
    }
    return true;
  };

  const handleSuccess = (response: any) => {
    if (!tenantSlug) return;
    setAuthFromResponse(tenantSlug, response);
    toast.success('Welcome back!');
    navigate(`/portal/${tenantSlug}/dashboard`, { replace: true });
  };

  const handleReservationLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!ensureTenant()) return;
    setLoading('reservation');
    setErrors((prev) => ({ ...prev, reservation: null }));
    try {
      const response = await loginWithReservationDetails(tenantSlug!, {
        reservationNumber: reservationForm.reservationNumber.trim(),
        email: reservationForm.email.trim() || undefined,
        phone: reservationForm.phone.trim() || undefined,
      });
      handleSuccess(response);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || 'Unable to find that reservation.';
      setErrors((prev) => ({ ...prev, reservation: message }));
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const handlePasswordLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!ensureTenant()) return;
    setLoading('password');
    setErrors((prev) => ({ ...prev, password: null }));
    try {
      const response = await loginCustomerWithPassword(tenantSlug!, {
        email: passwordForm.email.trim(),
        password: passwordForm.password,
      });
      handleSuccess(response);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || 'Invalid credentials.';
      setErrors((prev) => ({ ...prev, password: message }));
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const requestOtpCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!ensureTenant()) return;
    setLoading('otp-request');
    setErrors((prev) => ({ ...prev, otp: null }));
    try {
      const response = await requestReservationOtp(tenantSlug!, otpRequest);
      setOtpStage('verify');
      setOtpDestination(response.data?.destination || null);
      setOtpVerify((prev) => ({ ...prev, reservationNumber: otpRequest.reservationNumber, channel: otpRequest.channel }));
      toast.success('OTP sent successfully.');
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || 'Unable to send OTP right now.';
      setErrors((prev) => ({ ...prev, otp: message }));
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const verifyOtpCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!ensureTenant()) return;
    setLoading('otp-verify');
    setErrors((prev) => ({ ...prev, otp: null }));
    try {
      const response = await verifyReservationOtp(tenantSlug!, {
        reservationNumber: otpVerify.reservationNumber,
        code: otpVerify.code,
      });
      handleSuccess(response);
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || 'Invalid code. Please try again.';
      setErrors((prev) => ({ ...prev, otp: message }));
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const renderReservationForm = () => (
    <form onSubmit={handleReservationLogin} style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Reservation number</label>
        <input
          style={inputStyle}
          value={reservationForm.reservationNumber}
          onChange={(e) =>
            setReservationForm((prev) => ({ ...prev, reservationNumber: e.target.value }))
          }
          required
          placeholder="e.g. R1234"
        />
      </div>
      <div style={{ display: 'grid', gap: '0.8rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div>
          <label style={labelStyle}>Email on reservation</label>
          <input
            style={inputStyle}
            type="email"
            value={reservationForm.email}
            onChange={(e) => setReservationForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="guest@email.com"
          />
        </div>
        <div>
          <label style={labelStyle}>Phone on reservation</label>
          <input
            style={inputStyle}
            type="tel"
            value={reservationForm.phone}
            onChange={(e) => setReservationForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Optional"
          />
        </div>
      </div>
      {errors.reservation && <p style={{ color: '#b91c1c', margin: 0 }}>{errors.reservation}</p>}
      <button type="submit" style={submitButtonStyle} disabled={loading === 'reservation'}>
        {loading === 'reservation' ? 'Checking reservation…' : 'Access reservation'}
      </button>
    </form>
  );

  const renderOtpForm = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {otpStage === 'request' ? (
        <form onSubmit={requestOtpCode} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Reservation number</label>
            <input
              style={inputStyle}
              value={otpRequest.reservationNumber}
              onChange={(e) =>
                setOtpRequest((prev) => ({ ...prev, reservationNumber: e.target.value }))
              }
              required
            />
          </div>
          <div>
            <label style={labelStyle}>Delivery method</label>
            <select
              style={inputStyle}
              value={otpRequest.channel}
              onChange={(e) => setOtpRequest((prev) => ({ ...prev, channel: e.target.value as 'email' | 'sms' }))}
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </div>
          {errors.otp && <p style={{ color: '#b91c1c', margin: 0 }}>{errors.otp}</p>}
          <button type="submit" style={submitButtonStyle} disabled={loading === 'otp-request'}>
            {loading === 'otp-request' ? 'Sending code…' : 'Send access code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtpCode} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <p style={{ margin: 0, color: '#475569' }}>
              Enter the 6-digit code sent to <strong>{otpDestination || 'your contact'}</strong>.
            </p>
          </div>
          <div>
            <label style={labelStyle}>One-time code</label>
            <input
              style={inputStyle}
              value={otpVerify.code}
              onChange={(e) => setOtpVerify((prev) => ({ ...prev, code: e.target.value }))}
              required
              maxLength={6}
            />
          </div>
          {errors.otp && <p style={{ color: '#b91c1c', margin: 0 }}>{errors.otp}</p>}
          <button type="submit" style={submitButtonStyle} disabled={loading === 'otp-verify'}>
            {loading === 'otp-verify' ? 'Verifying…' : 'Verify & continue'}
          </button>
          <button
            type="button"
            onClick={() => {
              setOtpStage('request');
              setOtpDestination(null);
              setOtpVerify({ code: '', reservationNumber: '', channel: 'email' });
            }}
            style={{
              border: 'none',
              background: 'transparent',
              color: '#0f172a',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Start over
          </button>
        </form>
      )}
    </div>
  );

  const renderPasswordForm = () => (
    <form onSubmit={handlePasswordLogin} style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Email</label>
        <input
          style={inputStyle}
          type="email"
          value={passwordForm.email}
          onChange={(e) => setPasswordForm((prev) => ({ ...prev, email: e.target.value }))}
          required
        />
      </div>
      <div>
        <label style={labelStyle}>Password</label>
        <input
          style={inputStyle}
          type="password"
          value={passwordForm.password}
          onChange={(e) => setPasswordForm((prev) => ({ ...prev, password: e.target.value }))}
          required
        />
      </div>
      {errors.password && <p style={{ color: '#b91c1c', margin: 0 }}>{errors.password}</p>}
      <button type="submit" style={submitButtonStyle} disabled={loading === 'password'}>
        {loading === 'password' ? 'Signing in…' : 'Sign in to your account'}
      </button>
    </form>
  );

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        <div>
          <p style={{ margin: 0, color: '#64748b', letterSpacing: '0.2em', textTransform: 'uppercase', fontSize: '0.75rem' }}>
            DIY Portal Access
          </p>
          <h1 style={{ margin: '0.35rem 0 0.5rem', fontSize: '2.3rem', color: '#0f172a' }}>{heading}</h1>
          <p style={{ margin: 0, color: '#475569' }}>
            Verify your reservation, use a one-time passcode, or log into your saved guest account to manage stays.
          </p>
        </div>

        <div style={tabsStyle} role="tablist">
          {[
            { id: 'reservation', label: 'Reservation lookup' },
            { id: 'otp', label: 'OTP login' },
            { id: 'password', label: 'Account login' },
          ].map((tab) => (
            <button
              key={tab.id}
              style={tabButton(activeTab === tab.id)}
              onClick={() => setActiveTab(tab.id as AccessTab)}
              role="tab"
              aria-selected={activeTab === tab.id}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div>
          {activeTab === 'reservation' && renderReservationForm()}
          {activeTab === 'otp' && renderOtpForm()}
          {activeTab === 'password' && renderPasswordForm()}
        </div>

        <div
          style={{
            borderRadius: '24px',
            background: 'rgba(15, 23, 42, 0.04)',
            padding: '1.25rem',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.75rem',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>Prefer a faster checkout next time?</p>
            <p style={{ margin: 0, color: '#475569' }}>Create a password once and reuse your details for every stay.</p>
          </div>
          <button
            onClick={() => setSignupOpen(true)}
            style={{
              borderRadius: '999px',
              border: 'none',
              padding: '0.85rem 1.5rem',
              background: '#0f172a',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Create account
          </button>
        </div>
      </div>
      <GuestSignupModal
        tenantSlug={tenantSlug}
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        defaultEmail={passwordForm.email || reservationForm.email}
        defaultName={reservationForm.reservationNumber ? `Guest ${reservationForm.reservationNumber}` : ''}
        autoRedirect
      />
    </div>
  );
};

export default PortalAccessPage;
