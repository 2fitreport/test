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

        // 오늘의 진행중 케이스
        let query = supabase
            .from('documents')
            .select('id', { count: 'exact' })
            .eq('progress_details', '진행')
            .gte('updated_at', new Date().toISOString().split('T')[0]);

        // 어제의 진행중 케이스
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const todayStr = new Date().toISOString().split('T')[0];

        let yesterdayQuery = supabase
            .from('documents')
            .select('id', { count: 'exact' })
            .eq('progress_details', '진행')
            .gte('updated_at', yesterdayStr + 'T00:00:00')
            .lt('updated_at', todayStr + 'T00:00:00');

        // 영업자(4): 자신의 문서만
        if (user?.position_id === 4) {
            query = query.eq('user_id', userId);
            yesterdayQuery = yesterdayQuery.eq('user_id', userId);
        }
        // 대표(1), 대표실무자(2): 모든 문서
        // 검수자(6): 담당 영업자의 문서만
        else if (user?.position_id === 6) {
            query = query.eq('inspector_id', userId);
            yesterdayQuery = yesterdayQuery.eq('inspector_id', userId);
        }

        const [{ count: todayCount }, { count: yesterdayCount }] = await Promise.all([
            query,
            yesterdayQuery
        ]);

        const inProgressCount = todayCount || 0;
        const yesterdayInProgressCount = yesterdayCount || 0;
        const difference = inProgressCount - yesterdayInProgressCount;

        return NextResponse.json({
            inProgressCount,
            yesterdayInProgressCount,
            difference
        });
    } catch (error) {
        console.error('진행중 케이스 개수 조회 실패:', error);
        return NextResponse.json({ error: '진행중 케이스 개수 조회 실패' }, { status: 500 });
    }
}
