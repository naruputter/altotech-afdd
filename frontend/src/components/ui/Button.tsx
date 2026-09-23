import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'subtle' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  style,
  className = '',
  ...props
}: ButtonProps) {
  // Variant styles
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--primary-blue)',
          color: '#ffffff',
          border: '1px solid transparent',
          boxShadow: '0 1px 2px 0 rgba(37, 99, 235, 0.2)'
        };
      case 'secondary':
        return {
          background: '#ffffff',
          color: 'var(--text-main)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        };
      case 'danger':
        return {
          background: '#dc2626',
          color: '#ffffff',
          border: '1px solid transparent',
          boxShadow: '0 1px 2px 0 rgba(220, 38, 38, 0.2)'
        };
      case 'success':
        return {
          background: '#16a34a',
          color: '#ffffff',
          border: '1px solid transparent',
          boxShadow: '0 1px 2px 0 rgba(22, 163, 74, 0.2)'
        };
      case 'subtle':
        return {
          background: 'var(--primary-blue-subtle)',
          color: 'var(--primary-blue)',
          border: '1px solid rgba(37, 99, 235, 0.15)'
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid transparent'
        };
      default:
        return {};
    }
  };

  // Size styles
  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '4px 10px',
          fontSize: '0.76rem',
          borderRadius: 'var(--radius-sm)',
          gap: '5px'
        };
      case 'lg':
        return {
          padding: '10px 22px',
          fontSize: '0.94rem',
          borderRadius: 'var(--radius-md)',
          gap: '8px'
        };
      case 'md':
      default:
        return {
          padding: '7px 16px',
          fontSize: '0.84rem',
          borderRadius: 'var(--radius-md)',
          gap: '6px'
        };
    }
  };

  const isDisabled = disabled || isLoading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: '600',
        fontFamily: 'var(--font-sans)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.65 : 1,
        transition: 'all 0.15s ease',
        userSelect: 'none',
        outline: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style
      }}
      className={`btn ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 12 : 15} className="spin" />
      ) : (
        leftIcon
      )}
      {children && <span>{children}</span>}
      {!isLoading && rightIcon}
    </button>
  );
}
