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
        const { path, contentType } = await request.json();

        if (!path) {
            return NextResponse.json(
                { error: '파일 경로가 필요합니다.' },
                { status: 400 }
            );
        }

        // Signed URL 생성 (1시간 유효)
        const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUploadUrl(path);

        if (error) {
            return NextResponse.json(
                { error: `Signed URL 생성 실패: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            signedUrl: data.signedUrl,
            token: data.token,
            path: data.path,
            fullPath: `${supabaseUrl}/storage/v1/object/public/documents/${path}`,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '서버 오류' },
            { status: 500 }
        );
    }
}
