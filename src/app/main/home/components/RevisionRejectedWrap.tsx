'use client';

import { useState, useEffect } from 'react';
import styles from './logWrap.module.css';
import RevisionRejectedItemList from './RevisionRejectedItemList';

interface DocumentLog {
    id: number;
    document_id: number;
    document_title: string;
    company_name: string;
    action_type: 'status_change' | 'memo_add' | 'memo_delete';
    actor_id: string;
    actor_name: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    staff_read?: Record<string, boolean>;
}

export default function RevisionRejectedWrap() {
    const [logs, setLogs] = useState<DocumentLog[]>([]);
    const [currentUserId, setCurrentUserId] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetch('/api/documents/logs?status_change_only=true&include_read=true', { credentials: 'include' })
            .then(res => res.ok ? res.json() : { logs: [], currentUserId: '' })
            .then(data => {
                setLogs(data.logs || []);
                setCurrentUserId(data.currentUserId || '');
            })
            .catch(() => setLogs([]));
    }, [refreshKey]);

    const unreadLogs = logs.filter(log => {
        const staffRead = log.staff_read || {};
        return staffRead[currentUserId] !== true;
    });
    const unreadCount = unreadLogs.length;

    const hasScroll = logs.length > 4;

    const handleLogRead = (logId: number) => {
        setLogs(prev => prev.map(log =>
            log.id === logId
                ? { ...log, staff_read: { ...(log.staff_read || {}), [currentUserId]: true } }
                : log
        ));
    };

    const handleDeleteAll = async () => {
        const allIds = logs.map(log => log.id);
        if (allIds.length === 0) return;
        try {
            await fetch('/api/documents/logs/delete-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ logIds: allIds }),
            });
            setLogs([]);
        } catch (error) {
            console.error('전체 삭제 실패:', error);
        }
    };

    const handleReadAll = async () => {
        const unreadIds = unreadLogs.map(log => log.id);
        if (unreadIds.length === 0) return;
        try {
            await fetch('/api/documents/logs/read-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ logIds: unreadIds }),
            });
            setLogs(prev => prev.map(log => ({
                ...log,
                staff_read: { ...(log.staff_read || {}), [currentUserId]: true }
            })));
        } catch (error) {
            console.error('전체 읽음 처리 실패:', error);
        }
    };

    return (
        <div className={styles.logWrap}>
            <h2>
                보완요청 알림 {unreadCount > 0 && <span className={styles.countBadge}>{unreadCount}</span>}
                {logs.length > 0 && <button className={styles.readAllButton} onClick={handleReadAll}>전체 읽음</button>}
                {logs.length > 0 && <button className={styles.deleteAllButton} onClick={handleDeleteAll}>전체 삭제</button>}
            </h2>
            <RevisionRejectedItemList
                logs={logs}
                hasScroll={hasScroll}
                currentUserId={currentUserId}
                onLogRead={handleLogRead}
                onLogDeleted={() => setRefreshKey(k => k + 1)}
            />
        </div>
    );
}
