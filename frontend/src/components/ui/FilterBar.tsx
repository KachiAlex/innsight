import { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import styles from './FilterBar.module.css';

interface FilterBarProps {
  /** Controlled search value — omit to hide the search input */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter controls (selects, tabs, chips) rendered in the bar */
  children?: ReactNode;
  /** Rendered when filters are active — typically a "Clear filters" button */
  onClear?: () => void;
  /** Count of active filters, shown on the clear button */
  activeCount?: number;
}

export default function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  children,
  onClear,
  activeCount = 0,
}: FilterBarProps) {
  return (
    <div className={styles.bar}>
      {onSearchChange && (
        <div className={styles.search}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            className={styles.input}
            placeholder={searchPlaceholder}
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label={searchPlaceholder}
          />
        </div>
      )}
      {children && <div className={styles.filters}>{children}</div>}
      {onClear && activeCount > 0 && (
        <button type="button" className={styles.clear} onClick={onClear}>
          <X size={13} /> Clear ({activeCount})
        </button>
      )}
    </div>
  );
}
