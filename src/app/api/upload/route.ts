import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const path = formData.get('path') as string;

        if (!file || !path) {
            return NextResponse.json(
                { error: '파일과 경로가 필요합니다.' },
                { status: 400 }
            );
        }

        // 파일을 Buffer로 변환
        const buffer = await file.arrayBuffer();

        // Supabase Storage에 업로드
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(path, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (error) {
            return NextResponse.json(
                { error: `업로드 실패: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            path: data.path,
            fullPath: `${supabaseUrl}/storage/v1/object/public/documents/${data.path}`,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '서버 오류' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const path = searchParams.get('path');

        if (!path) {
            return NextResponse.json(
                { error: '파일 경로가 필요합니다.' },
                { status: 400 }
            );
        }

        // Supabase Storage에서 삭제
        const { error } = await supabase.storage
            .from('documents')
            .remove([path]);

        if (error) {
            return NextResponse.json(
                { error: `삭제 실패: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: '파일이 삭제되었습니다.',
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '서버 오류' },
            { status: 500 }
        );
    }
}
