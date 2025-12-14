'use client';

import styles from './Modal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmModal({
  isOpen,
  message,
  onClose,
  onConfirm,
  type = 'info',
  confirmText = '확인',
  cancelText = '취소',
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getIconSrc = () => {
    if (type === 'success') return '/check.svg';
    if (type === 'error') return '/error.svg';
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
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={onClose}>
            {cancelText}
          </button>
          <button className={styles.confirmButton} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
