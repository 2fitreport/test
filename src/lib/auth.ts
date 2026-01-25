// 세션스토리지에서 로그인 정보 가져오기 (브라우저 종료 시 자동 삭제)
export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem('auth_token');
};

// 세션스토리지에 로그인 정보 저장 (브라우저 종료 시 자동 삭제)
export const setAuthToken = (token: string, adminData: { name: string; position: string; company_name?: string }) => {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem('auth_token', token);
  sessionStorage.setItem('admin_data', JSON.stringify(adminData));
};

// 세션스토리지에서 로그인 정보 삭제
export const clearAuthToken = () => {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('auth_token');
  sessionStorage.removeItem('admin_data');
};

// 세션스토리지에서 관리자 정보 가져오기
export const getAdminData = () => {
  if (typeof window === 'undefined') return null;
  const data = sessionStorage.getItem('admin_data');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
};

// 로그인 상태 확인
export const isLoggedIn = () => {
  if (typeof window === 'undefined') return false;
  return !!sessionStorage.getItem('auth_token');
};
