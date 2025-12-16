'use client';

import { useState } from 'react';
import styles from './documentWriteForm.module.css';

interface DocumentWriteFormProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function DocumentWriteForm({ onClose, onSuccess }: DocumentWriteFormProps) {
    const [formData, setFormData] = useState({
        user_name: '',
        document_type: '',
        title: '',
        user_id: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const documentTypes = [
        '증명서',
        '계약서',
        '이력서',
        '신청서',
        '기타',
    ];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.user_name || !formData.document_type || !formData.title || !formData.user_id) {
            setError('모든 필드를 입력해주세요.');
            return;
        }

        setLoading(true);

        try {
            const today = new Date();
            const formattedDate = `${String(today.getFullYear()).slice(-2)}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: formData.user_id,
                    user_name: formData.user_name,
                    document_type: formData.document_type,
                    title: formData.title,
                    status: 'waiting',
                    progress_status: 'not_started',
                    submitted_date: formattedDate,
                    reason_read: true,
                }),
            });

            if (!response.ok) {
                throw new Error('서류 작성 실패');
            }

            onSuccess();
        } catch (err) {
            setError(err instanceof Error ? err.message : '서류 작성 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>서류 작성</h2>
                    <button className={styles.closeButton} onClick={onClose}>
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="user_id">사용자 ID</label>
                        <input
                            type="text"
                            id="user_id"
                            name="user_id"
                            value={formData.user_id}
                            onChange={handleChange}
                            placeholder="user001"
                            disabled
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="user_name">이름</label>
                        <input
                            type="text"
                            id="user_name"
                            name="user_name"
                            value={formData.user_name}
                            onChange={handleChange}
                            placeholder="이름을 입력하세요"
                            required
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="document_type">서류 유형</label>
                        <select
                            id="document_type"
                            name="document_type"
                            value={formData.document_type}
                            onChange={handleChange}
                            required
                        >
                            <option value="">서류 유형을 선택하세요</option>
                            {documentTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="title">제목</label>
                        <input
                            type="text"
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            placeholder="서류의 제목을 입력하세요"
                            required
                        />
                    </div>

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
        </div>
    );
}
