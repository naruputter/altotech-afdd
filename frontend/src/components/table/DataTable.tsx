import React, { ReactNode, useState, useMemo, useEffect } from 'react';
import { TableSearchHeader } from './TableSearchHeader.tsx';
import { Pagination } from './Pagination.tsx';

export type ColumnType = 
  | 'text' 
  | 'type' 
  | 'status' 
  | 'datetime' 
  | 'date'
  | 'badge' 
  | 'code' 
  | 'number' 
  | 'image' 
  | 'custom'
  | 'action';

export interface Column<T> {
  key: string;
  header: ReactNode;
  type?: ColumnType;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => ReactNode;
  
  // Optional formatters/dictionaries for types and status
  badgeMap?: Record<string, { label?: string; badgeClass?: string; color?: string; bg?: string }>;
  dateFormat?: string;
  emptyPlaceholder?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  
  // Search Configuration
  searchable?: boolean;
  searchPlaceholder?: string;
  initialSearch?: string;
  searchFilter?: (item: T, query: string) => boolean;
  onSearchChange?: (query: string) => void;
  
  // Header Props
  title?: ReactNode;
  subtitle?: string;
  filters?: ReactNode;
  actions?: ReactNode;

  // Pagination Configuration (Supports both client-side and server-side)
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  serverSidePagination?: boolean;
  page?: number;
  pageSize?: number;
  totalRecords?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;

  // States & Scroll configuration
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (item: T) => void;
  className?: string;
  containerStyle?: React.CSSProperties;
  stickyHeader?: boolean;
  maxHeight?: string | number;
}

