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
            return NextResponse.json({ error: '삭제할 로그 ID가 필요합니다.' }, { status: 400 });
        }

        // 요청자의 역할 확인
        const { data: userData } = await supabase
            .from('users')
            .select('id, position(level)')
            .eq('user_id', userId)
            .single();

        const userLevel = (userData?.position as any)?.level || 0;
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        // 요청된 logIds만 삭제
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
