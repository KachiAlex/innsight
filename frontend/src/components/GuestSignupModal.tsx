import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { signupCustomer } from '../lib/publicCustomerApi';
import { useCustomerAuthStore } from '../store/customerAuthStore';

type GuestSignupModalProps = {
  tenantSlug?: string;
  open: boolean;
  onClose: () => void;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  autoRedirect?: boolean;
  onSuccess?: (response: any) => void;
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(5, 5, 20, 0.55)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '1.5rem',
};

const modalStyle: React.CSSProperties = {
  width: 'min(520px, 100%)',
  borderRadius: '28px',
  padding: '2rem',
  background: '#fefefe',
  boxShadow: '0 40px 120px rgba(15, 23, 42, 0.25)',
  fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
  maxHeight: '90vh',
  overflowY: 'auto',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.3rem',
  fontWeight: 600,
  color: '#111827',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.85rem 1rem',
  borderRadius: '999px',
  border: '1px solid rgba(15, 23, 42, 0.12)',
  fontSize: '0.95rem',
  outline: 'none',
  background: '#fff',
};

const checkboxWrap: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  fontSize: '0.9rem',
  color: '#475569',
};

const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.95rem',
  borderRadius: '999px',
  border: 'none',
  fontWeight: 600,
  fontSize: '1rem',
  background: 'linear-gradient(130deg, #0f172a, #334155)',
  color: '#fff',
  cursor: 'pointer',
};

const closeButtonStyle: React.CSSProperties = {
  position: 'absolute',
  top: '1rem',
  right: '1.2rem',
  border: 'none',
  background: 'transparent',
  fontSize: '1.5rem',
  color: '#94a3b8',
  cursor: 'pointer',
};

const GuestSignupModal = ({
  tenantSlug,
  open,
  onClose,
  defaultName = '',
  defaultEmail = '',
  defaultPhone = '',
  autoRedirect,
  onSuccess,
}: GuestSignupModalProps) => {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState(defaultPhone);
  const [password, setPassword] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuthFromResponse = useCustomerAuthStore((state) => state.setAuthFromResponse);

  useEffect(() => {
    if (open) {
      setName(defaultName);
      setEmail(defaultEmail);
      setPhone(defaultPhone);
      setPassword('');
      setError(null);
    }
  }, [open, defaultName, defaultEmail, defaultPhone]);

  if (typeof document === 'undefined' || !open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!tenantSlug) {
      setError('Property information missing. Please reload and try again.');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (password.trim().length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await signupCustomer(tenantSlug, {
        name: name.trim() || 'Guest',
        email: email.trim(),
        phone: phone.trim() || undefined,
        password: password.trim(),
        marketingOptIn,
      });
      setAuthFromResponse(tenantSlug, response);
      toast.success('Account created successfully.');
      onSuccess?.(response);
      onClose();
      if (autoRedirect) {
        window.location.href = `/portal/${tenantSlug}/dashboard`;
      }
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Unable to create account right now.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <div style={backdropStyle}>
      <div style={{ ...modalStyle, position: 'relative' }}>
        <button onClick={onClose} style={closeButtonStyle} aria-label="Close signup modal">
          ×
        </button>
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, color: '#475569', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.15em' }}>
            Guest Account
          </p>
          <h2 style={{ margin: '0.3rem 0 0.5rem', fontSize: '1.8rem', color: '#0f172a' }}>
            Save your details for next time
          </h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
            Create a password to track reservations, download receipts, and breeze through future
            bookings.
          </p>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Full name</label>
            <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input
              style={inputStyle}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="guest@email.com"
            />
          </div>
          <div>
            <label style={labelStyle}>Phone</label>
            <input
              style={inputStyle}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label style={labelStyle}>Password *</label>
            <input
              style={inputStyle}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
            />
          </div>
          <label style={checkboxWrap}>
            <input
              type="checkbox"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
            />
            Keep me informed about exclusive offers and upgrades.
          </label>
          {error && (
            <div
              style={{
                padding: '0.85rem 1rem',
                borderRadius: '16px',
                background: 'rgba(248, 113, 113, 0.1)',
                color: '#b91c1c',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
          )}
          <button type="submit" style={primaryButtonStyle} disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default GuestSignupModal;
