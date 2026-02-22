'use client';

import { useEffect, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, Plugin } from 'chart.js';
import styles from './progressWrap.module.css';

// 막대 위에 값 표시하는 플러그인
const dataLabelsPlugin: Plugin = {
    id: 'dataLabels',
    afterDatasetsDraw(chart: any) {
        const { ctx } = chart;
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        chart.data.datasets.forEach((dataset: any, datasetIndex: number) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            meta.data.forEach((bar: any, index: number) => {
                const value = dataset.data[index];
                const x = bar.x;
                const y = bar.y;
                ctx.fillText(value, x, y - 5);
            });
        });
    }
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, dataLabelsPlugin);

export default function ProgressWrap() {
    const [chartData, setChartData] = useState<any>(null);
    const [userLevel, setUserLevel] = useState<number>(0);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [isRepresentative, setIsRepresentative] = useState(false);
    const [companyName, setCompanyName] = useState<string>('');
    const [loading, setLoading] = useState(true);

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
                    // 영업자는 항상 자신의 문서만
                    params.append('userId', currentUserId);
                }

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
    }, [userLevel, currentUserId, isRepresentative, companyName]);

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
                        size: 14,
                        weight: 'bold'
                    }
                }
            },
            y: {
                ticks: {
                    font: {
                        size: 15,
                        weight: 'bold'
                    },
                    color: '#333',
                    padding: 10,
                    callback: function(value: any) {
                        if (Array.isArray(value)) {
                            return value;
                        }
                        return value;
                    }
                },
                grid: {
                    display: false
                }
            }
        }
    };

    return (
        <div className={styles.progressWrap}>
            <h2>진행단계 & 상태</h2>
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
