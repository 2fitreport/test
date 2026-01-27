'use client';

import { useState, useRef, useCallback } from 'react';
import { validateField, validateFormData, validateUserIdFormat } from '../utils/validations';
import { formatPhoneNumber, sanitizeUserId, sanitizeName, sanitizeCompanyName } from '../utils/formatters';

export interface CreateUserFormData {
    user_id: string;
    name: string;
    position_id: number;
    password: string;
    phone: string;
    email_display: string;
    address: string;
    address_detail: string;
    company_name: string;
    status: 'active' | 'inactive';
    supervisor_id?: number | null;
    affiliations?: string[];
}

interface Position {
    id: number;
    name: string;
    level: number;
}

export const useCreateUserForm = (isEditMode: boolean = false, originalUserId: string = '') => {
    const [formData, setFormData] = useState<CreateUserFormData>({
        user_id: '',
        name: '',
        position_id: 0,
        password: '',
        phone: '',
        email_display: '',
        address: '',
        address_detail: '',
        company_name: '',
        status: 'active',
        supervisor_id: null,
        affiliations: [],
    });

    const [errors, setErrors] = useState<{ [key: string]: string }>({});
    const [isDuplicateUserIdChecked, setIsDuplicateUserIdChecked] = useState(false);
    const [isDuplicateUserIdExists, setIsDuplicateUserIdExists] = useState(false);
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
    const [affiliationSearch, setAffiliationSearch] = useState('');

    // Refs
    const userIdRef = useRef<HTMLInputElement>(null);
    const passwordRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);
    const positionRef = useRef<HTMLSelectElement>(null);
    const emailRef = useRef<HTMLInputElement>(null);

    /**
     * 필드값 업데이트 (기본)
     */
    const updateField = useCallback((fieldName: keyof CreateUserFormData, value: any) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
        // 해당 필드의 에러 초기화
        if (errors[fieldName]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 사용자 ID 필드 업데이트
     */
    const updateUserId = useCallback((value: string, showKoreanWarningCallback?: () => void) => {
        const { sanitized, hasKorean } = sanitizeUserId(value);
        if (hasKorean && showKoreanWarningCallback) {
            showKoreanWarningCallback();
            return;
        }
        setFormData(prev => ({ ...prev, user_id: sanitized }));
        setIsDuplicateUserIdChecked(false);
        setIsDuplicateUserIdExists(false);
        if (errors.user_id) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.user_id;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 이름 필드 업데이트
     */
    const updateName = useCallback((value: string) => {
        const sanitized = sanitizeName(value);
        setFormData(prev => ({ ...prev, name: sanitized }));
        if (errors.name) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.name;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 전화번호 필드 업데이트
     */
    const updatePhone = useCallback((value: string) => {
        const formatted = formatPhoneNumber(value);
        setFormData(prev => ({ ...prev, phone: formatted }));
        if (errors.phone) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.phone;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 회사명 필드 업데이트
     */
    const updateCompanyName = useCallback((value: string) => {
        const sanitized = sanitizeCompanyName(value);
        setFormData(prev => ({ ...prev, company_name: sanitized }));
        if (errors.company_name) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.company_name;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 비밀번호 필드 업데이트
     */
    const updatePassword = useCallback((value: string) => {
        setFormData(prev => ({ ...prev, password: value }));
        if (errors.password) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.password;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 이메일 필드 업데이트
     */
    const updateEmail = useCallback((value: string) => {
        setFormData(prev => ({ ...prev, email_display: value }));
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.email_display;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 직급 선택 업데이트
     */
    const updatePosition = useCallback((positionId: number) => {
        setFormData(prev => ({ ...prev, position_id: positionId }));
        if (errors.position_id) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.position_id;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 주소 업데이트
     */
    const updateAddress = useCallback((address: string) => {
        setFormData(prev => ({ ...prev, address }));
    }, []);

    /**
     * 상세주소 업데이트
     */
    const updateAddressDetail = useCallback((addressDetail: string) => {
        setFormData(prev => ({ ...prev, address_detail: addressDetail }));
    }, []);

    /**
     * 소속 체크박스 토글
     */
    const toggleAffiliation = useCallback((affiliationName: string) => {
        setFormData(prev => {
            const currentAffiliations = prev.affiliations || [];
            if (currentAffiliations.includes(affiliationName)) {
                return {
                    ...prev,
                    affiliations: currentAffiliations.filter(a => a !== affiliationName)
                };
            } else {
                return {
                    ...prev,
                    affiliations: [...currentAffiliations, affiliationName]
                };
            }
        });
        if (errors.affiliations) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.affiliations;
                return newErrors;
            });
        }
    }, [errors]);

    /**
     * 필드 Blur 이벤트 핸들러
     */
    const handleFieldBlur = useCallback((fieldName: string) => {
        const value = formData[fieldName as keyof CreateUserFormData];
        const error = validateField(fieldName, Array.isArray(value) ? value.join(',') : value);
        setErrors(prev => ({
            ...prev,
            [fieldName]: error,
        }));
    }, [formData]);

    /**
     * 중복 확인 체크
     */
    const checkDuplicateUserId = useCallback(async (userId: string): Promise<boolean> => {
        const validationError = validateUserIdFormat(userId);
        if (validationError) {
            setErrors(prev => ({ ...prev, user_id: validationError }));
            return false;
        }

        setIsCheckingDuplicate(true);
        try {
            const response = await fetch(`/api/users/check-duplicate?user_id=${encodeURIComponent(userId)}`);
            const data = await response.json();
            const isDuplicate = data.exists || false;
            setIsDuplicateUserIdChecked(true);
            setIsDuplicateUserIdExists(isDuplicate);
            if (!isDuplicate) {
                setErrors(prev => ({ ...prev, user_id: '' }));
            }
            return isDuplicate;
        } catch (error) {
            console.error('중복확인 실패:', error);
            return false;
        } finally {
            setIsCheckingDuplicate(false);
        }
    }, []);

    /**
     * 폼 전체 검증 및 제출 준비
     */
    const validateAndSubmit = (
        positions: Position[]
    ): { isValid: boolean; errors: { [key: string]: string } } => {
        // ID가 변경되었거나 새로 생성할 때 중복확인 검사
        const userIdChanged = isEditMode && formData.user_id !== originalUserId;
        const needsDuplicateCheck = !isEditMode || userIdChanged;

        if (needsDuplicateCheck) {
            if (!isDuplicateUserIdChecked) {
                return {
                    isValid: false,
                    errors: { user_id: 'ID 중복확인을 해주세요.' }
                };
            }

            if (isDuplicateUserIdExists) {
                return {
                    isValid: false,
                    errors: { user_id: '이미 존재하는 사용자 ID입니다.' }
                };
            }
        }

        const { errors: validationErrors } = validateFormData(formData, positions);

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return { isValid: false, errors: validationErrors };
        }

        return { isValid: true, errors: {} };
    };

    /**
     * 폼 리셋
     */
    const resetForm = useCallback(() => {
        setFormData({
            user_id: '',
            name: '',
            position_id: 0,
            password: '',
            phone: '',
            email_display: '',
            address: '',
            address_detail: '',
            company_name: '',
            status: 'active',
            supervisor_id: null,
            affiliations: [],
        });
        setErrors({});
        setIsDuplicateUserIdChecked(false);
        setIsDuplicateUserIdExists(false);
        setAffiliationSearch('');
    }, []);

    /**
     * 편집 모드용 폼 데이터 로드
     */
    const loadUserData = useCallback((userData: CreateUserFormData, userAffiliations: string[] = []) => {
        setFormData({
            ...userData,
            affiliations: userAffiliations
        });
        setErrors({});
        setIsDuplicateUserIdChecked(false);
        setIsDuplicateUserIdExists(false);
    }, []);

    return {
        // 상태
        formData,
        errors,
        isDuplicateUserIdChecked,
        isDuplicateUserIdExists,
        isCheckingDuplicate,
        affiliationSearch,

        // 업데이트 함수들
        updateField,
        updateUserId,
        updateName,
        updatePhone,
        updateCompanyName,
        updatePassword,
        updateEmail,
        updatePosition,
        updateAddress,
        updateAddressDetail,
        toggleAffiliation,
        setAffiliationSearch,
        setErrors,

        // 이벤트 핸들러
        handleFieldBlur,
        checkDuplicateUserId,

        // 유틸리티
        validateAndSubmit,
        resetForm,
        loadUserData,

        // Refs
        userIdRef,
        passwordRef,
        nameRef,
        positionRef,
        emailRef,
    };
};
