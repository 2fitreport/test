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

        let userId = 'unknown';
        try {
            const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
            userId = tokenData.user_id || 'unknown';
        } catch {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const { logIds } = await request.json();

        if (!Array.isArray(logIds) || logIds.length === 0) {
            return NextResponse.json({ error: '로그 ID가 필요합니다.' }, { status: 400 });
        }

        // staff_read JSONB에 현재 사용자를 true로 일괄 설정
        const { error } = await supabase.rpc('bulk_mark_logs_read', {
            log_ids: logIds,
            reader_id: userId
        });

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('전체 읽음 처리 실패:', error);
        return NextResponse.json({ error: '전체 읽음 처리 실패' }, { status: 500 });
    }
}
