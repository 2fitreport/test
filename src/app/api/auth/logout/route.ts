import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json(
      { message: '로그아웃 되었습니다.' },
      { status: 200 }
    );

    // 클라이언트에서 로컬스토리지 삭제 지시
    response.headers.set('X-Clear-Auth', 'true');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { message: '로그아웃 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
