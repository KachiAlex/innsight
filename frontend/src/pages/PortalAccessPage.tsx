import { FormEvent, useEffect, useMemo, useState } from 'react';
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
import { Button, Field, Select, TextInput } from '../components/ui';
import styles from './GuestSurface.module.css';

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
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldown]);

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
      setResendCooldown(30);
      setOtpDestination(response.data?.destination || null);
      setOtpVerify((prev) => ({ ...prev, reservationNumber: otpRequest.reservationNumber, channel: otpRequest.channel }));
      toast.success('Access code sent.');
    } catch (err: any) {
      const message = err?.response?.data?.error?.message || err?.message || 'Unable to send code right now.';
      setErrors((prev) => ({ ...prev, otp: message }));
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
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.shell}>
        <div>
          <p className={styles.eyebrow}>Guest portal</p>
          <h1 className={styles.title}>{heading}</h1>
          <p className={styles.lede}>
            Verify your reservation, use a one-time code, or sign into your guest account to manage your stay.
          </p>
        </div>

        <div className={styles.card}>
          <div className={styles.tabRow} role="tablist" style={{ marginBottom: 'var(--space-4)' }}>
            {([
              { id: 'reservation', label: 'Reservation lookup' },
              { id: 'otp', label: 'One-time code' },
              { id: 'password', label: 'Account sign-in' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                className={`${styles.tabPill} ${activeTab === tab.id ? styles.active : ''}`}
                onClick={() => setActiveTab(tab.id)}
                role="tab"
                aria-selected={activeTab === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'reservation' && (
            <form onSubmit={handleReservationLogin} className="stack" style={{ gap: 'var(--space-3)' }}>
              <Field label="Reservation number" required>
                <TextInput
                  value={reservationForm.reservationNumber}
                  onChange={(e) => setReservationForm((p) => ({ ...p, reservationNumber: e.target.value }))}
                  required
                  placeholder="e.g. RES-1234"
                />
              </Field>
              <div className="grid2">
                <Field label="Email on reservation">
                  <TextInput
                    type="email"
                    value={reservationForm.email}
                    onChange={(e) => setReservationForm((p) => ({ ...p, email: e.target.value }))}
                    placeholder="guest@email.com"
                  />
                </Field>
                <Field label="Phone on reservation">
                  <TextInput
                    type="tel"
                    value={reservationForm.phone}
                    onChange={(e) => setReservationForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Optional"
                  />
                </Field>
              </div>
              {errors.reservation && <p className={styles.errorBox} role="alert">{errors.reservation}</p>}
              <Button variant="primary" type="submit" loading={loading === 'reservation'} block>
                Access reservation
              </Button>
            </form>
          )}

          {activeTab === 'otp' && (
            otpStage === 'request' ? (
              <form onSubmit={requestOtpCode} className="stack" style={{ gap: 'var(--space-3)' }}>
                <Field label="Reservation number" required>
                  <TextInput
                    value={otpRequest.reservationNumber}
                    onChange={(e) => setOtpRequest((p) => ({ ...p, reservationNumber: e.target.value }))}
                    required
                  />
                </Field>
                <Field label="Delivery method">
                  <Select
                    value={otpRequest.channel}
                    onChange={(e) => setOtpRequest((p) => ({ ...p, channel: e.target.value as 'email' | 'sms' }))}
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                  </Select>
                </Field>
                {errors.otp && <p className={styles.errorBox} role="alert">{errors.otp}</p>}
                <Button variant="primary" type="submit" loading={loading === 'otp-request'} block>
                  Send access code
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtpCode} className="stack" style={{ gap: 'var(--space-3)' }}>
                <p className="text-sm muted" style={{ margin: 0 }}>
                  Enter the 6-digit code sent to <strong>{otpDestination || 'your contact'}</strong>.
                </p>
                <Field label="One-time code" required>
                  <TextInput
                    value={otpVerify.code}
                    onChange={(e) => setOtpVerify((p) => ({ ...p, code: e.target.value }))}
                    required
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                  />
                </Field>
                {errors.otp && <p className={styles.errorBox} role="alert">{errors.otp}</p>}
                <Button variant="primary" type="submit" loading={loading === 'otp-verify'} block>
                  Verify &amp; continue
                </Button>
                <div className="row-between">
                  <Button
                    variant="ghost"
                    type="button"
                    disabled={resendCooldown > 0 || loading !== null}
                    loading={loading === 'otp-request'}
                    onClick={async () => {
                      if (!ensureTenant()) return;
                      setLoading('otp-request');
                      setErrors((prev) => ({ ...prev, otp: null }));
                      try {
                        await requestReservationOtp(tenantSlug!, {
                          reservationNumber: otpVerify.reservationNumber,
                          channel: otpVerify.channel,
                        });
                        setResendCooldown(30);
                        toast.success('New code sent.');
                      } catch (err: any) {
                        setErrors((prev) => ({
                          ...prev,
                          otp: err?.response?.data?.error?.message || 'Unable to resend code.',
                        }));
                      } finally {
                        setLoading(null);
                      }
                    }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setOtpStage('request');
                      setOtpDestination(null);
                      setResendCooldown(0);
                      setOtpVerify({ code: '', reservationNumber: '', channel: 'email' });
                    }}
                  >
                    Start over
                  </Button>
                </div>
              </form>
            )
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordLogin} className="stack" style={{ gap: 'var(--space-3)' }}>
              <Field label="Email" required>
                <TextInput
                  type="email"
                  value={passwordForm.email}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, email: e.target.value }))}
                  required
                  autoComplete="email"
                />
              </Field>
              <Field label="Password" required>
                <TextInput
                  type="password"
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, password: e.target.value }))}
                  required
                  autoComplete="current-password"
                />
              </Field>
              {errors.password && <p className={styles.errorBox} role="alert">{errors.password}</p>}
              <Button variant="primary" type="submit" loading={loading === 'password'} block>
                Sign in to your account
              </Button>
            </form>
          )}
        </div>

        <div className={styles.promoBand}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Faster checkout next time?</p>
            <p className="text-sm muted" style={{ margin: 0 }}>Create a password once and reuse your details for every stay.</p>
          </div>
          <Button variant="secondary" onClick={() => setSignupOpen(true)}>
            Create account
          </Button>
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
