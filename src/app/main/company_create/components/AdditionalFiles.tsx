'use client';

import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { File, CheckCircle2, X, Plus, Download, AlertCircle } from 'lucide-react';
import JSZip from 'jszip';
import styles from './AdditionalFiles.module.css';

interface UploadedFile {
    id: string;
    file?: File;
    fileName: string;
    fileSize: string;
    storagePath?: string;
    uploading?: boolean;
}

export interface AdditionalFilesHandle {
    getFilesForUpload: () => Array<{ file: File; fileName: string }>;
    getExistingFiles: () => Array<{ name: string; path: string; size: number }>;
    setExistingFiles: (files: Array<{ name: string; path: string; size: number }>) => void;
    resetUploadedFiles: () => void;
    triggerFileInput: () => void;
    scrollToSection: () => void;
}

interface AdditionalFilesProps {
    isViewMode?: boolean;
    progressDetails?: string;
    userPositionLevel?: number;
    viewId?: string | null;
    onEditClick?: () => void;
    readOnly?: boolean;
    companyName?: string;
}

const AdditionalFiles = forwardRef<AdditionalFilesHandle, AdditionalFilesProps>(function AdditionalFiles({ isViewMode = false, progressDetails = '', userPositionLevel = 0, viewId, onEditClick, readOnly = false, companyName = '' }, ref) {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [existingFiles, setExistingFiles] = useState<Array<{ name: string; path: string; size: number }>>([]);
    // 서버에서 로드된 원본 파일 목록 (저장 전 X/추가 조작에 영향받지 않음, 다운로드용)
    const [savedFiles, setSavedFiles] = useState<Array<{ name: string; path: string; size: number }>>([]);
    const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const uploadFileToStorage = async (file: File): Promise<string | null> => {
        try {
            setUploadError(null);

            // 1. Signed URL 요청
            const signedUrlResponse = await fetch('/api/upload/signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    path: 'additional_files',
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
            return uploadedFiles
                .filter((file) => file.file !== undefined)
                .map((file) => ({
                    file: file.file as File,
                    fileName: file.fileName,
                }));
        },
        getExistingFiles: () => {
            return existingFiles;
        },
        setExistingFiles: (files: Array<{ name: string; path: string; size: number }>) => {
            setExistingFiles(files);
            setSavedFiles(files);
        },
        resetUploadedFiles: () => {
            setUploadedFiles([]);
        },
        triggerFileInput: () => {
            fileInputRef.current?.click();
        },
        scrollToSection: () => {
            containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        },
    }));

    const handleUploadClick = () => {
        if (!isViewMode) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const newFiles: UploadedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 5 * 1024 * 1024 * 1024) {
                setUploadError(`${file.name}: 파일 크기는 5GB 이하여야 합니다.`);
                continue;
            }
            newFiles.push({
                id: `${Date.now()}_${i}`,
                file,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
            });
        }

        if (newFiles.length > 0) {
            setUploadedFiles((prev) => [...prev, ...newFiles]);
        }

        setTimeout(() => {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }, 0);
    };

    const handleDropFiles = (files: FileList) => {
        if (isViewMode) return;
        const newFiles: UploadedFile[] = [];
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file.size > 5 * 1024 * 1024 * 1024) {
                setUploadError(`${file.name}: 파일 크기는 5GB 이하여야 합니다.`);
                continue;
            }
            newFiles.push({
                id: `${Date.now()}_${i}`,
                file,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
            });
        }
        if (newFiles.length > 0) setUploadedFiles((prev) => [...prev, ...newFiles]);
    };

    const handleRemoveFile = (id: string) => {
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleRemoveExistingFile = (index: number) => {
        setExistingFiles((prev) => prev.filter((_, i) => i !== index));
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

    const handleDownloadZip = async () => {
        if (savedFiles.length === 0) {
            alert('다운로드할 파일이 없습니다.');
            return;
        }

        try {
            const zip = new JSZip();

            // 실제 저장된 파일 기준으로 다운로드 (로컬 X/추가 조작 무시)
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
            a.download = `${prefix}추가서류_${dateStr}.zip`;
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
        <div
            className={`${styles.additionalWrap} ${isDragging ? styles.dragging : ''}`}
            ref={containerRef}
            onDragOver={(e) => { e.preventDefault(); if (!isViewMode) setIsDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) handleDropFiles(e.dataTransfer.files); }}
        >
            <div className={styles.additionalTitle}>
                <div className={styles.titleContent}>
                    <h2>추가서류</h2>
                    <h3>필요시 추가 서류를 업로드해주세요</h3>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {savedFiles.length > 0 && (
                        <button
                            className={styles.downloadBtn}
                            onClick={handleDownloadZip}
                            title="파일 일괄 다운로드"
                        >
                            <Download size={18} />
                            다운로드
                        </button>
                    )}
                    {!isViewMode && (uploadedFiles.length > 0 || existingFiles.length > 0) && (
                        <button
                            className={styles.deleteAllBtn}
                            onClick={() => { setUploadedFiles([]); setExistingFiles([]); }}
                            title="파일 전체 삭제"
                        >
                            <X size={18} />
                            전체삭제
                        </button>
                    )}
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

            {/* input은 항상 DOM에 존재해야 fileInputRef가 유효함 */}
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                multiple
                style={{ display: 'none' }}
            />

            <div className={styles.fileList}>
                {uploadedFiles.length === 0 && existingFiles.length === 0 ? (
                    !readOnly && (
                        <div className={styles.docItem} onClick={isViewMode && onEditClick ? onEditClick : undefined} style={isViewMode && onEditClick ? { cursor: 'pointer' } : {}}>
                            <div className={styles.docContent}>
                                <File className={styles.docIcon} />
                                <div className={styles.docInfo}>
                                    <p className={styles.docName}>추가서류</p>
                                    <p className={styles.docDescription}>필요한 서류를 선택하여 업로드해주세요</p>
                                </div>
                            </div>
                            <button
                                className={styles.uploadBtn}
                                onClick={handleUploadClick}
                                disabled={isViewMode}
                                style={{
                                    display: isViewMode ? 'none' : 'block'
                                }}
                            >
                                업로드
                            </button>
                        </div>
                    )
                ) : (
                    <div className={styles.uploadedFilesList}>
                        {uploadedFiles.map((uploadedFile) => (
                            <div
                                key={uploadedFile.id}
                                className={styles.uploadedItem}
                                onClick={() => handleOpenPreview(uploadedFile)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div
                                    className={styles.uploadedContent}
                                >
                                    <CheckCircle2 className={styles.checkIcon} />
                                    <div className={styles.uploadedInfo}>
                                        <p className={styles.uploadedName}>{uploadedFile.fileName}</p>
                                        <p className={styles.uploadedMeta}>{uploadedFile.fileSize}</p>
                                    </div>
                                </div>
                                {!isViewMode && (
                                    <button
                                        className={styles.removeIcon}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveFile(uploadedFile.id);
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {existingFiles.map((existingFile, idx) => (
                            <div
                                key={`existing-${idx}`}
                                className={styles.uploadedItem}
                                onClick={async () => {
                                    try {
                                        const response = await fetch('/api/file/view', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ filePath: existingFile.path }),
                                        });
                                        const data = await response.json();
                                        setPreviewFile({
                                            id: `existing-${idx}`,
                                            fileName: existingFile.name,
                                            fileSize: formatFileSize(existingFile.size),
                                            storagePath: existingFile.path
                                        });
                                        setPreviewUrl(data.url);
                                    } catch (error) {
                                        console.error('미리보기 로드 실패:', error);
                                    }
                                }}
                                style={{ cursor: 'pointer' }}
                            >
                                <div
                                    className={styles.uploadedContent}
                                >
                                    <CheckCircle2 className={styles.checkIcon} />
                                    <div className={styles.uploadedInfo}>
                                        <p className={styles.uploadedName}>{existingFile.name}</p>
                                        <p className={styles.uploadedMeta}>{formatFileSize(existingFile.size)}</p>
                                    </div>
                                </div>
                                {!isViewMode && (
                                    <button
                                        className={styles.removeIcon}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveExistingFile(idx);
                                        }}
                                    >
                                        <X size={20} />
                                    </button>
                                )}
                            </div>
                        ))}
                        {!readOnly && (
                            <div className={styles.addMoreWrapper}>
                                <div
                                    className={styles.docItem}
                                    onClick={isViewMode && onEditClick ? onEditClick : (!isViewMode ? handleUploadClick : undefined)}
                                    style={isViewMode && onEditClick ? { cursor: 'pointer' } : {}}
                                >
                                    <div className={styles.docContent}>
                                        <File className={styles.docIcon} />
                                        <div className={styles.docInfo}>
                                            <p className={styles.docName}>추가서류</p>
                                            <p className={styles.docDescription}>필요한 서류를 선택하여 업로드해주세요</p>
                                        </div>
                                    </div>
                                    {!isViewMode && (
                                        <button
                                            className={styles.uploadBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleUploadClick();
                                            }}
                                        >
                                            업로드
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
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

AdditionalFiles.displayName = 'AdditionalFiles';

export default AdditionalFiles;
