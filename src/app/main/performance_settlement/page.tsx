'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './performanceSettlement.module.css';
import SalesPerformanceTable from './components/SalesPerformanceTable';
import StaffPerformanceTable from './components/StaffPerformanceTable';
import RevenueChart from './components/RevenueChart';
import SettlementTable from './components/SettlementTable';

// 영업자 성과 데이터
const salesData = [
    { name: '김매니저', consult: 32, case: 15, amount: '28억', rate: '78%' },
    { name: '이매니저', consult: 28, case: 12, amount: '22억', rate: '82%' },
    { name: '박매니저', consult: 24, case: 11, amount: '18억', rate: '85%' },
    { name: '최매니저', consult: 21, case: 9, amount: '14억', rate: '72%' },
    { name: '정영업자', consult: 35, case: 18, amount: '32억', rate: '68%' },
    { name: '강영업자', consult: 29, case: 13, amount: '24억', rate: '79%' },
    { name: '윤매니저', consult: 26, case: 10, amount: '20억', rate: '81%' },
    { name: '유영업자', consult: 31, case: 16, amount: '29억', rate: '77%' },
    { name: '송영업자', consult: 22, case: 8, amount: '16억', rate: '74%' },
    { name: '문매니저', consult: 27, case: 11, amount: '21억', rate: '83%' },
    { name: '차부장', consult: 38, case: 19, amount: '35억', rate: '80%' },
    { name: '형영업자', consult: 25, case: 10, amount: '19억', rate: '76%' },
    { name: '배과장', consult: 33, case: 17, amount: '31억', rate: '84%' },
    { name: '홍영업자', consult: 20, case: 7, amount: '12억', rate: '70%' },
    { name: '신부장', consult: 36, case: 20, amount: '34억', rate: '86%' },
    { name: '양영업자', consult: 23, case: 9, amount: '17억', rate: '75%' },
    { name: '조매니저', consult: 30, case: 14, amount: '26억', rate: '81%' },
    { name: '임영업자', consult: 26, case: 12, amount: '23억', rate: '78%' },
];

const settlementData = [
    { company: '(주)테크솔루션', amount: '5억원', fee: '4.0%', real: '2,000만원', manager: '김매니저', incentive: '200만원', date: '2024-02-25' },
    { company: '(주)글로벌트레이드', amount: '3억원', fee: '3.5%', real: '1,050만원', manager: '이매니저', incentive: '105만원', date: '2024-02-28' },
    { company: '(주)스마트물류', amount: '7억원', fee: '4.2%', real: '2,940만원', manager: '박매니저', incentive: '294만원', date: '2024-03-05' },
    { company: '(주)푸드코리아', amount: '4억원', fee: '3.8%', real: '1,520만원', manager: '최매니저', incentive: '152만원', date: '2024-03-10' },
    { company: '(주)동방무역', amount: '6억원', fee: '3.9%', real: '2,340만원', manager: '정영업자', incentive: '234만원', date: '2024-03-12' },
    { company: '(주)빅데이터', amount: '8억원', fee: '4.1%', real: '3,280만원', manager: '강영업자', incentive: '328만원', date: '2024-03-15' },
    { company: '(주)디지털혁신', amount: '5.5억원', fee: '4.0%', real: '2,200만원', manager: '윤매니저', incentive: '220만원', date: '2024-03-18' },
    { company: '(주)글로벌서비스', amount: '4.5억원', fee: '3.7%', real: '1,665만원', manager: '유영업자', incentive: '167만원', date: '2024-03-20' },
    { company: '(주)에코소프트', amount: '6.5억원', fee: '4.3%', real: '2,795만원', manager: '송영업자', incentive: '280만원', date: '2024-03-22' },
    { company: '(주)미래기술', amount: '3.5억원', fee: '3.6%', real: '1,260만원', manager: '문매니저', incentive: '126만원', date: '2024-03-25' },
    { company: '(주)크리에이티브', amount: '5.2억원', fee: '4.0%', real: '2,080만원', manager: '차부장', incentive: '208만원', date: '2024-03-28' },
    { company: '(주)스마트팩토리', amount: '7.5억원', fee: '4.2%', real: '3,150만원', manager: '형영업자', incentive: '315만원', date: '2024-03-30' },
    { company: '(주)클라우드솔루션', amount: '4.8억원', fee: '3.9%', real: '1,872만원', manager: '배과장', incentive: '187만원', date: '2024-04-02' },
    { company: '(주)인공지능연구소', amount: '6.2억원', fee: '4.1%', real: '2,542만원', manager: '홍영업자', incentive: '254만원', date: '2024-04-05' },
    { company: '(주)엔터테인먼트', amount: '3.8억원', fee: '3.7%', real: '1,406만원', manager: '신부장', incentive: '141만원', date: '2024-04-08' },
    { company: '(주)헬스케어텍', amount: '6.8억원', fee: '4.0%', real: '2,720만원', manager: '양영업자', incentive: '272만원', date: '2024-04-10' },
];