// Helper to format cells based on ColumnType
export function renderCellContent<T>(col: Column<T>, row: T, index: number): ReactNode {
  // If custom render function is provided, use it directly
  if (col.render) {
    return col.render(row, index);
  }

  const rawValue = (row as any)[col.key];
  const placeholder = col.emptyPlaceholder || '—';

  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return <span style={{ color: 'var(--text-muted)' }}>{placeholder}</span>;
  }

  switch (col.type) {
    case 'datetime': {
      try {
        const d = new Date(rawValue);
        if (isNaN(d.getTime())) return String(rawValue);
        return (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            {d.toLocaleString('en-GB', { 
              year: 'numeric', month: 'short', day: 'numeric', 
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false 
            })}
          </span>
        );
      } catch {
        return String(rawValue);
      }
    }

    case 'date': {
      try {
        const d = new Date(rawValue);
        if (isNaN(d.getTime())) return String(rawValue);
        return (
          <span style={{ fontSize: '0.82rem', color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
            {d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })}
          </span>
        );
      } catch {
        return String(rawValue);
      }
    }

    case 'status': {
      const statusMap = (col as any).statusMap;
      const strVal = String(rawValue);
      const conf = statusMap?.[strVal] || { label: strVal, color: '#64748b', bg: '#f1f5f9' };
      return (
        <span 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 9px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            fontWeight: '700',
            letterSpacing: '0.04em',
            color: conf.color,
            background: conf.bg,
            border: `1px solid ${conf.color}30`
          }}
        >
          {conf.label || strVal}
        </span>
      );
    }

    case 'type':
    case 'badge': {
      const strVal = String(rawValue).toUpperCase();
      const badgeConfig = col.badgeMap?.[strVal];
      const badgeClass = badgeConfig?.badgeClass || `badge-${strVal.toLowerCase()}`;
      return (
        <span className={`badge ${badgeClass}`} style={{ fontSize: '0.72rem' }}>
          {col.badgeMap?.[strVal]?.label || strVal}
        </span>
      );
    }

    case 'code': {
      return (
        <span className="mono" style={{ 
          fontSize: '0.74rem', 
          background: 'var(--bg-subtle)', 
          padding: '2px 6px', 
          borderRadius: '4px',
          color: 'var(--text-main)'
        }}>
          {String(rawValue)}
        </span>
      );
    }

    case 'number': {
      const num = Number(rawValue);
      return (
        <span style={{ fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>
          {isNaN(num) ? String(rawValue) : num.toLocaleString()}
        </span>
      );
    }

    case 'image': {
      return (
        <img 
          src={String(rawValue)} 
          alt="Thumbnail" 
          style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} 
        />
      );
    }

    case 'text':
    default:
      return <span style={{ color: 'var(--text-main)' }}>{String(rawValue)}</span>;
  }
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  searchable = true,
  searchPlaceholder = 'Search records...',
  initialSearch = '',
  searchFilter,
  onSearchChange,
  title,
  subtitle,
  filters,
  actions,
  pagination = true,
  defaultPageSize = 15,
  pageSizeOptions = [10, 15, 25, 50, 100],
  serverSidePagination = false,
  page: controlledPage,
  pageSize: controlledPageSize,
  totalRecords: controlledTotalRecords,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  emptyMessage = 'No records found',
  onRowClick,
  containerStyle,
  stickyHeader = true,
  maxHeight = 'calc(100vh - 280px)'
}: DataTableProps<T>) {
  const [internalSearchQuery, setInternalSearchQuery] = useState<string>(initialSearch);
  const [internalCurrentPage, setInternalCurrentPage] = useState<number>(1);
  const [internalPageSize, setInternalPageSize] = useState<number>(defaultPageSize);

  // Sync initialSearch if prop changes
  useEffect(() => {
    if (initialSearch !== undefined) {
      setInternalSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  const handleSearch = (q: string) => {
    setInternalSearchQuery(q);
    if (onSearchChange) {
      onSearchChange(q);
    }
    if (!serverSidePagination) {
      setInternalCurrentPage(1);
    }
  };

  // 1. Filter data based on search (Client-side only)
  const filteredData = useMemo(() => {
    if (serverSidePagination) return data;
    if (!internalSearchQuery.trim()) return data;
    
    if (searchFilter) {
      return data.filter(item => searchFilter(item, internalSearchQuery.toLowerCase()));
    }

    return data.filter(item => {
      const q = internalSearchQuery.toLowerCase();
      return Object.values(item as any).some(val => 
        typeof val === 'string' || typeof val === 'number'
          ? String(val).toLowerCase().includes(q)
          : false
      );
    });
  }, [data, internalSearchQuery, searchFilter, serverSidePagination]);

  // Reset internal page when search or data changes (Client-side)
  useEffect(() => {
    if (!serverSidePagination) {
      setInternalCurrentPage(1);
    }
  }, [internalSearchQuery, data.length, serverSidePagination]);

  // 2. Pagination resolution (Controlled vs Uncontrolled)
  const activePage = serverSidePagination ? (controlledPage || 1) : internalCurrentPage;
  const activePageSize = serverSidePagination ? (controlledPageSize || defaultPageSize) : internalPageSize;
  const activeTotalItems = serverSidePagination ? (controlledTotalRecords ?? data.length) : filteredData.length;
  const totalPages = Math.ceil(activeTotalItems / activePageSize) || 1;

  const paginatedData = useMemo(() => {
    if (!pagination || serverSidePagination) return filteredData;
    const start = (activePage - 1) * activePageSize;
    return filteredData.slice(start, start + activePageSize);
  }, [filteredData, pagination, serverSidePagination, activePage, activePageSize]);

  const handlePageChange = (newPage: number) => {
    if (serverSidePagination) {
      onPageChange?.(newPage);
    } else {
      setInternalCurrentPage(newPage);
    }
  };

  const handlePageSizeChange = (newPageSize: number) => {
    if (serverSidePagination) {
      onPageSizeChange?.(newPageSize);
    } else {
      setInternalPageSize(newPageSize);
      setInternalCurrentPage(1);
    }
  };

  return (
    <div style={{
      background: '#ffffff',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-sm)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      ...containerStyle
    }}>
      {/* Search & Action Header */}
      {(searchable || title || filters || actions) && (
        <div style={{ flexShrink: 0 }}>
          <TableSearchHeader
            searchValue={internalSearchQuery}
            onSearchChange={handleSearch}
            searchPlaceholder={searchPlaceholder}
            title={title}
            subtitle={subtitle}
            totalCount={activeTotalItems}
            filters={filters}
            actions={actions}
          />
        </div>
      )}

      {/* Internal Scrollable Table Body */}
      <div style={{
        overflowX: 'auto',
        overflowY: 'auto',
        flex: 1,
        minHeight: '200px',
        maxHeight: maxHeight,
        width: '100%',
        position: 'relative'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={stickyHeader ? { position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc' } : undefined}>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 16px',
                    fontSize: '0.74rem',
                    fontWeight: '700',
                    color: 'var(--text-muted)',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    textAlign: col.align || 'left',
                    width: col.width,
                    background: 'var(--bg-subtle)'
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <div className="pulse-indicator blue" style={{ width: '10px', height: '10px' }}></div>
                    <span style={{ fontSize: '0.85rem' }}>Loading data...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                  <span style={{ fontSize: '0.85rem' }}>{emptyMessage}</span>
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const key = keyExtractor(row, index);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background 0.1s ease',
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                    onMouseEnter={(e) => {
                      if (onRowClick) e.currentTarget.style.background = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      if (onRowClick) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${key}-${col.key}`}
                        style={{
                          padding: '12px 16px',
                          fontSize: '0.84rem',
                          color: 'var(--text-main)',
                          textAlign: col.align || 'left',
                          verticalAlign: 'middle'
                        }}
                      >
                        {renderCellContent(col, row, index)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && !isLoading && activeTotalItems > 0 && (
        <div style={{ flexShrink: 0 }}>
          <Pagination
            currentPage={activePage}
            totalPages={totalPages}
            pageSize={activePageSize}
            totalItems={activeTotalItems}
            pageSizeOptions={pageSizeOptions}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
