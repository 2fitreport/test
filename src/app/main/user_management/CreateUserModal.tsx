'use client';

import { useRef, Ref, useEffect, useState } from 'react';
import Modal from '@/app/components/Modal/Modal';
import styles from './userList.module.css';

interface CreateUserFormData {
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
    introducer?: string;
}

interface CreateUserModalProps {
    isOpen: boolean;
    isEditMode?: boolean;
    createFormData: CreateUserFormData;
    setCreateFormData: (data: CreateUserFormData | ((prev: CreateUserFormData) => CreateUserFormData)) => void;
    errors: { [key: string]: string };
    setErrors: (errors: { [key: string]: string } | ((prev: { [key: string]: string }) => { [key: string]: string })) => void;
    onClose: () => void;
    onSubmit: (isDuplicateUserIdChecked: boolean, isDuplicateUserIdExists: boolean) => Promise<void>;
    positions: Array<{ id: number; name: string; level: number }>;
    supervisors: Array<{ id: number; name: string; user_id: string }>;
    userIdRef: Ref<HTMLInputElement>;
    passwordRef: Ref<HTMLInputElement>;
    nameRef: Ref<HTMLInputElement>;
    positionRef: Ref<HTMLSelectElement>;
    emailRef: Ref<HTMLInputElement>;
    handleFieldBlur: (fieldName: string) => void;
    onCheckDuplicateUserId?: (userId: string) => Promise<boolean>;
    allAffiliations?: string[];
    takenAffiliations?: string[];
    editingUserId?: number | null;
}

