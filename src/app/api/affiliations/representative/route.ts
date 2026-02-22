import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const companyName = searchParams.get('company_name');

        if (!companyName) {
            return NextResponse.json({ error: '소속명이 필요합니다.' }, { status: 400 });
        }

        // 해당 소속에서 소속대표가 있는지 확인
        const { data, error } = await supabase
            .from('users')
            .select('id, user_id, name')
            .eq('company_name', companyName)
            .eq('is_affiliation_representative', true)
            .single();

        if (error && error.code !== 'PGRST116') {
            // PGRST116 = no rows returned (대표가 없음)
            throw error;
        }

        return NextResponse.json({
            hasRepresentative: !!data,
            representative: data || null
        });
    } catch (error) {
        console.error('소속대표 확인 실패:', error);
        return NextResponse.json(
            { error: '소속대표 확인 실패' },
            { status: 500 }
        );
    }
}
