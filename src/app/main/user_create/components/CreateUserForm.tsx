'use client';

import { useState, useEffect } from 'react';
import Modal from '@/app/components/Modal/Modal';
import styles from '../createUser.module.css';

interface CreateUserFormProps {
    isEditMode: boolean;
    positions: Array<{ id: number; name: string; level: number }>;
    allAffiliations: string[];
    takenAffiliations: string[];
    formData: {
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
        affiliations?: string[];
        is_affiliation_representative?: boolean;
        bank_name: string;
        account_holder: string;
        account_number: string;
    };
    errors: { [key: string]: string };
    isDuplicateUserIdChecked: boolean;
    isDuplicateUserIdExists: boolean;
    isCheckingDuplicate: boolean;
    affiliationSearch: string;
    userIdRef: React.Ref<HTMLInputElement>;
    passwordRef: React.Ref<HTMLInputElement>;
    nameRef: React.Ref<HTMLInputElement>;
    emailRef: React.Ref<HTMLInputElement>;
    onUpdateUserId: (value: string, showWarningCallback?: () => void) => void;
    onUpdatePassword: (value: string) => void;
    onUpdateName: (value: string) => void;
    onUpdatePhone: (value: string) => void;
    onUpdateEmail: (value: string) => void;
    onUpdatePosition: (positionId: number) => void;
    onUpdateCompanyName: (value: string) => void;
    onUpdateAddress: (address: string) => void;
    onUpdateAddressDetail: (addressDetail: string) => void;
    onToggleAffiliation: (affiliationName: string) => void;
    onAffiliationSearchChange: (value: string) => void;
    onFieldBlur: (fieldName: string) => void;
    onCheckDuplicate: (userId: string) => Promise<boolean>;
    onStatusChange: (status: 'active' | 'inactive') => void;
    onUpdateField: (fieldName: string, value: any) => void;
}

