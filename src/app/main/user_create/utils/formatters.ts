/**
 * 전화번호 포맷팅 (xxx-xxxx-xxxx)
 */
export const formatPhoneNumber = (value: string): string => {
    let formatted = value.replace(/[^0-9]/g, '');
    if (formatted.length > 11) {
        formatted = formatted.slice(0, 11);
    }

    if (formatted.length <= 3) {
        return formatted;
    } else if (formatted.length <= 7) {
        return `${formatted.slice(0, 3)}-${formatted.slice(3)}`;
    } else {
        return `${formatted.slice(0, 3)}-${formatted.slice(3, 7)}-${formatted.slice(7)}`;
    }
};

/**
 * 사용자 ID 입력값 처리 (한글 필터링, 특수문자 제한)
 */
export const sanitizeUserId = (value: string): { sanitized: string; hasKorean: boolean } => {
    const hasKorean = /[가-힣㄀-ㅎㅏ-ㅣ]/.test(value);
    // 영문, 숫자, 밑줄, 하이픈만 허용
    let sanitized = value.replace(/[^a-zA-Z0-9_-]/g, '');
    // 5글자 이상 10글자 이하로 제한
    if (sanitized.length > 10) {
        sanitized = sanitized.slice(0, 10);
    }
    return { sanitized, hasKorean };
};

/**
 * 이름 입력값 처리 (숫자 제거, 6글자 제한)
 */
export const sanitizeName = (value: string): string => {
    let sanitized = value.replace(/[0-9]/g, '');
    if (sanitized.length > 6) {
        sanitized = sanitized.slice(0, 6);
    }
    return sanitized;
};

/**
 * 회사명 입력값 처리 (10글자 제한)
 */
export const sanitizeCompanyName = (value: string): string => {
    if (value.length > 10) {
        return value.slice(0, 10);
    }
    return value;
};
