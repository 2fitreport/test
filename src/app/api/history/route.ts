import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
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

        // 대표자(Level 1)만 접근 가능
        if (userLevel !== 1) {
            return NextResponse.json(
                { error: '접근 권한이 없습니다.' },
                { status: 403 }
            );
        }

        // 히스토리 데이터 조회 (최신순 정렬)
        const { data: historyData, error: historyError } = await supabase
            .from('documents_history')
            .select('*')
            .order('deleted_at', { ascending: false });

        if (historyError) {
            throw historyError;
        }

        return NextResponse.json(historyData || []);
    } catch (error) {
        console.error('히스토리 조회 실패:', error);
        return NextResponse.json(
            { error: '히스토리 조회 실패' },
            { status: 500 }
        );
    }
}
