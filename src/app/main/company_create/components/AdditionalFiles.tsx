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
    setExistingFiles: (files: Array<{ name: string; path: string; size: number }>) => void;
}

interface AdditionalFilesProps {
    isViewMode?: boolean;
}

const AdditionalFiles = forwardRef<AdditionalFilesHandle, AdditionalFilesProps>(function AdditionalFiles({ isViewMode = false }, ref) {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [existingFiles, setExistingFiles] = useState<Array<{ name: string; path: string; size: number }>>([]);
    const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

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
        setExistingFiles: (files: Array<{ name: string; path: string; size: number }>) => {
            setExistingFiles(files);
        },
    }));

    const handleUploadClick = () => {
        if (!isViewMode) {
            fileInputRef.current?.click();
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // 파일 크기 검증 (5GB 제한)
            if (file.size > 5 * 1024 * 1024 * 1024) {
                setUploadError('파일 크기는 5GB 이하여야 합니다.');
                return;
            }

            // 메모리에만 저장 (저장 시 업로드)
            const fileId = Date.now().toString();
            const newFile: UploadedFile = {
                id: fileId,
                file,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
            };
            setUploadedFiles((prev) => [...prev, newFile]);

            // input 초기화 (setTimeout으로 지연)
            setTimeout(() => {
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }, 0);
        }
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
        if (uploadedFiles.length === 0) {
            alert('다운로드할 파일이 없습니다.');
            return;
        }

        try {
            const zip = new JSZip();

            for (const file of uploadedFiles) {
                if (file.file) {
                    zip.file(file.fileName, file.file);
                }
            }

            const blob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `추가서류_${new Date().getTime()}.zip`;
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
        <div className={styles.additionalWrap}>
            <div className={styles.additionalTitle}>
                <div className={styles.titleContent}>
                    <h2>추가서류</h2>
                    <h3>필요시 추가 서류를 업로드해주세요</h3>
                </div>
                {(uploadedFiles.length > 0 || existingFiles.length > 0) && (
                    <button
                        className={styles.downloadBtn}
                        onClick={handleDownloadZip}
                        title="파일 일괄 다운로드"
                    >
                        <Download size={18} />
                        다운로드
                    </button>
                )}
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

            <div className={styles.fileList}>
                {uploadedFiles.length === 0 && existingFiles.length === 0 ? (
                    <div
                        className={styles.docItem}
                        onClick={handleUploadClick}
                        style={{
                            cursor: isViewMode ? 'default' : 'pointer',
                            pointerEvents: isViewMode ? 'none' : 'auto'
                        }}
                    >
                        <div className={styles.docContent}>
                            <File className={styles.docIcon} />
                            <div className={styles.docInfo}>
                                <p className={styles.docName}>추가서류</p>
                                <p className={styles.docDescription}>필요한 서류를 선택하여 업로드해주세요</p>
                            </div>
                        </div>
                        <button
                            className={styles.uploadBtn}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleUploadClick();
                            }}
                            disabled={isViewMode}
                            style={{
                                pointerEvents: isViewMode ? 'none' : 'auto',
                                display: isViewMode ? 'none' : 'block'
                            }}
                        >
                            업로드
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            style={{ display: 'none' }}
                        />
                    </div>
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
                        {!isViewMode && (
                            <div className={styles.addMoreWrapper}>
                                <div className={styles.docItem} onClick={handleUploadClick}>
                                <div className={styles.docContent}>
                                    <File className={styles.docIcon} />
                                    <div className={styles.docInfo}>
                                        <p className={styles.docName}>추가서류</p>
                                        <p className={styles.docDescription}>필요한 서류를 선택하여 업로드해주세요</p>
                                    </div>
                                </div>
                                <button
                                    className={styles.uploadBtn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleUploadClick();
                                    }}
                                >
                                    업로드
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
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
