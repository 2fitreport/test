import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
    try {
        // 보완 건수
        const { count: revisionCount, error: revisionError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'revision');

        // 반려 건수
        const { count: rejectionCount, error: rejectionError } = await supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected');

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
