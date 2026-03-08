'use client';

import { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, Plugin } from 'chart.js';
import styles from './progressWrap.module.css';

const dataLabelsPlugin: Plugin = {
    id: 'dataLabels',
    afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        ctx.font = 'bold 13px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar: any, index: number) => {
                const value = dataset.data[index];
                if (value !== 0 && value !== undefined) {
                    ctx.fillText(String(value), bar.x, bar.y - 6);
                }
            });
        });
    }
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ProgressWrap() {
    const monthInputRef = useRef<HTMLInputElement>(null);
    const [stageData, setStageData] = useState<any>(null);
    const [statusData, setStatusData] = useState<any>(null);
    const [userLevel, setUserLevel] = useState<number>(0);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [isRepresentative, setIsRepresentative] = useState(false);
    const [companyName, setCompanyName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [viewMode, setViewMode] = useState<'all' | 'my'>('all');

    useEffect(() => {
        const adminData = sessionStorage.getItem('admin_data');
        if (adminData) {
            try {
                const data = JSON.parse(adminData);
                setUserLevel(data.position?.level || 0);
                setCurrentUserId(data.user_id || '');
                setIsRepresentative(data.is_affiliation_representative || false);
                setCompanyName(data.company_name || '');
            } catch (error) {
                console.error('admin_data 파싱 실패:', error);
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (userLevel === 0) return;

        const fetchProgressData = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();

                if (userLevel === 4) {
                    if (isRepresentative && companyName && viewMode === 'all') {
                        params.append('companyName', companyName);
                    } else {
                        params.append('userId', currentUserId);
                    }
                }

                params.append('month', selectedMonth);

                const response = await fetch(`/api/progress/stats?${params}`, {
                    credentials: 'include'
                });

                if (!response.ok) throw new Error('진행단계 데이터 조회 실패');

                const data = await response.json();
                setStageData(data.stage);
                setStatusData(data.status);
            } catch (error) {
                console.error('진행단계 데이터 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProgressData();
    }, [userLevel, currentUserId, isRepresentative, companyName, selectedMonth, viewMode]);

    const shouldDisplay = userLevel === 1 || userLevel === 2 || userLevel === 4;

    if (!shouldDisplay) return null;

    const makeOptions = (maxVal: number) => ({
        indexAxis: 'x' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 }
            }
        },
        elements: { bar: { borderWidth: 0 } },
        scales: {
            x: {
                grid: { display: true, color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    font: { size: 14, weight: 'bold' as const },
                }
            },
            y: {
                beginAtZero: true,
                max: Math.max(maxVal + 5, 10),
                ticks: { display: false },
                grid: { display: false }
            }
        },
        barPercentage: 0.5,
        categoryPercentage: 0.6
    });

    const stageMax = stageData ? Math.max(...stageData.datasets[0].data) : 0;
    const statusMax = statusData ? Math.max(...statusData.datasets[0].data) : 0;

    const handlePrevMonth = () => {
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() - 1);
        setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonth = () => {
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() + 1);
        setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const isAffiliationRepresentative = isRepresentative && userLevel === 4;

    return (
        <div className={styles.progressWrap}>
            <div className={styles.progressHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <h2>진행상황</h2>
                    {isAffiliationRepresentative && (
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                onClick={() => setViewMode('all')}
                                style={{
                                    padding: '8px 16px',
                                    border: viewMode === 'all' ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '4px',
                                    backgroundColor: viewMode === 'all' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: viewMode === 'all' ? '600' : '500'
                                }}
                            >
                                소속 영업자
                            </button>
                            <button
                                onClick={() => setViewMode('my')}
                                style={{
                                    padding: '8px 16px',
                                    border: viewMode === 'my' ? '2px solid #fff' : '1px solid rgba(255, 255, 255, 0.3)',
                                    borderRadius: '4px',
                                    backgroundColor: viewMode === 'my' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontWeight: viewMode === 'my' ? '600' : '500'
                                }}
                            >
                                내 현황
                            </button>
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={handlePrevMonth} className={styles.monthButton} title="이전 달">
                        <Image src="/arrow_left.svg" alt="이전 달" width={20} height={20} />
                    </button>
                    <input
                        ref={monthInputRef}
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        onClick={(e) => { (e.target as HTMLInputElement).showPicker?.(); }}
                        className={styles.monthInput}
                    />
                    <button onClick={handleNextMonth} className={styles.monthButton} title="다음 달">
                        <Image src="/arrow_right.svg" alt="다음 달" width={20} height={20} />
                    </button>
                </div>
            </div>
            <div className={styles.chartsRow}>
                <div className={styles.chartBox}>
                    <h3 className={styles.chartTitle}>진행단계별</h3>
                    <div className={styles.chartArea}>
                        {stageData && <Bar data={stageData} options={makeOptions(stageMax) as any} plugins={[dataLabelsPlugin]} />}
                    </div>
                </div>
                <div className={styles.chartBox}>
                    <h3 className={styles.chartTitle}>상태별</h3>
                    <div className={styles.chartArea}>
                        {statusData && <Bar data={statusData} options={makeOptions(statusMax) as any} plugins={[dataLabelsPlugin]} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
