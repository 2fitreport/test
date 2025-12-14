'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import Pagination from '@/app/components/Pagination/Pagination';
import styles from './userList.module.css';
import modalStyles from '@/app/components/Modal/Modal.module.css';

interface User {
    id: number;
    user_id: string;
    name: string;
    position: { id: number; name: string; level?: number };
    status: string;
    phone: string;
    address: string;
    address_detail: string;
    company_name: string;
    email_display: string;
}

type SortColumn = 'user_id' | 'name' | 'position' | 'phone' | 'email_display' | 'address' | 'company_name' | 'status';
type SortOrder = 'asc' | 'desc';

interface Position {
    id: number;
    name: string;
    level: number;
}

export default function UserList() {
    const [users, setUsers] = useState<User[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState<SortColumn>('position');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [pendingStatusChange, setPendingStatusChange] = useState<{ userId: number; newStatus: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
    const [isDeleteAllMode, setIsDeleteAllMode] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [pendingStatusChangeInModal, setPendingStatusChangeInModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [positionFilter, setPositionFilter] = useState<number | 'all'>('all');

    useEffect(() => {
        fetchUsers();
        fetchPositions();
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

    const fetchPositions = async () => {
        try {
            const response = await fetch('/api/positions');
            if (!response.ok) throw new Error('직급 조회 실패');
            const data = await response.json();
            setPositions(data);
        } catch (error) {
            console.error('직급 조회 실패:', error);
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
        // 먼저 필터 적용
        let filtered = users.filter(user => {
            // 상태 필터
            if (statusFilter !== 'all' && user.status !== statusFilter) {
                return false;
            }

            // 직급 필터
            if (positionFilter !== 'all') {
                const posId = positionFilter as number;
                if (!user.position || user.position.id !== posId) {
                    return false;
                }
            }

            return true;
        });

        // 검색어로 필터링
        filtered = filtered.filter(user => {
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

    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

    const handleStatusChange = (userId: number, currentStatus: string) => {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        setPendingStatusChange({ userId, newStatus });
        setIsModalOpen(true);
    };

    const handleDeleteSingle = (userId: number) => {
        setPendingDeleteId(userId);
        setIsModalOpen(true);
        setPendingStatusChange(null);
    };

    const handleViewUser = (user: User) => {
        setSelectedUser(user);
        setViewModalOpen(true);
    };

    const handleToggleStatusInModal = () => {
        if (!selectedUser || selectedUser.position?.level === 1) return;

        // 대표가 아닐 때만 확인 모달 표시
        setPendingStatusChangeInModal(true);
        setIsModalOpen(true);
    };

    const handleConfirmStatusChangeInModal = async () => {
        if (!selectedUser) return;

        const newStatus = selectedUser.status === 'active' ? 'inactive' : 'active';

        try {
            const response = await fetch(`/api/users/${selectedUser.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '상태 변경 실패');
            }

            // 모달의 selectedUser 상태 업데이트
            setSelectedUser({ ...selectedUser, status: newStatus });

            // 전체 사용자 목록도 새로고침
            fetchUsers();
            setIsModalOpen(false);
            setPendingStatusChangeInModal(false);
            setSuccessMessage('상태가 변경되었습니다.');
            setSuccessModalOpen(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '상태 변경 실패');
            setErrorModalOpen(true);
            setIsModalOpen(false);
            setPendingStatusChangeInModal(false);
        }
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
            setSuccessMessage(`상태가 변경되었습니다.`);
            setSuccessModalOpen(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '상태 변경 실패');
            setErrorModalOpen(true);
            setIsModalOpen(false);
            setPendingStatusChange(null);
        }
    };

    const handleSelectUser = (userId: number) => {
        const newSelected = new Set(selectedUsers);
        if (newSelected.has(userId)) {
            newSelected.delete(userId);
        } else {
            newSelected.add(userId);
        }
        setSelectedUsers(newSelected);
    };

    const handleSelectAll = () => {
        const paginatedUsers = getPaginatedUsers();
        // 대표(level 1)를 제외한 현재 페이지의 사용자
        const selectableUsers = paginatedUsers.filter(user => user.position?.level !== 1);

        // 현재 페이지의 선택 가능한 사용자가 모두 선택되어 있는지 확인
        const allCurrentPageSelected = selectableUsers.every(user => selectedUsers.has(user.id));

        if (allCurrentPageSelected && selectableUsers.length > 0) {
            // 현재 페이지의 사용자만 해제
            const newSelected = new Set(selectedUsers);
            selectableUsers.forEach(user => newSelected.delete(user.id));
            setSelectedUsers(newSelected);
        } else {
            // 현재 페이지의 사용자를 기존 선택에 추가
            const newSelected = new Set(selectedUsers);
            selectableUsers.forEach(user => newSelected.add(user.id));
            setSelectedUsers(newSelected);
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedUsers.size === 0) return;

        setIsModalOpen(true);
        setPendingStatusChange(null);
    };

    const handleConfirmDeleteSelected = async () => {
        try {
            const count = selectedUsers.size;
            for (const userId of selectedUsers) {
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    throw new Error('사용자 삭제 실패');
                }
            }

            fetchUsers();
            setSelectedUsers(new Set());
            setIsModalOpen(false);
            setIsDeleteAllMode(false);
            setSuccessMessage(`${count}명의 사용자가 삭제되었습니다.`);
            setSuccessModalOpen(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.');
            setErrorModalOpen(true);
            setIsModalOpen(false);
            setIsDeleteAllMode(false);
        }
    };

    const handleConfirmDeleteSingle = async () => {
        if (pendingDeleteId === null) return;

        try {
            const response = await fetch(`/api/users/${pendingDeleteId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('사용자 삭제 실패');
            }

            fetchUsers();
            setIsModalOpen(false);
            setPendingDeleteId(null);
            setSuccessMessage('사용자가 삭제되었습니다.');
            setSuccessModalOpen(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.');
            setErrorModalOpen(true);
            setIsModalOpen(false);
            setPendingDeleteId(null);
        }
    };

    const handleDeleteAll = () => {
        const nonRepCount = users.filter(u => u.position?.level !== 1).length;
        if (nonRepCount === 0) {
            setSuccessMessage('삭제할 사용자가 없습니다.');
            setSuccessModalOpen(true);
            return;
        }
        setIsDeleteAllMode(true);
        setIsModalOpen(true);
        setPendingStatusChange(null);
    };

    const handleConfirmDeleteAll = async () => {
        try {
            // 대표(level 1)를 제외한 모든 사용자 삭제
            let deleteCount = 0;
            for (const user of users) {
                if (user.position?.level === 1) continue;

                const response = await fetch(`/api/users/${user.id}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    throw new Error('사용자 삭제 실패');
                }
                deleteCount++;
            }

            fetchUsers();
            setSelectedUsers(new Set());
            setIsModalOpen(false);
            setIsDeleteAllMode(false);
            setSuccessMessage(`${deleteCount}명의 사용자가 삭제되었습니다.`);
            setSuccessModalOpen(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '사용자 삭제 중 오류가 발생했습니다.');
            setErrorModalOpen(true);
            setIsModalOpen(false);
            setIsDeleteAllMode(false);
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

                <div className={styles.filtersContainer}>
                    <div className={styles.itemsPerPageContainer}>
                        <label className={styles.itemsLabel}>상태:</label>
                        <div className={styles.selectWrapper}>
                            <select
                                className={styles.itemsSelect}
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                            >
                                <option value="all">전체</option>
                                <option value="active">활성</option>
                                <option value="inactive">비활성</option>
                            </select>
                            <Image
                                src="/arrow.svg"
                                alt="드롭다운"
                                width={16}
                                height={16}
                                className={styles.selectArrow}
                            />
                        </div>
                    </div>

                    <div className={styles.itemsPerPageContainer}>
                        <label className={styles.itemsLabel}>직급:</label>
                        <div className={styles.selectWrapper}>
                            <select
                                className={styles.itemsSelect}
                                value={positionFilter === 'all' ? 'all' : String(positionFilter)}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setPositionFilter(value === 'all' ? 'all' : Number(value));
                                }}
                            >
                                <option value="all">전체</option>
                                {positions.map(position => (
                                    <option key={String(position.id)} value={String(position.id)}>
                                        {position.name}
                                    </option>
                                ))}
                            </select>
                            <Image
                                src="/arrow.svg"
                                alt="드롭다운"
                                width={16}
                                height={16}
                                className={styles.selectArrow}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.selectorsContainer}>
                    <div className={styles.itemsPerPageContainer}>
                        <label className={styles.itemsLabel}>표시 개수:</label>
                        <div className={styles.selectWrapper}>
                            <select
                                className={styles.itemsSelect}
                                value={itemsPerPage}
                                onChange={(e) => {
                                    setItemsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                            >
                                <option value={5}>5개씩 보기</option>
                                <option value={10}>10개씩 보기</option>
                                <option value={20}>20개씩 보기</option>
                                <option value={30}>30개씩 보기</option>
                                <option value={40}>40개씩 보기</option>
                                <option value={50}>50개씩 보기</option>
                                <option value={100}>100개씩 보기</option>
                            </select>
                            <Image
                                src="/arrow.svg"
                                alt="드롭다운"
                                width={16}
                                height={16}
                                className={styles.selectArrow}
                            />
                        </div>
                    </div>

                    <div className={styles.itemsPerPageContainer}>
                        <label className={styles.itemsLabel}>정렬:</label>
                        <div className={styles.selectWrapper}>
                            <select
                                className={styles.itemsSelect}
                                value={`${sortColumn}-${sortOrder}`}
                                onChange={(e) => {
                                    const [column, order] = e.target.value.split('-');
                                    setSortColumn(column as SortColumn);
                                    setSortOrder(order as SortOrder);
                                }}
                            >
                                <option value="position-asc">직급 (높음)</option>
                                <option value="position-desc">직급 (낮음)</option>
                                <option value="user_id-asc">사용자 ID (A-Z)</option>
                                <option value="user_id-desc">사용자 ID (Z-A)</option>
                                <option value="name-asc">이름 (A-Z)</option>
                                <option value="name-desc">이름 (Z-A)</option>
                                <option value="phone-asc">전화번호 (A-Z)</option>
                                <option value="phone-desc">전화번호 (Z-A)</option>
                                <option value="email_display-asc">이메일 (A-Z)</option>
                                <option value="email_display-desc">이메일 (Z-A)</option>
                                <option value="company_name-asc">회사명 (A-Z)</option>
                                <option value="company_name-desc">회사명 (Z-A)</option>
                                <option value="status-asc">상태 (활성)</option>
                                <option value="status-desc">상태 (비활성)</option>
                            </select>
                            <Image
                                src="/arrow.svg"
                                alt="드롭다운"
                                width={16}
                                height={16}
                                className={styles.selectArrow}
                            />
                        </div>
                    </div>
                </div>

                <div className={styles.deleteButtonsContainer}>
                    <button
                        className={styles.deleteAllButton}
                        onClick={handleDeleteAll}
                    >
                        전체 삭제
                    </button>

                    <button
                        className={styles.deleteSelectedButton}
                        onClick={handleDeleteSelected}
                        disabled={selectedUsers.size === 0}
                    >
                        선택 삭제 ({selectedUsers.size})
                    </button>
                </div>
            </div>

            <div className={styles.tableWrapper}>
                {getFilteredAndSortedUsers().length === 0 ? (
                    <div className={styles.noDataContainer}>
                        <Image
                            src="/error.svg"
                            alt="데이터 없음"
                            width={60}
                            height={60}
                        />
                        <p className={styles.noDataText}>해당 데이터가 존재하지 않습니다.</p>
                    </div>
                ) : (
                    <table className={styles.userTable}>
                        <thead>
                            <tr>
                                <th className={styles.checkboxHeader}>
                                    <input
                                        type="checkbox"
                                        checked={
                                            (() => {
                                                const selectableUsers = getPaginatedUsers().filter(u => u.position?.level !== 1);
                                                return selectableUsers.length > 0 && selectableUsers.every(u => selectedUsers.has(u.id));
                                            })()
                                        }
                                        onChange={handleSelectAll}
                                    />
                                </th>
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
                                <th>관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {getPaginatedUsers().map((user) => (
                                <tr key={user.id} className={styles.userRow}>
                                    <td className={styles.checkboxCell}>
                                        {user.position?.level !== 1 && (
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.has(user.id)}
                                                onChange={() => handleSelectUser(user.id)}
                                            />
                                        )}
                                    </td>
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
                                        {user.position?.level === 1 ? (
                                            <span></span>
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
                                    <td className={styles.actions}>
                                        <button className={styles.editButton}>수정</button>
                                        <button
                                            className={styles.deleteButton}
                                            onClick={() => handleDeleteSingle(user.id)}
                                        >
                                            삭제
                                        </button>
                                        <button
                                            className={styles.viewButton}
                                            onClick={() => handleViewUser(user)}
                                        >
                                            보기
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={getFilteredAndSortedUsers().length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />

            <ConfirmModal
                isOpen={isModalOpen}
                message={
                    pendingStatusChange
                        ? `상태를 ${pendingStatusChange.newStatus === 'active' ? '활성' : '비활성'}으로 변경하시겠습니까?`
                        : pendingStatusChangeInModal && selectedUser
                        ? `상태를 ${selectedUser.status === 'active' ? '비활성' : '활성'}으로 변경하시겠습니까?`
                        : pendingDeleteId !== null
                        ? '사용자를 삭제하시겠습니까?'
                        : isDeleteAllMode
                        ? `전체 사용자(${users.filter(u => u.position?.level !== 1).length}명)의 사용자를 삭제하시겠습니까?`
                        : `선택된 ${selectedUsers.size}명의 사용자를 삭제하시겠습니까?`
                }
                onClose={() => {
                    setIsModalOpen(false);
                    setPendingStatusChange(null);
                    setIsDeleteAllMode(false);
                    setPendingDeleteId(null);
                    setPendingStatusChangeInModal(false);
                }}
                onConfirm={
                    pendingStatusChange
                        ? handleConfirmStatusChange
                        : pendingStatusChangeInModal
                        ? handleConfirmStatusChangeInModal
                        : pendingDeleteId !== null
                        ? handleConfirmDeleteSingle
                        : isDeleteAllMode
                        ? handleConfirmDeleteAll
                        : handleConfirmDeleteSelected
                }
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

            {successModalOpen && (
                <div className={modalStyles.overlay} onClick={() => {
                    setSuccessModalOpen(false);
                    setSuccessMessage('');
                }}>
                    <div className={`${modalStyles.modal} ${modalStyles.success}`} onClick={(e) => e.stopPropagation()}>
                        <div className={modalStyles.content}>
                            <div className={modalStyles.iconWrapper}>
                                <img
                                    src={successMessage === '삭제할 사용자가 없습니다.' ? '/error.svg' : '/check.svg'}
                                    alt="success"
                                    className={modalStyles.icon}
                                />
                            </div>
                            <p className={modalStyles.message}>{successMessage}</p>
                        </div>
                        <div className={modalStyles.footer}>
                            <button
                                className={modalStyles.confirmButton}
                                onClick={() => {
                                    setSuccessModalOpen(false);
                                    setSuccessMessage('');
                                }}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewModalOpen && selectedUser && (
                <div className={styles.viewModalOverlay} onClick={() => {
                    setViewModalOpen(false);
                    setSelectedUser(null);
                }}>
                    <div className={styles.viewModalContent} onClick={(e) => e.stopPropagation()}>
                        <h3 className={styles.viewModalTitle}>사용자 정보</h3>

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>사용자 ID</span>
                            <span className={styles.viewModalValue}>{selectedUser.user_id}</span>
                        </div>

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>이름</span>
                            <span className={styles.viewModalValue}>{selectedUser.name}</span>
                        </div>

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>직급</span>
                            <span className={styles.viewModalValue}>{selectedUser.position?.name}</span>
                        </div>

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>연락처</span>
                            <span className={styles.viewModalValue}>{selectedUser.phone || '-'}</span>
                        </div>

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>이메일</span>
                            <span className={styles.viewModalValue}>{selectedUser.email_display || '-'}</span>
                        </div>

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>주소</span>
                            <span className={styles.viewModalValue}>
                                {selectedUser.address && selectedUser.address_detail
                                    ? `${selectedUser.address} ${selectedUser.address_detail}`
                                    : selectedUser.address || selectedUser.address_detail || '-'}
                            </span>
                        </div>

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>소속</span>
                            <span className={styles.viewModalValue}>{selectedUser.company_name || '-'}</span>
                        </div>

                        {selectedUser.position?.level !== 1 && (
                            <div className={styles.viewModalItem}>
                                <span className={styles.viewModalLabel}>상태</span>
                                <span
                                    className={`${styles.viewModalStatusBadge} ${selectedUser.status === 'active' ? styles.active : styles.inactive}`}
                                    onClick={handleToggleStatusInModal}
                                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                                >
                                    {selectedUser.status === 'active' ? '활성' : '비활성'}
                                </span>
                            </div>
                        )}

                        <button
                            className={styles.viewModalCloseButton}
                            onClick={() => {
                                setViewModalOpen(false);
                                setSelectedUser(null);
                            }}
                        >
                            닫기
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
