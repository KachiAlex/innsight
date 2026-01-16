import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  CreditCard,
  ShieldCheck,
  ExternalLink,
  RefreshCcw,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import { publicApi, suppressToastHeaders } from '../lib/publicApi';

type TenantSummary = {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  branding?: {
    primaryColor?: string;
    accentColor?: string;
    logoUrl?: string;
  };
};

type AvailableRoom = {
  id: string;
  roomNumber: string | null;
  roomType: string | null;
  amenities?: string[];
  maxOccupancy?: number | null;
  ratePlan?: {
    id: string;
    name: string;
    baseRate: number | null;
    currency?: string | null;
  } | null;
  customRate?: number | null;
};

type CheckoutIntentState = {
  intentId: string;
  authorizationUrl: string;
  reference: string;
  gateway: 'paystack' | 'flutterwave';
  amount: number;
  currency: string;
  expiresAt: string;
};

type CheckoutConfirmation = {
  status: string;
  reservation?: {
    id: string;
    reservationNumber?: string;
    guestName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    room?: {
      roomNumber?: string | null;
      roomType?: string | null;
    };
  };
  customerToken?: string;
  guestSessionToken?: string;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 'clamp(0.75rem, 3vw, 0.95rem) 1rem',
  borderRadius: '18px',
  border: '1px solid rgba(16, 24, 40, 0.08)',
  background: 'rgba(255,255,255,0.8)',
  fontSize: '1rem',
  color: '#111827',
  fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
  outline: 'none',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.5rem',
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#334155',
};

const sectionCardStyle: React.CSSProperties = {
  borderRadius: '32px',
  padding: 'clamp(1.25rem, 4vw, 2.2rem)',
  background: 'rgba(255, 255, 255, 0.9)',
  border: '1px solid rgba(17, 24, 39, 0.08)',
  boxShadow: '0 25px 55px rgba(15, 23, 42, 0.12)',
  backdropFilter: 'blur(14px)',
};

const gradientBackground = {
  minHeight: '100vh',
  background:
    'radial-gradient(120% 120% at 0% 0%, #fef3c7 0%, transparent 55%), radial-gradient(100% 120% at 100% 0%, #cffafe 0%, transparent 60%), radial-gradient(120% 150% at 50% 100%, #e0e7ff 0%, transparent 55%)',
  padding: '2rem 0 4rem',
  fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
};

const accentButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  padding: '0.95rem 1.75rem',
  fontSize: '1rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  transition: 'all 0.25s ease',
};

const gatewayOptions: { value: '' | 'paystack' | 'flutterwave'; label: string }[] = [
  { value: '', label: 'Use default gateway' },
  { value: 'paystack', label: 'Pay with Paystack' },
  { value: 'flutterwave', label: 'Pay with Flutterwave' },
];

const occupancyOptions = Array.from({ length: 6 }).map((_, idx) => idx + 1);

const StyledDateInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ style: styleProp, ...props }, ref) => (
    <input
      {...props}
      ref={ref}
      readOnly
      style={{ ...inputStyle, cursor: 'pointer', ...(styleProp || {}) }}
    />
  )
);
StyledDateInput.displayName = 'StyledDateInput';

const toDateString = (date: Date) => format(date, 'yyyy-MM-dd');
const parseDateValue = (value?: string) => (value ? new Date(value) : null);

