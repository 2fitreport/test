'use client';

import React, { useState } from 'react';
import styles from '../companyCreate.module.css';

interface DocumentUploadSectionProps {
    isViewMode: boolean;
    isEditMode: boolean;
    fileTypeLabel: string;
    selectedFiles: File[];
    setSelectedFiles: (files: File[]) => void;
    existingFiles: Array<{ name: string; path: string; size: number }>;
    downloadError: string;
    isDownloading: boolean;
    handleRemoveExistingFile: (index: number) => void;
    handleViewFile: (file: { name: string; path: string; size: number }, index?: number) => Promise<void>;
    handleDownloadZip: () => void;
}

export default function DocumentUploadSection({
    isViewMode,
    isEditMode,
    fileTypeLabel,
    selectedFiles,
    setSelectedFiles,
    existingFiles,
    downloadError,
    isDownloading,
    handleRemoveExistingFile,
    handleViewFile,
    handleDownloadZip,
}: DocumentUploadSectionProps) {
    const [dragOver, setDragOver] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        setSelectedFiles([...selectedFiles, ...files]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            setSelectedFiles([...selectedFiles, ...files]);
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
    };

    return (
        <>
            {/* 파일 업로드 - 보기 전용 모드에서 숨김 */}
            {(!isViewMode || isEditMode) && (
                <div className={styles.fileUploadSection}>
                    <label className={styles.sectionTitle}>
                        파일 업로드 ({fileTypeLabel}) <span className={styles.required}>*</span>
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
                                        onClick={() => handleViewFile(file, index)}
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
        </>
    );
}
