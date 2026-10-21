import { ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import styles from './StateViews.module.css';

interface ErrorStateProps {
  title?: string;
  message?: string;
  /** Retry callback — renders a retry button when provided */
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
}

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  action,
}: ErrorStateProps) {
  return (
    <div className={`${styles.state} ${styles.contained} ${styles.error}`} role="alert">
      <div className={`${styles.iconWrap} ${styles.iconDanger}`}>
        <AlertTriangle size={28} strokeWidth={1.6} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      {message && <p className={styles.description}>{message}</p>}
      <div className={styles.action}>
        {onRetry && (
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            <RefreshCw size={14} /> {retryLabel}
          </button>
        )}
        {action}
      </div>
    </div>
  );
}
