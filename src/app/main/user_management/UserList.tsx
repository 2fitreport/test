'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import Pagination from '@/app/components/Pagination/Pagination';
import styles from './userList.module.css';

interface User {
    id: number;
    user_id: string;
    name: string;
    position: { name: string; level?: number };
    status: string;
    phone: string;
    address: string;
    address_detail: string;
    company_name: string;
    email_display: string;
}

type SortColumn = 'user_id' | 'name' | 'position' | 'phone' | 'email_display' | 'address' | 'company_name' | 'status';
type SortOrder = 'asc' | 'desc';

export default function UserList() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState<SortColumn>('user_id');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [pendingStatusChange, setPendingStatusChange] = useState<{ userId: number; newStatus: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await fetch('/api/users');
            if (!response.ok) throw new Error('사용자 조회 실패');
            const data = await response.json();
            setUsers(data);
        } catch (error) {
            console.error('사용자 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (column: SortColumn) => {
        if (sortColumn === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortOrder('asc');
        }
    };

    const getFilteredAndSortedUsers = () => {
        // 먼저 검색어로 필터링
        const filtered = users.filter(user => {
            const query = searchQuery.toLowerCase();
            return (
                user.user_id.toLowerCase().includes(query) ||
                user.name.toLowerCase().includes(query) ||
                (user.position?.name || '').toLowerCase().includes(query) ||
                (user.phone || '').toLowerCase().includes(query) ||
                (user.email_display || '').toLowerCase().includes(query) ||
                (user.address || '').toLowerCase().includes(query) ||
                (user.address_detail || '').toLowerCase().includes(query) ||
                (user.company_name || '').toLowerCase().includes(query)
            );
        });

        // 그 다음 정렬
        const sorted = [...filtered].sort((a, b) => {
            let aValue: string | number = a[sortColumn as keyof User] as string | number;
            let bValue: string | number = b[sortColumn as keyof User] as string | number;

            if (sortColumn === 'position') {
                // position은 level을 기준으로 정렬
                aValue = a.position?.level ?? 999;
                bValue = b.position?.level ?? 999;
            } else {
                // null 또는 undefined 처리
                aValue = aValue ?? '';
                bValue = bValue ?? '';

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toLowerCase();
                }
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    };

    const getPaginatedUsers = () => {
        const filtered = getFilteredAndSortedUsers();
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    };

    const getSortIcon = (column: SortColumn) => {
        const isActive = sortColumn === column;
        const arrowUp = isActive && sortOrder === 'asc' ? '↑' : '↑';
        const arrowDown = isActive && sortOrder === 'desc' ? '↓' : '↓';
        return (
            <span className={styles.sortIcon}>
                <span className={isActive && sortOrder === 'asc' ? styles.active : ''}>↑</span>
                <span className={isActive && sortOrder === 'desc' ? styles.active : ''}>↓</span>
            </span>
        );
    };

    const handleStatusChange = (userId: number, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        setPendingStatusChange({ userId, newStatus });
        setIsModalOpen(true);
    };

    const handleConfirmStatusChange = async () => {
        if (!pendingStatusChange) return;

        try {
            const response = await fetch(`/api/users/${pendingStatusChange.userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: pendingStatusChange.newStatus }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '상태 변경 실패');
            }

            // 상태 변경 후 사용자 목록 새로고침
            fetchUsers();
            setIsModalOpen(false);
            setPendingStatusChange(null);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '상태 변경 실패');
            setErrorModalOpen(true);
            setIsModalOpen(false);
            setPendingStatusChange(null);
        }
    };

    if (loading) {
        return <div className={styles.loading}>로딩 중...</div>;
    }

    return (
        <div className={styles.userListContainer}>
            <div className={styles.header}>
                <h2>사용자 목록</h2>
                <span className={styles.count}>총 {getFilteredAndSortedUsers().length}명</span>
            </div>

            <div className={styles.searchSection}>
                <div className={styles.searchContainer}>
                    <Image
                        src="/search.svg"
                        alt="검색"
                        width={20}
                        height={20}
                        className={styles.searchIcon}
                    />
                    <input
                        type="text"
                        placeholder="검색..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th className={styles.sortableHeader} onClick={() => handleSort('user_id')}>
                                사용자 ID{getSortIcon('user_id')}
                            </th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('name')}>
                                이름{getSortIcon('name')}
                            </th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('position')}>
                                직급{getSortIcon('position')}
                            </th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('phone')}>
                                연락처{getSortIcon('phone')}
                            </th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('email_display')}>
                                이메일{getSortIcon('email_display')}
                            </th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('address')}>
                                주소{getSortIcon('address')}
                            </th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('company_name')}>
                                소속{getSortIcon('company_name')}
                            </th>
                            <th className={styles.sortableHeader} onClick={() => handleSort('status')}>
                                상태{getSortIcon('status')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {getPaginatedUsers().map((user) => (
                            <tr key={user.id} className={styles.userRow}>
                                <td className={styles.userId}>{user.user_id}</td>
                                <td className={styles.name}>{user.name}</td>
                                <td className={styles.position}>{user.position?.name}</td>
                                <td className={styles.phone}>{user.phone || '-'}</td>
                                <td className={styles.email}>{user.email_display || '-'}</td>
                                <td className={styles.address}>
                                    <div className={styles.addressText}>
                                        {user.address && user.address_detail
                                            ? `${user.address} ${user.address_detail}`
                                            : user.address || user.address_detail || '-'}
                                    </div>
                                </td>
                                <td className={styles.company}>{user.company_name || '-'}</td>
                                <td className={styles.status}>
                                    {user.position?.name === '대표' ? (
                                        <span
                                            className={`${styles.statusBadge} ${styles.active}`}
                                        >
                                            활성
                                        </span>
                                    ) : (
                                        <span
                                            className={`${styles.statusBadge} ${
                                                user.status === 'active'
                                                    ? styles.active
                                                    : styles.inactive
                                            }`}
                                            onClick={() => handleStatusChange(user.id, user.status)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {user.status === 'active' ? '활성' : '비활성'}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={getFilteredAndSortedUsers().length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            <ConfirmModal
                isOpen={isModalOpen}
                message={`상태를 ${pendingStatusChange?.newStatus === 'active' ? '활성' : '비활성'}으로 변경하시겠습니까?`}
                onClose={() => {
                    setIsModalOpen(false);
                    setPendingStatusChange(null);
                }}
                onConfirm={handleConfirmStatusChange}
                confirmText="확인"
                cancelText="취소"
            />

            <ConfirmModal
                isOpen={errorModalOpen}
                message={errorMessage}
                onClose={() => {
                    setErrorModalOpen(false);
                    setErrorMessage('');
                }}
                onConfirm={() => {
                    setErrorModalOpen(false);
                    setErrorMessage('');
                }}
                confirmText="확인"
                type="error"
            />
        </div>
    );
}
