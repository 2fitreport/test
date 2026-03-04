import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // 승인요청 단계의 문서 건수 조회
    const { data, error, count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('progress_details', '승인요청');

    if (error) {
      console.error('승인요청 건수 조회 실패:', error);
      return NextResponse.json(
        { message: '승인요청 건수 조회 실패' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { count: count || 0 },
      { status: 200 }
    );
  } catch (error) {
    console.error('API 오류:', error);
    return NextResponse.json(
      { message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
