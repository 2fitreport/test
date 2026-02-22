import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const logId = parseInt(id);

        // 요청자 정보 추출
        const authToken = request.cookies.get('auth_token')?.value;
        let userId = 'unknown';
        let userLevel = 0;

        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                userId = tokenData.user_id || 'unknown';

                // 사용자 정보 조회
                const { data: userData } = await supabase
                    .from('users')
                    .select('position(level)')
                    .eq('user_id', userId)
                    .single();

                if (userData) {
                    userLevel = userData.position?.level || 0;
                }
            } catch (e) {
                // 토큰 파싱 실패 무시
            }
        }

        if (userLevel === 1) {
            // 대표자: leader_read = true
            const { error } = await supabase
                .from('document_logs')
                .update({ leader_read: true })
                .eq('id', logId);

            if (error) throw error;
        } else if (userLevel === 2) {
            // 대표실무자: staff_read[userId] = true
            const { data: log } = await supabase
                .from('document_logs')
                .select('staff_read')
                .eq('id', logId)
                .single();

            const staffRead = log?.staff_read || {};
            staffRead[userId] = true;

            const { error } = await supabase
                .from('document_logs')
                .update({ staff_read: staffRead })
                .eq('id', logId);

            if (error) throw error;
        } else if (userLevel === 3 || userLevel === 4 || userLevel === 6) {
            // 영업자, 실무자, 검수자: staff_read[userId] = true
            const { data: log } = await supabase
                .from('document_logs')
                .select('staff_read')
                .eq('id', logId)
                .single();

            const staffRead = log?.staff_read || {};
            staffRead[userId] = true;

            const { error } = await supabase
                .from('document_logs')
                .update({ staff_read: staffRead })
                .eq('id', logId);

            if (error) throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('읽음 처리 실패:', error);
        return NextResponse.json({ error: '읽음 처리 실패' }, { status: 500 });
    }
}
