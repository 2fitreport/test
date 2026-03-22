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
                <div className={styles.btnWrap}>
                    <a href="/main/company_create?create=true&consultation=true">상담신청</a>
                    <a href="/main/company_create?create=true">기업 생성</a>
                </div>
            </div>

            <div className={styles.contentWrap}>
                {/* Stats Section */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>이번달 매출</p>
                        <p className={styles.statValue}>{formatApprovalAmount(stats.monthlyRevenue || 0)}</p>
                        <p className={styles.statSubValue}>전월 대비</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>이번달 승인금액</p>
                        <p className={styles.statValue}>{formatApprovalAmount(stats.monthlyApprovalAmount || 0)}</p>
                        <p className={styles.statSubValue}>{stats.monthlyApprovedCount || 0}건</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>누적 매출</p>
                        <p className={styles.statValue}>{formatApprovalAmount(stats.totalApprovalAmount ? stats.totalApprovalAmount * 0.03 : 0)}</p>
                        <p className={styles.statSubValue}>전년도 대비</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>누적 승인금액</p>
                        <p className={styles.statValue}>{formatApprovalAmount(stats.totalApprovalAmount || 0)}</p>
                        <p className={styles.statSubValue}>{stats.totalApprovedCount || 0}건</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>전환율</p>
                        <p className={styles.statValue}>{stats.conversionRate || 0}%</p>
                        <p className={styles.statSubValue}>상담 대비 승인율</p>
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
