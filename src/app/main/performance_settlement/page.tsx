'use client';

import { useEffect, useState } from 'react';
import { getAdminData } from '@/lib/auth';
import styles from './performanceSettlement.module.css';
import SalesPerformanceTable from './components/SalesPerformanceTable';
import StaffPerformanceTable from './components/StaffPerformanceTable';
import RevenueChart from './components/RevenueChart';
import SettlementTable from './components/SettlementTable';
import Spinner from '@/app/components/Spinner/Spinner';

const settlementDataDefault: any[] = [];

export default function PerformanceSettlementPage() {
    const [settleData, setSettleData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [salesPerformanceData, setSalesPerformanceData] = useState<any[]>([]);
    const [staffPerformanceData, setStaffPerformanceData] = useState<any[]>([]);
    const [userLevel, setUserLevel] = useState<number>(0);
    const [isAffiliationRep, setIsAffiliationRep] = useState<boolean>(false);

    useEffect(() => {
        const adminData = getAdminData();
        setUserLevel(adminData?.position?.level || 0);
    }, []);

    const getDefaultMonth = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };

    const [selectedMonthSettlement, setSelectedMonthSettlement] = useState<string>(getDefaultMonth());
    const [selectedMonthSales, setSelectedMonthSales] = useState<string>(getDefaultMonth());
    const [selectedMonthStaff, setSelectedMonthStaff] = useState<string>(getDefaultMonth());
    const [selectedYear, setSelectedYear] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}`;
    });

    useEffect(() => {
        const fetchSettlementData = async () => {
            try {
                const queryParams = new URLSearchParams({
                    year: selectedYear,
                    month: selectedMonthSettlement
                });
                const response = await fetch(`/api/performance_settlement?${queryParams}`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setSettleData(data);
                    setIsAffiliationRep(data.isAffiliationRep || false);
                }
            } catch (error) {
                console.error('성과정산 데이터 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSettlementData();
    }, [selectedYear, selectedMonthSettlement]);

    useEffect(() => {
        const fetchSalesPerformance = async () => {
            try {
                const response = await fetch(`/api/sales/stats?month=${selectedMonthSales}`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setSalesPerformanceData(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('영업자 성과 조회 실패:', error);
            }
        };
        fetchSalesPerformance();
    }, [selectedMonthSales]);

    useEffect(() => {
        const fetchStaffPerformance = async () => {
            try {
                const response = await fetch(`/api/staff/stats?month=${selectedMonthStaff}`, { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setStaffPerformanceData(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error('실무자 성과 조회 실패:', error);
            }
        };
        fetchStaffPerformance();
    }, [selectedMonthStaff]);

    // 케이스별 매출 정산
    const handlePrevMonthSettlement = () => {
        const [year, month] = selectedMonthSettlement.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() - 1);
        setSelectedMonthSettlement(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonthSettlement = () => {
        const [year, month] = selectedMonthSettlement.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() + 1);
        setSelectedMonthSettlement(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    // 영업자 성과
    const handlePrevMonthSales = () => {
        const [year, month] = selectedMonthSales.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() - 1);
        setSelectedMonthSales(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonthSales = () => {
        const [year, month] = selectedMonthSales.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() + 1);
        setSelectedMonthSales(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    // 실무자 성과
    const handlePrevMonthStaff = () => {
        const [year, month] = selectedMonthStaff.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() - 1);
        setSelectedMonthStaff(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const handleNextMonthStaff = () => {
        const [year, month] = selectedMonthStaff.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1);
        date.setMonth(date.getMonth() + 1);
        setSelectedMonthStaff(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    };

    const handlePrevYear = () => {
        const year = parseInt(selectedYear);
        setSelectedYear(`${year - 1}`);
    };

    const handleNextYear = () => {
        const year = parseInt(selectedYear);
        setSelectedYear(`${year + 1}`);
    };

    const formatManwon = (manwon: number): string => {
        if (manwon === 0) return '0만원';
        const rounded = Math.round(manwon * 10) / 10;
        const intPart = Math.floor(rounded);
        const decPart = Math.round((rounded - intPart) * 10);
        const intFormatted = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decPart > 0 ? `${intFormatted}.${decPart}만원` : `${intFormatted}만원`;
    };

    const getRateColor = (rate: string | null | undefined) => {
        if (!rate || rate === '-') return undefined;
        if (rate.startsWith('+')) return '#2f9e44';
        if (rate.startsWith('-')) return '#e03131';
        return undefined;
    };

    const formatApprovalAmount = (manwon: number): string => {
        const eokValue = manwon / 1;
        const eok = Math.floor(eokValue);
        const decimal = (eokValue - eok) * 10; // 소수점 첫자리
        const cheonman = Math.floor(decimal);
        const baekman = Math.floor((decimal - cheonman) * 10);

        if (eok > 0) {
            if (cheonman > 0) {
                if (baekman > 0) {
                    return `${eok}억 ${cheonman}천 ${baekman}백만원`;
                } else {
                    return `${eok}억 ${cheonman}천만원`;
                }
            } else {
                if (baekman > 0) {
                    return `${eok}억 ${baekman}백만원`;
                } else {
                    return `${eok}억원`;
                }
            }
        } else {
            if (cheonman > 0) {
                if (baekman > 0) {
                    return `${cheonman}천 ${baekman}백만원`;
                } else {
                    return `${cheonman}천만원`;
                }
            } else {
                if (baekman > 0) {
                    return `${baekman}백만원`;
                } else {
                    return '0원';
                }
            }
        }
    };

    const formatFeeInMillions = (manwon: number): string => {
        if (manwon === 0) return '0백만원';
        const millions = manwon / 100;
        const rounded = Math.round(millions * 100) / 100;
        return `${rounded}백만원`;
    };

    const formatTotalRevenueAmount = (manwon: number): string => {
        // manwon은 이미 만원 단위
        if (manwon === 0) return '0원';

        // 백만원 단위로 버림
        const baekmanValue = Math.floor(manwon / 100);

        // 백만원 미만이면 "X만원" 형태로 표시
        if (baekmanValue === 0) {
            return `${Math.floor(manwon)}만원`;
        }

        // 백만원 단위를 억/천/백으로 변환
        // 1억 = 100백만원, 1천 = 10백만원, 1백 = 1백만원
        const eok = Math.floor(baekmanValue / 100);
        const remaining = baekmanValue % 100;
        const cheonman = Math.floor(remaining / 10);
        const baekman = remaining % 10;

        return `${eok}억 ${cheonman}천 ${baekman}백만원`;
    };

    if (loading) {
        return <Spinner fullScreen />;
    }

    const stats = settleData?.stats || {};

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div className={styles.mainTitleWrap}>
                    <h1 className={styles.mainTitle}>성과, 정산</h1>
                    <p className={styles.subTitle}>성과 관리 및 정산</p>
                </div>
                {!(userLevel === 4 && isAffiliationRep) && (
                    <div className={styles.btnWrap}>
                        <a href="/main/company_create?create=true&consultation=true">상담요청</a>
                        <a href="/main/company_create?create=true">기업등록</a>
                    </div>
                )}
            </div>

            <div className={styles.contentWrap}>
                {/* Stats Section */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>이번달 매출</p>
                        <p className={styles.statValue}>{formatFeeInMillions(stats.monthlyRevenue || 0)}</p>
                        <p className={styles.statSubValue}>전월 대비 <span style={{ color: getRateColor(stats.prevMonthChangeRate) }}>{stats.prevMonthChangeRate ?? '-'}</span></p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>이번달 승인금액</p>
                        <p className={styles.statValue}>{formatApprovalAmount(stats.monthlyApprovalAmount || 0)}</p>
                        <p className={styles.statSubValue}>{stats.monthlyApprovedCount || 0}건</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>누적 매출</p>
                        <p className={styles.statValue}>{formatTotalRevenueAmount(stats.totalRevenueAmount || 0)}</p>
                        <p className={styles.statSubValue}>전년도 대비 <span style={{ color: getRateColor(stats.prevYearChangeRate) }}>{stats.prevYearChangeRate ?? '-'}</span></p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>누적 승인금액</p>
                        <p className={styles.statValue}>{formatApprovalAmount(stats.totalApprovalAmount || 0)}</p>
                        <p className={styles.statSubValue}>{stats.totalApprovedCount || 0}건</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>전환율</p>
                        <p className={styles.statValue}>{stats.conversionRate || 0}%</p>
                        <p className={styles.statSubValue}>전월 대비 <span style={{ color: getRateColor(stats.conversionChangeRate) }}>{stats.conversionChangeRate ?? '-'}</span></p>
                    </div>
                </div>

                {/* Middle Section */}
                <div className={styles.middleSection}>
                    <div className={styles.performanceGrid}>
                        {/* 케이스별 매출 정산 */}
                        <SettlementTable
                            data={settleData?.settlementData || settlementDataDefault}
                            selectedMonth={selectedMonthSettlement}
                            onMonthChange={setSelectedMonthSettlement}
                            onPrevMonth={handlePrevMonthSettlement}
                            onNextMonth={handleNextMonthSettlement}
                            userLevel={settleData?.userLevel || 0}
                        />

                        {/* 년별 매출 추이 */}
                        <RevenueChart
                            selectedYear={selectedYear}
                            onYearChange={setSelectedYear}
                            onPrevYear={handlePrevYear}
                            onNextYear={handleNextYear}
                            revenueData={settleData?.revenueChartData}
                        />


                        {/* 영업자 성과 */}
                        <SalesPerformanceTable
                            data={salesPerformanceData}
                            selectedMonth={selectedMonthSales}
                            onMonthChange={setSelectedMonthSales}
                            onPrevMonth={handlePrevMonthSales}
                            onNextMonth={handleNextMonthSales}
                        />

                        {/* 실무자 성과 - 대표자(1), 대표실무자(2), 실무자(3)만 표시 */}
                        {(userLevel === 1 || userLevel === 2 || userLevel === 3) && (
                            <StaffPerformanceTable
                                data={staffPerformanceData}
                                selectedMonth={selectedMonthStaff}
                                onMonthChange={setSelectedMonthStaff}
                                onPrevMonth={handlePrevMonthStaff}
                                onNextMonth={handleNextMonthStaff}
                            />
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
