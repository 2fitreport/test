'use client';

import { useState } from 'react';
import styles from './ActionModal.module.css';
import Spinner from '@/app/components/Spinner/Spinner';

interface Document {
    id: number;
    user_id: string;
    user_name: string;
    document_type: string;
    title: string;
    company_name?: string;
    representative_name?: string;
    business_number?: string;
    phone?: string;
    type?: string;
    status: string;
    progress_details?: string;
    submitted_date: string;
    files?: Array<{ name: string; path: string; size: number }>;
}

interface DocumentDetailModalProps {
    isOpen: boolean;
    documentId: number;
    document: Document | null;
    onClose: () => void;
    onEdit?: (id: number) => void;
    canDownload: boolean;
}

function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'approved':
            return '승인';
        case 'waiting':
            return '서류수집';
        case 'rejected':
            return '반려';
        case 'revision':
            return '보완';
        case '진행':
            return '진행';
        case 'submitted':
            return '제출';
        case 'stopped':
            return '중지';
        case 'assigned':
            return '배정';
        default:
            return status;
    }
}

function formatSubmittedDate(dateStr: string): string {
    try {
        const parts = dateStr.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.\s*([오전|오후]+)\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (parts) {
            const year = parts[1];
            const month = parts[2].padStart(2, '0');
            const day = parts[3].padStart(2, '0');
            const ampm = parts[4];
            let hour = parseInt(parts[5]);
            const minute = parts[6];

            if (ampm === '오후' && hour !== 12) hour += 12;
            if (ampm === '오전' && hour === 12) hour = 0;

            const yy = year.slice(-2);
            return `${yy}-${month}-${day} ${String(hour).padStart(2, '0')}:${minute}`;
        }
    } catch (error) {
        console.error('날짜 포맷팅 오류:', error);
    }
    return dateStr;
}

export default function DocumentDetailModal({
    isOpen,
    documentId,
    document,
    onClose,
    onEdit,
    canDownload,
}: DocumentDetailModalProps) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadError, setDownloadError] = useState('');

    if (!isOpen || !document) return null;

    const handleDownloadZip = async () => {
        if (!document.files || document.files.length === 0) {
            setDownloadError('다운로드할 파일이 없습니다.');
            return;
        }

        setIsDownloading(true);
        setDownloadError('');

        try {
            const companyNameToSend = document.company_name || '기업';
            const response = await fetch('/api/download/zip', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    documentId: document.id,
                    files: document.files,
                    companyName: companyNameToSend,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                const errorMsg = errorData.message ? `${errorData.error} - ${errorData.message}` : (errorData.error || '다운로드 실패');
                throw new Error(errorMsg);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = globalThis.document.createElement('a');
            link.href = url;
            const now = new Date();
            const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
            link.download = `${companyNameToSend}_${dateStr}.zip`;
            globalThis.document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            globalThis.document.body.removeChild(link);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '파일 다운로드 중 오류가 발생했습니다.';
            setDownloadError(errorMessage);
            console.error('ZIP 다운로드 오류:', error);
        } finally {
            setIsDownloading(false);
        }
    };

    const totalFileSize = (document.files || []).reduce((sum, file) => sum + (file.size || 0), 0);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>문서 상세</h3>
                    <button className={styles.closeButton} onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className={styles.content}>
                    {/* 문서 정보 */}
                    <div className={styles.documentInfo}>
                        <p><strong>기업명:</strong> {document.company_name || '-'}</p>
                        <p><strong>대표자명:</strong> {document.representative_name || '-'}</p>
                        <p><strong>사업자등록번호:</strong> {document.business_number || '-'}</p>
                        <p><strong>전화번호:</strong> {document.phone || '-'}</p>
                        <p><strong>사업자 유형:</strong> {document.type === 'individual' ? '개인사업자' : '법인사업자'}</p>
                        <p><strong>문서 유형:</strong> {document.document_type || '-'}</p>
                        <p><strong>현재 상태:</strong> {getStatusLabel(document.status)}</p>
                        <p><strong>제출 일자:</strong> {formatSubmittedDate(document.submitted_date)}</p>
                    </div>

                    {/* 파일 목록 */}
                    {document.files && document.files.length > 0 && (
                        <div className={styles.filesSection}>
                            <p className={styles.fileListTitle}>파일 ({document.files.length}개, 총 {formatFileSize(totalFileSize)})</p>
                            <ul className={styles.files}>
                                {document.files.map((file, index) => (
                                    <li key={index} className={styles.fileItem}>
                                        <span className={styles.fileName}>{file.name}</span>
                                        <span className={styles.fileSize}>
                                            ({formatFileSize(file.size)})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {document.files && document.files.length === 0 && (
                        <div className={styles.noFiles}>
                            등록된 파일이 없습니다.
                        </div>
                    )}

                    {downloadError && (
                        <div className={styles.errorMessage}>
                            {downloadError}
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    {canDownload && document.files && document.files.length > 0 && (
                        <button
                            className={styles.downloadButton}
                            onClick={handleDownloadZip}
                            disabled={isDownloading}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            {isDownloading && <Spinner />}
                            {isDownloading ? '다운로드 중...' : '다운로드'}
                        </button>
                    )}
                    {onEdit && (
                        <button
                            className={styles.editActionButton}
                            onClick={() => {
                                onEdit(document.id);
                                onClose();
                            }}
                        >
                            수정
                        </button>
                    )}
                    <button className={styles.closeActionButton} onClick={onClose}>
                        닫기
                    </button>
                </div>
            </div>
        </div>
    );
}
