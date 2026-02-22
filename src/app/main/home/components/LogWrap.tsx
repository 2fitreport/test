'use client';

import { useState, useEffect } from 'react';
import styles from './logWrap.module.css';
import LogItemList from './LogItemList';

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
}

export default function LogWrap() {
    const [logs, setLogs] = useState<DocumentLog[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetch('/api/documents/logs', { credentials: 'include' })
            .then(res => res.ok ? res.json() : [])
            .then(data => setLogs(data))
            .catch(() => setLogs([]));
    }, [refreshKey]);

    const hasScroll = logs.length > 4;

    return (
        <div className={styles.logWrap}>
            <h2>알림사항</h2>
            <LogItemList logs={logs} hasScroll={hasScroll} onLogDeleted={() => setRefreshKey(k => k + 1)} />
        </div>
    );
}
