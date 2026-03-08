'use client';

import { useRouter } from 'next/navigation';
import styles from './logWrap.module.css';
import LogDeleteButton from './LogDeleteButton';

interface DocumentLog {
    id: number;
    document_id: number;
    document_title: string;
    company_name: string;
    action_type: 'status_change' | 'memo_add' | 'memo_delete' | 'progress_details_change';
    actor_id: string;
    actor_name: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    submitter_id?: string;
    submitter_name?: string;
    staff_read?: Record<string, boolean>;
}

interface RevisionRejectedItemListProps {
    logs: DocumentLog[];
    hasScroll: boolean;
    currentUserId: string;
    onLogRead?: (logId: number) => void;
    onLogDeleted?: () => void;
}

const STATUS_MAP: Record<string, { label: string; badgeClass: string; dotClass: string; backgroundColor: string }> = {
    '정상': { label: '정상', badgeClass: styles.waiting, dotClass: styles.dotWaiting, backgroundColor: 'var(--color-normal)' },
    '보완': { label: '보완', badgeClass: styles.revision, dotClass: styles.dotRevision, backgroundColor: 'var(--color-revision)' },
    '보류': { label: '보류', badgeClass: styles.rejected, dotClass: styles.dotRejected, backgroundColor: 'var(--color-hold)' },
    '검수': { label: '검수', badgeClass: styles.inspection, dotClass: styles.dotInspection, backgroundColor: 'var(--color-status-inspection)' },
};

function timeAgo(dateStr: string) {
    const utcStr = dateStr.replace(' ', 'T') + 'Z';
    const diff = Math.floor((Date.now() - new Date(utcStr).getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
}

export default function RevisionRejectedItemList({
    logs,
    hasScroll,
    currentUserId,
    onLogRead,
    onLogDeleted
}: RevisionRejectedItemListProps) {
    const router = useRouter();

    const handleLogClick = async (log: DocumentLog) => {
        try {
            await fetch(`/api/documents/logs/${log.id}`, {
                method: 'PATCH',
                credentials: 'include'
            });
        } catch (error) {
            console.error('읽음 처리 실패:', error);
        }

        onLogRead?.(log.id);
        router.push(`/main/company_create?view=${log.document_id}`);
    };

    return (
        <ul className={styles.revisionWrap}>
            {logs.length === 0 && (
                <li className={styles.empty}>보완 요청이 없습니다.</li>
            )}
            {logs.map((log, idx) => {
                const status = STATUS_MAP[log.new_value ?? ''];
                const dotClass = status?.dotClass ?? '';
                const label = status?.label ?? log.new_value ?? '';
                const isLast = idx === logs.length - 1;
                const showBorder = hasScroll || !isLast;
                const isUnread = currentUserId && (log.staff_read || {})[currentUserId] !== true;
                return (
                    <li
                        key={log.id}
                        className={isUnread ? styles.unreadItem : ''}
                        style={{ borderBottom: showBorder ? '1px solid #f0f0f0' : 'none' }}
                        onClick={() => handleLogClick(log)}
                    >
                        <b className={dotClass}></b>
                        <div>
                            <h3>{log.company_name || log.document_title}</h3>
                            <p>
                                담당자: <span className={styles.manager}>{log.submitter_name || log.actor_name}</span>
                                {' '}| 변경일: <span className={styles.date}>{timeAgo(log.created_at)}</span>
                            </p>
                        </div>
                        <h4>
                            <strong style={{
                                backgroundColor: STATUS_MAP[log.new_value ?? '']?.backgroundColor,
                                padding: '8px 16px',
                                borderRadius: '100px',
                                color: '#fff',
                                display: 'inline-block',
                                minWidth: '102px',
                                textAlign: 'center'
                            }}>{label}</strong>
                            상태로 변경되었습니다.
                        </h4>
                        <LogDeleteButton logId={log.id} onDeleted={onLogDeleted} />
                    </li>
                );
            })}
        </ul>
    );
}
