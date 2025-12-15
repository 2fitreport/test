'use client';

import { useEffect, useState, forwardRef } from 'react';
import Image from 'next/image';
import Pagination from '@/app/components/Pagination/Pagination';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import TimeAgo from './TimeAgo';
import styles from './documentSubmissionList.module.css';
import modalStyles from '@/app/components/Modal/Modal.module.css';

interface Document {
    id: number;
    user_id: string;
    user_name: string;
    document_type: string;
    title: string;
    status: 'submitted' | 'pending' | 'rejected';
    progress_status: 'in_progress' | 'stopped' | 'not_started';
    submitted_date: string;
    reason?: string;
    reason_read: boolean;
}

type SortColumn = 'user_id' | 'user_name' | 'document_type' | 'title' | 'status' | 'submitted_date';
type SortOrder = 'asc' | 'desc';

const DocumentSubmissionList = forwardRef<any>(function DocumentSubmissionList(_, ref) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState<SortColumn>('submitted_date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'pending' | 'rejected'>('all');
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [pendingAction, setPendingAction] = useState<{ id: number; action: 'start' | 'stop' | 'delete' } | null>(null);
    const [reasonModalOpen, setReasonModalOpen] = useState(false);
    const [selectedReason, setSelectedReason] = useState<{ id: number; reason: string } | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleProgressStart = (id: number) => {
        setPendingAction({ id, action: 'start' });
        setConfirmMessage('서류 진행을 시작하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleProgressStop = (id: number) => {
        setPendingAction({ id, action: 'stop' });
        setConfirmMessage('서류 진행을 중지하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleProgressDelete = (id: number) => {
        setPendingAction({ id, action: 'delete' });
        setConfirmMessage('이 서류를 삭제하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleConfirmAction = () => {
        if (!pendingAction) return;

        const { id, action } = pendingAction;

        if (action === 'start') {
            setDocuments(docs =>
                docs.map(doc =>
                    doc.id === id ? { ...doc, progress_status: 'in_progress' as const } : doc
                )
            );
            setSuccessMessage('서류 진행이 시작되었습니다.');
        } else if (action === 'stop') {
            setDocuments(docs =>
                docs.map(doc =>
                    doc.id === id ? { ...doc, progress_status: 'stopped' as const } : doc
                )
            );
            setSuccessMessage('서류 진행이 중지되었습니다.');
        } else if (action === 'delete') {
            setDocuments(docs => docs.filter(doc => doc.id !== id));
            setSuccessMessage('서류가 삭제되었습니다.');
        }

        setConfirmModalOpen(false);
        setPendingAction(null);
        setSuccessModalOpen(true);
    };

    const fetchDocuments = async () => {
        try {
            // 더미 데이터
            const dummyDocuments: Document[] = [
                {
                    id: 1,
                    user_id: 'user001',
                    user_name: '김철수',
                    document_type: '증명서',
                    title: '직원 경력 증명서',
                    status: 'submitted',
                    progress_status: 'in_progress',
                    submitted_date: '2025-12-10',
                    reason: '다음에는 조금 더 상세한 내용으로 작성해주세요.',
                    reason_read: false,
                },
                {
                    id: 2,
                    user_id: 'user002',
                    user_name: '이영희',
                    document_type: '계약서',
                    title: '2025년 계약서',
                    status: 'pending',
                    progress_status: 'stopped',
                    submitted_date: '2025-12-13',
                    reason_read: true,
                },
                {
                    id: 3,
                    user_id: 'user003',
                    user_name: '박민수',
                    document_type: '이력서',
                    title: '박민수 이력서',
                    status: 'rejected',
                    progress_status: 'not_started',
                    submitted_date: '2025-12-05',
                    reason: '서명란이 누락되어 있습니다. 다시 제출해주세요.',
                    reason_read: true,
                },
                {
                    id: 4,
                    user_id: 'user001',
                    user_name: '김철수',
                    document_type: '이력서',
                    title: '최신 이력서 (2025)',
                    status: 'submitted',
                    progress_status: 'in_progress',
                    submitted_date: '2025-12-08',
                    reason: '보안 정보를 더 강화해주시기 바랍니다.',
                    reason_read: false,
                },
                {
                    id: 5,
                    user_id: 'user004',
                    user_name: '정수진',
                    document_type: '증명서',
                    title: '재직 및 급여 증명서',
                    status: 'pending',
                    progress_status: 'not_started',
                    submitted_date: '2025-12-14',
                    reason_read: true,
                },
            ];
            setDocuments(dummyDocuments);
        } catch (error) {
            console.error('서류 목록 조회 실패:', error);
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

    const getFilteredAndSortedDocuments = () => {
        let filtered = documents.filter(doc => {
            if (statusFilter !== 'all' && doc.status !== statusFilter) {
                return false;
            }
            const query = searchQuery.toLowerCase();
            return (
                doc.user_id.toLowerCase().includes(query) ||
                doc.user_name.toLowerCase().includes(query) ||
                doc.document_type.toLowerCase().includes(query)
            );
        });

        const sorted = [...filtered].sort((a, b) => {
            let aValue: any = a[sortColumn];
            let bValue: any = b[sortColumn];

            if (typeof aValue === 'string' && typeof bValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        return sorted;
    };

    const getPaginatedDocuments = () => {
        const filtered = getFilteredAndSortedDocuments();
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return filtered.slice(startIndex, endIndex);
    };

    const getSortIcon = (column: SortColumn) => {
        const isActive = sortColumn === column;
        return (
            <span className={styles.sortIcon}>
                <span className={isActive && sortOrder === 'asc' ? styles.active : ''}>↑</span>
                <span className={isActive && sortOrder === 'desc' ? styles.active : ''}>↓</span>
            </span>
        );
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'submitted':
                return '승인됨';
            case 'pending':
                return '대기중';
            case 'rejected':
                return '반려됨';
            default:
                return status;
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'submitted':
                return styles.submitted;
            case 'pending':
                return styles.pending;
            case 'rejected':
                return styles.rejected;
            default:
                return '';
        }
    };

    if (loading) {
        return <div className={styles.loading}>로딩 중...</div>;
    }

    return (
        <>
            <div className={styles.documentListContainer}>
                <div className={styles.header}>
                    <h2>서류 목록</h2>
                    <span className={styles.count}>총 {getFilteredAndSortedDocuments().length}건</span>
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
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                        />
                    </div>

                    <div className={styles.filtersContainer}>
                        <div className={styles.itemsPerPageContainer}>
                            <label className={styles.itemsLabel}>상태:</label>
                            <div className={styles.selectWrapper}>
                                <select
                                    className={styles.itemsSelect}
                                    value={statusFilter}
                                    onChange={(e) => {
                                        setStatusFilter(e.target.value as any);
                                        setCurrentPage(1);
                                    }}
                                >
                                    <option value="all">전체</option>
                                    <option value="submitted">승인됨</option>
                                    <option value="pending">대기중</option>
                                    <option value="rejected">반려됨</option>
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
                                    <option value="submitted_date-desc">제출일 (최신)</option>
                                    <option value="submitted_date-asc">제출일 (오래된)</option>
                                    <option value="user_id-asc">사용자 ID (A-Z)</option>
                                    <option value="user_id-desc">사용자 ID (Z-A)</option>
                                    <option value="user_name-asc">이름 (A-Z)</option>
                                    <option value="user_name-desc">이름 (Z-A)</option>
                                    <option value="document_type-asc">서류 유형 (A-Z)</option>
                                    <option value="document_type-desc">서류 유형 (Z-A)</option>
                                    <option value="status-asc">상태 (A-Z)</option>
                                    <option value="status-desc">상태 (Z-A)</option>
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
                </div>

                <div className={styles.tableWrapper}>
                    {getFilteredAndSortedDocuments().length === 0 ? (
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
                        <table className={styles.documentTable}>
                            <thead>
                                <tr>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('user_id')}>
                                        사용자 ID{getSortIcon('user_id')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('user_name')}>
                                        이름{getSortIcon('user_name')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('title')}>
                                        제목{getSortIcon('title')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('document_type')}>
                                        서류 유형{getSortIcon('document_type')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('status')}>
                                        상태{getSortIcon('status')}
                                    </th>
                                    <th>사유</th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('submitted_date')}>
                                        제출일{getSortIcon('submitted_date')}
                                    </th>
                                    <th>시간 경과</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getPaginatedDocuments().map((doc) => (
                                    <tr key={doc.id} className={styles.documentRow}>
                                        <td className={styles.userId}>{doc.user_id}</td>
                                        <td className={styles.userName}>{doc.user_name}</td>
                                        <td className={styles.title}>{doc.title}</td>
                                        <td className={styles.documentType}>{doc.document_type}</td>
                                        <td className={styles.status}>
                                            <span className={`${styles.statusBadge} ${getStatusBadgeClass(doc.status)}`}>
                                                {getStatusLabel(doc.status)}
                                            </span>
                                        </td>
                                        <td className={styles.reasonCell}>
                                            {doc.reason ? (
                                                <button
                                                    className={`${styles.reasonButton} ${!doc.reason_read ? styles.unreadButton : ''}`}
                                                    onClick={() => {
                                                        setSelectedReason({ id: doc.id, reason: doc.reason! });
                                                        setReasonModalOpen(true);
                                                        setDocuments(docs =>
                                                            docs.map(d =>
                                                                d.id === doc.id ? { ...d, reason_read: true } : d
                                                            )
                                                        );
                                                    }}
                                                >
                                                    사유 보기
                                                </button>
                                            ) : (
                                                <span className={styles.noReason}>없음</span>
                                            )}
                                        </td>
                                        <td className={styles.date}>{doc.submitted_date}</td>
                                        <td className={styles.timeAgo}>
                                            <TimeAgo dateString={doc.submitted_date} />
                                        </td>
                                        <td className={styles.actions}>
                                            {doc.progress_status === 'not_started' && (
                                                <button
                                                    className={styles.startButton}
                                                    onClick={() => handleProgressStart(doc.id)}
                                                >
                                                    진행
                                                </button>
                                            )}
                                            {doc.progress_status === 'in_progress' && (
                                                <button
                                                    className={styles.stopButton}
                                                    onClick={() => handleProgressStop(doc.id)}
                                                >
                                                    중지
                                                </button>
                                            )}
                                            {doc.progress_status === 'stopped' && (
                                                <button
                                                    className={styles.startButton}
                                                    onClick={() => handleProgressStart(doc.id)}
                                                >
                                                    재시작
                                                </button>
                                            )}
                                            <button
                                                className={styles.deleteButton}
                                                onClick={() => handleProgressDelete(doc.id)}
                                            >
                                                삭제
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
                    totalItems={getFilteredAndSortedDocuments().length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                />

                <ConfirmModal
                    isOpen={confirmModalOpen}
                    message={confirmMessage}
                    onClose={() => {
                        setConfirmModalOpen(false);
                        setPendingAction(null);
                    }}
                    onConfirm={handleConfirmAction}
                    type="warning"
                    confirmText="확인"
                    cancelText="취소"
                />

                {reasonModalOpen && selectedReason && (
                    <div className={styles.reasonModalOverlay} onClick={() => {
                        setReasonModalOpen(false);
                        setSelectedReason(null);
                    }}>
                        <div className={styles.reasonModalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.reasonModalHeader}>
                                <h3 className={styles.reasonModalTitle}>사유</h3>
                                <button
                                    className={styles.reasonModalCloseButton}
                                    onClick={() => {
                                        setReasonModalOpen(false);
                                        setSelectedReason(null);
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                            <div className={styles.reasonModalBody}>
                                <p className={styles.reasonText}>{selectedReason.reason}</p>
                            </div>
                            <div className={styles.reasonModalFooter}>
                                <button
                                    className={styles.reasonConfirmButton}
                                    onClick={() => {
                                        setReasonModalOpen(false);
                                        setSelectedReason(null);
                                    }}
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {successModalOpen && (
                    <div className={modalStyles.overlay} onClick={() => {
                        setSuccessModalOpen(false);
                        setSuccessMessage('');
                    }}>
                        <div className={`${modalStyles.modal} ${modalStyles.success}`} onClick={(e) => e.stopPropagation()}>
                            <div className={modalStyles.content}>
                                <div className={modalStyles.iconWrapper}>
                                    <img src="/check.svg" alt="success" className={modalStyles.icon} />
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
            </div>
        </>
    );
});

export default DocumentSubmissionList;
