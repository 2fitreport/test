'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FiUsers } from 'react-icons/fi';
import Pagination from '@/app/components/Pagination/Pagination';
import pageStyles from '../performanceSettlement.module.css';
import styles from './SalesPerformanceTable.module.css';

interface SalesRow {
    name: string;
    consult: number;
    case: number;
    amount: string;
    rate: string;
}

interface Props {
    data: SalesRow[];
    selectedMonth: string;
    onMonthChange: (month: string) => void;
    onPrevMonth: () => void;
    onNextMonth: () => void;
}

export default function SalesPerformanceTable({
    data,
    selectedMonth,
    onMonthChange,
    onPrevMonth,
    onNextMonth
}: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState<string>('case');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    const processTableData = (
        items: any[],
        term: string,
        column: string,
        order: 'asc' | 'desc',
        page: number
    ) => {
        const filtered = items.filter(item =>
            item.name.toString().toLowerCase().includes(term.toLowerCase())
        );

        filtered.sort((a, b) => {
            // 문자열 컬럼은 숫자 필드로 정렬
            const sortKey = column === 'amount' ? 'amountNum' : column === 'rate' ? 'rateNum' : column;
            const aValue = a[sortKey];
            const bValue = b[sortKey];

            if (typeof aValue === 'number' && typeof bValue === 'number') {
                return order === 'asc' ? aValue - bValue : bValue - aValue;
            }

            if (order === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        const totalPages = Math.ceil(filtered.length / itemsPerPage);
        const startIdx = (page - 1) * itemsPerPage;
        const paginatedData = filtered.slice(startIdx, startIdx + itemsPerPage);

        return { data: paginatedData, totalPages, totalCount: filtered.length };
    };

    const processed = processTableData(data, searchTerm, sortColumn, sortOrder, currentPage);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
        setCurrentPage(1);
    };

    const getSortIcon = (column: string) => {
        return (
            <span style={{ display: 'inline-flex', flexDirection: 'column', fontSize: '10px', lineHeight: '0.8', marginLeft: '4px', color: '#ccc', verticalAlign: 'middle' }}>
                <span style={{ display: 'block', opacity: sortColumn === column && sortOrder === 'asc' ? 1 : 0.3, color: sortColumn === column && sortOrder === 'asc' ? '#553be9' : '#ccc', fontWeight: sortColumn === column && sortOrder === 'asc' ? 'bold' : 'normal' }}>↑</span>
                <span style={{ display: 'block', opacity: sortColumn === column && sortOrder === 'desc' ? 1 : 0.3, color: sortColumn === column && sortOrder === 'desc' ? '#553be9' : '#ccc', fontWeight: sortColumn === column && sortOrder === 'desc' ? 'bold' : 'normal' }}>↓</span>
            </span>
        );
    };

    return (
        <div className={pageStyles.performanceTableCard}>
            <div className={styles.header}>
                <div className={pageStyles.cardSubtitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FiUsers size={18} />영업자 성과
                </div>
                <div className={styles.controls}>
                    <button
                        onClick={onPrevMonth}
                        className={styles.button}
                        title="이전 달"
                    >
                        <Image
                            src="/arrow_left.svg"
                            alt="이전 달"
                            width={20}
                            height={20}
                        />
                    </button>
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => onMonthChange(e.target.value)}
                        onClick={(e) => {
                            const input = e.target as HTMLInputElement;
                            input.showPicker?.();
                        }}
                        className={styles.monthInput}
                    />
                    <button
                        onClick={onNextMonth}
                        className={styles.button}
                        title="다음 달"
                    >
                        <Image
                            src="/arrow_right.svg"
                            alt="다음 달"
                            width={20}
                            height={20}
                        />
                    </button>
                </div>
            </div>
            <div className={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="담당자 검색"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                    className={styles.searchInput}
                />
            </div>
            {processed.data.length > 0 ? (
                <table className={pageStyles.performanceTable}>
                    <thead>
                        <tr>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>담당자{getSortIcon('name')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('consult')} style={{ cursor: 'pointer' }}>등록{getSortIcon('consult')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('case')} style={{ cursor: 'pointer' }}>승인{getSortIcon('case')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>승인금액{getSortIcon('amount')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('rate')} style={{ cursor: 'pointer' }}>전환율{getSortIcon('rate')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processed.data.map((row, i) => (
                            <tr key={i}>
                                <td>{row.name}</td>
                                <td>{row.consult}</td>
                                <td style={{ color: '#553be9', fontWeight: 700 }}>{row.case}</td>
                                <td>{row.amount}</td>
                                <td><span className={pageStyles.conversionBadge} style={{ backgroundColor: parseInt(row.rate) <= 75 ? '#fff3cd' : '#e8f5e9', color: parseInt(row.rate) <= 75 ? '#856404' : '#2e7d32' }}>{row.rate}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className={styles.emptyMessage}>영업자가 없습니다.</div>
            )}
            <div className={styles.paginationWrapper}>
                <Pagination
                    currentPage={currentPage}
                    totalItems={processed.totalCount}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            </div>
        </div>
    );
}
