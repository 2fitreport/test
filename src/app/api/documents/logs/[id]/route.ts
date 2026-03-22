import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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

        // 현재 staff_read 조회
        const { data: logData, error: getError } = await supabase
            .from('document_logs')
            .select('staff_read')
            .eq('id', parseInt(id))
            .single();

        if (getError) throw getError;

        // staff_read에 현재 사용자 추가
        const staffRead = logData?.staff_read || {};
        staffRead[userId] = true;

        // 업데이트
        const { error: updateError } = await supabase
            .from('document_logs')
            .update({ staff_read: staffRead })
            .eq('id', parseInt(id));

        if (updateError) throw updateError;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('로그 읽음 처리 실패:', error);
        return NextResponse.json({ error: '로그 읽음 처리 실패' }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
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

        // 역할 검증
        const { data: userData } = await supabase
            .from('users')
            .select('position(level)')
            .eq('user_id', userId)
            .single();

        const userLevel = (userData?.position as any)?.level || 0;
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        const { id } = await params;
        const { error } = await supabase
            .from('document_logs')
            .delete()
            .eq('id', parseInt(id));

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('로그 삭제 실패:', error);
        return NextResponse.json({ error: '로그 삭제 실패' }, { status: 500 });
    }
}
