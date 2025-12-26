'use client';

import React from 'react';
import styles from './ActionModal.module.css';

interface Document {
    id: number;
    user_id: string;
    user_name: string;
    document_type: string;
    title: string;
    company_name?: string;
    representative_name?: string;
    manager_id?: string | null;
    manager_name?: string | null;
    progress_details?: string;
    status: 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped' | 'assigned';
    progress_status: 'in_progress' | 'stopped' | 'not_started';
    submitted_date: string;
    completed_date?: string;
    progress_start_date?: string;
    progress_end_time?: string;
    stopped_time?: string;
    reason?: string;
    reason_read: boolean;
}

interface ActionModalProps {
    isOpen: boolean;
    document: Document | null;
    onClose: () => void;
    onEdit?: (id: number) => void;
}

export default function ActionModal({
    isOpen,
    document,
    onClose,
    onEdit,
}: ActionModalProps) {
    if (!isOpen || !document) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>문서 정보</h3>
                    <button className={styles.closeButton} onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    <div className={styles.documentInfo}>
                        <p><strong>기업명:</strong> {document.company_name}</p>
                        <p><strong>현재 상태:</strong> {getStatusLabel(document.status)}</p>
                        {document.status === 'in_progress' && (
                            <>
                                <p><strong>검수자:</strong> {document.progress_details || '-'}</p>
                                <p><strong>대표실무자:</strong> {document.representative_name || '-'}</p>
                                <p><strong>실무자:</strong> {document.manager_name || '-'}</p>
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.editActionButton} onClick={() => {
                        if (onEdit) {
                            onEdit(document.id);
                            onClose();
                        }
                    }}>
                        보기
                    </button>
                    <button className={styles.closeActionButton} onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'approved':
            return '승인';
        case 'waiting':
            return '대기';
        case 'rejected':
            return '반려';
        case 'revision':
            return '보완';
        case 'in_progress':
            return '진행';
        case 'submitted':
            return '제출';
        case 'stopped':
            return '중지';
        case 'assigned':
            return '배정';
        default:
            return status;
    }
}
