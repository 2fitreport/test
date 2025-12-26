'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import { canEditDocument } from '@/lib/permissions';
import Modal from '@/app/components/Modal/Modal';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import styles from './companyCreate.module.css';

interface CompanyFormData {
    businessType: 'individual' | 'business';
    representative_name: string;
    company_name: string;
    business_number: string;
    phone: string;
}

interface DocumentMemo {
    timestamp: string;
    content: string;
    user_name: string;
    user_id: string;
}

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
    status: 'waiting' | 'approved' | 'rejected' | 'revision' | 'in_progress' | 'submitted' | 'stopped' | 'assigned';
    progress_status: 'in_progress' | 'stopped' | 'not_started';
    submitted_date: string;
    completed_date?: string;
    progress_start_date?: string;
    progress_end_time?: string;
    stopped_time?: string;
    reason?: string;
    reason_read: boolean;
    memos?: DocumentMemo[];
}

interface Worker {
    id: number;
    user_id: string;
    name: string;
    position_id: number;
    company_name?: string;
}

export default function CompanyCreateForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const viewId = searchParams.get('view');
    const editParam = searchParams.get('edit');

    const [formData, setFormData] = useState<CompanyFormData>({
        businessType: 'individual',
        representative_name: '',
        company_name: '',
        business_number: '',
        phone: '',
    });

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [existingFiles, setExistingFiles] = useState<Array<{ name: string; path: string; size: number }>>([]);
    const [loading, setLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');
    const [error, setError] = useState('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [documentData, setDocumentData] = useState<any>(null);
    const [pendingAction, setPendingAction] = useState<{ id: number; action: 'start' | 'stop' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' | 'reset' } | null>(null);
    const [reasonInputModalOpen, setReasonInputModalOpen] = useState(false);
    const [reasonInput, setReasonInput] = useState('');
    const [pendingReasonAction, setPendingReasonAction] = useState<{ id: number; action: 'reject' | 'revision' } | null>(null);
    const [managerSelectModalOpen, setManagerSelectModalOpen] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
    const [selectedManager, setSelectedManager] = useState<string>('');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [successMessage, setSuccessMessage] = useState('');
    const [actionConfirmModalOpen, setActionConfirmModalOpen] = useState(false);
    const [actionConfirmType, setActionConfirmType] = useState<'start' | 'stop' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' | 'reset'>('start');
    const [memoInput, setMemoInput] = useState('');
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const [fileViewerOpen, setFileViewerOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{ name: string; path: string; size: number } | null>(null);
    const [fileViewUrl, setFileViewUrl] = useState('');

    // 초기화: 실무자 목록 로드 및 현재 사용자 정보 설정
    useEffect(() => {
        // 검수자(Level 6)는 기업 생성 불가 (조회/검수만 가능)
        if (!viewId) {
            const adminData = getAdminData();
            if (adminData?.position?.level === 6) {
                setError('검수자는 기업을 생성할 수 없습니다.');
                setErrorModalOpen(true);
                // 모달이 표시되는 동안 리다이렉트 준비
                const timer = setTimeout(() => {
                    router.push('/main/document_submission');
                }, 2000);
                return () => clearTimeout(timer);
            }
        }

        fetchWorkers();
        initializeCurrentUser();
    }, [router]);

    // 보기/수정 모드일 때 문서 정보 로드
    useEffect(() => {
        if (viewId) {
            setIsViewMode(true);
            // 수정 모드는 일단 false로 설정, 권한 확인 후에 결정
            setIsEditMode(false);
            fetchDocumentData(parseInt(viewId));
        }
    }, [viewId, editParam]);

    const fetchDocumentData = async (docId: number) => {
        try {
            const response = await fetch(`/api/documents/${docId}`);
            if (!response.ok) {
                throw new Error('문서 조회 실패');
            }
            const data = await response.json();

            // 권한 확인 (데이터 표시 전에)
            const adminData = getAdminData();
            const userLevel = adminData?.position?.level;
            const userId = adminData?.user_id;

            // 영업자(level=4)는 자신이 작성하지 않은 문서는 보기도 불가
            if (userLevel === 4 && userId !== data.user_id) {
                setError('접근 권한이 없습니다.');
                setErrorModalOpen(true);
                return;
            }

            // 권한이 확인되었으면 데이터 표시
            setDocumentData(data);

            setFormData({
                businessType: data.type || 'individual',
                representative_name: data.representative_name || '',
                company_name: data.company_name || '',
                business_number: data.business_number || '',
                phone: data.phone || '',
            });

            // 파일 정보 로드
            if (data.files && Array.isArray(data.files)) {
                setExistingFiles(data.files);
            }

            // 수정 권한 확인
            const hasEditPermission = canEditDocument(
                userLevel,
                userId,
                data.user_id
            );
            setCanEdit(hasEditPermission);

            // 검수자가 URL로 수정 모드 진입 시도 → 차단
            if (userLevel === 6 && editParam === 'true') {
                setError('검수자는 수정할 수 없습니다.');
                setErrorModalOpen(true);
                return;
            }

            // 권한이 있을 때만 URL의 edit 파라미터를 반영
            if (hasEditPermission && editParam === 'true') {
                setIsEditMode(true);
            }
        } catch (err) {
            console.error('문서 데이터 로드 실패:', err);
            setError('문서 정보를 불러오지 못했습니다.');
            setErrorModalOpen(true);
        }
    };

    const handleBusinessTypeChange = (type: 'individual' | 'business') => {
        setFormData({
            businessType: type,
            representative_name: '',
            company_name: '',
            business_number: '',
            phone: '',
        });
        setSelectedFiles([]);
        setExistingFiles([]);
    };

    const formatBusinessNumber = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        if (digits.length <= 3) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    };

    const formatPhoneNumber = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let finalValue = value;

        if (name === 'business_number') {
            finalValue = formatBusinessNumber(value);
        } else if (name === 'phone') {
            finalValue = formatPhoneNumber(value);
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue,
        }));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveExistingFile = async (index: number) => {
        const fileToRemove = existingFiles[index];

        try {
            // 스토리지에서 파일 삭제
            await fetch(`/api/upload?path=${encodeURIComponent(fileToRemove.path)}`, {
                method: 'DELETE',
            });

            // UI에서 파일 제거
            setExistingFiles(prev => prev.filter((_, i) => i !== index));
        } catch (err) {
            console.error('파일 삭제 중 오류:', err);
            setError('파일 삭제 중 오류가 발생했습니다.');
            setErrorModalOpen(true);
        }
    };

    const handleDownloadZip = async () => {
        if (!existingFiles || existingFiles.length === 0) {
            setDownloadError('다운로드할 파일이 없습니다.');
            return;
        }

        setIsDownloading(true);
        setDownloadError('');

        try {
            const response = await fetch('/api/download/zip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentId: viewId || documentData?.id,
                    files: existingFiles,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || '다운로드 실패');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = globalThis.document.createElement('a');
            link.href = url;
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            link.download = `document_${viewId || documentData?.id}_${dateStr}.zip`;
            globalThis.document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            globalThis.document.body.removeChild(link);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '파일 다운로드 중 오류가 발생했습니다.';
            setDownloadError(errorMessage);
            console.error('ZIP 다운로드 오류:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const validateForm = () => {
        if (!formData.representative_name.trim()) {
            setError('대표자명을 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (!formData.company_name.trim()) {
            setError('회사명을 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (!formData.business_number.trim()) {
            setError('사업자등록번호를 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (!formData.phone.trim()) {
            setError('대표자 연락처를 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        // 파일 검증 (보기 모드에서는 스킵)
        // 생성 모드: 새 파일 필수
        // 수정 모드: 기존 파일 또는 새 파일 중 최소 1개 필수
        if (!isViewMode && !isEditMode && selectedFiles.length === 0) {
            setError('파일을 최소 1개 이상 업로드해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (!isViewMode && isEditMode && existingFiles.length === 0 && selectedFiles.length === 0) {
            setError('파일을 최소 1개 이상 업로드해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (isViewMode && isEditMode && existingFiles.length === 0 && selectedFiles.length === 0) {
            setError('파일을 최소 1개 이상 보유해야 합니다.');
            setErrorModalOpen(true);
            return false;
        }

        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setConfirmModalOpen(true);
    };

    const handleConfirmSubmit = async () => {
        setLoading(true);
        setConfirmModalOpen(false);

        try {
            const adminData = getAdminData();
            if (!adminData) {
                setError('사용자 정보를 불러올 수 없습니다.');
                setErrorModalOpen(true);
                setLoading(false);
                return;
            }

            let uploadedFiles: Array<{ name: string; path: string; size: number }> = [];

            // 새로운 파일 업로드 (생성 모드 또는 수정 모드에서 새 파일 추가)
            if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                    try {
                        // 파일 크기 확인 (50MB 제한)
                        if (file.size > 50 * 1024 * 1024) {
                            throw new Error(`${file.name}은(는) 50MB 이상으로 업로드할 수 없습니다.`);
                        }

                        const fileExt = file.name.split('.').pop();
                        const timestamp = Date.now();
                        const date = new Date(timestamp);
                        const timeStr = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
                        const randomStr = Math.random().toString(36).substring(2, 9);
                        const fileName = `${timeStr}-${randomStr}.${fileExt}`;
                        const businessTypeFolder = formData.businessType === 'individual' ? 'individual' : 'business';
                        const filePath = `companies/${businessTypeFolder}/${fileName}`;

                        const uploadFormData = new FormData();
                        uploadFormData.append('file', file);
                        uploadFormData.append('path', filePath);

                        const uploadResponse = await fetch('/api/upload', {
                            method: 'POST',
                            body: uploadFormData,
                        });

                        if (!uploadResponse.ok) {
                            const errorData = await uploadResponse.json();
                            throw new Error(errorData.error || `파일 업로드 실패: ${file.name}`);
                        }

                        const uploadData = await uploadResponse.json();
                        uploadedFiles.push({
                            name: file.name,
                            path: uploadData.path,
                            size: file.size,
                        });
                    } catch (err) {
                        throw new Error(`파일 업로드 중 오류 발생: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
                    }
                }
            }

            // 수정 모드: 기존 파일과 새 파일 합치기
            if (isEditMode) {
                uploadedFiles = [...existingFiles, ...uploadedFiles];
            }

            // 기업 정보 저장/수정
            const now = new Date();
            const requestBody: any = {
                company_name: formData.company_name,
                representative_name: formData.representative_name,
                business_number: formData.business_number,
                phone: formData.phone,
                type: formData.businessType,
            };

            if (isViewMode && isEditMode) {
                // 수정 모드: PUT 요청 (보기 모드에서 수정)
                const editBody = {
                    ...requestBody,
                    files: uploadedFiles,
                };

                const response = await fetch(`/api/documents/${viewId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(editBody),
                });

                if (!response.ok) {
                    throw new Error('기업 정보 수정 실패');
                }
            } else {
                // 생성 모드: POST 요청
                // 초기 메모 생성 (작성자가 입력한 메모가 있으면)
                const initialMemos: DocumentMemo[] = [];
                if (memoInput.trim()) {
                    initialMemos.push({
                        timestamp: now.toLocaleString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        }),
                        content: memoInput,
                        user_name: adminData.name || adminData.user_id,
                        user_id: adminData.user_id
                    });
                }

                const createBody = {
                    ...requestBody,
                    user_id: adminData.user_id,
                    user_name: adminData.name || adminData.user_id,
                    document_type: '기업등록',
                    title: formData.company_name,
                    manager_name: '',
                    progress_details: '검수자',
                    status: 'waiting',
                    progress_status: 'not_started',
                    submitted_date: now.toLocaleString('ko-KR'),
                    files: uploadedFiles,
                    memos: initialMemos,
                };

                const response = await fetch('/api/documents', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(createBody),
                });

                if (!response.ok) {
                    throw new Error('기업 정보 저장 실패');
                }
            }

            // 생성/수정 완료 후 메모 입력창 초기화
            setMemoInput('');
            setSuccessModalOpen(true);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '오류가 발생했습니다.';
            setError(errorMessage);
            setErrorModalOpen(true);
            setLoading(false);
        }
    };

    const fetchWorkers = async () => {
        try {
            const response = await fetch('/api/workers');
            if (response.ok) {
                const data = await response.json();
                setWorkers(data);
            }
        } catch (error) {
            console.error('실무자 목록 조회 실패:', error);
        }
    };

    const initializeCurrentUser = () => {
        const adminData = getAdminData();
        if (adminData) {
            setCurrentUser({
                id: adminData.user_id,
                name: adminData.name
            });
        }
    };

    const handleAddMemo = async () => {
        if (!memoInput.trim() || !documentData || !currentUser) return;

        const newMemo: DocumentMemo = {
            timestamp: new Date().toLocaleString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }),
            content: memoInput,
            user_name: currentUser.name,
            user_id: currentUser.id
        };

        const updatedMemos = [...(documentData.memos || []), newMemo];
        const updated = {
            ...documentData,
            memos: updatedMemos
        };

        await saveDocumentToDatabase(updated);
        setDocumentData(updated);
        setMemoInput('');
        setSuccessMessage('메모가 추가되었습니다.');
        setSuccessModalOpen(true);
    };

    const handleViewFile = async (file: { name: string; path: string; size: number }) => {
        setSelectedFile(file);
        setFileViewerOpen(true);

        try {
            const response = await fetch('/api/file/view', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filePath: file.path }),
            });

            if (!response.ok) {
                throw new Error('파일 조회 실패');
            }

            const data = await response.json();
            setFileViewUrl(data.url);
        } catch (error) {
            console.error('파일 조회 오류:', error);
            setFileViewUrl('');
        }
    };

    const getFileExtension = (fileName: string): string => {
        const parts = fileName.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
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

    const handleProgressStart = (id: number) => {
        setPendingAction({ id, action: 'start' });
        setActionConfirmType('start');
        setActionConfirmModalOpen(true);
    };

    const handleApprove = (id: number) => {
        const doc = documentData;
        if (doc && doc.progress_details === '대표실무자') {
            setSelectedManagerId(id);
            setManagerSelectModalOpen(true);
        } else {
            setPendingAction({ id, action: 'approve' });
            setActionConfirmType('approve');
            setActionConfirmModalOpen(true);
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

    const handleActionSubmit = (id: number) => {
        setPendingAction({ id, action: 'submit' });
        setActionConfirmType('submit');
        setActionConfirmModalOpen(true);
    };

    const handleProgressStop = (id: number) => {
        setPendingAction({ id, action: 'stop' });
        setActionConfirmType('stop');
        setActionConfirmModalOpen(true);
    };

    const handleProgressDelete = (id: number) => {
        setPendingAction({ id, action: 'delete' });
        setActionConfirmType('delete');
        setActionConfirmModalOpen(true);
    };

    const handleReset = (id: number) => {
        setPendingAction({ id, action: 'reset' });
        setActionConfirmType('reset');
        setActionConfirmModalOpen(true);
    };

    const handleConfirmAction = async () => {
        if (!pendingAction && !pendingReasonAction) return;

        const id = pendingAction?.id || pendingReasonAction?.id || documentData?.id;
        const action = pendingAction?.action || pendingReasonAction?.action;

        if (!id) return;

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

        try {
            if (action === 'start') {
                const updated = {
                    ...documentData,
                    status: 'in_progress' as const,
                    progress_status: 'in_progress' as const,
                    progress_start_date: now.toISOString()
                };
                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업 진행이 시작되었습니다.');
                setDocumentData(updated);
            } else if (action === 'approve') {
                let updated: Document;
                let message = '';

                if (documentData.progress_details === '검수자') {
                    updated = { ...documentData, progress_details: '대표실무자' };
                    message = '대표실무자로 진행합니다.';
                } else if (documentData.progress_details === '대표실무자') {
                    updated = { ...documentData, status: 'assigned' as const, progress_details: '실무자' };
                    message = '실무자로 배정되었습니다.';
                } else {
                    const completedHours = String(now.getHours()).padStart(2, '0');
                    const completedMinutes = String(now.getMinutes()).padStart(2, '0');
                    const dateStr = now.toISOString().split('T')[0].replace(/(\d{4})-(\d{2})-(\d{2})/, '25-$2-$3');
                    updated = {
                        ...documentData,
                        status: 'approved' as const,
                        progress_status: 'stopped' as const,
                        completed_date: `${dateStr} ${completedHours}:${completedMinutes}`
                    };
                    message = '기업이 승인되었습니다.';
                }

                await saveDocumentToDatabase(updated);
                setSuccessMessage(message);
                setDocumentData(updated);
            } else if (action === 'reject') {
                const timeStr = now.toLocaleString('ko-KR', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });

                const newReason = `[${timeStr}] ${reasonInput || '사유 없음'}`;
                const combinedReason = documentData.reason ? `${documentData.reason}\n${newReason}` : newReason;

                const updated = {
                    ...documentData,
                    status: 'rejected' as const,
                    progress_status: 'not_started' as const,
                    progress_details: '영업자',
                    manager_name: null,
                    manager_id: null,
                    reason: combinedReason,
                    reason_read: false
                };

                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업이 반려되었습니다.');
                setDocumentData(updated);
            } else if (action === 'revision') {
                const timeStr = now.toLocaleString('ko-KR', {
                    year: '2-digit',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });

                const newReason = `[${timeStr}] ${reasonInput || '사유 없음'}`;
                const combinedReason = documentData.reason ? `${documentData.reason}\n${newReason}` : newReason;

                const updated = {
                    ...documentData,
                    status: 'revision' as const,
                    progress_status: 'not_started' as const,
                    progress_details: '영업자',
                    manager_name: null,
                    manager_id: null,
                    reason: combinedReason,
                    reason_read: false
                };

                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업 보완이 요청되었습니다.');
                setDocumentData(updated);
            } else if (action === 'submit') {
                let updated: Document;

                if (documentData.status === 'rejected' || documentData.status === 'revision') {
                    updated = {
                        ...documentData,
                        status: 'waiting' as const,
                        progress_status: 'not_started' as const,
                        progress_details: '검수자',
                        manager_name: null,
                        manager_id: null,
                        reason: null,
                        reason_read: false
                    };
                } else {
                    updated = {
                        ...documentData,
                        status: 'submitted' as const,
                        progress_status: 'stopped' as const,
                        submitted_date: now.toLocaleString('ko-KR')
                    };
                }

                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업이 제출되었습니다.');
                setDocumentData(updated);
            } else if (action === 'stop') {
                const updated = {
                    ...documentData,
                    progress_status: 'stopped' as const,
                    progress_end_time: timeString
                };
                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업 진행이 중지되었습니다.');
                setDocumentData(updated);
            } else if (action === 'delete') {
                await deleteDocumentFromDatabase(id);
                setSuccessMessage('기업이 삭제되었습니다.');
                setDocumentData(null);
            } else if (action === 'reset') {
                const updated = {
                    ...documentData,
                    status: 'waiting' as const,
                    progress_status: 'not_started' as const,
                    progress_details: '검수자',
                    progress_start_date: null,
                    progress_end_time: null,
                    stopped_time: null,
                    manager_name: null,
                    manager_id: null,
                    completed_date: null,
                    reason: null,
                    reason_read: false
                };
                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업이 초기화되었습니다.');
                setDocumentData(updated);
            }

            setActionConfirmModalOpen(false);
            setPendingAction(null);
            setPendingReasonAction(null);
            setReasonInput('');
            setSuccessModalOpen(true);
        } catch (error) {
            console.error('작업 수행 중 오류:', error);
            setError('작업 처리 중 오류가 발생했습니다.');
            setErrorModalOpen(true);
        }
    };

    const handleSuccessClose = () => {
        setSuccessModalOpen(false);
        // 삭제된 경우 목록으로 이동
        if (documentData === null) {
            router.push('/main/document_submission');
        } else {
            // 변경사항 반영을 위해 새로고침
            window.location.reload();
        }
    };

    const handleEnterEditMode = () => {
        router.push(`/main/company_create?view=${viewId}&edit=true`);
    };

    const handleCancel = () => {
        if (isViewMode && isEditMode) {
            // 수정 취소: 보기 모드로 복귀
            router.push(`/main/company_create?view=${viewId}`);
        } else {
            // 등록 취소: 뒤로가기
            router.back();
        }
    };

    const fileTypeLabel = formData.businessType === 'individual' ? '개인사업자' : '법인사업자';

    return (
        <div className={styles.formContainer}>
            <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>
                    {!isViewMode ? '기업 정보 입력' :
                     isEditMode ? '기업 정보 수정' :
                     '기업 정보 조회'}
                </h2>
                <p className={styles.formSubtitle}>
                    {!isViewMode ? '새로운 기업 정보를 등록해주세요.' :
                     isEditMode ? '기업 정보를 수정해주세요.' :
                     '기업 정보를 확인하세요.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                {/* 사업자 타입 선택 */}
                <div className={styles.businessTypeSection}>
                    <div className={styles.radioGroup}>
                        <div className={styles.radioOption}>
                            <input
                                type="radio"
                                id="individual"
                                name="businessType"
                                value="individual"
                                checked={formData.businessType === 'individual'}
                                onChange={() => handleBusinessTypeChange('individual')}
                                className={styles.radioInput}
                                disabled={isViewMode && !isEditMode}
                            />
                            <label htmlFor="individual" className={styles.radioLabel}>
                                개인사업자
                            </label>
                        </div>
                        <div className={styles.radioOption}>
                            <input
                                type="radio"
                                id="business"
                                name="businessType"
                                value="business"
                                checked={formData.businessType === 'business'}
                                onChange={() => handleBusinessTypeChange('business')}
                                className={styles.radioInput}
                                disabled={isViewMode && !isEditMode}
                            />
                            <label htmlFor="business" className={styles.radioLabel}>
                                법인사업자
                            </label>
                        </div>
                    </div>
                </div>

                {/* 공통 입력 폼 */}
                <div className={styles.commonFormSection}>
                    <div className={styles.formGroup}>
                        <label htmlFor="representative_name" className={styles.label}>
                            대표자명 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            id="representative_name"
                            name="representative_name"
                            value={formData.representative_name}
                            onChange={handleChange}
                            placeholder="대표자 이름을 입력해주세요"
                            className={styles.input}
                            disabled={isViewMode && !isEditMode}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="company_name" className={styles.label}>
                            회사명 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            id="company_name"
                            name="company_name"
                            value={formData.company_name}
                            onChange={handleChange}
                            placeholder="회사 이름을 입력해주세요"
                            className={styles.input}
                            disabled={isViewMode && !isEditMode}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="business_number" className={styles.label}>
                            사업자등록번호 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            id="business_number"
                            name="business_number"
                            value={formData.business_number}
                            onChange={handleChange}
                            placeholder="사업자등록번호를 입력해주세요"
                            maxLength={13}
                            className={styles.input}
                            disabled={isViewMode && !isEditMode}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="phone" className={styles.label}>
                            대표자 연락처 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="연락처를 입력해주세요"
                            maxLength={13}
                            className={styles.input}
                            disabled={isViewMode && !isEditMode}
                        />
                    </div>
                </div>

                {/* 파일 업로드 - 보기 전용 모드에서 숨김 */}
                {(!isViewMode || isEditMode) && (
                <div className={styles.fileUploadSection}>
                    <label className={styles.sectionTitle}>
                        파일 업로드 ({fileTypeLabel})
                    </label>
                    <div className={styles.uploadArea}>
                        <label htmlFor="fileInput" className={styles.uploadLabel} style={isViewMode && !isEditMode ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                            <div className={styles.uploadIcon}>📎</div>
                            <div className={styles.uploadText}>
                                <p className={styles.uploadMain}>파일을 선택하거나 드래그하여 업로드</p>
                                <p className={styles.uploadSub}>최대 50MB까지 업로드 가능합니다.</p>
                            </div>
                        </label>
                        <input
                            type="file"
                            id="fileInput"
                            onChange={handleFileSelect}
                            multiple
                            className={styles.fileInput}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp,.jpg,.jpeg,.png"
                            disabled={isViewMode && !isEditMode}
                        />
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className={styles.fileList}>
                            <p className={styles.fileListTitle}>선택된 파일 ({selectedFiles.length}개)</p>
                            <ul className={styles.files}>
                                {selectedFiles.map((file, index) => (
                                    <li key={index} className={styles.fileItem}>
                                        <span className={styles.fileName}>{file.name}</span>
                                        <span className={styles.fileSize}>
                                            ({(file.size / 1024 / 1024).toFixed(2)}MB)
                                        </span>
                                        {(!isViewMode || isEditMode) && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(index)}
                                            className={styles.removeButton}
                                        >
                                            ✕
                                        </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
                )}

                {/* 기존 파일 목록 (보기/수정 모드) */}
                {isViewMode && existingFiles.length > 0 && (
                <div className={styles.fileUploadSection}>
                    <label className={styles.sectionTitle}>
                        등록된 파일
                    </label>
                    <div className={styles.fileList}>
                        <p className={styles.fileListTitle}>파일 ({existingFiles.length}개)</p>
                        <ul className={styles.files}>
                            {existingFiles.map((file, index) => (
                                <li key={index} className={styles.fileItem}>
                                    <button
                                        type="button"
                                        onClick={() => handleViewFile(file)}
                                        className={styles.fileNameButton}
                                        title="클릭하여 보기"
                                    >
                                        {file.name}
                                    </button>
                                    <span className={styles.fileSize}>
                                        ({(file.size / 1024 / 1024).toFixed(2)}MB)
                                    </span>
                                    {isEditMode && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveExistingFile(index)}
                                        className={styles.removeButton}
                                    >
                                        ✕
                                    </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {downloadError && (
                        <div className={styles.errorMessage}>
                            {downloadError}
                        </div>
                    )}

                    <div className={styles.downloadButtonContainer}>
                        <button
                            type="button"
                            className={styles.downloadButton}
                            onClick={handleDownloadZip}
                            disabled={isDownloading}
                        >
                            {isDownloading ? '다운로드 중...' : 'ZIP 다운로드'}
                        </button>
                    </div>
                </div>
                )}

                {/* 메모 섹션 */}
                {(isViewMode || !isViewMode) && (
                <div className={styles.memoSection}>
                    {/* 메모 목록 (타임라인) - 보기/수정 모드에서만 */}
                    {isViewMode && documentData?.memos && documentData.memos.length > 0 && (
                        <div className={styles.memoTimeline}>
                            {documentData.memos.map((memo: DocumentMemo, index: number) => (
                                <div key={index} className={styles.memoItem}>
                                    <div className={styles.memoHeader}>
                                        <span className={styles.memoTime}>{memo.timestamp}</span>
                                        <span className={styles.memoAuthor}>{memo.user_name} ({memo.user_id})</span>
                                    </div>
                                    <div className={styles.memoContent}>{memo.content}</div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 메모 없음 */}
                    {isViewMode && (!documentData?.memos || documentData.memos.length === 0) && (
                        <div className={styles.noMemos}>등록된 메모가 없습니다.</div>
                    )}

                    {/* 메모 입력 - 생성 모드 또는 수정 모드일 때 */}
                    {(!isViewMode || isEditMode) && (
                        <div className={styles.memoInputContainer}>
                            <label className={styles.memoInputLabel}>메모 (선택사항)</label>
                            <textarea
                                value={memoInput}
                                onChange={(e) => setMemoInput(e.target.value)}
                                placeholder="메모를 입력해주세요."
                                className={styles.memoInput}
                                rows={3}
                            />
                            {isViewMode && isEditMode && (
                                <button
                                    type="button"
                                    onClick={handleAddMemo}
                                    className={styles.memoAddButton}
                                    disabled={!memoInput.trim()}
                                >
                                    메모 추가
                                </button>
                            )}
                        </div>
                    )}
                </div>
                )}

                {/* 작업 버튼 그리드 - 보기 모드 */}
                {isViewMode && !isEditMode && (
                <div className={styles.actionsGridContainer}>
                    <div className={styles.actionsGrid}>
                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles['action-start']}`}
                            onClick={() => documentData && handleProgressStart(documentData.id)}
                        >
                            진행
                        </button>
                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles['action-stop']}`}
                            onClick={() => documentData && handleProgressStop(documentData.id)}
                        >
                            중지
                        </button>
                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles['action-approve']}`}
                            onClick={() => documentData && handleApprove(documentData.id)}
                        >
                            승인
                        </button>
                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles['action-reject']}`}
                            onClick={() => documentData && handleReject(documentData.id)}
                        >
                            반려
                        </button>
                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles['action-revision']}`}
                            onClick={() => documentData && handleRevision(documentData.id)}
                        >
                            보완
                        </button>
                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles['action-submit']}`}
                            onClick={() => documentData && handleActionSubmit(documentData.id)}
                        >
                            제출
                        </button>
                        <button
                            type="button"
                            className={`${styles.actionButton} ${styles['action-delete']}`}
                            onClick={() => documentData && handleProgressDelete(documentData.id)}
                        >
                            삭제
                        </button>
                    </div>
                </div>
                )}

                {/* 버튼 */}
                <div className={styles.formButtons}>
                    {isViewMode && !isEditMode ? (
                        // 보기 모드: 수정 버튼(권한 있으면) + 닫기 버튼
                        <>
                            {canEdit && (
                            <button
                                type="button"
                                onClick={handleEnterEditMode}
                                className={styles.submitButton}
                            >
                                수정
                            </button>
                            )}
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className={styles.cancelButton}
                            >
                                닫기
                            </button>
                        </>
                    ) : (
                        // 등록/수정 모드: 취소 + 등록/저장
                        <>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className={styles.cancelButton}
                                disabled={loading}
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={loading}
                            >
                                {loading ? '처리 중...' : (isViewMode && isEditMode ? '저장' : '등록')}
                            </button>
                        </>
                    )}
                </div>
            </form>

            {/* 에러 모달 */}
            <Modal
                isOpen={errorModalOpen}
                message={error}
                type="error"
                onClose={() => {
                    setErrorModalOpen(false);
                    // 권한 거부 에러인 경우 문서 목록으로 이동
                    if (error === '접근 권한이 없습니다.') {
                        router.push('/main/document_submission');
                    }
                }}
                confirmText="확인"
                showConfirmButton={false}
            />

            {/* 확인 모달 - 폼 등록/저장 시에만 표시 */}
            <Modal
                isOpen={confirmModalOpen && !pendingAction && !pendingReasonAction}
                message="입력하신 기업 정보를 등록하시겠습니까?"
                type="info"
                onConfirm={handleConfirmSubmit}
                onClose={() => setConfirmModalOpen(false)}
                confirmText="등록"
                showConfirmButton={true}
            />

            {/* 완료 모달 */}
            <Modal
                isOpen={successModalOpen}
                message={successMessage || "기업 정보가 성공적으로 등록되었습니다."}
                type="success"
                onConfirm={handleSuccessClose}
                onClose={handleSuccessClose}
                confirmText="확인"
                showConfirmButton={false}
            />

            {/* 이유 입력 모달 */}
            {reasonInputModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1001
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>
                            {pendingReasonAction?.action === 'reject' ? '반려 사유' : '보완 사유'}
                        </h3>
                        <textarea
                            value={reasonInput}
                            onChange={(e) => setReasonInput(e.target.value)}
                            placeholder="사유를 입력해주세요."
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                        <div style={{
                            marginTop: '20px',
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => {
                                    setReasonInputModalOpen(false);
                                    setPendingReasonAction(null);
                                    setReasonInput('');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    backgroundColor: '#f5f5f5',
                                    cursor: 'pointer'
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={() => {
                                    setPendingAction({
                                        id: pendingReasonAction?.id || documentData?.id,
                                        action: pendingReasonAction?.action === 'reject' ? 'reject' : 'revision'
                                    });
                                    setActionConfirmType(pendingReasonAction?.action === 'reject' ? 'reject' : 'revision');
                                    setReasonInputModalOpen(false);
                                    setActionConfirmModalOpen(true);
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 액션 확인 모달 (이미지 있는 커스텀 모달) */}
            <ConfirmModal
                isOpen={actionConfirmModalOpen}
                type="warning"
                message={
                    actionConfirmType === 'start' ? '기업 진행을 시작하시겠습니까?' :
                    actionConfirmType === 'stop' ? '기업 진행을 중지하시겠습니까?' :
                    actionConfirmType === 'delete' ? '이 기업을 삭제하시겠습니까?' :
                    actionConfirmType === 'approve' ? '기업을 승인하시겠습니까?' :
                    actionConfirmType === 'reject' ? '기업을 반려하시겠습니까?' :
                    actionConfirmType === 'revision' ? '기업 보완을 요청하시겠습니까?' :
                    actionConfirmType === 'submit' ? '기업을 제출하시겠습니까?' :
                    '기업을 초기화하시겠습니까?\n(대기 상태로 돌아갑니다)'
                }
                onConfirm={handleConfirmAction}
                onCancel={() => setActionConfirmModalOpen(false)}
                confirmButtonText="확인"
                cancelButtonText="취소"
            />

            {/* 실무자 선택 모달 */}
            {managerSelectModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1001
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        padding: '20px',
                        borderRadius: '8px',
                        maxWidth: '500px',
                        width: '90%',
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>실무자 선택</h3>
                        <select
                            value={selectedManager}
                            onChange={(e) => setSelectedManager(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '14px'
                            }}
                        >
                            <option value="">실무자를 선택해주세요.</option>
                            {workers.map((worker) => (
                                <option key={worker.id} value={worker.user_id}>
                                    {worker.name}
                                </option>
                            ))}
                        </select>
                        <div style={{
                            marginTop: '20px',
                            display: 'flex',
                            gap: '10px',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                onClick={() => {
                                    setManagerSelectModalOpen(false);
                                    setSelectedManagerId(null);
                                    setSelectedManager('');
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    backgroundColor: '#f5f5f5',
                                    cursor: 'pointer'
                                }}
                            >
                                취소
                            </button>
                            <button
                                onClick={async () => {
                                    if (selectedManager) {
                                        const selectedWorker = workers.find(w => w.user_id === selectedManager);
                                        const updated = {
                                            ...documentData,
                                            progress_details: '실무자',
                                            manager_id: selectedManager,
                                            manager_name: selectedWorker?.name || ''
                                        };
                                        await saveDocumentToDatabase(updated);
                                        setDocumentData(updated);
                                        setSuccessMessage('실무자가 배정되었습니다.');
                                        setManagerSelectModalOpen(false);
                                        setSelectedManagerId(null);
                                        setSelectedManager('');
                                        setSuccessModalOpen(true);
                                    }
                                }}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    backgroundColor: '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 파일 뷰어 모달 */}
            {fileViewerOpen && selectedFile && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1002
                }}>
                    <div className={styles.fileViewerModal}>
                        {/* 헤더 */}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '16px 20px',
                            borderBottom: '1px solid #e0e0e0'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                                {selectedFile.name}
                            </h3>
                            <button
                                onClick={() => {
                                    setFileViewerOpen(false);
                                    setSelectedFile(null);
                                    setFileViewUrl('');
                                }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    padding: '0'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* 콘텐츠 */}
                        <div style={{
                            flex: 1,
                            overflow: 'auto',
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            backgroundColor: '#f5f5f5'
                        }}>
                            {fileViewUrl ? (
                                (() => {
                                    const ext = getFileExtension(selectedFile.name);
                                    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                                    const isPdf = ext === 'pdf';

                                    return (
                                        <>
                                            {isImage && (
                                                <img
                                                    src={fileViewUrl}
                                                    alt={selectedFile.name}
                                                    style={{
                                                        maxWidth: '100%',
                                                        maxHeight: '100%',
                                                        objectFit: 'contain'
                                                    }}
                                                />
                                            )}
                                            {isPdf && (
                                                <iframe
                                                    src={fileViewUrl}
                                                    style={{
                                                        width: '100%',
                                                        height: '100%',
                                                        border: 'none'
                                                    }}
                                                />
                                            )}
                                            {!isImage && !isPdf && (
                                                <div style={{
                                                    textAlign: 'center',
                                                    color: '#666'
                                                }}>
                                                    <p>이 파일은 웹에서 미리 볼 수 없습니다.</p>
                                                    <a
                                                        href={fileViewUrl}
                                                        download
                                                        style={{
                                                            color: 'var(--main-color)',
                                                            textDecoration: 'none',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        파일 다운로드
                                                    </a>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()
                            ) : (
                                <div style={{ color: '#999' }}>파일을 불러오는 중...</div>
                            )}
                        </div>

                        {/* 푸터 */}
                        <div style={{
                            padding: '12px 20px',
                            borderTop: '1px solid #e0e0e0',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                                {(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                            </span>
                            <a
                                href={fileViewUrl}
                                download={selectedFile.name}
                                style={{
                                    padding: '6px 14px',
                                    backgroundColor: 'var(--main-color)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    fontSize: '13px',
                                    fontWeight: '600'
                                }}
                            >
                                다운로드
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
