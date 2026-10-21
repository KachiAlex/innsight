import styles from './ReservationChip.module.css';

interface ReservationChipProps {
  guestName: string;
  /** Reservation status — colors the chip */
  status?: string;
  /** Span width in grid cells (nights) */
  span?: number;
  onClick?: () => void;
  title?: string;
}

/**
 * Compact booking chip for the calendar tape chart.
 * Span stretches across date columns.
 */
export default function ReservationChip({
  guestName,
  status = 'confirmed',
  span = 1,
  onClick,
  title,
}: ReservationChipProps) {
  return (
    <button
      type="button"
      className={`${styles.chip} ${styles[status] ?? ''}`}
      style={{ gridColumn: `span ${span}` }}
      onClick={onClick}
      title={title ?? `${guestName} · ${status.replace(/_/g, ' ')}`}
    >
      <span className={styles.name}>{guestName}</span>
    </button>
  );
}
