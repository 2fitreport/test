import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        const userId = request.nextUrl.searchParams.get('user_id');

        // 보완 건수
        let revisionQuery = supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'revision');

        if (userId) {
            revisionQuery = revisionQuery.eq('user_id', userId);
        }

        const { count: revisionCount, error: revisionError } = await revisionQuery;

        // 반려 건수
        let rejectionQuery = supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected');

        if (userId) {
            rejectionQuery = rejectionQuery.eq('user_id', userId);
        }

        const { count: rejectionCount, error: rejectionError } = await rejectionQuery;

        if (revisionError || rejectionError) {
            throw revisionError || rejectionError;
        }

        const totalCount = (revisionCount || 0) + (rejectionCount || 0);

        return NextResponse.json({
            count: totalCount,
            revision: revisionCount || 0,
            rejected: rejectionCount || 0
        });
    } catch (error) {
        console.error('알림 건수 조회 실패:', error);
        return NextResponse.json(
            { error: '알림 건수 조회 실패' },
            { status: 500 }
        );
    }
}
