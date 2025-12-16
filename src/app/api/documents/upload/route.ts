import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const filePath = formData.get('filePath') as string;

        if (!file) {
            return NextResponse.json(
                { error: '파일이 없습니다' },
                { status: 400 }
            );
        }

        if (!filePath) {
            return NextResponse.json(
                { error: '파일 경로가 없습니다' },
                { status: 400 }
            );
        }

        // 파일을 ArrayBuffer로 변환
        const arrayBuffer = await file.arrayBuffer();

        // Supabase Storage에 파일 업로드
        const { data, error } = await supabase.storage
            .from('documents')
            .upload(filePath, new Uint8Array(arrayBuffer), {
                cacheControl: '3600',
                upsert: false,
            });

        if (error) {
            throw new Error(`파일 업로드 실패: ${error.message}`);
        }

        return NextResponse.json({
            message: '파일 업로드 성공',
            path: filePath,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '파일 업로드 실패';
        console.error('파일 업로드 실패:', errorMessage, error);
        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}
