import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
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

        // 현재 사용자의 역할 확인
        const { data: user } = await supabase
            .from('users')
            .select('position_id, company_name')
            .eq('user_id', userId)
            .single();

        // 이번달 시작, 끝 날짜
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        let query = supabase
            .from('documents')
            .select('approval_amount')
            .eq('progress_details', '승인')
            .gte('updated_at', firstDay.toISOString())
            .lte('updated_at', lastDay.toISOString());

        // 영업자(4): 자신의 문서만
        if (user?.position_id === 4) {
            query = query.eq('user_id', userId);
        }
        // 대표(1), 대표실무자(2): 모든 문서
        // 검수자(6): 담당 영업자의 문서만
        else if (user?.position_id === 6) {
            query = query.eq('inspector_id', userId);
        }

        const { data: documents } = await query;

        const totalApprovalAmount = (documents || []).reduce((sum, doc) => {
            return sum + (Number(doc.approval_amount) || 0);
        }, 0);

        // 억 단위로 표시
        const eokAmount = Math.round(totalApprovalAmount / 100000000 * 10) / 10;

        return NextResponse.json({ approvalAmount: eokAmount });
    } catch (error) {
        console.error('승인금액 조회 실패:', error);
        return NextResponse.json({ error: '승인금액 조회 실패' }, { status: 500 });
    }
}
