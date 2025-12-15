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
    status: 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped';
    progress_status: 'in_progress' | 'stopped' | 'not_started';
    submitted_date: string;
    completed_date?: string;
    progress_start_date?: string;
    progress_end_time?: string;
    stopped_time?: string;
    reason?: string;
    reason_read: boolean;
}

type SortColumn = 'user_id' | 'user_name' | 'title' | 'status' | 'submitted_date' | 'reason' | 'completed_date' | 'progress_start_date';
type SortOrder = 'asc' | 'desc';

const DocumentSubmissionList = forwardRef<any>(function DocumentSubmissionList(_, ref) {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState<SortColumn>('submitted_date');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped'>('all');
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [pendingAction, setPendingAction] = useState<{ id: number; action: 'start' | 'stop' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' } | null>(null);
    const [reasonModalOpen, setReasonModalOpen] = useState(false);
    const [selectedReason, setSelectedReason] = useState<{ id: number; reason: string } | null>(null);
    const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
    const [isDeleteAllMode, setIsDeleteAllMode] = useState(false);
    const [reasonInputModalOpen, setReasonInputModalOpen] = useState(false);
    const [reasonInput, setReasonInput] = useState('');
    const [pendingReasonAction, setPendingReasonAction] = useState<{ id: number; action: 'reject' | 'revision' } | null>(null);

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleProgressStart = (id: number) => {
        setPendingAction({ id, action: 'start' });
        setConfirmMessage('서류 진행을 시작하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleApprove = (id: number) => {
        setPendingAction({ id, action: 'approve' });
        setConfirmMessage('서류를 승인하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleReject = (id: number) => {
        setPendingReasonAction({ id, action: 'reject' });
        setReasonInput('');
        setReasonInputModalOpen(true);
    };

    const handleRevision = (id: number) => {
        setPendingReasonAction({ id, action: 'revision' });
        setReasonInput('');
        setReasonInputModalOpen(true);
    };

    const handleSubmit = (id: number) => {
        setPendingAction({ id, action: 'submit' });
        setConfirmMessage('서류를 제출하시겠습니까?');
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

    const handleConfirmAction = async () => {
        // 전체 삭제 모드 처리
        if (isDeleteAllMode) {
            const allDocs = getFilteredAndSortedDocuments();
            setDocuments(docs => docs.filter(doc => !allDocs.some(d => d.id === doc.id)));
            setSelectedDocuments(new Set());
            setIsDeleteAllMode(false);
            setSuccessMessage(`${allDocs.length}건의 서류가 삭제되었습니다.`);
            setConfirmModalOpen(false);
            setSuccessModalOpen(true);
            return;
        }

        // 선택 삭제 모드 처리
        if (selectedDocuments.size > 0 && !pendingAction) {
            const count = selectedDocuments.size;
            setDocuments(docs => docs.filter(doc => !selectedDocuments.has(doc.id)));
            setSelectedDocuments(new Set());
            setSuccessMessage(`${count}건의 서류가 삭제되었습니다.`);
            setConfirmModalOpen(false);
            setSuccessModalOpen(true);
            return;
        }

        if (!pendingAction) return;

        const { id, action } = pendingAction;
        const now = new Date();
        const timeString = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        if (action === 'start') {
            setDocuments(docs =>
                docs.map(doc =>
                    doc.id === id ? {
                        ...doc,
                        status: 'in_progress' as const,
                        progress_status: 'in_progress' as const,
                        progress_start_date: now.toISOString()
                    } : doc
                )
            );
            setSuccessMessage('서류 진행이 시작되었습니다.');
        } else if (action === 'approve') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id && (doc.status === 'in_progress' || doc.status === 'submitted') && doc.progress_start_date) {
                        const startTime = new Date(doc.progress_start_date);
                        const endTime = new Date();
                        const diffMs = endTime.getTime() - startTime.getTime();
                        const hours = Math.floor(diffMs / (1000 * 60 * 60));
                        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

                        const timeDisplay = `${hours}시간${minutes}분 ${String(seconds).padStart(2, '0')}초`;

                        return {
                            ...doc,
                            status: 'approved' as const,
                            progress_status: 'stopped' as const,
                            progress_end_time: timeDisplay,
                            completed_date: new Date().toISOString().split('T')[0].replace(/(\d{4})-(\d{2})-(\d{2})/, '25-$2-$3')
                        };
                    }
                    return doc;
                })
            );
            setSuccessMessage('서류가 승인되었습니다.');
        } else if (action === 'reject') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id && (doc.status === 'in_progress' || doc.status === 'submitted' || doc.status === 'stopped')) {
                        return {
                            ...doc,
                            status: 'rejected' as const,
                            progress_status: 'not_started' as const,
                            reason: reasonInput || '사유 없음',
                            reason_read: false
                        };
                    }
                    return doc;
                })
            );
            setSuccessMessage('서류가 반려되었습니다.');
        } else if (action === 'revision') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id && (doc.status === 'in_progress' || doc.status === 'submitted' || doc.status === 'stopped')) {
                        return {
                            ...doc,
                            status: 'revision' as const,
                            progress_status: 'not_started' as const,
                            reason: reasonInput || '사유 없음',
                            reason_read: false
                        };
                    }
                    return doc;
                })
            );
            setSuccessMessage('서류 보완이 요청되었습니다.');
        } else if (action === 'submit') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id) {
                        return {
                            ...doc,
                            status: 'submitted' as const,
                            progress_status: 'not_started' as const
                        };
                    }
                    return doc;
                })
            );
            setSuccessMessage('서류가 제출되었습니다.');
        } else if (action === 'stop') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id && doc.progress_start_date) {
                        const startTime = new Date(doc.progress_start_date);
                        const stopTime = new Date();
                        const diffMs = stopTime.getTime() - startTime.getTime();
                        const totalSeconds = Math.floor(diffMs / 1000);
                        const hours = Math.floor(totalSeconds / 3600);
                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                        const seconds = totalSeconds % 60;

                        const formattedHours = String(hours).padStart(2, '0');
                        const formattedMinutes = String(minutes).padStart(2, '0');
                        const formattedSeconds = String(seconds).padStart(2, '0');
                        const timeDisplay = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;

                        return {
                            ...doc,
                            status: 'stopped' as const,
                            progress_status: 'stopped' as const,
                            stopped_time: timeDisplay
                        };
                    }
                    return doc;
                })
            );
            setSuccessMessage('서류 진행이 중지되었습니다.');
        } else if (action === 'delete') {
            setDocuments(docs => docs.filter(doc => doc.id !== id));
            setSuccessMessage('서류가 삭제되었습니다.');
        }

        setConfirmModalOpen(false);
        setPendingAction(null);
        setReasonInput('');
        setPendingReasonAction(null);
        setSuccessModalOpen(true);

        // 데이터베이스에 저장
        const updatedDoc = documents.find(doc => doc.id === id);
        if (updatedDoc && action !== 'delete') {
            await saveDocumentToDatabase(updatedDoc);
        } else if (action === 'delete') {
            await deleteDocumentFromDatabase(id);
        }
    };

    const saveDocumentToDatabase = async (document: Document) => {
        try {
            const response = await fetch(`/api/documents/${document.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(document),
            });

            if (!response.ok) {
                console.error('데이터베이스 저장 실패');
            }
        } catch (error) {
            console.error('데이터베이스 저장 오류:', error);
        }
    };

    const deleteDocumentFromDatabase = async (docId: number) => {
        try {
            const response = await fetch(`/api/documents/${docId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                console.error('데이터베이스 삭제 실패');
            }
        } catch (error) {
            console.error('데이터베이스 삭제 오류:', error);
        }
    };

    const fetchDocuments = async () => {
        try {
            const response = await fetch('/api/documents');
            if (!response.ok) {
                throw new Error('서류 목록 조회 실패');
            }
            const data = await response.json();
            setDocuments(data);
        } catch (error) {
            console.error('서류 목록 조회 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectDocument = (docId: number) => {
        const newSelected = new Set(selectedDocuments);
        if (newSelected.has(docId)) {
            newSelected.delete(docId);
        } else {
            newSelected.add(docId);
        }
        setSelectedDocuments(newSelected);
    };

    const handleSelectAll = () => {
        const paginatedDocs = getPaginatedDocuments();
        const allCurrentPageSelected = paginatedDocs.every(doc => selectedDocuments.has(doc.id));

        if (allCurrentPageSelected && paginatedDocs.length > 0) {
            const newSelected = new Set(selectedDocuments);
            paginatedDocs.forEach(doc => newSelected.delete(doc.id));
            setSelectedDocuments(newSelected);
        } else {
            const newSelected = new Set(selectedDocuments);
            paginatedDocs.forEach(doc => newSelected.add(doc.id));
            setSelectedDocuments(newSelected);
        }
    };

    const handleDeleteAll = () => {
        setIsDeleteAllMode(true);
        setConfirmMessage(`전체 서류(${getFilteredAndSortedDocuments().length}건)를 삭제하시겠습니까?`);
        setConfirmModalOpen(true);
    };

    const handleDeleteSelected = () => {
        if (selectedDocuments.size === 0) return;
        setIsDeleteAllMode(false);
        setPendingAction(null);
        setConfirmMessage(`선택된 ${selectedDocuments.size}건의 서류를 삭제하시겠습니까?`);
        setConfirmModalOpen(true);
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
                doc.user_name.toLowerCase().includes(query)
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

    const getStatusCounts = () => {
        const counts = {
            all: documents.length,
            waiting: 0,
            in_progress: 0,
            approved: 0,
            revision: 0,
            rejected: 0,
            submitted: 0,
            stopped: 0,
        };

        documents.forEach(doc => {
            switch (doc.status) {
                case 'waiting':
                    counts.waiting++;
                    break;
                case 'in_progress':
                    counts.in_progress++;
                    break;
                case 'approved':
                    counts.approved++;
                    break;
                case 'revision':
                    counts.revision++;
                    break;
                case 'rejected':
                    counts.rejected++;
                    break;
                case 'submitted':
                    counts.submitted++;
                    break;
                case 'stopped':
                    counts.stopped++;
                    break;
            }
        });

        return counts;
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
            case 'approved':
                return '승인';
            case 'waiting':
                return '대기';
            case 'rejected':
                return '반려';
            case 'revision':
                return '보완';
            case 'in_progress':
                return '진행';
            case 'submitted':
                return '제출';
            case 'stopped':
                return '중지';
            default:
                return status;
        }
    };

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'approved':
                return styles.approved;
            case 'waiting':
                return styles.waiting;
            case 'rejected':
                return styles.rejected;
            case 'revision':
                return styles.revision;
            case 'in_progress':
                return styles.started;
            case 'submitted':
                return styles.submitted;
            case 'stopped':
                return styles.stopped;
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
                                    <option value="approved">승인</option>
                                    <option value="waiting">대기</option>
                                    <option value="rejected">반려</option>
                                    <option value="revision">보완</option>
                                    <option value="in_progress">진행</option>
                                    <option value="submitted">제출</option>
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

                <div className={styles.statsContainer}>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'all' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('all');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>전체</span>
                        <span className={styles.statCount}>{getStatusCounts().all}</span>
                    </button>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'in_progress' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('in_progress');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>진행</span>
                        <span className={styles.statCount}>{getStatusCounts().in_progress}</span>
                    </button>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'approved' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('approved');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>승인</span>
                        <span className={styles.statCount}>{getStatusCounts().approved}</span>
                    </button>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'revision' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('revision');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>보완</span>
                        <span className={styles.statCount}>{getStatusCounts().revision}</span>
                    </button>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'rejected' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('rejected');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>반려</span>
                        <span className={styles.statCount}>{getStatusCounts().rejected}</span>
                    </button>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'waiting' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('waiting');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>대기</span>
                        <span className={styles.statCount}>{getStatusCounts().waiting}</span>
                    </button>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'submitted' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('submitted');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>제출</span>
                        <span className={styles.statCount}>{getStatusCounts().submitted}</span>
                    </button>
                    <button
                        className={`${styles.statBox} ${statusFilter === 'stopped' ? styles.statBoxActive : ''}`}
                        onClick={() => {
                            setStatusFilter('stopped');
                            setCurrentPage(1);
                        }}
                    >
                        <span className={styles.statLabel}>중지</span>
                        <span className={styles.statCount}>{getStatusCounts().stopped}</span>
                    </button>
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
                        <>
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
                                    disabled={selectedDocuments.size === 0}
                                >
                                    선택 삭제 ({selectedDocuments.size})
                                </button>
                            </div>

                            <table className={styles.documentTable}>
                            <thead>
                                <tr>
                                    <th className={styles.checkboxHeader}>
                                        <input
                                            type="checkbox"
                                            checked={
                                                (() => {
                                                    const paginatedDocs = getPaginatedDocuments();
                                                    return paginatedDocs.length > 0 && paginatedDocs.every(doc => selectedDocuments.has(doc.id));
                                                })()
                                            }
                                            onChange={handleSelectAll}
                                        />
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('user_id')}>
                                        사용자 ID{getSortIcon('user_id')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('user_name')}>
                                        이름{getSortIcon('user_name')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('title')}>
                                        제목{getSortIcon('title')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('status')}>
                                        상태{getSortIcon('status')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('reason')}>
                                        사유{getSortIcon('reason')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('submitted_date')}>
                                        제출일{getSortIcon('submitted_date')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('completed_date')}>
                                        완료일{getSortIcon('completed_date')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('progress_start_date')}>
                                        시간 경과{getSortIcon('progress_start_date')}
                                    </th>
                                    <th>정보</th>
                                    <th>수정</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {getPaginatedDocuments().map((doc) => (
                                    <tr key={doc.id} className={styles.documentRow}>
                                        <td className={styles.checkboxCell}>
                                            <input
                                                type="checkbox"
                                                checked={selectedDocuments.has(doc.id)}
                                                onChange={() => handleSelectDocument(doc.id)}
                                            />
                                        </td>
                                        <td className={styles.userId}>{doc.user_id}</td>
                                        <td className={styles.userName}>{doc.user_name}</td>
                                        <td className={styles.title}>{doc.title}</td>
                                        <td className={styles.status}>
                                            <span className={`${styles.statusBadge} ${getStatusBadgeClass(doc.status)}`}>
                                                {getStatusLabel(doc.status)}
                                            </span>
                                        </td>
                                        <td className={styles.reasonCell}>
                                            {doc.reason ? (
                                                <button
                                                    className={`${styles.reasonButton} ${!doc.reason_read ? styles.unreadButton : ''}`}
                                                    onClick={async () => {
                                                        setSelectedReason({ id: doc.id, reason: doc.reason! });
                                                        setReasonModalOpen(true);
                                                        setDocuments(docs =>
                                                            docs.map(d =>
                                                                d.id === doc.id ? { ...d, reason_read: true } : d
                                                            )
                                                        );
                                                        // 데이터베이스에 읽음 상태 저장
                                                        await saveDocumentToDatabase({
                                                            ...doc,
                                                            reason_read: true
                                                        });
                                                    }}
                                                >
                                                    보기
                                                </button>
                                            ) : (
                                                <span className={styles.noReason}>없음</span>
                                            )}
                                        </td>
                                        <td className={styles.date}>{doc.submitted_date}</td>
                                        <td className={styles.completedDate}>{doc.completed_date || '-'}</td>
                                        <td className={styles.timeAgo}>
                                            {doc.status === 'stopped' && doc.stopped_time ? (
                                                <span>{doc.stopped_time}</span>
                                            ) : (doc.status === 'in_progress' || doc.status === 'revision' || doc.status === 'submitted' || doc.status === 'rejected') && doc.progress_start_date ? (
                                                <TimeAgo dateString={doc.progress_start_date} />
                                            ) : doc.status === 'approved' && doc.progress_end_time ? (
                                                <span>{doc.progress_end_time}</span>
                                            ) : (
                                                <span>-</span>
                                            )}
                                        </td>
                                        <td className={styles.infoCell}>
                                            <button
                                                className={styles.infoButton}
                                                onClick={() => {
                                                    // 정보 보기 로직
                                                }}
                                                title="정보 보기"
                                            >
                                                📋
                                            </button>
                                        </td>
                                        <td className={styles.editCell}>
                                            <button
                                                className={styles.editButton}
                                                onClick={() => {
                                                    // 수정 로직
                                                }}
                                            >
                                                수정
                                            </button>
                                        </td>
                                        <td className={styles.actions}>
                                            <button
                                                className={styles.startButton}
                                                onClick={() => handleProgressStart(doc.id)}
                                            >
                                                진행
                                            </button>
                                            {doc.status === 'stopped' ? (
                                                <button
                                                    className={styles.restartButton}
                                                    onClick={() => handleProgressStart(doc.id)}
                                                >
                                                    재시작
                                                </button>
                                            ) : (
                                                <button
                                                    className={styles.stopButton}
                                                    onClick={() => handleProgressStop(doc.id)}
                                                >
                                                    중지
                                                </button>
                                            )}
                                            <button
                                                className={styles.approveButton}
                                                onClick={() => handleApprove(doc.id)}
                                            >
                                                승인
                                            </button>
                                            <button
                                                className={styles.rejectActionButton}
                                                onClick={() => handleReject(doc.id)}
                                            >
                                                반려
                                            </button>
                                            <button
                                                className={styles.revisionButton}
                                                onClick={() => handleRevision(doc.id)}
                                            >
                                                보완
                                            </button>
                                            <button
                                                className={styles.submitButton}
                                                onClick={() => handleSubmit(doc.id)}
                                            >
                                                제출
                                            </button>
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
                        </>
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
                        // Cancel 버튼을 눌렀을 때만 상태 초기화
                        // Confirm 버튼을 눌렀을 때는 handleConfirmAction에서 처리
                    }}
                    onConfirm={() => {
                        handleConfirmAction();
                        setConfirmModalOpen(false);
                    }}
                    type="warning"
                    confirmText="확인"
                    cancelText="취소"
                />

                {reasonInputModalOpen && pendingReasonAction && (
                    <div className={styles.reasonModalOverlay} onClick={() => {
                        setReasonInputModalOpen(false);
                        setPendingReasonAction(null);
                        setReasonInput('');
                    }}>
                        <div className={styles.reasonModalContent} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.reasonModalHeader}>
                                <h3 className={styles.reasonModalTitle}>
                                    {pendingReasonAction.action === 'reject' ? '반려 사유' : '보완 사유'}
                                </h3>
                                <button
                                    className={styles.reasonModalCloseButton}
                                    onClick={() => {
                                        setReasonInputModalOpen(false);
                                        setPendingReasonAction(null);
                                        setReasonInput('');
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                            <div className={styles.reasonModalBody}>
                                <textarea
                                    className={styles.reasonTextarea}
                                    placeholder={pendingReasonAction.action === 'reject' ? '반려 사유를 입력하세요' : '보완 사유를 입력하세요'}
                                    value={reasonInput}
                                    onChange={(e) => setReasonInput(e.target.value)}
                                    rows={5}
                                />
                            </div>
                            <div className={styles.reasonModalFooter}>
                                <button
                                    className={styles.reasonCancelButton}
                                    onClick={() => {
                                        setReasonInputModalOpen(false);
                                        setPendingReasonAction(null);
                                        setReasonInput('');
                                    }}
                                >
                                    취소
                                </button>
                                <button
                                    className={styles.reasonConfirmButton}
                                    onClick={() => {
                                        if (pendingReasonAction) {
                                            setPendingAction({ id: pendingReasonAction.id, action: pendingReasonAction.action });
                                            setConfirmMessage(
                                                pendingReasonAction.action === 'reject'
                                                    ? '서류를 반려하시겠습니까?'
                                                    : '서류 보완을 요청하시겠습니까?'
                                            );
                                            setConfirmModalOpen(true);
                                            setReasonInputModalOpen(false);
                                            setPendingReasonAction(null);
                                        }
                                    }}
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
