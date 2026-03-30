'use client';

import { useState } from 'react';
import Image from 'next/image';
import { FiDollarSign } from 'react-icons/fi';
import Pagination from '@/app/components/Pagination/Pagination';
import pageStyles from '../performanceSettlement.module.css';
import styles from './SettlementTable.module.css';

interface SettlementRow {
    company: string;
    approvalAmount: string;
    realSales: string;
    manager: string;
    inflow: string;
    fee: string;
    paymentDate: string;
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
    const itemsPerPage = 10;

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

        return { data: paginatedData, allFiltered: filtered, totalPages, totalCount: filtered.length };
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

    const formatAmount = (amount: any): string => {
        if (typeof amount === 'string') {
            return amount;
        }
        // amount는 만원 단위 (예: 14578만원 = 1.4578억원)
        const manwon = Number(amount) || 0;
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
                } else if (manwon > 0) {
                    return `${manwon}만원`;
                } else {
                    return '0원';
                }
            }
        }
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
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('approvalAmount')} style={{ cursor: 'pointer' }}>승인금액{getSortIcon('approvalAmount')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('realSales')} style={{ cursor: 'pointer' }}>실제매출{getSortIcon('realSales')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('manager')} style={{ cursor: 'pointer' }}>영업자{getSortIcon('manager')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('inflow')} style={{ cursor: 'pointer' }}>유입방식{getSortIcon('inflow')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('fee')} style={{ cursor: 'pointer' }}>지급수수료{getSortIcon('fee')}</th>
                            <th className={pageStyles.sortableHeader} onClick={() => handleSort('paymentDate')} style={{ cursor: 'pointer' }}>지급예정일{getSortIcon('paymentDate')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processed.data.map((row, i) => (
                            <tr key={i}>
                                <td>{row.company}</td>
                                <td>{formatAmount(row.approvalAmount)}</td>
                                <td className={pageStyles.realSalesText}>{formatAmount(row.realSales)}</td>
                                <td>{row.manager}</td>
                                <td>{row.inflow}</td>
                                <td className={pageStyles.incentiveText}>{formatAmount(row.fee)}</td>
                                <td>{row.paymentDate}</td>
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
                        <span>승인금액</span>
                        <span className={styles.summaryValueBlue}>{formatAmount((() => {
                            const seen = new Set();
                            return processed.allFiltered.reduce((sum, row) => {
                                if (row.documentId && seen.has(row.documentId)) return sum;
                                if (row.documentId) seen.add(row.documentId);
                                const amount = typeof row.approvalAmount === 'number' ? row.approvalAmount : 0;
                                return sum + amount;
                            }, 0);
                        })())}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span>실제매출</span>
                        <span className={styles.summaryValueBlue}>{formatAmount((() => {
                            const seen = new Set();
                            return processed.allFiltered.reduce((sum, row) => {
                                if (row.documentId && seen.has(row.documentId)) return sum;
                                if (row.documentId) seen.add(row.documentId);
                                const amount = typeof row.realSales === 'number' ? row.realSales : 0;
                                return sum + amount;
                            }, 0);
                        })())}</span>
                    </div>
                    <div className={styles.summaryItem}>
                        <span>지급수수료</span>
                        <span className={styles.summaryValueGreen}>{formatAmount(processed.allFiltered.reduce((sum, row) => {
                            const amount = typeof row.fee === 'number' ? row.fee : 0;
                            return sum + amount;
                        }, 0))}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
