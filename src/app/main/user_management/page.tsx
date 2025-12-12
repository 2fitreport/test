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
import styles from './page.module.css';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface UserStats {
    total: number;
    byStatus: { active: number; inactive: number };
    byPosition: { [key: string]: number };
}

export default function UserManagementPage() {
    const [stats, setStats] = useState<UserStats>({
        total: 0,
        byStatus: { active: 0, inactive: 0 },
        byPosition: {},
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUserStats();
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

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true, // Re-enable legend as it's the only data source
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
        return (
            <div className={styles.container}>
                <h1 className={styles.title}>사용자 관리</h1>
                <div className={styles.loading}>로딩 중...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>사용자 관리</h1>

            <div className={styles.chartsGrid}>
                <div className={styles.chartContainer}>
                    <h2 className={styles.chartTitle}>직급별 인원</h2>
                    <div className={styles.chartWrapper}>
                        <Line
                            data={positionChartData}
                            options={chartOptions}
                        />
                    </div>
                </div>
                <div className={styles.chartContainer}>
                    <h2 className={styles.chartTitle}>계정 상태</h2>
                    <div className={styles.chartWrapper}>
                        <Line data={statusChartData} options={chartOptions} />
                    </div>
                </div>
            </div>
        </div>
    );
}

