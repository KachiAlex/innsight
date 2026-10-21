import { CSSProperties } from 'react';
import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ width, height = 14, circle, className = '', style }: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${circle ? styles.circle : ''} ${className}`}
      style={{
        width,
        height,
        ...(circle ? { width: width ?? height } : {}),
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

/** Card-sized placeholder matching StatCard/panel proportions */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className={styles.card} aria-hidden="true">
      <Skeleton width="40%" height={12} />
      <Skeleton width="60%" height={26} />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <Skeleton key={i} width={`${80 - i * 12}%`} />
      ))}
    </div>
  );
}

/** Table placeholder — a header row plus `rows` body rows */
export function SkeletonTable({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className={styles.table} aria-hidden="true">
      <div className={styles.tr}>
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} height={12} width="70%" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div className={styles.tr} key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} width={`${60 + ((r + c) % 3) * 15}%`} />
          ))}
        </div>
      ))}
    </div>
  );
}
