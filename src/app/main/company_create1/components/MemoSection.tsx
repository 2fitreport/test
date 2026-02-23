'use client';

import { useState } from 'react';
import { MessageSquare, Send, UserCircle } from 'lucide-react';
import styles from './MemoSection.module.css';

interface Memo {
    id: number;
    author: string;
    timestamp: string;
    content: string;
}

export default function MemoSection() {
    const [memos, setMemos] = useState<Memo[]>([
        {
            id: 1,
            author: '김담당',
            timestamp: '2026.02.20 14:30',
            content: '초기 상담 완료, 서류 요청 단계로 이동합니다.'
        },
        {
            id: 2,
            author: '이매니저',
            timestamp: '2026.02.21 09:15',
            content: '재무제표 추가 확인 필요, 최근 3년치 자료 요청 예정.'
        }
    ]);
    const [memoInput, setMemoInput] = useState('');

    const handleAddMemo = () => {
        if (memoInput.trim()) {
            const newMemo: Memo = {
                id: memos.length + 1,
                author: '현재사용자',
                timestamp: new Date().toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                }).replace(/\./g, '.'),
                content: memoInput
            };
            setMemos([...memos, newMemo]);
            setMemoInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
        }
    };

    return (
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
                            </div>
                            <span className={styles.timestamp}>{memo.timestamp}</span>
                        </div>
                        <p className={styles.memoContent}>{memo.content}</p>
                    </div>
                ))}
            </div>

            <div className={styles.memoInputWrap}>
                <textarea
                    className={styles.memoInput}
                    placeholder="메모를 입력하세요..."
                    value={memoInput}
                    onChange={(e) => setMemoInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
                <button className={styles.submitBtn} onClick={handleAddMemo}>
                    <Send size={18} />
                    메모 추가
                </button>
            </div>
        </div>
    );
}
