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

        const { data, error } = await supabase
            .from('documents')
            .update(body)
            .eq('id', docId)
            .select();

        if (error) {
            throw error;
        }

        return NextResponse.json(data[0]);
    } catch (error) {
        console.error('기업 업데이트 실패:', error);
        return NextResponse.json(
            { error: '기업 업데이트 실패' },
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

        // 먼저 문서 조회하여 파일 정보 가져오기
        const { data: docData, error: fetchError } = await supabase
            .from('documents')
            .select('files')
            .eq('id', docId)
            .single();

        if (fetchError) {
            throw fetchError;
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