export default function CreateUserModal({
    isOpen,
    isEditMode = false,
    createFormData,
    setCreateFormData,
    errors,
    setErrors,
    onClose,
    onSubmit,
    positions,
    supervisors,
    userIdRef,
    passwordRef,
    nameRef,
    positionRef,
    emailRef,
    handleFieldBlur,
    onCheckDuplicateUserId,
    allAffiliations = [],
    takenAffiliations = [],
    editingUserId,
}: CreateUserModalProps) {
    const innerContentRef = useRef<HTMLDivElement>(null);
    const [showKoreanWarning, setShowKoreanWarning] = useState(false);
    const [showAddressLoadingError, setShowAddressLoadingError] = useState(false);
    const [isDuplicateUserIdChecked, setIsDuplicateUserIdChecked] = useState(false);
    const [isDuplicateUserIdExists, setIsDuplicateUserIdExists] = useState(false);
    const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
    const [affiliationSearch, setAffiliationSearch] = useState('');

    useEffect(() => {
        if (isOpen && innerContentRef.current) {
            setTimeout(() => {
                if (innerContentRef.current) {
                    innerContentRef.current.scrollTop = 0;
                }
            }, 0);
        } else {
            setIsDuplicateUserIdChecked(false);
            setIsDuplicateUserIdExists(false);
            setAffiliationSearch('');
        }
    }, [isOpen]);

    const validateUserIdFormat = (): string => {
        const value = createFormData.user_id;

        if (!value) return '사용자 ID를 입력해주세요.';
        if (value.length < 5) return '5글자 이상으로 입력해주세요.';
        if (value.length > 10) return '10글자 이하로 입력해주세요.';
        if (!/^[a-zA-Z0-9_-]+$/.test(value)) return '영문, 숫자, 밑줄, 하이픈만 허용됩니다.';

        const hasLetter = /[a-zA-Z]/.test(value);
        const hasNumber = /[0-9]/.test(value);
        if (!hasLetter || !hasNumber) return '영문과 숫자를 함께 포함해야 합니다.';

        return '';
    };

    const handleCheckDuplicateUserId = async () => {
        const validationError = validateUserIdFormat();

        if (validationError) {
            setErrors(prev => ({ ...prev, user_id: validationError }));
            return;
        }

        if (!onCheckDuplicateUserId) return;

        setIsCheckingDuplicate(true);
        try {
            const isDuplicate = await onCheckDuplicateUserId(createFormData.user_id);
            setIsDuplicateUserIdChecked(true);
            setIsDuplicateUserIdExists(isDuplicate);
            if (!isDuplicate) {
                setErrors(prev => ({ ...prev, user_id: '' }));
            }
        } finally {
            setIsCheckingDuplicate(false);
        }
    };

    const handleAddressSearchClick = () => {
        interface DaumData {
            address: string;
        }

        const w = window as unknown as { daum?: { Postcode: new (config: { oncomplete: (data: DaumData) => void }) => { open: () => void } } };

        if (w.daum?.Postcode) {
            new w.daum.Postcode({
                oncomplete: function(data: DaumData) {
                    setCreateFormData({ ...createFormData, address: data.address });
                }
            }).open();
        } else {
            setShowAddressLoadingError(true);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <Modal
                isOpen={showKoreanWarning}
                message="한글은 입력할 수 없습니다."
                onClose={() => setShowKoreanWarning(false)}
                type="warning"
                showConfirmButton={false}
            />
            <Modal
                isOpen={showAddressLoadingError}
                message="주소 검색 서비스를 불러오는 중입니다.<br> 잠시 후 다시 시도해주세요."
                onClose={() => setShowAddressLoadingError(false)}
                type="error"
                showConfirmButton={false}
            />
        <div className={styles.createModalOverlay}>
            <div className={styles.createModalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.createModalTitleWrapper}>
                    <h3 className={styles.createModalTitle}>{isEditMode ? '사용자 수정' : '사용자 생성'}</h3>
                    <button
                        className={styles.createModalCloseButton}
                        onClick={onClose}
                        type="button"
                    >
                        ×
                    </button>
                </div>
                <div className={styles.createModalInnerContent} ref={innerContentRef}>

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>사용자 ID <span className={styles.required}>*</span></label>
                    {isEditMode ? (
                        <input
                            ref={userIdRef}
                            type="text"
                            className={styles.createInput}
                            value={createFormData.user_id ?? ''}
                            disabled
                            style={{
                                backgroundColor: '#f5f5f5',
                                cursor: 'not-allowed',
                                color: '#666',
                            }}
                        />
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'stretch' }}>
                                <input
                                    ref={userIdRef}
                                    type="text"
                                    className={styles.createInput}
                                    placeholder="사용자 ID를 입력하세요"
                                    value={createFormData.user_id ?? ''}
                                    onChange={(e) => {
                                        let value = e.target.value;

                                        // 한글 입력 감지
                                        if (/[가-힣㄀-ㅎㅏ-ㅣ]/.test(value)) {
                                            setShowKoreanWarning(true);
                                            return;
                                        }

                                        // 영문, 숫자, 밑줄, 하이픈만 허용
                                        value = value.replace(/[^a-zA-Z0-9_-]/g, '');
                                        // 5글자 이상 10글자 이하로 제한
                                        if (value.length > 10) {
                                            value = value.slice(0, 10);
                                        }
                                        setCreateFormData({ ...createFormData, user_id: value });
                                        // 값이 변경되면 중복확인 상태 초기화
                                        setIsDuplicateUserIdChecked(false);
                                        setIsDuplicateUserIdExists(false);
                                        // 값이 입력되면 에러 제거
                                        if (value) {
                                            setErrors((prev: { [key: string]: string }) => ({ ...prev, user_id: '' }));
                                        }
                                    }}
                                    onBlur={() => handleFieldBlur('user_id')}
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        borderColor: errors.user_id ? '#d32f2f' : undefined,
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleCheckDuplicateUserId}
                                    disabled={isCheckingDuplicate}
                                    style={{
                                        padding: '8px 12px',
                                        whiteSpace: 'nowrap',
                                        backgroundColor: 'var(--main-color)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: isCheckingDuplicate ? 'not-allowed' : 'pointer',
                                        fontSize: '12px',
                                        fontWeight: '500',
                                        opacity: isCheckingDuplicate ? 0.6 : 1,
                                        flexShrink: 0,
                                    }}
                                >
                                    {isCheckingDuplicate ? '중...' : '확인'}
                                </button>
                            </div>
                            {isDuplicateUserIdChecked && (
                                <span
                                    style={{
                                        fontSize: '13px',
                                        marginTop: '8px',
                                        display: 'block',
                                        color: isDuplicateUserIdExists ? '#d32f2f' : '#22a84a',
                                        fontWeight: '500',
                                    }}
                                >
                                    {isDuplicateUserIdExists ? '이미 존재하는 사용자 ID입니다.' : '사용 가능한 사용자 ID입니다.'}
                                </span>
                            )}
                        </>
                    )}
                    {errors.user_id && <span className={styles.errorMessage}>{errors.user_id}</span>}
                </div>

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>비밀번호 <span className={styles.required}>*</span></label>
                    <input
                        ref={passwordRef}
                        type="text"
                        className={styles.createInput}
                        placeholder="비밀번호를 입력하세요"
                        value={createFormData.password ?? ''}
                        onChange={(e) => {
                            setCreateFormData({ ...createFormData, password: e.target.value });
                            if (e.target.value) {
                                setErrors((prev: { [key: string]: string }) => ({ ...prev, password: '' }));
                            }
                        }}
                        onBlur={() => handleFieldBlur('password')}
                        style={{
                            borderColor: errors.password ? '#d32f2f' : undefined,
                        }}
                    />
                    {errors.password && <span className={styles.errorMessage}>{errors.password}</span>}
                </div>

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>이름 <span className={styles.required}>*</span></label>
                    <input
                        ref={nameRef}
                        type="text"
                        className={styles.createInput}
                        placeholder="이름을 입력하세요"
                        value={createFormData.name ?? ''}
                        onChange={(e) => {
                            let value = e.target.value;
                            // 숫자 제거
                            value = value.replace(/[0-9]/g, '');
                            // 6글자 이하로 제한
                            if (value.length > 6) {
                                value = value.slice(0, 6);
                            }
                            setCreateFormData({ ...createFormData, name: value });
                            if (value) {
                                setErrors((prev: { [key: string]: string }) => ({ ...prev, name: '' }));
                            }
                        }}
                        onBlur={() => handleFieldBlur('name')}
                        style={{
                            borderColor: errors.name ? '#d32f2f' : undefined,
                        }}
                    />
                    {errors.name && <span className={styles.errorMessage}>{errors.name}</span>}
                </div>

                {/* 수정 모드이고 대표자(Level 1)인 경우 직급 수정 불가 */}
                {!(isEditMode && positions.find(p => p.id === createFormData.position_id)?.level === 1) && (
                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>직급 <span className={styles.required}>*</span></label>
                    <select
                        ref={positionRef}
                        className={styles.createSelect}
                        value={createFormData.position_id || ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            setCreateFormData({ ...createFormData, position_id: value ? Number(value) : 0 });
                            if (value) {
                                setErrors((prev: { [key: string]: string }) => ({ ...prev, position_id: '' }));
                            }
                        }}
                        onBlur={() => handleFieldBlur('position_id')}
                        style={{
                            borderColor: errors.position_id ? '#d32f2f' : undefined,
                        }}
                    >
                        <option value="" disabled hidden>직급을 선택해주세요</option>
                        {positions.filter(position => position.level !== 1).map(position => (
                            <option key={position.id} value={position.id}>
                                {position.name}
                            </option>
                        ))}
                    </select>
                    {errors.position_id && <span className={styles.errorMessage}>{errors.position_id}</span>}
                </div>
                )}

                {/* 영업자(Level 4)/검수자(Level 6)일 때 소속 선택 표시 */}
                {createFormData.position_id > 0 &&
                 [4, 6].includes(positions.find(p => p.id === createFormData.position_id)?.level || 0) && (
                    <div className={styles.createFormGroup}>
                        {(() => {
                            const currentLevel = positions.find(p => p.id === createFormData.position_id)?.level || 0;
                            const isSalesPerson = currentLevel === 4; // 영업자는 단일선택
                            const selectedAffiliation = createFormData.affiliations?.[0] || '';

                            return (
                                <>
                                    <label className={styles.createLabel}>담당 소속 <span className={styles.required}>*</span></label>
                                    <input
                                        type="text"
                                        placeholder="소속 검색..."
                                        value={affiliationSearch}
                                        onChange={(e) => setAffiliationSearch(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '6px 10px',
                                            marginBottom: '8px',
                                            border: '1px solid #ddd',
                                            borderRadius: '4px',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '12px',
                                        padding: '12px',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '4px',
                                        backgroundColor: '#fafafa',
                                        maxHeight: '200px',
                                        overflowY: 'auto'
                                    }}>
                                        {allAffiliations
                                            .filter(affName => affName.toLowerCase().includes(affiliationSearch.toLowerCase()))
                                            .map(affName => {
                                            const isChecked = isSalesPerson
                                                ? selectedAffiliation === affName
                                                : createFormData.affiliations?.includes(affName) || false;
                                            const isTakenByOther = takenAffiliations.includes(affName) && !isChecked;

                                            return (
                                                <label
                                                    key={affName}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        cursor: isTakenByOther ? 'not-allowed' : 'pointer',
                                                        opacity: isTakenByOther ? 0.5 : 1,
                                                        padding: '6px 12px',
                                                        borderRadius: '4px',
                                                        backgroundColor: isChecked ? 'var(--main-color)' : '#fff',
                                                        color: isChecked ? '#fff' : '#333',
                                                        border: `1px solid ${isChecked ? 'var(--main-color)' : '#ddd'}`,
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <input
                                                        type={isSalesPerson ? 'radio' : 'checkbox'}
                                                        name={isSalesPerson ? 'affiliation' : undefined}
                                                        checked={isChecked}
                                                        disabled={isTakenByOther}
                                                        onChange={(e) => {
                                                            if (isSalesPerson) {
                                                                // 영업자: 단일선택 - 첫번째 항목만
                                                                if (e.target.checked) {
                                                                    setCreateFormData({
                                                                        ...createFormData,
                                                                        affiliations: [affName]
                                                                    });
                                                                }
                                                            } else {
                                                                // 검수자: 복수선택
                                                                const currentAffiliations = createFormData.affiliations || [];
                                                                if (e.target.checked) {
                                                                    setCreateFormData({
                                                                        ...createFormData,
                                                                        affiliations: [...currentAffiliations, affName]
                                                                    });
                                                                } else {
                                                                    setCreateFormData({
                                                                        ...createFormData,
                                                                        affiliations: currentAffiliations.filter(a => a !== affName)
                                                                    });
                                                                }
                                                            }
                                                            if (errors.affiliations) {
                                                                setErrors((prev: { [key: string]: string }) => ({ ...prev, affiliations: '' }));
                                                            }
                                                        }}
                                                        style={{ display: 'none' }}
                                                    />
                                                    <span style={{ fontWeight: '500', cursor: 'pointer' }}>{affName}</span>
                                                    {isTakenByOther && <span style={{ fontSize: '11px', color: '#999' }}>(배정됨)</span>}
                                                </label>
                                            );
                                        })}
                                        {allAffiliations.filter(affName => affName.toLowerCase().includes(affiliationSearch.toLowerCase())).length === 0 && (
                                            <span style={{ color: '#999', fontSize: '13px' }}>검색 결과가 없습니다</span>
                                        )}
                                    </div>
                                    {errors.affiliations && <span className={styles.errorMessage}>{errors.affiliations}</span>}
                                </>
                            );
                        })()}
                    </div>
                )}

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>연락처 <span className={styles.required}>*</span></label>
                    <input
                        type="text"
                        className={styles.createInput}
                        placeholder="연락처를 입력하세요"
                        value={createFormData.phone ?? ''}
                        onChange={(e) => {
                            let value = e.target.value.replace(/[^0-9]/g, '');
                            if (value.length > 11) {
                                value = value.slice(0, 11);
                            }

                            let formatted = '';
                            if (value.length <= 3) {
                                formatted = value;
                            } else if (value.length <= 7) {
                                formatted = `${value.slice(0, 3)}-${value.slice(3)}`;
                            } else {
                                formatted = `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
                            }

                            setCreateFormData({ ...createFormData, phone: formatted });
                            if (formatted) {
                                setErrors((prev: { [key: string]: string }) => ({ ...prev, phone: '' }));
                            }
                        }}
                        onBlur={() => handleFieldBlur('phone')}
                        style={{
                            borderColor: errors.phone ? '#d32f2f' : undefined,
                        }}
                    />
                    {errors.phone && <span className={styles.errorMessage}>{errors.phone}</span>}
                </div>

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>이메일 <span className={styles.required}>*</span></label>
                    <input
                        ref={emailRef}
                        type="email"
                        className={styles.createInput}
                        placeholder="이메일을 입력하세요"
                        value={createFormData.email_display ?? ''}
                        onChange={(e) => {
                            setCreateFormData({ ...createFormData, email_display: e.target.value });
                            // 유효한 이메일이면 에러 제거
                            if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.target.value)) {
                                setErrors((prev: { [key: string]: string }) => ({ ...prev, email_display: '' }));
                            }
                        }}
                        onBlur={() => handleFieldBlur('email_display')}
                        style={{
                            borderColor: errors.email_display ? '#d32f2f' : undefined,
                        }}
                    />
                    {errors.email_display && <span className={styles.errorMessage}>{errors.email_display}</span>}
                </div>

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>주소</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                        <input
                            type="text"
                            className={styles.createInput}
                            placeholder="주소를 입력하세요"
                            value={createFormData.address ?? ''}
                            readOnly
                            onClick={handleAddressSearchClick}
                            style={{ flex: 1, cursor: 'pointer' }}
                        />
                        <button
                            type="button"
                            onClick={handleAddressSearchClick}
                            style={{
                                padding: '8px 16px',
                                whiteSpace: 'nowrap',
                                backgroundColor: 'var(--main-color)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500'
                            }}
                        >
                            검색
                        </button>
                    </div>
                </div>

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>상세주소</label>
                    <input
                        type="text"
                        className={styles.createInput}
                        placeholder="상세주소를 입력하세요"
                        value={createFormData.address_detail ?? ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, address_detail: e.target.value })}
                        disabled={!createFormData.address}
                        style={{
                            opacity: createFormData.address ? 1 : 0.5,
                            cursor: createFormData.address ? 'text' : 'not-allowed',
                            backgroundColor: createFormData.address ? '#ffffff' : '#f5f5f5',
                        }}
                    />
                </div>

                {/* 소개자 (영업자만) */}
                {createFormData.position_id > 0 &&
                 positions.find(p => p.id === createFormData.position_id)?.level === 4 && (
                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>소개자</label>
                    <input
                        type="text"
                        className={styles.createInput}
                        placeholder="소개자 아이디를 입력하세요"
                        value={createFormData.introducer ?? ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, introducer: e.target.value })}
                    />
                </div>
                )}

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>소속 (기업명) <span className={styles.required}>*</span></label>
                    <input
                        type="text"
                        className={styles.createInput}
                        placeholder="소속을 입력하세요"
                        value={createFormData.company_name ?? ''}
                        onChange={(e) => {
                            let value = e.target.value;
                            // 10글자 이하로 제한
                            if (value.length > 10) {
                                value = value.slice(0, 10);
                            }
                            setCreateFormData({ ...createFormData, company_name: value });
                            if (value) {
                                setErrors((prev: { [key: string]: string }) => ({ ...prev, company_name: '' }));
                            }
                        }}
                        onBlur={() => handleFieldBlur('company_name')}
                        style={{
                            borderColor: errors.company_name ? '#d32f2f' : undefined,
                        }}
                    />
                    {errors.company_name && <span className={styles.errorMessage}>{errors.company_name}</span>}
                </div>

                <div className={styles.createFormGroup}>
                    <label className={styles.createLabel}>상태</label>
                    <select
                        className={styles.createSelect}
                        value={createFormData.status}
                        onChange={(e) => setCreateFormData({ ...createFormData, status: e.target.value as 'active' | 'inactive' })}
                    >
                        <option value="active">활성</option>
                        <option value="inactive">비활성</option>
                    </select>
                </div>

                    <div className={styles.createModalButtons}>
                        <button
                            className={styles.createCancelButton}
                            onClick={onClose}
                        >
                            취소
                        </button>
                        <button
                            className={styles.createSubmitButton}
                            onClick={() => onSubmit(isDuplicateUserIdChecked, isDuplicateUserIdExists)}
                        >
                            {isEditMode ? '수정' : '생성'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
