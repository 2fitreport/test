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
}

export default function RevisionRejectedWrap() {
    const [logs, setLogs] = useState<DocumentLog[]>([]);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetch('/api/documents/logs?revision_rejected=true', { credentials: 'include' })
            .then(res => res.ok ? res.json() : [])
            .then(data => setLogs(data))
            .catch(() => setLogs([]));
    }, [refreshKey]);

    const hasScroll = logs.length > 4;

    return (
        <div className={styles.logWrap}>
            <h2>보완요청 알림 <span className={styles.countBadge}>{logs.length}</span></h2>
            <RevisionRejectedItemList logs={logs} hasScroll={hasScroll} onLogDeleted={() => setRefreshKey(k => k + 1)} />
        </div>
    );
}
