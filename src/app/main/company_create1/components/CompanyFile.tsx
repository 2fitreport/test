'use client';

import { useState, useRef } from 'react';
import { File, CheckCircle2, X } from 'lucide-react';
import styles from './CompanyFile.module.css';

type BusinessType = 'corporation' | 'individual' | null;

interface Document {
    id: string;
    name: string;
    description: string;
}

interface UploadedFile {
    file: File;
    fileName: string;
    fileSize: string;
}

export default function CompanyFile() {
    const [businessType, setBusinessType] = useState<BusinessType>(null);
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, UploadedFile>>({});
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const corporationDocuments: Document[] = [
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

    const documents = businessType === 'corporation' ? corporationDocuments :
                      businessType === 'individual' ? individualDocuments :
                      [];

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    const handleUploadClick = (docId: string) => {
        fileInputRefs.current[docId]?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
        const file = e.target.files?.[0];
        if (file) {
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

    return (
        <div className={styles.fileWrap}>
            <div className={styles.fileTitle}>
                <h2>첨부파일 등록</h2>
                <h3>필요한 서류를 선택하여 업로드해주세요</h3>
            </div>

            <div className={styles.businessTypeSelector}>
                <button
                    className={`${styles.typeBtn} ${businessType === 'corporation' ? styles.active : ''}`}
                    onClick={() => {
                        setBusinessType('corporation');
                        setUploadedFiles({});
                    }}
                >
                    법인사업자
                </button>
                <button
                    className={`${styles.typeBtn} ${businessType === 'individual' ? styles.active : ''}`}
                    onClick={() => {
                        setBusinessType('individual');
                        setUploadedFiles({});
                    }}
                >
                    개인사업자
                </button>
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

                        return (
                            <div key={doc.id}>
                                {isUploaded ? (
                                    <div className={styles.uploadedItem}>
                                        <div className={styles.uploadedContent}>
                                            <CheckCircle2 className={styles.checkIcon} />
                                            <div className={styles.uploadedInfo}>
                                                <p className={styles.uploadedName}>{doc.name}</p>
                                                <p className={styles.uploadedMeta}>{uploadedFile.fileName} · {uploadedFile.fileSize}</p>
                                            </div>
                                        </div>
                                        <button
                                            className={styles.removeIcon}
                                            onClick={() => handleRemoveFile(doc.id)}
                                        >
                                            <X size={20} />
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
        </div>
    );
}