export default function PerformanceSettlementPage() {
    const [selectedMonth, setSelectedMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [selectedYear, setSelectedYear] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}`;
    });

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

    const handlePrevYear = () => {
        const year = parseInt(selectedYear);
        setSelectedYear(`${year - 1}`);
    };

    const handleNextYear = () => {
        const year = parseInt(selectedYear);
        setSelectedYear(`${year + 1}`);
    };

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div className={styles.mainTitleWrap}>
                    <h1 className={styles.mainTitle}>성과, 정산</h1>
                    <p className={styles.subTitle}>성과 관리 및 정산</p>
                </div>
                <div className={styles.btnWrap}>
                    <Link href="#">상담 신청</Link>
                    <Link href="#">기업 등록</Link>
                </div>
            </div>

            <div className={styles.contentWrap}>
                {/* Stats Section */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>이번달 매출</p>
                        <p className={styles.statValue}>3.2억원</p>
                        <p className={styles.statSubValue}>전월 대비 +3%</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>이번달 승인금액</p>
                        <p className={styles.statValue}>82억원</p>
                        <p className={styles.statSubValue}>47건</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>누적 매출</p>
                        <p className={styles.statValue}>15억원</p>
                        <p className={styles.statSubValue}>전년도 대비</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>누적 승인금액</p>
                        <p className={styles.statValue}>100억</p>
                        <p className={styles.statSubValue}>100건</p>
                    </div>
                    <div className={styles.statCard}>
                        <p className={styles.statLabel}>전환율</p>
                        <p className={styles.statValue}>79%</p>
                        <p className={styles.statSubValue}>상담 대비 승인율</p>
                    </div>
                </div>

                {/* Middle Section */}
                <div className={styles.middleSection}>
                    <div className={styles.performanceGrid}>
                        {/* 케이스별 매출 정산 */}
                        <SettlementTable
                            data={settlementData}
                            selectedMonth={selectedMonth}
                            onMonthChange={setSelectedMonth}
                            onPrevMonth={handlePrevMonth}
                            onNextMonth={handleNextMonth}
                        />
                        
                        {/* 년별 매출 추이 */}
                        <RevenueChart
                            selectedYear={selectedYear}
                            onYearChange={setSelectedYear}
                            onPrevYear={handlePrevYear}
                            onNextYear={handleNextYear}
                        />


                        {/* 영업자 성과 */}
                        <SalesPerformanceTable
                            data={salesData}
                            selectedMonth={selectedMonth}
                            onMonthChange={setSelectedMonth}
                            onPrevMonth={handlePrevMonth}
                            onNextMonth={handleNextMonth}
                        />

                        {/* 실무자 성과 */}
                        <StaffPerformanceTable
                            data={salesData}
                            selectedMonth={selectedMonth}
                            onMonthChange={setSelectedMonth}
                            onPrevMonth={handlePrevMonth}
                            onNextMonth={handleNextMonth}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}
