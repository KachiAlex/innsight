import { ReactNode } from 'react';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Breadcrumb trail rendered above the title */
  breadcrumb?: ReactNode;
  /** Right-aligned actions (buttons, menus) */
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        {breadcrumb && <nav className={styles.breadcrumb} aria-label="Breadcrumb">{breadcrumb}</nav>}
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
