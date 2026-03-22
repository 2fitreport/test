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

interface Props {
    data: any;
}

export default function ProgressWrap({ data }: Props) {
    const monthInputRef = useRef<HTMLInputElement>(null);
    const [stageData, setStageData] = useState<any>(null);
    const [statusData, setStatusData] = useState<any>(null);
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isCustomMonth, setIsCustomMonth] = useState(false);

    const userLevel = data?.userLevel || 0;

    // 초기 데이터 설정
    useEffect(() => {
        if (data?.progressData && !isCustomMonth) {
            setStageData(data.progressData.stage);
            setStatusData(data.progressData.status);
        }
    }, [data, isCustomMonth]);

    // 월 변경 시 별도 API 호출
    useEffect(() => {
        if (!isCustomMonth) return;

        const fetchProgressData = async () => {
            try {
                const res = await fetch(`/api/home?month=${selectedMonth}&chart_only=true`, { credentials: 'include' });
                if (res.ok) {
                    const result = await res.json();
                    setStageData(result.progressData.stage);
                    setStatusData(result.progressData.status);
                }
            } catch (error) {
                console.error('진행단계 데이터 조회 실패:', error);
            }
        };

        fetchProgressData();
    }, [selectedMonth, isCustomMonth]);

    const shouldDisplay = userLevel === 1 || userLevel === 2;
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
        setIsCustomMonth(true);
    };

    const handleNextMonth = () => {
        const [year, month] = selectedMonth.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() + 1);
        setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
        setIsCustomMonth(true);
    };

    return (
        <div className={styles.progressWrap}>
            <div className={styles.progressHeader}>
                <h2>진행상황</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button onClick={handlePrevMonth} className={styles.monthButton} title="이전 달">
                        <Image src="/arrow_left.svg" alt="이전 달" width={20} height={20} />
                    </button>
                    <input
                        ref={monthInputRef}
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => {
                            setSelectedMonth(e.target.value);
                            setIsCustomMonth(true);
                        }}
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
