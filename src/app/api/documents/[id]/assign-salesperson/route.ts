import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const docId = parseInt(id);
        const { new_user_id, new_user_name, submitter_id } = await request.json();

        if (!new_user_id) {
            return NextResponse.json(
                { error: '영업자를 선택해주세요.' },
                { status: 400 }
            );
        }

        // 인증 확인
        let actorId = 'unknown';
        let actorName = '알 수 없음';
        let actorLevel = 0;
        const authToken = request.cookies.get('auth_token')?.value;
        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                actorId = tokenData.user_id || 'unknown';
                const { data: actorUser } = await supabase
                    .from('users')
                    .select('name, position(level)')
                    .eq('user_id', actorId)
                    .single();
                if (actorUser) {
                    actorName = actorUser.name || actorId;
                    const positionArray = actorUser.position as any;
                    actorLevel = (Array.isArray(positionArray) ? positionArray[0]?.level : positionArray?.level) || 0;
                }
            } catch {}
        }

        // 검수자(level 6) 또는 대표자(level 1)만 영업자 배정 가능
        if (actorLevel !== 6 && actorLevel !== 1) {
            return NextResponse.json(
                { error: '영업자를 배정할 권한이 없습니다.' },
                { status: 403 }
            );
        }

        // 문서 조회 - 상담신청 단계인지 확인
        const { data: doc } = await supabase
            .from('documents')
            .select('progress_details, user_id, company_name, title')
            .eq('id', docId)
            .single();

        if (!doc) {
            return NextResponse.json(
                { error: '문서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        if (doc.progress_details !== '상담신청') {
            return NextResponse.json(
                { error: '상담신청 단계에서만 영업자를 배정할 수 있습니다.' },
                { status: 403 }
            );
        }

        // 문서 작성자 본인은 배정 불가
        if (new_user_id === doc.user_id) {
            return NextResponse.json(
                { error: '문서를 작성한 영업자는 배정할 수 없습니다.' },
                { status: 403 }
            );
        }

        // A영업자와 B영업자의 소속 일치 여부 확인
        const { data: aWorkerUser } = await supabase
            .from('users')
            .select('id')
            .eq('user_id', doc.user_id)
            .single();

        const { data: bWorkerUser } = await supabase
            .from('users')
            .select('id')
            .eq('user_id', new_user_id)
            .single();

        if (aWorkerUser && bWorkerUser) {
            const { data: aAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliations(name)')
                .eq('user_id', aWorkerUser.id);

            const { data: bAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliations(name)')
                .eq('user_id', bWorkerUser.id);

            const aAffNames = aAffiliations?.map((a: any) => a.affiliations?.name).filter(Boolean) || [];
            const bAffNames = bAffiliations?.map((a: any) => a.affiliations?.name).filter(Boolean) || [];

            const hasCommonAffiliation = aAffNames.some((name: string) => bAffNames.includes(name));
            if (aAffNames.length > 0 && !hasCommonAffiliation) {
                return NextResponse.json(
                    { error: '같은 소속의 영업자만 배정할 수 있습니다.' },
                    { status: 403 }
                );
            }
        }

        // user_id를 B영업자로 변경, submitter_id에 A영업자 보존
        const updateData: any = {
            user_id: new_user_id,
            user_name: new_user_name || '',
        };

        // submitter_id가 제공되면 설정 (A영업자 보존)
        if (submitter_id) {
            updateData.submitter_id = submitter_id;
        }

        const { data, error } = await supabase
            .from('documents')
            .update(updateData)
            .eq('id', docId)
            .select()
            .single();

        if (error) {
            throw error;
        }

        // 로그 생성
        await supabase.rpc('insert_document_log', {
            p_document_id: docId,
            p_document_title: doc.title ?? null,
            p_company_name: doc.company_name ?? null,
            p_action_type: 'salesperson_assigned',
            p_actor_id: actorId,
            p_actor_name: actorName,
            p_old_value: doc.user_id || '(없음)',
            p_new_value: new_user_name || new_user_id,
        });

        return NextResponse.json({ success: true, document: data });
    } catch (error: any) {
        console.error('영업자 배정 실패:', error);
        return NextResponse.json(
            { error: '영업자 배정 실패', details: error?.message || String(error) },
            { status: 500 }
        );
    }
}
