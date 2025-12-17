'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminData } from '@/lib/auth';
import Modal from '@/app/components/Modal/Modal';
import styles from './companyCreate.module.css';

interface CompanyFormData {
    businessType: 'individual' | 'business';
    representative_name: string;
    company_name: string;
    business_number: string;
    phone: string;
}

export default function CompanyCreateForm() {
    const router = useRouter();
    const [formData, setFormData] = useState<CompanyFormData>({
        businessType: 'individual',
        representative_name: '',
        company_name: '',
        business_number: '',
        phone: '',
    });

    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [successModalOpen, setSuccessModalOpen] = useState(false);

    const handleBusinessTypeChange = (type: 'individual' | 'business') => {
        setFormData(prev => ({
            ...prev,
            businessType: type,
        }));
        setSelectedFiles([]);
    };

    const formatBusinessNumber = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 10);
        if (digits.length <= 3) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    };

    const formatPhoneNumber = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        let finalValue = value;

        if (name === 'business_number') {
            finalValue = formatBusinessNumber(value);
        } else if (name === 'phone') {
            finalValue = formatPhoneNumber(value);
        }

        setFormData(prev => ({
            ...prev,
            [name]: finalValue,
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

    const validateForm = () => {
        if (!formData.representative_name.trim()) {
            setError('대표자명을 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (!formData.company_name.trim()) {
            setError('회사명을 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (!formData.business_number.trim()) {
            setError('사업자등록번호를 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (!formData.phone.trim()) {
            setError('대표자 연락처를 입력해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        if (selectedFiles.length === 0) {
            setError('파일을 최소 1개 이상 업로드해주세요.');
            setErrorModalOpen(true);
            return false;
        }

        return true;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setConfirmModalOpen(true);
    };

    const handleConfirmSubmit = async () => {
        setLoading(true);
        setConfirmModalOpen(false);

        try {
            const adminData = getAdminData();
            if (!adminData) {
                setError('사용자 정보를 불러올 수 없습니다.');
                setErrorModalOpen(true);
                setLoading(false);
                return;
            }

            // 파일 업로드 (Supabase Storage)
            const uploadedFiles: Array<{ name: string; path: string; size: number }> = [];

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
                    const businessTypeFolder = formData.businessType === 'individual' ? 'individual' : 'business';
                    const filePath = `companies/${businessTypeFolder}/${fileName}`;

                    const uploadFormData = new FormData();
                    uploadFormData.append('file', file);
                    uploadFormData.append('path', filePath);

                    const uploadResponse = await fetch('/api/upload', {
                        method: 'POST',
                        body: uploadFormData,
                    });

                    if (!uploadResponse.ok) {
                        const errorData = await uploadResponse.json();
                        throw new Error(errorData.error || `파일 업로드 실패: ${file.name}`);
                    }

                    const uploadData = await uploadResponse.json();
                    uploadedFiles.push({
                        name: file.name,
                        path: uploadData.path,
                        size: file.size,
                    });
                } catch (err) {
                    throw new Error(`파일 업로드 중 오류 발생: ${err instanceof Error ? err.message : '알 수 없는 오류'}`);
                }
            }

            // 기업 정보 저장 (documents 테이블)
            const now = new Date();
            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: adminData.user_id,
                    user_name: adminData.name || adminData.user_id,
                    document_type: '기업등록',
                    title: formData.company_name,
                    company_name: formData.company_name,
                    representative_name: formData.representative_name,
                    manager_name: formData.representative_name,
                    business_number: formData.business_number,
                    phone: formData.phone,
                    type: formData.businessType,
                    progress_details: '검수자',
                    status: 'waiting',
                    progress_status: 'not_started',
                    submitted_date: now.toLocaleString('ko-KR'),
                    files: uploadedFiles,
                    created_at: now.toISOString(),
                }),
            });

            if (!response.ok) {
                throw new Error('기업 정보 저장 실패');
            }

            setSuccessModalOpen(true);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '오류가 발생했습니다.';
            setError(errorMessage);
            setErrorModalOpen(true);
            setLoading(false);
        }
    };

    const handleSuccessClose = () => {
        setSuccessModalOpen(false);
        router.push('/main/document_submission');
    };

    const fileTypeLabel = formData.businessType === 'individual' ? '개인사업자 서류' : '법인사업자 서류';

    return (
        <div className={styles.formContainer}>
            <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>기업 정보 입력</h2>
                <p className={styles.formSubtitle}>새로운 기업 정보를 등록해주세요.</p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
                {/* 사업자 타입 선택 */}
                <div className={styles.businessTypeSection}>
                    <div className={styles.radioGroup}>
                        <div className={styles.radioOption}>
                            <input
                                type="radio"
                                id="individual"
                                name="businessType"
                                value="individual"
                                checked={formData.businessType === 'individual'}
                                onChange={() => handleBusinessTypeChange('individual')}
                                className={styles.radioInput}
                            />
                            <label htmlFor="individual" className={styles.radioLabel}>
                                개인사업자
                            </label>
                        </div>
                        <div className={styles.radioOption}>
                            <input
                                type="radio"
                                id="business"
                                name="businessType"
                                value="business"
                                checked={formData.businessType === 'business'}
                                onChange={() => handleBusinessTypeChange('business')}
                                className={styles.radioInput}
                            />
                            <label htmlFor="business" className={styles.radioLabel}>
                                법인사업자
                            </label>
                        </div>
                    </div>
                </div>

                {/* 공통 입력 폼 */}
                <div className={styles.commonFormSection}>
                    <div className={styles.formGroup}>
                        <label htmlFor="representative_name" className={styles.label}>
                            대표자명 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            id="representative_name"
                            name="representative_name"
                            value={formData.representative_name}
                            onChange={handleChange}
                            placeholder="대표자 이름을 입력해주세요"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="company_name" className={styles.label}>
                            회사명 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            id="company_name"
                            name="company_name"
                            value={formData.company_name}
                            onChange={handleChange}
                            placeholder="회사 이름을 입력해주세요"
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="business_number" className={styles.label}>
                            사업자등록번호 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="text"
                            id="business_number"
                            name="business_number"
                            value={formData.business_number}
                            onChange={handleChange}
                            placeholder="사업자등록번호를 입력해주세요"
                            maxLength={13}
                            className={styles.input}
                        />
                    </div>

                    <div className={styles.formGroup}>
                        <label htmlFor="phone" className={styles.label}>
                            대표자 연락처 <span className={styles.required}>*</span>
                        </label>
                        <input
                            type="tel"
                            id="phone"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="연락처를 입력해주세요"
                            maxLength={13}
                            className={styles.input}
                        />
                    </div>
                </div>

                {/* 파일 업로드 */}
                <div className={styles.fileUploadSection}>
                    <label className={styles.sectionTitle}>
                        서류 업로드 ({fileTypeLabel})
                    </label>
                    <div className={styles.uploadArea}>
                        <label htmlFor="fileInput" className={styles.uploadLabel}>
                            <div className={styles.uploadIcon}>📎</div>
                            <div className={styles.uploadText}>
                                <p className={styles.uploadMain}>파일을 선택하거나 드래그하여 업로드</p>
                                <p className={styles.uploadSub}>최대 50MB까지 업로드 가능합니다.</p>
                            </div>
                        </label>
                        <input
                            type="file"
                            id="fileInput"
                            onChange={handleFileSelect}
                            multiple
                            className={styles.fileInput}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp,.jpg,.jpeg,.png"
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
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveFile(index)}
                                            className={styles.removeButton}
                                        >
                                            ✕
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* 버튼 */}
                <div className={styles.formButtons}>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className={styles.cancelButton}
                        disabled={loading}
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={loading}
                    >
                        {loading ? '처리 중...' : '등록'}
                    </button>
                </div>
            </form>

            {/* 에러 모달 */}
            <Modal
                isOpen={errorModalOpen}
                message={error}
                type="error"
                onClose={() => setErrorModalOpen(false)}
                confirmText="확인"
                showConfirmButton={false}
            />

            {/* 확인 모달 */}
            <Modal
                isOpen={confirmModalOpen}
                message="입력하신 기업 정보를 등록하시겠습니까?"
                type="info"
                onConfirm={handleConfirmSubmit}
                onClose={() => setConfirmModalOpen(false)}
                confirmText="등록"
                showConfirmButton={true}
            />

            {/* 완료 모달 */}
            <Modal
                isOpen={successModalOpen}
                message="기업 정보가 성공적으로 등록되었습니다."
                type="success"
                onConfirm={handleSuccessClose}
                onClose={handleSuccessClose}
                confirmText="확인"
                showConfirmButton={false}
            />
        </div>
    );
}
