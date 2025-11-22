import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  if (totalPages <= 1) return null;

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem',
        background: 'white',
        borderTop: '1px solid #e2e8f0',
      }}
    >
      <div style={{ color: '#64748b', fontSize: '0.875rem' }}>
        Showing {startItem} to {endItem} of {total} results
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          style={{
            padding: '0.5rem',
            background: page === 1 ? '#f1f5f9' : 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            color: page === 1 ? '#94a3b8' : '#475569',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={18} />
        </button>

        {getPageNumbers().map((pageNum, index) => {
          if (pageNum === '...') {
            return (
              <span key={`ellipsis-${index}`} style={{ padding: '0 0.5rem', color: '#94a3b8' }}>
                ...
              </span>
            );
          }

          const isActive = pageNum === page;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              style={{
                minWidth: '2rem',
                padding: '0.5rem',
                background: isActive ? '#3b82f6' : 'white',
                color: isActive ? 'white' : '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: isActive ? '500' : '400',
              }}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          style={{
            padding: '0.5rem',
            background: page === totalPages ? '#f1f5f9' : 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '4px',
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
            color: page === totalPages ? '#94a3b8' : '#475569',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

