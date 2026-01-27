'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CreateUserForm from './components/CreateUserForm';
import { useCreateUserForm } from './hooks/useCreateUserForm';
import Modal from '@/app/components/Modal/Modal';
import styles from './createUser.module.css';

interface Position {
    id: number;
    name: string;
    level: number;
}

export default function CreateUserPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const mode = searchParams.get('mode') || 'create';
    const userId = searchParams.get('id') || '';
    const isEditMode = mode === 'edit' && !!userId;

    const [positions, setPositions] = useState<Position[]>([]);
    const [allAffiliations, setAllAffiliations] = useState<string[]>([]);
    const [takenAffiliations, setTakenAffiliations] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 모달 상태
    const [successModalOpen, setSuccessModalOpen] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [validationErrorModalOpen, setValidationErrorModalOpen] = useState(false);
    const [validationErrorMessage, setValidationErrorMessage] = useState('');

    const form = useCreateUserForm(isEditMode, userId);

    /**
     * 초기 데이터 로드
     */
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                setIsLoading(true);

                // 직급 정보 로드
                const positionsRes = await fetch('/api/positions');
                if (!positionsRes.ok) throw new Error('직급 조회 실패');
                const positionsData = await positionsRes.json();
                setPositions(positionsData);

                // 소속 정보 로드
                const affiliationsRes = await fetch('/api/affiliations?get_all=true');
                if (!affiliationsRes.ok) throw new Error('소속 조회 실패');
                const affiliationsData = await affiliationsRes.json();
                setAllAffiliations(affiliationsData.allAffiliations || []);
                setTakenAffiliations(affiliationsData.takenAffiliations || []);

                // 편집 모드인 경우 사용자 데이터 로드
                if (isEditMode && userId) {
                    const userRes = await fetch(`/api/users?id=${userId}`);
                    if (!userRes.ok) throw new Error('사용자 조회 실패');
                    const userData = await userRes.json();

                    // 검수자(Level 6)인 경우 소속 데이터 가져오기
                    let userAffiliations: string[] = [];
                    if (userData.position?.level === 6) {
                        const userAffRes = await fetch(`/api/affiliations?inspector_id=${userId}`);
                        if (userAffRes.ok) {
                            const affData = await userAffRes.json();
                            userAffiliations = affData.affiliations || [];
                        }
                    }

                    form.loadUserData(userData, userAffiliations);
                }
            } catch (error) {
                console.error('초기 데이터 로드 실패:', error);
                setErrorMessage('데이터를 불러오는 중 오류가 발생했습니다.');
                setErrorModalOpen(true);
            } finally {
                setIsLoading(false);
            }
        };

        loadInitialData();
    }, [isEditMode, userId]);

    /**
     * 폼 제출 핸들러
     */
    const handleSubmit = async () => {
        // 유효성 검사
        const { isValid, errors } = form.validateAndSubmit(positions);

        if (!isValid) {
            form.setErrors(errors);
            const firstErrorField = Object.keys(errors)[0];
            const firstErrorMessage = errors[firstErrorField];
            setValidationErrorMessage(firstErrorMessage);
            setValidationErrorModalOpen(true);

            // 첫 번째 에러 필드에 포커스
            if (firstErrorField === 'user_id') form.userIdRef.current?.focus();
            else if (firstErrorField === 'password') form.passwordRef.current?.focus();
            else if (firstErrorField === 'name') form.nameRef.current?.focus();
            else if (firstErrorField === 'position_id') form.positionRef.current?.focus();
            else if (firstErrorField === 'email_display') form.emailRef.current?.focus();

            return;
        }

        setIsSubmitting(true);
        try {
            const url = isEditMode ? `/api/users/${userId}` : '/api/users';
            const method = isEditMode ? 'PATCH' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form.formData),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || (isEditMode ? '사용자 수정 실패' : '사용자 생성 실패'));
            }

            setSuccessMessage(isEditMode ? '사용자가 수정되었습니다.' : '사용자가 생성되었습니다.');
            setSuccessModalOpen(true);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : '작업 중 오류가 발생했습니다.';
            setErrorMessage(errorMsg);
            setErrorModalOpen(true);
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * 취소 핸들러
     */
    const handleCancel = () => {
        router.back();
    };

    if (isLoading) {
        return (
            <div className={styles.pageContainer}>
                <div className={styles.loadingContainer}>
                    <div className={styles.spinner}></div>
                    <p className={styles.loadingText}>로딩 중...</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.pageContainer}>
            {/* 성공 모달 */}
            <Modal
                isOpen={successModalOpen}
                message={successMessage}
                onClose={() => {
                    setSuccessModalOpen(false);
                    router.push('/main/user_management');
                }}
                type="success"
                showConfirmButton={true}
                confirmText="확인"
            />

            {/* 에러 모달 */}
            <Modal
                isOpen={errorModalOpen}
                message={errorMessage}
                onClose={() => {
                    setErrorModalOpen(false);
                    setErrorMessage('');
                }}
                type="error"
                showConfirmButton={false}
            />

            {/* 유효성 검사 에러 모달 */}
            <Modal
                isOpen={validationErrorModalOpen}
                message={validationErrorMessage}
                onClose={() => setValidationErrorModalOpen(false)}
                type="error"
                confirmText="확인"
                showConfirmButton={false}
            />

            {/* 폼 */}
            <div className={styles.formContainer}>
                <h1 className={styles.formTitle}>{isEditMode ? '사용자 수정' : '사용자 생성'}</h1>
                <CreateUserForm
                isEditMode={isEditMode}
                positions={positions}
                allAffiliations={allAffiliations}
                takenAffiliations={takenAffiliations}
                formData={form.formData}
                errors={form.errors}
                isDuplicateUserIdChecked={form.isDuplicateUserIdChecked}
                isDuplicateUserIdExists={form.isDuplicateUserIdExists}
                isCheckingDuplicate={form.isCheckingDuplicate}
                affiliationSearch={form.affiliationSearch}
                userIdRef={form.userIdRef}
                passwordRef={form.passwordRef}
                nameRef={form.nameRef}
                positionRef={form.positionRef}
                emailRef={form.emailRef}
                onUpdateUserId={form.updateUserId}
                onUpdatePassword={form.updatePassword}
                onUpdateName={form.updateName}
                onUpdatePhone={form.updatePhone}
                onUpdateEmail={form.updateEmail}
                onUpdatePosition={form.updatePosition}
                onUpdateCompanyName={form.updateCompanyName}
                onUpdateAddress={form.updateAddress}
                onUpdateAddressDetail={form.updateAddressDetail}
                onToggleAffiliation={form.toggleAffiliation}
                onAffiliationSearchChange={form.setAffiliationSearch}
                onFieldBlur={form.handleFieldBlur}
                onCheckDuplicate={form.checkDuplicateUserId}
                onStatusChange={(status) => form.updateField('status', status)}
            />
                <div className={styles.buttonGroup}>
                    <button
                        className={styles.cancelButton}
                        onClick={handleCancel}
                        disabled={isSubmitting}
                    >
                        취소
                    </button>
                    <button
                        className={styles.submitButton}
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? '처리 중...' : (isEditMode ? '수정' : '생성')}
                    </button>
                </div>
            </div>
        </div>
    );
}
