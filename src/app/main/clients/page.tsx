'use client';

import { useState, useEffect } from 'react';
import { getAdminData } from '@/lib/auth';
import styles from './clients.module.css';
import ClientCard from './components/ClientCard';
import StatCard from './components/StatCard';
import Pagination from '@/app/components/Pagination/Pagination';
import Spinner from '@/app/components/Spinner/Spinner';

interface Client {
    company_name: string;
    business_number: string;
    company_type: string;
    standard_classification: string | null;
    representative_name: string;
    company_credit_rating_kcb: string | null;
    company_credit_rating_nice: string | null;
    annual_sales: string | null;
    creditRatingImage: string | null;
    totalCases: number;
    documents: Array<{
        id: number;
        progress_details: string;
        status: string;
        created_at: string;
        approval_amount: number | null;
    }>;
}

export default function ClientsPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const adminData = getAdminData();
    const isAffiliationRep = adminData?.position?.level === 4 && adminData?.is_affiliation_representative === true;
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(6);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const response = await fetch('/api/clients', { credentials: 'include' });
                if (response.ok) {
                    const data = await response.json();
                    setClients(data.clients || []);
                }
            } catch (error) {
                console.error('고객사 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
    }, []);

    // 검색어 변경 시 페이지 초기화
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const filteredClients = clients.filter(client =>
        client.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.business_number.includes(searchQuery) ||
        client.representative_name.includes(searchQuery)
    );

    // 페이지네이션 계산
    const indexOfLastClient = currentPage * itemsPerPage;
    const indexOfFirstClient = indexOfLastClient - itemsPerPage;
    const paginatedClients = filteredClients.slice(indexOfFirstClient, indexOfLastClient);

    const totalClients = clients.length;
    const totalCases = clients.reduce((sum, client) => sum + client.totalCases, 0);
    const totalApprovalAmount = clients.reduce((sum, client) =>
        sum + client.documents
            .filter(doc => doc.progress_details === '승인')
            .reduce((s, doc) => s + (doc.approval_amount || 0), 0)
    , 0);

    const formatApprovalAmount = (manwon: number): string => {
        const eokValue = manwon / 10000;
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

    return (
        <div className={styles.container}>
            <div className={styles.titleWrap}>
                <div>
                    <h1 className={styles.mainTitle}>고객사</h1>
                    <p className={styles.subTitle}>등록된 고객사 현황을 한눈에 확인하세요.</p>
                </div>
                {!isAffiliationRep && (
                    <div className={styles.btnWrap}>
                        <a href="/main/company_create?create=true&consultation=true">상담요청</a>
                        <a href="/main/company_create?create=true">기업등록</a>
                    </div>
                )}
            </div>

            <div className={styles.contentWrap}>
                {loading ? (
                    <Spinner fullScreen />
                ) : (
                    <>
                        <div className={styles.statsGrid}>
                            <StatCard label="전체 고객사" value={`${totalClients}개`} />
                            <StatCard label="총 케이스" value={`${totalCases}건`} />
                            <StatCard label="누적승인금액" value={formatApprovalAmount(totalApprovalAmount)} />
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
                            {filteredClients.length > 0 ? (
                                paginatedClients.map((client) => (
                                    <ClientCard key={client.company_name} client={client} />
                                ))
                            ) : (
                                <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: '#999' }}>
                                    검색 결과가 없습니다.
                                </div>
                            )}
                        </div>

                        {filteredClients.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px', marginBottom: '20px' }}>
                                <Pagination
                                    currentPage={currentPage}
                                    totalItems={filteredClients.length}
                                    itemsPerPage={itemsPerPage}
                                    onPageChange={setCurrentPage}
                                />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