export default function CreateUserForm({
    isEditMode,
    positions,
    allAffiliations,
    takenAffiliations,
    formData,
    errors,
    isDuplicateUserIdChecked,
    isDuplicateUserIdExists,
    isCheckingDuplicate,
    affiliationSearch,
    userIdRef,
    passwordRef,
    nameRef,
    emailRef,
    onUpdateUserId,
    onUpdatePassword,
    onUpdateName,
    onUpdatePhone,
    onUpdateEmail,
    onUpdatePosition,
    onUpdateCompanyName,
    onUpdateAddress,
    onUpdateAddressDetail,
    onToggleAffiliation,
    onAffiliationSearchChange,
    onFieldBlur,
    onCheckDuplicate,
    onStatusChange,
    onUpdateField,
}: CreateUserFormProps) {
    const [showKoreanWarning, setShowKoreanWarning] = useState(false);
    const [showAddressLoadingError, setShowAddressLoadingError] = useState(false);
    const [representativeInfo, setRepresentativeInfo] = useState<{ hasRepresentative: boolean; representative: { user_id: string; name: string } | null }>({
        hasRepresentative: false,
        representative: null
    });
    const [checkingRepresentative, setCheckingRepresentative] = useState(false);

    // 영업자가 소속을 선택했을 때 소속대표 확인
    const currentLevel = positions.find(p => p.id === formData.position_id)?.level || 0;
    const selectedAffiliation = formData.affiliations?.[0] || '';

    useEffect(() => {
        if (currentLevel !== 4 || !selectedAffiliation) {
            setRepresentativeInfo({ hasRepresentative: false, representative: null });
            return;
        }

        const checkRepresentative = async () => {
            setCheckingRepresentative(true);
            try {
                const response = await fetch(`/api/affiliations/representative?company_name=${encodeURIComponent(selectedAffiliation)}`);
                const data = await response.json();

                // 수정 모드에서 본인이 소속대표인 경우 제외
                if (isEditMode && data.representative?.user_id === formData.user_id) {
                    setRepresentativeInfo({ hasRepresentative: false, representative: null });
                } else {
                    setRepresentativeInfo(data);
                }
            } catch (error) {
                console.error('소속대표 확인 실패:', error);
            } finally {
                setCheckingRepresentative(false);
            }
        };

        checkRepresentative();
    }, [currentLevel, selectedAffiliation, isEditMode, formData.user_id]);

    const handleAddressSearchClick = () => {
        interface DaumData {
            address: string;
        }

        const w = window as unknown as { daum?: { Postcode: new (config: { oncomplete: (data: DaumData) => void }) => { open: () => void } } };

        if (w.daum?.Postcode) {
            new w.daum.Postcode({
                oncomplete: function(data: DaumData) {
                    onUpdateAddress(data.address);
                }
            }).open();
        } else {
            setShowAddressLoadingError(true);
        }
    };

    useEffect(() => {
        const scrollContainer = document.querySelector(`.${styles.formContent}`);
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }
    }, []);

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

            <div className={styles.formContent}>
                    {/* 사용자 ID */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>사용자 ID <span className={styles.required}>*</span></label>
                        {isEditMode ? (
                            <input
                                ref={userIdRef}
                                type="text"
                                className={styles.input}
                                value={formData.user_id ?? ''}
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
                                        className={styles.input}
                                        placeholder="사용자 ID를 입력하세요"
                                        value={formData.user_id ?? ''}
                                        onChange={(e) => onUpdateUserId(e.target.value, () => setShowKoreanWarning(true))}
                                        onBlur={() => onFieldBlur('user_id')}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            borderColor: errors.user_id ? '#d32f2f' : undefined,
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onCheckDuplicate(formData.user_id)}
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

                    {/* 비밀번호 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>비밀번호 <span className={styles.required}>*</span></label>
                        <input
                            ref={passwordRef}
                            type="text"
                            className={styles.input}
                            placeholder="비밀번호를 입력하세요"
                            value={formData.password ?? ''}
                            onChange={(e) => onUpdatePassword(e.target.value)}
                            onBlur={() => onFieldBlur('password')}
                            style={{
                                borderColor: errors.password ? '#d32f2f' : undefined,
                            }}
                        />
                        {errors.password && <span className={styles.errorMessage}>{errors.password}</span>}
                    </div>

                    {/* 이름 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>이름 <span className={styles.required}>*</span></label>
                        <input
                            ref={nameRef}
                            type="text"
                            className={styles.input}
                            placeholder="이름을 입력하세요"
                            value={formData.name ?? ''}
                            onChange={(e) => onUpdateName(e.target.value)}
                            onBlur={() => onFieldBlur('name')}
                            style={{
                                borderColor: errors.name ? '#d32f2f' : undefined,
                            }}
                        />
                        {errors.name && <span className={styles.errorMessage}>{errors.name}</span>}
                    </div>

                    {/* 직급 */}
                    {!(isEditMode && positions.find(p => p.id === formData.position_id)?.level === 1) && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>직급 <span className={styles.required}>*</span></label>
                            <div style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px',
                            }}>
                                {positions.filter(position => position.level !== 1).map(position => (
                                    <label
                                        key={position.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 16px',
                                            borderRadius: '6px',
                                            border: `1px solid ${formData.position_id === position.id ? 'var(--main-color)' : '#e5e7eb'}`,
                                            backgroundColor: formData.position_id === position.id ? 'var(--main-color)' : '#ffffff',
                                            color: formData.position_id === position.id ? '#ffffff' : '#333',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            fontWeight: formData.position_id === position.id ? '600' : '500',
                                            fontSize: '14px',
                                        }}
                                    >
                                        <input
                                            type="radio"
                                            name="position"
                                            value={position.id}
                                            checked={formData.position_id === position.id}
                                            onChange={() => onUpdatePosition(position.id)}
                                            onBlur={() => onFieldBlur('position_id')}
                                            style={{
                                                display: 'none',
                                                cursor: 'pointer',
                                                accentColor: 'var(--main-color)',
                                            }}
                                        />
                                        <span style={{ cursor: 'pointer' }}>{position.name}</span>
                                    </label>
                                ))}
                            </div>
                            {errors.position_id && <span className={styles.errorMessage}>{errors.position_id}</span>}
                        </div>
                    )}

                    {/* 담당 소속 (영업자/검수자용) */}
                    {formData.position_id > 0 &&
                     [4, 6].includes(positions.find(p => p.id === formData.position_id)?.level || 0) && (
                        <div className={styles.formGroup}>
                            {(() => {
                                const currentLevel = positions.find(p => p.id === formData.position_id)?.level || 0;
                                const isSalesPerson = currentLevel === 4; // 영업자는 단일선택
                                const selectedAffiliation = formData.affiliations?.[0] || '';

                                return (
                                    <>
                                        <label className={styles.label}>소속 <span className={styles.required}>*</span></label>
                                        <div style={{
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '12px',
                                            padding: '12px',
                                            border: '1px solid #e0e0e0',
                                            borderRadius: '4px',
                                            backgroundColor: '#fafafa',
                                            minHeight: '44px',
                                        }}>
                                            {allAffiliations.map(affName => {
                                                const isChecked = isSalesPerson
                                                    ? selectedAffiliation === affName
                                                    : formData.affiliations?.includes(affName) || false;
                                                return (
                                                    <label
                                                        key={affName}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '6px 12px',
                                                            borderRadius: '4px',
                                                            backgroundColor: isChecked ? 'var(--main-color)' : '#fff',
                                                            color: isChecked ? '#fff' : '#333',
                                                            border: `1px solid ${isChecked ? 'var(--main-color)' : '#ddd'}`,
                                                            cursor: 'pointer',
                                                            transition: 'all 0.2s ease',
                                                            fontWeight: isChecked ? '500' : '400'
                                                        }}
                                                    >
                                                        <input
                                                            type={isSalesPerson ? 'radio' : 'checkbox'}
                                                            name={isSalesPerson ? 'affiliation' : undefined}
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                if (isSalesPerson) {
                                                                    // 영업자: 단일선택 (첫번째 항목만)
                                                                    onToggleAffiliation(affName);
                                                                    // 다른 항목 제거
                                                                    if (formData.affiliations?.length && formData.affiliations[0] !== affName) {
                                                                        formData.affiliations.forEach(aff => {
                                                                            if (aff !== affName) onToggleAffiliation(aff);
                                                                        });
                                                                    }
                                                                } else {
                                                                    // 검수자: 복수선택
                                                                    onToggleAffiliation(affName);
                                                                }
                                                            }}
                                                            style={{ display: 'none' }}
                                                        />
                                                        <span style={{ cursor: 'pointer' }}>
                                                            {affName}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {allAffiliations.length === 0 && (
                                            <p style={{ color: '#999', fontSize: '13px', margin: '12px 0 0 0' }}>
                                                소속 관리에서 추가된 소속이 없습니다.
                                            </p>
                                        )}
                                        {errors.affiliations && <span className={styles.errorMessage}>{errors.affiliations}</span>}
                                    </>
                                );
                            })()}
                        </div>
                    )}

                    {/* 소속대표 (영업자 + 소속 선택 시) */}
                    {currentLevel === 4 && selectedAffiliation && (
                        <div className={styles.formGroup}>
                            <label className={styles.label}>소속대표</label>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '12px',
                                border: '1px solid #e0e0e0',
                                borderRadius: '4px',
                                backgroundColor: '#fafafa',
                                minHeight: '44px',
                            }}>
                                {checkingRepresentative ? (
                                    <span style={{ color: '#999', fontSize: '14px' }}>확인 중...</span>
                                ) : representativeInfo.hasRepresentative ? (
                                    <span style={{ color: '#d32f2f', fontSize: '14px' }}>
                                        이미 소속대표가 설정되어 있습니다. ({representativeInfo.representative?.name})
                                    </span>
                                ) : (
                                    <label style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_affiliation_representative || false}
                                            onChange={(e) => onUpdateField('is_affiliation_representative', e.target.checked)}
                                            style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                        />
                                        <span>소속대표로 설정</span>
                                    </label>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 연락처 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>연락처 <span className={styles.required}>*</span></label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="연락처를 입력하세요"
                            value={formData.phone ?? ''}
                            onChange={(e) => onUpdatePhone(e.target.value)}
                            onBlur={() => onFieldBlur('phone')}
                            style={{
                                borderColor: errors.phone ? '#d32f2f' : undefined,
                            }}
                        />
                        {errors.phone && <span className={styles.errorMessage}>{errors.phone}</span>}
                    </div>

                    {/* 이메일 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>이메일 <span className={styles.required}>*</span></label>
                        <input
                            ref={emailRef}
                            type="email"
                            className={styles.input}
                            placeholder="이메일을 입력하세요"
                            value={formData.email_display ?? ''}
                            onChange={(e) => onUpdateEmail(e.target.value)}
                            onBlur={() => onFieldBlur('email_display')}
                            style={{
                                borderColor: errors.email_display ? '#d32f2f' : undefined,
                            }}
                        />
                        {errors.email_display && <span className={styles.errorMessage}>{errors.email_display}</span>}
                    </div>

                    {/* 주소 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>주소</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="주소를 입력하세요"
                                value={formData.address ?? ''}
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

                    {/* 상세주소 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>상세주소</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="상세주소를 입력하세요"
                            value={formData.address_detail ?? ''}
                            onChange={(e) => onUpdateAddressDetail(e.target.value)}
                            disabled={!formData.address}
                            style={{
                                opacity: formData.address ? 1 : 0.5,
                                cursor: formData.address ? 'text' : 'not-allowed',
                                backgroundColor: formData.address ? '#ffffff' : '#f5f5f5',
                            }}
                        />
                    </div>

                    {/* 상태 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>상태</label>
                        <select
                            className={styles.select}
                            value={formData.status}
                            onChange={(e) => onStatusChange(e.target.value as 'active' | 'inactive')}
                        >
                            <option value="active">활성</option>
                            <option value="inactive">비활성</option>
                        </select>
                    </div>

                    {/* 은행명 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>은행명</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="은행명을 입력하세요"
                            value={formData.bank_name ?? ''}
                            onChange={(e) => onUpdateField('bank_name', e.target.value)}
                        />
                    </div>

                    {/* 예금주 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>예금주</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="예금주를 입력하세요"
                            value={formData.account_holder ?? ''}
                            onChange={(e) => onUpdateField('account_holder', e.target.value)}
                        />
                    </div>

                    {/* 계좌번호 */}
                    <div className={styles.formGroup}>
                        <label className={styles.label}>계좌번호</label>
                        <input
                            type="text"
                            className={styles.input}
                            placeholder="계좌번호를 입력하세요"
                            value={formData.account_number ?? ''}
                            onChange={(e) => onUpdateField('account_number', e.target.value)}
                        />
                    </div>
                </div>
        </>
    );
}
