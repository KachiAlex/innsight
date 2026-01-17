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
  UserRound,
  BedDouble,
  Layers3,
  PenSquare,
} from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { addDays, format } from 'date-fns';
import toast from 'react-hot-toast';
import { publicApi, suppressToastHeaders } from '../lib/publicApi';

type PublicGateway = 'paystack' | 'flutterwave' | 'stripe';

const gatewayLabelMap: Record<PublicGateway, string> = {
  paystack: 'Paystack',
  flutterwave: 'Flutterwave',
  stripe: 'Stripe',
};

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
  paymentGateways?: {
    defaultGateway: PublicGateway;
    allowedGateways: PublicGateway[];
    paystackPublicKey?: string | null;
    flutterwavePublicKey?: string | null;
    stripePublicKey?: string | null;
  };
};

type RoomCategory = {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  totalRooms?: number | null;
};

type RatePlanSummary = {
  id: string;
  name: string;
  description?: string | null;
  currency?: string | null;
  baseRate?: number | null;
  categoryId?: string | null;
};

type AvailableRoom = {
  id: string;
  roomNumber: string | null;
  roomType: string | null;
  amenities?: string[];
  maxOccupancy?: number | null;
  effectiveRate?: number | null;
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
  gateway: PublicGateway;
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
const STEP_LABELS = [
  { label: 'Guest', icon: UserRound },
  { label: 'Stay', icon: Calendar },
  { label: 'Rooms', icon: BedDouble },
  { label: 'Extras', icon: Layers3 },
  { label: 'Review', icon: PenSquare },
];

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
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [ratePlans, setRatePlans] = useState<RatePlanSummary[]>([]);
  const [availabilityCurrency, setAvailabilityCurrency] = useState('NGN');
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
    guestAddress: '',
    specialRequests: '',
    hallEventName: '',
    hallNotes: '',
    roomId: '',
    payDepositOnly: false,
    gateway: '' as '' | PublicGateway,
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [currentStep, setCurrentStep] = useState(0);

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

  useEffect(() => {
    if (!tenantSlug) return;
    const fetchCatalog = async () => {
      try {
        const response = await publicApi.get<{
          data: {
            roomCategories: RoomCategory[];
            ratePlans?: RatePlanSummary[];
          };
        }>(`/${tenantSlug}/catalog`, {
          headers: suppressToastHeaders(),
        });
        setCategories(response.data.data?.roomCategories ?? []);
        setRatePlans(response.data.data?.ratePlans ?? []);
      } catch {
        toast.error('Unable to load room categories');
      }
    };
    fetchCatalog();
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
            ...(categoryFilter && categoryFilter !== 'all' ? { categoryId: categoryFilter } : {}),
          },
          headers: options?.silent ? suppressToastHeaders() : undefined,
        });
        const payload = response.data.data;
        const rooms = payload?.availableRooms || [];
        const currencyFromApi = payload?.currency;
        if (currencyFromApi) {
          setAvailabilityCurrency(currencyFromApi);
        } else if (rooms[0]?.ratePlan?.currency) {
          setAvailabilityCurrency(rooms[0].ratePlan!.currency || 'NGN');
        }
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
    [tenantSlug, canFetchAvailability, form.checkInDate, form.checkOutDate, form.roomId, categoryFilter]
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

  const allowedGateways = useMemo(() => {
    const allowed = tenant?.paymentGateways?.allowedGateways || [];
    if (allowed.length > 0) {
      return allowed;
    }
    return tenant?.paymentGateways?.defaultGateway
      ? [tenant.paymentGateways.defaultGateway]
      : ([] as PublicGateway[]);
  }, [tenant]);

  const gatewayOptions = useMemo(() => {
    const options: { value: '' | PublicGateway; label: string }[] = [];
    const defaultGateway = tenant?.paymentGateways?.defaultGateway;
    if (defaultGateway) {
      options.push({
        value: '',
        label: `Use default (${gatewayLabelMap[defaultGateway]})`,
      });
    } else {
      options.push({ value: '', label: 'Use default gateway' });
    }

    const uniqueGateways = Array.from(new Set(allowedGateways));
    uniqueGateways.forEach((gateway) => {
      options.push({
        value: gateway,
        label: `Pay with ${gatewayLabelMap[gateway]}`,
      });
    });

    return options;
  }, [allowedGateways, tenant?.paymentGateways?.defaultGateway]);

  useEffect(() => {
    // Reset selected gateway if it becomes unavailable
    if (form.gateway && !allowedGateways.includes(form.gateway)) {
      setForm((prev) => ({ ...prev, gateway: '' }));
    }
  }, [allowedGateways, form.gateway]);

  const buildSpecialRequests = () => {
    const details = [
      form.guestAddress ? `Guest address: ${form.guestAddress.trim()}` : null,
      form.specialRequests ? `Notes: ${form.specialRequests.trim()}` : null,
      form.hallEventName ? `Hall event: ${form.hallEventName.trim()}` : null,
      form.hallNotes ? `Hall notes: ${form.hallNotes.trim()}` : null,
    ].filter(Boolean);
    return details.join('\n');
  };

  const validateStep = (stepIndex: number) => {
    switch (stepIndex) {
      case 0:
        return Boolean(form.guestName.trim() && form.guestEmail.trim());
      case 1:
        return Boolean(form.checkInDate && form.checkOutDate);
      case 2:
        return Boolean(form.roomId);
      case 3:
        return true;
      case 4:
        return Boolean(form.roomId && form.guestName && form.checkInDate && form.checkOutDate);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast.error('Please complete the required details before continuing.');
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, STEP_LABELS.length - 1));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleCreateIntent = async () => {
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
        specialRequests: buildSpecialRequests() || undefined,
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

  const nights = useMemo(() => {
    if (!form.checkInDate || !form.checkOutDate) return null;
    const start = new Date(form.checkInDate);
    const end = new Date(form.checkOutDate);
    if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return null;
    const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 ? diff : null;
  }, [form.checkInDate, form.checkOutDate]);

  const selectedRoom = useMemo(
    () => availableRooms.find((room) => room.id === form.roomId),
    [availableRooms, form.roomId]
  );

  const categoryRateMap = useMemo(() => {
    const map = new Map<string, { rate: number; currency?: string | null }>();
    ratePlans.forEach((plan) => {
      if (!plan.categoryId || plan.baseRate === undefined || plan.baseRate === null) {
        return;
      }
      const existing = map.get(plan.categoryId);
      if (!existing || plan.baseRate < existing.rate) {
        map.set(plan.categoryId, { rate: plan.baseRate!, currency: plan.currency });
      }
    });
    return map;
  }, [ratePlans]);

  const selectedRoomRate = useMemo(() => {
    if (!selectedRoom) return null;
    return (
      selectedRoom.effectiveRate ??
      selectedRoom.customRate ??
      selectedRoom.ratePlan?.baseRate ??
      null
    );
  }, [selectedRoom]);

  const summaryCurrency =
    selectedRoom?.ratePlan?.currency || availabilityCurrency || (checkoutIntent?.currency as string) || 'NGN';

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

  const renderGuestStep = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div>
        <label style={labelStyle}>Guest name *</label>
        <input
          type="text"
          value={form.guestName}
          onChange={(e) => handleInputChange('guestName', e.target.value)}
          placeholder="Jane Doe"
          style={inputStyle}
          required
        />
      </div>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <label style={labelStyle}>Guest email *</label>
          <input
            type="email"
            value={form.guestEmail}
            onChange={(e) => handleInputChange('guestEmail', e.target.value)}
            placeholder="guest@email.com"
            style={inputStyle}
            required
          />
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
      </div>
      <div>
        <label style={labelStyle}>Guest address</label>
        <textarea
          value={form.guestAddress}
          onChange={(e) => handleInputChange('guestAddress', e.target.value)}
          placeholder="Street, City, Country"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
      <div>
        <label style={labelStyle}>Additional notes</label>
        <textarea
          value={form.specialRequests}
          onChange={(e) => handleInputChange('specialRequests', e.target.value)}
          placeholder="Share expectations, late arrivals, or preferences"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
    </div>
  );

  const renderStayStep = () => (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
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
      <div
        style={{
          borderRadius: '20px',
          padding: '1rem',
          background: 'rgba(15, 23, 42, 0.04)',
          border: '1px dashed rgba(15, 23, 42, 0.1)',
        }}
      >
        {availabilityLoading ? (
          <p style={{ margin: 0, color: '#475569' }}>Checking availability...</p>
        ) : canFetchAvailability ? (
          <p style={{ margin: 0, color: '#0f172a' }}>
            {availableRooms.length > 0
              ? `${availableRooms.length} room${availableRooms.length === 1 ? '' : 's'} currently open`
              : 'No rooms match those dates. Try adjusting your stay.'}
          </p>
        ) : (
          <p style={{ margin: 0, color: '#475569' }}>Select dates to view availability.</p>
        )}
      </div>
    </div>
  );

  const renderRoomsStep = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={{ ...labelStyle, marginBottom: '0.35rem' }}>Room category</label>
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setForm((prev) => ({ ...prev, roomId: '' }));
            }}
            style={inputStyle}
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {(() => {
                  const rateInfo = categoryRateMap.get(category.id);
                  if (!rateInfo) {
                    return category.name;
                  }
                  return `${category.name} • ${formatCurrency(
                    rateInfo.rate,
                    rateInfo.currency || availabilityCurrency
                  )}`;
                })()}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          style={{
            ...accentButtonStyle,
            padding: '0.65rem 1.4rem',
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
      <div style={{ display: 'grid', gap: '1rem' }}>
        {(!canFetchAvailability || availableRooms.length === 0) && (
          <div
            style={{
              borderRadius: '18px',
              border: '1px dashed rgba(15,23,42,0.2)',
              padding: '1rem',
              color: '#475569',
            }}
          >
            {canFetchAvailability
              ? 'No rooms match your filters. Try a different date range or category.'
              : 'Set your stay dates first to load available rooms.'}
          </div>
        )}
        {availableRooms.map((room) => {
          const rate = room.effectiveRate ?? room.customRate ?? room.ratePlan?.baseRate ?? null;
          const isSelected = form.roomId === room.id;
          return (
            <div
              key={room.id}
              onClick={() => handleInputChange('roomId', room.id)}
              style={{
                borderRadius: '20px',
                border: `2px solid ${isSelected ? accentColor : 'rgba(15,23,42,0.08)'}`,
                padding: '1rem',
                cursor: 'pointer',
                background: isSelected ? 'rgba(15,23,42,0.04)' : '#fff',
                transition: 'border 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: '#0f172a' }}>
                    {room.roomNumber ? `Room ${room.roomNumber}` : room.roomType || 'Room'}
                  </p>
                  <p style={{ margin: '0.2rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
                    {room.roomType || room.ratePlan?.name || 'Standard room'} · Sleeps up to {room.maxOccupancy || 2}
                  </p>
                  <p style={{ margin: '0.35rem 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                    {(room.amenities || []).slice(0, 3).join(' • ') || 'Essential amenities included'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a' }}>
                    {rate !== null ? formatCurrency(rate, room.ratePlan?.currency || availabilityCurrency) : '--'}
                  </p>
                  <p style={{ margin: 0, color: '#475569' }}>per night</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderExtrasStep = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <label style={labelStyle}>Payment gateway</label>
          <select
            value={form.gateway}
            onChange={(e) => handleInputChange('gateway', e.target.value as '' | 'paystack' | 'flutterwave')}
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
      <div>
        <label style={labelStyle}>Hall or event name (optional)</label>
        <input
          type="text"
          value={form.hallEventName}
          onChange={(e) => handleInputChange('hallEventName', e.target.value)}
          placeholder="Conference, wedding reception, etc."
          style={inputStyle}
        />
      </div>
      <div>
        <label style={labelStyle}>Hall notes</label>
        <textarea
          value={form.hallNotes}
          onChange={(e) => handleInputChange('hallNotes', e.target.value)}
          placeholder="Share setup needs, headcount, preferred hours"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </div>
    </div>
  );

  const renderReviewStep = () => (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <div
        style={{
          borderRadius: '20px',
          padding: '1rem',
          border: '1px solid rgba(15,23,42,0.08)',
          background: '#fff',
          boxShadow: '0 15px 35px rgba(15,23,42,0.08)',
        }}
      >
        <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontSize: '0.8rem' }}>
          Guest
        </p>
        <p style={{ margin: '0.25rem 0 0', color: '#0f172a', fontWeight: 600 }}>{form.guestName || '—'}</p>
        <p style={{ margin: '0.2rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
          {form.guestEmail || 'No email'} · {form.guestPhone || 'No phone'}
        </p>
      </div>
      <div
        style={{
          borderRadius: '20px',
          padding: '1rem',
          border: '1px solid rgba(15,23,42,0.08)',
          background: '#fff',
          boxShadow: '0 15px 35px rgba(15,23,42,0.08)',
        }}
      >
        <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontSize: '0.8rem' }}>
          Stay
        </p>
        <p style={{ margin: '0.25rem 0 0', color: '#0f172a', fontWeight: 600 }}>
          {form.checkInDate || '—'} → {form.checkOutDate || '—'}
        </p>
        <p style={{ margin: '0.2rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
          {form.adults} adult{form.adults === 1 ? '' : 's'}
          {form.children ? ` · ${form.children} child${form.children === 1 ? '' : 'ren'}` : ''}
        </p>
      </div>
      {selectedRoom && (
        <div
          style={{
            borderRadius: '20px',
            padding: '1rem',
            border: '1px solid rgba(15,23,42,0.08)',
            background: '#fff',
            boxShadow: '0 15px 35px rgba(15,23,42,0.08)',
          }}
        >
          <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', fontSize: '0.8rem' }}>
            Room
          </p>
          <p style={{ margin: '0.25rem 0 0', color: '#0f172a', fontWeight: 600 }}>
            {selectedRoom.roomNumber ? `Room ${selectedRoom.roomNumber}` : selectedRoom.roomType || 'Room'}
          </p>
          <p style={{ margin: '0.2rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
            {selectedRoom.ratePlan?.name || selectedRoom.roomType || 'Standard'}
          </p>
          {selectedRoomRate !== null && nights && (
            <p style={{ margin: '0.35rem 0 0', color: '#0f172a', fontWeight: 600 }}>
              {formatCurrency(selectedRoomRate * nights, summaryCurrency)} total · {nights} night{nights === 1 ? '' : 's'}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        disabled={intentLoading || !validateStep(4)}
        onClick={handleCreateIntent}
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
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderGuestStep();
      case 1:
        return renderStayStep();
      case 2:
        return renderRoomsStep();
      case 3:
        return renderExtrasStep();
      case 4:
        return renderReviewStep();
      default:
        return null;
    }
  };

  const canAdvance = validateStep(currentStep);

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

        <div style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          {STEP_LABELS.map(({ label, icon: Icon }, index) => {
            const isActive = index === currentStep;
            const isCompleted = index < currentStep;
            return (
              <div
                key={label}
                style={{
                  flex: '1 1 120px',
                  minWidth: '120px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem 0.9rem',
                  borderRadius: '999px',
                  background: isActive
                    ? accentGradient
                    : isCompleted
                      ? 'rgba(15,23,42,0.1)'
                      : 'rgba(15,23,42,0.05)',
                  color: isActive ? '#fff' : '#0f172a',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                <Icon size={18} />
                {label}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
          }}
        >
          <section style={sectionCardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a' }}>{STEP_LABELS[currentStep].label} details</h2>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                  Complete each step to mirror the full reservation workflow.
                </p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '1.25rem' }}>{renderStepContent()}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 0}
                style={{
                  ...accentButtonStyle,
                  background: 'rgba(15,23,42,0.05)',
                  color: '#0f172a',
                  padding: '0.75rem 1.5rem',
                  opacity: currentStep === 0 ? 0.5 : 1,
                }}
              >
                Back
              </button>
              {currentStep < STEP_LABELS.length - 1 && (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canAdvance}
                  style={{
                    ...accentButtonStyle,
                    background: accentGradient,
                    color: '#fff',
                    padding: '0.75rem 1.5rem',
                    opacity: canAdvance ? 1 : 0.6,
                  }}
                >
                  Continue
                </button>
              )}
            </div>
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
                  {selectedRoomRate !== null && (
                    <>
                      {' '}
                      · {formatCurrency(selectedRoomRate, summaryCurrency)} / night
                    </>
                  )}
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
