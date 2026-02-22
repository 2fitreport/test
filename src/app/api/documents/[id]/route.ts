import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const docId = parseInt(id);

        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', docId)
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            return NextResponse.json(
                { error: '문서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('문서 조회 실패:', error);
        return NextResponse.json(
            { error: '문서 조회 실패' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const docId = parseInt(id);

        // 액터 정보 파싱 (쿠키 토큰)
        let actorId = 'unknown';
        let actorName = '알 수 없음';
        const authToken = request.cookies.get('auth_token')?.value;
        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                actorId = tokenData.user_id || 'unknown';
                const { data: actorUser } = await supabase
                    .from('users')
                    .select('name')
                    .eq('user_id', actorId)
                    .single();
                if (actorUser) actorName = actorUser.name || actorId;
            } catch {}
        }

        // 변경 전 문서 조회
        const { data: prevDoc } = await supabase
            .from('documents')
            .select('status, progress_details, memos, title, company_name')
            .eq('id', docId)
            .single();

        // progress_start_date가 문자열 타임스탐프면 숫자로 변환
        if (body.progress_start_date && typeof body.progress_start_date === 'string') {
            const timestamp = parseInt(body.progress_start_date);
            if (!isNaN(timestamp)) {
                body.progress_start_date = timestamp;
            }
        }

        const { data, error } = await supabase
            .from('documents')
            .update(body)
            .eq('id', docId)
            .select();

        if (error) {
            throw error;
        }

        // 로그 생성
        if (prevDoc) {
            const logBase = {
                document_id: docId,
                document_title: prevDoc.title,
                company_name: prevDoc.company_name,
                actor_id: actorId,
                actor_name: actorName,
            };

            const logsToInsert: any[] = [];

            // 상태 변경 감지
            if (body.status !== undefined && body.status !== prevDoc.status) {
                logsToInsert.push({
                    ...logBase,
                    action_type: 'status_change',
                    old_value: prevDoc.status,
                    new_value: body.status,
                });
            }

            // 진행단계 변경 감지
            if (body.progress_details !== undefined && body.progress_details !== prevDoc.progress_details) {
                logsToInsert.push({
                    ...logBase,
                    action_type: 'progress_details_change',
                    old_value: prevDoc.progress_details,
                    new_value: body.progress_details,
                });
            }

            // 메모 변경 감지 (memos 필드가 명시적으로 포함되고, 실제로 배열인 경우에만)
            if ('memos' in body && Array.isArray(body.memos)) {
                const prevMemos: any[] = prevDoc.memos || [];
                const newMemos: any[] = body.memos;

                console.log('메모 변경 감지:', {
                    'prevMemos 길이': prevMemos.length,
                    'newMemos 길이': newMemos.length,
                    'prevMemos': prevMemos,
                    'newMemos': newMemos
                });

                if (newMemos.length > prevMemos.length) {
                    // 메모 추가: 마지막에 추가된 메모
                    const addedMemo = newMemos[newMemos.length - 1];
                    logsToInsert.push({
                        ...logBase,
                        action_type: 'memo_add',
                        new_value: addedMemo?.content || addedMemo?.text || JSON.stringify(addedMemo),
                    });
                } else if (newMemos.length < prevMemos.length) {
                    // 메모 삭제: 없어진 메모 찾기
                    const newIds = new Set(newMemos.map((m: any) => m.id));
                    const deletedMemo = prevMemos.find((m: any) => !newIds.has(m.id));
                    logsToInsert.push({
                        ...logBase,
                        action_type: 'memo_delete',
                        old_value: deletedMemo?.content || deletedMemo?.text || JSON.stringify(deletedMemo),
                    });
                }
            }

            for (const log of logsToInsert) {
                const { error: logError } = await supabase.rpc('insert_document_log', {
                    p_document_id: docId,
                    p_document_title: log.document_title ?? null,
                    p_company_name: log.company_name ?? null,
                    p_action_type: log.action_type,
                    p_actor_id: log.actor_id,
                    p_actor_name: log.actor_name,
                    p_old_value: log.old_value ?? null,
                    p_new_value: log.new_value ?? null,
                });
                if (logError) {
                    console.error('로그 저장 실패:', logError);
                }
            }
        }

        return NextResponse.json(data[0]);
    } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const errorDetails = error?.details || error?.hint || '';
        console.error('기업 업데이트 실패:', {
            message: errorMessage,
            details: errorDetails,
            fullError: error
        });
        return NextResponse.json(
            { error: '기업 업데이트 실패', message: errorMessage, details: errorDetails },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const docId = parseInt(id);

        // 인증 확인
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json(
                { error: '인증이 필요합니다.' },
                { status: 401 }
            );
        }

        // 토큰 디코딩
        let tokenData;
        try {
            const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
            tokenData = JSON.parse(decodedToken);
        } catch (err) {
            return NextResponse.json(
                { error: '유효하지 않은 토큰입니다.' },
                { status: 401 }
            );
        }

        const userId = tokenData.user_id;

        // 현재 사용자 정보 조회
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('*, position(level)')
            .eq('user_id', userId)
            .single();

        if (userError || !currentUser) {
            return NextResponse.json(
                { error: '사용자 정보를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const userLevel = currentUser.position?.level;

        // 먼저 문서 조회하여 전체 데이터 가져오기 (히스토리 저장용)
        const { data: docData, error: fetchError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', docId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        // 검수자(Level 6)인 경우: 대표실무자로 넘어간 문서는 삭제 불가
        if (userLevel === 6) {
            const progress = docData?.progress_details;
            if (progress !== '검수자') {
                return NextResponse.json(
                    { error: '대표실무자에게 넘어간 문서는 삭제할 수 없습니다.' },
                    { status: 403 }
                );
            }
        }

        // 히스토리 테이블에 삭제할 문서 데이터 저장
        const historyData = {
            original_id: docData.id,
            user_id: docData.user_id,
            user_name: docData.user_name,
            document_type: docData.document_type,
            title: docData.title,
            status: docData.status,
            progress_status: docData.progress_status,
            submitted_date: docData.submitted_date,
            completed_date: docData.completed_date,
            progress_start_date: docData.progress_start_date,
            progress_end_time: docData.progress_end_time,
            stopped_time: docData.stopped_time,
            reason: docData.reason,
            reason_read: docData.reason_read,
            files: docData.files,
            type: docData.type,
            company_name: docData.company_name,
            representative_name: docData.representative_name,
            manager_name: docData.manager_name,
            progress_details: docData.progress_details,
            business_number: docData.business_number,
            phone: docData.phone,
            manager_id: docData.manager_id,
            memos: docData.memos,
            inspector_id: docData.inspector_id,
            cretop_file: docData.cretop_file,
            cretop_none: docData.cretop_none,
            original_created_at: docData.created_at,
            original_updated_at: docData.updated_at,
            deleted_by_id: currentUser.user_id,
            deleted_by_name: currentUser.name || currentUser.user_id,
        };

        const { error: historyError } = await supabase
            .from('documents_history')
            .insert(historyData);

        if (historyError) {
            console.error('히스토리 저장 실패:', historyError);
            // 히스토리 저장 실패해도 삭제는 진행
        }

        // 스토리지에서 파일 삭제
        if (docData && docData.files && Array.isArray(docData.files) && docData.files.length > 0) {
            const filePaths = docData.files.map((file: any) => file.path);

            if (filePaths.length > 0) {
                const { error: deleteStorageError } = await supabase.storage
                    .from('documents')
                    .remove(filePaths);

                if (deleteStorageError) {
                    console.error('스토리지 파일 삭제 중 오류:', deleteStorageError);
                    // 스토리지 삭제 실패해도 문서 삭제는 진행
                }
            }
        }

        // 데이터베이스에서 문서 삭제
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', docId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('기업 삭제 실패:', error);
        return NextResponse.json(
            { error: '기업 삭제 실패' },
            { status: 500 }
        );
    }
}
