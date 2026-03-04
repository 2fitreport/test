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
        const { progress_details, progress_start_date, status } = await request.json();

        if (!progress_details?.trim()) {
            return NextResponse.json(
                { error: '진행단계를 입력해주세요.' },
                { status: 400 }
            );
        }

        // 유효한 진행단계인지 확인
        const validProgressDetails = ['상담', '서류요청', '분석', '심사', '진행', '승인'];
        if (!validProgressDetails.includes(progress_details)) {
            return NextResponse.json(
                { error: '유효하지 않은 진행단계입니다.' },
                { status: 400 }
            );
        }

        // 업데이트할 데이터 구성
        const updateData: any = {
            progress_details: progress_details,
            progress_status: 'in_progress',
            updated_at: new Date().toISOString()
        };

        // progress_start_date가 제공되면 포함
        if (progress_start_date) {
            updateData.progress_start_date = progress_start_date;
        }

        // status가 제공되면 포함
        if (status) {
            updateData.status = status;
        }

        // DB에서 업데이트
        const { data, error: updateError } = await supabase
            .from('documents')
            .update(updateData)
            .eq('id', docId)
            .select()
            .single();

        if (updateError) {
            throw updateError;
        }

        if (!data) {
            return NextResponse.json(
                { error: '문서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        // 로그 생성 (진행단계 변경)
        const authToken = request.cookies.get('auth_token')?.value;
        let actorId = 'system';
        let actorName = '시스템';

        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                actorId = tokenData.user_id || 'system';

                const { data: userData } = await supabase
                    .from('users')
                    .select('name')
                    .eq('user_id', actorId)
                    .single();

                if (userData) {
                    actorName = userData.name || actorId;
                }
            } catch (e) {
                console.error('사용자 정보 조회 실패:', e);
            }
        }

        const { error: logError } = await supabase
            .from('document_logs')
            .insert({
                document_id: docId,
                document_title: data.title || '',
                company_name: data.company_name || '',
                action_type: 'progress_details_change',
                actor_id: actorId,
                actor_name: actorName,
                old_value: data.progress_details || null,
                new_value: progress_details,
                created_at: new Date().toISOString()
            });

        if (logError) {
            console.error('로그 생성 실패:', logError);
        }

        return NextResponse.json({
            success: true,
            document: data
        });
    } catch (error) {
        console.error('진행단계 업데이트 실패:', error);
        let errorMessage = '';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (typeof error === 'object') {
            errorMessage = JSON.stringify(error);
        } else {
            errorMessage = String(error);
        }
        return NextResponse.json(
            { error: '진행단계 업데이트 실패', details: errorMessage },
            { status: 500 }
        );
    }
}
