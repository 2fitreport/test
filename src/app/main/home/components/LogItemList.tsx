'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './logWrap.module.css';
import LogDeleteButton from './LogDeleteButton';

interface DocumentLog {
    id: number;
    document_id: number;
    document_title: string;
    company_name: string;
    action_type: 'status_change' | 'memo_add' | 'memo_delete' | 'progress_details_change' | 'manager_assigned';
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

const STATUS_MAP: Record<string, { label: string; badgeClass: string; dotClass: string; backgroundColor?: string }> = {
    '정상':     { label: '정상',  badgeClass: 'waiting',   dotClass: 'dotWaiting', backgroundColor: 'var(--color-normal)' },
    '보완':    { label: '보완',  badgeClass: 'revision',  dotClass: 'dotRevision', backgroundColor: 'var(--color-revision)' },
    '보류':    { label: '보류',  badgeClass: 'stopped',   dotClass: 'dotStopped', backgroundColor: 'var(--color-hold)' },
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
    '상담': 'var(--color-consultation)',
    '서류요청': 'var(--color-document-request)',
    '분석': 'var(--color-analysis)',
    '진행': 'var(--color-progress)',
    '승인': 'var(--color-approval)',
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
            backgroundColor: status?.backgroundColor
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
    if (log.action_type === 'manager_assigned') {
        return {
            dotClass: styles.dotStarted,
            badgeClass: styles.started,
            label: '실무자',
            description: `가 배정되었습니다. (${log.new_value})`,
            backgroundColor: '#2196f3'
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
    const [userLevel, setUserLevel] = useState<number>(0);

    useEffect(() => {
        const adminData = sessionStorage.getItem('admin_data');
        if (adminData) {
            try {
                const data = JSON.parse(adminData);
                setUserLevel(data.position?.level || 0);
            } catch (error) {
                console.error('admin_data 파싱 실패:', error);
            }
        }
    }, []);

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

    const filteredLogs = logs.filter(log => {
        // 메모 삭제 로그는 표시하지 않음
        if (log.action_type === 'memo_delete') {
            return false;
        }
        // 실무자 배정 알림은 대표(1) 또는 대표실무자(2)일 때만 표시
        if (log.action_type === 'manager_assigned' && userLevel !== 1 && userLevel !== 2) {
            return false;
        }
        return true;
    });

    return (
        <ul>
            {filteredLogs.length === 0 && (
                <li className={styles.empty}>알림사항이 없습니다.</li>
            )}
            {filteredLogs.map((log, idx) => {
                const content = getLogContent(log);
                const { dotClass, badgeClass, label, description, backgroundColor } = content as any;
                const isLast = idx === filteredLogs.length - 1;
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
