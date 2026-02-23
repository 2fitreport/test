'use client';

import { useState, useRef } from 'react';
import { File, CheckCircle2, X, Plus } from 'lucide-react';
import styles from './AdditionalFiles.module.css';

interface UploadedFile {
    id: string;
    file: File;
    fileName: string;
    fileSize: string;
}

export default function AdditionalFiles() {
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const newFile: UploadedFile = {
                id: Date.now().toString(),
                file,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
            };
            setUploadedFiles((prev) => [...prev, newFile]);
        }
    };

    const handleRemoveFile = (id: string) => {
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
    };

    return (
        <div className={styles.additionalWrap}>
            <div className={styles.additionalTitle}>
                <h2>추가서류</h2>
                <h3>필요시 추가 서류를 업로드해주세요</h3>
            </div>

            <div className={styles.fileList}>
                {uploadedFiles.length === 0 ? (
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
                ) : (
                    <div className={styles.uploadedFilesList}>
                        {uploadedFiles.map((uploadedFile) => (
                            <div key={uploadedFile.id} className={styles.uploadedItem}>
                                <div className={styles.uploadedContent}>
                                    <CheckCircle2 className={styles.checkIcon} />
                                    <div className={styles.uploadedInfo}>
                                        <p className={styles.uploadedName}>{uploadedFile.fileName}</p>
                                        <p className={styles.uploadedMeta}>{uploadedFile.fileSize}</p>
                                    </div>
                                </div>
                                <button
                                    className={styles.removeIcon}
                                    onClick={() => handleRemoveFile(uploadedFile.id)}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        ))}
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
                    </div>
                )}
            </div>
        </div>
    );
}
