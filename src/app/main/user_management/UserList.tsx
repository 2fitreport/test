'use client';

import { useEffect, useState, forwardRef, useImperativeHandle, useRef } from 'react';
import Image from 'next/image';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import Modal from '@/app/components/Modal/Modal';
import Pagination from '@/app/components/Pagination/Pagination';
import CreateUserModal from './CreateUserModal';
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
    created_at?: string;
    password?: string;
}

type SortColumn = 'user_id' | 'name' | 'position' | 'phone' | 'email_display' | 'address' | 'company_name' | 'status' | 'created_at';
type SortOrder = 'asc' | 'desc';

interface Position {
    id: number;
    name: string;
    level: number;
}

interface CreateUserForm {
    user_id: string;
    name: string;
    position_id: number;
    password: string;
    phone: string;
    email_display: string;
    address: string;
    address_detail: string;
    company_name: string;
    status: 'active' | 'inactive';
}

interface UserListHandle {
    openCreateModal: () => void;
}

const UserList = forwardRef<UserListHandle>(function UserList(_, ref) {
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
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingUserId, setEditingUserId] = useState<number | null>(null);
    const [originalUserId, setOriginalUserId] = useState<string>('');
    const [createFormData, setCreateFormData] = useState<CreateUserForm>({
        user_id: '',
        name: '',
        position_id: 0,
        password: '',
        phone: '',
        email_display: '',
        address: '',
        address_detail: '',
        company_name: '',
        status: 'active',
    });
    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [validationErrorModalOpen, setValidationErrorModalOpen] = useState(false);
    const [validationErrorMessage, setValidationErrorMessage] = useState('');
    const [showRepresentativeWarning, setShowRepresentativeWarning] = useState(false);
    const [duplicateUserIdModalOpen, setDuplicateUserIdModalOpen] = useState(false);
    const userIdRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const positionRef = useRef<HTMLSelectElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
        openCreateModal: () => {
            setCreateModalOpen(true);
            setErrors({});
            // 모달 스크롤을 맨 위로
            setTimeout(() => {
                const modalOverlay = document.querySelector(`.${styles.createModalOverlay}`) as HTMLElement;
                if (modalOverlay) {
                    modalOverlay.scrollTop = 0;
                }
                const confirmButton = document.querySelector(`.${styles.createSubmitButton}`) as HTMLButtonElement;
                confirmButton?.focus();
            }, 0);
        },
    }));

    const validateField = (fieldName: string, value: string | number): string => {
        switch (fieldName) {
            case 'user_id':
                if (!value) return '사용자 ID를 입력해주세요.';
                if (String(value).length < 5) {
                    return '5글자 이상으로 입력해주세요.';
                }
                if (String(value).length > 10) {
                    return '10글자 이하로 입력해주세요.';
                }
                if (!/^[a-zA-Z0-9_-]+$/.test(String(value))) {
                    return '영문, 숫자, 밑줄, 하이픈만 허용됩니다.';
                }
                const hasLetter = /[a-zA-Z]/.test(String(value));
                const hasNumber = /[0-9]/.test(String(value));
                if (!hasLetter || !hasNumber) {
                    return '영문과 숫자를 함께 포함해야 합니다.';
                }
                return '';
            case 'password':
                if (!value) return '비밀번호를 입력해주세요.';
                return '';
            case 'name':
                if (!value) return '이름을 입력해주세요.';
                if (String(value).length > 6) {
                    return '6글자 이하로 입력해주세요.';
                }
                return '';
            case 'position_id':
                if (!value) return '직급을 선택해주세요.';
                return '';
            case 'phone':
                if (!value) return '전화번호를 입력해주세요.';
                return '';
            case 'email_display':
                if (!value) return '이메일을 입력해주세요.';
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
                    return '유효한 이메일 형식이 아닙니다.';
                }
                return '';
            case 'company_name':
                if (!value) return '소속을 입력해주세요.';
                if (String(value).length > 10) {
                    return '10글자 이하로 입력해주세요.';
                }
                return '';
            default:
                return '';
        }
    };

    const handleFieldBlur = (fieldName: string) => {
        const value = createFormData[fieldName as keyof CreateUserForm];
        const error = validateField(fieldName, value);
        setErrors(prev => ({
            ...prev,
            [fieldName]: error,
        }));
    };

    useEffect(() => {
        fetchUsers();
        fetchPositions();
    }, []);

    useEffect(() => {
        if (validationErrorModalOpen) {
            // 유효성 검사 에러 모달이 열렸을 때 확인 버튼에 포커스
            setTimeout(() => {
                const confirmButton = document.querySelector('button[type="button"]') as HTMLButtonElement;
                if (confirmButton && confirmButton.textContent?.includes('확인')) {
                    confirmButton.focus();
                }
            }, 100);
        }
    }, [validationErrorModalOpen]);

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

    const handleCheckDuplicateUserId = async (userId: string): Promise<boolean> => {
        try {
            const response = await fetch(`/api/users/check-duplicate?user_id=${encodeURIComponent(userId)}`);
            const data = await response.json();
            return data.exists || false;
        } catch (error) {
            console.error('중복확인 실패:', error);
            return false;
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
            } else if (sortColumn === 'created_at') {
                // created_at은 날짜로 정렬
                aValue = a.created_at ? new Date(a.created_at).getTime() : 0;
                bValue = b.created_at ? new Date(b.created_at).getTime() : 0;
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
        const userToDelete = users.find(u => u.id === userId);

        // 대표(position.level === 1)는 삭제 불가
        if (userToDelete && userToDelete.position?.level === 1) {
            setShowRepresentativeWarning(true);
            return;
        }

        setPendingDeleteId(userId);
        setIsModalOpen(true);
        setPendingStatusChange(null);
    };

    const handleViewUser = (user: User) => {
        setSelectedUser(user);
        setViewModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setIsEditMode(true);
        setEditingUserId(user.id);
        setOriginalUserId(user.user_id);
        setCreateFormData({
            user_id: user.user_id,
            name: user.name,
            position_id: user.position?.id || 0,
            password: user.password || '',
            phone: user.phone || '',
            email_display: user.email_display || '',
            address: user.address || '',
            address_detail: user.address_detail || '',
            company_name: user.company_name || '',
            status: user.status as 'active' | 'inactive',
        });
        setErrors({});
        setCreateModalOpen(true);
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
            const deletePromises = Array.from(selectedUsers).map(userId =>
                fetch(`/api/users/${userId}`, {
                    method: 'DELETE',
                })
            );

            const responses = await Promise.all(deletePromises);

            for (const response of responses) {
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
            const usersToDelete = users.filter(user => user.position?.level !== 1);
            const deletePromises = usersToDelete.map(user =>
                fetch(`/api/users/${user.id}`, {
                    method: 'DELETE',
                })
            );

            const responses = await Promise.all(deletePromises);

            for (const response of responses) {
                if (!response.ok) {
                    throw new Error('사용자 삭제 실패');
                }
            }

            fetchUsers();
            setSelectedUsers(new Set());
            setIsModalOpen(false);
            setIsDeleteAllMode(false);
            setSuccessMessage(`${usersToDelete.length}명의 사용자가 삭제되었습니다.`);
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
        <>
            <Modal
                isOpen={showRepresentativeWarning}
                message="대표는 삭제할 수 없습니다."
                onClose={() => setShowRepresentativeWarning(false)}
                type="error"
                showConfirmButton={false}
            />
            <Modal
                isOpen={duplicateUserIdModalOpen}
                message="이미 존재하는 사용자 ID입니다."
                onClose={() => setDuplicateUserIdModalOpen(false)}
                type="error"
                showConfirmButton={false}
            />
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
                                <option value="created_at-desc">가입순 (최신)</option>
                                <option value="created_at-asc">가입순 (오래된)</option>
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
                                        <button
                                            className={styles.editButton}
                                            onClick={() => handleEditUser(user)}
                                        >
                                            수정
                                        </button>
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
                type="warning"
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

            <Modal
                isOpen={validationErrorModalOpen}
                message={validationErrorMessage}
                onClose={() => setValidationErrorModalOpen(false)}
                type="error"
                confirmText="확인"
                showConfirmButton={false}
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
                        <div className={styles.viewModalTitleWrapper}>
                            <h3 className={styles.viewModalTitle}>사용자 정보</h3>
                            <button
                                className={styles.viewModalCloseButton}
                                onClick={() => {
                                    setViewModalOpen(false);
                                    setSelectedUser(null);
                                }}
                                type="button"
                            >
                                ×
                            </button>
                        </div>

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

                        <div className={styles.viewModalItem}>
                            <span className={styles.viewModalLabel}>생성날짜</span>
                            <span className={styles.viewModalValue}>
                                {selectedUser.created_at
                                    ? new Date(selectedUser.created_at).toLocaleDateString('ko-KR', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit'
                                    })
                                    : '-'}
                            </span>
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
                    </div>
                </div>
            )}

            <CreateUserModal
                isOpen={createModalOpen}
                isEditMode={isEditMode}
                createFormData={createFormData}
                setCreateFormData={setCreateFormData}
                errors={errors}
                setErrors={setErrors}
                onClose={() => {
                    setCreateModalOpen(false);
                    setIsEditMode(false);
                    setEditingUserId(null);
                    setOriginalUserId('');
                    setCreateFormData({
                        user_id: '',
                        name: '',
                        position_id: 0,
                        password: '',
                        phone: '',
                        email_display: '',
                        address: '',
                        address_detail: '',
                        company_name: '',
                        status: 'active',
                    });
                    setErrors({});
                }}
                onSubmit={async (isDuplicateUserIdChecked: boolean, isDuplicateUserIdExists: boolean) => {
                    // ID가 변경되었거나 새로 생성할 때 중복확인 검사
                    const userIdChanged = isEditMode && createFormData.user_id !== originalUserId;
                    const needsDuplicateCheck = !isEditMode || userIdChanged;

                    if (needsDuplicateCheck) {
                        if (!isDuplicateUserIdChecked) {
                            setValidationErrorMessage('ID 중복확인을 해주세요.');
                            setValidationErrorModalOpen(true);
                            return;
                        }

                        if (isDuplicateUserIdExists) {
                            setValidationErrorMessage('이미 존재하는 사용자 ID입니다.');
                            setValidationErrorModalOpen(true);
                            return;
                        }
                    }

                    // 각 필드별 유효성 검사
                    const newErrors: { [key: string]: string } = {};
                    let firstErrorField: string | null = null;
                    let firstErrorMessage: string = '';

                    if (!createFormData.user_id) {
                        newErrors.user_id = '사용자 ID를 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'user_id';
                            firstErrorMessage = '사용자 ID를 입력해주세요.<br>(영문과 숫자 결합, 5~10글자)';
                        }
                    } else if (createFormData.user_id.length < 5) {
                        newErrors.user_id = '5글자 이상으로 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'user_id';
                            firstErrorMessage = '사용자 ID는<br>5글자 이상이어야 합니다.';
                        }
                    } else if (createFormData.user_id.length > 10) {
                        newErrors.user_id = '10글자 이하로 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'user_id';
                            firstErrorMessage = '사용자 ID는<br>10글자 이하여야 합니다.';
                        }
                    } else if (!/^[a-zA-Z0-9_-]+$/.test(createFormData.user_id)) {
                        newErrors.user_id = '영문, 숫자, 밑줄, 하이픈만 허용됩니다.';
                        if (!firstErrorField) {
                            firstErrorField = 'user_id';
                            firstErrorMessage = '사용자 ID는<br>영문, 숫자, 밑줄, 하이픈만 허용됩니다.';
                        }
                    } else {
                        const hasLetter = /[a-zA-Z]/.test(createFormData.user_id);
                        const hasNumber = /[0-9]/.test(createFormData.user_id);
                        if (!hasLetter || !hasNumber) {
                            newErrors.user_id = '영문과 숫자를 함께 포함해야 합니다.';
                            if (!firstErrorField) {
                                firstErrorField = 'user_id';
                                firstErrorMessage = '사용자 ID는<br>영문과 숫자를 함께 포함해야 합니다.';
                            }
                        }
                    }
                    if (!isEditMode && !createFormData.password) {
                        newErrors.password = '비밀번호를 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'password';
                            firstErrorMessage = '비밀번호를 입력해주세요.';
                        }
                    }
                    if (!createFormData.name) {
                        newErrors.name = '이름을 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'name';
                            firstErrorMessage = '이름을 입력해주세요. (6글자 이하)';
                        }
                    } else if (createFormData.name.length > 6) {
                        newErrors.name = '6글자 이하로 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'name';
                            firstErrorMessage = '이름은 6글자 이하여야 합니다.';
                        }
                    }
                    if (!createFormData.position_id) {
                        newErrors.position_id = '직급을 선택해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'position_id';
                            firstErrorMessage = '직급을 선택해주세요.';
                        }
                    }
                    if (!createFormData.phone) {
                        newErrors.phone = '전화번호를 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'phone';
                            firstErrorMessage = '전화번호를 입력해주세요.<br> (010-XXXX-XXXX 형식)';
                        }
                    }
                    if (!createFormData.email_display) {
                        newErrors.email_display = '이메일을 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'email_display';
                            firstErrorMessage = '이메일을 입력해주세요.<br> (예: example@domain.com)';
                        }
                    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createFormData.email_display)) {
                        newErrors.email_display = '유효한 이메일 형식이 아닙니다.';
                        if (!firstErrorField) {
                            firstErrorField = 'email_display';
                            firstErrorMessage = '유효한 이메일 형식이 아닙니다.<br> (예: example@domain.com)';
                        }
                    }
                    if (!createFormData.company_name) {
                        newErrors.company_name = '소속을 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'company_name';
                            firstErrorMessage = '소속을 입력해주세요. (10글자 이하)';
                        }
                    } else if (createFormData.company_name.length > 10) {
                        newErrors.company_name = '10글자 이하로 입력해주세요.';
                        if (!firstErrorField) {
                            firstErrorField = 'company_name';
                            firstErrorMessage = '소속은 10글자 이하여야 합니다.';
                        }
                    }

                    if (Object.keys(newErrors).length > 0) {
                        setErrors(newErrors);
                        setValidationErrorMessage(firstErrorMessage);
                        setValidationErrorModalOpen(true);
                        // 첫 번째 에러 필드에 포커스
                        if (firstErrorField === 'user_id') userIdRef.current?.focus();
                        else if (firstErrorField === 'password') passwordRef.current?.focus();
                        else if (firstErrorField === 'name') nameRef.current?.focus();
                        else if (firstErrorField === 'position_id') positionRef.current?.focus();
                        else if (firstErrorField === 'email_display') emailRef.current?.focus();
                        return;
                    }

                    try {
                        const url = isEditMode ? `/api/users/${editingUserId}` : '/api/users';
                        const method = isEditMode ? 'PATCH' : 'POST';
                        const response = await fetch(url, {
                            method,
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(createFormData),
                        });

                        if (!response.ok) {
                            const data = await response.json();
                            throw new Error(data.message || (isEditMode ? '사용자 수정 실패' : '사용자 생성 실패'));
                        }

                        setCreateModalOpen(false);
                        setIsEditMode(false);
                        setEditingUserId(null);
                        setCreateFormData({
                            user_id: '',
                            name: '',
                            position_id: 0,
                            password: '',
                            phone: '',
                            email_display: '',
                            address: '',
                            address_detail: '',
                            company_name: '',
                            status: 'active',
                        });
                        fetchUsers();
                        setSuccessMessage(isEditMode ? '사용자가 수정되었습니다.' : '사용자가 생성되었습니다.');
                        setSuccessModalOpen(true);
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : '사용자 생성 실패';
                        if (errorMessage.includes('이미 존재') || errorMessage.includes('duplicate') || errorMessage.includes('Duplicate')) {
                            setDuplicateUserIdModalOpen(true);
                        } else {
                            setErrorMessage(errorMessage);
                            setErrorModalOpen(true);
                        }
                    }
                }}
                positions={positions}
                userIdRef={userIdRef}
                passwordRef={passwordRef}
                nameRef={nameRef}
                positionRef={positionRef}
                emailRef={emailRef}
                handleFieldBlur={handleFieldBlur}
                onCheckDuplicateUserId={handleCheckDuplicateUserId}
            />
        </div>
        </>
    );
});

export default UserList;
