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

        // progress_start_date가 숫자(타임스탐프)면 로컬 시간 기준 ISO 문자열로 변환
        if (body.progress_start_date && typeof body.progress_start_date === 'string') {
            const timestamp = parseInt(body.progress_start_date);
            if (!isNaN(timestamp)) {
                const d = new Date(timestamp);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const hours = String(d.getHours()).padStart(2, '0');
                const minutes = String(d.getMinutes()).padStart(2, '0');
                const seconds = String(d.getSeconds()).padStart(2, '0');
                body.progress_start_date = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
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
