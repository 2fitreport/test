'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import Pagination from '@/app/components/Pagination/Pagination';
import Spinner from '@/app/components/Spinner/Spinner';
import styles from './history.module.css';

interface HistoryDocument {
    id: number;
    original_id: number;
    user_id: string;
    user_name: string;
    document_type: string;
    title: string;
    status: string;
    progress_status: string;
    submitted_date: string;
    completed_date: string | null;
    progress_start_date: string | null;
    progress_end_time: string | null;
    stopped_time: string | null;
    reason: string | null;
    files: Array<{ name: string; path: string; size: number }>;
    type: string;
    company_name: string;
    representative_name: string;
    manager_name: string | null;
    progress_details: string | null;
    business_number: string | null;
    phone: string | null;
    manager_id: string | null;
    memos: any[];
    inspector_id: string | null;
    cretop_file: any;
    cretop_none: boolean;
    original_created_at: string;
    original_updated_at: string;
    deleted_by_id: string;
    deleted_by_name: string;
    deleted_at: string;
}

export default function HistoryPage() {
    const router = useRouter();
    const [historyData, setHistoryData] = useState<HistoryDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryDocument | null>(null);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    useEffect(() => {
        const adminData = getAdminData();
        // 대표자(Level 1)만 접근 가능
        if (!adminData || adminData.position?.level !== 1) {
            router.push('/main/document_submission');
            return;
        }
        fetchHistory();
    }, [router]);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/history');
            if (!response.ok) {
                throw new Error('히스토리 조회 실패');
            }
            const data = await response.json();
            setHistoryData(data);
        } catch (err) {
            setError('히스토리를 불러오는데 실패했습니다.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const year = String(date.getFullYear()).slice(-2);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}.${month}.${day} ${hours}:${minutes}`;
    };

    const getStatusLabel = (status: string) => {
        const statusLabels: Record<string, string> = {
            waiting: '서류수집',
            approved: '승인',
            rejected: '반려',
            revision: '보완',
            in_progress: '진행',
            submitted: '제출',
            stopped: '중지',
            assigned: '배정',
        };
        return statusLabels[status] || status;
    };

    const getTypeLabel = (type: string) => {
        return type === 'business' ? '법인' : '개인사업자';
    };

    const openDetailModal = (history: HistoryDocument) => {
        setSelectedHistory(history);
        setDetailModalOpen(true);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
        window.scrollTo(0, 0);
    };

    const handleItemsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    // 페이지네이션 계산
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = historyData.slice(indexOfFirstItem, indexOfLastItem);

    if (loading) {
        return <Spinner fullScreen />;
    }

    if (error) {
        return (
            <div className={styles.container}>
                <div className={styles.error}>{error}</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1 className={styles.title}>삭제 히스토리</h1>
                <p className={styles.subtitle}>삭제된 기업 데이터 기록</p>
            </div>

            {historyData.length === 0 ? (
                <div className={styles.emptyState}>
                    <p>삭제된 기업 데이터가 없습니다.</p>
                </div>
            ) : (
                <div>
                    <div className={styles.controlsWrapper}>
                        <div className={styles.itemsPerPageControl}>
                            <label htmlFor="itemsPerPage">페이지당 행 수:</label>
                            <select
                                id="itemsPerPage"
                                value={itemsPerPage}
                                onChange={handleItemsPerPageChange}
                                className={styles.itemsPerPageSelect}
                            >
                                <option value={10}>10개</option>
                                <option value={20}>20개</option>
                                <option value={50}>50개</option>
                            </select>
                        </div>
                        <div className={styles.totalInfo}>
                            총 {historyData.length}개
                        </div>
                    </div>

                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>기업명</th>
                                    <th>대표자명</th>
                                    <th>사업자유형</th>
                                    <th>진행단계</th>
                                    <th>상태</th>
                                    <th>작성자</th>
                                    <th>삭제자</th>
                                    <th>삭제일시</th>
                                    <th>상세</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentItems.map((history) => (
                                    <tr key={history.id}>
                                        <td className={styles.companyName}>{history.company_name}</td>
                                        <td>{history.representative_name}</td>
                                        <td>{getTypeLabel(history.type)}</td>
                                        <td>{history.progress_details || '-'}</td>
                                        <td>
                                            <span className={`${styles.statusBadge} ${styles[`status-${history.status}`]}`}>
                                                {getStatusLabel(history.status)}
                                            </span>
                                        </td>
                                        <td>{history.user_name}</td>
                                        <td className={styles.deletedBy}>{history.deleted_by_name}</td>
                                        <td>{formatDate(history.deleted_at)}</td>
                                        <td>
                                            <button
                                                className={styles.detailButton}
                                                onClick={() => openDetailModal(history)}
                                            >
                                                보기
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.paginationWrapper}>
                        <Pagination
                            currentPage={currentPage}
                            totalItems={historyData.length}
                            itemsPerPage={itemsPerPage}
                            onPageChange={handlePageChange}
                        />
                    </div>
                </div>
            )}

            {/* 상세 모달 */}
            {detailModalOpen && selectedHistory && (
                <div className={styles.modalOverlay} onClick={() => setDetailModalOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>삭제된 기업 상세 정보</h2>
                            <button
                                className={styles.closeButton}
                                onClick={() => setDetailModalOpen(false)}
                            >
                                &times;
                            </button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.detailSection}>
                                <h3>기본 정보</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>기업명</span>
                                        <span className={styles.detailValue}>{selectedHistory.company_name}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>대표자명</span>
                                        <span className={styles.detailValue}>{selectedHistory.representative_name}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>사업자유형</span>
                                        <span className={styles.detailValue}>{getTypeLabel(selectedHistory.type)}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>사업자번호</span>
                                        <span className={styles.detailValue}>{selectedHistory.business_number || '-'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>연락처</span>
                                        <span className={styles.detailValue}>{selectedHistory.phone || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>진행 정보</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>진행단계</span>
                                        <span className={styles.detailValue}>{selectedHistory.progress_details || '-'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>상태</span>
                                        <span className={styles.detailValue}>{getStatusLabel(selectedHistory.status)}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>실무자</span>
                                        <span className={styles.detailValue}>{selectedHistory.manager_name || '-'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>검수자ID</span>
                                        <span className={styles.detailValue}>{selectedHistory.inspector_id || '-'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>작성 정보</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>작성자</span>
                                        <span className={styles.detailValue}>{selectedHistory.user_name} ({selectedHistory.user_id})</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>제출일</span>
                                        <span className={styles.detailValue}>{selectedHistory.submitted_date || '-'}</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>생성일</span>
                                        <span className={styles.detailValue}>{formatDate(selectedHistory.original_created_at)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.detailSection}>
                                <h3>삭제 정보</h3>
                                <div className={styles.detailGrid}>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>삭제자</span>
                                        <span className={styles.detailValue}>{selectedHistory.deleted_by_name} ({selectedHistory.deleted_by_id})</span>
                                    </div>
                                    <div className={styles.detailItem}>
                                        <span className={styles.detailLabel}>삭제일시</span>
                                        <span className={styles.detailValue}>{formatDate(selectedHistory.deleted_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {selectedHistory.files && selectedHistory.files.length > 0 && (
                                <div className={styles.detailSection}>
                                    <h3>첨부 파일 ({selectedHistory.files.length}개)</h3>
                                    <ul className={styles.fileList}>
                                        {selectedHistory.files.map((file, index) => (
                                            <li key={index} className={styles.fileItem}>
                                                {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {selectedHistory.reason && (
                                <div className={styles.detailSection}>
                                    <h3>사유</h3>
                                    <div className={styles.reasonContent}>
                                        {selectedHistory.reason.split('\n').map((line, index) => (
                                            <p key={index}>{line}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className={styles.modalFooter}>
                            <button
                                className={styles.confirmButton}
                                onClick={() => setDetailModalOpen(false)}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
