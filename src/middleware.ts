import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 로그인 페이지는 항상 접근 가능
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // API 라우트는 미들웨어 통과
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // 로그인 상태 확인
  const authToken = request.cookies.get('auth_token')?.value;

  // 로그인되지 않은 상태에서 다른 페이지 접근 시 로그인 페이지로 리다이렉트
  if (!authToken && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.webp).*)',
  ],
};
