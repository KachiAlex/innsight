import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import styles from './StateViews.module.css';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Render inside a bordered surface panel vs bare */
  contained?: boolean;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  contained = true,
}: EmptyStateProps) {
  return (
    <div className={`${styles.state} ${contained ? styles.contained : ''}`}>
      <div className={styles.iconWrap}>{icon ?? <Inbox size={28} strokeWidth={1.6} />}</div>
      <h3 className={styles.title}>{title}</h3>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
