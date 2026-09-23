import React, { ReactNode } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button.tsx';

export interface TableToolbarProps {
  // Primary Action (e.g. Add Space / Add Equipment)
  onAdd?: () => void;
  addLabel?: string;
  addIcon?: ReactNode;
  addDisabled?: boolean;

  // Refresh Action
  onRefresh?: () => void;
  isRefreshing?: boolean;
  refreshLabel?: string;

  // Custom Filters & Tabs slot
  filters?: ReactNode;

  // Custom Extra Actions slot
  extraActions?: ReactNode;

  // Optional styling
  containerStyle?: React.CSSProperties;
}

export function TableToolbar({
  onAdd,
  addLabel = 'Add New',
  addIcon = <Plus size={15} />,
  addDisabled = false,
  onRefresh,
  isRefreshing = false,
  refreshLabel,
  filters,
  extraActions,
  containerStyle,
}: TableToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        width: '100%',
        ...containerStyle,
      }}
    >
      {/* Left / Center: Filter elements & Switchers */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
        {filters}
      </div>

      {/* Right: Action Buttons (Refresh, Add, Extra) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {extraActions}

        {onRefresh && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            isLoading={isRefreshing}
            leftIcon={<RefreshCw size={14} />}
            title="Refresh Table Data"
          >
            {refreshLabel}
          </Button>
        )}

        {onAdd && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAdd}
            disabled={addDisabled}
            leftIcon={addIcon}
          >
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
