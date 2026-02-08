import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: 소속 데이터 조회
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const inspectorId = searchParams.get('inspector_id');
        const getAllAffiliations = searchParams.get('get_all');
        const excludeInspectorId = searchParams.get('exclude_inspector_id');

        // 모든 소속 목록 조회
        if (getAllAffiliations === 'true') {
            const { data: allAffiliations, error: allError } = await supabase
                .from('affiliations')
                .select('name')
                .order('name');

            if (allError) throw allError;

            // 검수자(level 6)가 배정받은 소속 목록 조회
            let query = supabase
                .from('user_affiliations')
                .select('affiliations(name), user_id, users!inner(position_id)')
                .eq('users.position_id', 6);

            // exclude_inspector_id가 있으면 제외
            if (excludeInspectorId) {
                query = query.neq('user_id', parseInt(excludeInspectorId));
            }

            const { data: takenData, error: takenError } = await query;

            if (takenError) throw takenError;

            const takenAffiliations = (takenData?.map((item: any) => item.affiliations?.name).filter(Boolean) || []) as string[];

            return NextResponse.json({
                allAffiliations: allAffiliations?.map(a => a.name) || [],
                takenAffiliations: [...new Set(takenAffiliations)]
            });
        }

        // 특정 사용자의 소속 조회
        if (inspectorId) {
            const { data, error } = await supabase
                .from('user_affiliations')
                .select('affiliations(name)')
                .eq('user_id', parseInt(inspectorId));

            if (error) throw error;

            const affiliations = (data?.map((item: any) => item.affiliations?.name).filter(Boolean) || []) as string[];
            return NextResponse.json({ affiliations });
        }

        // 모든 소속 목록
        const { data, error } = await supabase
            .from('affiliations')
            .select('name')
            .order('name');

        if (error) throw error;

        return NextResponse.json(data?.map(a => a.name) || []);

    } catch (error) {
        console.error('소속 조회 실패:', error);
        return NextResponse.json(
            { message: '소속 조회 실패' },
            { status: 500 }
        );
    }
}

// POST: 소속 추가
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { message: '소속 이름을 입력해주세요.' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase
            .from('affiliations')
            .insert([{ name: name.trim() }])
            .select('name')
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { message: '이미 존재하는 소속입니다.' },
                    { status: 400 }
                );
            }
            throw error;
        }

        return NextResponse.json(
            { message: '소속이 추가되었습니다.', data },
            { status: 201 }
        );

    } catch (error) {
        console.error('소속 추가 실패:', error);
        return NextResponse.json(
            { message: '소속 추가 실패' },
            { status: 500 }
        );
    }
}

// DELETE: 소속 삭제
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name');

        if (!name) {
            return NextResponse.json(
                { message: '소속 이름이 필요합니다.' },
                { status: 400 }
            );
        }

        const { error } = await supabase
            .from('affiliations')
            .delete()
            .eq('name', name);

        if (error) throw error;

        return NextResponse.json(
            { message: '소속이 삭제되었습니다.' },
            { status: 200 }
        );

    } catch (error) {
        console.error('소속 삭제 실패:', error);
        return NextResponse.json(
            { message: '소속 삭제 실패' },
            { status: 500 }
        );
    }
}
