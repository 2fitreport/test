import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const companyName = searchParams.get('companyName');

        let query = supabase
            .from('users')
            .select('id, user_id, name')
            .eq('position_id', 4);

        // 소속대표: 같은 소속의 모든 영업자
        // 일반 영업자: 자신만
        // 대표/대표실무자: 모든 영업자 (파라미터 없음)
        if (companyName) {
            query = query.eq('company_name', companyName);
        } else if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: salespeople, error: salesError } = await query;

        if (salesError) throw salesError;

        // 각 영업자별 문서 통계 계산
        const statsPromises = (salespeople || []).map(async (person: any) => {
            const { data: documents } = await supabase
                .from('documents')
                .select('status')
                .eq('user_id', person.user_id);

            const docs = documents || [];
            const inProgress = docs.filter(d => d.status === 'in_progress').length;
            const approved = docs.filter(d => d.status === 'approved').length;
            const rejected = docs.filter(d => d.status === 'rejected').length;

            return {
                userId: person.user_id,
                name: person.name,
                inProgress,
                approved,
                rejected,
                approvalAmount: '-',
                conversionRate: docs.length > 0 ? `${Math.round((approved / docs.length) * 100)}%` : '-'
            };
        });

        const stats = await Promise.all(statsPromises);

        return NextResponse.json(stats);
    } catch (error) {
        console.error('영업자 통계 조회 실패:', error);
        return NextResponse.json(
            { error: '영업자 통계 조회 실패' },
            { status: 500 }
        );
    }
}
