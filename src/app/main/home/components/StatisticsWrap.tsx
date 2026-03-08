'use client';

import styles from './statisticsWrap.module.css';

interface Props {
    data: any;
}

export default function StatisticsWrap({ data }: Props) {
    const stats = data?.stats;
    const userLevel = data?.userLevel || 0;
    const isInspector = userLevel === 6;
    const loading = !data;

    const inProgressCount = stats?.inProgressCount || 0;
    const inProgressDifference = stats?.inProgressDifference || 0;
    const approvalAmount = stats?.approvalAmount || 0;
    const monthlyRevenue = stats?.monthlyRevenue || 0;
    const newRegistrations = stats?.newRegistrations || 0;
    const approvedCount = stats?.approvedCount || 0;

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
                    <p>{inProgressDifference > 0 ? `+${inProgressDifference}` : inProgressDifference} from yesterday</p>
                </li>
                <li>
                    <h2>이번달 승인금액</h2>
                    <span>{approvalAmount}</span>
                    <p>억</p>
                </li>
                {!isInspector && (
                    <li>
                        <h2>이번달 매출</h2>
                        <span>{monthlyRevenue}</span>
                        <p>예상 수수료</p>
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
