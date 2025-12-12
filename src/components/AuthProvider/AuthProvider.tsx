'use client';

import { useEffect } from 'react';
import { getAuthToken, getAdminData } from '@/lib/auth';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 클라이언트 로드 시 로컬스토리지에서 로그인 정보를 쿠키에 동기화
    const authToken = getAuthToken();
    if (authToken) {
      // 쿠키에 토큰 저장 (브라우저 API 사용)
      document.cookie = `auth_token=${authToken}; path=/; max-age=${60 * 60 * 24 * 365}`; // 1년

      const adminData = getAdminData();
      if (adminData) {
        document.cookie = `admin_id=${adminData.id}; path=/; max-age=${60 * 60 * 24 * 365}`;
      }
    }
  }, []);

  return <>{children}</>;
}
