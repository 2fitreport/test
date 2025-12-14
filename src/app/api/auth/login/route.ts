import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const { user_id, password } = await request.json();

    // 입력값 검증
    if (!user_id || !password) {
      return NextResponse.json(
        { message: '아이디와 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 데이터베이스에서 사용자 정보 조회 (position 정보 포함)
    const { data: user, error } = await supabase
      .from('users')
      .select('*, position(name, level)')
      .eq('user_id', user_id)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 비밀번호 확인 (현재는 평문 비교, 나중에 해싱 구현 예정)
    if (user.password !== password) {
      return NextResponse.json(
        { message: '아이디 또는 비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 계정 활성 상태 확인
    if (user.status !== 'active') {
      return NextResponse.json(
        { message: '비활성화된 계정입니다.' },
        { status: 403 }
      );
    }

    // 로그인 성공 응답
    // 클라이언트에서 로컬스토리지에 저장할 토큰 생성
    const authToken = Buffer.from(JSON.stringify({
      id: user.id,
      user_id: user.user_id,
      timestamp: Date.now()
    })).toString('base64');

    return NextResponse.json(
      {
        message: '로그인 성공',
        token: authToken,
        admin: {
          id: user.id,
          user_id: user.user_id,
          name: user.name,
          position: user.position,
          gender: user.gender,
          phone: user.phone,
          address: user.address,
          status: user.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
