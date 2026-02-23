'use client';

import { useEffect, useState, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, Plugin } from 'chart.js';
import styles from './progressWrap.module.css';

// 진행단계별 색상
const PROGRESS_STAGE_COLORS: Record<string, string> = {
    '상담': 'var(--color-consultation)',
    '서류요청': 'var(--color-document-request)',
    '분석': 'var(--color-analysis)',
    '진행': 'var(--color-progress)',
    '승인': 'var(--color-approval)',
};

const STATUS_COLORS: Record<string, string> = {
    '보완': 'var(--color-revision)',
    '보류': 'var(--color-hold)',
};

// 막대 위에 값 표시하는 플러그인
const dataLabelsPlugin: Plugin = {
    id: 'dataLabels',
    afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar: any, index: number) => {
                const value = dataset.data[index];
                if (value !== 0 && value !== undefined) {
                    const x = bar.x;
                    const y = bar.y;
                    ctx.fillText(String(value), x, y - 8);
                }
            });
        });
    }
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ProgressWrap() {
    const monthInputRef = useRef<HTMLInputElement>(null);
    const [chartData, setChartData] = useState<any>(null);
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
                        // 소속대표: 같은 소속의 모든 영업자
                        params.append('companyName', companyName);
                    } else {
                        // 일반 영업자 또는 소속대표의 내 데이터만
                        params.append('userId', currentUserId);
                    }
                }

                params.append('month', selectedMonth);

                const response = await fetch(`/api/progress/stats?${params}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('진행단계 데이터 조회 실패');
                }

                const data = await response.json();
                setChartData(data);
            } catch (error) {
                console.error('진행단계 데이터 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchProgressData();
    }, [userLevel, currentUserId, isRepresentative, companyName, selectedMonth, viewMode]);

    // 대표(1), 대표실무자(2): 모든 데이터
    // 영업자(4): 자신의 데이터만
    // 나머지: 표시 안 함
    const shouldDisplay = userLevel === 1 || userLevel === 2 || userLevel === 4;

    if (!shouldDisplay) {
        return null;
    }

    const options = {
        indexAxis: 'x' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                titleFont: { size: 13, weight: 'bold' },
                bodyFont: { size: 12 }
            }
        },
        scales: {
            x: {
                beginAtZero: true,
                max: 30,
                grid: {
                    display: true,
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    callback: function(value: any, index: number) {
                        const label = (this as any).getLabelForValue(value);
                        const dataValue = chartData?.datasets?.[0]?.data?.[index] || 0;
                        return [label, `(${dataValue})`];
                    }
                }
            },
            y: {
                ticks: {
                    display: false
                },
                grid: {
                    display: false
                }
            }
        },
        barPercentage: 0.5,
        categoryPercentage: 0.6
    };

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
                    <button
                        onClick={handlePrevMonth}
                        style={{
                            padding: '8px 12px',
                            fontSize: '16px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        title="이전 달"
                    >
                        ◀
                    </button>
                    <input
                        ref={monthInputRef}
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        onClick={(e) => {
                            const input = e.target as HTMLInputElement;
                            input.showPicker?.();
                        }}
                        style={{
                            padding: '8px 12px',
                            fontSize: '14px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: '#fff',
                            color: '#333',
                            width: '150px',
                            cursor: 'pointer',
                            textAlign: 'center'
                        }}
                    />
                    <button
                        onClick={handleNextMonth}
                        style={{
                            padding: '8px 12px',
                            fontSize: '16px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                            color: '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        title="다음 달"
                    >
                        ▶
                    </button>
                </div>
            </div>
            <div className={styles.chartContainer}>
                {chartData && (
                    <Bar
                        data={chartData}
                        options={options as any}
                    />
                )}
            </div>
        </div>
    );
}
