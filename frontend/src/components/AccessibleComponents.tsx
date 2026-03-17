import React, { forwardRef } from 'react';
import { A11Y_FOCUS_STYLE, isSpaceKey } from '../utils/accessibility';

/**
 * Accessible Button - WCAG 2.1 AA compliant
 */
interface AccessibleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ariaLabel?: string;
  ariaDescribedBy?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
  ariaControls?: string;
  children: React.ReactNode;
  pressed?: boolean;
  focusStyle?: React.CSSProperties;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      ariaLabel,
      ariaDescribedBy,
      ariaPressed,
      ariaExpanded,
      ariaControls,
      children,
      focusStyle = A11Y_FOCUS_STYLE,
      style,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      // Ensure buttons work with Space key too
      if (isSpaceKey(e)) {
        e.preventDefault();
        e.currentTarget.click();
      }
      onKeyDown?.(e);
    };

    return (
      <button
        ref={ref}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-pressed={ariaPressed}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          ...(isFocused ? focusStyle : {}),
          transition: 'outline 0.2s, outline-offset 0.2s',
          ...style,
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

/**
 * Accessible input field - WCAG 2.1 AA compliant
 */
interface AccessibleInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
  ariaDescribedBy?: string;
  containerStyle?: React.CSSProperties;
  labelStyle?: React.CSSProperties;
  focusStyle?: React.CSSProperties;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  (
    {
      label,
      description,
      error,
      ariaDescribedBy,
      containerStyle,
      labelStyle,
      focusStyle = A11Y_FOCUS_STYLE,
      id,
      required,
      type = 'text',
      disabled,
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const inputId = id || `input-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const descriptionId = `${inputId}-description`;
    const errorId = `${inputId}-error`;

    const describedByIds = [
      description ? descriptionId : '',
      error ? errorId : '',
      ariaDescribedBy,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div style={containerStyle}>
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 500,
            color: '#1e293b',
            ...labelStyle,
          }}
        >
          {label}
          {required && <span aria-label="required"> *</span>}
        </label>

        <input
          ref={ref}
          id={inputId}
          type={type}
          required={required}
          disabled={disabled}
          aria-describedby={describedByIds || undefined}
          aria-invalid={!!error}
          aria-required={required}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: error ? '2px solid #ef4444' : '1px solid #cbd5e1',
            fontSize: '1rem',
            color: disabled ? '#94a3b8' : '#1e293b',
            background: disabled ? '#f1f5f9' : 'white',
            ...(isFocused ? focusStyle : {}),
            transition: 'border-color 0.2s, outline 0.2s, outline-offset 0.2s',
            ...props.style,
          }}
          {...props}
        />

        {description && (
          <div
            id={descriptionId}
            style={{
              marginTop: '0.25rem',
              fontSize: '0.875rem',
              color: '#64748b',
            }}
          >
            {description}
          </div>
        )}

        {error && (
          <div
            id={errorId}
            role="alert"
            style={{
              marginTop: '0.25rem',
              fontSize: '0.875rem',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';

/**
 * Accessible checkbox - WCAG 2.1 AA compliant
 */
interface AccessibleCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  description?: string;
  error?: string;
}

export const AccessibleCheckbox = forwardRef<HTMLInputElement, AccessibleCheckboxProps>(
  ({ label, description, error, id, required, disabled, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const checkboxId = id || `checkbox-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const descriptionId = `${checkboxId}-description`;
    const errorId = `${checkboxId}-error`;

    const describedByIds = [
      description ? descriptionId : '',
      error ? errorId : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            ref={ref}
            id={checkboxId}
            type="checkbox"
            required={required}
            disabled={disabled}
            aria-describedby={describedByIds || undefined}
            aria-invalid={!!error}
            aria-required={required}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            style={{
              width: '1rem',
              height: '1rem',
              cursor: disabled ? 'not-allowed' : 'pointer',
              ...(isFocused ? A11Y_FOCUS_STYLE : {}),
            }}
            {...props}
          />
          <label
            htmlFor={checkboxId}
            style={{
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: disabled ? '#94a3b8' : '#1e293b',
              fontSize: '1rem',
            }}
          >
            {label}
            {required && <span aria-label="required"> *</span>}
          </label>
        </div>

        {description && (
          <div
            id={descriptionId}
            style={{
              marginTop: '0.25rem',
              fontSize: '0.875rem',
              color: '#64748b',
              marginLeft: '1.5rem',
            }}
          >
            {description}
          </div>
        )}

        {error && (
          <div
            id={errorId}
            role="alert"
            style={{
              marginTop: '0.25rem',
              fontSize: '0.875rem',
              color: '#ef4444',
              marginLeft: '1.5rem',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }
);

AccessibleCheckbox.displayName = 'AccessibleCheckbox';

/**
 * Accessible Select - WCAG 2.1 AA compliant
 */
interface SelectOption {
  value: string;
  label: string;
}

interface AccessibleSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  description?: string;
  error?: string;
}

export const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
  ({ label, options, description, error, id, required, disabled, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const selectId = id || `select-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const descriptionId = `${selectId}-description`;
    const errorId = `${selectId}-error`;

    const describedByIds = [
      description ? descriptionId : '',
      error ? errorId : '',
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div>
        <label
          htmlFor={selectId}
          style={{
            display: 'block',
            marginBottom: '0.5rem',
            fontWeight: 500,
            color: '#1e293b',
          }}
        >
          {label}
          {required && <span aria-label="required"> *</span>}
        </label>

        <select
          ref={ref}
          id={selectId}
          required={required}
          disabled={disabled}
          aria-describedby={describedByIds || undefined}
          aria-invalid={!!error}
          aria-required={required}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            borderRadius: '6px',
            border: error ? '2px solid #ef4444' : '1px solid #cbd5e1',
            fontSize: '1rem',
            color: disabled ? '#94a3b8' : '#1e293b',
            background: disabled ? '#f1f5f9' : 'white',
            ...(isFocused ? A11Y_FOCUS_STYLE : {}),
            transition: 'border-color 0.2s, outline 0.2s, outline-offset 0.2s',
          }}
          {...props}
        >
          <option value="">-- Select {label.toLowerCase()} --</option>
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {description && (
          <div
            id={descriptionId}
            style={{
              marginTop: '0.25rem',
              fontSize: '0.875rem',
              color: '#64748b',
            }}
          >
            {description}
          </div>
        )}

        {error && (
          <div
            id={errorId}
            role="alert"
            style={{
              marginTop: '0.25rem',
              fontSize: '0.875rem',
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }
);

AccessibleSelect.displayName = 'AccessibleSelect';
