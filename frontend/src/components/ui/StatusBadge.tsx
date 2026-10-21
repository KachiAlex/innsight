import { ReactNode } from 'react';
import styles from './StatusBadge.module.css';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Maps domain status strings to semantic tones.
 * Extend as new status vocabularies appear — never rely on color alone;
 * the label is always rendered.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  // reservations
  confirmed: 'success',
  checked_in: 'info',
  checked_out: 'neutral',
  cancelled: 'danger',
  no_show: 'danger',
  pending: 'warning',
  // rooms
  available: 'success',
  occupied: 'info',
  in_house: 'info',
  clean: 'success',
  dirty: 'warning',
  inspected: 'success',
  out_of_order: 'danger',
  blocked: 'danger',
  in_use: 'info',
  retired: 'neutral',
  // housekeeping / maintenance
  new: 'info',
  assigned: 'info',
  in_progress: 'warning',
  completed: 'success',
  resolved: 'success',
  open: 'warning',
  closed: 'neutral',
  // payments
  paid: 'success',
  settled: 'success',
  successful: 'success',
  failed: 'danger',
  refunded: 'info',
  initiated: 'info',
  // deposits
  held: 'warning',
  applied: 'success',
  // subscriptions / tenants
  active: 'success',
  trial: 'info',
  suspended: 'danger',
  inactive: 'neutral',
  // severity
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
  // guest requests
  urgent: 'danger',
};

interface StatusBadgeProps {
  /** Raw status string — mapped to a tone automatically when known */
  status?: string;
  /** Explicit tone override */
  tone?: BadgeTone;
  /** Custom label; defaults to humanized status */
  children?: ReactNode;
  /** Show the status dot */
  dot?: boolean;
}

const humanize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function StatusBadge({ status = '', tone, children, dot = true }: StatusBadgeProps) {
  const resolved: BadgeTone = tone ?? STATUS_TONES[status.toLowerCase()] ?? 'neutral';
  return (
    <span className={`${styles.badge} ${styles[resolved]}`} data-status={status || undefined}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      <span>{children ?? humanize(status)}</span>
    </span>
  );
}
