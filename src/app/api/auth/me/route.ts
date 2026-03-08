import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // auth_token 쿠키에서 사용자 정보 추출
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // Base64로 인코딩된 토큰 디코딩
    const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
    const tokenData = JSON.parse(decodedToken);
    const userId = tokenData.user_id;

    if (!userId) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    // 데이터베이스에서 최신 사용자 정보 조회
    const { data: user, error } = await supabase
      .from('users')
      .select('*, position(name, level)')
      .eq('user_id', userId)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 최신 사용자 정보 반환
    return NextResponse.json({
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      position: user.position,
      gender: user.gender,
      phone: user.phone,
      address: user.address,
      status: user.status,
      company_name: user.company_name,
      supervisor_id: user.supervisor_id,
      is_affiliation_representative: user.is_affiliation_representative || false,
      default_progress_filter: user.default_progress_filter || null,
    });
  } catch (error) {
    console.error('사용자 정보 조회 실패:', error);
    return NextResponse.json(
      { error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
