import { ReactNode } from 'react';
import styles from './StatCard.module.css';

interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Delta/subtext line, e.g. "↑ 6.2% vs last week" */
  delta?: ReactNode;
  /** Tone applied to the delta text and left accent */
  tone?: 'neutral' | 'good' | 'warning' | 'critical';
  icon?: ReactNode;
  onClick?: () => void;
}

export default function StatCard({ label, value, delta, tone = 'neutral', icon, onClick }: StatCardProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      className={`${styles.card} ${styles[tone]} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
    >
      <div className={styles.top}>
        <span className={styles.label}>{label}</span>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>
      <div className={styles.value}>{value}</div>
      {delta && <div className={styles.delta}>{delta}</div>}
    </Comp>
  );
}
