'use client';

import { useState, useEffect, useRef } from 'react';
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
    memos?: DocumentMemo[];
    cretop_file?: { name: string; path: string; url: string } | null;
    cretop_none?: boolean;
    created_at?: string;
}

interface Worker {
    id: number;
    user_id: string;
    name: string;
    position_id: number;
    position?: { id: number; name: string; level: number };
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
    const [accessDenied, setAccessDenied] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isViewMode, setIsViewMode] = useState(!!viewId);  // viewId가 있으면 true로 초기화
    const [isEditMode, setIsEditMode] = useState(false);
    const [canEdit, setCanEdit] = useState(false);
    const [documentData, setDocumentData] = useState<any>(null);
    const [pendingAction, setPendingAction] = useState<{ id: number; action: 'start' | 'stop' | 'restart' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' | 'reset' } | null>(null);
    const [reasonInputModalOpen, setReasonInputModalOpen] = useState(false);
    const [reasonInput, setReasonInput] = useState('');
    const [pendingReasonAction, setPendingReasonAction] = useState<{ id: number; action: 'reject' | 'revision' } | null>(null);
    const [managerSelectModalOpen, setManagerSelectModalOpen] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState<number | null>(null);
    const [selectedManager, setSelectedManager] = useState<string>('');
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [successMessage, setSuccessMessage] = useState('');
    const [actionConfirmModalOpen, setActionConfirmModalOpen] = useState(false);
    const [actionConfirmType, setActionConfirmType] = useState<'start' | 'stop' | 'restart' | 'delete' | 'approve' | 'reject' | 'revision' | 'submit' | 'reset'>('start');
    const [memoInput, setMemoInput] = useState('');
    const [currentUser, setCurrentUser] = useState<{ id: string; name: string } | null>(null);
    const [fileViewerOpen, setFileViewerOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState<{ name: string; path: string; size: number } | null>(null);
    const [fileViewUrl, setFileViewUrl] = useState('');
    const [supervisorInfo, setSupervisorInfo] = useState<{ name: string; user_id: string } | null>(null);
    const [isLoading, setIsLoading] = useState(!!viewId);  // viewId가 있으면 true로 초기화 (로딩 상태로 시작)
    const [isMobile, setIsMobile] = useState(false);
    const [imageZoom, setImageZoom] = useState(1);
    const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [sidePanelWidth, setSidePanelWidth] = useState(700);
    const [isResizing, setIsResizing] = useState(false);
    const [imageRotation, setImageRotation] = useState(0);
    const [cretopUploading, setCretopUploading] = useState(false);
    const [cretopDragOver, setCretopDragOver] = useState(false);
    const [selectedCretopFile, setSelectedCretopFile] = useState<File | null>(null);
    const cretopInputRef = useRef<HTMLInputElement>(null);

    // 모바일 감지
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

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
            // 생성 모드에서만 workers 조회 (뷰 모드에서는 fetchDocumentData에서 조회)
            fetchWorkers();
        }

        initializeCurrentUser();
    }, [router, viewId]);

    // 보기/수정 모드일 때 문서 정보 로드
    useEffect(() => {
        if (viewId) {
            fetchDocumentData(parseInt(viewId));
        }
    }, [viewId, editParam]);

    const fetchDocumentData = async (docId: number) => {
        setIsLoading(true);
        try {
            const adminData = getAdminData();
            const userLevel = adminData?.position?.level;
            const userId = adminData?.user_id;

            // 통합 API로 한 번에 모든 데이터 조회
            const response = await fetch(`/api/documents/${docId}/view`);

            if (!response.ok) {
                const errorData = await response.json();
                if (response.status === 403) {
                    setIsLoading(false);
                    setAccessDenied(true);
                    return;
                }
                throw new Error(errorData.error || '문서 조회 실패');
            }

            const { document: data, users: usersData, supervisorInfo: supervisorData, inspectorAffiliations } = await response.json();

            // workers 상태 업데이트
            setWorkers(usersData);

            // 담당검수자 정보 설정
            if (supervisorData) {
                setSupervisorInfo(supervisorData);
            }

            // 검수자 수정 권한을 위한 assignedSalesManagerIds
            let assignedSalesManagerIds: string[] = [];
            if (userLevel === 6 && inspectorAffiliations?.length > 0) {
                const documentAuthor = usersData.find((user: any) => user.user_id === data.user_id);
                const authorCompanyName = documentAuthor?.company_name || '';
                if (inspectorAffiliations.includes(authorCompanyName)) {
                    assignedSalesManagerIds = [data.user_id];
                }
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
                data.user_id,
                undefined,
                assignedSalesManagerIds.length > 0 ? assignedSalesManagerIds : undefined,
                data.inspector_id,
                data.manager_id,
                data.progress_details
            );

            setCanEdit(hasEditPermission);

            // edit 파라미터가 있지만 권한이 없으면 뷰 페이지로 리다이렉트
            if (editParam === 'true' && !hasEditPermission) {
                setIsEditMode(false);
                router.replace(`/main/company_create?view=${viewId}`);
                return;
            }

            // 권한이 있을 때만 URL의 edit 파라미터를 반영
            if (hasEditPermission && editParam === 'true') {
                setIsEditMode(true);
            } else {
                // edit 파라미터가 없으면 뷰 모드로 설정
                setIsEditMode(false);
            }
        } catch (err) {
            console.error('문서 데이터 로드 실패:', err);
            setError('문서 정보를 불러오지 못했습니다.');
            setErrorModalOpen(true);
        } finally {
            setIsLoading(false);
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
            const files = Array.from(e.target.files);
            const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'hwp', 'jpg', 'jpeg', 'png', 'zip'];

            // 지원되지 않는 파일 검사
            const unsupportedFiles = files.filter(file => {
                const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
                return !allowedExtensions.includes(fileExt);
            });

            if (unsupportedFiles.length > 0) {
                setError(`지원되지 않는 파일: ${unsupportedFiles.map(f => f.name).join(', ')}\n\n지원되는 형식: PDF, DOC, DOCX, XLS, XLSX, HWP, JPG, JPEG, PNG, ZIP`);
                setErrorModalOpen(true);
                e.target.value = ''; // 파일 입력 초기화
                return;
            }

            setSelectedFiles(files);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        if (e.dataTransfer.files) {
            const files = Array.from(e.dataTransfer.files);
            const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'hwp', 'jpg', 'jpeg', 'png', 'zip'];

            // 지원되지 않는 파일 검사
            const unsupportedFiles = files.filter(file => {
                const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
                return !allowedExtensions.includes(fileExt);
            });

            if (unsupportedFiles.length > 0) {
                setError(`지원되지 않는 파일: ${unsupportedFiles.map(f => f.name).join(', ')}\n\n지원되는 형식: PDF, DOC, DOCX, XLS, XLSX, HWP, JPG, JPEG, PNG, ZIP`);
                setErrorModalOpen(true);
                return;
            }

            setSelectedFiles(files);
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

    const handleRemoveCretopFile = () => {
        setSelectedCretopFile(null);
        if (cretopInputRef.current) {
            cretopInputRef.current.value = '';
        }
    };

    const handleRemoveExistingCretop = async () => {
        if (!documentData?.cretop_file) return;

        try {
            // 스토리지에서 파일 삭제
            await fetch(`/api/upload?path=${encodeURIComponent(documentData.cretop_file.path)}`, {
                method: 'DELETE',
            });

            // 데이터베이스 업데이트
            const updated = {
                ...documentData,
                cretop_file: null,
                cretop_none: false
            };

            await saveDocumentToDatabase(updated);
            setDocumentData(updated);
            setSuccessMessage('크레탑 파일이 삭제되었습니다.');
        } catch (err) {
            console.error('크레탑 파일 삭제 중 오류:', err);
            setError('크레탑 파일 삭제 중 오류가 발생했습니다.');
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
            const companyNameToSend = documentData?.company_name || '기업';
            console.log('[ZIP 다운로드] 프론트엔드 데이터:', {
                documentId: viewId || documentData?.id,
                companyName: companyNameToSend,
                documentDataKeys: Object.keys(documentData || {})
            });

            const response = await fetch('/api/download/zip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentId: viewId || documentData?.id,
                    files: existingFiles,
                    companyName: companyNameToSend,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData.message ? `${errorData.error} - ${errorData.message}` : (errorData.error || '다운로드 실패');
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = globalThis.document.createElement('a');
            link.href = url;
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            link.download = `${companyNameToSend}_${dateStr}.zip`;
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

    const handleDownloadCretopZip = async () => {
        if (!documentData?.cretop_file) {
            setDownloadError('다운로드할 크레탑 파일이 없습니다.');
            return;
        }

        setIsDownloading(true);
        setDownloadError('');

        try {
            const companyNameToSend = documentData?.company_name || '기업';
            const cretopFiles = [{
                name: documentData.cretop_file.name,
                path: documentData.cretop_file.path,
                size: 0
            }];

            const response = await fetch('/api/download/zip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentId: viewId || documentData?.id,
                    files: cretopFiles,
                    companyName: `${companyNameToSend}_크레탑`,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData.message ? `${errorData.error} - ${errorData.message}` : (errorData.error || '다운로드 실패');
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = globalThis.document.createElement('a');
            link.href = url;
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            link.download = `${companyNameToSend}_크레탑_${dateStr}.zip`;
            globalThis.document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            globalThis.document.body.removeChild(link);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '파일 다운로드 중 오류가 발생했습니다.';
            setDownloadError(errorMessage);
            console.error('크레탑 ZIP 다운로드 오류:', error);
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

        // 파일 검증 (생성 모드에서만)
        // 생성 모드: 새 파일 필수 (1개 이상)
        if (!isViewMode && !isEditMode && selectedFiles.length === 0) {
            setError('파일을 최소 1개 이상 업로드해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        // 수정 모드는 handleConfirmSubmit에서 검증

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

            // 수정 모드: 파일 및 크레탑 검증
            if (isViewMode && isEditMode) {
                // 파일 검증: 1개 이상 필수
                const totalFiles = existingFiles.length + selectedFiles.length;
                if (totalFiles === 0) {
                    setError('파일을 최소 1개 이상 보유해야 합니다.');
                    setErrorModalOpen(true);
                    setLoading(false);
                    return;
                }

                // 크레탑 검증: 파일 또는 기업정보없음 중 하나 필수
                const hasCretopFile = documentData?.cretop_file || selectedCretopFile;
                const hasCretopNone = documentData?.cretop_none;
                if (!hasCretopFile && !hasCretopNone) {
                    setError('크레탑 파일을 업로드하거나 기업정보없음을 선택해야 합니다.');
                    setErrorModalOpen(true);
                    setLoading(false);
                    return;
                }
            }

            let uploadedFiles: Array<{ name: string; path: string; size: number }> = [];

            // 새로운 파일 업로드 (Signed URL 사용 - 대용량 파일 지원)
            if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                    try {
                        console.log(`파일 업로드 시작: ${file.name}, 크기: ${file.size} bytes, 타입: ${file.type}`);

                        const fileExt = file.name.split('.').pop();
                        const timestamp = Date.now();
                        const date = new Date(timestamp);
                        const timeStr = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
                        const randomStr = Math.random().toString(36).substring(2, 9);
                        const fileName = `${timeStr}-${randomStr}.${fileExt}`;
                        const businessTypeFolder = formData.businessType === 'individual' ? 'individual' : 'business';
                        const filePath = `companies/${businessTypeFolder}/${fileName}`;

                        // 1. Signed URL 요청
                        console.log(`Signed URL 요청 중: ${filePath}`);
                        const signedUrlResponse = await fetch('/api/upload/signed-url', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ path: filePath, contentType: file.type || 'application/octet-stream' }),
                        });

                        if (!signedUrlResponse.ok) {
                            const errorData = await signedUrlResponse.json().catch(() => ({}));
                            console.error('Signed URL 생성 실패:', errorData);
                            throw new Error(errorData.error || `Signed URL 생성 실패: ${file.name} (${signedUrlResponse.status})`);
                        }

                        const signedUrlData = await signedUrlResponse.json();
                        const { signedUrl } = signedUrlData;
                        console.log(`Signed URL 생성 완료: ${file.name}`);

                        // 2. 재시도 로직과 함께 파일 업로드
                        let uploadSuccess = false;
                        let lastError: Error | null = null;
                        const maxRetries = 3;
                        const retryDelay = 1000; // 1초

                        for (let attempt = 0; attempt < maxRetries; attempt++) {
                            try {
                                console.log(`파일 업로드 시도 ${attempt + 1}/${maxRetries}: ${file.name}`);
                                const uploadResponse = await fetch(signedUrl, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': file.type || 'application/octet-stream' },
                                    body: file,
                                    signal: AbortSignal.timeout(120000), // 120초 타임아웃
                                });

                                if (!uploadResponse.ok) {
                                    const responseText = await uploadResponse.text().catch(() => '');
                                    console.error(`업로드 실패 (${uploadResponse.status}): ${responseText}`);
                                    throw new Error(`HTTP ${uploadResponse.status}: ${uploadResponse.statusText}${responseText ? ' - ' + responseText : ''}`);
                                }

                                console.log(`✓ 파일 업로드 성공: ${file.name}`);
                                uploadSuccess = true;
                                break;
                            } catch (err) {
                                lastError = err instanceof Error ? err : new Error(String(err));
                                console.warn(`파일 업로드 실패: ${lastError.message}`);
                                if (attempt < maxRetries - 1) {
                                    console.log(`재시도 ${attempt + 1}/${maxRetries - 1}: 1초 대기 후 재시도`);
                                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                                }
                            }
                        }

                        if (!uploadSuccess) {
                            const errorMsg = `파일 업로드 실패 (${maxRetries}회 시도): ${file.name} - ${lastError?.message}`;
                            console.error(errorMsg);
                            throw new Error(errorMsg);
                        }

                        uploadedFiles.push({
                            name: file.name,
                            path: filePath,
                            size: file.size,
                        });
                    } catch (err) {
                        const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
                        console.error(`파일 업로드 중 오류: ${errorMsg}`);
                        throw new Error(`파일 업로드 중 오류 발생: ${errorMsg}`);
                    }
                }
            }

            // 크레탑 파일 업로드는 수정 모드일 때만 여기서 처리
            // 생성 모드일 때는 문서 생성 후에 처리
            let cretopFileData: { name: string; path: string; url: string; size: number } | null = null;
            if (selectedCretopFile && isViewMode && isEditMode) {
                try {
                    console.log(`크레탑 파일 업로드 시작: ${selectedCretopFile.name}, 크기: ${selectedCretopFile.size} bytes`);

                    const fileExt = selectedCretopFile.name.split('.').pop() || 'bin';
                    const fileName = `cretop_${viewId}_${Date.now()}.${fileExt}`;
                    const filePath = `cretop/${fileName}`;

                    // 1. Signed URL 요청
                    console.log(`Signed URL 요청 중: ${filePath}`);
                    const signedUrlResponse = await fetch('/api/upload/signed-url', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path: filePath, contentType: selectedCretopFile.type || 'application/octet-stream' }),
                    });

                    if (!signedUrlResponse.ok) {
                        const errorData = await signedUrlResponse.json().catch(() => ({}));
                        throw new Error(errorData.error || `Signed URL 생성 실패: ${selectedCretopFile.name}`);
                    }

                    const signedUrlData = await signedUrlResponse.json();
                    const { signedUrl, fullPath } = signedUrlData;
                    console.log(`Signed URL 생성 완료: ${selectedCretopFile.name}`);

                    // 2. 재시도 로직과 함께 파일 업로드
                    let uploadSuccess = false;
                    let lastError: Error | null = null;
                    const maxRetries = 3;
                    const retryDelay = 1000; // 1초

                    for (let attempt = 0; attempt < maxRetries; attempt++) {
                        try {
                            console.log(`크레탑 파일 업로드 시도 ${attempt + 1}/${maxRetries}: ${selectedCretopFile.name}`);
                            const uploadResponse = await fetch(signedUrl, {
                                method: 'PUT',
                                headers: { 'Content-Type': selectedCretopFile.type || 'application/octet-stream' },
                                body: selectedCretopFile,
                                signal: AbortSignal.timeout(120000), // 120초 타임아웃
                            });

                            if (!uploadResponse.ok) {
                                throw new Error(`HTTP ${uploadResponse.status}: ${uploadResponse.statusText}`);
                            }

                            console.log(`✓ 크레탑 파일 업로드 성공: ${selectedCretopFile.name}`);
                            uploadSuccess = true;
                            break;
                        } catch (err) {
                            lastError = err instanceof Error ? err : new Error(String(err));
                            console.warn(`크레탑 파일 업로드 실패: ${lastError.message}`);
                            if (attempt < maxRetries - 1) {
                                console.log(`재시도 ${attempt + 1}/${maxRetries - 1}: 1초 대기 후 재시도`);
                                await new Promise(resolve => setTimeout(resolve, retryDelay));
                            }
                        }
                    }

                    if (!uploadSuccess) {
                        throw new Error(`크레탑 파일 업로드 실패 (${maxRetries}회 시도): ${selectedCretopFile.name}`);
                    }

                    cretopFileData = {
                        name: selectedCretopFile.name,
                        path: filePath,
                        url: fullPath,
                        size: selectedCretopFile.size
                    };
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : '알 수 없는 오류';
                    console.error(`크레탑 파일 업로드 중 오류: ${errorMsg}`);
                    throw new Error(`크레탑 파일 업로드 중 오류 발생: ${errorMsg}`);
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
                const editBody: any = {
                    ...requestBody,
                    files: uploadedFiles,
                };

                // 크레탑 파일 추가 (있으면)
                if (cretopFileData) {
                    editBody.cretop_file = cretopFileData;
                }

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

                const createBody: any = {
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

                // 크레탑 파일 추가 (있으면)
                if (cretopFileData) {
                    createBody.cretop_file = cretopFileData;
                }

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

            // 수정/생성 완료 메시지 설정
            if (isViewMode && isEditMode) {
                setSuccessMessage('기업 정보가 성공적으로 수정되었습니다.');
            } else {
                setSuccessMessage('기업 정보가 성공적으로 등록되었습니다.');
            }

            setLoading(false);
            setSuccessModalOpen(true);
            
            // 크레탑 파일 선택 상태 초기화
            setSelectedCretopFile(null);
            if (cretopInputRef.current) {
                cretopInputRef.current.value = '';
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '오류가 발생했습니다.';
            setError(errorMessage);
            setErrorModalOpen(true);
            setLoading(false);
        }
    };

    const fetchWorkers = async () => {
        try {
            const response = await fetch('/api/users');
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

        // 로컬 상태만 먼저 업데이트 (UI 즉시 반영)
        setDocumentData({
            ...documentData,
            memos: updatedMemos
        });
        setMemoInput('');

        // 데이터베이스에 저장 (백그라운드)
        await saveDocumentToDatabase({
            ...documentData,
            memos: updatedMemos
        });
    };

    const handleDeleteMemo = async (memoIndex: number) => {
        if (!documentData) return;

        const updatedMemos = documentData.memos?.filter((_, index) => index !== memoIndex) || [];

        // 로컬 상태만 먼저 업데이트 (UI 즉시 반영)
        setDocumentData({
            ...documentData,
            memos: updatedMemos
        });

        // 데이터베이스에 저장 (백그라운드)
        await saveDocumentToDatabase({
            ...documentData,
            memos: updatedMemos
        });
    };

    // 크레탑 파일 선택
    const handleCretopUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;

        const file = e.target.files[0];

        try {
            // 파일 타입 검증
            const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'zip'];
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

            const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

            if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
                throw new Error('지원하지 않는 파일 형식입니다. (PDF, JPG, PNG, GIF, ZIP만 가능)');
            }

            // 파일 크기 검증 (5GB 제한)
            const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
            if (file.size > maxSize) {
                throw new Error(`파일 크기가 너무 큽니다. (최대 5GB, 현재 ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB)`);
            }

            // 선택된 파일 상태에 저장
            setSelectedCretopFile(file);
            setSuccessMessage('크레탑 파일이 선택되었습니다.');
        } catch (err: any) {
            setError(err.message || '파일 선택 중 오류가 발생했습니다.');
            setErrorModalOpen(true);
            if (cretopInputRef.current) {
                cretopInputRef.current.value = '';
            }
        }
    };

    // 크레탑 드래그 앤 드롭 핸들러
    const handleCretopDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setCretopDragOver(true);
    };

    const handleCretopDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setCretopDragOver(false);
    };

    const handleCretopDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setCretopDragOver(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];

            try {
                // 파일 타입 검증
                const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'zip'];
                const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream'];

                const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

                if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
                    throw new Error('지원하지 않는 파일 형식입니다. (PDF, JPG, PNG, GIF, ZIP만 가능)');
                }

                // 파일 크기 검증 (5GB 제한)
                const maxSize = 5 * 1024 * 1024 * 1024; // 5GB
                if (file.size > maxSize) {
                    throw new Error(`파일 크기가 너무 큽니다. (최대 5GB, 현재 ${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB)`);
                }

                // 선택된 파일 상태에 저장
                setSelectedCretopFile(file);
                setSuccessMessage('크레탑 파일이 선택되었습니다.');
            } catch (err: any) {
                setError(err.message || '파일 선택 중 오류가 발생했습니다.');
                setErrorModalOpen(true);
            }
        }
    };

    // 기업정보없음 설정
    const handleCretopNone = async () => {
        if (!documentData) return;

        const updated = {
            ...documentData,
            cretop_file: null,
            cretop_none: true
        };

        await saveDocumentToDatabase(updated);
        setDocumentData(updated);
        setSuccessMessage('기업정보없음으로 설정되었습니다.');
    };

    // 크레탑 파일 삭제
    const handleCretopDelete = async () => {
        if (!documentData) return;

        const updated = {
            ...documentData,
            cretop_file: null,
            cretop_none: false
        };

        await saveDocumentToDatabase(updated);
        setDocumentData(updated);
        setSuccessMessage('크레탑 파일이 삭제되었습니다.');
    };

    const handleImageWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setImageZoom(prev => Math.min(Math.max(0.5, prev + delta), 3));
    };

    const handleImageMouseDown = (e: React.MouseEvent) => {
        if (imageZoom > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - imagePosition.x, y: e.clientY - imagePosition.y });
        }
    };

    const handleImageMouseMove = (e: React.MouseEvent) => {
        if (isDragging && imageZoom > 1) {
            setImagePosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleImageMouseUp = () => {
        setIsDragging(false);
    };

    const handleResizeStart = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);

        const startX = e.clientX;
        const startWidth = sidePanelWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const diff = startX - moveEvent.clientX;
            const newWidth = Math.min(Math.max(400, startWidth + diff), window.innerWidth * 0.8);
            setSidePanelWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleViewFile = async (file: { name: string; path: string; size: number }) => {
        setSelectedFile(file);
        setFileViewerOpen(true);
        setImageZoom(1);
        setImagePosition({ x: 0, y: 0 });
        setImageRotation(0);

        try {
            const response = await fetch('/api/file/view', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ filePath: file.path }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || '파일 조회 실패');
            }

            const data = await response.json();
            setFileViewUrl(data.url);
        } catch (error) {
            console.error('파일 조회 오류:', error);
            setError(error instanceof Error ? error.message : '파일을 조회할 수 없습니다.');
            setErrorModalOpen(true);
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
        // 검수자 또는 대표실무자 상태에서는 진행할 수 없음
        if (documentData?.progress_details === '검수자' || documentData?.progress_details === '대표실무자') {
            setError('실무자가 배정되어있지 않으면<br>진행할수없습니다.');
            setErrorModalOpen(true);
            return;
        }

        // 진행 조건 확인: 실무자 배정 필수 & 상태가 대기
        if (!documentData?.manager_id || documentData?.status !== 'waiting') {
            setError('실무자가 배정되어있지 않으면<br>진행할수없습니다.');
            setErrorModalOpen(true);
            return;
        }

        setPendingAction({ id, action: 'start' });
        setActionConfirmType('start');
        setActionConfirmModalOpen(true);
    };

    const handleApprove = (id: number) => {
        const doc = documentData;

        // 승인 시 크레탑 기업정보 선택 필수 확인 (모든 권한)
        if (doc && !doc.cretop_file && !doc.cretop_none) {
            setError('승인하려면 크레탑 파일을 업로드하거나<br>기업정보없음을 선택해주세요.');
            setErrorModalOpen(true);
            return;
        }

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
        // 중지 조건 확인
        if (!documentData?.manager_id || documentData?.status !== 'in_progress') {
            setErrorMessage('실무자가 배정되어 있고<br>상태가 진행일 때만 중지할 수 있습니다.');
            setErrorModalOpen(true);
            return;
        }

        setPendingAction({ id, action: 'stop' });
        setActionConfirmType('stop');
        setActionConfirmModalOpen(true);
    };

    const handleProgressRestart = (id: number) => {
        // 재시작 조건 확인
        if (!documentData?.manager_id || documentData?.status !== 'stopped') {
            setErrorMessage('실무자가 배정되어 있고<br>상태가 중지일 때만 재시작할 수 있습니다.');
            setErrorModalOpen(true);
            return;
        }

        setPendingAction({ id, action: 'restart' });
        setActionConfirmType('restart');
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
        console.log('handleConfirmAction 호출:', { pendingAction, pendingReasonAction });
        if (!pendingAction && !pendingReasonAction) return;

        const id = pendingAction?.id || pendingReasonAction?.id || documentData?.id;
        const action = pendingAction?.action || pendingReasonAction?.action;
        console.log('액션 처리:', { id, action });

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
                    progress_start_date: String(Date.now())
                };
                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업 진행이 시작되었습니다.');
                setDocumentData(updated);
            } else if (action === 'approve') {
                let updated: Document;
                let message = '';
                const adminData = getAdminData();
                const currentUserId = adminData?.user_id;
                const userLevel = adminData?.position?.level;

                // 승인 시 크레탑 파일 업로드 또는 기업정보없음 선택 필수 (모든 권한)
                if (!documentData.cretop_file && !documentData.cretop_none) {
                    setActionConfirmModalOpen(false);
                    setTimeout(() => {
                        setError('승인하려면 크레탑 파일을 업로드하거나<br>기업정보없음을 선택해주세요.');
                        setErrorModalOpen(true);
                    }, 100);
                    return;
                }

                if (documentData.progress_details === '검수자') {
                    // 검수자가 승인할 때 inspector_id 저장
                    updated = {
                        ...documentData,
                        progress_details: '대표실무자',
                        inspector_id: currentUserId
                    };
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

                const newReason = `[${timeStr}] [반려] ${reasonInput || '사유 없음'}`;
                const combinedReason = documentData.reason ? `${documentData.reason}\n${newReason}` : newReason;

                const updated = {
                    ...documentData,
                    status: 'rejected' as const,
                    progress_status: 'not_started' as const,
                    progress_details: '영업자',
                    manager_name: null,
                    manager_id: null,
                    inspector_id: null,
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

                const newReason = `[${timeStr}] [보완] ${reasonInput || '사유 없음'}`;
                const combinedReason = documentData.reason ? `${documentData.reason}\n${newReason}` : newReason;

                const updated = {
                    ...documentData,
                    status: 'revision' as const,
                    progress_status: 'not_started' as const,
                    progress_details: '영업자',
                    manager_name: null,
                    manager_id: null,
                    inspector_id: null,
                    reason: combinedReason,
                    reason_read: false
                };

                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업 보완이 요청되었습니다.');
                setDocumentData(updated);
            } else if (action === 'submit') {
                let updated: Document;

                if (documentData.status === 'rejected' || documentData.status === 'revision') {
                    // 제출 시 사유는 초기화하지 않고 유지 (타임라인처럼 쌓임)
                    updated = {
                        ...documentData,
                        status: 'waiting' as const,
                        progress_status: 'not_started' as const,
                        progress_details: '검수자',
                        manager_name: null,
                        manager_id: null,
                        inspector_id: null,
                        reason_read: true
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
                // progress_start_date로부터 경과 시간 계산
                let stoppedTime = '';
                if (documentData?.progress_start_date) {
                    let startTime: number;

                    // ISO 문자열인지 확인 (T 문자가 있으면 ISO 형식)
                    if (documentData.progress_start_date.includes('T')) {
                        startTime = new Date(documentData.progress_start_date).getTime();
                    } else {
                        // 타임스탐프 (숫자 문자열)
                        const pastTimestamp = parseInt(documentData.progress_start_date);
                        startTime = !isNaN(pastTimestamp) ? pastTimestamp : new Date(documentData.progress_start_date).getTime();
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
                    stoppedTime = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
                }

                const updated = {
                    ...documentData,
                    status: 'stopped' as const,
                    progress_status: 'stopped' as const,
                    stopped_time: stoppedTime
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
                    inspector_id: null,
                    completed_date: null,
                    reason: null,
                    reason_read: false
                };
                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업이 초기화되었습니다.');
                setDocumentData(updated);
            } else if (action === 'restart') {
                // stopped_time을 초 단위로 변환
                let stoppedSeconds = 0;
                if (documentData?.stopped_time) {
                    const parts = documentData.stopped_time.split(':');
                    const hours = parseInt(parts[0]) || 0;
                    const minutes = parseInt(parts[1]) || 0;
                    const seconds = parseInt(parts[2]) || 0;
                    stoppedSeconds = hours * 3600 + minutes * 60 + seconds;
                }

                // 현재 시간에서 stopped_time을 빼서 progress_start_date 설정
                // 이렇게 하면 timeUtils에서 계산할 때 stopped_time이 누적됨
                const newStartTime = Date.now() - (stoppedSeconds * 1000);

                const updated = {
                    ...documentData,
                    status: 'in_progress' as const,
                    progress_status: 'in_progress' as const,
                    progress_start_date: String(newStartTime),
                    stopped_time: null
                };
                await saveDocumentToDatabase(updated);
                setSuccessMessage('기업 진행이 재시작되었습니다.');
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
        } else if (isViewMode && isEditMode) {
            // 수정 완료: 뷰페이지로 리다이렉트
            router.replace(`/main/company_create?view=${viewId}`);
        } else {
            // 등록 완료: 목록으로 이동
            router.push('/main/document_submission');
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

    // 잘못된 접근 모달
    if (accessDenied) {
        return (
            <>
                <div className={styles.formContainer}>
                    <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                        접근 권한 확인 중...
                    </div>
                </div>
                <Modal
                    isOpen={true}
                    message="잘못된 접근입니다."
                    type="error"
                    onClose={() => {
                        router.push('/main/document_submission');
                    }}
                    confirmText="확인"
                    showConfirmButton={false}
                />
            </>
        );
    }

    // 뷰페이지 로딩 중이면 로딩 메시지 표시
    if (isViewMode && isLoading) {
        return (
            <div className={styles.formContainer}>
                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                    로딩 중...
                </div>
            </div>
        );
    }

    return (
        <div className={`${styles.pageWrapper} ${fileViewerOpen && !isMobile ? styles.withSidePanel : ''}`}>
        <div className={styles.formContainer}>
            <div className={styles.formHeader}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 className={styles.formTitle}>
                        {!isViewMode ? '기업 정보 입력' :
                         isEditMode ? '기업 정보 수정' :
                         '기업 정보 조회'}
                    </h2>
                    {isViewMode && documentData && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                            <span className={`${styles.statusBadge} ${styles[documentData.status]}`}>
                                {documentData.status === 'approved' ? '승인됨' :
                                 documentData.status === 'waiting' ? '대기중' :
                                 documentData.status === 'rejected' ? '반려됨' :
                                 documentData.status === 'revision' ? '보완중' :
                                 documentData.status === 'started' ? '진행중' :
                                 documentData.status === 'submitted' ? '제출됨' :
                                 documentData.status === 'assigned' ? '배정됨' :
                                 documentData.status}
                            </span>
                            <span style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                padding: '4px 12px',
                                borderRadius: '4px',
                                display: 'inline-block',
                                backgroundColor: documentData.progress_details === '검수자' ? '#FFF3CD' :
                                                documentData.progress_details === '대표실무자' ? '#D1ECF1' :
                                                documentData.progress_details === '실무자' ? '#E7D4F5' :
                                                '#E8E8E8',
                                color: documentData.progress_details === '검수자' ? '#856404' :
                                       documentData.progress_details === '대표실무자' ? '#0C5460' :
                                       documentData.progress_details === '실무자' ? '#6A1B9A' :
                                       '#333'
                            }}>
                                {documentData.progress_details === '검수자' ? (
                                    supervisorInfo ? `검수자: ${supervisorInfo.name}(${supervisorInfo.user_id})` : '검수자 대기중'
                                ) :
                                 documentData.progress_details === '대표실무자' ? (
                                    supervisorInfo ? `검수자: ${supervisorInfo.name}(${supervisorInfo.user_id})` : '대표실무자 진행중'
                                 ) :
                                 documentData.progress_details === '실무자' ? (
                                    documentData.manager_name ? `실무자: ${documentData.manager_name}(${documentData.manager_id})` : '실무자 진행중'
                                 ) :
                                 documentData.progress_details}
                            </span>
                        </div>
                    )}
                </div>
                <p className={styles.formSubtitle}>
                    {!isViewMode ? '새로운 기업 정보를 등록해주세요.' :
                     isEditMode ? '기업 정보를 수정해주세요.' :
                     '기업 정보를 확인하세요.'}
                </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                {/* 사업자 타입 선택 */}
                <div className={styles.businessTypeSection}>
                    {isViewMode && !isEditMode ? (
                        <div className={styles.businessTypeDisplay}>
                            {formData.businessType === 'individual' ? '개인사업자' : '법인사업자'}
                        </div>
                    ) : (
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
                                />
                                <label htmlFor="business" className={styles.radioLabel}>
                                    법인사업자
                                </label>
                            </div>
                        </div>
                    )}
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
                    <div
                        className={styles.uploadArea}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <label htmlFor="fileInput" className={styles.uploadLabel} style={isViewMode && !isEditMode ? { opacity: 0.5, pointerEvents: 'none' } : {}}>
                            <div className={styles.uploadIcon}>📎</div>
                            <div className={styles.uploadText}>
                                <p className={styles.uploadMain}>파일을 선택하거나 드래그하여 업로드</p>
                                <p className={styles.uploadSub}>대용량 파일 업로드 지원 (최대 5GB)</p>
                            </div>
                        </label>
                        <input
                            type="file"
                            id="fileInput"
                            onChange={handleFileSelect}
                            multiple
                            className={styles.fileInput}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp,.jpg,.jpeg,.png,.zip"
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

                {/* 크레탑 정보 섹션 - 보기/수정 모드에서 표시 */}
                {(() => {
                    const adminData = getAdminData();
                    const userLevel = adminData?.position?.level;
                    // 크레탑 수정 가능: 대표자(1), 대표실무자(2), 또는 검수자(6)이고 progress_details가 '검수자'일 때
                    const canEditCretop = isEditMode && (userLevel === 1 || userLevel === 2 || (userLevel === 6 && documentData?.progress_details === '검수자'));
                    // 크레탑 섹션 표시: 보기 모드일 때 항상 표시, 수정 가능할 때도 표시
                    const showCretopSection = isViewMode || canEditCretop;

                    return showCretopSection ? (
                        <div className={styles.fileSection}>
                            <label className={styles.sectionTitle}>
                                크레탑 기업정보
                            </label>

                            {/* 선택된 파일 표시 */}
                            {selectedCretopFile && (
                                <div className={styles.fileList} style={{ marginBottom: '16px' }}>
                                    <p className={styles.fileListTitle}>선택된 파일 (1개)</p>
                                    <ul className={styles.files}>
                                        <li className={styles.fileItem}>
                                            <span className={styles.fileName}>{selectedCretopFile.name}</span>
                                            <span className={styles.fileSize}>
                                                ({(selectedCretopFile.size / 1024 / 1024).toFixed(2)}MB)
                                            </span>
                                            {canEditCretop && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveCretopFile}
                                                className={styles.removeButton}
                                            >
                                                ✕
                                            </button>
                                            )}
                                        </li>
                                    </ul>
                                </div>
                            )}

                            {/* 기존 파일 표시 */}
                            {isViewMode && documentData?.cretop_file && !selectedCretopFile && (
                                <div className={styles.fileList} style={{ marginBottom: '16px' }}>
                                    <p className={styles.fileListTitle}>파일 (1개)</p>
                                    <ul className={styles.files}>
                                        <li className={styles.fileItem}>
                                            <button
                                                type="button"
                                                onClick={() => handleViewFile({
                                                    name: documentData.cretop_file!.name,
                                                    path: documentData.cretop_file!.path,
                                                    size: documentData.cretop_file!.size || 0
                                                })}
                                                className={styles.fileNameButton}
                                                title="클릭하여 보기"
                                            >
                                                {documentData.cretop_file.name}
                                            </button>
                                            <span className={styles.fileSize}>
                                                ({documentData.cretop_file.size ? (documentData.cretop_file.size / 1024 / 1024).toFixed(2) : '0.00'}MB)
                                            </span>
                                            {isEditMode && (
                                            <button
                                                type="button"
                                                onClick={handleRemoveExistingCretop}
                                                className={styles.removeButton}
                                            >
                                                ✕
                                            </button>
                                            )}
                                        </li>
                                    </ul>
                                </div>
                            )}

                            {/* 파일 업로드 영역 - 수정 모드일 때 항상 표시 */}
                            {isEditMode && (
                                <div
                                    onDragOver={handleCretopDragOver}
                                    onDragLeave={handleCretopDragLeave}
                                    onDrop={handleCretopDrop}
                                    className={`${styles.dropArea} ${cretopDragOver ? styles.dragOver : ''}`}
                                >
                                    <p style={{
                                        margin: 0,
                                        color: '#666',
                                        fontSize: '14px',
                                        textAlign: 'center'
                                    }}>
                                        {cretopDragOver ? '파일을 놓아주세요' : '파일을 드래그하거나 버튼을 클릭하세요'}
                                    </p>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <input
                                            type="file"
                                            ref={cretopInputRef}
                                            onChange={handleCretopUpload}
                                            style={{ display: 'none' }}
                                            accept=".pdf,.jpg,.jpeg,.png,.gif,.zip"
                                            disabled={!canEditCretop}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => cretopInputRef.current?.click()}
                                            disabled={cretopUploading || !canEditCretop}
                                            style={{
                                                padding: '12px 24px',
                                                fontSize: '15px',
                                                backgroundColor: canEditCretop ? '#2196f3' : '#ccc',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: (cretopUploading || !canEditCretop) ? 'not-allowed' : 'pointer',
                                                opacity: (cretopUploading || !canEditCretop) ? 0.6 : 1,
                                                fontWeight: '600'
                                            }}
                                        >
                                            {cretopUploading ? '업로드 중...' : '파일 업로드'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCretopNone}
                                            disabled={!canEditCretop}
                                            style={{
                                                padding: '12px 24px',
                                                fontSize: '15px',
                                                backgroundColor: canEditCretop ? '#78909c' : '#ccc',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: !canEditCretop ? 'not-allowed' : 'pointer',
                                                opacity: !canEditCretop ? 0.6 : 1,
                                                fontWeight: '600'
                                            }}
                                        >
                                            기업정보없음
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 파일 상태 표시 (선택된 파일도 없고 기존 파일도 없을 때) */}
                            {!selectedCretopFile && !documentData?.cretop_file && (
                                <>
                                    {documentData?.cretop_none ? (
                                        <div className={styles.fileStatus}>
                                            <p style={{ color: '#666', fontSize: '18px', fontWeight: '700', margin: '0' }}>
                                                기업정보없음
                                            </p>
                                        </div>
                                    ) : (
                                        <div className={styles.fileStatus}>
                                            <p style={{ color: '#999', fontSize: '16px', fontWeight: '500', margin: '0' }}>
                                                선택되지 않음
                                            </p>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* ZIP 다운로드 버튼 */}
                            {(isViewMode && !isEditMode && documentData?.cretop_file) && (
                                <div className={styles.downloadButtonContainer} style={{ marginBottom: '16px' }}>
                                    <button
                                        type="button"
                                        onClick={handleDownloadCretopZip}
                                        disabled={isDownloading}
                                        className={styles.downloadButton}
                                    >
                                        {isDownloading ? '다운로드 중...' : 'ZIP 다운로드'}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : null;
                })()}

                {/* 메모 섹션 */}
                {(isViewMode || !isViewMode) && (
                <div className={styles.memoSection}>
                    {/* 메모 목록 (타임라인) - 보기/수정 모드에서만, 최근순 */}
                    {isViewMode && documentData?.memos && documentData.memos.length > 0 && (
                        <div className={styles.memoTimeline}>
                            {[...documentData.memos].reverse().map((memo: DocumentMemo, reversedIndex: number) => {
                                const adminData = getAdminData();
                                const userLevel = adminData?.position?.level;
                                const canDeleteMemo = userLevel === 1 || userLevel === 2;
                                // 역순 인덱스를 원래 인덱스로 변환
                                const originalIndex = documentData.memos!.length - 1 - reversedIndex;

                                return (
                                    <div key={originalIndex} className={styles.memoItem}>
                                        <div className={styles.memoHeader}>
                                            <div>
                                                <span className={styles.memoTime}>{memo.timestamp}</span>
                                                <span className={styles.memoAuthor}>{memo.user_name} ({memo.user_id})</span>
                                            </div>
                                            {canDeleteMemo && (
                                                <button
                                                    type="button"
                                                    className={styles.memoDeleteButton}
                                                    onClick={() => handleDeleteMemo(originalIndex)}
                                                    title="메모 삭제"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        <div className={styles.memoContent}>{memo.content}</div>
                                    </div>
                                );
                            })}
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
                {isViewMode && !isEditMode && (() => {
                    const adminData = getAdminData();
                    const userLevel = adminData?.position?.level;
                    const isSalesperson = userLevel === 4;
                    const isInspector = userLevel === 6;
                    const isManager = userLevel === 2;
                    // 영업자는 보완/반려 상태이거나 progress_details='영업자'일 때 버튼 있음
                    // 검수자는 progress_details가 '검수자'일 때만 버튼 있음
                    // 기타는 항상 버튼 있음
                    const hasSalespersonButtons = isSalesperson && (documentData?.status === 'revision' || documentData?.status === 'rejected' || documentData?.progress_details === '영업자');
                    const hasInspectorButtons = isInspector && documentData?.progress_details === '검수자';
                    const hasOtherButtons = !isSalesperson && !isInspector;
                    const hasButtons = hasSalespersonButtons || hasInspectorButtons || hasOtherButtons;

                    return hasButtons ? (
                        <div className={styles.actionsGridContainer}>
                            <div className={styles.actionsGrid}>
                                {(() => {
                                    const isRevisionOrRejected = documentData?.status === 'revision' || documentData?.status === 'rejected';

                                    return (
                                        <>
                                            {/* 검수자: 크레탑 파일 필수 조건 체크 후 승인/보완/삭제 버튼 */}
                                            {isInspector && documentData?.progress_details === '검수자' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionButton} ${styles['action-approve']}`}
                                                        onClick={() => documentData && handleApprove(documentData.id)}
                                                    >
                                                        승인
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
                                                        className={`${styles.actionButton} ${styles['action-delete']}`}
                                                        onClick={() => documentData && handleProgressDelete(documentData.id)}
                                                    >
                                                        삭제
                                                    </button>
                                                </>
                                            )}

                                            {/* 영업자: 보완/반려 상태이거나 progress_details='영업자'일 때 제출 가능 */}
                                            {isSalesperson && (documentData?.status === 'revision' || documentData?.status === 'rejected' || documentData?.progress_details === '영업자') && (
                                                <button
                                                    type="button"
                                                    className={`${styles.actionButton} ${styles['action-submit']}`}
                                                    onClick={() => documentData && handleActionSubmit(documentData.id)}
                                                >
                                                    제출
                                                </button>
                                            )}

                                            {/* 그 외 권한: 권한별로 다른 버튼 */}
                                            {!isSalesperson && !isInspector && (
                                                <>
                                                    {/* 대표실무자: 진행(대표실무자), 승인/배정, 반려, 보완 */}
                                                    {isManager ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className={`${styles.actionButton} ${styles['action-start']}`}
                                                                onClick={() => documentData && handleProgressStart(documentData.id)}
                                                            >
                                                                진행(대표실무자)
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`${styles.actionButton} ${styles['action-approve']}`}
                                                                onClick={() => documentData && handleApprove(documentData.id)}
                                                            >
                                                                {documentData?.progress_details === '대표실무자' ? '배정' : '승인'}
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
                                                        </>
                                                    ) : (
                                                        /* 대표자 등 다른 권한: 모든 버튼 */
                                                        <>
                                                            <button
                                                                type="button"
                                                                className={`${styles.actionButton} ${styles['action-start']}`}
                                                                onClick={() => documentData && handleProgressStart(documentData.id)}
                                                            >
                                                                진행
                                                            </button>
                                                            {documentData?.status === 'stopped' ? (
                                                                <button
                                                                    type="button"
                                                                    className={`${styles.actionButton} ${styles['action-restart']}`}
                                                                    onClick={() => documentData && handleProgressRestart(documentData.id)}
                                                                >
                                                                    재시작
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    className={`${styles.actionButton} ${styles['action-stop']}`}
                                                                    onClick={() => documentData && handleProgressStop(documentData.id)}
                                                                >
                                                                    중지
                                                                </button>
                                                            )}
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
                                                            <button
                                                                type="button"
                                                                className={`${styles.actionButton} ${styles['action-reset']}`}
                                                                onClick={() => documentData && handleReset(documentData.id)}
                                                            >
                                                                초기화
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    ) : null;
                })()}

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
                                onClick={() => router.push('/main/document_submission')}
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
                    // 잘못된 접근인 경우 문서 목록으로 이동
                    if (error === '잘못된 접근입니다.') {
                        router.push('/main/document_submission');
                    }
                }}
                confirmText="확인"
                showConfirmButton={false}
            />

            {/* 확인 모달 - 폼 등록/저장 시에만 표시 */}
            <Modal
                isOpen={confirmModalOpen && !pendingAction && !pendingReasonAction}
                message={isViewMode && isEditMode ? "입력하신 기업 정보를 수정하시겠습니까?" : "입력하신 기업 정보를 등록하시겠습니까?"}
                type="info"
                onConfirm={handleConfirmSubmit}
                onClose={() => setConfirmModalOpen(false)}
                confirmText={isViewMode && isEditMode ? "수정" : "등록"}
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
                            placeholder="사유를 입력해주세요. (필수)"
                            style={{
                                width: '100%',
                                minHeight: '100px',
                                padding: '10px',
                                borderRadius: '4px',
                                border: `1px solid ${!reasonInput.trim() ? '#ff6b6b' : '#ddd'}`,
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                        {!reasonInput.trim() && (
                            <p style={{ color: '#ff6b6b', fontSize: '12px', margin: '5px 0 0 0' }}>
                                사유를 입력해주세요.
                            </p>
                        )}
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
                                    if (!reasonInput.trim()) return;
                                    setPendingAction({
                                        id: pendingReasonAction?.id || documentData?.id,
                                        action: pendingReasonAction?.action === 'reject' ? 'reject' : 'revision'
                                    });
                                    setActionConfirmType(pendingReasonAction?.action === 'reject' ? 'reject' : 'revision');
                                    setReasonInputModalOpen(false);
                                    setActionConfirmModalOpen(true);
                                }}
                                disabled={!reasonInput.trim()}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    backgroundColor: !reasonInput.trim() ? '#ccc' : '#007bff',
                                    color: 'white',
                                    border: 'none',
                                    cursor: !reasonInput.trim() ? 'not-allowed' : 'pointer',
                                    opacity: !reasonInput.trim() ? 0.6 : 1
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
                message={(() => {
                    const adminData = getAdminData();
                    const userLevel = adminData?.position?.level;
                    const isManager = userLevel === 2;
                    const isManagerAssigning = isManager && documentData?.progress_details === '대표실무자';

                    if (actionConfirmType === 'start') return '기업 진행을 시작하시겠습니까?';
                    if (actionConfirmType === 'stop') return '기업 진행을 중지하시겠습니까?';
                    if (actionConfirmType === 'restart') return '기업 진행을 재시작하시겠습니까?';
                    if (actionConfirmType === 'delete') return '이 기업을 삭제하시겠습니까?';
                    if (actionConfirmType === 'approve') return isManagerAssigning ? '기업을 배정하시겠습니까?' : '기업을 승인하시겠습니까?';
                    if (actionConfirmType === 'reject') return '기업을 반려하시겠습니까?';
                    if (actionConfirmType === 'revision') return '기업 보완을 요청하시겠습니까?';
                    if (actionConfirmType === 'submit') return '기업을 제출하시겠습니까?';
                    return '기업을 초기화하시겠습니까?\n(대기 상태로 돌아갑니다)';
                })()}
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
                        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                        overflow: 'visible'
                    }}>
                        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>실무자 선택</h3>
                        <div style={{ position: 'relative', overflow: 'visible', zIndex: 10, width: '100%' }}>
                        <select
                            value={selectedManager}
                            onChange={(e) => setSelectedManager(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 40px 10px 14px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '14px',
                                appearance: 'none'
                            }}
                        >
                            <option value="">실무자를 선택해주세요.</option>
                            {(() => {
                                // 문서의 진행상태가 '대표실무자'일 때는 실무자(Level 3)만 표시
                                const filteredWorkers = documentData?.progress_details === '대표실무자' ?
                                    workers.filter((w) => w.position?.level === 3) :
                                    workers;
                                return filteredWorkers.map((worker) => (
                                    <option key={worker.id} value={worker.user_id}>
                                        {worker.name}({worker.user_id})
                                    </option>
                                ));
                            })()}
                        </select>
                        <img
                            src="/arrow.svg"
                            alt="드롭다운"
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '10px',
                                width: '16px',
                                height: '16px',
                                pointerEvents: 'none'
                            }}
                        />
                        </div>
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

        </div>

            {/* PC: 사이드 패널 */}
            {!isMobile && fileViewerOpen && selectedFile && (
                <div className={styles.sidePanel} style={{ width: `${sidePanelWidth}px` }}>
                    {/* 리사이즈 핸들 */}
                    <div
                        className={`${styles.sidePanelResizeHandle} ${isResizing ? styles.active : ''}`}
                        onMouseDown={handleResizeStart}
                    />
                    {/* 헤더 */}
                    <div className={styles.sidePanelHeader}>
                        <h3 className={styles.sidePanelTitle}>
                            {selectedFile.name}
                        </h3>
                        <button
                            onClick={() => {
                                setFileViewerOpen(false);
                                setSelectedFile(null);
                                setFileViewUrl('');
                                setImageZoom(1);
                            }}
                            className={styles.sidePanelCloseButton}
                        >
                            ×
                        </button>
                    </div>

                    {/* 콘텐츠 */}
                    <div
                        className={styles.sidePanelContent}
                        onWheel={handleImageWheel}
                    >
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
                                                onMouseDown={handleImageMouseDown}
                                                onMouseMove={handleImageMouseMove}
                                                onMouseUp={handleImageMouseUp}
                                                onMouseLeave={handleImageMouseUp}
                                                draggable={false}
                                                style={{
                                                    maxWidth: '100%',
                                                    maxHeight: '100%',
                                                    objectFit: 'contain',
                                                    transform: `scale(${imageZoom}) translate(${imagePosition.x / imageZoom}px, ${imagePosition.y / imageZoom}px) rotate(${imageRotation}deg)`,
                                                    cursor: imageZoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                                                    userSelect: 'none'
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
                    <div className={styles.sidePanelFooter}>
                        <span style={{ fontSize: '12px', color: '#999' }}>
                            {(selectedFile.size / 1024 / 1024).toFixed(2)}MB
                        </span>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <button
                                onClick={() => setImageRotation(prev => prev - 90)}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#f5f5f5',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                                title="왼쪽으로 회전"
                            >
                                ↺
                            </button>
                            <button
                                onClick={() => setImageRotation(prev => prev + 90)}
                                style={{
                                    padding: '6px 12px',
                                    backgroundColor: '#f5f5f5',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                                title="오른쪽으로 회전"
                            >
                                ↻
                            </button>
                            <a
                                href={fileViewUrl}
                                download={selectedFile.name}
                                className={styles.sidePanelDownloadButton}
                            >
                                다운로드
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* 모바일: 모달 */}
            {isMobile && fileViewerOpen && selectedFile && (
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
