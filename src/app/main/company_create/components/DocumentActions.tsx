'use client';

import React from 'react';
import styles from '../companyCreate.module.css';

interface Worker {
    id: number;
    user_id: string;
    name: string;
    position_id: number;
    position?: { id: number; name: string; level: number };
    company_name?: string;
}

interface Document {
    id: number;
    status: string;
    progress_details: string;
    progress_status: string;
    manager_id?: string | null;
    manager_name?: string | null;
    cretop_file?: { name: string; path: string; url: string } | null;
    cretop_none?: boolean;
    [key: string]: any;
}

interface DocumentActionsProps {
    documentData: Document | null;
    isEditMode: boolean;
    canEdit: boolean;
    actionConfirmModalOpen: boolean;
    setActionConfirmModalOpen: (open: boolean) => void;
    actionConfirmType: 'start' | 'stop' | 'restart' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' | 'reset';
    setActionConfirmType: (type: 'start' | 'stop' | 'restart' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' | 'reset') => void;
    reasonInputModalOpen: boolean;
    setReasonInputModalOpen: (open: boolean) => void;
    reasonInput: string;
    setReasonInput: (input: string) => void;
    managerSelectModalOpen: boolean;
    setManagerSelectModalOpen: (open: boolean) => void;
    selectedManager: string;
    setSelectedManager: (manager: string) => void;
    workers: Worker[];
    error: string;
    setError: (error: string) => void;
    errorModalOpen: boolean;
    setErrorModalOpen: (open: boolean) => void;
    handleProgressStart: (id: number) => void;
    handleApprove: (id: number) => void;
    handleReject: (id: number) => void;
    handleRevision: (id: number) => void;
    handleActionSubmit: (id: number) => void;
    handleProgressStop: (id: number) => void;
    handleProgressRestart: (id: number) => void;
    handleProgressDelete: (id: number) => void;
    handleReset: (id: number) => void;
}

export default function DocumentActions({
    documentData,
    isEditMode,
    canEdit,
    actionConfirmModalOpen,
    setActionConfirmModalOpen,
    actionConfirmType,
    setActionConfirmType,
    reasonInputModalOpen,
    setReasonInputModalOpen,
    reasonInput,
    setReasonInput,
    managerSelectModalOpen,
    setManagerSelectModalOpen,
    selectedManager,
    setSelectedManager,
    workers,
    error,
    setError,
    errorModalOpen,
    setErrorModalOpen,
    handleProgressStart,
    handleApprove,
    handleReject,
    handleRevision,
    handleActionSubmit,
    handleProgressStop,
    handleProgressRestart,
    handleProgressDelete,
    handleReset,
}: DocumentActionsProps) {
    if (!documentData || isEditMode) {
        return null;
    }

    const renderActionButtons = () => {
        const id = documentData.id;

        if (documentData.status === 'waiting') {
            return (
                <div className={styles.actionButtonsContainer}>
                    <button
                        onClick={() => handleProgressStart(id)}
                        className={styles.primaryButton}
                    >
                        진행 시작
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => handleProgressDelete(id)}
                            className={styles.dangerButton}
                        >
                            삭제
                        </button>
                    )}
                </div>
            );
        }

        if (documentData.status === 'in_progress') {
            if (documentData.progress_details === '영업자') {
                return (
                    <div className={styles.actionButtonsContainer}>
                        <button
                            onClick={() => handleActionSubmit(id)}
                            className={styles.primaryButton}
                        >
                            제출
                        </button>
                        <button
                            onClick={() => handleProgressStop(id)}
                            className={styles.secondaryButton}
                        >
                            중지
                        </button>
                    </div>
                );
            } else if (documentData.progress_details === '검수자') {
                return (
                    <div className={styles.actionButtonsContainer}>
                        <button
                            onClick={() => handleApprove(id)}
                            className={styles.primaryButton}
                        >
                            승인
                        </button>
                        <button
                            onClick={() => handleReject(id)}
                            className={styles.dangerButton}
                        >
                            반려
                        </button>
                        <button
                            onClick={() => handleRevision(id)}
                            className={styles.warningButton}
                        >
                            보완
                        </button>
                    </div>
                );
            } else if (documentData.progress_details === '대표실무자') {
                return (
                    <div className={styles.actionButtonsContainer}>
                        <button
                            onClick={() => handleApprove(id)}
                            className={styles.primaryButton}
                        >
                            승인
                        </button>
                        <button
                            onClick={() => handleReject(id)}
                            className={styles.dangerButton}
                        >
                            반려
                        </button>
                        <button
                            onClick={() => handleRevision(id)}
                            className={styles.warningButton}
                        >
                            보완
                        </button>
                    </div>
                );
            } else if (documentData.progress_details === '실무자') {
                return (
                    <div className={styles.actionButtonsContainer}>
                        <button
                            onClick={() => handleApprove(id)}
                            className={styles.primaryButton}
                        >
                            승인
                        </button>
                        <button
                            onClick={() => handleReject(id)}
                            className={styles.dangerButton}
                        >
                            반려
                        </button>
                    </div>
                );
            }
        }

        if (documentData.status === 'submitted') {
            return (
                <div className={styles.actionButtonsContainer}>
                    <button
                        onClick={() => handleApprove(id)}
                        className={styles.primaryButton}
                    >
                        승인
                    </button>
                    <button
                        onClick={() => handleReject(id)}
                        className={styles.dangerButton}
                    >
                        반려
                    </button>
                    <button
                        onClick={() => handleRevision(id)}
                        className={styles.warningButton}
                    >
                        보완
                    </button>
                </div>
            );
        }

        if (documentData.status === 'stopped') {
            return (
                <div className={styles.actionButtonsContainer}>
                    <button
                        onClick={() => handleProgressRestart(id)}
                        className={styles.primaryButton}
                    >
                        재시작
                    </button>
                </div>
            );
        }

        if (documentData.status === 'rejected' || documentData.status === 'revision') {
            return (
                <div className={styles.actionButtonsContainer}>
                    <button
                        onClick={() => handleProgressRestart(id)}
                        className={styles.primaryButton}
                    >
                        재시작
                    </button>
                    {canEdit && (
                        <button
                            onClick={() => handleReset(id)}
                            className={styles.dangerButton}
                        >
                            리셋
                        </button>
                    )}
                </div>
            );
        }

        if (documentData.status === 'approved') {
            return (
                <div className={styles.actionButtonsContainer}>
                    {canEdit && (
                        <button
                            onClick={() => handleReset(id)}
                            className={styles.secondaryButton}
                        >
                            리셋
                        </button>
                    )}
                </div>
            );
        }

        return null;
    };

    return (
        <div className={`${styles.formSection} ${styles.actionStatusInfo}`}>
            <h3 className={styles.formSectionTitle}>작업</h3>
            <div className={styles.actionStatusInfoBox}>
                <p className={styles.statusInfoRow}>상태: <strong>{documentData.status}</strong></p>
                <p className={styles.statusInfoRowLast}>진행: <strong>{documentData.progress_details}</strong></p>
            </div>

            {renderActionButtons()}
        </div>
    );
}
