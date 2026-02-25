'use client';

import { useState, useEffect } from 'react';
import { Send, Loader } from 'lucide-react';
import Modal from '@/components/Modal/Modal';
import styles from './MemoSection.module.css';

interface Reply {
    id: string;
    author: string;
    author_id: string;
    content: string;
    created_at: string;
}

interface Memo {
    id: string;
    author: string;
    author_id: string;
    content: string;
    created_at: string;
    replies: Reply[];
}

interface MemoSectionProps {
    documentId?: string | null;
    isViewMode?: boolean;
    currentUserId?: string;
    currentUserName?: string;
    currentUserPositionLevel?: number;
    memos?: Memo[];
    onMemosChange?: (memos: Memo[]) => void;
}

export default function MemoSection({
    documentId,
    isViewMode = false,
    currentUserId = '0',
    currentUserName = '현재사용자',
    currentUserPositionLevel = 0,
    memos: initialMemos = [],
    onMemosChange
}: MemoSectionProps) {
    const [memos, setMemos] = useState<Memo[]>(initialMemos);
    const [memoInput, setMemoInput] = useState('');
    const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
    const [loadingMemoId, setLoadingMemoId] = useState<string | null>(null);
    const [collapsedMemoId, setCollapsedMemoId] = useState<Set<string>>(new Set());
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteConfirmAction, setDeleteConfirmAction] = useState<(() => void) | null>(null);
    const [deleteMessage, setDeleteMessage] = useState('');
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    // documentId가 있으면 메모 로드
    useEffect(() => {
        if (documentId && isViewMode) {
            fetchMemos();
        } else {
            setMemos(initialMemos);
        }
    }, [documentId, isViewMode]);

    const fetchMemos = async () => {
        try {
            const response = await fetch(`/api/documents/${documentId}/memos`);
            if (response.ok) {
                const data = await response.json();
                setMemos(data.memos || []);
            }
        } catch (error) {
            console.error('메모 로드 실패:', error);
        }
    };

    const formatDate = (date: string | Date) => {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).replace(/\./g, '.');
    };

    const handleAddMemo = async () => {
        if (!memoInput.trim()) return;

        // 등록 모드: UI에만 추가
        if (!documentId || !isViewMode) {
            const newMemo: Memo = {
                id: Math.random().toString(36),
                author: currentUserName,
                author_id: currentUserId,
                content: memoInput,
                created_at: new Date().toISOString(),
                replies: []
            };
            const updatedMemos = [...memos, newMemo];
            setMemos(updatedMemos);
            setMemoInput('');

            if (onMemosChange) {
                onMemosChange(updatedMemos);
            }
            return;
        }

        // 조회/수정 모드: 즉시 DB에 저장
        setLoadingMemoId('new');
        try {
            const response = await fetch(`/api/documents/${documentId}/memos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: memoInput,
                    author: currentUserName,
                    author_id: currentUserId
                })
            });

            if (response.ok) {
                const data = await response.json();
                setMemos([...memos, data.memo]);
                setMemoInput('');
            }
        } catch (error) {
            console.error('메모 추가 실패:', error);
        } finally {
            setLoadingMemoId(null);
        }
    };

    const handleDeleteMemo = (memoId: string) => {
        // 대표자(1), 대표실무자(2)만 삭제 가능
        if (currentUserPositionLevel > 2) {
            setSuccessMessage('메모 삭제 권한이 없습니다.');
            setIsSuccessModalOpen(true);
            return;
        }

        setDeleteMessage('메모를 삭제하시겠습니까?');
        setDeleteConfirmAction(() => async () => {
            // 등록 모드: UI에서만 제거
            if (!documentId || !isViewMode) {
                const updatedMemos = memos.filter(m => m.id !== memoId);
                setMemos(updatedMemos);
                if (onMemosChange) {
                    onMemosChange(updatedMemos);
                }
                setSuccessMessage('메모가 삭제되었습니다.');
                setIsSuccessModalOpen(true);
                return;
            }

            // 조회/수정 모드: DB에서 삭제
            try {
                const response = await fetch(`/api/documents/${documentId}/memos/${memoId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const updatedMemos = memos.filter(m => m.id !== memoId);
                    setMemos(updatedMemos);
                    setSuccessMessage('메모가 삭제되었습니다.');
                    setIsSuccessModalOpen(true);
                } else {
                    setSuccessMessage('메모 삭제에 실패했습니다.');
                    setIsSuccessModalOpen(true);
                }
            } catch (error) {
                console.error('메모 삭제 실패:', error);
                setSuccessMessage('메모 삭제에 실패했습니다.');
                setIsSuccessModalOpen(true);
            }
        });
        setIsDeleteModalOpen(true);
    };

    const handleDeleteReply = (memoId: string, replyId: string) => {
        // 대표자(1), 대표실무자(2)만 삭제 가능
        if (currentUserPositionLevel > 2) {
            setSuccessMessage('답글 삭제 권한이 없습니다.');
            setIsSuccessModalOpen(true);
            return;
        }

        setDeleteMessage('답글을 삭제하시겠습니까?');
        setDeleteConfirmAction(() => async () => {
            // 등록 모드: UI에서만 제거
            if (!documentId || !isViewMode) {
                const updatedMemos = memos.map(memo => {
                    if (memo.id === memoId) {
                        return {
                            ...memo,
                            replies: memo.replies.filter(r => r.id !== replyId)
                        };
                    }
                    return memo;
                });
                setMemos(updatedMemos);
                if (onMemosChange) {
                    onMemosChange(updatedMemos);
                }
                setSuccessMessage('답글이 삭제되었습니다.');
                setIsSuccessModalOpen(true);
                return;
            }

            // 조회/수정 모드: DB에서 삭제
            try {
                const response = await fetch(`/api/documents/${documentId}/memos/${memoId}/replies/${replyId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' }
                });

                if (response.ok) {
                    const updatedMemos = memos.map(memo => {
                        if (memo.id === memoId) {
                            return {
                                ...memo,
                                replies: memo.replies.filter(r => r.id !== replyId)
                            };
                        }
                        return memo;
                    });
                    setMemos(updatedMemos);
                    setSuccessMessage('답글이 삭제되었습니다.');
                    setIsSuccessModalOpen(true);
                } else {
                    setSuccessMessage('답글 삭제에 실패했습니다.');
                    setIsSuccessModalOpen(true);
                }
            } catch (error) {
                console.error('답글 삭제 실패:', error);
                setSuccessMessage('답글 삭제에 실패했습니다.');
                setIsSuccessModalOpen(true);
            }
        });
        setIsDeleteModalOpen(true);
    };

    const handleAddReply = async (memoId: string) => {
        const replyContent = replyInputs[memoId];
        if (!replyContent?.trim()) return;

        // 등록 모드: UI에만 추가
        if (!documentId || !isViewMode) {
            const updatedMemos = memos.map(memo => {
                if (memo.id === memoId) {
                    return {
                        ...memo,
                        replies: [
                            ...memo.replies,
                            {
                                id: Math.random().toString(36),
                                author: currentUserName,
                                author_id: currentUserId,
                                content: replyContent,
                                created_at: new Date().toISOString()
                            }
                        ]
                    };
                }
                return memo;
            });
            setMemos(updatedMemos);
            setReplyInputs({ ...replyInputs, [memoId]: '' });

            if (onMemosChange) {
                onMemosChange(updatedMemos);
            }
            return;
        }

        // 조회/수정 모드: 즉시 DB에 저장
        setLoadingMemoId(`reply-${memoId}`);
        try {
            const response = await fetch(`/api/documents/${documentId}/memos/${memoId}/replies`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: replyContent,
                    author: currentUserName,
                    author_id: currentUserId
                })
            });

            if (response.ok) {
                const data = await response.json();
                setMemos(memos.map(memo =>
                    memo.id === memoId ? data.memo : memo
                ));
                setReplyInputs({ ...replyInputs, [memoId]: '' });
            }
        } catch (error) {
            console.error('답글 추가 실패:', error);
        } finally {
            setLoadingMemoId(null);
        }
    };

    return (
        <>
            <Modal
                isOpen={isDeleteModalOpen}
                message={deleteMessage}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmAction(null);
                }}
                onConfirm={() => {
                    if (deleteConfirmAction) {
                        deleteConfirmAction();
                    }
                }}
                confirmText="삭제"
                showConfirmButton
                type="warning"
            />
            <Modal
                isOpen={isSuccessModalOpen}
                message={successMessage}
                onClose={() => {
                    setIsSuccessModalOpen(false);
                }}
                confirmText="확인"
                showConfirmButton={false}
                type={successMessage.includes('실패') ? 'error' : 'success'}
            />
            <div className={styles.memoWrap}>
            <div className={styles.memoTitle}>
                <div>
                    <h2>담당자 메모</h2>
                    <h3>팀원들과 소통하고 중요 사항을 기록하세요.</h3>
                </div>
            </div>

            <div className={styles.memoList}>
                {memos.map((memo) => (
                    <div key={memo.id} className={styles.memoItem}>
                        <div className={styles.memoHeader}>
                            <div className={styles.memoAuthor}>
                                <span className={styles.authorName}>{memo.author}</span>
                                <span className={styles.authorId}>({memo.author_id})</span>
                            </div>
                            <div className={styles.memoHeaderRight}>
                                <span className={styles.timestamp}>{formatDate(memo.created_at)}</span>
                                {currentUserPositionLevel <= 2 && (
                                    <button
                                        className={styles.memoDeleteBtn}
                                        onClick={() => handleDeleteMemo(memo.id)}
                                        title="메모 삭제"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>
                        <p className={styles.memoContent}>{memo.content}</p>

                        {/* 답글 섹션 */}
                        {memo.replies && memo.replies.length > 0 && (
                            <div className={styles.repliesContainer}>
                                <button
                                    className={styles.expandButton}
                                    onClick={() => {
                                        const newCollapsed = new Set(collapsedMemoId);
                                        if (newCollapsed.has(memo.id)) {
                                            newCollapsed.delete(memo.id);
                                        } else {
                                            newCollapsed.add(memo.id);
                                        }
                                        setCollapsedMemoId(newCollapsed);
                                    }}
                                >
                                    {collapsedMemoId.has(memo.id) ? '>' : '∨'} 답글 {memo.replies.length}
                                </button>

                                {!collapsedMemoId.has(memo.id) && (
                                    <div className={styles.repliesList}>
                                        {memo.replies.map((reply) => (
                                            <div key={reply.id} className={styles.reply}>
                                                <div className={styles.replyHeader}>
                                                    <div className={styles.replyAuthorWrapper}>
                                                        <span className={styles.replyAuthor}>{reply.author}</span>
                                                        <span className={styles.replyAuthorId}>({reply.author_id})</span>
                                                    </div>
                                                    <div className={styles.replyHeaderRight}>
                                                        <span className={styles.replyTime}>{formatDate(reply.created_at)}</span>
                                                        {currentUserPositionLevel <= 2 && (
                                                            <button
                                                                className={styles.replyDeleteBtn}
                                                                onClick={() => handleDeleteReply(memo.id, reply.id)}
                                                                title="답글 삭제"
                                                            >
                                                                ×
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className={styles.replyContent}>{reply.content}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 답글 입력 */}
                        <div className={styles.replyInputWrap}>
                            <textarea
                                className={styles.replyInput}
                                placeholder="답글을 입력하세요..."
                                value={replyInputs[memo.id] || ''}
                                onChange={(e) => setReplyInputs({ ...replyInputs, [memo.id]: e.target.value })}
                            />
                            <button
                                className={styles.replyBtn}
                                onClick={() => handleAddReply(memo.id)}
                                disabled={loadingMemoId === `reply-${memo.id}`}
                            >
                                {loadingMemoId === `reply-${memo.id}` ? (
                                    <Loader size={16} className={styles.spinner} />
                                ) : (
                                    <Send size={16} />
                                )}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className={styles.memoInputWrap}>
                <textarea
                    className={styles.memoInput}
                    placeholder="메모를 입력하세요..."
                    value={memoInput}
                    onChange={(e) => setMemoInput(e.target.value)}
                />
                <button
                    className={styles.submitBtn}
                    onClick={handleAddMemo}
                    disabled={loadingMemoId === 'new'}
                >
                    {loadingMemoId === 'new' ? (
                        <Loader size={18} className={styles.spinner} />
                    ) : (
                        <Send size={18} />
                    )}
                    메모 추가
                </button>
            </div>
        </div>
        </>
    );
}