const formatCurrency = (amount?: number, currency = 'NGN') => {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '--';
  try {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const DEFAULT_AVAILABILITY_REFRESH_MS = 60 * 1000;
const COUNTDOWN_INTERVAL_MS = 1000;
const CONFIRM_POLL_INTERVAL_MS = 15 * 1000;

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const formatCountdown = (targetDate?: string) => {
  if (!targetDate) return '';
  const target = new Date(targetDate).getTime();
  const diffMs = target - Date.now();
  if (Number.isNaN(diffMs) || diffMs <= 0) return 'Expired';
  const totalSeconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}m ${seconds
    .toString()
    .padStart(2, '0')}s`;
};

const toIsoDateTime = (value?: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const PublicCheckoutPage = () => {
  const navigate = useNavigate();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [tenant, setTenant] = useState<TenantSummary | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [intentLoading, setIntentLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [checkoutIntent, setCheckoutIntent] = useState<CheckoutIntentState | null>(null);
  const [confirmation, setConfirmation] = useState<CheckoutConfirmation | null>(null);
  const [intentCountdown, setIntentCountdown] = useState('');

  const [form, setForm] = useState({
    checkInDate: '',
    checkOutDate: '',
    adults: 1,
    children: 0,
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    roomId: '',
    payDepositOnly: false,
    gateway: '' as '' | 'paystack' | 'flutterwave',
  });

  const availabilityIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const confirmIntervalRef = useRef<number | null>(null);
  const intentExpiryAlertedRef = useRef(false);

  const canFetchAvailability =
    Boolean(form.checkInDate && form.checkOutDate) &&
    new Date(form.checkOutDate).getTime() > new Date(form.checkInDate).getTime();

  useEffect(() => {
    if (!tenantSlug) return;
    const fetchSummary = async () => {
      try {
        const response = await publicApi.get<{ data: TenantSummary }>(`/${tenantSlug}/summary`);
        setTenant(response.data.data);
      } catch {
        toast.error('Unable to load property information');
      }
    };
    fetchSummary();
  }, [tenantSlug]);

  const fetchAvailability = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!tenantSlug || !canFetchAvailability) return;
      const shouldShowLoader = !options?.silent;
      if (shouldShowLoader) {
        setAvailabilityLoading(true);
      }
      try {
        const startDateIso = toIsoDateTime(form.checkInDate);
        const endDateIso = toIsoDateTime(form.checkOutDate);
        if (!startDateIso || !endDateIso) {
          throw new Error('Invalid date selection');
        }
        const response = await publicApi.get<{
        data: {
          availableRooms: AvailableRoom[];
          currency?: string;
        };
      }>(`/${tenantSlug}/availability`, {
          params: {
            startDate: startDateIso,
            endDate: endDateIso,
          },
          headers: options?.silent ? suppressToastHeaders() : undefined,
        });
        const rooms = response.data.data?.availableRooms || [];
        setAvailableRooms(rooms);
        if (!rooms.find((room) => room.id === form.roomId)) {
          setForm((prev) => ({ ...prev, roomId: rooms[0]?.id || '' }));
        }
        if (!options?.silent && rooms.length === 0) {
          toast.error('No rooms available for those dates. Please adjust and try again.');
        }
      } catch (error: any) {
        if (!options?.silent) {
          toast.error(getErrorMessage(error, 'Unable to refresh availability right now.'));
        }
      } finally {
        if (shouldShowLoader) {
          setAvailabilityLoading(false);
        }
      }
    },
    [tenantSlug, canFetchAvailability, form.checkInDate, form.checkOutDate, form.roomId]
  );

  useEffect(() => {
    if (canFetchAvailability) {
      fetchAvailability();
    }
  }, [canFetchAvailability, fetchAvailability]);

  useEffect(() => {
    if (!canFetchAvailability) {
      if (availabilityIntervalRef.current) {
        window.clearInterval(availabilityIntervalRef.current);
        availabilityIntervalRef.current = null;
      }
      return;
    }
    availabilityIntervalRef.current = window.setInterval(() => {
      fetchAvailability({ silent: true });
    }, DEFAULT_AVAILABILITY_REFRESH_MS);

    return () => {
      if (availabilityIntervalRef.current) {
        window.clearInterval(availabilityIntervalRef.current);
        availabilityIntervalRef.current = null;
      }
    };
  }, [canFetchAvailability, fetchAvailability]);

  const handleInputChange = (field: keyof typeof form, value: string | number | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateIntent = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantSlug) return;
    if (!form.roomId) {
      toast.error('Please select a room to continue.');
      return;
    }
    if (!form.guestEmail || !form.guestName) {
      toast.error('Guest name and email are required.');
      return;
    }
    setIntentLoading(true);
    setConfirmation(null);
    try {
      const payload = {
        roomId: form.roomId,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        adults: form.adults,
        children: form.children,
        guestName: form.guestName,
        guestEmail: form.guestEmail,
        guestPhone: form.guestPhone || undefined,
        gateway: form.gateway || undefined,
        payDepositOnly: form.payDepositOnly,
        source: 'web_portal' as const,
      };

      const response = await publicApi.post<{
        data: {
          intentId: string;
          authorizationUrl: string;
          reference: string;
          gateway: 'paystack' | 'flutterwave';
          currency: string;
          amount: number;
          expiresAt: string;
        };
      }>(`/${tenantSlug}/checkout/intent`, payload);

      setCheckoutIntent(response.data.data);
      toast.success('Checkout intent created. Complete payment in the gateway window.');

      if (response.data.data.authorizationUrl) {
        window.open(response.data.data.authorizationUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Unable to start checkout. Please try again.'));
    } finally {
      setIntentLoading(false);
    }
  };

  const confirmPayment = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!tenantSlug || !checkoutIntent) return;
      const silent = Boolean(options?.silent);
      if (!silent) {
        setConfirming(true);
      }
      try {
        const response = await publicApi.post<{ data: CheckoutConfirmation }>(
          `/${tenantSlug}/checkout/confirm`,
          {
            intentId: checkoutIntent.intentId,
            reference: checkoutIntent.reference,
            gateway: checkoutIntent.gateway,
          },
          {
            headers: silent ? suppressToastHeaders() : undefined,
          }
        );
        setConfirmation(response.data.data);
        if (!silent) {
          toast.success('Payment confirmed! Your reservation is ready.');
        }
      } catch (error: any) {
        if (!silent) {
          toast.error(getErrorMessage(error, 'Unable to confirm payment yet. Please try again.'));
        }
      } finally {
        if (!silent) {
          setConfirming(false);
        }
      }
    },
    [tenantSlug, checkoutIntent]
  );

  const accentColor = tenant?.branding?.primaryColor || '#0f172a';
  const accentGradient = `linear-gradient(135deg, ${accentColor}, #7c3aed)`;

  const selectedRoom = useMemo(
    () => availableRooms.find((room) => room.id === form.roomId),
    [availableRooms, form.roomId]
  );

  const nights = useMemo(() => {
    if (!form.checkInDate || !form.checkOutDate) return null;
    const start = new Date(form.checkInDate);
    const end = new Date(form.checkOutDate);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return null;
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 ? diff : null;
  }, [form.checkInDate, form.checkOutDate]);

  const summaryCurrency =
    selectedRoom?.ratePlan?.currency || (checkoutIntent?.currency as string) || 'NGN';

  const intentExpiresAt = checkoutIntent?.expiresAt;
  const isIntentExpired = useMemo(() => {
    if (!intentExpiresAt) return false;
    return new Date(intentExpiresAt).getTime() <= Date.now();
  }, [intentExpiresAt]);

  useEffect(() => {
    if (!checkoutIntent) {
      setIntentCountdown('');
      intentExpiryAlertedRef.current = false;
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      return;
    }

    const updateCountdown = () => {
      setIntentCountdown(formatCountdown(checkoutIntent.expiresAt));
    };

    updateCountdown();
    countdownIntervalRef.current = window.setInterval(updateCountdown, COUNTDOWN_INTERVAL_MS);

    return () => {
      if (countdownIntervalRef.current) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [checkoutIntent]);

  useEffect(() => {
    if (!checkoutIntent || confirmation || isIntentExpired) {
      if (confirmIntervalRef.current) {
        window.clearInterval(confirmIntervalRef.current);
        confirmIntervalRef.current = null;
      }
      return;
    }

    confirmIntervalRef.current = window.setInterval(() => {
      confirmPayment({ silent: true });
    }, CONFIRM_POLL_INTERVAL_MS);

    return () => {
      if (confirmIntervalRef.current) {
        window.clearInterval(confirmIntervalRef.current);
        confirmIntervalRef.current = null;
      }
    };
  }, [checkoutIntent, confirmation, confirmPayment, isIntentExpired]);

  useEffect(() => {
    if (!checkoutIntent) {
      intentExpiryAlertedRef.current = false;
      return;
    }
    if (isIntentExpired && !intentExpiryAlertedRef.current) {
      toast.error('Checkout intent expired. Please restart checkout to continue.');
      intentExpiryAlertedRef.current = true;
    }
  }, [checkoutIntent, isIntentExpired]);

  return (
    <div style={gradientBackground}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1.5rem 3rem' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {tenant?.branding?.logoUrl ? (
              <img
                src={tenant.branding.logoUrl}
                alt={tenant.name}
                style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: accentColor,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.25rem',
                }}
              >
                {tenant?.name?.[0] || 'I'}
              </div>
            )}
            <div>
              <p style={{ margin: 0, letterSpacing: '0.12em', fontSize: '0.8rem', color: '#475569', textTransform: 'uppercase' }}>
                {tenant?.name || 'Your stay'}
              </p>
              <h1 style={{ margin: 0, fontSize: '1.75rem', letterSpacing: '-0.03em', color: '#0f172a' }}>
                DIY Checkout Portal
              </h1>
            </div>
          </div>
          <button
            style={{
              ...accentButtonStyle,
              background: 'rgba(15,23,42,0.9)',
              color: '#fff',
              padding: '0.85rem 1.5rem',
            }}
            onClick={() => navigate('/')}
          >
            Back to InnSight
          </button>
        </header>

        <div style={{ marginBottom: '2rem' }}>
          <p style={{ textTransform: 'uppercase', letterSpacing: '0.2em', color: '#0f172a' }}>
            {tenant?.name || 'Your Stay'} — DIY Portal
          </p>
          <h2
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              margin: '0.15rem 0',
              color: '#0f172a',
              letterSpacing: '-0.03em',
            }}
          >
            Craft your stay, pay securely.
          </h2>
          <p style={{ color: '#475569', maxWidth: '640px', lineHeight: 1.6 }}>
            Choose your dates, pick your room, and finalize payment via Paystack or
            Flutterwave—without waiting on a front-desk agent.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <section style={sectionCardStyle}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <Calendar size={22} color={accentColor} />
                <div>
                  <h2 style={{ margin: 0, color: '#0f172a' }}>Stay details</h2>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                    Choose your dates and room to unlock payment.
                  </p>
                </div>
              </div>

              <form onSubmit={handleCreateIntent} style={{ display: 'grid', gap: '1.25rem' }}>
                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  <div>
                    <label style={labelStyle}>Check-in</label>
                    <DatePicker
                      selected={parseDateValue(form.checkInDate)}
                      onChange={(date) => handleInputChange('checkInDate', date ? toDateString(date) : '')}
                      selectsStart
                      startDate={parseDateValue(form.checkInDate) || undefined}
                      endDate={parseDateValue(form.checkOutDate) || undefined}
                      minDate={new Date()}
                      customInput={<StyledDateInput />}
                      placeholderText="Select date"
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Check-out</label>
                    <DatePicker
                      selected={parseDateValue(form.checkOutDate)}
                      onChange={(date) => handleInputChange('checkOutDate', date ? toDateString(date) : '')}
                      selectsEnd
                      startDate={parseDateValue(form.checkInDate) || undefined}
                      endDate={parseDateValue(form.checkOutDate) || undefined}
                      minDate={
                        form.checkInDate ? addDays(new Date(form.checkInDate), 1) : new Date()
                      }
                      customInput={<StyledDateInput />}
                      placeholderText="Select date"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
                  <div>
                    <label style={labelStyle}>Adults</label>
                    <select
                      value={form.adults}
                      onChange={(e) => handleInputChange('adults', Number(e.target.value))}
                      style={inputStyle}
                    >
                      {occupancyOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Children</label>
                    <select
                      value={form.children}
                      onChange={(e) => handleInputChange('children', Number(e.target.value))}
                      style={inputStyle}
                    >
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <option key={idx} value={idx}>
                          {idx}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label style={labelStyle}>Available rooms</label>
                    <button
                      type="button"
                      style={{
                        ...accentButtonStyle,
                        padding: '0.65rem 1.25rem',
                        fontSize: '0.9rem',
                        background: 'rgba(15,23,42,0.08)',
                        color: '#0f172a',
                      }}
                      onClick={() => fetchAvailability()}
                      disabled={!canFetchAvailability || availabilityLoading}
                    >
                      <RefreshCcw size={16} />
                      Refresh
                    </button>
                  </div>
                  <select
                    value={form.roomId}
                    onChange={(e) => handleInputChange('roomId', e.target.value)}
                    style={inputStyle}
                    disabled={!availableRooms.length}
                  >
                    <option value="" disabled>
                      {canFetchAvailability
                        ? availabilityLoading
                          ? 'Fetching rooms...'
                          : 'Select a room'
                        : 'Enter dates to view rooms'}
                    </option>
                    {availableRooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.roomNumber
                          ? `${room.roomNumber} · ${room.roomType || 'Deluxe'}`
                          : room.roomType || 'Room'}{' '}
                        {room.ratePlan?.baseRate
                          ? `(${formatCurrency(room.ratePlan.baseRate, room.ratePlan.currency || summaryCurrency)}/night)`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {selectedRoom && (
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', color: '#475569' }}>
                      Sleeps up to {selectedRoom.maxOccupancy || 2} guests ·{' '}
                      {selectedRoom.amenities?.slice(0, 3).join(' • ') || 'Essential amenities'}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <div>
                    <label style={labelStyle}>Guest name</label>
                    <input
                      type="text"
                      value={form.guestName}
                      onChange={(e) => handleInputChange('guestName', e.target.value)}
                      placeholder="Jane Doe"
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Guest email</label>
                    <input
                      type="email"
                      value={form.guestEmail}
                      onChange={(e) => handleInputChange('guestEmail', e.target.value)}
                      placeholder="guest@email.com"
                      style={inputStyle}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Guest phone</label>
                  <input
                    type="tel"
                    value={form.guestPhone}
                    onChange={(e) => handleInputChange('guestPhone', e.target.value)}
                    placeholder="+234 801 234 5678"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                  <div>
                    <label style={labelStyle}>Payment gateway</label>
                    <select
                      value={form.gateway}
                      onChange={(e) =>
                        handleInputChange('gateway', e.target.value as '' | 'paystack' | 'flutterwave')
                      }
                      style={inputStyle}
                    >
                      {gatewayOptions.map((option) => (
                        <option key={option.value || 'default'} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Charge deposit only?</label>
                    <div
                      style={{
                        ...inputStyle,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                      }}
                    >
                      <input
                        id="depositOnly"
                        type="checkbox"
                        checked={form.payDepositOnly}
                        onChange={(e) => handleInputChange('payDepositOnly', e.target.checked)}
                      />
                      <label htmlFor="depositOnly" style={{ margin: 0, color: '#475569', fontWeight: 500 }}>
                        Collect deposit now, settle balance at check-in.
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={intentLoading || !canFetchAvailability || !form.roomId}
                  style={{
                    ...accentButtonStyle,
                    background: accentGradient,
                    color: '#fff',
                    fontSize: '1.05rem',
                    marginTop: '0.5rem',
                    opacity: intentLoading ? 0.7 : 1,
                  }}
                >
                  <CreditCard size={20} />
                  {intentLoading ? 'Starting checkout...' : 'Launch secure payment'}
                </button>
              </form>
            </section>

          <section style={{ ...sectionCardStyle, background: 'rgba(15, 23, 42, 0.9)', color: '#fff' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
              <ShieldCheck size={22} color="#a5f3fc" />
              <div>
                <h2 style={{ margin: 0 }}>Payment status</h2>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                  Track your intent, confirm payment, and receive reservation details.
                </p>
              </div>
            </div>

            {!checkoutIntent && (
                <div style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                  <p style={{ marginBottom: '1rem' }}>
                    Once you launch a checkout intent, we’ll display the reference, expiration, and
                    confirmation controls right here.
                  </p>
                  <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                    <li>Use a valid email—you’ll receive receipt + updates.</li>
                    <li>Payment portal opens in a new tab, secured by the gateway.</li>
                    <li>Return to this page after payment to finalize your reservation.</li>
                  </ul>
                </div>
              )}

            {checkoutIntent && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div
                    style={{
                      borderRadius: '20px',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '1.25rem',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ color: '#bae6fd', fontSize: '0.85rem', letterSpacing: '0.08em' }}>REFERENCE</span>
                      <span style={{ fontWeight: 600 }}>{checkoutIntent.reference}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                          Amount due
                        </p>
                        <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>
                          {formatCurrency(checkoutIntent.amount, checkoutIntent.currency)}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>Gateway</p>
                        <p style={{ margin: 0 }}>{checkoutIntent.gateway.toUpperCase()}</p>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: '0.75rem',
                        paddingTop: '0.75rem',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                        color: 'rgba(255,255,255,0.7)',
                        fontSize: '0.9rem',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={16} />
                        Expires {new Date(checkoutIntent.expiresAt).toLocaleString()}
                      </span>
                      {intentCountdown && !isIntentExpired && (
                        <span style={{ fontSize: '0.85rem', color: '#facc15' }}>
                          {intentCountdown} remaining
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    style={{
                      ...accentButtonStyle,
                      background: 'rgba(255,255,255,0.12)',
                      color: '#fff',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                    onClick={() => window.open(checkoutIntent.authorizationUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink size={18} />
                    Re-open payment portal
                  </button>

                <button
                  style={{
                    ...accentButtonStyle,
                    background: '#22d3ee',
                    color: '#0f172a',
                    fontWeight: 700,
                    marginTop: '0.5rem',
                  }}
                  onClick={() => confirmPayment()}
                  disabled={confirming || isIntentExpired}
                >
                  <CheckCircle2 size={20} />
                  {confirming ? 'Verifying...' : 'Confirm payment & finalize reservation'}
                </button>
              </div>
            )}

            {confirmation && (
                <div
                  style={{
                    marginTop: '1.25rem',
                    padding: '1.25rem',
                    borderRadius: '18px',
                    background: 'rgba(21, 128, 61, 0.15)',
                    border: '1px solid rgba(187, 247, 208, 0.2)',
                  }}
                >
                  <p style={{ margin: 0, letterSpacing: '0.08em', fontSize: '0.85rem', color: '#4ade80' }}>
                    STATUS · {confirmation.status.toUpperCase()}
                  </p>
                  {confirmation.reservation && (
                    <>
                      <h3 style={{ margin: '0.75rem 0 0.25rem' }}>
                        Reservation {confirmation.reservation.reservationNumber || confirmation.reservation.id}
                      </h3>
                      <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)' }}>
                        {confirmation.reservation.guestName} ·{' '}
                        {confirmation.reservation.room?.roomNumber
                          ? `Room ${confirmation.reservation.room.roomNumber}`
                          : confirmation.reservation.room?.roomType}
                      </p>
                      <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.7)' }}>
                        {confirmation.reservation.checkInDate &&
                          new Date(confirmation.reservation.checkInDate).toLocaleDateString()}{' '}
                        →{' '}
                        {confirmation.reservation.checkOutDate &&
                          new Date(confirmation.reservation.checkOutDate).toLocaleDateString()}
                      </p>
                    </>
                  )}
                  {confirmation.customerToken && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '14px',
                        background: 'rgba(15,23,42,0.6)',
                        border: '1px dashed rgba(56,189,248,0.4)',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#bae6fd' }}>Customer token</p>
                      <p style={{ margin: '0.25rem 0 0', wordBreak: 'break-all' }}>
                        {confirmation.customerToken}
                      </p>
                    </div>
                  )}
                </div>
              )}

            {nights && selectedRoom && (
              <div
                style={{
                  marginTop: '1.5rem',
                  padding: '1rem',
                  borderRadius: '20px',
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem', color: '#c7d2fe' }}>
                  Stay summary
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '1.1rem', fontWeight: 600 }}>
                  {nights} night{nights > 1 ? 's' : ''} · Room {selectedRoom.roomNumber || '—'}
                </p>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)' }}>
                  {selectedRoom.ratePlan?.name || selectedRoom.roomType || 'Standard room'}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default PublicCheckoutPage;
