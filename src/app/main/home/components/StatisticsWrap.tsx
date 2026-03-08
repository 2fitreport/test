'use client';

import { useEffect, useState } from 'react';
import styles from './statisticsWrap.module.css';

export default function StatisticsWrap() {
    const [userLevel, setUserLevel] = useState<number>(0);
    const [inProgressCount, setInProgressCount] = useState<number>(0);
    const [inProgressDifference, setInProgressDifference] = useState<number>(0);
    const [approvalAmount, setApprovalAmount] = useState<number>(0);

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

    // 진행중 케이스 개수, 승인금액 조회
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [inProgressRes, approvalRes] = await Promise.all([
                    fetch('/api/progress/in-progress-count', { credentials: 'include' }),
                    fetch('/api/progress/approval-amount', { credentials: 'include' })
                ]);

                if (inProgressRes.ok) {
                    const data = await inProgressRes.json();
                    setInProgressCount(data.inProgressCount);
                    setInProgressDifference(data.difference);
                }

                if (approvalRes.ok) {
                    const data = await approvalRes.json();
                    setApprovalAmount(data.approvalAmount);
                }
            } catch (error) {
                console.error('데이터 조회 실패:', error);
            }
        };

        if (userLevel > 0) {
            fetchData();
        }
    }, [userLevel]);

    // 실무자(검수자, level 6)는 이번달 매출 섹션 제외
    const isInspector = userLevel === 6;

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
                        <span>3.2억</span>
                        <p>예상 수수료</p>
                    </li>
                )}
                <li>
                    <h2>이번달 신규</h2>
                    <span>12</span>
                    <p>4 from avg</p>
                </li>
                <li>
                    <h2>이번달 승인 건수</h2>
                    <span>8</span>
                    <p>건</p>
                </li>
            </ul>
        </div>
    );
}
