import React, { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { TextInput } from '../input/TextInput.tsx';

export interface TableSearchHeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  title?: ReactNode;
  subtitle?: string;
  totalCount?: number;
  filters?: ReactNode;
  actions?: ReactNode;
  containerStyle?: React.CSSProperties;
}

export function TableSearchHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  title,
  subtitle,
  totalCount,
  filters,
  actions,
  containerStyle,
}: TableSearchHeaderProps) {
  const [localSearch, setLocalSearch] = React.useState<string>(searchValue || '');

  // Sync if parent search prop changes
  React.useEffect(() => {
    setLocalSearch(searchValue || '');
  }, [searchValue]);

  const handleCommitSearch = () => {
    onSearchChange(localSearch.trim());
  };

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  return (
    <div style={{
      padding: '16px 20px',
      background: '#ffffff',
      borderBottom: '1px solid var(--border-color)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      ...containerStyle
    }}>
      {/* Top Title & Quick Actions Row */}
      {(title || actions) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            {typeof title === 'string' ? (
              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {title}
                {totalCount !== undefined && (
                  <span style={{ fontSize: '0.72rem', background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
                    {totalCount}
                  </span>
                )}
              </h3>
            ) : (
              title
            )}
            {subtitle && <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '2px' }}>{subtitle}</p>}
          </div>

          {actions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {actions}
            </div>
          )}
        </div>
      )}

      {/* Bottom Search & Filter Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '360px', flex: '1 1 280px' }}>
          <div style={{ flex: 1 }}>
            <TextInput
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCommitSearch();
                }
              }}
              placeholder={searchPlaceholder}
              leftIcon={<Search size={15} />}
              rightIcon={
                localSearch ? (
                  <button
                    type="button"
                    onClick={handleClear}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex' }}
                    title="Clear search"
                  >
                    <X size={14} color="var(--text-muted)" />
                  </button>
                ) : null
              }
              style={{ fontSize: '0.82rem', padding: '7px 8px' }}
            />
          </div>
          <button
            type="button"
            onClick={handleCommitSearch}
            style={{
              background: 'var(--primary-blue)',
              color: '#ffffff',
              border: 'none',
              padding: '7px 14px',
              borderRadius: 'var(--radius-sm, 6px)',
              fontSize: '0.8rem',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              whiteSpace: 'nowrap',
              height: '35px'
            }}
          >
            <Search size={13} />
            Search
          </button>
        </div>

        {filters && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', flex: 1, justifyContent: 'flex-end' }}>
            {filters}
          </div>
        )}
      </div>
    </div>
  );
}
