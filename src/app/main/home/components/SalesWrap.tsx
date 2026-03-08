'use client';

import { useState } from 'react';
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

interface Props {
    data: any;
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

export default function SalesWrap({ data }: Props) {
    const [viewMode, setViewMode] = useState<'all' | 'my'>('all');
    const [sortColumn, setSortColumn] = useState<keyof SalesData>('userId');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const userLevel = data?.userLevel || 0;
    const isRepresentative = data?.isRepresentative || false;
    const salesData: SalesData[] = data?.salesData || [];
    const currentUserId = data?.currentUserId || '';

    const shouldDisplay = userLevel === 1 || userLevel === 2 || userLevel === 4;
    if (!shouldDisplay) return null;

    // viewMode === 'my'일 때 자신만 필터링
    const filteredSalesData = (isRepresentative && userLevel === 4 && viewMode === 'my')
        ? salesData.filter(s => s.userId === currentUserId)
        : salesData;

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
        return [...filteredSalesData].sort((a, b) => {
            let aVal: any = a[sortColumn];
            let bVal: any = b[sortColumn];

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

    const isAffiliationRepresentative = isRepresentative && userLevel === 4;
    const sortedData = getSortedData();
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
                        {!data ? (
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
