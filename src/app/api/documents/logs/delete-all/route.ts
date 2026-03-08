import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
    try {
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { logIds } = await request.json();

        if (!Array.isArray(logIds) || logIds.length === 0) {
            return NextResponse.json({ error: '로그 ID가 필요합니다.' }, { status: 400 });
        }

        const { error } = await supabase
            .from('document_logs')
            .delete()
            .in('id', logIds);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('전체 삭제 실패:', error);
        return NextResponse.json({ error: '전체 삭제 실패' }, { status: 500 });
    }
}
