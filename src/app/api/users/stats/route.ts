import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
  try {
    // 요청자 정보 추출
    const authToken = request.cookies.get('auth_token')?.value;
    let userLevel = 0;

    if (authToken) {
      try {
        const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
        const userId = tokenData.user_id;

        const { data: currentUser } = await supabase
          .from('users')
          .select('*, position(level)')
          .eq('user_id', userId)
          .single();

        userLevel = currentUser?.position?.level || 0;
      } catch (e) {
        console.error('토큰 파싱 실패:', e);
      }
    }

    // Level 1, 2만 모든 사용자 조회 가능
    // 나머지는 빈 배열 반환
    if (userLevel !== 1 && userLevel !== 2) {
      return NextResponse.json({
        total: 0,
        byStatus: { active: 0, inactive: 0 },
        byPosition: [],
        byCompany: {},
      });
    }

    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select(`
        id,
        status,
        position_id,
        company_name,
        position(id, name, level)
      `);

    if (usersError) throw usersError;

    // position 테이블에서 모든 직급 정보를 가져오기
    const { data: positionsData, error: positionsError } = await supabase
      .from('position')
      .select('id, name, level')
      .order('level', { ascending: true });

    if (positionsError) throw positionsError;

    const users = usersData || [];
    const positions = positionsData || [];
    const statusCounts = { active: 0, inactive: 0 };
    const positionCounts: { [key: string]: number } = {};
    const companyCounts: { [key: string]: number } = {};

    // 모든 직급을 먼저 초기화
    positions.forEach((position: any) => {
      positionCounts[position.name] = 0;
    });

    users.forEach((user: any) => {
      if (user.status === 'active') {
        statusCounts.active++;
      } else {
        statusCounts.inactive++;
      }

      const positionName = user.position?.name || '미지정';
      positionCounts[positionName] = (positionCounts[positionName] || 0) + 1;

      const companyName = user.company_name || '미지정';
      companyCounts[companyName] = (companyCounts[companyName] || 0) + 1;
    });

    // 직급을 level 순서대로 배열로 변환
    const byPositionArray = positions.map((position: any) => ({
      name: position.name,
      count: positionCounts[position.name] || 0,
      level: position.level,
    }));

    return NextResponse.json(
      {
        total: users.length,
        byStatus: statusCounts,
        byPosition: byPositionArray,
        byCompany: companyCounts,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('사용자 통계 조회 실패:', error);
    return NextResponse.json(
      { message: '사용자 통계 조회 실패' },
      { status: 500 }
    );
  }
}
