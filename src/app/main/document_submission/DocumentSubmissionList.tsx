'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getAdminData } from '@/lib/auth';
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
    company_name?: string;
    representative_name?: string;
    manager_id?: string | null;
    manager_name?: string | null;
    business_number?: string;
    phone?: string;
    progress_details?: string;
    inspector_id?: string | null;
    status: 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped' | 'assigned';
    progress_status: 'in_progress' | 'stopped' | 'not_started';
    submitted_date: string;
    completed_date?: string;
    progress_start_date?: string;
    progress_end_time?: string;
    stopped_time?: string;
    reason?: string;
    reason_read: boolean;
    created_at?: string;
}

interface Worker {
    id: number;
    user_id: string;
    name: string;
    position_id: number;
    company_name?: string;
}

type SortColumn = 'user_id' | 'user_name' | 'company_name' | 'representative_name' | 'manager_name' | 'progress_details' | 'status' | 'submitted_date' | 'reason' | 'completed_date' | 'progress_start_date' | 'created_at';
type SortOrder = 'asc' | 'desc';

export default function DocumentSubmissionList() {
    const router = useRouter();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped' | 'assigned'>('all');
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [confirmMessage, setConfirmMessage] = useState('');
    const [pendingAction, setPendingAction] = useState<{ id: number; action: 'start' | 'stop' | 'restart' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' | 'reset'; reason?: string } | null>(null);
    const [reasonModalOpen, setReasonModalOpen] = useState(false);
    const [selectedReason, setSelectedReason] = useState<{ id: number; reason: string; status?: string } | null>(null);
    const [selectedDocuments, setSelectedDocuments] = useState<Set<number>>(new Set());
    const [isDeleteAllMode, setIsDeleteAllMode] = useState(false);
    const [reasonInputModalOpen, setReasonInputModalOpen] = useState(false);
    const [reasonInput, setReasonInput] = useState('');
    const [pendingReasonAction, setPendingReasonAction] = useState<{ id: number; action: 'reject' | 'revision' } | null>(null);
    const [managerSelectModalOpen, setManagerSelectModalOpen] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
    const [selectedManager, setSelectedManager] = useState<string>('');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [isUserSalesManager, setIsUserSalesManager] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string>('');
    const [userRoleLevel, setUserRoleLevel] = useState<number | undefined>();
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        const adminData = getAdminData();
        const userLevel = adminData?.position?.level;
        const userId = adminData?.user_id;

        setUserRoleLevel(userLevel);

        // level이 4(영업자)인지 확인
        if (userLevel === 4) {
            setIsUserSalesManager(true);
            setCurrentUserId(userId || '');
            // 영업자인 경우, 현재 userId로 필터링된 문서를 가져올 수 있도록
            // 하지만 여기서는 바로 fetchDocuments를 호출해도 필터링 함수에서 처리됨
        }

        fetchWorkers();
    }, []);

    // documents 로드는 별도로 처리
    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchWorkers = async () => {
        try {
            const response = await fetch('/api/users');
            if (!response.ok) {
                throw new Error('실무자 목록 조회 실패');
            }
            const data = await response.json();
            // position_id가 3인 실무자만 필터링
            const workerList = data.filter((user: Worker) => user.position_id === 3);
            setWorkers(workerList);
        } catch (error) {
            console.error('실무자 목록 조회 실패:', error);
        }
    };

    const handleProgressStart = (id: number) => {
        const doc = documents.find(d => d.id === id);

        // 진행 조건 확인
        if (!doc?.manager_id || doc?.status !== 'waiting') {
            setErrorMessage('실무자가 배정되어 있고<br>상태가 대기일 때만 진행할 수 있습니다.');
            setErrorModalOpen(true);
            return;
        }

        setPendingAction({ id, action: 'start' });
        setConfirmMessage('기업 진행을 시작하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleApprove = (id: number) => {
        const doc = documents.find(d => d.id === id);
        if (doc && doc.progress_details === '대표실무자') {
            // 실무자 선택 모달 띄우기
            setSelectedManagerId(id);
            setManagerSelectModalOpen(true);
        } else {
            // 일반 승인 진행
            setPendingAction({ id, action: 'approve' });
            setConfirmMessage('기업을 승인하시겠습니까?');
            setConfirmModalOpen(true);
        }
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
        setConfirmMessage('기업을 제출하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleProgressStop = (id: number) => {
        const doc = documents.find(d => d.id === id);

        // 중지 조건 확인
        if (!doc?.manager_id || doc?.status !== 'in_progress') {
            setErrorMessage('실무자가 배정되어 있고<br>상태가 진행일 때만 중지할 수 있습니다.');
            setErrorModalOpen(true);
            return;
        }

        setPendingAction({ id, action: 'stop' });
        setConfirmMessage('기업 진행을 중지하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleProgressRestart = (id: number) => {
        const doc = documents.find(d => d.id === id);

        // 재시작 조건 확인
        if (!doc?.manager_id || doc?.status !== 'stopped') {
            setErrorMessage('실무자가 배정되어 있고<br>상태가 중지일 때만 재시작할 수 있습니다.');
            setErrorModalOpen(true);
            return;
        }

        setPendingAction({ id, action: 'restart' });
        setConfirmMessage('기업 진행을 재시작하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleProgressDelete = (id: number) => {
        setPendingAction({ id, action: 'delete' });
        setConfirmMessage('이 기업을 삭제하시겠습니까?');
        setConfirmModalOpen(true);
    };

    const handleReset = (id: number) => {
        setPendingAction({ id, action: 'reset' });
        setConfirmMessage('기업을 초기화하시겠습니까?\n(대기 상태로 돌아갑니다)');
        setConfirmModalOpen(true);
    };

    const handleConfirmAction = async () => {
        // 전체 삭제 모드 처리
        if (isDeleteAllMode) {
            const allDocs = getFilteredAndSortedDocuments();

            // 데이터베이스에서 모두 삭제
            for (const doc of allDocs) {
                await deleteDocumentFromDatabase(doc.id);
            }

            setDocuments(docs => docs.filter(doc => !allDocs.some(d => d.id === doc.id)));
            setSelectedDocuments(new Set());
            setIsDeleteAllMode(false);
            setSuccessMessage(`${allDocs.length}건의 기업이 삭제되었습니다.`);
            setConfirmModalOpen(false);
            setSuccessModalOpen(true);
            return;
        }

        // 선택 삭제 모드 처리
        if (selectedDocuments.size > 0 && !pendingAction) {
            const count = selectedDocuments.size;
            const docIds = Array.from(selectedDocuments);

            // 데이터베이스에서 선택된 문서 삭제
            for (const docId of docIds) {
                await deleteDocumentFromDatabase(docId);
            }

            setDocuments(docs => docs.filter(doc => !selectedDocuments.has(doc.id)));
            setSelectedDocuments(new Set());
            setSuccessMessage(`${count}건의 기업이 삭제되었습니다.`);
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
            const doc = documents.find(d => d.id === id);
            if (doc) {
                const updatedDoc = {
                    ...doc,
                    status: 'in_progress' as const,
                    progress_status: 'in_progress' as const,
                    progress_start_date: String(Date.now())
                };

                // DB에 저장
                await saveDocumentToDatabase(updatedDoc);

                // UI 상태 업데이트
                setDocuments(docs => docs.map(d => d.id === id ? updatedDoc : d));
                setSuccessMessage('기업 진행이 시작되었습니다.');
            }
        } else if (action === 'approve') {
            const doc = documents.find(d => d.id === id);
            if (!doc) return;

            let updatedDoc: Document;
            let message = '';
            const adminData = getAdminData();
            const currentUserId = adminData?.user_id;

            if (doc.progress_details === '검수자') {
                // 검수자 → 대표실무자로 변경 (inspector_id는 기존 값 유지, 없을 때만 현재 사용자 저장)
                updatedDoc = { ...doc, progress_details: '대표실무자', inspector_id: doc.inspector_id || currentUserId };
                message = '대표실무자로 진행합니다.';
            } else if (doc.progress_details === '대표실무자') {
                // 대표실무자 → 실무자로 변경
                updatedDoc = { ...doc, status: 'assigned' as const, progress_details: '실무자' };
                message = '실무자로 배정되었습니다.';
            } else {
                // 최종 승인
                const now = new Date();
                const completedHours = String(now.getHours()).padStart(2, '0');
                const completedMinutes = String(now.getMinutes()).padStart(2, '0');
                const dateStr = now.toISOString().split('T')[0].replace(/(\d{4})-(\d{2})-(\d{2})/, '25-$2-$3');

                updatedDoc = {
                    ...doc,
                    status: 'approved' as const,
                    progress_status: 'stopped' as const,
                    completed_date: `${dateStr} ${completedHours}:${completedMinutes}`
                };
                message = '기업이 승인되었습니다.';
            }

            // DB에 저장
            await saveDocumentToDatabase(updatedDoc);

            // UI 상태 업데이트
            setDocuments(docs => docs.map(d => d.id === id ? updatedDoc : d));
            setSuccessMessage(message);
        } else if (action === 'reject') {
            const doc = documents.find(d => d.id === id);
            if (doc) {
                const now = new Date();
                const timeStr = now.toLocaleString('ko-KR', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });

                // 기존 사유가 있으면 새로운 사유 추가, 없으면 새로 생성
                const reasonText = (pendingAction as any)?.reason || reasonInput || '사유 없음';
                const newReason = `[${timeStr}] [반려] ${reasonText}`;
                const combinedReason = doc.reason ? `${doc.reason}\n${newReason}` : newReason;

                const rejectedDoc = {
                    ...doc,
                    status: 'rejected' as const,
                    progress_status: 'not_started' as const,
                    progress_details: '영업자',
                    manager_name: null,
                    manager_id: null,
                    inspector_id: null,
                    reason: combinedReason,
                    reason_read: false
                };

                // DB에 저장
                await saveDocumentToDatabase(rejectedDoc);

                // UI 상태 업데이트
                setDocuments(docs => docs.map(d => d.id === id ? rejectedDoc : d));
                setSuccessMessage('기업이 반려되었습니다.');

                // 사이드바 알림 숫자 업데이트 이벤트 발생
                window.dispatchEvent(new CustomEvent('notificationUpdate', { detail: { type: 'reject' } }));
            }
        } else if (action === 'revision') {
            const doc = documents.find(d => d.id === id);
            if (doc) {
                const now = new Date();
                const timeStr = now.toLocaleString('ko-KR', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });

                // 기존 사유가 있으면 새로운 사유 추가, 없으면 새로 생성
                const reasonText = (pendingAction as any)?.reason || reasonInput || '사유 없음';
                const newReason = `[${timeStr}] [보완] ${reasonText}`;
                const combinedReason = doc.reason ? `${doc.reason}\n${newReason}` : newReason;

                const revisionDoc = {
                    ...doc,
                    status: 'revision' as const,
                    progress_status: 'not_started' as const,
                    progress_details: '영업자',
                    manager_name: null,
                    manager_id: null,
                    inspector_id: null,
                    reason: combinedReason,
                    reason_read: false
                };

                // DB에 저장
                await saveDocumentToDatabase(revisionDoc);

                // UI 상태 업데이트
                setDocuments(docs => docs.map(d => d.id === id ? revisionDoc : d));
                setSuccessMessage('기업 보완이 요청되었습니다.');

                // 사이드바 알림 숫자 업데이트 이벤트 발생
                window.dispatchEvent(new CustomEvent('notificationUpdate', { detail: { type: 'revision' } }));
            }
        } else if (action === 'submit') {
            const doc = documents.find(d => d.id === id);
            if (doc) {
                let submittedDoc: Document;

                // 반려되거나 보완이 요청된 상태에서 제출하면 대기 상태로 돌아감
                if (doc.status === 'rejected' || doc.status === 'revision') {
                    submittedDoc = {
                        ...doc,
                        status: 'waiting' as const,
                        progress_status: 'not_started' as const,
                        progress_details: '검수자',
                        inspector_id: null,
                        reason_read: true
                    };
                } else {
                    // 기타 상태에서는 제출 상태로 변경
                    submittedDoc = {
                        ...doc,
                        status: 'submitted' as const,
                        progress_status: 'not_started' as const
                    };
                }

                // DB에 저장
                await saveDocumentToDatabase(submittedDoc);

                // UI 상태 업데이트
                setDocuments(docs => docs.map(d => d.id === id ? submittedDoc : d));

                if (doc.status === 'rejected' || doc.status === 'revision') {
                    setSuccessMessage('기업이 재제출되었습니다.');
                } else {
                    setSuccessMessage('기업이 제출되었습니다.');
                }
            }
        } else if (action === 'stop') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id && doc.progress_start_date) {
                        let startTime: number;

                        // ISO 문자열인지 확인 (T 문자가 있으면 ISO 형식)
                        if (doc.progress_start_date.includes('T')) {
                            startTime = new Date(doc.progress_start_date).getTime();
                        } else {
                            // 타임스탐프 (숫자 문자열)
                            const pastTimestamp = parseInt(doc.progress_start_date);
                            startTime = !isNaN(pastTimestamp) ? pastTimestamp : new Date(doc.progress_start_date).getTime();
                        }

                        const stopTime = Date.now();
                        const diffMs = stopTime - startTime;
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
            setSuccessMessage('기업 진행이 중지되었습니다.');
        } else if (action === 'delete') {
            // DB에서 삭제
            deleteDocumentFromDatabase(id);

            // UI에서 삭제
            setDocuments(docs => docs.filter(doc => doc.id !== id));
            setSuccessMessage('기업이 삭제되었습니다.');
        } else if (action === 'reset') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id) {
                        return {
                            ...doc,
                            status: 'waiting' as const,
                            progress_status: 'not_started' as const,
                            progress_details: '검수자',
                            manager_name: null,
                            manager_id: null,
                            inspector_id: null,
                            progress_start_date: null,
                            progress_end_time: null,
                            stopped_time: null,
                            completed_date: null
                        };
                    }
                    return doc;
                })
            );
            setSuccessMessage('기업이 초기화되었습니다.');
        } else if (action === 'restart') {
            setDocuments(docs =>
                docs.map(doc => {
                    if (doc.id === id) {
                        // stopped_time을 초 단위로 변환
                        let stoppedSeconds = 0;
                        if (doc.stopped_time) {
                            const parts = doc.stopped_time.split(':');
                            const hours = parseInt(parts[0]) || 0;
                            const minutes = parseInt(parts[1]) || 0;
                            const seconds = parseInt(parts[2]) || 0;
                            stoppedSeconds = hours * 3600 + minutes * 60 + seconds;
                        }

                        // 현재 시간에서 stopped_time을 빼서 progress_start_date 설정
                        // 이렇게 하면 timeUtils에서 계산할 때 stopped_time이 누적됨
                        const newStartTime = Date.now() - (stoppedSeconds * 1000);

                        return {
                            ...doc,
                            status: 'in_progress' as const,
                            progress_status: 'in_progress' as const,
                            progress_start_date: String(newStartTime),
                            stopped_time: null
                        };
                    }
                    return doc;
                })
            );
            setSuccessMessage('기업 진행이 재시작되었습니다.');
        }

        setConfirmModalOpen(false);
        setPendingAction(null);
        setReasonInput('');
        setPendingReasonAction(null);
        setSuccessModalOpen(true);

        // 데이터베이스에 저장 (이미 처리된 액션: approve, start, delete, reject, revision, submit)
        if (action === 'stop' || action === 'reset' || action === 'restart') {
            const updatedDoc = documents.find(doc => doc.id === id);
            if (updatedDoc) {
                await saveDocumentToDatabase(updatedDoc);
            }
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
                const errorData = await response.json();
                console.error('데이터베이스 저장 실패:', response.status, errorData);
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
            const adminData = getAdminData();
            const userLevel = adminData?.position?.level;
            const userId = adminData?.user_id;
            const userIdNumber = adminData?.id;

            const response = await fetch('/api/documents');
            if (!response.ok) {
                throw new Error('기업 목록 조회 실패');
            }
            let data = await response.json();

            // API에서 이미 역할별 필터링을 완료했으므로, 클라이언트 사이드 필터링 불필요
            // (API에서: Level 4는 자신의 문서만, Level 6은 담당 영업자 + 과거 승인한 문서, Level 1/2는 모든 문서)

            // 최근에 등록된 것이 맨 위에 오도록 created_at 기준 내림차순 정렬
            data.sort((a: Document, b: Document) => {
                const dateA = new Date(a.created_at || 0).getTime();
                const dateB = new Date(b.created_at || 0).getTime();
                return dateB - dateA; // 내림차순
            });

            setDocuments(data);
        } catch (error) {
            console.error('기업 목록 조회 실패:', error);
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
        setConfirmMessage(`전체 기업(${getFilteredAndSortedDocuments().length}건)을 삭제하시겠습니까?`);
        setConfirmModalOpen(true);
    };

    const handleDeleteSelected = () => {
        if (selectedDocuments.size === 0) return;
        setIsDeleteAllMode(false);
        setPendingAction(null);
        setConfirmMessage(`선택된 ${selectedDocuments.size}건의 기업을 삭제하시겠습니까?`);
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
        const adminData = getAdminData();
        const userLevel = adminData?.position?.level;
        const userId = adminData?.user_id;

        const filtered = documents.filter(doc => {
            // API에서 이미 역할별 필터링을 완료했으므로, 여기서는 상태 필터와 검색만 적용
            if (statusFilter !== 'all' && doc.status !== statusFilter) {
                return false;
            }
            const query = searchQuery.toLowerCase();
            return (
                (doc.user_id || '').toLowerCase().includes(query) ||
                (doc.user_name || '').toLowerCase().includes(query)
            );
        });

        const sorted = [...filtered].sort((a, b) => {
            let aValue: Document[SortColumn] = a[sortColumn];
            let bValue: Document[SortColumn] = b[sortColumn];

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
        const adminData = getAdminData();
        const userLevel = adminData?.position?.level;
        const userId = adminData?.user_id;

        // 영업자인 경우 자신의 문서만 카운트
        // 검수자인 경우 자신의 담당 영업자 문서('검수자' 진행상태) + 자신이 승인한 문서(inspector_id) 모두 카운트
        let docsToCount = documents;
        if (userLevel === 4) {
            docsToCount = documents.filter(doc => doc.user_id === userId);
        } else if (userLevel === 6) {
            docsToCount = documents.filter(doc => doc.progress_details === '검수자' || doc.inspector_id === userId);
        }

        const counts = {
            all: docsToCount.length,
            waiting: 0,
            in_progress: 0,
            approved: 0,
            revision: 0,
            rejected: 0,
            submitted: 0,
            stopped: 0,
            assigned: 0,
        };

        docsToCount.forEach(doc => {
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
                case 'assigned':
                    counts.assigned++;
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
            case 'assigned':
                return '배정';
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
            case 'assigned':
                return styles.assigned;
            default:
                return '';
        }
    };

    const formatSubmittedDate = (dateString: string) => {
        if (!dateString) return '-';
        try {
            // 기존 저장된 형식 파싱: "YYYY. MM. DD. 오전/오후 H:M:S"
            const match = dateString.match(/(\d+)\.\s+(\d+)\.\s+(\d+)\.\s+(오전|오후)\s+(\d+):(\d+):(\d+)/);
            if (match) {
                let year = match[1];
                const month = match[2];
                const day = match[3];
                const period = match[4];
                let hours = parseInt(match[5]);
                const minutes = match[6];

                // 오후인 경우 12시간 더하기
                if (period === '오후' && hours !== 12) {
                    hours += 12;
                } else if (period === '오전' && hours === 12) {
                    hours = 0;
                }

                // 연도는 마지막 2자리만 사용
                year = year.slice(-2);
                const formattedHours = String(hours).padStart(2, '0');
                const formattedMinutes = String(minutes).padStart(2, '0');

                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${formattedHours}:${formattedMinutes}`;
            }

            // 표준 ISO 형식 시도
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                const year = String(date.getFullYear()).slice(-2);
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}`;
            }

            return dateString;
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return <div className={styles.loading}>로딩 중...</div>;
    }

    return (
        <>
            <div className={styles.documentListContainer}>
                <div className={styles.header}>
                    <h2>기업 목록</h2>
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
                                        setStatusFilter(e.target.value as 'all' | 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped' | 'assigned');
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
                                    <option value="assigned">배정</option>
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
                            {!isUserSalesManager && userRoleLevel !== 6 && userRoleLevel !== 2 && (
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
                            )}

                            <table className={styles.documentTable}>
                            <thead>
                                <tr>
                                    {!isUserSalesManager && userRoleLevel !== 6 && userRoleLevel !== 2 && (
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
                                    )}
                                    <th>작업</th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('company_name')}>
                                        기업명{getSortIcon('company_name')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('representative_name')}>
                                        대표자명{getSortIcon('representative_name')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('progress_details')}>
                                        진행상황{getSortIcon('progress_details')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('status')}>
                                        상태{getSortIcon('status')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('reason')}>
                                        사유{getSortIcon('reason')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('progress_start_date')}>
                                        시간 경과{getSortIcon('progress_start_date')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('submitted_date')}>
                                        제출일{getSortIcon('submitted_date')}
                                    </th>
                                    <th className={styles.sortableHeader} onClick={() => handleSort('completed_date')}>
                                        완료일{getSortIcon('completed_date')}
                                    </th>
                                    {!isUserSalesManager && (
                                        <th className={styles.sortableHeader} onClick={() => handleSort('user_name')}>
                                            작성자{getSortIcon('user_name')}
                                        </th>
                                    )}
                                    {!isUserSalesManager && (
                                        <th className={styles.sortableHeader} onClick={() => handleSort('user_id')}>
                                            작성자 ID{getSortIcon('user_id')}
                                        </th>
                                    )}
                                    {!isUserSalesManager && userRoleLevel !== 6 && (
                                        <th className={styles.sortableHeader} onClick={() => handleSort('manager_name')}>
                                            실무자{getSortIcon('manager_name')}
                                        </th>
                                    )}
                                    {!isUserSalesManager && userRoleLevel !== 6 && (
                                        <th className={styles.sortableHeader}>
                                            실무자 ID
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {getPaginatedDocuments().map((doc) => (
                                    <tr key={doc.id} className={styles.documentRow}>
                                        {!isUserSalesManager && userRoleLevel !== 6 && userRoleLevel !== 2 && (
                                            <td className={styles.checkboxCell}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocuments.has(doc.id)}
                                                    onChange={() => handleSelectDocument(doc.id)}
                                                />
                                            </td>
                                        )}
                                        <td className={styles.actionsCell}>
                                            <button
                                                className={styles.actionButton}
                                                onClick={() => router.push(`/main/company_create?view=${doc.id}`)}
                                            >
                                                보기
                                            </button>
                                        </td>
                                        <td className={styles.companyName}>{doc.company_name || '-'}</td>
                                        <td className={styles.representativeName}>{doc.representative_name || '-'}</td>
                                        <td className={styles.progressDetails}>
                                            {doc.progress_details ? (
                                                <span className={styles.badge}>{doc.progress_details}</span>
                                            ) : (
                                                '-'
                                            )}
                                        </td>
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
                                                        const wasUnread = !doc.reason_read;

                                                        setSelectedReason({ id: doc.id, reason: doc.reason!, status: doc.status });
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

                                                        // 읽지 않은 상태에서 읽음 상태로 변경될 때만 알림 업데이트
                                                        if (wasUnread) {
                                                            window.dispatchEvent(new CustomEvent('notificationUpdate', { detail: { type: 'read' } }));
                                                        }
                                                    }}
                                                >
                                                    보기
                                                </button>
                                            ) : (
                                                <span className={styles.noReason}>없음</span>
                                            )}
                                        </td>
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
                                        <td className={styles.date}>{formatSubmittedDate(doc.submitted_date)}</td>
                                        <td className={styles.completedDate}>{formatSubmittedDate(doc.completed_date || '')}</td>
                                        {!isUserSalesManager && (
                                            <td className={styles.userName}>{doc.user_name}</td>
                                        )}
                                        {!isUserSalesManager && (
                                            <td className={styles.userId}>{doc.user_id}</td>
                                        )}
                                        {!isUserSalesManager && userRoleLevel !== 6 && (
                                            <td className={styles.managerName}>{doc.manager_name || '-'}</td>
                                        )}
                                        {!isUserSalesManager && userRoleLevel !== 6 && (
                                            <td className={styles.managerId}>{doc.manager_id || '-'}</td>
                                        )}
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
                    onCancel={() => {
                        setConfirmModalOpen(false);
                        // Cancel 버튼을 눌렀을 때만 상태 초기화
                        // Confirm 버튼을 눌렀을 때는 handleConfirmAction에서 처리
                    }}
                    onConfirm={() => {
                        handleConfirmAction();
                        setConfirmModalOpen(false);
                    }}
                    type="warning"
                    confirmButtonText="확인"
                    cancelButtonText="취소"
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
                                        if (pendingReasonAction && reasonInput.trim()) {
                                            setPendingAction({
                                                id: pendingReasonAction.id,
                                                action: pendingReasonAction.action,
                                                reason: reasonInput
                                            });
                                            setConfirmMessage(
                                                pendingReasonAction.action === 'reject'
                                                    ? '기업을 반려하시겠습니까?'
                                                    : '기업 보완을 요청하시겠습니까?'
                                            );
                                            setConfirmModalOpen(true);
                                            setReasonInputModalOpen(false);
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
                            <div className={styles.reasonModalBody} style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                <div style={{ display: 'flex', gap: '20px' }}>
                                    {/* 보완 섹션 */}
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: '0 0 12px 0', color: '#ff9800', fontSize: '16px', fontWeight: '600' }}>
                                            보완
                                        </h3>
                                        <div>
                                            {(() => {
                                                const revisionItems = selectedReason.reason.split('\n').filter((line: string) => {
                                                    const timeMatch = line.match(/^\[(.*?)\]\s*\[(.*?)\]\s*(.*)/);
                                                    if (timeMatch) {
                                                        const actionType = timeMatch[2];
                                                        return actionType === '보완';
                                                    }
                                                    return false;
                                                });

                                                if (revisionItems.length === 0) {
                                                    return <p style={{ color: '#999', fontSize: '14px', margin: '0' }}>없음</p>;
                                                }

                                                return revisionItems.reverse().map((line: string, index: number) => {
                                                    const timeMatch = line.match(/^\[(.*?)\]\s*\[(.*?)\]\s*(.*)/);
                                                    if (timeMatch) {
                                                        const time = timeMatch[1];
                                                        const message = timeMatch[3];
                                                        return (
                                                            <div key={index} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '3px solid #ff9800' }}>
                                                                <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: '13px' }}>
                                                                    {time}
                                                                </p>
                                                                <p style={{ margin: '0', color: '#333', fontSize: '14px', lineHeight: '1.5' }}>
                                                                    {message}
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }).filter(Boolean);
                                            })()}
                                        </div>
                                    </div>

                                    {/* 반려 섹션 */}
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: '0 0 12px 0', color: '#dc3545', fontSize: '16px', fontWeight: '600' }}>
                                            반려
                                        </h3>
                                        <div>
                                            {(() => {
                                                const rejectionItems = selectedReason.reason.split('\n').filter((line: string) => {
                                                    const timeMatch = line.match(/^\[(.*?)\]\s*\[(.*?)\]\s*(.*)/);
                                                    if (timeMatch) {
                                                        const actionType = timeMatch[2];
                                                        return actionType === '반려';
                                                    }
                                                    return false;
                                                });

                                                if (rejectionItems.length === 0) {
                                                    return <p style={{ color: '#999', fontSize: '14px', margin: '0' }}>없음</p>;
                                                }

                                                return rejectionItems.reverse().map((line: string, index: number) => {
                                                    const timeMatch = line.match(/^\[(.*?)\]\s*\[(.*?)\]\s*(.*)/);
                                                    if (timeMatch) {
                                                        const time = timeMatch[1];
                                                        const message = timeMatch[3];
                                                        return (
                                                            <div key={index} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '3px solid #dc3545' }}>
                                                                <p style={{ margin: '0 0 4px 0', color: '#666', fontSize: '13px' }}>
                                                                    {time}
                                                                </p>
                                                                <p style={{ margin: '0', color: '#333', fontSize: '14px', lineHeight: '1.5' }}>
                                                                    {message}
                                                                </p>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                }).filter(Boolean);
                                            })()}
                                        </div>
                                    </div>
                                </div>
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

                {errorModalOpen && (
                    <div className={modalStyles.overlay} onClick={() => {
                        setErrorModalOpen(false);
                        setErrorMessage('');
                    }}>
                        <div className={`${modalStyles.modal} ${modalStyles.error}`} onClick={(e) => e.stopPropagation()}>
                            <div className={modalStyles.content}>
                                <div className={modalStyles.iconWrapper}>
                                    <img src="/error.svg" alt="error" className={modalStyles.icon} />
                                </div>
                                <p className={modalStyles.message}>{errorMessage}</p>
                            </div>
                            <div className={modalStyles.footer}>
                                <button
                                    className={modalStyles.confirmButton}
                                    onClick={() => {
                                        setErrorModalOpen(false);
                                        setErrorMessage('');
                                    }}
                                >
                                    확인
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {managerSelectModalOpen && selectedManagerId && (
                    <div className={modalStyles.overlay} onClick={() => {
                        setManagerSelectModalOpen(false);
                        setSelectedManagerId(null);
                        setSelectedManager('');
                    }}>
                        <div className={`${modalStyles.modal} ${styles.managerModal}`} onClick={(e) => e.stopPropagation()}>
                            <div className={modalStyles.header}>
                                <h3 className={modalStyles.title}>실무자 배정</h3>
                            </div>
                            <div className={`${modalStyles.content} ${styles.managerContent}`}>
                                <div className={styles.managerSelectWrapper}>
                                    <select
                                        value={selectedManager}
                                        onChange={(e) => setSelectedManager(e.target.value)}
                                        className={styles.managerSelect}
                                    >
                                        <option value="">실무자를 선택하세요</option>
                                        {workers.map(worker => (
                                            <option key={worker.id} value={worker.user_id}>
                                                {worker.name}({worker.user_id})
                                            </option>
                                        ))}
                                    </select>
                                    <Image
                                        src="/arrow.svg"
                                        alt="드롭다운"
                                        width={16}
                                        height={16}
                                        className={styles.managerSelectArrow}
                                    />
                                </div>
                            </div>
                            <div className={modalStyles.footer}>
                                <button
                                    className={modalStyles.cancelButton}
                                    onClick={() => {
                                        setManagerSelectModalOpen(false);
                                        setSelectedManagerId(null);
                                        setSelectedManager('');
                                    }}
                                >
                                    취소
                                </button>
                                <button
                                    className={`${modalStyles.confirmButton} ${!selectedManager ? styles.disabledButton : ''}`}
                                    onClick={async () => {
                                        if (selectedManager && selectedManagerId) {
                                            const updatedDoc = documents.find(d => d.id === selectedManagerId);
                                            const selectedWorker = workers.find(w => w.user_id === selectedManager);
                                            if (updatedDoc && selectedWorker) {
                                                const newDoc = {
                                                    ...updatedDoc,
                                                    manager_id: selectedWorker.user_id,
                                                    manager_name: selectedWorker.name,
                                                    progress_details: '실무자',
                                                    status: 'assigned' as const,
                                                };

                                                // 데이터베이스에 먼저 저장
                                                await saveDocumentToDatabase(newDoc);

                                                // UI 상태 업데이트
                                                setDocuments(docs =>
                                                    docs.map(doc => doc.id === selectedManagerId ? newDoc : doc)
                                                );
                                            }

                                            setSuccessMessage(`${selectedWorker?.name} 실무자가 배정되었습니다.`);
                                            setSuccessModalOpen(true);
                                            setManagerSelectModalOpen(false);
                                            setSelectedManagerId(null);
                                            setSelectedManager('');
                                        }
                                    }}
                                    disabled={!selectedManager}
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
}
