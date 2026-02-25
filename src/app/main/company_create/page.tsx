'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import styles from './companyCreate1.module.css';
import Modal from '@/app/components/Modal/Modal';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import CompanyInfoCard, { CompanyInfoCardHandle } from './components/CompanyInfoCard';
import CretabInfo, { CretabInfoHandle, CretabFormData } from './components/CretabInfo';
import ProgressStepsSection from './components/ProgressStepsSection';
import CompanyFile, { CompanyFileHandle } from './components/CompanyFile';
import MemoSection from './components/MemoSection';
import AdditionalFiles, { AdditionalFilesHandle } from './components/AdditionalFiles';

function Company1Content() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const viewId = searchParams.get('view');
    const editParam = searchParams.get('edit');

    const [isSaving, setIsSaving] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [cancelModalOpen, setCancelModalOpen] = useState(false);
    const [isViewMode, setIsViewMode] = useState(!!viewId);
    const [isEditMode, setIsEditMode] = useState(false);
    const [documentData, setDocumentData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(!!viewId);
    const [accessDenied, setAccessDenied] = useState(false);
    const [currentUserId, setCurrentUserId] = useState('');
    const [currentUserName, setCurrentUserName] = useState('');
    const [currentUserPosition, setCurrentUserPosition] = useState<any>(null);
    const [memos, setMemos] = useState<any[]>([]);

    const companyInfoRef = useRef<CompanyInfoCardHandle>(null);
    const cretabInfoRef = useRef<CretabInfoHandle>(null);
    const companyFileRef = useRef<CompanyFileHandle>(null);
    const additionalFilesRef = useRef<AdditionalFilesHandle>(null);

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

    // viewId 감시 - 문서 조회
    useEffect(() => {
        if (viewId) {
            fetchDocumentData(parseInt(viewId));
        }
    }, [viewId]);

    // edit 파라미터 감시 - 수정 모드 활성화
    useEffect(() => {
        if (editParam === 'true' && viewId) {
            setIsEditMode(true);
        } else {
            setIsEditMode(false);
        }
    }, [editParam, viewId]);

    // 조회한 문서 데이터를 폼에 반영
    useEffect(() => {
        if (documentData) {
            // 기본 정보 설정
            if (companyInfoRef.current) {
                companyInfoRef.current.setFormData({
                    company_name: documentData.company_name || '',
                    business_number: documentData.business_number || '',
                    representative_name: documentData.representative_name || '',
                    phone: documentData.phone || '',
                });
            }

            // 파일 정보 설정
            if (companyFileRef.current) {
                // 사업자 유형 설정
                if (documentData.type) {
                    companyFileRef.current.setBusinessType(documentData.type);
                }
                // 기존 파일 설정
                if (documentData.files && Array.isArray(documentData.files)) {
                    companyFileRef.current.setExistingFiles(documentData.files, documentData.type);
                }
            }

            // 크레탑 정보 설정
            if (cretabInfoRef.current) {
                // 크레탑 폼 데이터 설정
                cretabInfoRef.current.setFormData({
                    companyCreditRatingKCB: documentData.company_credit_rating_kcb || '',
                    companyCreditRatingNICE: documentData.company_credit_rating_nice || '',
                    companyType: documentData.company_type || '',
                    standardClassification: documentData.standard_classification || '',
                    establishmentDate: documentData.establishment_date || '',
                    companyAddress: documentData.company_address || '',
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
            }

            // 추가 서류 설정
            if (additionalFilesRef.current) {
                if (documentData.supplement_files && Array.isArray(documentData.supplement_files)) {
                    additionalFilesRef.current.setExistingFiles(documentData.supplement_files);
                }
            }

            // 메모 설정
            if (documentData.memos && Array.isArray(documentData.memos)) {
                setMemos(documentData.memos);
            }
        }
    }, [documentData]);

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
            // CretabInfo 유효성 검사
            const cretabValidation = cretabInfoRef.current?.validateFormData();
            if (!cretabValidation?.valid) {
                setErrorMessage(cretabValidation?.message || '크레탑 정보를 모두 입력해주세요.');
                setErrorModalOpen(true);
                return false;
            }

            // 크레탑 파일 확인
            const businessType = companyFileRef.current?.getBusinessType();
            const cretabFile = cretabInfoRef.current?.getCretabFileForUpload();
            const cretabStatus = cretabInfoRef.current?.getCretabStatus();

            if (!cretabFile && cretabStatus !== 'none') {
                setErrorMessage('크레탑 파일을 업로드하거나\n정보없음을 선택해주세요.');
                setErrorModalOpen(true);
                return false;
            }

            return true;
        } catch (error) {
            console.error('유효성 검사 실패:', error);
            return false;
        }
    };

    const handleProgressUpdate = (progressDetails: string) => {
        if (documentData) {
            setDocumentData({ ...documentData, progress_details: progressDetails });
        }
    };

    const handleEditCretabFile = () => {
        router.push(`?view=${viewId}&edit=true`);
    };

    const getProgressBadgeStyle = (progress: string | null | undefined) => {
        const styleMap: Record<string, React.CSSProperties> = {
            '상담': { background: '#e3f2fd', color: '#1976d2' },
            '서류요청': { background: '#fff3e0', color: '#f57c00' },
            '분석': { background: '#f3e5f5', color: '#7b1fa2' },
            '진행': { background: '#e8f5e9', color: '#388e3c' },
            '승인': { background: '#fce4ec', color: '#c2185b' },
        };
        return styleMap[progress || '상담'] || styleMap['상담'];
    };

    const handleSave = async () => {
        try {
            setIsSaving(true);

            // 사용자 정보 추출
            const adminData = getAdminData();
            if (!adminData) {
                throw new Error('사용자 정보를 찾을 수 없습니다.');
            }
            const userId = adminData.user_id;

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

            // 크레탑 정보 검증 (CretabInfo가 있는 경우에만)
            if (viewId && currentUserPosition?.level !== 4) {
                // 크레탑 폼 데이터 검증
                const cretabValidation = cretabInfoRef.current?.validateFormData();
                if (!cretabValidation?.valid) {
                    throw new Error(cretabValidation?.message || '크레탑 정보를 모두 입력해주세요.');
                }

                // 크레탑 파일 또는 정보없음 선택 검증
                const cretabFile = cretabInfoRef.current?.getCretabFileForUpload();
                const cretabStatus = cretabInfoRef.current?.getCretabStatus();
                if (!cretabFile && cretabStatus !== 'none') {
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
                companyAddress: ''
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

            // 4. 사업자 유형 검증
            const businessType = companyFileRef.current?.getBusinessType();
            if (!businessType) {
                throw new Error('사업자를 선택해주세요.');
            }

            const isCompany = businessType === 'business';
            const isIndividual = businessType === 'individual';

            // 5. 필수 서류 검증 (하나씩 체크)
            const requiredDocs = isCompany
                ? ['business_license', 'financial_statement', 'vat_certificate']
                : ['business_license', 'id_copy'];

            const uploadedDocIds = companyFiles.map((f: any) => f.docId);
            // existingFiles의 path에서 docId 추출 (예: 'documents/business_license/...' 형식)
            const existingDocIds = existingFiles.map((f: any) => {
                const pathParts = f.path?.split('/') || [];
                // path 구조: documents/{docId}/... 또는 company_create1/{userId}/{docType}/{filename}
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

            // 첫 번째 누락된 서류만 에러 표시
            for (const docId of requiredDocs) {
                if (!allDocIds.includes(docId)) {
                    throw new Error(`${docNameMap[docId]} 서류를 업로드해주세요.`);
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
            }

            // 추가서류 업로드
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

            // 7. DB에 저장 (API 호출)
            const now = new Date();
            // 기존 파일과 새 파일 합치기
            const allFiles = [...existingFiles, ...uploadedFiles];
            const additionalFilesCombined = [...existingFiles?.filter((f: any) => !f.path?.includes('documents')) || [], ...additionalFilesPaths];

            const saveData: any = {
                user_id: userId,
                user_name: adminData.name || userId,
                document_type: '기업등록',
                title: formData.company_name,
                status: '정상',
                progress_status: 'not_started',
                company_name: formData.company_name,
                business_number: formData.business_number,
                representative_name: formData.representative_name,
                phone: formData.phone,
                manager_name: '',
                progress_details: '서류요청',
                type: businessType,
                // 파일 경로들 (DB 컬럼명과 맞춰야 함)
                files: allFiles, // 첨부파일
                cretop_file: cretabFileData, // 크레탑 파일
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
                saveData.cretop_none = cretabStatus === 'none'; // 정보 없음 여부
            }

            const response = await fetch(isEditMode && viewId ? `/api/documents/${viewId}` : '/api/documents', {
                method: isEditMode && viewId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'DB 저장 실패');
            }

            const result = await response.json();
            console.log('저장 완료:', result);
            setSuccessMessage(viewId ? '기업 정보가 수정되었습니다.' : '기업이 등록되었습니다.');
            setSuccessModalOpen(true);
            // 모달 닫을 때 뷰 페이지로 이동하도록 documentId 저장
            const documentId = result.id || result.document_id;
            // successModalOpen이 false가 되면 이동하도록 useEffect 추가 필요
            sessionStorage.setItem('redirectViewId', documentId);
        } catch (error) {
            const message = error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.';
            console.error('저장 중 오류:', error);
            setErrorMessage(message);
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
        // 첨부파일 초기화 (저장되지 않은 변경사항 폐기)
        if (companyFileRef.current) {
            if (documentData?.type) {
                companyFileRef.current.setBusinessType(documentData.type);
            }
            if (documentData?.files && Array.isArray(documentData.files)) {
                companyFileRef.current.setExistingFiles(documentData.files, documentData.type);
            }
        }
        // 추가서류 초기화
        if (additionalFilesRef.current && documentData?.supplement_files) {
            additionalFilesRef.current.setExistingFiles(documentData.supplement_files);
        }
        if (viewId) {
            router.push(`?view=${viewId}`);
        } else {
            router.push('/main/document_submission');
        }
    };

    if (isLoading) {
        return (
            <div className={styles.container}>
                <div style={{ padding: '40px', textAlign: 'center' }}>
                    <p>로딩 중...</p>
                </div>
            </div>
        );
    }

    if (accessDenied) {
        return (
            <div className={styles.container}>
                <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>
                    <p>접근 권한이 없습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.companyTitle}>
                {viewId ? (
                    <>
                        <h2>
                            {documentData?.company_name || '기업명'}
                            <b className={styles.progressBadge} style={getProgressBadgeStyle(documentData?.progress_details)}>
                                {documentData?.progress_details || '상담'}
                            </b>
                        </h2>
                        <p>고객사 상세 정보 및 업무 진행 현황</p>
                    </>
                ) : (
                    <>
                        <h2>기업등록</h2>
                        <p>고객사 상세 정보 및 서류를 등록하여 심사를 진행하세요.</p>
                    </>
                )}
            </div>
            <div className={styles.companyManagementWrap}>
                <CompanyInfoCard ref={companyInfoRef} isViewMode={isViewMode && !isEditMode} />
                <ProgressStepsSection
                    isViewMode={isViewMode}
                    documentId={viewId}
                    progressDetails={documentData?.progress_details}
                    managerId={documentData?.manager_id}
                    onValidateAndNext={handleValidateAndNext}
                    onProgressUpdate={handleProgressUpdate}
                />
                {viewId && currentUserPosition?.level !== 4 && <CretabInfo ref={cretabInfoRef} isViewMode={isViewMode && !isEditMode} viewId={viewId} isEditMode={isEditMode} onEditClick={handleEditCretabFile} />}
                <MemoSection
                    documentId={viewId}
                    isViewMode={isViewMode && !isEditMode}
                    currentUserId={currentUserId}
                    currentUserName={currentUserName}
                    currentUserPositionLevel={currentUserPosition?.level || 0}
                    memos={memos}
                    onMemosChange={handleMemosChange}
                />
                <CompanyFile
                    ref={companyFileRef}
                    isViewMode={isViewMode && !isEditMode}
                    viewId={viewId}
                    progressDetails={documentData?.progress_details}
                    isAuthor={currentUserId === documentData?.user_id}
                    isEditMode={isEditMode}
                    userPositionLevel={currentUserPosition?.level || 0}
                />
                <AdditionalFiles ref={additionalFilesRef} isViewMode={isViewMode && !isEditMode} />
            </div>

            {/* 저장/취소 버튼 (고정) */}
            <div className={styles.buttonFooter}>
                <div className={styles.buttonContainer}>
                    {isViewMode && !isEditMode ? (
                        <>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => router.push('/main/document_submission')}
                            >
                                돌아가기
                            </button>
                            <button
                                className={styles.saveBtn}
                                onClick={() => router.push(`?view=${viewId}&edit=true`)}
                            >
                                수정
                            </button>
                        </>
                    ) : (
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
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (viewId ? '저장 중...' : '등록 중...') : (viewId ? '저장' : '등록하기')}
                            </button>
                        </>
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
                    if (viewId) {
                        // 수정 모드: view 페이지로 리다이렉트
                        router.push(`?view=${viewId}`);
                    } else {
                        // 신규 등록: document_submission으로 리다이렉트
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

            {/* 취소 확인 모달 */}
            <Modal
                isOpen={cancelModalOpen}
                message="작업을 취소하시겠습니까?<br>저장하지 않은 내용은 삭제됩니다."
                onClose={() => setCancelModalOpen(false)}
                type="warning"
                confirmText="확인"
                onConfirm={handleCancelConfirm}
            />
        </div>
    )
}

export default function Company1() {
    return (
        <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center' }}><p>로딩 중...</p></div>}>
            <Company1Content />
        </Suspense>
    );
}