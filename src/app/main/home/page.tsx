'use client';

import { useEffect, useState } from 'react';
import styles from './home.module.css';
import StatisticsWrap from './components/StatisticsWrap';
import LogWrap from './components/LogWrap';
import RevisionRejectedWrap from './components/RevisionRejectedWrap';
import SalesWrap from './components/SalesWrap';
import ProgressWrap from './components/ProgressWrap';

export default function Home() {
    const [homeData, setHomeData] = useState<any>(null);

    useEffect(() => {
        fetch('/api/home', { credentials: 'include' })
            .then(res => res.ok ? res.json() : null)
            .then(data => setHomeData(data))
            .catch(() => {});
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
                <StatisticsWrap data={homeData} />
                <div className={styles.logRow}>
                    <RevisionRejectedWrap
                        initialLogs={homeData?.revisionLogs || []}
                        initialCurrentUserId={homeData?.currentUserId || ''}
                        logsLoaded={!!homeData}
                    />
                    <LogWrap
                        initialLogs={homeData?.memoLogs || []}
                        initialCurrentUserId={homeData?.currentUserId || ''}
                        logsLoaded={!!homeData}
                    />
                </div>
                <div className={styles.statusWrap}>
                    <SalesWrap data={homeData} />
                    <ProgressWrap data={homeData} />
                </div>
            </div>
        </div>
    );
}
