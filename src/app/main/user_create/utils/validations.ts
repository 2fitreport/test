/**
 * 사용자 ID 형식 검증
 */
export const validateUserIdFormat = (value: string): string => {
    if (!value) return '사용자 ID를 입력해주세요.';
    if (value.length < 5) return '5글자 이상으로 입력해주세요.';
    if (value.length > 10) return '10글자 이하로 입력해주세요.';
    if (!/^[a-zA-Z0-9_-]+$/.test(value)) return '영문, 숫자, 밑줄, 하이픈만 허용됩니다.';

    const hasLetter = /[a-zA-Z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    if (!hasLetter || !hasNumber) return '영문과 숫자를 함께 포함해야 합니다.';

    return '';
};

/**
 * 개별 필드 검증
 */
export const validateField = (fieldName: string, value: string | number): string => {
    switch (fieldName) {
        case 'user_id':
            return validateUserIdFormat(String(value));
        case 'password':
            if (!value) return '비밀번호를 입력해주세요.';
            return '';
        case 'name':
            if (!value) return '이름을 입력해주세요.';
            if (String(value).length > 6) return '6글자 이하로 입력해주세요.';
            return '';
        case 'position_id':
            if (!value) return '직급을 선택해주세요.';
            return '';
        case 'phone':
            if (!value) return '전화번호를 입력해주세요.';
            return '';
        case 'email_display':
            if (!value) return '이메일을 입력해주세요.';
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
                return '유효한 이메일 형식이 아닙니다.';
            }
            return '';
        case 'company_name':
            if (!value) return '소속을 입력해주세요.';
            if (String(value).length > 10) return '10글자 이하로 입력해주세요.';
            return '';
        default:
            return '';
    }
};

/**
 * 폼 전체 검증
 */
export const validateFormData = (
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
        affiliations?: string[];
    },
    positions: Array<{ id: number; name: string; level: number }>
): { errors: { [key: string]: string }; firstErrorField: string | null; firstErrorMessage: string } => {
    const errors: { [key: string]: string } = {};
    let firstErrorField: string | null = null;
    let firstErrorMessage: string = '';

    // user_id 검증
    const userIdError = validateUserIdFormat(formData.user_id);
    if (userIdError) {
        errors.user_id = userIdError;
        if (!firstErrorField) {
            firstErrorField = 'user_id';
            firstErrorMessage = userIdError;
        }
    }

    // password 검증
    if (!formData.password) {
        errors.password = '비밀번호를 입력해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'password';
            firstErrorMessage = '비밀번호를 입력해주세요.';
        }
    }

    // name 검증
    if (!formData.name) {
        errors.name = '이름을 입력해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'name';
            firstErrorMessage = '이름을 입력해주세요. (6글자 이하)';
        }
    } else if (formData.name.length > 6) {
        errors.name = '6글자 이하로 입력해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'name';
            firstErrorMessage = '이름은 6글자 이하여야 합니다.';
        }
    }

    // position_id 검증
    if (!formData.position_id) {
        errors.position_id = '직급을 선택해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'position_id';
            firstErrorMessage = '직급을 선택해주세요.';
        }
    }

    // phone 검증
    if (!formData.phone) {
        errors.phone = '전화번호를 입력해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'phone';
            firstErrorMessage = '전화번호를 입력해주세요.';
        }
    }

    // email_display 검증
    if (!formData.email_display) {
        errors.email_display = '이메일을 입력해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'email_display';
            firstErrorMessage = '이메일을 입력해주세요.';
        }
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email_display)) {
        errors.email_display = '유효한 이메일 형식이 아닙니다.';
        if (!firstErrorField) {
            firstErrorField = 'email_display';
            firstErrorMessage = '유효한 이메일 형식이 아닙니다.';
        }
    }

    // company_name 검증
    if (!formData.company_name) {
        errors.company_name = '소속을 입력해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'company_name';
            firstErrorMessage = '소속을 입력해주세요. (10글자 이하)';
        }
    } else if (formData.company_name.length > 10) {
        errors.company_name = '10글자 이하로 입력해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'company_name';
            firstErrorMessage = '소속은 10글자 이하여야 합니다.';
        }
    }

    // 검수자(Level 6)인 경우 담당 소속 필수 확인
    const selectedPosition = positions.find(p => p.id === formData.position_id);
    if (selectedPosition?.level === 6 && (!formData.affiliations || formData.affiliations.length === 0)) {
        errors.affiliations = '담당 소속을 선택해주세요.';
        if (!firstErrorField) {
            firstErrorField = 'affiliations';
            firstErrorMessage = '검수자는 최소 1개 이상의 담당 소속을 선택해야 합니다.';
        }
    }

    return { errors, firstErrorField, firstErrorMessage };
};
