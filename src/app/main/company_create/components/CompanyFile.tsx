'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { File, CheckCircle2, X, Paperclip, Download, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import styles from './CompanyFile.module.css';

type BusinessType = 'business' | 'individual' | null;

interface Document {
    id: string;
    name: string;
    description: string;
}

interface UploadedFile {
    file?: File;
    fileName: string;
    fileSize: string;
    storagePath?: string;
    uploading?: boolean;
}

export interface CompanyFileHandle {
    getFilesForUpload: () => Array<{ docId: string; file: File; fileName: string }>;
    getExistingFiles: () => Array<{ name: string; path: string; size: number }>;
    getBusinessType: () => 'business' | 'individual' | null;
    setBusinessType: (type: 'business' | 'individual') => void;
    setExistingFiles: (files: Array<{ name: string; path: string; size: number }>, type?: 'business' | 'individual') => void;
    validateFormData: () => { valid: boolean; message?: string };
    resetFiles: () => void;
}

interface CompanyFileProps {
    isViewMode?: boolean;
    viewId?: string | null;
    progressDetails?: string | null;
    isAuthor?: boolean;
    isEditMode?: boolean;
    userPositionLevel?: number;
    getBusinessNumber?: () => string;
    companyName?: string;
}

const CompanyFile = forwardRef<CompanyFileHandle, CompanyFileProps>(function CompanyFile({ isViewMode = false, viewId = null, progressDetails = null, isAuthor = false, isEditMode = false, userPositionLevel = 0, getBusinessNumber, companyName = '' }, ref) {
    const [businessType, setBusinessType] = useState<BusinessType>(null);
    const [alertModal, setAlertModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
    const [uploadedFilesByType, setUploadedFilesByType] = useState<Record<'business' | 'individual', Record<string, UploadedFile>>>({
        business: {},
        individual: {}
    });
    const [existingFilesByType, setExistingFilesByType] = useState<Record<'business' | 'individual', Array<{ name: string; path: string; size: number }>>>({
        business: [],
        individual: []
    });
    // 서버에서 로드된 원본 파일 목록 (저장 전 X/교체 조작에 영향받지 않음, 다운로드용)
    const [savedFilesByType, setSavedFilesByType] = useState<Record<'business' | 'individual', Array<{ name: string; path: string; size: number }>>>({
        business: [],
        individual: []
    });
    const uploadedFiles = businessType && businessType in uploadedFilesByType ? uploadedFilesByType[businessType] : {};
    const existingFiles = businessType && businessType in existingFilesByType ? existingFilesByType[businessType] : [];
    const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
    const [draggingDocId, setDraggingDocId] = useState<string | null>(null);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const businessDocuments: Document[] = [
        {
            id: 'business_license',
            name: '사업자등록증',
            description: '필수 서류를 업로드해주세요',
        },
        {
            id: 'financial_statement',
            name: '재무제표',
            description: '필수 서류를 업로드해주세요',
        },
        {
            id: 'vat_certificate',
            name: '부가세증명원',
            description: '필수 서류를 업로드해주세요',
        },
    ];

    const individualDocuments: Document[] = [
        {
            id: 'business_license',
            name: '사업자등록증',
            description: '필수 서류를 업로드해주세요',
        },
        {
            id: 'id_copy',
            name: '신분증사본',
            description: '필수 서류를 업로드해주세요',
        },
    ];

    const documents = businessType === 'business' ? businessDocuments :
                      businessType === 'individual' ? individualDocuments :
                      [];

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const uploadFileToStorage = async (file: File, docType: string): Promise<string | null> => {
        try {
            setUploadError(null);

            // 1. Signed URL 요청
            const signedUrlResponse = await fetch('/api/upload/signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: docType,
                    fileName: file.name,
                    fileSize: file.size,
                    contentType: file.type,
                }),
            });

            if (!signedUrlResponse.ok) {
                const errorData = await signedUrlResponse.json();
                throw new Error(errorData.error || '서명된 URL 생성 실패');
            }

            const { signedUrl, path } = await signedUrlResponse.json();

            // 2. 파일을 Signed URL에 업로드
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

            return path;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '파일 업로드 중 오류 발생';
            setUploadError(errorMessage);
            console.error('업로드 오류:', errorMessage);
            return null;
        }
    };

    useImperativeHandle(ref, () => ({
        getFilesForUpload: () => {
            return Object.entries(uploadedFiles)
                .filter(([, file]) => file.file !== undefined)
                .map(([docId, file]) => ({
                    docId,
                    file: file.file as File,
                    fileName: file.fileName,
                }));
        },
        getExistingFiles: () => existingFiles,
        getBusinessType: () => businessType,
        setBusinessType: (type: 'business' | 'individual') => {
            setBusinessType(type);
        },
        setExistingFiles: (files: Array<{ name: string; path: string; size: number }>, type?: 'business' | 'individual') => {
            const targetType = type || businessType;
            if (targetType) {
                setExistingFilesByType((prev) => ({
                    ...prev,
                    [targetType]: files
                }));
                // 서버에서 로드된 원본 저장
                setSavedFilesByType((prev) => ({
                    ...prev,
                    [targetType]: files
                }));
            }
        },
        validateFormData: () => {
            // 사업자 유형 확인
            if (!businessType) {
                return { valid: false, message: '사업자 유형을 선택해주세요.' };
            }

            const docs = businessType === 'business' ? businessDocuments : individualDocuments;

            // 각 필수 문서가 업로드되었거나 기존 파일이 있는지 확인
            for (const doc of docs) {
                const hasUploadedFile = !!uploadedFiles[doc.id];
                const hasExistingFile = existingFiles.some(f => f.name?.includes(doc.id) || f.path?.includes(doc.id));

                if (!hasUploadedFile && !hasExistingFile) {
                    return { valid: false, message: `${doc.name}을(를) 업로드해주세요.` };
                }
            }

            return { valid: true };
        },
        resetFiles: () => {
            setBusinessType(null);
            setUploadedFilesByType({ business: {}, individual: {} });
            setExistingFilesByType({ business: [], individual: [] });
            setSavedFilesByType({ business: [], individual: [] });
        },
    }));

    const handleUploadClick = (docId: string) => {
        fileInputRefs.current[docId]?.click();
    };

    const handleDropFile = (e: React.DragEvent, docId: string) => {
        e.preventDefault();
        setDraggingDocId(null);
        if (isViewMode || !businessType) return;
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        setUploadedFilesByType((prev) => ({
            ...prev,
            [businessType]: {
                ...prev[businessType],
                [docId]: {
                    file,
                    fileName: file.name,
                    fileSize: `${(file.size / 1024).toFixed(2)} KB`,
                },
            },
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
        const file = e.target.files?.[0];
        if (file && businessType) {
            // 파일 크기 검증 (5GB 제한)
            if (file.size > 5 * 1024 * 1024 * 1024) {
                setUploadError('파일 크기는 5GB 이하여야 합니다.');
                return;
            }

            // 메모리에만 저장 (저장 시 업로드)
            setUploadedFilesByType((prev) => ({
                ...prev,
                [businessType]: {
                    ...prev[businessType],
                    [docId]: {
                        file,
                        fileName: file.name,
                        fileSize: formatFileSize(file.size),
                    },
                }
            }));

            // input 초기화 (setTimeout으로 지연)
            setTimeout(() => {
                if (fileInputRefs.current[docId]) {
                    fileInputRefs.current[docId]!.value = '';
                }
            }, 0);
        }
    };

    const handleRemoveFile = (docId: string) => {
        if (businessType) {
            setUploadedFilesByType((prev) => {
                const newTypeFiles = { ...prev[businessType] };
                delete newTypeFiles[docId];
                return {
                    ...prev,
                    [businessType]: newTypeFiles
                };
            });
            if (fileInputRefs.current[docId]) {
                fileInputRefs.current[docId]!.value = '';
            }
        }
    };

    const handleRemoveExistingFile = (docId: string) => {
        if (businessType) {
            setExistingFilesByType((prev) => ({
                ...prev,
                [businessType]: prev[businessType].filter(f => !(f.name?.includes(docId) || f.path?.includes(docId)))
            }));
        }
    };

    const isFileUploaded = (docId: string) => !!uploadedFiles[docId];

    const getExistingFile = (docId: string) => {
        // existingFiles에서 현재 docId와 매칭되는 파일을 찾음
        // files 구조를 보면 doc_business_license 같은 형식이므로 매칭 필요
        return existingFiles.find(f => f.name?.includes(docId) || f.path?.includes(docId));
    };


    const handleOpenPreview = (file: UploadedFile) => {
        setPreviewFile(file);
        if (file.file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const result = e.target?.result;
                if (typeof result === 'string') {
                    setPreviewUrl(result);
                }
            };
            reader.readAsDataURL(file.file);
        }
    };

    const handleClosePreview = () => {
        setPreviewFile(null);
        setPreviewUrl(null);
    };

    const isImageFile = (fileName: string): boolean => {
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
        const ext = fileName.split('.').pop()?.toLowerCase();
        return ext ? imageExtensions.includes(ext) : false;
    };

    const isPdfFile = (fileName: string): boolean => {
        return fileName.toLowerCase().endsWith('.pdf');
    };


    const handleDownloadFilesZip = async () => {
        const savedFiles = businessType ? savedFilesByType[businessType] : [];
        if (savedFiles.length === 0) {
            alert('다운로드할 파일이 없습니다.');
            return;
        }

        try {
            const zip = new JSZip();

            // 실제 저장된 파일 기준으로 다운로드 (로컬 X/교체 조작 무시)
            for (const file of savedFiles) {
                try {
                    const response = await fetch('/api/file/view', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filePath: file.path }),
                    });
                    const data = await response.json();
                    if (data.url) {
                        const fileResponse = await fetch(data.url);
                        const blob = await fileResponse.blob();
                        zip.file(file.name, blob);
                    }
                } catch (e) {
                    console.error(`파일 fetch 실패: ${file.name}`, e);
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const dateStr = new Date().toISOString().slice(0, 10);
            const prefix = companyName ? `${companyName}_` : '';
            a.download = `${prefix}첨부파일_${dateStr}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('ZIP 생성 실패:', error);
            alert('파일 다운로드에 실패했습니다.');
        }
    };

    return (
        <div className={styles.fileWrap}>
            <div className={styles.fileTitle}>
                <div className={styles.fileTitleContent}>
                    <div className={styles.fileTitleLeft}>
                        <Paperclip size={20} />
                        <h2>첨부파일 등록</h2>
                    </div>
                    <h3>필요한 서류를 선택하여 업로드해주세요</h3>
                </div>
            </div>

            {uploadError && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px',
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '6px',
                    marginBottom: '16px',
                    color: '#c33',
                }}>
                    <AlertCircle size={16} />
                    <span>{uploadError}</span>
                    <button
                        onClick={() => setUploadError(null)}
                        style={{
                            marginLeft: 'auto',
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            cursor: 'pointer',
                            fontSize: '18px',
                        }}
                    >
                        ×
                    </button>
                </div>
            )}

            <div className={styles.businessTypeSelector}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        className={`${styles.typeBtn} ${businessType === 'business' ? styles.active : ''}`}
                        onClick={() => {
                            if (getBusinessNumber) {
                                const num = getBusinessNumber().replace(/\D/g, '');
                                if (!num || num.length !== 10) {
                                    setAlertModal({ open: true, message: '사업자등록번호를 먼저 입력해주세요.' });
                                    return;
                                }
                                const mid = parseInt(num.substring(3, 5), 10);
                                if (mid >= 1 && mid <= 79) {
                                    setAlertModal({ open: true, message: '사업자등록번호가 개인사업자 번호입니다.\n다시 확인해주세요.' });
                                    return;
                                }
                            }
                            setBusinessType('business');
                        }}
                        disabled={!!(isViewMode || (!isEditMode && viewId && userPositionLevel === 4 && progressDetails !== '서류요청') || (!isEditMode && viewId && progressDetails === '분석'))}
                    >
                        법인사업자
                    </button>
                    <button
                        className={`${styles.typeBtn} ${businessType === 'individual' ? styles.active : ''}`}
                        onClick={() => {
                            if (getBusinessNumber) {
                                const num = getBusinessNumber().replace(/\D/g, '');
                                if (!num || num.length !== 10) {
                                    setAlertModal({ open: true, message: '사업자등록번호를 먼저 입력해주세요.' });
                                    return;
                                }
                                const mid = parseInt(num.substring(3, 5), 10);
                                if (mid >= 80 && mid <= 99) {
                                    setAlertModal({ open: true, message: '사업자등록번호가 법인사업자 번호입니다.\n다시 확인해주세요.' });
                                    return;
                                }
                            }
                            setBusinessType('individual');
                        }}
                        disabled={!!(isViewMode || (!isEditMode && viewId && userPositionLevel === 4 && progressDetails !== '서류요청') || (!isEditMode && viewId && progressDetails === '분석'))}
                    >
                        개인사업자
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {(businessType ? savedFilesByType[businessType] : []).length > 0 && (
                        <button
                            className={styles.downloadBtn}
                            onClick={handleDownloadFilesZip}
                            title="첨부파일 일괄 다운로드"
                        >
                            <Download size={18} />
                            다운로드
                        </button>
                    )}
                </div>
            </div>

            <div className={`${styles.docList} ${!businessType ? styles.empty : ''}`}>
                {!businessType ? (
                    <div className={styles.emptyPlaceholder}>
                        <p className={styles.placeholderText}>사업자를 선택해주세요</p>
                    </div>
                ) : (
                    documents.map((doc) => {
                        const isUploaded = isFileUploaded(doc.id);
                        const uploadedFile = uploadedFiles[doc.id];
                        const existingFile = getExistingFile(doc.id);
                        const hasFile = isUploaded || existingFile;

                        return (
                            <div key={doc.id}>
                                {hasFile ? (
                                    <div
                                        className={styles.uploadedItem}
                                        onClick={async () => {
                                            if (isUploaded) {
                                                handleOpenPreview(uploadedFile);
                                            } else if (existingFile) {
                                                // 기존 파일 미리보기
                                                try {
                                                    const response = await fetch('/api/file/view', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ filePath: existingFile.path }),
                                                    });
                                                    const data = await response.json();
                                                    setPreviewFile({
                                                        fileName: existingFile.name,
                                                        fileSize: formatFileSize(existingFile.size),
                                                        storagePath: existingFile.path
                                                    });
                                                    setPreviewUrl(data.url);
                                                } catch (error) {
                                                    console.error('미리보기 로드 실패:', error);
                                                }
                                            }
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div
                                            className={styles.uploadedContent}
                                        >
                                            <CheckCircle2 className={styles.checkIcon} />
                                            <div className={styles.uploadedInfo}>
                                                <p className={styles.uploadedName}>{doc.name}</p>
                                                <p className={styles.uploadedMeta}>
                                                    {isUploaded ? `${uploadedFile.fileName} · ${uploadedFile.fileSize}` : `${existingFile?.name}`}
                                                </p>
                                            </div>
                                        </div>
                                        {!isViewMode && (
                                            <button
                                                className={styles.removeIcon}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (isUploaded) {
                                                        handleRemoveFile(doc.id);
                                                    } else if (existingFile) {
                                                        handleRemoveExistingFile(doc.id);
                                                    }
                                                }}
                                            >
                                                <X size={20} />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div
                                        className={`${styles.docItem} ${draggingDocId === doc.id ? styles.dragging : ''}`}
                                        onDragOver={(e) => { e.preventDefault(); if (!isViewMode && businessType) setDraggingDocId(doc.id); }}
                                        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDraggingDocId(null); }}
                                        onDrop={(e) => handleDropFile(e, doc.id)}
                                    >
                                        <div className={styles.docContent}>
                                            <File className={styles.docIcon} />
                                            <div className={styles.docInfo}>
                                                <p className={styles.docName}>
                                                    {doc.name}
                                                    <span className={styles.docRequired}>*</span>
                                                </p>
                                                <p className={styles.docDescription}>{doc.description}</p>
                                            </div>
                                        </div>
                                        <button
                                            className={styles.uploadBtn}
                                            onClick={() => handleUploadClick(doc.id)}
                                        >
                                            업로드
                                        </button>
                                        <input
                                            type="file"
                                            ref={(ref) => {
                                                if (ref) fileInputRefs.current[doc.id] = ref;
                                            }}
                                            onChange={(e) => handleFileChange(e, doc.id)}
                                            style={{ display: 'none' }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* 미리보기 모달 */}
            {previewFile && previewUrl && (
                <div className={styles.previewModal} onClick={handleClosePreview}>
                    <div className={styles.previewContent} onClick={(e) => e.stopPropagation()}>
                        <button className={styles.previewCloseBtn} onClick={handleClosePreview}>
                            <X size={24} />
                        </button>
                        <div className={styles.previewBody}>
                            {isImageFile(previewFile.fileName) ? (
                                <img src={previewUrl} alt={previewFile.fileName} className={styles.previewImage} />
                            ) : isPdfFile(previewFile.fileName) ? (
                                <iframe src={previewUrl} className={styles.previewPdf} />
                            ) : (
                                <div className={styles.previewOther}>
                                    <File size={64} />
                                    <p className={styles.previewFileName}>{previewFile.fileName}</p>
                                    <p className={styles.previewFileSize}>{previewFile.fileSize}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <ConfirmModal
                isOpen={alertModal.open}
                message={alertModal.message}
                type="error"
                onConfirm={() => setAlertModal({ open: false, message: '' })}
                confirmButtonText="확인"
                hideCancel
            />
        </div>
    );
});

CompanyFile.displayName = 'CompanyFile';

export default CompanyFile;
