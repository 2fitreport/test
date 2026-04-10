'use client';

import { useEffect, useMemo, useState } from 'react';
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
        ctx.save();
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
        ctx.restore();
    }
};

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface Props {
    selectedYear: string;
    onYearChange: (year: string) => void;
    onPrevYear: () => void;
    onNextYear: () => void;
    revenueData?: any;
    userLevel?: number;
}

export default function RevenueChart({
    selectedYear,
    onYearChange,
    onPrevYear,
    onNextYear,
    revenueData,
    userLevel = 0
}: Props) {
    const [chartData, setChartData] = useState<any>(null);
    const [hasData, setHasData] = useState<boolean>(false);
    const [prevYearData, setPrevYearData] = useState<number[]>(Array(12).fill(0));
    const [prevYear, setPrevYear] = useState<number>(new Date().getFullYear() - 1);
    const [currentYearData, setCurrentYearData] = useState<number[]>(Array(12).fill(0));
    const [yearlyApprovalAmount, setYearlyApprovalAmount] = useState<number>(0);
    const [yearlyRealSales, setYearlyRealSales] = useState<number>(0);
    const [yearlyFee, setYearlyFee] = useState<number>(0);

    const formatSettlementAmount = (manwon: number): string => {
        if (manwon === 0) return '0원';

        // 십만원 단위 절삭
        const baekmanValue = Math.floor(manwon / 100);

        if (baekmanValue === 0) {
            return `${Math.floor(manwon)}만원`;
        }

        const eok = Math.floor(baekmanValue / 100);
        const remaining = baekmanValue % 100;
        const cheonman = Math.floor(remaining / 10);
        const baekman = remaining % 10;

        if (eok > 0) {
            if (cheonman > 0) {
                if (baekman > 0) return `${eok}억 ${cheonman}천 ${baekman}백만원`;
                return `${eok}억 ${cheonman}천만원`;
            } else {
                if (baekman > 0) return `${eok}억 ${baekman}백만원`;
                return `${eok}억원`;
            }
        } else {
            if (cheonman > 0) {
                if (baekman > 0) return `${cheonman}천 ${baekman}백만원`;
                return `${cheonman}천만원`;
            } else {
                if (baekman > 0) return `${baekman}백만원`;
                return '0원';
            }
        }
    };

    useEffect(() => {
        const labels = revenueData?.labels || ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const yearData = revenueData?.currentYearData || revenueData?.data || Array(12).fill(0);
        const previousYearData = revenueData?.previousYearData || Array(12).fill(0);
        const currentMonth = revenueData?.currentMonth || new Date().getMonth() + 1;
        const currentYearFromApi = revenueData?.currentYear || new Date().getFullYear();
        const selectedYearVal = revenueData?.selectedYear || new Date().getFullYear();

        // 상태로 저장
        setCurrentYearData(yearData);
        setPrevYearData(previousYearData);
        setPrevYear(selectedYearVal - 1);
        setYearlyApprovalAmount(revenueData?.yearlyApprovalAmount || 0);
        setYearlyRealSales(revenueData?.yearlyRealSales || 0);
        setYearlyFee(revenueData?.yearlyFee || 0);

        // 데이터 존재 여부 확인
        const hasData = yearData.some((value: number) => value > 0);

        // 현재월만 메인 컬러, 나머지는 회색
        const barColors = yearData.map((_: number, index: number) => {
            // index는 0부터 시작, currentMonth는 1부터 시작
            return (index + 1 === currentMonth && currentYearFromApi === selectedYearVal)
                ? '#0f1a4d'
                : '#cccccc';
        });

        const datasets: any[] = [
            {
                label: `${selectedYearVal}년`,
                data: yearData,
                backgroundColor: hasData ? barColors : '#e0e0e0',
                borderRadius: 8,
            }
        ];

        // 이전년도 데이터가 실제로 있을 때만 추가 (0이 아닌 값이 있는 경우)
        const hasPrevData = previousYearData.some((v: number) => v > 0);
        if (hasPrevData && selectedYearVal !== currentYearFromApi) {
            datasets.push({
                label: `${selectedYearVal - 1}년`,
                data: previousYearData,
                backgroundColor: '#e0e0e0',
                borderRadius: 8,
            });
        }

        setHasData(hasData);
        setChartData({ labels, datasets });
    }, [revenueData]);

    const chartOptions = useMemo(() => {
        // y축 최대값 자동 계산
        const allData = [...(chartData?.datasets[0]?.data || []), ...(chartData?.datasets[1]?.data || [])];
        const maxDataValue = Math.max(...(allData as number[]).filter(v => typeof v === 'number'), 5);
        const yAxisMax = Math.ceil(maxDataValue * 1.2); // 최대값의 120%로 설정

        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index' as const,
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold' },
                    bodyFont: { size: 12 },
                    callbacks: {
                        label: function(context: any) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            return `${label}: ${value}억원`;
                        },
                        afterLabel: function(context: any) {
                            const dataIndex = context.dataIndex;
                            const currentVal = context.parsed.y;
                            const prevVal = prevYearData[dataIndex] || 0;
                            const difference = Math.round((currentVal - prevVal) * 10000) / 10000;
                            const percentChange = prevVal !== 0
                                ? Math.round((difference / prevVal) * 1000) / 10
                                : 0;

                            const arrow = difference > 0 ? '↑' : difference < 0 ? '↓' : '→';
                            const sign = difference > 0 ? '+' : '';

                            const lines: string[] = [];
                            if (prevVal > 0) {
                                lines.push(`${prevYear}년: ${prevVal}억원`);
                                lines.push(`차이: ${sign}${difference}억원 (${sign}${percentChange.toFixed(1)}%${arrow})`);
                            } else {
                                lines.push(`${prevYear}년: 데이터 없음`);
                            }
                            return lines;
                        }
                    }
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
                    max: yAxisMax,
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
    }, [prevYearData, prevYear, chartData]);

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
                        type="text"
                        inputMode="numeric"
                        value={selectedYear}
                        onChange={(e) => onYearChange(String(e.target.value))}
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
                {chartData && !hasData ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '300px',
                        color: '#999',
                        fontSize: '16px'
                    }}>
                        {selectedYear}년 데이터가 없습니다.
                    </div>
                ) : chartData ? (
                    <Bar
                        data={chartData}
                        options={chartOptions as any}
                        plugins={[dataLabelsPlugin]}
                    />
                ) : null}
            </div>
            <div className={pageStyles.summarySection} style={{ padding: '16px' }}>
                <div className={pageStyles.summaryTitle} style={{ textAlign: 'right' }}>합계</div>
                <div className={pageStyles.summaryValues}>
                    <div className={pageStyles.summaryItem}>
                        <span>승인금액</span>
                        <span className={pageStyles.summaryValueBlue}>{formatSettlementAmount(yearlyApprovalAmount)}</span>
                    </div>
                    {userLevel !== 4 && (
                        <div className={pageStyles.summaryItem}>
                            <span>실제매출</span>
                            <span className={pageStyles.summaryValueBlue}>{(yearlyRealSales * 10000).toLocaleString('ko-KR') + '원'}</span>
                        </div>
                    )}
                    <div className={pageStyles.summaryItem}>
                        <span>지급수수료</span>
                        <span className={pageStyles.summaryValueGreen}>{(yearlyFee * 10000).toLocaleString('ko-KR') + '원'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
