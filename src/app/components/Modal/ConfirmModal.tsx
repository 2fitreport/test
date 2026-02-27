'use client';

import Image from 'next/image';
import { ReactNode } from 'react';
import styles from './Modal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string | ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmButtonText?: string;
  cancelButtonText?: string;
  hideCancel?: boolean;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  type = 'info',
  confirmButtonText = '확인',
  cancelButtonText = '취소',
  hideCancel = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const getIconSrc = () => {
    if (type === 'success') return '/check.svg';
    if (type === 'error') return '/error.svg';
    if (type === 'warning') return '/question.svg';
    return null;
  };

  const iconSrc = getIconSrc();
  const handleCancel = onCancel || onConfirm;

  return (
    <div className={styles.overlay} onClick={handleCancel}>
      <div className={`${styles.modal} ${styles[type]}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          {iconSrc && (
            <div className={styles.iconWrapper}>
              <Image src={iconSrc} alt={type} width={48} height={48} className={styles.icon} />
            </div>
          )}
          {typeof message === 'string' ? (
            <p className={styles.message} dangerouslySetInnerHTML={{ __html: message }} />
          ) : (
            <div className={styles.message}>{message}</div>
          )}
        </div>
        <div className={styles.footer}>
          {!hideCancel && (
            <button className={styles.cancelButton} onClick={handleCancel}>
              {cancelButtonText}
            </button>
          )}
          <button className={styles.confirmButton} onClick={onConfirm}>
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
