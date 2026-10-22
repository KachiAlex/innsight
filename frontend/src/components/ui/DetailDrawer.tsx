import { ReactNode, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './DetailDrawer.module.css';

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Optional content rendered beside the title (badges, subtitle) */
  headerExtra?: ReactNode;
  /** Width preset */
  width?: 'sm' | 'md' | 'lg';
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Right-side detail drawer. Closes on Escape and overlay click.
 * Renders via portal; focus is moved into the drawer on open.
 */
export default function DetailDrawer({
  open,
  onClose,
  title,
  headerExtra,
  width = 'md',
  children,
  footer,
}: DetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        className={`${styles.panel} ${styles[width]}`}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerText}>
            <h2 className={styles.title}>{title}</h2>
            {headerExtra}
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close panel">
            <X size={18} />
          </button>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
