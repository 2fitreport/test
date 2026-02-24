'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FiDollarSign } from 'react-icons/fi';
import Pagination from '@/app/components/Pagination/Pagination';
import pageStyles from '../performanceSettlement.module.css';
import styles from './SettlementTable.module.css';

interface SettlementRow {
    company: string;
    amount: string;
    fee: string;
    real: string;
    manager: string;
    incentive: string;
    date: string;
}

interface Props {
    data: SettlementRow[];
    selectedMonth: string;
    onMonthChange: (month: string) => void;
    onPrevMonth: () => void;
    onNextMonth: () => void;
}

export default function SettlementTable({
    data,
    selectedMonth,
    onMonthChange,
    onPrevMonth,
    onNextMonth
}: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [sortColumn, setSortColumn] = useState<string>('company');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    const processTableData = (
        items: any[],
        term: string,
        column: string,
        order: 'asc' | 'desc',
        page: number
    ) => {
        let filtered = items.filter(item =>
            item.company.toString().toLowerCase().includes(term.toLowerCase())
        );

        filtered.sort((a, b) => {
            const aValue = a[column];
            const bValue = b[column];

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
        <div className={pageStyles.bottomTableCard}>
            <div className={styles.header}>
                <div className={pageStyles.bottomCardTitle} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FiDollarSign size={20} /> 케이스별 매출 정산
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
                    placeholder="업체명 검색"
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                    }}
                    className={styles.searchInput}
                />
            </div>
            {processed.data.length > 0 ? (
                <table className={pageStyles.settlementTable}>
                    <thead>
                        <tr>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('company')} style={{ cursor: 'pointer' }}>업체명{getSortIcon('company')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>승인금액{getSortIcon('amount')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('fee')} style={{ cursor: 'pointer' }}>수수료율{getSortIcon('fee')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('real')} style={{ cursor: 'pointer' }}>실제매출{getSortIcon('real')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('manager')} style={{ cursor: 'pointer' }}>담당자{getSortIcon('manager')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('incentive')} style={{ cursor: 'pointer' }}>인센티브{getSortIcon('incentive')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>지급예정일{getSortIcon('date')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processed.data.map((row, i) => (
                            <tr key={i}>
                                <td>{row.company}</td>
                                <td>{row.amount}</td>
                                <td>{row.fee}</td>
                                <td className={pageStyles.realSalesText}>{row.real}</td>
                                <td>{row.manager}</td>
                                <td className={pageStyles.incentiveText}>{row.incentive}</td>
                                <td>{row.date}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <div className={styles.emptyMessage}>케이스별 매출 정산이 없습니다.</div>
            )}
            <div className={styles.paginationWrapper}>
                <Pagination
                    currentPage={currentPage}
                    totalItems={processed.totalCount}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />
            </div>
            <div className={styles.summarySection}>
                <div className={styles.summaryTitle}>합계</div>
                <div className={styles.summaryValues}>
                    <div className={styles.summaryItem}>
                        <span>승인</span>
                        <span className={styles.summaryValueBlue}>19억원</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span>매출</span>
                        <span className={styles.summaryValueBlue}>7,510만원</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span>인센티브</span>
                        <span className={styles.summaryValueGreen}>751만원</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
