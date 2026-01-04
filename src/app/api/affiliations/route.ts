import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: 소속 데이터 조회
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const inspectorId = searchParams.get('inspector_id');
        const excludeInspectorId = searchParams.get('exclude_inspector_id');
        const getAllAffiliations = searchParams.get('get_all');

        // 모든 소속 목록 조회 (users 테이블의 company_name 중복 제거)
        if (getAllAffiliations === 'true') {
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('company_name')
                .not('company_name', 'is', null)
                .neq('company_name', '');

            if (usersError) throw usersError;

            // 중복 제거
            const allAffiliations = [...new Set(usersData?.map(u => u.company_name).filter(Boolean))] as string[];

            // 이미 배정된 소속 조회
            let takenQuery = supabase
                .from('inspector_affiliations')
                .select('affiliation_name');

            if (excludeInspectorId) {
                takenQuery = takenQuery.neq('inspector_id', parseInt(excludeInspectorId));
            }

            const { data: takenData, error: takenError } = await takenQuery;
            if (takenError) throw takenError;

            const takenAffiliations = takenData?.map(item => item.affiliation_name) || [];

            return NextResponse.json({ allAffiliations, takenAffiliations });
        }

        // 특정 검수자의 소속 조회
        if (inspectorId) {
            const { data, error } = await supabase
                .from('inspector_affiliations')
                .select('affiliation_name')
                .eq('inspector_id', parseInt(inspectorId));

            if (error) throw error;

            const affiliations = data?.map(item => item.affiliation_name) || [];
            return NextResponse.json({ affiliations });
        }

        // 이미 배정된 소속 조회 (특정 검수자 제외 가능)
        let query = supabase
            .from('inspector_affiliations')
            .select('affiliation_name');

        if (excludeInspectorId) {
            query = query.neq('inspector_id', parseInt(excludeInspectorId));
        }

        const { data, error } = await query;

        if (error) throw error;

        const takenAffiliations = data?.map(item => item.affiliation_name) || [];
        return NextResponse.json({ takenAffiliations });

    } catch (error) {
        console.error('소속 조회 실패:', error);
        return NextResponse.json(
            { message: '소속 조회 실패' },
            { status: 500 }
        );
    }
}

// POST: 검수자 소속 설정
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { inspector_id, affiliations } = body;

        if (!inspector_id) {
            return NextResponse.json(
                { message: '검수자 ID가 필요합니다.' },
                { status: 400 }
            );
        }

        // 기존 소속 삭제
        const { error: deleteError } = await supabase
            .from('inspector_affiliations')
            .delete()
            .eq('inspector_id', inspector_id);

        if (deleteError) throw deleteError;

        // 새 소속 추가
        if (affiliations && affiliations.length > 0) {
            const insertData = affiliations.map((affName: string) => ({
                inspector_id,
                affiliation_name: affName
            }));

            const { error: insertError } = await supabase
                .from('inspector_affiliations')
                .insert(insertData);

            if (insertError) {
                // 중복 소속 에러 처리
                if (insertError.code === '23505') {
                    return NextResponse.json(
                        { message: '이미 다른 검수자에게 배정된 소속이 있습니다.' },
                        { status: 400 }
                    );
                }
                throw insertError;
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('소속 설정 실패:', error);
        return NextResponse.json(
            { message: '소속 설정 실패' },
            { status: 500 }
        );
    }
}
