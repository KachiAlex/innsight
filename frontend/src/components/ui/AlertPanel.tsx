import { ReactNode } from 'react';
import { AlertTriangle, Info, XCircle, CheckCircle } from 'lucide-react';
import styles from './AlertPanel.module.css';

export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface AlertItem {
  id: string | number;
  severity: AlertSeverity;
  title: string;
  description?: string;
  /** Deep-link label → target, e.g. { label: 'View reservation', onClick } */
  link?: { label: string; onClick: () => void };
  /** Timestamp label shown right-aligned */
  meta?: string;
  acknowledged?: boolean;
  onAcknowledge?: () => void;
}

const SEVERITY_ICON: Record<AlertSeverity, ReactNode> = {
  critical: <XCircle size={17} />,
  high: <AlertTriangle size={17} />,
  medium: <AlertTriangle size={17} />,
  low: <Info size={17} />,
  info: <Info size={17} />,
};

export function AlertRow({ item }: { item: AlertItem }) {
  return (
    <div
      className={`${styles.row} ${styles[item.severity]} ${item.acknowledged ? styles.acked : ''}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {SEVERITY_ICON[item.severity]}
      </span>
      <div className={styles.content}>
        <div className={styles.titleRow}>
          <strong className={styles.title}>{item.title}</strong>
          {item.meta && <span className={styles.meta}>{item.meta}</span>}
        </div>
        {item.description && <p className={styles.desc}>{item.description}</p>}
        <div className={styles.actions}>
          {item.link && (
            <button type="button" className={styles.linkBtn} onClick={item.link.onClick}>
              {item.link.label} →
            </button>
          )}
          {item.onAcknowledge && !item.acknowledged && (
            <button type="button" className={styles.ackBtn} onClick={item.onAcknowledge}>
              <CheckCircle size={13} /> Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface AlertPanelProps {
  items: AlertItem[];
  /** Group rows under severity headings */
  groupBySeverity?: boolean;
}

const SEVERITY_ORDER: AlertSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];

export default function AlertPanel({ items, groupBySeverity }: AlertPanelProps) {
  if (!groupBySeverity) {
    return (
      <div className={styles.panel}>
        {items.map((item) => (
          <AlertRow key={item.id} item={item} />
        ))}
      </div>
    );
  }

  const groups = SEVERITY_ORDER.map((sev) => ({
    severity: sev,
    items: items.filter((i) => i.severity === sev),
  })).filter((g) => g.items.length > 0);

  return (
    <div className={styles.panel}>
      {groups.map((group) => (
        <section key={group.severity} className={styles.group}>
          <h3 className={styles.groupTitle}>
            {group.severity} <span className={styles.count}>{group.items.length}</span>
          </h3>
          {group.items.map((item) => (
            <AlertRow key={item.id} item={item} />
          ))}
        </section>
      ))}
    </div>
  );
}
