'use client';

import { useEffect, useState } from 'react';
import styles from './home.module.css';
import StatisticsWrap from './components/StatisticsWrap';
import LogWrap from './components/LogWrap';
import RevisionRejectedWrap from './components/RevisionRejectedWrap';
import SalesWrap from './components/SalesWrap';
import ProgressWrap from './components/ProgressWrap';

interface DocumentLog {
    id: number;
    document_id: number;
    document_title: string;
    company_name: string;
    action_type: string;
    actor_id: string;
    actor_name: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
    staff_read?: Record<string, boolean>;
}

export default function Home() {
    const [revisionLogs, setRevisionLogs] = useState<DocumentLog[]>([]);
    const [memoLogs, setMemoLogs] = useState<DocumentLog[]>([]);
    const [currentUserId, setCurrentUserId] = useState('');
    const [logsLoaded, setLogsLoaded] = useState(false);

    useEffect(() => {
        fetch('/api/documents/logs?home_all=true', { credentials: 'include' })
            .then(res => res.ok ? res.json() : { revisionLogs: [], memoLogs: [], currentUserId: '' })
            .then(data => {
                setRevisionLogs(data.revisionLogs || []);
                setMemoLogs(data.memoLogs || []);
                setCurrentUserId(data.currentUserId || '');
                setLogsLoaded(true);
            })
            .catch(() => setLogsLoaded(true));
    }, []);

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div className={styles.mainTitleWrap}>
                    <h1 className={styles.mainTitle}>메인 홈</h1>
                    <p className={styles.subTitle}>오늘의 회사 현황을 한눈에 확인하세요.</p>
                </div>
                <div className={styles.btnWrap}>
                    <a href="">상담신청</a>
                    <a href="/main/company_create?create=true">기업 생성</a>
                </div>
            </div>
            <div className={styles.homeWrap}>
                <StatisticsWrap />
                <div className={styles.logRow}>
                    <RevisionRejectedWrap initialLogs={revisionLogs} initialCurrentUserId={currentUserId} logsLoaded={logsLoaded} />
                    <LogWrap initialLogs={memoLogs} initialCurrentUserId={currentUserId} logsLoaded={logsLoaded} />
                </div>
            <div className={styles.statusWrap}>
                <SalesWrap />
                <ProgressWrap />
            </div>
            </div>
        </div>
    );
}
