import React, { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  containerStyle?: React.CSSProperties;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  className = '',
  style,
  containerStyle,
  disabled,
  id,
  ...props
}, ref) {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%', ...containerStyle }}>
      {label && (
        <label 
          htmlFor={inputId} 
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

        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          style={{
            flex: 1,
            width: '100%',
            padding: leftIcon ? '9px 12px 9px 8px' : '9px 12px',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: '0.85rem',
            color: disabled ? 'var(--text-muted)' : 'var(--text-main)',
            ...style
          }}
          {...props}
        />

        {rightIcon && (
          <div style={{ paddingRight: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
            {rightIcon}
          </div>
        )}
      </div>

      {error && <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: '500' }}>{error}</span>}
      {!error && hint && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{hint}</span>}
    </div>
  );
});

