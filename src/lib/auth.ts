// 로컬스토리지에서 로그인 정보 가져오기
export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
};

// 로컬스토리지에 로그인 정보 저장 (무한 유지)
export const setAuthToken = (token: string, adminData: { name: string; position: string; company_name?: string }) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('auth_token', token);
  localStorage.setItem('admin_data', JSON.stringify(adminData));
};

// 로컬스토리지에서 로그인 정보 삭제
export const clearAuthToken = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth_token');
  localStorage.removeItem('admin_data');
};

// 로컬스토리지에서 관리자 정보 가져오기
export const getAdminData = () => {
  if (typeof window === 'undefined') return null;
  const data = localStorage.getItem('admin_data');
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
  return !!localStorage.getItem('auth_token');
};
