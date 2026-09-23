import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SelectInput } from '../input/SelectInput.tsx';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  pageSizeOptions = [10, 25, 50, 100],
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 18px',
      background: '#ffffff',
      borderTop: '1px solid var(--border-color)',
      fontSize: '0.8rem',
      color: 'var(--text-muted)',
      flexWrap: 'wrap',
      gap: '12px'
    }}>
      {/* Left: Summary and Page Size Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span>
          Showing <strong style={{ color: 'var(--text-main)' }}>{startItem}</strong> to{' '}
          <strong style={{ color: 'var(--text-main)' }}>{endItem}</strong> of{' '}
          <strong style={{ color: 'var(--text-main)' }}>{totalItems}</strong> entries
        </span>

        {onPageSizeChange && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>Show</span>
            <div style={{ width: '80px' }}>
              <SelectInput
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                options={pageSizeOptions.map(size => ({ value: size, label: `${size}` }))}
                style={{ padding: '4px 28px 4px 8px', fontSize: '0.78rem' }}
              />
            </div>
            <span>per page</span>
          </div>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1 || totalPages === 0}
          title="First Page"
          style={{
            padding: '6px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: '#ffffff',
            color: currentPage === 1 ? 'var(--border-color)' : 'var(--text-main)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronsLeft size={15} />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || totalPages === 0}
          title="Previous Page"
          style={{
            padding: '6px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: '#ffffff',
            color: currentPage === 1 ? 'var(--border-color)' : 'var(--text-main)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronLeft size={15} />
        </button>

        {getPageNumbers().map((page, idx) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${idx}`} style={{ padding: '0 6px', color: 'var(--text-muted)' }}>
                ...
              </span>
            );
          }

          const isCurrent = page === currentPage;
          return (
            <button
              key={`page-${page}`}
              onClick={() => onPageChange(page as number)}
              style={{
                minWidth: '30px',
                height: '30px',
                padding: '0 6px',
                borderRadius: 'var(--radius-sm)',
                border: isCurrent ? '1px solid #2563eb' : '1px solid var(--border-color)',
                background: isCurrent ? '#2563eb' : '#ffffff',
                color: isCurrent ? '#ffffff' : 'var(--text-main)',
                fontWeight: isCurrent ? '600' : '400',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {page}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
          title="Next Page"
          style={{
            padding: '6px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: '#ffffff',
            color: currentPage === totalPages ? 'var(--border-color)' : 'var(--text-main)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronRight size={15} />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages || totalPages === 0}
          title="Last Page"
          style={{
            padding: '6px 8px',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-sm)',
            background: '#ffffff',
            color: currentPage === totalPages ? 'var(--border-color)' : 'var(--text-main)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  );
}
