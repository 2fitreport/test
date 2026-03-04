'use client';

import { ReactNode } from 'react';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  message: string | ReactNode;
  onClose: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  onConfirm?: () => void;
  showConfirmButton?: boolean;
  showCancelButton?: boolean;
}

export default function Modal({
  isOpen,
  message,
  onClose,
  type = 'info',
  confirmText = '확인',
  onConfirm,
  showConfirmButton = true,
  showCancelButton = true,
}: ModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const getIconSrc = () => {
    if (type === 'success') return '/check.svg';
    if (type === 'error' || type === 'warning') return '/error.svg';
    if (type === 'info') return '/question.svg';
    return null;
  };

  const iconSrc = getIconSrc();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={`${styles.modal} ${styles[type]}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          {iconSrc && (
            <div className={styles.iconWrapper}>
              <img src={iconSrc} alt={type} className={styles.icon} />
            </div>
          )}
          <div className={styles.message} style={{ whiteSpace: 'pre-line' }}>
            {message}
          </div>
        </div>
        <div className={styles.footer}>
          {showConfirmButton ? (
            <>
              {type !== 'success' && showCancelButton && (
                <button className={styles.cancelButton} onClick={onClose}>
                  닫기
                </button>
              )}
              <button className={styles.confirmButton} onClick={handleConfirm}>
                {confirmText}
              </button>
            </>
          ) : (
            <button className={styles.confirmButton} onClick={handleConfirm}>
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
