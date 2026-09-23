import React, { SelectHTMLAttributes, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectInputProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  containerStyle?: React.CSSProperties;
  placeholderOption?: string;
}

export function SelectInput({
  label,
  options,
  error,
  hint,
  leftIcon,
  placeholderOption,
  className = '',
  style,
  containerStyle,
  disabled,
  id,
  ...props
}: SelectInputProps) {
  const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', ...containerStyle }}>
      {label && (
        <label 
          htmlFor={selectId} 
          style={{ 
            fontSize: '0.8rem', 
            fontWeight: '600', 
            color: 'var(--text-main)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}
        >
          <span>{label}</span>
          {props.required && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>*</span>}
        </label>
      )}

      <div style={{ 
        position: 'relative', 
        display: 'flex', 
        alignItems: 'center',
        background: disabled ? '#f1f5f9' : '#ffffff',
        border: `1px solid ${error ? '#ef4444' : 'var(--border-color)'}`,
        borderRadius: 'var(--radius-md)',
        transition: 'all 0.15s ease',
        boxShadow: error ? '0 0 0 1px #ef4444' : 'none'
      }}>
        {leftIcon && (
          <div style={{ paddingLeft: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            {leftIcon}
          </div>
        )}

        <select
          id={selectId}
          disabled={disabled}
          style={{
            flex: 1,
            width: '100%',
            padding: leftIcon ? '9px 36px 9px 8px' : '9px 36px 9px 12px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '0.85rem',
            color: disabled ? 'var(--text-muted)' : 'var(--text-main)',
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            ...style
          }}
          {...props}
        >
          {placeholderOption && (
            <option value="" disabled>
              {placeholderOption}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>

        <div style={{ 
          position: 'absolute', 
          right: '12px', 
          pointerEvents: 'none', 
          display: 'flex', 
          alignItems: 'center', 
          color: 'var(--text-muted)' 
        }}>
          <ChevronDown size={16} />
        </div>
      </div>

      {error && <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: '500' }}>{error}</span>}
      {!error && hint && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
}
