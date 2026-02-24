'use client';

import { useEffect, useState } from 'react';
import Pagination from '@/app/components/Pagination/Pagination';
import styles from './salesWrap.module.css';

interface SalesData {
    userId: string;
    name: string;
    registrations: number;
    inProgress: number;
    approved: number;
    rejected: number;
    approvalAmount: string;
    conversionRate: string;
}

function getConversionRateStyle(conversionRate: string) {
    if (conversionRate === '-') {
        return { color: '#999', fontWeight: 600 };
    }
    const rate = parseInt(conversionRate, 10);
    if (rate >= 75) {
        return {
            color: '#16a34a',
            fontWeight: 600,
            backgroundColor: '#dcfce7',
            padding: '4px 12px',
            borderRadius: '100px',
            display: 'inline-block'
        };
    } else {
        return {
            color: '#ea580c',
            fontWeight: 600,
            backgroundColor: '#fef3c7',
            padding: '4px 12px',
            borderRadius: '100px',
            display: 'inline-block'
        };
    }
}

export default function SalesWrap() {
    const [userLevel, setUserLevel] = useState<number>(0);
    const [salesData, setSalesData] = useState<SalesData[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [isRepresentative, setIsRepresentative] = useState(false);
    const [companyName, setCompanyName] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
    const [sortColumn, setSortColumn] = useState<keyof SalesData>('userId');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

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
    }, []);

    // 영업자 데이터 로드
    useEffect(() => {
        if (userLevel === 0) return;

        const fetchSalesData = async () => {
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

                const response = await fetch(`/api/sales/stats?${params}`, {
                    credentials: 'include'
                });

                if (!response.ok) {
                    throw new Error('영업자 데이터 조회 실패');
                }

                const data = await response.json();
                setSalesData(data);
            } catch (error) {
                console.error('영업자 데이터 조회 실패:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchSalesData();
    }, [userLevel, currentUserId, isRepresentative, companyName, viewMode]);

    const handleSort = (column: keyof SalesData) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const getSortedData = () => {
        return [...salesData].sort((a, b) => {
            let aVal: any = a[sortColumn];
            let bVal: any = b[sortColumn];

            // 숫자 변환 정렬이 필요한 필드들
            if (sortColumn === 'approvalAmount') {
                aVal = parseInt(String(aVal).replace(/[^0-9]/g, '')) || 0;
                bVal = parseInt(String(bVal).replace(/[^0-9]/g, '')) || 0;
            } else if (sortColumn === 'conversionRate') {
                aVal = parseFloat(String(aVal).replace(/[^0-9.]/g, '')) || 0;
                bVal = parseFloat(String(bVal).replace(/[^0-9.]/g, '')) || 0;
            } else if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }

            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const getSortIcon = (column: keyof SalesData) => {
        const isActive = sortColumn === column;
        return (
            <span className={styles.sortIcon}>
                <span className={isActive && sortOrder === 'asc' ? styles.active : ''}>↑</span>
                <span className={isActive && sortOrder === 'desc' ? styles.active : ''}>↓</span>
            </span>
        );
    };

    // 대표(1), 대표실무자(2): 모든 영업자 데이터
    // 영업자(4): 자신의 데이터만
    // 나머지: 표시 안 함
    const shouldDisplay = userLevel === 1 || userLevel === 2 || userLevel === 4;

    if (!shouldDisplay) {
        return null;
    }

    const isAffiliationRepresentative = isRepresentative && userLevel === 4;
    const sortedData = getSortedData();

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const paginatedData = sortedData.slice(startIdx, startIdx + itemsPerPage);

    return (
        <div className={styles.salesWrap}>
            <div className={styles.salesHeader}>
                <h2>영업자 현황</h2>
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
            <div className={styles.tableWrapper}>
                <table className={styles.salesTable}>
                    <thead>
                        <tr>
                            <th className={styles.sortableHeader} onClick={() => handleSort('name')}>영업자{getSortIcon('name')}</th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('registrations')}>등록{getSortIcon('registrations')}</th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('inProgress')}>진행{getSortIcon('inProgress')}</th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('approved')}>승인{getSortIcon('approved')}</th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('rejected')}>보류{getSortIcon('rejected')}</th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('approvalAmount')}>승인금액{getSortIcon('approvalAmount')}</th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('conversionRate')}>전환율{getSortIcon('conversionRate')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center' }}>로딩 중...</td>
                            </tr>
                        ) : sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center' }}>데이터가 없습니다.</td>
                            </tr>
                        ) : (
                            paginatedData.map((row) => (
                                <tr key={row.userId}>
                                    <td>{row.name}</td>
                                    <td style={{ color: '#666', fontWeight: 600, fontSize: '16px' }}>{row.registrations}</td>
                                    <td style={{ color: '#2563eb', fontWeight: 600, fontSize: '16px' }}>{row.inProgress}</td>
                                    <td style={{ color: '#16a34a', fontWeight: 600, fontSize: '16px' }}>{row.approved}</td>
                                    <td style={{ color: '#dc2626', fontWeight: 600, fontSize: '16px' }}>{row.rejected}</td>
                                    <td>{row.approvalAmount}</td>
                                    <td><span style={getConversionRateStyle(row.conversionRate)}>{row.conversionRate}</span></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <div className={styles.paginationWrapper}>
                <Pagination
                    currentPage={currentPage}
                    totalItems={sortedData.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
}
