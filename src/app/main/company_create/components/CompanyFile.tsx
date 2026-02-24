'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { File, CheckCircle2, X, Check, Paperclip, Download, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
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

interface CretabFile {
    file?: File;
    fileName: string;
    fileSize: string;
    storagePath?: string;
    uploading?: boolean;
}

export interface CompanyFileHandle {
    getFilesForUpload: () => Array<{ docId: string; file: File; fileName: string }>;
    getExistingFiles: () => Array<{ name: string; path: string; size: number }>;
    getCretabFileForUpload: () => { file: File; fileName: string } | null;
    getBusinessType: () => 'business' | 'individual' | null;
    setBusinessType: (type: 'business' | 'individual') => void;
    setExistingFiles: (files: Array<{ name: string; path: string; size: number }>) => void;
}

interface CompanyFileProps {
    isViewMode?: boolean;
}

const CompanyFile = forwardRef<CompanyFileHandle, CompanyFileProps>(function CompanyFile({ isViewMode = false }, ref) {
    const [businessType, setBusinessType] = useState<BusinessType>(null);
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile>>({});
    const [existingFiles, setExistingFiles] = useState<Array<{ name: string; path: string; size: number }>>([]);
    const [cretabStatus, setCretabStatus] = useState<'none' | 'file' | null>(null);
    const [cretabFile, setCretabFile] = useState<CretabFile | null>(null);
    const [previewFile, setPreviewFile] = useState<CretabFile | UploadedFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const cretabFileInputRef = useRef<HTMLInputElement | null>(null);

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
        getCretabFileForUpload: () => {
            return cretabFile && cretabFile.file ? { file: cretabFile.file, fileName: cretabFile.fileName } : null;
        },
        getBusinessType: () => businessType,
        setBusinessType: (type: 'business' | 'individual') => {
            setBusinessType(type);
        },
        setExistingFiles: (files: Array<{ name: string; path: string; size: number }>) => {
            setExistingFiles(files);
        },
    }));

    const handleUploadClick = (docId: string) => {
        fileInputRefs.current[docId]?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
        const file = e.target.files?.[0];
        if (file) {
            // 파일 크기 검증 (5GB 제한)
            if (file.size > 5 * 1024 * 1024 * 1024) {
                setUploadError('파일 크기는 5GB 이하여야 합니다.');
                return;
            }

            // 메모리에만 저장 (저장 시 업로드)
            setUploadedFiles((prev) => ({
                ...prev,
                [docId]: {
                    file,
                    fileName: file.name,
                    fileSize: formatFileSize(file.size),
                },
            }));
        }
    };

    const handleRemoveFile = (docId: string) => {
        setUploadedFiles((prev) => {
            const newFiles = { ...prev };
            delete newFiles[docId];
            return newFiles;
        });
        if (fileInputRefs.current[docId]) {
            fileInputRefs.current[docId]!.value = '';
        }
    };

    const isFileUploaded = (docId: string) => !!uploadedFiles[docId];

    const getExistingFile = (docId: string) => {
        // existingFiles에서 현재 docId와 매칭되는 파일을 찾음
        // files 구조를 보면 doc_business_license 같은 형식이므로 매칭 필요
        return existingFiles.find(f => f.name?.includes(docId) || f.path?.includes(docId));
    };

    const handleCretabFileClick = () => {
        cretabFileInputRef.current?.click();
    };

    const handleCretabFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // 파일 크기 검증 (5GB 제한)
            if (file.size > 5 * 1024 * 1024 * 1024) {
                setUploadError('파일 크기는 5GB 이하여야 합니다.');
                return;
            }

            // 메모리에만 저장 (저장 시 업로드)
            setCretabFile({
                file,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
            });
            setCretabStatus('file');
        }
    };

    const handleCretabNoneClick = () => {
        setCretabStatus('none');
        setCretabFile(null);
    };

    const handleRemoveCretabFile = () => {
        setCretabFile(null);
        setCretabStatus(null);
        if (cretabFileInputRef.current) {
            cretabFileInputRef.current.value = '';
        }
    };

    const handleOpenPreview = (file: CretabFile | UploadedFile) => {
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

    const handleDownloadCretabZip = async () => {
        if (!cretabFile) {
            alert('다운로드할 크레탑 파일이 없습니다.');
            return;
        }

        try {
            const zip = new JSZip();
            if (cretabFile.file) {
                zip.file(cretabFile.fileName, cretabFile.file);
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `크레탑파일_${new Date().getTime()}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('ZIP 생성 실패:', error);
            alert('파일 다운로드에 실패했습니다.');
        }
    };

    const handleDownloadFilesZip = async () => {
        if (Object.keys(uploadedFiles).length === 0) {
            alert('다운로드할 파일이 없습니다.');
            return;
        }

        try {
            const zip = new JSZip();

            for (const [docId, file] of Object.entries(uploadedFiles)) {
                const doc = businessType === 'business'
                    ? (documents.find(d => d.id === docId))
                    : (documents.find(d => d.id === docId));

                if (doc && file.file) {
                    zip.file(`${doc.name}_${file.fileName}`, file.file);
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `첨부파일_${new Date().getTime()}.zip`;
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
                <div className={styles.fileTitleRight}>
                    {cretabStatus === 'none' && (
                        <div className={styles.cretabStatusBadge}>
                            <Check size={16} />
                            크레탑 정보 없음
                        </div>
                    )}
                    {cretabFile && (
                        <div
                            className={styles.cretabFileInfo}
                            onClick={() => handleOpenPreview(cretabFile)}
                            style={{ cursor: 'pointer' }}
                        >
                            <CheckCircle2 className={styles.cretabCheckIcon} />
                            <div
                                className={styles.cretabFileDetail}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <p className={styles.cretabFileName}>{cretabFile.fileName}</p>
                                <p className={styles.cretabFileSize}>{cretabFile.fileSize}</p>
                            </div>
                            <button
                                className={styles.cretabRemoveBtn}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveCretabFile();
                                }}
                                title="삭제"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}
                    {!isViewMode && (
                        <>
                            <button className={styles.cretabFileBtn} onClick={handleCretabFileClick}>
                                크레탑 파일 등록
                            </button>
                            <button className={styles.cretabNoneBtn} onClick={handleCretabNoneClick}>
                                크레탑 정보 없음
                            </button>
                        </>
                    )}
                    <input
                        type="file"
                        ref={cretabFileInputRef}
                        onChange={handleCretabFileChange}
                        style={{ display: 'none' }}
                    />
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
                            setBusinessType('business');
                            setUploadedFiles({});
                        }}
                        disabled={isViewMode}
                    >
                        법인사업자
                    </button>
                    <button
                        className={`${styles.typeBtn} ${businessType === 'individual' ? styles.active : ''}`}
                        onClick={() => {
                            setBusinessType('individual');
                            setUploadedFiles({});
                        }}
                        disabled={isViewMode}
                    >
                        개인사업자
                    </button>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    {cretabFile && (
                        <button
                            className={styles.downloadBtn}
                            onClick={handleDownloadCretabZip}
                            title="크레탑 파일 다운로드"
                        >
                            <Download size={18} />
                            크레탑 다운
                        </button>
                    )}
                    {(Object.keys(uploadedFiles).length > 0 || existingFiles.length > 0) && (
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

            <div className={styles.docList}>
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
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <CheckCircle2 className={styles.checkIcon} />
                                            <div className={styles.uploadedInfo}>
                                                <p className={styles.uploadedName}>{doc.name}</p>
                                                <p className={styles.uploadedMeta}>
                                                    {isUploaded ? `${uploadedFile.fileName} · ${uploadedFile.fileSize}` : `${existingFile?.name}`}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            className={styles.removeIcon}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                isUploaded && handleRemoveFile(doc.id);
                                            }}
                                        >
                                            {isUploaded ? <X size={20} /> : <Check size={20} />}
                                        </button>
                                    </div>
                                ) : (
                                    <div className={styles.docItem} onClick={() => handleUploadClick(doc.id)}>
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
        </div>
    );
});

CompanyFile.displayName = 'CompanyFile';

export default CompanyFile;
