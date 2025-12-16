'use client';

import styles from './ActionModal.module.css';

interface Document {
    id: number;
    user_id: string;
    user_name: string;
    document_type: string;
    title: string;
    company_name?: string;
    representative_name?: string;
    manager_name?: string;
    progress_details?: string;
    status: 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped';
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
    onProgressStart: (id: number) => void;
    onProgressStop: (id: number) => void;
    onApprove: (id: number) => void;
    onReject: (id: number) => void;
    onRevision: (id: number) => void;
    onSubmit: (id: number) => void;
    onDelete: (id: number) => void;
}

export default function ActionModal({
    isOpen,
    document,
    onClose,
    onEdit,
    onProgressStart,
    onProgressStop,
    onApprove,
    onReject,
    onRevision,
    onSubmit,
    onDelete,
}: ActionModalProps) {
    if (!isOpen || !document) return null;

    const getAllActions = () => {
        return [
            { label: '진행', action: 'start' },
            { label: '중지', action: 'stop' },
            { label: '승인', action: 'approve' },
            { label: '반려', action: 'reject' },
            { label: '보완', action: 'revision' },
            { label: '제출', action: 'submit' },
            { label: '삭제', action: 'delete' }
        ];
    };

    const handleActionClick = (action: string) => {
        switch (action) {
            case 'start':
                onProgressStart(document.id);
                break;
            case 'stop':
                onProgressStop(document.id);
                break;
            case 'approve':
                onApprove(document.id);
                break;
            case 'reject':
                onReject(document.id);
                break;
            case 'revision':
                onRevision(document.id);
                break;
            case 'submit':
                onSubmit(document.id);
                break;
            case 'delete':
                onDelete(document.id);
                break;
        }
        onClose();
    };

    const allActions = getAllActions();

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>작업 선택</h3>
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
                                <p><strong>담당실무자:</strong> {document.manager_name || '-'}</p>
                            </>
                        )}
                    </div>

                    <div className={styles.actionsGrid}>
                        {allActions.map((action) => (
                            <button
                                key={action.action}
                                className={`${styles.actionButton} ${styles[`action-${action.action}`]}`}
                                onClick={() => handleActionClick(action.action)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    <button className={styles.editActionButton} onClick={() => {
                        if (onEdit) {
                            onEdit(document.id);
                            onClose();
                        }
                    }}>
                        수정
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
        default:
            return status;
    }
}
