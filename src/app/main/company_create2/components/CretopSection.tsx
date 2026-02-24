'use client';

import React from 'react';
import styles from '../companyCreate.module.css';

interface Document {
    id: number;
    cretop_file?: { name: string; path: string; url: string } | null;
    cretop_none?: boolean;
    [key: string]: any;
}

interface CretopSectionProps {
    documentData: Document | null;
    isEditMode: boolean;
    isViewMode: boolean;
    selectedCretopFile: File | null;
    setSelectedCretopFile: (file: File | null) => void;
    cretopDragOver: boolean;
    setCretopDragOver: (dragOver: boolean) => void;
    cretopUploading: boolean;
    setCretopUploading: (uploading: boolean) => void;
    handleCretopUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
    handleCretopDelete: () => Promise<void>;
    handleCretopNone: () => Promise<void>;
    handleCretopDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleCretopDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    handleCretopDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    cretopInputRef: React.RefObject<HTMLInputElement>;
    error: string;
    setError: (error: string) => void;
    errorModalOpen: boolean;
    setErrorModalOpen: (open: boolean) => void;
    successMessage: string;
    setSuccessMessage: (message: string) => void;
}

export default function CretopSection({
    documentData,
    isEditMode,
    isViewMode,
    selectedCretopFile,
    setSelectedCretopFile,
    cretopDragOver,
    setCretopDragOver,
    cretopUploading,
    setCretopUploading,
    handleCretopUpload,
    handleCretopDelete,
    handleCretopNone,
    handleCretopDragOver,
    handleCretopDragLeave,
    handleCretopDrop,
    cretopInputRef,
    error,
    setError,
    errorModalOpen,
    setErrorModalOpen,
    successMessage,
    setSuccessMessage,
}: CretopSectionProps) {
    return (
        <div className={styles.formSection}>
            <h3 className={styles.formSectionTitle}>기업 정보 (크레탑)</h3>
            {!isViewMode || isEditMode ? (
                <div
                    className={`${styles.dragDropZone} ${cretopDragOver ? styles.dragOver : ''}`}
                    onDragOver={handleCretopDragOver}
                    onDragLeave={handleCretopDragLeave}
                    onDrop={handleCretopDrop}
                >
                    {!selectedCretopFile && !documentData?.cretop_file && !documentData?.cretop_none ? (
                        <>
                            <p className={styles.dragDropZoneDescription}>
                                파일을 여기에 드래그하거나
                            </p>
                            <label className={styles.uploadButton}>
                                파일 선택
                                <input
                                    ref={cretopInputRef}
                                    type="file"
                                    onChange={handleCretopUpload}
                                    style={{ display: 'none' }}
                                    accept=".pdf,.jpg,.jpeg,.png,.gif,.zip"
                                />
                            </label>
                            <p className={styles.dragDropZoneHint}>
                                (PDF, JPG, PNG, GIF, ZIP만 지원)
                            </p>
                        </>
                    ) : selectedCretopFile ? (
                        <>
                            <p className={styles.cretopFileName}>
                                ✓ {selectedCretopFile.name}
                            </p>
                            <button
                                onClick={() => setSelectedCretopFile(null)}
                                className={styles.deleteButton}
                            >
                                파일 변경
                            </button>
                        </>
                    ) : documentData?.cretop_file ? (
                        <>
                            <p className={styles.cretopFileName}>
                                ✓ {documentData.cretop_file.name}
                            </p>
                            {isEditMode && (
                                <button
                                    onClick={handleCretopDelete}
                                    className={styles.deleteButton}
                                >
                                    파일 삭제
                                </button>
                            )}
                        </>
                    ) : documentData?.cretop_none ? (
                        <>
                            <p className={styles.cretopFileName}>
                                기업 정보 없음
                            </p>
                            {isEditMode && (
                                <button
                                    onClick={() => handleCretopDelete()}
                                    className={styles.deleteButton}
                                >
                                    변경
                                </button>
                            )}
                        </>
                    ) : null}

                    {!selectedCretopFile && !documentData?.cretop_file && !documentData?.cretop_none && (
                        <button
                            onClick={handleCretopNone}
                            className={styles.secondaryButton}
                        >
                            기업 정보 없음
                        </button>
                    )}
                </div>
            ) : (
                <div className={styles.cretopViewBox}>
                    {documentData?.cretop_file ? (
                        <>
                            <p className={styles.cretopViewFileName}>
                                {documentData.cretop_file.name}
                            </p>
                            <a
                                href={documentData.cretop_file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.sidePanelDownloadButton}
                            >
                                다운로드
                            </a>
                        </>
                    ) : documentData?.cretop_none ? (
                        <p className={styles.cretopViewEmpty}>
                            기업 정보 없음
                        </p>
                    ) : (
                        <p className={styles.cretopViewEmpty}>
                            등록된 기업 정보 없음
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
