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

        const salespeopleList = salespeople || [];
        if (salespeopleList.length === 0) {
            return NextResponse.json([]);
        }

        // 모든 영업자의 문서를 한번에 조회
        const userIds = salespeopleList.map((p: any) => p.user_id);
        const { data: allDocuments } = await supabase
            .from('documents')
            .select('user_id, status, progress_details')
            .in('user_id', userIds);

        const docs = allDocuments || [];

        // user_id별로 그룹핑
        const docsByUser: Record<string, any[]> = {};
        for (const doc of docs) {
            if (!docsByUser[doc.user_id]) docsByUser[doc.user_id] = [];
            docsByUser[doc.user_id].push(doc);
        }

        const stats = salespeopleList.map((person: any) => {
            const userDocs = docsByUser[person.user_id] || [];
            const registrations = userDocs.length;
            const inProgress = userDocs.filter(d => d.progress_details === '진행').length;
            const approved = userDocs.filter(d => d.progress_details === '승인').length;
            const rejected = userDocs.filter(d => d.status === '보류').length;

            return {
                userId: person.user_id,
                name: person.name,
                registrations,
                inProgress,
                approved,
                rejected,
                approvalAmount: '-',
                conversionRate: userDocs.length > 0 ? `${Math.round((approved / userDocs.length) * 100)}%` : '-'
            };
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error('영업자 통계 조회 실패:', error);
        return NextResponse.json(
            { error: '영업자 통계 조회 실패' },
            { status: 500 }
        );
    }
}
