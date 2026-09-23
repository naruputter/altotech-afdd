import React, { ReactNode } from 'react';
import { AlertTriangle, Info, CheckCircle2, HelpCircle } from 'lucide-react';
import { Modal } from './Modal.tsx';
import { Button, ButtonVariant } from './Button.tsx';

export type ConfirmType = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmType;
  isLoading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger',
  isLoading = false
}: ConfirmModalProps) {
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle size={24} color="#dc2626" />;
      case 'warning':
        return <AlertTriangle size={24} color="#d97706" />;
      case 'success':
        return <CheckCircle2 size={24} color="#16a34a" />;
      case 'info':
      default:
        return <Info size={24} color="var(--primary-blue)" />;
    }
  };

  const getIconBg = () => {
    switch (type) {
      case 'danger':
        return 'var(--status-critical-bg)';
      case 'warning':
        return 'var(--status-medium-bg)';
      case 'success':
        return 'var(--status-healthy-bg)';
      case 'info':
      default:
        return 'var(--primary-blue-subtle)';
    }
  };

  const getButtonVariant = (): ButtonVariant => {
    switch (type) {
      case 'danger':
        return 'danger';
      case 'success':
        return 'success';
      default:
        return 'primary';
    }
  };

  const defaultTitle = type === 'danger' ? 'Confirm Action' : 'Are you sure?';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || defaultTitle}
      maxWidth="440px"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </Button>
          <Button
            variant={getButtonVariant()}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: getIconBg(),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          {getIcon()}
        </div>
        <div style={{ flex: 1, paddingTop: '2px' }}>
          <div style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
            {message}
          </div>
        </div>
      </div>
    </Modal>
  );
}
