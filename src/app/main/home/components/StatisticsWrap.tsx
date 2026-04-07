'use client';

import styles from './statisticsWrap.module.css';

interface Props {
    data: any;
}

export default function StatisticsWrap({ data }: Props) {
    const stats = data?.stats;
    const userLevel = data?.userLevel || 0;
    const loading = !data;

    const getRateColor = (rate: string | null | undefined) => {
        if (!rate || rate === '-') return undefined;
        if (rate.startsWith('+')) return '#2f9e44';
        if (rate.startsWith('-')) return '#e03131';
        return undefined;
    };

    const formatFeeInMillions = (manwon: number): string => {
        if (manwon === 0) return '0백만원';
        const millions = manwon / 100;
        const rounded = Math.round(millions * 100) / 100;
        return `${rounded}백만원`;
    };

    const formatAmount = (num: number): string => {
        if (!num) return '0원';
        const eok = Math.floor(num);
        const decimal = (num - eok) * 10;
        const cheonman = Math.floor(decimal);
        const baekman = Math.floor((decimal - cheonman) * 10);
        if (eok > 0) {
            if (cheonman > 0) {
                if (baekman > 0) return `${eok}억 ${cheonman}천 ${baekman}백만원`;
                return `${eok}억 ${cheonman}천만원`;
            } else {
                if (baekman > 0) return `${eok}억 ${baekman}백만원`;
                return `${eok}억원`;
            }
        } else {
            if (cheonman > 0) {
                if (baekman > 0) return `${cheonman}천 ${baekman}백만원`;
                return `${cheonman}천만원`;
            } else {
                if (baekman > 0) return `${baekman}백만원`;
                return '0원';
            }
        }
    };

    if (loading) {
        return (
            <div className={styles.statisticsWrap}>
                <div className={styles.statsGrid}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={styles.statCard}>
                            <p className={styles.statLabel}><span className={styles.skeleton} style={{ width: 80, height: 18 }}>&nbsp;</span></p>
                            <p className={styles.statValue}><span className={styles.skeleton} style={{ width: 100, height: 30 }}>&nbsp;</span></p>
                            <p className={styles.statSubValue}><span className={styles.skeleton} style={{ width: 60, height: 16 }}>&nbsp;</span></p>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const inProgressCount = stats?.inProgressCount || 0;
    const approvalAmount = stats?.approvalAmount || 0;
    const monthlyRevenue = stats?.monthlyRevenue || 0;
    const newRegistrations = stats?.newRegistrations || 0;
    const approvedCount = stats?.approvedCount || 0;

    const revenueFormatted = formatFeeInMillions(monthlyRevenue);

    return (
        <div className={styles.statisticsWrap}>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>진행중 케이스</p>
                    <p className={styles.statValue}>{inProgressCount}건</p>
                    <p className={styles.statSubValue}>
                        전월 대비 <span style={{ color: getRateColor(stats?.inProgressChangeRate) }}>{stats?.inProgressChangeRate ?? '-'}</span>
                    </p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>이번달 승인금액</p>
                    <p className={styles.statValue}>{formatAmount(approvalAmount)}</p>
                    <p className={styles.statSubValue}>{approvedCount}건</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>이번달 매출</p>
                    <p className={styles.statValue}>{revenueFormatted}</p>
                    <p className={styles.statSubValue}>
                        전월 대비 <span style={{ color: getRateColor(stats?.revenueChangeRate) }}>{stats?.revenueChangeRate ?? '-'}</span>
                    </p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>이번달 신규</p>
                    <p className={styles.statValue}>{newRegistrations}건</p>
                    <p className={styles.statSubValue}>
                        전월 대비 <span style={{ color: getRateColor(stats?.newRegistrationsChangeRate) }}>{stats?.newRegistrationsChangeRate ?? '-'}</span>
                    </p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>이번달 승인 건수</p>
                    <p className={styles.statValue}>{approvedCount}건</p>
                    <p className={styles.statSubValue}>
                        전월 대비 <span style={{ color: getRateColor(stats?.approvedCountChangeRate) }}>{stats?.approvedCountChangeRate ?? '-'}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}
