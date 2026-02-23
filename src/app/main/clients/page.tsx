'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './clients.module.css';
import ClientCard from './components/ClientCard';
import StatCard from './components/StatCard';

interface Client {
    id: number;
    name: string;
    businessNumber: string;
    industry: string;
    representative: string;
    annualSales: string;
    creditRating: string;
    totalCases: number;
    cumulativeApproval: string;
    isNew: boolean;
}

const mockClients: Client[] = [
    {
        id: 1,
        name: '(주)테크솔루션',
        businessNumber: '123-45-67890',
        industry: 'IT/서비스',
        representative: '김철수',
        annualSales: '80억원',
        creditRating: 'BBB+',
        totalCases: 3,
        cumulativeApproval: '12억원',
        isNew: true
    },
    {
        id: 2,
        name: '(주)테크솔루션',
        businessNumber: '123-45-67890',
        industry: 'IT/서비스',
        representative: '김철수',
        annualSales: '80억원',
        creditRating: 'BBB+',
        totalCases: 3,
        cumulativeApproval: '12억원',
        isNew: false
    },
    {
        id: 3,
        name: '(주)테크솔루션',
        businessNumber: '123-45-67890',
        industry: 'IT/서비스',
        representative: '김철수',
        annualSales: '80억원',
        creditRating: 'BBB+',
        totalCases: 3,
        cumulativeApproval: '12억원',
        isNew: false
    },
    {
        id: 4,
        name: '(주)테크솔루션',
        businessNumber: '123-45-67890',
        industry: 'IT/서비스',
        representative: '김철수',
        annualSales: '80억원',
        creditRating: 'BBB+',
        totalCases: 3,
        cumulativeApproval: '12억원',
        isNew: false
    },
    {
        id: 5,
        name: '(주)테크솔루션',
        businessNumber: '123-45-67890',
        industry: 'IT/서비스',
        representative: '김철수',
        annualSales: '80억원',
        creditRating: 'BBB+',
        totalCases: 3,
        cumulativeApproval: '12억원',
        isNew: false
    },
    {
        id: 6,
        name: '(주)테크솔루션',
        businessNumber: '123-45-67890',
        industry: 'IT/서비스',
        representative: '김철수',
        annualSales: '80억원',
        creditRating: 'BBB+',
        totalCases: 3,
        cumulativeApproval: '12억원',
        isNew: false
    }
];

export default function ClientsPage() {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredClients = mockClients.filter(client => 
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.businessNumber.includes(searchQuery) ||
        client.representative.includes(searchQuery)
    );

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div>
                    <h1 className={styles.mainTitle}>고객사</h1>
                    <p className={styles.subTitle}>등록된 고객사 현황을 한눈에 확인하세요.</p>
                </div>
                <div className={styles.btnWrap}>
                    <Link href="">상담 신청</Link>
                    <Link href="">기업 등록</Link>
                </div>
            </div>

            <div className={styles.contentWrap}>
                <div className={styles.statsGrid}>
                    <StatCard label="전체 고객사" value="324" />
                    <StatCard label="이번달 신규" value="18" />
                    <StatCard label="누적 승인금액" value="1,248억" />
                </div>

                <div className={styles.searchContainer}>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="고객사명, 사업자번호, 대표자명으로 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.clientGrid}>
                    {filteredClients.map((client) => (
                        <ClientCard key={client.id} client={client} />
                    ))}
                </div>
            </div>
        </div>
    );
}
