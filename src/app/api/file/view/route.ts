import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
    try {
        const { filePath } = await request.json();

        if (!filePath) {
            return NextResponse.json(
                { error: '파일 경로가 필요합니다.' },
                { status: 400 }
            );
        }

        // 임시 서명된 URL 생성 (1시간 유효)
        const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 3600); // 3600초 = 1시간

        if (error) {
            console.error('서명된 URL 생성 실패:', error);
            return NextResponse.json(
                { error: '파일 조회 실패' },
                { status: 500 }
            );
        }

        return NextResponse.json({ url: data.signedUrl });
    } catch (error) {
        console.error('파일 뷰 API 오류:', error);
        return NextResponse.json(
            { error: '파일 조회 중 오류 발생' },
            { status: 500 }
        );
    }
}
