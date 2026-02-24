'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import styles from './companyCreate1.module.css';
import Modal from '@/app/components/Modal/Modal';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import CompanyInfoCard, { CompanyInfoCardHandle } from './components/CompanyInfoCard';
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

    const companyInfoRef = useRef<CompanyInfoCardHandle>(null);
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
                    companyFileRef.current.setExistingFiles(documentData.files);
                }
            }

            // 추가 서류 설정
            if (additionalFilesRef.current) {
                if (documentData.supplement_files && Array.isArray(documentData.supplement_files)) {
                    additionalFilesRef.current.setExistingFiles(documentData.supplement_files);
                }
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
                throw new Error('기업명은 필수입니다.');
            }
            if (!formData.business_number?.trim()) {
                throw new Error('사업자등록번호는 필수입니다.');
            }
            if (!formData.representative_name?.trim()) {
                throw new Error('대표자명은 필수입니다.');
            }
            if (!formData.phone?.trim()) {
                throw new Error('연락처는 필수입니다.');
            }

            // 2. 파일 데이터 수집
            const companyFiles = companyFileRef.current?.getFilesForUpload() || [];
            const existingFiles = companyFileRef.current?.getExistingFiles() || [];
            const cretabFileObj = companyFileRef.current?.getCretabFileForUpload() || null;
            const additionalFiles = additionalFilesRef.current?.getFilesForUpload() || [];

            // 3. 사업자 유형 검증
            const businessType = companyFileRef.current?.getBusinessType();
            if (!businessType) {
                throw new Error('사업자를 선택해주세요.');
            }

            const isCompany = businessType === 'business';
            const isIndividual = businessType === 'individual';

            // 4. 필수 서류 검증 (하나씩 체크)
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

            // 3. 파일 업로드 및 경로 수집
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

            // 4. DB에 저장 (API 호출)
            const now = new Date();
            // 기존 파일과 새 파일 합치기
            const allFiles = [...existingFiles, ...uploadedFiles];
            const additionalFilesCombined = [...existingFiles?.filter((f: any) => !f.path?.includes('documents')) || [], ...additionalFilesPaths];

            const response = await fetch(isEditMode && viewId ? `/api/documents/${viewId}` : '/api/documents', {
                method: isEditMode && viewId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
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
                    submitted_date: now.toLocaleString('ko-KR'),
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'DB 저장 실패');
            }

            const result = await response.json();
            console.log('저장 완료:', result);
            setSuccessMessage('기업 정보가 성공적으로 저장되었습니다!');
            setSuccessModalOpen(true);
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
                <h2>(주)테크이노베이션<b>{documentData?.progress_status === 'not_started' ? '대기중' : '진행중'}</b></h2>
                <p>고객사 상세 정보 및 업무 진행 현황</p>
            </div>
            <div className={styles.companyManagementWrap}>
                <CompanyInfoCard ref={companyInfoRef} isViewMode={isViewMode && !isEditMode} />
                <ProgressStepsSection />
                <CompanyFile ref={companyFileRef} isViewMode={isViewMode && !isEditMode} />
                <MemoSection />
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
                                {isSaving ? '저장 중...' : '저장'}
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
                onConfirm={() => setSuccessModalOpen(false)}
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