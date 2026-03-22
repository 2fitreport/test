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

        // staff_read[userId] = true
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('읽음 처리 실패:', error);
        return NextResponse.json({ error: '읽음 처리 실패' }, { status: 500 });
    }
}
