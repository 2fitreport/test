'use client';

import styles from './statisticsWrap.module.css';

interface Props {
    data: any;
}

export default function StatisticsWrap({ data }: Props) {
    const stats = data?.stats;
    const userLevel = data?.userLevel || 0;
    const isRepresentative = data?.isRepresentative || false;
    const isInspector = userLevel === 6;
    const isOperatorWithoutRepresentative = userLevel === 3;
    const loading = !data;

    const inProgressCount = stats?.inProgressCount || 0;
    const inProgressDifference = stats?.inProgressDifference || 0;
    const approvalAmount = stats?.approvalAmount || 0;
    const monthlyRevenue = stats?.monthlyRevenue || 0;
    const newRegistrations = stats?.newRegistrations || 0;
    const approvedCount = stats?.approvedCount || 0;

    const formatNumber = (num: number | null | undefined): { main: string; sub: string } => {
        // num은 이미 억원 단위
        if (num === null || num === undefined || isNaN(num)) {
            return { main: '0', sub: '원' };
        }

        const eok = Math.floor(num);
        const decimal = (num - eok) * 10; // 소수점 첫자리 (0.0 ~ 9.9)
        const cheonman = Math.floor(decimal);
        const baekman = Math.floor((decimal - cheonman) * 10);

        if (eok > 0) {
            if (cheonman > 0) {
                if (baekman > 0) {
                    return { main: `${eok}억 ${cheonman}천 ${baekman}백`, sub: '만원' };
                } else {
                    return { main: `${eok}억 ${cheonman}천`, sub: '만원' };
                }
            } else {
                if (baekman > 0) {
                    return { main: `${eok}억 ${baekman}백`, sub: '만원' };
                } else {
                    return { main: `${eok}억`, sub: '원' };
                }
            }
        } else {
            if (cheonman > 0) {
                if (baekman > 0) {
                    return { main: `${cheonman}천 ${baekman}백`, sub: '만원' };
                } else {
                    return { main: `${cheonman}천`, sub: '만원' };
                }
            } else {
                if (baekman > 0) {
                    return { main: `${baekman}백`, sub: '만원' };
                } else {
                    return { main: '0', sub: '원' };
                }
            }
        }
    };

    if (loading) {
        return (
            <div className={styles.statisticsWrap}>
                <ul className={styles.statistics}>
                    {[1, 2, 3, 4, 5].map(i => (
                        <li key={i}>
                            <h2><span className={styles.skeleton} style={{ width: 80, height: 16 }}>&nbsp;</span></h2>
                            <span className={styles.skeleton} style={{ width: 60, height: 35 }}>&nbsp;</span>
                            <p><span className={styles.skeleton} style={{ width: 50, height: 14 }}>&nbsp;</span></p>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    return (
        <div className={styles.statisticsWrap}>
            <ul className={styles.statistics}>
                <li>
                    <h2>진행중 케이스</h2>
                    <span>{inProgressCount}</span>
                    <p>건</p>
                </li>
                <li>
                    <h2>이번달 승인금액</h2>
                    <span>{formatNumber(approvalAmount).main}</span>
                    <p>{formatNumber(approvalAmount).sub}</p>
                </li>
                {!isInspector && !isOperatorWithoutRepresentative && (
                    <li>
                        <h2>이번달 매출</h2>
                        <span>{formatNumber(monthlyRevenue).main}</span>
                        <p>{formatNumber(monthlyRevenue).sub}</p>
                    </li>
                )}
                <li>
                    <h2>이번달 신규</h2>
                    <span>{newRegistrations}</span>
                    <p>건</p>
                </li>
                <li>
                    <h2>이번달 승인 건수</h2>
                    <span>{approvedCount}</span>
                    <p>건</p>
                </li>
            </ul>
        </div>
    );
}
