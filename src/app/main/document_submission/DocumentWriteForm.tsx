'use client';

import { useState, useEffect } from 'react';
import { getAdminData } from '@/lib/auth';
import ConfirmModal from '@/app/components/Modal/ConfirmModal';
import styles from './documentWriteForm.module.css';
import modalStyles from '@/app/components/Modal/Modal.module.css';

interface DocumentWriteFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function DocumentWriteForm({ onClose, onSuccess }: DocumentWriteFormProps) {
    const [formData, setFormData] = useState({
        company_name: '',
        representative_name: '',
        manager_name: '',
        progress_details: '검수자',
        time: '09:00',
    });
    const [documentType, setDocumentType] = useState<'individual' | 'business'>('individual');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setSelectedFiles(Array.from(e.target.files));
        }
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.company_name) {
            setError('기업명을 입력해주세요.');
            return;
        }

        if (!formData.representative_name) {
            setError('대표자명을 입력해주세요.');
            return;
        }

        if (!formData.manager_name) {
            setError('담당실무자를 입력해주세요.');
            return;
        }

        setConfirmModalOpen(true);
    };

    const handleConfirmSubmit = async () => {
        setLoading(true);

        try {
            const adminData = getAdminData();
            if (!adminData) {
                setError('사용자 정보를 불러올 수 없습니다.');
                setLoading(false);
                return;
            }

            // 파일 업로드 (API를 통해)
            const uploadedFiles: Array<{ name: string; path: string; size: number }> = [];
            if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                    try {
                        // 파일 크기 확인 (50MB 제한)
                        if (file.size > 50 * 1024 * 1024) {
                            throw new Error(`${file.name}은(는) 50MB 이상으로 업로드할 수 없습니다.`);
                        }

                        const fileExt = file.name.split('.').pop();
                        const timestamp = Date.now();
                        const date = new Date(timestamp);
                        const timeStr = `${String(date.getHours()).padStart(2, '0')}-${String(date.getMinutes()).padStart(2, '0')}-${String(date.getSeconds()).padStart(2, '0')}`;
                        const randomStr = Math.random().toString(36).substring(2, 9);
                        const fileName = `${timeStr}-${randomStr}.${fileExt}`;
                        const companyName = adminData.company_name || 'no_company';
                        const filePath = `${adminData.user_id}/${companyName}/${fileName}`;

                        const uploadFormData = new FormData();
                        uploadFormData.append('file', file);
                        uploadFormData.append('filePath', filePath);

                        const uploadResponse = await fetch('/api/documents/upload', {
                            method: 'POST',
                            body: uploadFormData,
                        });

                        if (!uploadResponse.ok) {
                            const errorText = await uploadResponse.text();
                            try {
                                const errorData = JSON.parse(errorText);
                                throw new Error(`파일 업로드 실패: ${file.name} - ${errorData.error}`);
                            } catch (e) {
                                throw new Error(`파일 업로드 실패: ${file.name} - 상태코드: ${uploadResponse.status}`);
                            }
                        }

                        uploadedFiles.push({
                            name: file.name,
                            path: filePath,
                            size: file.size,
                        });
                    } catch (fileError) {
                        throw new Error(fileError instanceof Error ? fileError.message : `파일 업로드 실패: ${file.name}`);
                    }
                }
            }

            const today = new Date();
            const formattedDate = `${String(today.getFullYear()).slice(-2)}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')} ${formData.time}`;

            console.log('제출일:', formattedDate);

            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: adminData.user_id,
                    user_name: adminData.name,
                    document_type: '기타',
                    title: formData.company_name,
                    company_name: formData.company_name,
                    representative_name: formData.representative_name,
                    manager_name: formData.manager_name,
                    progress_details: formData.progress_details,
                    status: 'waiting',
                    progress_status: 'not_started',
                    submitted_date: formattedDate,
                    reason_read: true,
                    files: uploadedFiles,
                    type: documentType,
                }),
            });

            if (!response.ok) {
                throw new Error('기업 생성 실패');
            }

            setShowSuccessModal(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : '기업 생성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>기업 생성</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.typeSelector}>
                        <label>구분</label>
                        <div className={styles.checkboxGroup}>
                            <label className={styles.customCheckbox}>
                                <input
                                    type="checkbox"
                                    checked={documentType === 'individual'}
                                    onChange={() => setDocumentType('individual')}
                                />
                                <span className={styles.checkmark}></span>
                                <span>개인</span>
                            </label>
                            <label className={styles.customCheckbox}>
                                <input
                                    type="checkbox"
                                    checked={documentType === 'business'}
                                    onChange={() => setDocumentType('business')}
                                />
                                <span className={styles.checkmark}></span>
                                <span>법인</span>
                            </label>
                        </div>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="company_name">기업명</label>
                        <input
                            type="text"
                            id="company_name"
                            name="company_name"
                            value={formData.company_name ?? ''}
                            onChange={handleChange}
                            placeholder="기업명을 입력하세요"
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="representative_name">대표자명</label>
                        <input
                            type="text"
                            id="representative_name"
                            name="representative_name"
                            value={formData.representative_name ?? ''}
                            onChange={handleChange}
                            placeholder="대표자명을 입력하세요"
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="manager_name">담당실무자</label>
                        <input
                            type="text"
                            id="manager_name"
                            name="manager_name"
                            value={formData.manager_name ?? ''}
                            onChange={handleChange}
                            placeholder="담당실무자명을 입력하세요"
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="progress_details">진행상황</label>
                        <select
                            id="progress_details"
                            name="progress_details"
                            value={formData.progress_details ?? '검수자'}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                progress_details: e.target.value,
                            }))}
                            className={styles.select}
                        >
                            <option value="검수자">검수자</option>
                            <option value="대표실무자">대표실무자</option>
                            <option value="담당실무자">담당실무자</option>
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="time">제출 시간</label>
                        <input
                            type="time"
                            id="time"
                            name="time"
                            value={formData.time ?? '09:00'}
                            onChange={handleChange}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="files">파일 첨부</label>
                        <input
                            type="file"
                            id="files"
                            multiple
                            onChange={handleFileSelect}
                            className={styles.fileInput}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.txt,.zip"
                        />
                        <p className={styles.fileHint}>여러 파일을 선택할 수 있습니다</p>
                    </div>

                    {selectedFiles.length > 0 && (
                        <div className={styles.fileList}>
                            <label>선택된 파일 ({selectedFiles.length})</label>
                            <ul>
                                {selectedFiles.map((file, index) => (
                                    <li key={index} className={styles.fileItem}>
                                        <span>{file.name}</span>
                                        <button
                                            type="button"
                                            className={styles.removeFileButton}
                                            onClick={() => handleRemoveFile(index)}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {error && <div className={styles.error}>{error}</div>}

                    <div className={styles.buttonGroup}>
                        <button
                            type="button"
                            className={styles.cancelButton}
                            onClick={onClose}
                            disabled={loading}
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            className={styles.submitButton}
                            disabled={loading}
                        >
                            {loading ? '작성 중...' : '서류 작성'}
                        </button>
                    </div>
                </form>
            </div>

            <ConfirmModal
                isOpen={confirmModalOpen}
                message="기업을 생성하시겠습니까?"
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={() => {
                    setConfirmModalOpen(false);
                    handleConfirmSubmit();
                }}
                type="warning"
                confirmText="생성"
                cancelText="취소"
            />

            {showSuccessModal && (
                <div className={modalStyles.overlay} onClick={() => {
                    setShowSuccessModal(false);
                    onSuccess();
                }}>
                    <div className={`${modalStyles.modal} ${modalStyles.success}`} onClick={(e) => e.stopPropagation()}>
                        <div className={modalStyles.content}>
                            <div className={modalStyles.iconWrapper}>
                                <img src="/check.svg" alt="success" className={modalStyles.icon} />
                            </div>
                            <p className={modalStyles.message}>기업이 생성되었습니다.</p>
                        </div>
                        <div className={modalStyles.footer}>
                            <button
                                className={modalStyles.confirmButton}
                                onClick={() => {
                                    setShowSuccessModal(false);
                                    onSuccess();
                                }}
                            >
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
