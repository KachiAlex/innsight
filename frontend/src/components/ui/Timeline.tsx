import { ReactNode } from 'react';
import styles from './Timeline.module.css';

export interface TimelineEvent {
  id: string | number;
  /** e.g. "21 Oct, 14:32" */
  timestamp: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Dot color intent */
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  /** Actor label, e.g. staff name or "System" */
  actor?: string;
}

interface TimelineProps {
  events: TimelineEvent[];
  /** Render newest first */
  descending?: boolean;
}

export default function Timeline({ events, descending = true }: TimelineProps) {
  const ordered = descending ? [...events].reverse() : events;
  return (
    <ol className={styles.timeline}>
      {ordered.map((event, i) => (
        <li key={event.id} className={styles.event}>
          <div className={styles.rail} aria-hidden="true">
            <span className={`${styles.dot} ${styles[event.tone ?? 'neutral']}`}>
              {event.icon}
            </span>
            {i < ordered.length - 1 && <span className={styles.line} />}
          </div>
          <div className={styles.content}>
            <div className={styles.head}>
              <strong className={styles.title}>{event.title}</strong>
              <time className={styles.time}>{event.timestamp}</time>
            </div>
            {event.description && <p className={styles.desc}>{event.description}</p>}
            {event.actor && <span className={styles.actor}>{event.actor}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
