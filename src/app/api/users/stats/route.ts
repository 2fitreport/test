import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        status,
        position_id,
        company_name,
        position(name)
      `);

    if (error) throw error;

    const users = data || [];
    const statusCounts = { active: 0, inactive: 0 };
    const positionCounts: { [key: string]: number } = {};
    const companyCounts: { [key: string]: number } = {};

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
