import styles from './ChargeSummary.module.css';

export interface ChargeLine {
  label: string;
  amount: number;
  /** Rendered instead of a bare number, e.g. "(3 nights × ₦95,000)" */
  note?: string;
  negative?: boolean;
}

interface ChargeSummaryProps {
  lines: ChargeLine[];
  total: number;
  totalLabel?: string;
  /** e.g. "₦" — caller supplies; never hardcode currency in components */
  currency?: string;
  /** Sticky variant for checkout sidebars */
  sticky?: boolean;
  title?: string;
}

const fmt = (n: number, currency = '') =>
  `${currency}${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Itemized money summary — used by folio, checkout, deposit and night-audit
 * screens. Keeps the "rate × nights vs total" distinction visible via notes.
 */
export default function ChargeSummary({
  lines,
  total,
  totalLabel = 'Total',
  currency = '',
  sticky,
  title,
}: ChargeSummaryProps) {
  return (
    <div className={`${styles.summary} ${sticky ? styles.sticky : ''}`}>
      {title && <h3 className={styles.title}>{title}</h3>}
      <dl className={styles.lines}>
        {lines.map((line, i) => (
          <div className={styles.line} key={i}>
            <dt className={styles.lineLabel}>
              {line.label}
              {line.note && <span className={styles.note}>{line.note}</span>}
            </dt>
            <dd className={`${styles.lineAmount} ${line.negative ? styles.negative : ''}`}>
              {line.negative ? '−' : ''}
              {fmt(line.amount, currency)}
            </dd>
          </div>
        ))}
      </dl>
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>{totalLabel}</span>
        <span className={styles.totalAmount}>{fmt(total, currency)}</span>
      </div>
    </div>
  );
}
