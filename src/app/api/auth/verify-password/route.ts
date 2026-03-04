import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { password, user_id } = await request.json();

    if (!password) {
      return NextResponse.json(
        { message: '비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // Authorization 헤더에서 토큰 가져오기 (또는 request body의 user_id 사용)
    let currentUserId = user_id;

    if (!currentUserId) {
      const authHeader = request.headers.get('authorization');
      if (!authHeader) {
        return NextResponse.json(
          { message: '인증되지 않은 요청입니다.' },
          { status: 401 }
        );
      }

      try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        currentUserId = decoded.user_id;
      } catch (e) {
        return NextResponse.json(
          { message: '토큰이 유효하지 않습니다.' },
          { status: 401 }
        );
      }
    }

    // 현재 로그인한 사용자 조회
    const { data: user, error } = await supabase
      .from('users')
      .select('password')
      .eq('user_id', currentUserId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 비밀번호 확인
    if (user.password !== password) {
      return NextResponse.json(
        { message: '비밀번호가 일치하지 않습니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { message: '비밀번호 검증 성공' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Password verification error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
