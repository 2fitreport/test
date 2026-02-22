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
        let userId = 'unknown';

        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                userId = tokenData.user_id || 'unknown';
            } catch (e) {
                console.error('토큰 파싱 실패:', e);
            }
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
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
