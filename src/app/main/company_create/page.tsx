'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import styles from './companyCreate1.module.css';
import Modal from '@/app/components/Modal/Modal';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import Spinner from '@/app/components/Spinner/Spinner';
import CompanyInfoCard, { CompanyInfoCardHandle } from './components/CompanyInfoCard';
import CretabInfo, { CretabInfoHandle, CretabFormData } from './components/CretabInfo';
import ProgressStepsSection from './components/ProgressStepsSection';
import CompanyFile, { CompanyFileHandle } from './components/CompanyFile';
import MemoSection from './components/MemoSection';
import AdditionalFiles, { AdditionalFilesHandle } from './components/AdditionalFiles';

function Company1Content() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const createParam = searchParams.get('create');
    const viewId = searchParams.get('view');
    const editParam = searchParams.get('edit');
    const fromAdditionalParam = searchParams.get('fromAdditional');
    const fromCompanyFileParam = searchParams.get('fromCompanyFile');
    const isConsultationMode = searchParams.get('consultation') === 'true';

    const [isSaving, setIsSaving] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [pendingNavPath, setPendingNavPath] = useState<string | null>(null);
    const [supplementCompleted, setSupplementCompleted] = useState(false);
    const [isCreateMode, setIsCreateMode] = useState(createParam === 'true');
    const [isViewMode, setIsViewMode] = useState(!!viewId && !createParam);
    // 초기값은 false로 설정, useEffect에서 권한 확인 후 설정
    const [isEditMode, setIsEditMode] = useState(false);
    const [documentData, setDocumentData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(!!viewId);
    const [accessDenied, setAccessDenied] = useState(false);
    const [currentUserId, setCurrentUserId] = useState('');
    const [currentUserName, setCurrentUserName] = useState('');
    const [currentUserPosition, setCurrentUserPosition] = useState<any>(null);
    const [memos, setMemos] = useState<any[]>([]);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    const companyInfoRef = useRef<CompanyInfoCardHandle>(null);
    const cretabInfoRef = useRef<CretabInfoHandle>(null);
    const companyFileRef = useRef<CompanyFileHandle>(null);
    const additionalFilesRef = useRef<AdditionalFilesHandle>(null);
    // 저장 완료 후 최신 document 즉시 참조용 (setState 비동기 문제 해결)
    const latestSavedDocumentRef = useRef<any>(null);
    const isEditModeRef = useRef(false);

    // 문서 조회 함수
    const fetchDocumentData = async (docId: number) => {
        setIsLoading(true);
        try {
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

            const { document: data } = await response.json();
            setDocumentData(data);

            setIsLoading(false);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '문서 조회 실패';
            setErrorMessage(errorMsg);
            setErrorModalOpen(true);
            setIsLoading(false);
        }
    };

    // 현재 사용자 정보 초기화
    useEffect(() => {
        const adminData = getAdminData();
        if (adminData) {
            setCurrentUserId(adminData.user_id || '');
            setCurrentUserName(adminData.name || '');
            setCurrentUserPosition(adminData.position || null);
        }
    }, []);

    // 수정 모드에서 페이지 이탈 방지 (브라우저 새로고침/닫기)
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isEditModeRef.current) {
                e.preventDefault();
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            (window as any).__isEditMode = false;
        };
    }, []);

    // 수정 모드에서 브라우저 뒤로가기 감지
    useEffect(() => {
        const handlePopState = () => {
            if (isEditModeRef.current) {
                window.history.pushState(null, '', window.location.href);
                setCancelModalOpen(true);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // 사이드바 링크 클릭 시 수정 모드 이탈 감지
    useEffect(() => {
        const handleSidebarNavigation = (e: Event) => {
            const path = (e as CustomEvent<{ path: string }>).detail.path;
            if (isEditModeRef.current) {
                setPendingNavPath(path);
                setCancelModalOpen(true);
            } else {
                router.push(path);
            }
        };
        window.addEventListener('sidebarNavigation', handleSidebarNavigation);
        return () => window.removeEventListener('sidebarNavigation', handleSidebarNavigation);
    }, [router]);

    // viewId 감시 - 문서 조회
    useEffect(() => {
        if (viewId) {
            fetchDocumentData(parseInt(viewId));
            // viewId가 변경될 때마다 isFirstLoad 리셋
            setIsFirstLoad(true);
        }
    }, [viewId]);

    // edit 파라미터 감시 - 수정 모드 활성화 (승인 문서는 수정 불가, 영업자/검수자는 분석 단계 수정 불가)
    useEffect(() => {
        if (!documentData) return;

        const adminData = getAdminData();
        const userLevel = adminData?.position?.level;

        const currentProgressDetails = documentData?.progress_details;
        // 승인요청/승인 단계에서는 대표자(level 1)만 수정 가능
        const isApprovedOrRequested = currentProgressDetails === '승인' || currentProgressDetails === '승인요청';
        const isLevel1 = userLevel === 1;
        // 영업자는 분석 단계에서 수정 불가
        // 대표실무자(level 2)는 진행 단계에서 수정 불가
        // 실무자(level 3 또는 undefined)는 수정 불가
        const isAnalysisPhase = (userLevel === 4 && (currentProgressDetails === '분석' || currentProgressDetails === '심사' || currentProgressDetails === '진행')) ||
                                (userLevel === 2 && currentProgressDetails === '진행' && (adminData?.user_id || currentUserId) !== documentData?.manager_id);
        const isStaff = userLevel === 3 || userLevel === undefined;
        const isBowan = documentData?.status === '보완' && userLevel === 4;
        // A영업자(submitter): 서류요청 이후 수정 불가
        const isSubmitterOnly = !!documentData?.submitter_id &&
                                documentData?.submitter_id === (adminData?.user_id || currentUserId) &&
                                documentData?.progress_details !== '상담신청';
        // 분석 이후 단계 영업자는 추가서류/메모만 편집 가능
        const isAnalysisPhaseEditMode = isAnalysisPhase && editParam === 'true' && !!viewId;
        const canEdit = editParam === 'true' && !!viewId &&
                        !(isApprovedOrRequested && !isLevel1) &&
                        !isAnalysisPhase && !isStaff && !isBowan && !isSubmitterOnly ||
                        (isAnalysisPhaseEditMode);
        setIsEditMode(canEdit);
        isEditModeRef.current = canEdit;
        (window as any).__isEditMode = canEdit;
        // 수정 모드 진입 시 뒤로가기 가드용 히스토리 엔트리 추가
        if (canEdit) {
            window.history.pushState(null, '', window.location.href);
        }

        // 수정 모드 진입 시 추가서류 uploadedFiles 초기화
        if (canEdit && additionalFilesRef.current) {
            additionalFilesRef.current.resetUploadedFiles();
            // 추가서류 섹션에서 온 경우만 파일 선택창 자동 열기 (한 번만)
            if (fromAdditionalParam === 'true') {
                router.replace(`?view=${viewId}&edit=true`);
                setTimeout(() => {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    additionalFilesRef.current?.triggerFileInput();
                }, 300);
            } else if (fromCompanyFileParam === 'true') {
                router.replace(`?view=${viewId}&edit=true`);
                setTimeout(() => {
                    const el = document.getElementById('company-file-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    companyFileRef.current?.triggerFileInput();
                }, 300);
            }
        }

        // 수정 불가 조건 시 리다이렉트 (분석 단계는 추가서류/메모 편집 가능)
        if (editParam === 'true' && viewId && (isBowan || ((documentData?.progress_details === '승인요청' || documentData?.progress_details === '승인') && currentUserPosition?.level !== 1))) {
            router.replace(`?view=${viewId}`);
        }
    }, [editParam, viewId, documentData, router, fromAdditionalParam, fromCompanyFileParam]);

    // 조회한 문서 데이터를 폼에 반영 (처음 진입할 때만)
    useEffect(() => {
        // 처음 진입할 때만 폼을 로드하고, 그 다음부터는 사용자 입력 데이터 유지
        // (수정 모드에서도 처음에는 데이터를 로드해야 함)
        if (documentData && isFirstLoad) {
            setIsFirstLoad(false);
            // 기본 정보 설정
            if (companyInfoRef.current) {
                companyInfoRef.current.setFormData({
                    company_name: documentData.company_name || '',
                    business_number: documentData.business_number || '',
                    representative_name: documentData.representative_name || '',
                    phone: documentData.phone || '',
                });
            }
        }

        // 파일 정보 설정 (isFirstLoad 밖으로 이동 - 항상 표시)
        if (documentData && companyFileRef.current) {
            // 사업자 유형 설정 (항상 설정 - 파일 로드에 필요)
            if (documentData.type) {
                companyFileRef.current.setBusinessType(documentData.type);
            }
            // 기존 파일 설정 (항상 표시)
            if (documentData.files && Array.isArray(documentData.files)) {
                companyFileRef.current.setExistingFiles(documentData.files, documentData.type);
            }
        }

            // 크레탑 정보 설정 (수정 모드에서도 기존 데이터는 표시)
            if (cretabInfoRef.current) {
                // 크레탑 폼 데이터 설정 (기본 정보 + 테이블 데이터)
                cretabInfoRef.current.setFormData({
                    companyCreditRatingKCB: documentData.company_credit_rating_kcb || '',
                    companyCreditRatingNICE: documentData.company_credit_rating_nice || '',
                    companyType: documentData.company_type || '',
                    standardClassification: documentData.standard_classification || '',
                    establishmentDate: documentData.establishment_date || '',
                    companyAddress: documentData.company_address || '',
                    assessmentDate: documentData.assessment_date || '',
                    settlementDate: documentData.settlement_date || '',
                    // 재무 테이블 데이터
                    years: documentData.financial_data?.years || [],
                    assetTotal: documentData.financial_data?.assetTotal || [],
                    debtTotal: documentData.financial_data?.debtTotal || [],
                    capital: documentData.financial_data?.capital || [],
                    equityTotal: documentData.financial_data?.equityTotal || [],
                    // 손익 테이블 데이터
                    sales: documentData.income_data?.sales || [],
                    netIncome: documentData.income_data?.netIncome || [],
                    cashFlowGrade: documentData.income_data?.cashFlowGrade || [],
                });
                // 크레탑 파일 설정
                if (documentData.cretop_file) {
                    cretabInfoRef.current.setCretabFile({
                        fileName: documentData.cretop_file.name || '',
                        fileSize: `${(documentData.cretop_file.size / 1024).toFixed(2)} KB`,
                        storagePath: documentData.cretop_file.path || '',
                    });
                    cretabInfoRef.current.setCretabStatus('file');
                } else if (documentData.cretop_none) {
                    cretabInfoRef.current.setCretabStatus('none');
                }
                // 추출된 이미지 설정
                if (documentData.extracted_images) {
                    cretabInfoRef.current.setExtractedImages({
                        first: documentData.extracted_images.first || null,
                        second: documentData.extracted_images.second || null,
                    });
                }
            }

        // 추가 서류 설정 (항상 표시)
        if (documentData && additionalFilesRef.current) {
            if (documentData.supplement_files && Array.isArray(documentData.supplement_files)) {
                additionalFilesRef.current.setExistingFiles(documentData.supplement_files);
            }
        }

        // 메모 설정 (수정 모드에서는 설정하지 않음)
        if (documentData && documentData.memos && Array.isArray(documentData.memos) && !isEditMode && isFirstLoad) {
            setMemos(documentData.memos);
        }
    }, [documentData, isEditMode, viewId]);

    const uploadFileToStorage = async (file: File, path: string): Promise<string | null> => {
        try {
            // Signed URL 요청
            const signedUrlResponse = await fetch('/api/upload/signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path,
                    fileName: file.name,
                    fileSize: file.size,
                    contentType: file.type,
                }),
            });

            if (!signedUrlResponse.ok) {
                const errorData = await signedUrlResponse.json();
                throw new Error(errorData.error || '서명된 URL 생성 실패');
            }

            const { signedUrl, path: storagePath } = await signedUrlResponse.json();

            // 파일을 Signed URL에 업로드
            const uploadResponse = await fetch(signedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type || 'application/octet-stream',
                },
                body: file,
            });

            if (!uploadResponse.ok) {
                throw new Error(`파일 업로드 실패 (상태: ${uploadResponse.status})`);
            }

            return storagePath;
        } catch (error) {
            console.error('업로드 오류:', error);
            throw error;
        }
    };

    const handleMemosChange = (updatedMemos: any[]) => {
        setMemos(updatedMemos);
    };

    const handleValidateAndNext = async (): Promise<boolean> => {
        try {
            // 1. CompanyInfo 유효성 검사 (기본정보)
            const companyValidation = companyInfoRef.current?.validateFormData();
            if (!companyValidation?.valid) {
                setErrorMessage(companyValidation?.message || '기업정보를 모두 입력해주세요.');
                setErrorModalOpen(true);
                return false;
            }

            // 2. CompanyFile 유효성 검사 (상담신청 단계 제외)
            if (documentData?.progress_details !== '상담신청') {
                const companyFileValidation = companyFileRef.current?.validateFormData();
                if (!companyFileValidation?.valid) {
                    setErrorMessage(companyFileValidation?.message || '첨부파일을 모두 업로드해주세요.');
                    setErrorModalOpen(true);
                    return false;
                }
            }

            // 3. CretabInfo 유효성 검사 (상담신청 단계 제외)
            if (documentData?.progress_details !== '상담신청') {
                const cretabValidation = cretabInfoRef.current?.validateFormData();
                if (!cretabValidation?.valid) {
                    setErrorMessage(cretabValidation?.message || '크레탑 정보를 모두 입력해주세요.');
                    setErrorModalOpen(true);
                    return false;
                }

                // 4. 크레탑 파일 확인
                const cretabFile = cretabInfoRef.current?.getCretabFileForUpload();
                const cretabStatus = cretabInfoRef.current?.getCretabStatus();
                if (!cretabFile && cretabStatus !== 'file' && cretabStatus !== 'none') {
                    setErrorMessage('크레탑 파일을 업로드하거나\n정보없음을 선택해주세요.');
                    setErrorModalOpen(true);
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error('유효성 검사 실패:', error);
            return false;
        }
    };

    const handleProgressUpdate = (progressDetails: string, skipRedirect?: boolean) => {
        // 실무자 배정 후 리다이렉트하는 경우 로컬 상태 업데이트 불필요
        if (skipRedirect) return;
        // latestSavedDocumentRef 우선 사용 (setState 비동기 문제 - 저장 직후 최신 데이터)
        const baseData = latestSavedDocumentRef.current || documentData;
        if (baseData) {
            setIsFirstLoad(true);
            setDocumentData({ ...baseData, progress_details: progressDetails });
        }
        // 수정 모드에서 단계 이동 완료 시 조회 페이지로 이동
        if (isEditMode && viewId) {
            router.push(`?view=${viewId}`);
        }
    };

    const handleStaffAssignSuccess = () => {
        router.push('/main/document_submission');
    };

    const handleEditCretabFile = () => {
        router.push(`?view=${viewId}&edit=true`);
    };

    const getProgressBadgeStyle = (progress: string | null | undefined) => {
        const styleMap: Record<string, React.CSSProperties> = {
            '상담신청': { backgroundColor: '#9e9e9e', color: '#ffffff' },
            '서류요청': { backgroundColor: '#ffc107', color: '#ffffff' },
            '분석': { backgroundColor: '#2196f3', color: '#ffffff' },
            '심사': { backgroundColor: '#9c27b0', color: '#ffffff' },
            '진행': { backgroundColor: '#e74c3c', color: '#ffffff' },
            '승인요청': { backgroundColor: '#ff9800', color: '#ffffff' },
            '승인': { backgroundColor: '#4caf50', color: '#ffffff' },
        };
        return styleMap[progress || '상담신청'] || styleMap['상담신청'];
    };

    const handleSave = async (skipSuccessModal?: boolean) => {
        try {
            setIsSaving(true);

            // 사용자 정보 추출
            const adminData = getAdminData();
            if (!adminData) {
                throw new Error('사용자 정보를 찾을 수 없습니다.');
            }
            const userId = adminData.user_id;

            // 분석 이후 단계: 메모와 추가서류만 저장
            const isAnalysisPhaseEdit = isEditMode && (documentData?.progress_details === '분석' || documentData?.progress_details === '심사' || documentData?.progress_details === '진행') && currentUserPosition?.level === 4;

            // 1. 폼 데이터 수집
            const formData = companyInfoRef.current?.getFormData();
            if (!formData) {
                throw new Error('폼 데이터를 불러올 수 없습니다.');
            }

            // 필수 필드 검증
            if (!formData.company_name?.trim()) {
                throw new Error('기업명을 입력해주세요.');
            }
            if (!formData.business_number?.trim()) {
                throw new Error('사업자등록번호를 입력해주세요.');
            }
            if (formData.business_number.length !== 12) {
                throw new Error('사업자등록번호를 정확히 입력해주세요.');
            }
            if (!formData.representative_name?.trim()) {
                throw new Error('대표자명을 입력해주세요.');
            }
            if (!formData.phone?.trim()) {
                throw new Error('연락처를 입력해주세요.');
            }
            if (formData.phone.length !== 13) {
                throw new Error('연락처를 정확히 입력해주세요.');
            }

            // 크레탑 정보 검증 (상담신청 단계 제외, level 4 제외)
            if (viewId && currentUserPosition?.level !== 4 && documentData?.progress_details !== '상담신청') {
                // 크레탑 폼 데이터 검증
                const cretabValidation = cretabInfoRef.current?.validateFormData();
                if (!cretabValidation?.valid) {
                    throw new Error(cretabValidation?.message || '크레탑 정보를 모두 입력해주세요.');
                }

                // 크레탑 파일 또는 정보없음 선택 검증
                const cretabFile = cretabInfoRef.current?.getCretabFileForUpload();
                const cretabStatus = cretabInfoRef.current?.getCretabStatus();
                // 수정 모드: 파일 상태가 'file'이고 기존 파일이 있을 때만 기존 파일로 간주
                const hasExistingFile = isEditMode && documentData?.cretop_file && cretabStatus === 'file';
                if (!cretabFile && !hasExistingFile && cretabStatus !== 'none') {
                    throw new Error('크레탑 파일을 업로드하거나\n정보없음을 선택해주세요.');
                }
            }

            // 2. 크레탑 정보 데이터 수집 (CretabInfo가 있는 경우에만)
            let cretabFormData: CretabFormData = {
                companyCreditRatingKCB: '',
                companyCreditRatingNICE: '',
                companyType: '',
                standardClassification: '',
                establishmentDate: '',
                companyAddress: '',
                assessmentDate: '',
                settlementDate: ''
            };
            let cretabFileObj = null;
            let cretabStatus = null;
            if (viewId && currentUserPosition?.level !== 4) {
                cretabFormData = cretabInfoRef.current?.getFormData() || cretabFormData;
                cretabFileObj = cretabInfoRef.current?.getCretabFileForUpload() || null;
                cretabStatus = cretabInfoRef.current?.getCretabStatus() || null;
            }

            // 3. 파일 데이터 수집
            const companyFiles = companyFileRef.current?.getFilesForUpload() || [];
            const existingFiles = companyFileRef.current?.getExistingFiles() || [];
            const additionalFiles = additionalFilesRef.current?.getFilesForUpload() || [];

            // 4. 사업자 유형 검증 (상담신청 모드에서는 스킵)
            const businessType = companyFileRef.current?.getBusinessType();
            if (!isConsultationMode && !businessType) {
                throw new Error('사업자를 선택해주세요.');
            }

            const isCompany = businessType === 'business';
            const isIndividual = businessType === 'individual';

            // 5. 필수 서류 검증 (상담신청 모드에서는 스킵)
            if (!isConsultationMode) {
                const requiredDocs = isCompany
                    ? ['business_license', 'financial_statement', 'vat_certificate']
                    : ['business_license', 'id_copy'];

                const uploadedDocIds = companyFiles.map((f: any) => f.docId);
                const existingDocIds = existingFiles.map((f: any) => {
                    const pathParts = f.path?.split('/') || [];
                    const docIdPattern = /business_license|financial_statement|vat_certificate|id_copy/;
                    for (const part of pathParts) {
                        const match = part.match(docIdPattern);
                        if (match) return match[0];
                    }
                    return null;
                }).filter(Boolean);
                const allDocIds = [...uploadedDocIds, ...existingDocIds];

                const docNameMap: Record<string, string> = {
                    'business_license': '사업자등록증',
                    'financial_statement': '재무제표',
                    'vat_certificate': '부가세증명원',
                    'id_copy': '신분증사본',
                };

                for (const docId of requiredDocs) {
                    if (!allDocIds.includes(docId)) {
                        throw new Error(`${docNameMap[docId]} 서류를 업로드해주세요.`);
                    }
                }
            }

            // 6. 파일 업로드 및 경로 수집
            const uploadedFiles: Array<{ name: string; path: string; size: number }> = [];

            // 첨부파일 업로드
            for (const { docId, file } of companyFiles) {
                const path = await uploadFileToStorage(file, `documents/${docId}`);
                if (path) {
                    uploadedFiles.push({
                        name: file.name,
                        path: path,
                        size: file.size,
                    });
                }
            }

            // 크레탑 파일 업로드
            let cretabFileData: { name: string; path: string; size: number } | null = null;
            if (cretabFileObj) {
                const path = await uploadFileToStorage(cretabFileObj.file, 'cretab_file');
                if (path) {
                    cretabFileData = {
                        name: cretabFileObj.fileName,
                        path: path,
                        size: cretabFileObj.file.size,
                    };
                }
            } else if (isEditMode && documentData?.cretop_file && cretabStatus === 'file') {
                // 수정 모드: 파일 상태가 'file'일 때만 기존 파일 유지 (X버튼이나 정보없음 선택 시 제외)
                cretabFileData = documentData.cretop_file;
            }

            // 추가서류 업로드 (신규 모드에서만)
            let additionalFilesCombined: Array<{ name: string; path: string; size: number }> = [];

            if (!isEditMode || !viewId) {
                // 신규 생성 모드: 새 파일만
                const additionalFilesPaths: Array<{ name: string; path: string; size: number }> = [];
                for (const { file, fileName } of additionalFiles) {
                    const path = await uploadFileToStorage(file, 'additional_files');
                    if (path) {
                        additionalFilesPaths.push({
                            name: fileName,
                            path: path,
                            size: file.size,
                        });
                    }
                }
                additionalFilesCombined = additionalFilesPaths;
            } else {
                // 수정 모드: 기존 파일 + 새 파일
                const existingAdditionalFiles = additionalFilesRef.current?.getExistingFiles() || [];
                const newAdditionalFilesPaths: Array<{ name: string; path: string; size: number }> = [];
                for (const { file, fileName } of additionalFiles) {
                    const path = await uploadFileToStorage(file, 'additional_files');
                    if (path) {
                        newAdditionalFilesPaths.push({
                            name: fileName,
                            path: path,
                            size: file.size,
                        });
                    }
                }
                additionalFilesCombined = [...existingAdditionalFiles, ...newAdditionalFilesPaths];
            }

            // 7. DB에 저장 (API 호출)
            const now = new Date();
            // 기존 파일과 새 파일 합치기
            const allFiles = [...existingFiles, ...uploadedFiles];

            // 진행 단계 결정 (수정 모드면 기존 progress_details 유지, 상담신청 모드면 '상담', 신규면 '서류요청')
            let progressDetails = isConsultationMode ? '상담신청' : '서류요청';
            let progressStartDate: string | null = null;
            if (isEditMode && viewId && documentData?.progress_details) {
                progressDetails = documentData.progress_details;
                // 상담신청 문서에서 B영업자가 필수서류 등록 후 저장 시 → 서류요청으로 변경
                if (progressDetails === '상담신청' && businessType && !isConsultationMode) {
                    progressDetails = '서류요청';
                }
                // 서류요청 → 분석으로 변경되는 경우 시간 경과 시작
                if (progressDetails === '분석' && !documentData.progress_start_date) {
                    progressStartDate = String(Date.now());
                } else if (documentData.progress_start_date) {
                    progressStartDate = documentData.progress_start_date;
                }
            }

            const saveData: any = {
                // 수정 모드에서는 기존 user_id 유지, 생성 모드에서만 현재 사용자로 설정
                ...(viewId ? {} : { user_id: userId }),
                // 수정 모드에서는 user_name도 원본 저자 유지
                ...(viewId ? { user_name: documentData?.user_name } : { user_name: adminData.name || userId }),
                document_type: isConsultationMode ? '상담신청' : '기업등록',
                title: formData.company_name,
                // 상담신청 모드에서는 submitter_id에 최초 등록자 기록
                ...(isConsultationMode && !viewId ? { submitter_id: userId } : {}),
                // 생성 모드에서만 status 설정, 수정 모드에서는 기존 상태 유지
                ...(viewId ? {} : { status: '정상' }),
                progress_status: 'not_started',
                company_name: formData.company_name,
                business_number: formData.business_number,
                representative_name: formData.representative_name,
                phone: formData.phone,
                ...(viewId ? {} : { manager_name: '' }),
                progress_details: progressDetails,
                ...(progressStartDate && { progress_start_date: progressStartDate }),
                type: businessType || null,
                // 파일 경로들 (DB 컬럼명과 맞춰야 함)
                files: allFiles, // 첨부파일
                ...(currentUserPosition?.level !== 4 && { cretop_file: cretabFileData }), // 크레탑 파일 (영업자 제외)
                supplement_files: additionalFilesCombined, // 추가서류
                memos: memos, // 메모
                submitted_date: now.toLocaleString('ko-KR'),
            };

            // 크레탑 정보 추가 (수정 모드일 때만)
            if (viewId && currentUserPosition?.level !== 4) {
                saveData.company_credit_rating_kcb = cretabFormData.companyCreditRatingKCB || '';
                saveData.company_credit_rating_nice = cretabFormData.companyCreditRatingNICE || '';
                saveData.company_type = cretabFormData.companyType || '';
                saveData.standard_classification = cretabFormData.standardClassification || '';
                saveData.establishment_date = cretabFormData.establishmentDate || '';
                saveData.company_address = cretabFormData.companyAddress || '';
                saveData.assessment_date = cretabFormData.assessmentDate || '';
                saveData.settlement_date = cretabFormData.settlementDate || '';
                saveData.cretop_none = cretabStatus === 'none'; // 정보 없음 여부

                // 테이블 데이터 추가 (재무 & 손익 정보)
                saveData.financial_data = {
                    years: cretabFormData.years || [],
                    assetTotal: cretabFormData.assetTotal || [],
                    debtTotal: cretabFormData.debtTotal || [],
                    capital: cretabFormData.capital || [],
                    equityTotal: cretabFormData.equityTotal || [],
                };
                saveData.income_data = {
                    sales: cretabFormData.sales || [],
                    netIncome: cretabFormData.netIncome || [],
                    cashFlowGrade: cretabFormData.cashFlowGrade || [],
                };

                // 추출된 이미지 저장
                const cretabImages = cretabInfoRef.current?.getExtractedImages?.() || { first: null, second: null };
                saveData.extracted_images = {
                    first: cretabImages.first || null,
                    second: cretabImages.second || null,
                };
            }

            // 분석 단계: 메모와 추가서류만 저장
            const finalSaveData = isAnalysisPhaseEdit ? {
                memos: saveData.memos,
                supplement_files: saveData.supplement_files,
            } : saveData;

            const response = await fetch(isEditMode && viewId ? `/api/documents/${viewId}` : '/api/documents', {
                method: isEditMode && viewId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalSaveData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'DB 저장 실패');
            }

            const result = await response.json();
            console.log('저장 완료:', result);

            // 저장된 데이터로 documentData 업데이트 (최신 상태 유지)
            // PUT API는 data[0]을 직접 반환 (result.id로 확인)
            const savedDocument = result.document || (result.id ? result : null);
            if (savedDocument) {
                // ref에 즉시 저장 (setState 비동기 문제 해결 - handleProgressUpdate에서 사용)
                latestSavedDocumentRef.current = savedDocument;
                setDocumentData(savedDocument);
            }

            // skipSuccessModal이 false(또는 undefined)일 때만 성공 모달 표시
            if (!skipSuccessModal) {
                setSuccessMessage(viewId ? '기업 정보가 수정되었습니다.' : '기업이 등록되었습니다.');
                setSuccessModalOpen(true);
            }
            // 모달 닫을 때 뷰 페이지로 이동하도록 documentId 저장
            const documentId = result.id || result.document_id;
            // successModalOpen이 false가 되면 이동하도록 useEffect 추가 필요
            sessionStorage.setItem('redirectViewId', documentId);
        } catch (error) {
            const message = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
            console.error('저장 중 오류:', error);
            setErrorMessage(message);
            setErrorModalOpen(true);
            throw error; // 호출한 쪽에서 중단할 수 있도록 re-throw
        } finally {
            setIsSaving(false);
        }
    };

    const handleSupplementComplete = async () => {
        setIsSaving(true);
        try {
            // 새로 선택한 추가서류 업로드
            const filesToUpload = additionalFilesRef.current?.getFilesForUpload() || [];
            const uploadedPaths: Array<{ name: string; path: string; size: number }> = [];

            for (const { file, fileName } of filesToUpload) {
                const signedUrlRes = await fetch('/api/upload/signed-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        path: 'additional_files',
                        fileName: file.name,
                        fileSize: file.size,
                        contentType: file.type,
                    }),
                });
                if (!signedUrlRes.ok) throw new Error('파일 업로드 URL 생성 실패');
                const { signedUrl, path } = await signedUrlRes.json();
                const uploadRes = await fetch(signedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type || 'application/octet-stream' },
                    body: file,
                });
                if (!uploadRes.ok) throw new Error('파일 업로드 실패');
                uploadedPaths.push({ name: fileName, path, size: file.size });
            }

            const existingFiles = additionalFilesRef.current?.getExistingFiles() || [];
            const allSupplementFiles = [...existingFiles, ...uploadedPaths];

            const updateRes = await fetch(`/api/documents/${viewId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: '검수',
                    ...(allSupplementFiles.length > 0 ? { supplement_files: allSupplementFiles } : {}),
                }),
            });

            if (!updateRes.ok) {
                const err = await updateRes.json();
                throw new Error(err.error || '보완완료 처리 실패');
            }

            setSuccessMessage('보완이 완료되었습니다.');
            setSupplementCompleted(true);
            setSuccessModalOpen(true);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : '오류 발생');
            setErrorModalOpen(true);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setCancelModalOpen(true);
    };

    const handleCancelConfirm = () => {
        setCancelModalOpen(false);

        // 크레탑 정보 초기화
        if (cretabInfoRef.current && documentData) {
            // 기본 정보 복원
            cretabInfoRef.current.setFormData({
                companyCreditRatingKCB: documentData.company_credit_rating_kcb || '',
                companyCreditRatingNICE: documentData.company_credit_rating_nice || '',
                companyType: documentData.company_type || '',
                standardClassification: documentData.standard_classification || '',
                establishmentDate: documentData.establishment_date || '',
                companyAddress: documentData.company_address || '',
                assessmentDate: documentData.assessment_date || '',
                settlementDate: documentData.settlement_date || '',
                // 재무 테이블 데이터 복원
                years: documentData.financial_data?.years || [],
                assetTotal: documentData.financial_data?.assetTotal || [],
                debtTotal: documentData.financial_data?.debtTotal || [],
                capital: documentData.financial_data?.capital || [],
                equityTotal: documentData.financial_data?.equityTotal || [],
                // 손익 테이블 데이터 복원
                sales: documentData.income_data?.sales || [],
                netIncome: documentData.income_data?.netIncome || [],
                cashFlowGrade: documentData.income_data?.cashFlowGrade || [],
            });

            // 크레탑 파일 상태 복원
            if (documentData.cretop_file) {
                cretabInfoRef.current.setCretabFile({
                    fileName: documentData.cretop_file.name || '',
                    fileSize: documentData.cretop_file.size ? `${(documentData.cretop_file.size / 1024).toFixed(2)} KB` : '0 KB',
                    storagePath: documentData.cretop_file.path,
                });
                cretabInfoRef.current.setCretabStatus('file');
            } else if (documentData.cretop_none) {
                cretabInfoRef.current.setCretabStatus('none');
            } else {
                cretabInfoRef.current.setCretabFile(null);
                cretabInfoRef.current.setCretabStatus(null);
            }

            // 추출된 이미지 복원
            if (documentData.extracted_images) {
                cretabInfoRef.current.setExtractedImages({
                    first: documentData.extracted_images.first || null,
                    second: documentData.extracted_images.second || null,
                });
            }
        }

        // 첨부파일 초기화 (저장되지 않은 변경사항 폐기)
        if (companyFileRef.current) {
            // 업로드된 파일 먼저 초기화
            companyFileRef.current.resetFiles();
            // 그 다음 기존 파일 복원
            if (documentData?.type) {
                companyFileRef.current.setBusinessType(documentData.type);
            }
            if (documentData?.files && Array.isArray(documentData.files)) {
                companyFileRef.current.setExistingFiles(documentData.files, documentData.type);
            }
        }

        // 추가서류 초기화 (저장되지 않은 변경사항 폐기)
        if (additionalFilesRef.current) {
            additionalFilesRef.current.resetUploadedFiles();
        }
        // 추가서류 초기화
        if (additionalFilesRef.current) {
            additionalFilesRef.current.resetUploadedFiles();
            if (documentData?.supplement_files) {
                additionalFilesRef.current.setExistingFiles(documentData.supplement_files);
            }
        }
        if (pendingNavPath) {
            const path = pendingNavPath;
            setPendingNavPath(null);
            router.push(path);
        } else if (viewId) {
            router.push(`?view=${viewId}`);
        } else {
            router.push('/main/document_submission');
        }
    };

    if (isLoading) {
        return <Spinner fullScreen />;
    }

    const handleAccessDeniedClose = () => {
        router.push('/main/home');
    };

    return (
        <>
        <div className={styles.container} style={{ display: accessDenied ? 'none' : 'block' }}>
            <div className={isCreateMode ? styles.companyTitle : styles.companyTitleView}>
                {viewId ? (
                    <>
                        <h2>
                            {documentData?.company_name || '기업명'}
                            <b className={styles.progressBadge} style={getProgressBadgeStyle(documentData?.progress_details)}>
                                {documentData?.progress_details || '상담신청'}
                            </b>
                        </h2>
                        <p>고객사 상세 정보 및 업무 진행 현황</p>
                    </>
                ) : (
                    <>
                        <h2>{isConsultationMode ? '상담신청' : '기업등록'}</h2>
                        <p>{isConsultationMode ? '상담 신청 정보를 입력하세요.' : '고객사 상세 정보 및 서류를 등록하여 심사를 진행하세요.'}</p>
                    </>
                )}
            </div>
            {(() => {
                const isSupplementMode = isViewMode && !isEditMode && documentData?.status === '보완' &&
                    (currentUserPosition?.level === 4 ||
                     (currentUserPosition?.level === 6 && (documentData?.progress_details === '분석' || documentData?.progress_details === '진행' || documentData?.progress_details === '심사')) ||
                     (currentUserPosition?.level === 2 && (documentData?.progress_details === '심사' || documentData?.progress_details === '진행') && currentUserId !== documentData?.manager_id));
                const isAnalysisAdditionalFilesMode = isEditMode && (documentData?.progress_details === '분석' || documentData?.progress_details === '심사' || documentData?.progress_details === '진행') && currentUserPosition?.level === 4;
                const isSimplifiedMode = isSupplementMode || isAnalysisAdditionalFilesMode;
                // A영업자(submitter): 서류요청 이후 단계에서는 파일 섹션 숨김
                const _myId = getAdminData()?.user_id || currentUserId;
                const isSubmitterOnly = !!documentData?.submitter_id &&
                    documentData?.submitter_id === _myId &&
                    documentData?.progress_details !== '상담신청';
                return (
                <div className={styles.companyManagementWrap}>
                    {/* 분석 단계 추가서류 모드에서도 기업정보 표시 (읽기 전용) */}
                    {!isSupplementMode && <CompanyInfoCard ref={companyInfoRef} isViewMode={isViewMode && !isEditMode || isAnalysisAdditionalFilesMode} progressDetails={documentData?.progress_details} status={documentData?.status} onBusinessNumberChange={() => companyFileRef.current?.resetFiles()} />}
                    {!isSupplementMode && (
                        <ProgressStepsSection
                            isViewMode={isViewMode && !isEditMode || isAnalysisAdditionalFilesMode}
                            documentId={viewId}
                            progressDetails={documentData?.progress_details}
                            progressStartDate={documentData?.progress_start_date}
                            managerId={documentData?.manager_id}
                            documentStatus={documentData?.status}
                            documentUserId={documentData?.user_id}
                            submitterId={documentData?.submitter_id}
                            currentUserName={currentUserName}
                            currentUserId={currentUserId}
                            currentUserPositionLevel={currentUserPosition?.level}
                            memos={memos}
                            onValidateAndNext={handleValidateAndNext}
                            onProgressUpdate={handleProgressUpdate}
                            onMemoUpdate={async () => {
                                if (viewId) {
                                    const response = await fetch(`/api/documents/${viewId}`);
                                    if (response.ok) {
                                        const data = await response.json();
                                        if (data.memos) setMemos(data.memos);
                                    }
                                }
                            }}
                            onSave={handleSave}
                            onStaffAssignSuccess={handleStaffAssignSuccess}
                        />
                    )}
                    {!isSupplementMode && viewId && (currentUserPosition?.level !== 4 || documentData?.cretop_file || documentData?.company_credit_rating_kcb || documentData?.company_credit_rating_nice || documentData?.company_type) && <CretabInfo ref={cretabInfoRef} isViewMode={isViewMode && !isEditMode || isAnalysisAdditionalFilesMode} viewId={viewId} isEditMode={isEditMode && !isAnalysisAdditionalFilesMode} onEditClick={documentData?.progress_details === '승인' ? undefined : handleEditCretabFile} userLevel={currentUserPosition?.level} progressDetails={documentData?.progress_details} companyName={documentData?.company_name || ''} />}
                    <MemoSection
                        documentId={viewId}
                        isViewMode={isViewMode && !isEditMode}
                        readOnly={(documentData?.progress_details === '승인요청' || documentData?.progress_details === '승인') && currentUserPosition?.level !== 1}
                        currentUserId={currentUserId}
                        currentUserName={currentUserName}
                        currentUserPositionLevel={currentUserPosition?.level || 0}
                        memos={memos}
                        onMemosChange={handleMemosChange}
                        showOnlyLatest={documentData?.status === '보완' && (currentUserPosition?.level === 4 || (currentUserPosition?.level === 6 && (documentData?.progress_details === '분석' || documentData?.progress_details === '심사' || documentData?.progress_details === '진행')) || (currentUserPosition?.level === 2 && (documentData?.progress_details === '심사' || documentData?.progress_details === '진행') && currentUserId !== documentData?.manager_id))}
                    />
                    {!isSupplementMode && !isConsultationMode && !isSubmitterOnly && (
                        <div id="company-file-section">
                            <CompanyFile
                                ref={companyFileRef}
                                isViewMode={isViewMode && !isEditMode || isAnalysisAdditionalFilesMode}
                                viewId={viewId}
                                progressDetails={documentData?.progress_details}
                                isAuthor={currentUserId === documentData?.user_id}
                                isEditMode={isEditMode && !isAnalysisAdditionalFilesMode}
                                userPositionLevel={currentUserPosition?.level || 0}
                                getBusinessNumber={() => companyInfoRef.current?.getFormData()?.business_number || ''}
                                companyName={documentData?.company_name || companyInfoRef.current?.getFormData()?.company_name || ''}
                                onEditClick={viewId && (isViewMode && !isEditMode) ? () => router.push(`?view=${viewId}&edit=true&fromCompanyFile=true`) : undefined}
                            />
                        </div>
                    )}
                    {!isSubmitterOnly && (
                        <AdditionalFiles
                            ref={additionalFilesRef}
                            isViewMode={isSimplifiedMode ? false : isViewMode && !isEditMode || (documentData?.progress_details === '승인요청' || documentData?.progress_details === '승인') && currentUserPosition?.level !== 1}
                            progressDetails={documentData?.progress_details}
                            userPositionLevel={currentUserPosition?.level || 0}
                            viewId={viewId}
                            onEditClick={!isSimplifiedMode && viewId && !((documentData?.progress_details === '승인요청' || documentData?.progress_details === '승인') && currentUserPosition?.level !== 1) ? () => router.push(`?view=${viewId}&edit=true&fromAdditional=true`) : undefined}
                            readOnly={(documentData?.progress_details === '승인요청' || documentData?.progress_details === '승인') && currentUserPosition?.level !== 1}
                            companyName={documentData?.company_name || companyInfoRef.current?.getFormData()?.company_name || ''}
                        />
                    )}
                </div>
                );
            })()}

            {/* 저장/취소 버튼 (고정) */}
            <div className={styles.buttonFooter}>
                <div className={styles.buttonContainer}>
                    {isViewMode && !isEditMode ? (
                        (() => {
                            const isSupplementMode = documentData?.status === '보완' && (currentUserPosition?.level === 4 || (currentUserPosition?.level === 6 && (documentData?.progress_details === '분석' || documentData?.progress_details === '심사' || documentData?.progress_details === '진행')) || (currentUserPosition?.level === 2 && (documentData?.progress_details === '심사' || documentData?.progress_details === '진행') && currentUserId !== documentData?.manager_id));
                            return (
                            <>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => router.push('/main/document_submission')}
                                    disabled={isSaving}
                                >
                                    돌아가기
                                </button>
                                {isSupplementMode ? (
                                    <button
                                        className={styles.saveBtn}
                                        onClick={handleSupplementComplete}
                                        disabled={isSaving}
                                    >
                                        {isSaving ? '처리 중...' : '보완완료'}
                                    </button>
                                ) : (
                                    documentData?.progress_details !== '승인' && (documentData?.progress_details !== '승인요청' || currentUserPosition?.level === 1) && (
                                        <button
                                            className={styles.saveBtn}
                                            onClick={() => router.push(`?view=${viewId}&edit=true`)}
                                        >
                                            수정
                                        </button>
                                    )
                                )}
                            </>
                            );
                        })()
                    ) : (
                        (() => {
                            const isAnalysisAdditionalFiles = documentData?.progress_details === '분석' && currentUserPosition?.level === 4;
                            return (
                            <>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={handleCancel}
                                    disabled={isSaving}
                                >
                                    취소
                                </button>
                                <button
                                    className={styles.saveBtn}
                                    onClick={() => handleSave()}
                                    disabled={isSaving}
                                >
                                    {isSaving ? '저장 중...' : (viewId ? '저장' : '등록하기')}
                                </button>
                            </>
                            );
                        })()
                    )}
                </div>
            </div>

            {/* 성공 모달 */}
            <ConfirmModal
                isOpen={successModalOpen}
                message={successMessage}
                type="success"
                onConfirm={() => {
                    setSuccessModalOpen(false);
                    if (supplementCompleted) {
                        setSupplementCompleted(false);
                        router.push('/main/document_submission');
                    } else if (viewId) {
                        router.push(`?view=${viewId}`);
                    } else {
                        router.push('/main/document_submission');
                    }
                }}
                confirmButtonText="확인"
                hideCancel={true}
            />

            {/* 에러 모달 */}
            <ConfirmModal
                isOpen={errorModalOpen}
                message={errorMessage}
                type="error"
                onConfirm={() => setErrorModalOpen(false)}
                confirmButtonText="확인"
                hideCancel={true}
            />

        </div>

        {/* 취소 확인 모달 */}
        <Modal
            isOpen={cancelModalOpen}
            message={"작업을 취소하시겠습니까?\n저장하지 않은 내용은 삭제됩니다."}
            onClose={() => setCancelModalOpen(false)}
            type="warning"
            confirmText="확인"
            onConfirm={handleCancelConfirm}
        />

        {/* 접근 권한 없음 모달 */}
        <Modal
            isOpen={accessDenied}
            message="접근 권한이 없습니다."
            onClose={handleAccessDeniedClose}
            type="error"
            confirmText="확인"
            onConfirm={handleAccessDeniedClose}
            showCancelButton={false}
        />
        </>
    )
}

export default function Company1() {
    return (
        <Suspense fallback={<Spinner fullScreen />}>
            <Company1Content />
        </Suspense>
    );
}
