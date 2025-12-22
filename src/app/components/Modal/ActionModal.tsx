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
    onReset?: (id: number) => void;
    onProgressStart: (id: number) => void;
    onProgressStop: (id: number) => void;
    onApprove: (id: number) => void;
    onReject: (id: number) => void;
    onRevision: (id: number) => void;
    onSubmit: (id: number) => void;
    onDelete: (id: number) => void;
    isUserSalesManager?: boolean;
    userRoleLevel?: number;
}

export default function ActionModal({
    isOpen,
    document,
    onClose,
    onEdit,
    onReset,
    onProgressStart,
    onProgressStop,
    onApprove,
    onReject,
    onRevision,
    onSubmit,
    onDelete,
    isUserSalesManager = false,
    userRoleLevel,
}: ActionModalProps) {
    const [statusAlertOpen, setStatusAlertOpen] = React.useState(false);
    const [statusAlertMessage, setStatusAlertMessage] = React.useState('');

    const getDisabledMessage = (action: string): string | null => {
        if (action === 'stop' && document.status !== 'in_progress') {
            return '진행 중인 상태에서만 중지할 수 있습니다.';
        }
        if (action === 'submit' && document.status !== 'rejected' && document.status !== 'revision') {
            return '반려 또는 보완 상태에서만 제출할 수 있습니다.';
        }
        return null;
    };

    const handleButtonClick = (action: string) => {
        const message = getDisabledMessage(action);
        if (message) {
            setStatusAlertMessage(message);
            setStatusAlertOpen(true);
            return;
        }
        handleActionClick(action);
    };

    if (!isOpen || !document) return null;

    // 검수자 판별 (level=6)
    const isInspector = userRoleLevel === 6;

    const getAllActions = () => {
        const allActions = [
            { label: '진행', action: 'start' },
            { label: '중지', action: 'stop' },
            { label: '승인', action: 'approve' },
            { label: '반려', action: 'reject' },
            { label: '보완', action: 'revision' },
            { label: '제출', action: 'submit' },
            { label: '삭제', action: 'delete' }
        ];

        // 영업자는 진행, 중지, 승인, 반려, 보완, 삭제 숨김 (제출만 보임)
        if (isUserSalesManager) {
            return allActions.filter(action => action.action === 'submit');
        }

        // 검수자는 승인, 보완만 보임
        if (isInspector) {
            return allActions.filter(action => ['approve', 'revision'].includes(action.action));
        }

        return allActions;
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

    // 영업자가 제출 버튼을 클릭할 수 있는 조건
    const canSubmitAsSalesManager = isUserSalesManager &&
        document.progress_details === '영업자' &&
        (document.status === 'rejected' || document.status === 'revision');

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
                                <p><strong>실무자:</strong> {document.manager_name || '-'}</p>
                            </>
                        )}
                    </div>

                    <div className={styles.actionsGrid}>
                        {allActions.map((action) => (
                            <button
                                key={action.action}
                                className={`${styles.actionButton} ${styles[`action-${action.action}`]}`}
                                onClick={() => handleButtonClick(action.action)}
                            >
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.footer}>
                    {!isUserSalesManager && !isInspector && (
                        <button className={styles.resetActionButton} onClick={() => {
                            if (onReset) {
                                onReset(document.id);
                                onClose();
                            }
                        }}>
                            초기화
                        </button>
                    )}
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

            {/* 상태안내 모달 */}
            {statusAlertOpen && (
                <div className={styles.overlay} onClick={() => setStatusAlertOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.header}>
                            <h3 className={styles.title}>작업 불가</h3>
                        </div>
                        <div className={styles.content}>
                            <p className={styles.message}>{statusAlertMessage}</p>
                        </div>
                        <div className={styles.footer}>
                            <button
                                className={styles.confirmButton}
                                onClick={() => setStatusAlertOpen(false)}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
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
