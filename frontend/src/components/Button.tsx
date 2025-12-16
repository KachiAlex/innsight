import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    fontWeight: '500',
    borderRadius: '6px',
    border: 'none',
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: 'all 0.2s',
    opacity: disabled || loading ? 0.6 : 1,
  };

  const variantStyles = {
    primary: {
      background: '#3b82f6',
      color: 'white',
    },
    secondary: {
      background: '#f1f5f9',
      color: '#475569',
    },
    danger: {
      background: '#ef4444',
      color: 'white',
    },
    ghost: {
      background: 'transparent',
      color: '#64748b',
    },
  };

  const sizeStyles = {
    sm: {
      padding: '0.5rem 1rem',
      fontSize: '0.875rem',
    },
    md: {
      padding: '0.75rem 1.5rem',
      fontSize: '1rem',
    },
    lg: {
      padding: '1rem 2rem',
      fontSize: '1.125rem',
    },
  };

  const hoverStyles = !disabled && !loading ? {
    onMouseEnter: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (variant === 'primary') {
        e.currentTarget.style.background = '#2563eb';
      } else if (variant === 'secondary') {
        e.currentTarget.style.background = '#e2e8f0';
      } else if (variant === 'danger') {
        e.currentTarget.style.background = '#dc2626';
      } else if (variant === 'ghost') {
        e.currentTarget.style.background = '#f1f5f9';
      }
    },
    onMouseLeave: (e: React.MouseEvent<HTMLButtonElement>) => {
      if (variant === 'primary') {
        e.currentTarget.style.background = '#3b82f6';
      } else if (variant === 'secondary') {
        e.currentTarget.style.background = '#f1f5f9';
      } else if (variant === 'danger') {
        e.currentTarget.style.background = '#ef4444';
      } else if (variant === 'ghost') {
        e.currentTarget.style.background = 'transparent';
      }
    },
  } : {};

  return (
    <button
      {...props}
      disabled={disabled || loading}
      style={{
        ...baseStyles,
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...style,
      }}
      {...hoverStyles}
      className={className}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 14 : size === 'lg' ? 20 : 18} style={{ animation: 'spin 1s linear infinite' }} />
      ) : icon ? (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
}

