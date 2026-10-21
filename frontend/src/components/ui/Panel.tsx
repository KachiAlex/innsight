import { ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned header slot (buttons, links, badges) */
  actions?: ReactNode;
  children: ReactNode;
  /** Remove inner padding (e.g. when the child is a DataTable) */
  flush?: boolean;
}

export default function Panel({ title, subtitle, actions, children, flush }: PanelProps) {
  return (
    <section className={styles.panel}>
      {(title || actions) && (
        <div className={styles.header}>
          <div className={styles.headerText}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </div>
      )}
      <div className={flush ? styles.flushBody : styles.body}>{children}</div>
    </section>
  );
}
