import { ReactNode } from 'react';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import { SkeletonTable } from './Skeleton';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: ReactNode;
  /** Cell renderer — defaults to row[key] */
  render?: (row: T, index: number) => ReactNode;
  /** Column width hint (CSS value or fraction string) */
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  /** Stable row key */
  rowKey: (row: T) => string | number;
  loading?: boolean;
  error?: { message?: string } | Error | null;
  onRetry?: () => void;
  empty?: {
    title: string;
    description?: string;
    action?: ReactNode;
  };
  onRowClick?: (row: T) => void;
  /** Footer slot — pagination, totals row, etc. */
  footer?: ReactNode;
  /** Max body height for sticky-header scroll regions */
  maxHeight?: string;
}

function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  onRowClick,
  footer,
  maxHeight,
}: DataTableProps<T>) {
  if (error) {
    return (
      <ErrorState
        title="Couldn't load this data"
        message={error.message}
        onRetry={onRetry}
      />
    );
  }

  if (loading) {
    return <SkeletonTable rows={6} cols={columns.length} />;
  }

  if (!data.length) {
    return (
      <EmptyState
        title={empty?.title ?? 'Nothing here yet'}
        description={empty?.description}
        action={empty?.action}
      />
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.scroll} style={maxHeight ? { maxHeight } : undefined}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: col.width, textAlign: col.align ?? 'left' }}
                  scope="col"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={rowKey(row)}
                className={onRowClick ? styles.clickableRow : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onRowClick(row);
                        }
                      }
                    : undefined
                }
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ textAlign: col.align ?? 'left' }}>
                    {col.render ? col.render(row, i) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}

export default DataTable;
