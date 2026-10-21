import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

const btn: React.CSSProperties = {
  minWidth: '2rem',
  height: '2rem',
  padding: '0 0.5rem',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--surface)',
  color: 'var(--text-secondary)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 'var(--fs-sm)',
};

const btnActive: React.CSSProperties = {
  ...btn,
  background: 'var(--primary)',
  borderColor: 'var(--primary)',
  color: '#fff',
  fontWeight: 600,
};

const btnDisabled: React.CSSProperties = {
  ...btn,
  color: 'var(--text-faint)',
  cursor: 'not-allowed',
  background: 'var(--surface-sunken)',
};

export default function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 3) {
      for (let i = 1; i <= 4; i++) pages.push(i);
      pages.push('...', totalPages);
    } else if (page >= totalPages - 2) {
      pages.push(1, '...');
      for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1, '...');
      for (let i = page - 1; i <= page + 1; i++) pages.push(i);
      pages.push('...', totalPages);
    }
    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-3) var(--space-4)',
        background: 'var(--surface)',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
      }}
    >
      <div style={{ color: 'var(--muted)', fontSize: 'var(--fs-sm)' }}>
        Showing {startItem}–{endItem} of {total}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          style={page === 1 ? btnDisabled : btn}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        {getPageNumbers().map((pageNum, index) =>
          pageNum === '...' ? (
            <span key={`e-${index}`} style={{ padding: '0 0.4rem', color: 'var(--muted)' }}>
              …
            </span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              style={pageNum === page ? btnActive : btn}
              aria-current={pageNum === page ? 'page' : undefined}
            >
              {pageNum}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          style={page === totalPages ? btnDisabled : btn}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
