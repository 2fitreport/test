import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
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

    return NextResponse.json(
      {
        total: users.length,
        byStatus: statusCounts,
        byPosition: positionCounts,
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
