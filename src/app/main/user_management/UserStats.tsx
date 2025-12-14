'use client';

import { useEffect, useState } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import styles from './userStats.module.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface UserStatsData {
    total: number;
    byStatus: { active: number; inactive: number };
    byPosition: { [key: string]: number };
    byCompany: { [key: string]: number };
}

export default function UserStats() {
    const [stats, setStats] = useState<UserStatsData>({
        total: 0,
        byStatus: { active: 0, inactive: 0 },
        byPosition: {},
        byCompany: {},
    });
    const [loading, setLoading] = useState(true);
    const [chartKey, setChartKey] = useState(0);

    useEffect(() => {
        fetchUserStats();
    }, []);

    useEffect(() => {
        const handleResize = () => {
            setChartKey(prev => prev + 1);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchUserStats = async () => {
        try {
            const response = await fetch('/api/users/stats');

            if (!response.ok) {
                throw new Error('통계 조회 실패');
            }

            const data = await response.json();
            setStats(data);
        } catch (error) {
            console.error('사용자 통계 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const positionChartData = {
        labels: Object.keys(stats.byPosition),
        datasets: [
            {
                label: '인원',
                data: Object.values(stats.byPosition),
                fill: true,
                backgroundColor: 'rgba(15, 26, 77, 0.2)',
                borderColor: 'rgba(15, 26, 77, 1)',
                tension: 0.3,
            },
        ],
    };

    const statusChartData = {
        labels: ['활성', '비활성'],
        datasets: [
            {
                label: '인원',
                data: [stats.byStatus.active, stats.byStatus.inactive],
                fill: true,
                backgroundColor: 'rgba(75, 192, 75, 0.2)',
                borderColor: 'rgba(75, 192, 75, 1)',
                tension: 0.3,
            },
        ],
    };

    const companyChartData = {
        labels: Object.keys(stats.byCompany),
        datasets: [
            {
                label: '인원',
                data: Object.values(stats.byCompany),
                fill: true,
                backgroundColor: 'rgba(153, 102, 255, 0.2)',
                borderColor: 'rgba(153, 102, 255, 1)',
                tension: 0.3,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                },
            },
        },
    };

    if (loading) {
        return <div className={styles.loading}>로딩 중...</div>;
    }

    return (
        <div className={styles.chartsGrid}>
            <div className={styles.chartContainer}>
                <h2 className={styles.chartTitle}>직급별 인원</h2>
                <div className={styles.statsList}>
                    {Object.entries(stats.byPosition).map(([position, count]) => (
                        <div key={position} className={styles.statItem}>
                            <span className={styles.statLabel}>{position}:</span>
                            <span className={styles.statValue}>{count}명</span>
                        </div>
                    ))}
                </div>
                <div className={styles.chartWrapper}>
                    <Line
                        key={`position-${chartKey}`}
                        data={positionChartData}
                        options={chartOptions}
                    />
                </div>
            </div>
            <div className={styles.chartContainer}>
                <h2 className={styles.chartTitle}>계정 상태</h2>
                <div className={styles.statsList}>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>활성:</span>
                        <span className={styles.statValue}>{stats.byStatus.active}명</span>
                    </div>
                    <div className={styles.statItem}>
                        <span className={styles.statLabel}>비활성:</span>
                        <span className={styles.statValue}>{stats.byStatus.inactive}명</span>
                    </div>
                </div>
                <div className={styles.chartWrapper}>
                    <Line key={`status-${chartKey}`} data={statusChartData} options={chartOptions} />
                </div>
            </div>
            <div className={styles.chartContainer}>
                <h2 className={styles.chartTitle}>기업별 현황</h2>
                <div className={styles.statsList}>
                    {Object.entries(stats.byCompany).map(([company, count]) => (
                        <div key={company} className={styles.statItem}>
                            <span className={styles.statLabel}>{company}:</span>
                            <span className={styles.statValue}>{count}명</span>
                        </div>
                    ))}
                </div>
                <div className={styles.chartWrapper}>
                    <Line
                        key={`company-${chartKey}`}
                        data={companyChartData}
                        options={chartOptions}
                    />
                </div>
            </div>
        </div>
    );
}
