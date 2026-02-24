'use client';

import React from 'react';
import styles from '../companyCreate.module.css';

interface DocumentMemo {
    timestamp: string;
    content: string;
    user_name: string;
    user_id: string;
}

interface Document {
    memos?: DocumentMemo[];
    [key: string]: any;
}

interface MemoSectionProps {
    documentData: Document | null;
    memoInput: string;
    setMemoInput: (input: string) => void;
    currentUser: { id: string; name: string } | null;
    isEditMode: boolean;
    isViewMode: boolean;
    handleAddMemo: () => Promise<void>;
    handleDeleteMemo: (memoIndex: number) => Promise<void>;
    error: string;
    setError: (error: string) => void;
    errorModalOpen: boolean;
    setErrorModalOpen: (open: boolean) => void;
    successMessage: string;
    setSuccessMessage: (message: string) => void;
}

export default function MemoSection({
    documentData,
    memoInput,
    setMemoInput,
    currentUser,
    isEditMode,
    isViewMode,
    handleAddMemo,
    handleDeleteMemo,
    error,
    setError,
    errorModalOpen,
    setErrorModalOpen,
    successMessage,
    setSuccessMessage,
}: MemoSectionProps) {
    if (!isViewMode) {
        return null;
    }

    return (
        <div className={`${styles.formSection} ${styles.memoSectionWrapper}`}>
            <h3 className={styles.formSectionTitle}>메모</h3>

            {!isEditMode && (
                <div className={styles.memoInputContainer}>
                    <textarea
                        value={memoInput}
                        onChange={(e) => setMemoInput(e.target.value)}
                        placeholder="메모를 입력하세요..."
                        className={styles.memoInputArea}
                    />
                    <button
                        onClick={handleAddMemo}
                        className={`${styles.primaryButton} ${styles.memoButtonMargin}`}
                    >
                        메모 추가
                    </button>
                </div>
            )}

            <div className={styles.memoList}>
                {documentData?.memos && documentData.memos.length > 0 ? (
                    documentData.memos.map((memo, index) => (
                        <div key={index} className={styles.memoItem}>
                            <div className={styles.memoHeader}>
                                <div>
                                    <p className={styles.memoUserInfo}>
                                        {memo.user_name} ({memo.user_id})
                                    </p>
                                    <p className={styles.memoTimestamp}>
                                        {new Date(memo.timestamp).toLocaleString('ko-KR')}
                                    </p>
                                </div>
                                {!isEditMode && currentUser?.id === memo.user_id && (
                                    <button
                                        onClick={() => handleDeleteMemo(index)}
                                        className={styles.memoDeleteButton}
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                            <p className={styles.memoContent}>
                                {memo.content}
                            </p>
                        </div>
                    ))
                ) : (
                    <p className={styles.memoEmpty}>
                        등록된 메모가 없습니다.
                    </p>
                )}
            </div>
        </div>
    );
}
