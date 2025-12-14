'use client';

import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
  onConfirm?: () => void;
  showConfirmButton?: boolean;
}

export default function Modal({
  isOpen,
  message,
  onClose,
  type = 'info',
  confirmText = '확인',
  onConfirm,
  showConfirmButton = true,
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
          <p className={styles.message} dangerouslySetInnerHTML={{ __html: message }}></p>
        </div>
        <div className={styles.footer}>
          {showConfirmButton ? (
            <>
              <button className={styles.cancelButton} onClick={onClose}>
                닫기
              </button>
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
