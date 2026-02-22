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
}

interface LogItemListProps {
    logs: DocumentLog[];
    hasScroll: boolean;
    onLogDeleted?: () => void;
}

const STATUS_MAP: Record<string, { label: string; badgeClass: string; dotClass: string }> = {
    waiting:     { label: '서류수집',  badgeClass: 'waiting',   dotClass: 'dotWaiting' },
    approved:    { label: '승인',  badgeClass: 'approved',  dotClass: 'dotApproved' },
    rejected:    { label: '반려',  badgeClass: 'rejected',  dotClass: 'dotRejected' },
    revision:    { label: '보완',  badgeClass: 'revision',  dotClass: 'dotRevision' },
    in_progress: { label: '진행',  badgeClass: '진행',   dotClass: 'dotStarted' },
    submitted:   { label: '제출',  badgeClass: 'submitted', dotClass: 'dotSubmitted' },
    stopped:     { label: '중지',  badgeClass: 'stopped',   dotClass: 'dotStopped' },
    assigned:    { label: '배정',  badgeClass: '진행',   dotClass: 'dotStarted' },
};

const PROGRESS_STAGE_COLORS: Record<string, string> = {
    '서류요청': '#fdd835',
    '분석': '#ff9800',
    '진행': '#42a5f5',
    '승인': '#66bb6a',
};

function timeAgo(dateStr: string) {
    const utcStr = dateStr.replace(' ', 'T') + 'Z';
    const diff = Math.floor((Date.now() - new Date(utcStr).getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
}

function getLogContent(log: DocumentLog) {
    if (log.action_type === 'status_change') {
        const status = STATUS_MAP[log.new_value ?? ''];
        return {
            dotClass: styles[status?.dotClass ?? ''] || '',
            badgeClass: styles[status?.badgeClass ?? ''] || '',
            label: status?.label ?? log.new_value ?? '',
            description: '상태로 변경되었습니다.',
        };
    }
    if (log.action_type === 'memo_add') {
        return {
            dotClass: styles.dotStarted,
            badgeClass: styles.started,
            label: '메모',
            description: '가 추가되었습니다.'
        };
    }
    if (log.action_type === 'memo_delete') {
        return {
            dotClass: styles.dotStopped,
            badgeClass: styles.stopped,
            label: '메모',
            description: '가 삭제되었습니다.'
        };
    }
    if (log.action_type === 'progress_details_change') {
        return {
            dotClass: styles.dotStarted,
            badgeClass: styles.progressStage,
            label: log.new_value || '',
            description: '상태로 변경되었습니다.',
            backgroundColor: PROGRESS_STAGE_COLORS[log.new_value ?? ''] || '#999'
        };
    }
    return {
        dotClass: styles.dotStopped,
        badgeClass: styles.stopped,
        label: '알 수 없음',
        description: '의 로그입니다.'
    };
}

export default function LogItemList({ logs, hasScroll, onLogDeleted }: LogItemListProps) {
    const router = useRouter();

    const handleLogClick = async (log: DocumentLog) => {
        try {
            // 읽음 처리
            await fetch(`/api/documents/logs/${log.id}`, {
                method: 'PATCH',
                credentials: 'include'
            });
        } catch (error) {
            console.error('읽음 처리 실패:', error);
        }

        // 기업관리로 이동
        router.push(`/main/company_create?view=${log.document_id}`);
    };

    return (
        <ul>
            {logs.length === 0 && (
                <li className={styles.empty}>알림사항이 없습니다.</li>
            )}
            {logs.map((log, idx) => {
                const content = getLogContent(log);
                const { dotClass, badgeClass, label, description, backgroundColor } = content as any;
                const isLast = idx === logs.length - 1;
                const showBorder = hasScroll || !isLast;
                return (
                    <li
                        key={log.id}
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
                            <strong style={backgroundColor ? {
                                backgroundColor: backgroundColor,
                                padding: '8px 16px',
                                borderRadius: '100px',
                                color: '#fff',
                                display: 'inline-block',
                                minWidth: '102px',
                                textAlign: 'center'
                            } : undefined} className={backgroundColor ? undefined : badgeClass}>{label}</strong>
                            {description}
                        </h4>
                        <LogDeleteButton logId={log.id} onDeleted={onLogDeleted} />
                    </li>
                );
            })}
        </ul>
    );
}
