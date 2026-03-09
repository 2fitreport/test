'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, Plugin } from 'chart.js';
import { FiBarChart2 } from 'react-icons/fi';
import pageStyles from '../performanceSettlement.module.css';
import styles from './RevenueChart.module.css';

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

interface Props {
    selectedYear: string;
    onYearChange: (year: string) => void;
    onPrevYear: () => void;
    onNextYear: () => void;
    revenueData?: any;
}

export default function RevenueChart({
    selectedYear,
    onYearChange,
    onPrevYear,
    onNextYear,
    revenueData
}: Props) {
    const [chartData, setChartData] = useState<any>(null);

    useEffect(() => {
        if (revenueData?.labels && revenueData?.data) {
            const data = {
                labels: revenueData.labels,
                datasets: [
                    {
                        label: '년별 매출',
                        data: revenueData.data,
                        backgroundColor: '#0f1a4d',
                        borderRadius: 8,
                    }
                ]
            };
            setChartData(data);
        } else {
            // Mock 데이터
            const mockData = {
                labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
                datasets: [
                    {
                        label: '년별 매출',
                        data: [2.5, 3.2, 2.8, 4.1, 3.5, 2.9, 4.3, 3.8, 2.6, 3.9, 4.2, 3.1],
                        backgroundColor: '#0f1a4d',
                        borderRadius: 8,
                    }
                ]
            };
            setChartData(mockData);
        }
    }, [selectedYear, revenueData]);

    const chartOptions = {
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
        elements: {
            bar: {
                borderWidth: 0
            }
        },
        scales: {
            x: {
                ticks: {
                    font: {
                        size: 14,
                        weight: 'bold' as const
                    }
                },
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: true,
                max: 5,
                grid: {
                    display: true,
                    color: 'rgba(0, 0, 0, 0.05)'
                },
                ticks: {
                    font: {
                        size: 14,
                        weight: 'bold' as const
                    }
                }
            }
        },
        barPercentage: 0.5,
        categoryPercentage: 0.6
    };

    return (
        <div className={pageStyles.revenueTrendCard}>
            <div className={styles.header}>
                <div className={pageStyles.trendTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiBarChart2 size={18} /> 년별 매출 추이
                </div>
                <div className={styles.controls}>
                    <button
                        onClick={onPrevYear}
                        className={styles.button}
                        title="이전 년"
                    >
                        <Image
                            src="/arrow_left.svg"
                            alt="이전 년"
                            width={20}
                            height={20}
                        />
                    </button>
                    <input
                        type="number"
                        value={selectedYear}
                        onChange={(e) => onYearChange(e.target.value)}
                        className={styles.yearInput}
                    />
                    <button
                        onClick={onNextYear}
                        className={styles.button}
                        title="다음 년"
                    >
                        <Image
                            src="/arrow_right.svg"
                            alt="다음 년"
                            width={20}
                            height={20}
                        />
                    </button>
                </div>
            </div>
            <div className={styles.chartContainer}>
                {chartData && (
                    <Bar
                        data={chartData}
                        options={chartOptions as any}
                        plugins={[dataLabelsPlugin]}
                    />
                )}
            </div>
        </div>
    );
}
