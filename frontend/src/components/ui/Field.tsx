import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './Field.module.css';

interface FieldWrapperProps {
  label: string;
  /** Validation error message — triggers danger styling + aria-invalid */
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}

/** Label + control + hint/error wrapper for consistent form fields */
export function Field({ label, error, hint, required, children, htmlFor }: FieldWrapperProps) {
  return (
    <div className={`${styles.field} ${error ? styles.hasError : ''}`}>
      <label className={styles.label} htmlFor={htmlFor}>
        {label}
        {required && <span className={styles.req} aria-hidden="true"> *</span>}
      </label>
      {children}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function TextInput({ invalid, className = '', ...props }: TextInputProps) {
  return (
    <input
      className={`${styles.control} ${invalid ? styles.invalid : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ invalid, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={`${styles.control} ${invalid ? styles.invalid : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({ invalid, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={`${styles.control} ${styles.textarea} ${invalid ? styles.invalid : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}
