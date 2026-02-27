import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function DELETE(request: NextRequest) {
    try {
        // 인증 확인
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        let tokenData;
        try {
            const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
            tokenData = JSON.parse(decodedToken);
        } catch {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const userId = tokenData.user_id;

        // 현재 사용자 정보 조회
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('*, position(level)')
            .eq('user_id', userId)
            .single();

        if (userError || !currentUser) {
            return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        const { ids } = await request.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: '삭제할 문서 ID가 없습니다.' }, { status: 400 });
        }

        // 삭제할 문서 전체 조회 (히스토리 저장 + 스토리지 파일 삭제용)
        const { data: docs, error: fetchError } = await supabase
            .from('documents')
            .select('*')
            .in('id', ids);

        if (fetchError) throw fetchError;
        if (!docs || docs.length === 0) {
            return NextResponse.json({ error: '삭제할 문서를 찾을 수 없습니다.' }, { status: 404 });
        }

        // 히스토리 일괄 저장
        const historyRows = docs.map(doc => ({
            original_id: doc.id,
            user_id: doc.user_id,
            user_name: doc.user_name,
            document_type: doc.document_type,
            title: doc.title,
            status: doc.status,
            progress_status: doc.progress_status,
            submitted_date: doc.submitted_date,
            completed_date: doc.completed_date,
            progress_start_date: doc.progress_start_date,
            progress_end_time: doc.progress_end_time,
            stopped_time: doc.stopped_time,
            reason: doc.reason,
            reason_read: doc.reason_read,
            files: doc.files,
            type: doc.type,
            company_name: doc.company_name,
            representative_name: doc.representative_name,
            manager_name: doc.manager_name,
            progress_details: doc.progress_details,
            business_number: doc.business_number,
            phone: doc.phone,
            manager_id: doc.manager_id,
            memos: doc.memos,
            inspector_id: doc.inspector_id,
            cretop_file: doc.cretop_file,
            cretop_none: doc.cretop_none,
            original_created_at: doc.created_at,
            original_updated_at: doc.updated_at,
            deleted_by_id: currentUser.user_id,
            deleted_by_name: currentUser.name || currentUser.user_id,
        }));

        const { error: historyError } = await supabase
            .from('documents_history')
            .insert(historyRows);

        if (historyError) {
            console.error('히스토리 저장 실패:', historyError);
            // 히스토리 저장 실패해도 삭제는 진행
        }

        // 스토리지 파일 일괄 삭제
        const allFilePaths: string[] = [];
        for (const doc of docs) {
            if (doc.files && Array.isArray(doc.files)) {
                doc.files.forEach((f: any) => { if (f.path) allFilePaths.push(f.path); });
            }
        }
        if (allFilePaths.length > 0) {
            const { error: storageError } = await supabase.storage
                .from('documents')
                .remove(allFilePaths);
            if (storageError) {
                console.error('스토리지 파일 삭제 중 오류:', storageError);
            }
        }

        // DB에서 한 번의 쿼리로 전체 삭제
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .in('id', ids);

        if (deleteError) throw deleteError;

        return NextResponse.json({ success: true, deletedCount: docs.length });
    } catch (error) {
        console.error('일괄 삭제 실패:', error);
        return NextResponse.json({ error: '일괄 삭제 실패' }, { status: 500 });
    }
}
