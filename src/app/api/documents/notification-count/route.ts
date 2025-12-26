import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        const userId = request.nextUrl.searchParams.get('user_id');

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

        const currentUserId = tokenData.user_id;

        // 현재 사용자 정보 조회 (역할 확인용)
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('*, position(level)')
            .eq('user_id', currentUserId)
            .single();

        if (userError || !currentUser) {
            return NextResponse.json(
                { error: '사용자 정보를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const userLevel = currentUser.position?.level;
        const userIdNumber = currentUser.id;

        // 보완 건수
        let revisionQuery = supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'revision');

        // 반려 건수
        let rejectionQuery = supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected');

        // 검수자(Level 6)인 경우: progress_details='검수자'인 것만 세기
        if (userLevel === 6 && userIdNumber) {
            revisionQuery = revisionQuery.eq('progress_details', '검수자');
            rejectionQuery = rejectionQuery.eq('progress_details', '검수자');
        } else if (userId) {
            // 영업자인 경우: 자신의 문서만
            revisionQuery = revisionQuery.eq('user_id', userId);
            rejectionQuery = rejectionQuery.eq('user_id', userId);
        }

        const { count: revisionCount, error: revisionError } = await revisionQuery;
        const { count: rejectionCount, error: rejectionError } = await rejectionQuery;

        if (revisionError || rejectionError) {
            throw revisionError || rejectionError;
        }

        const totalCount = (revisionCount || 0) + (rejectionCount || 0);

        return NextResponse.json({
            count: totalCount,
            revision: revisionCount || 0,
            rejected: rejectionCount || 0
        });
    } catch (error) {
        console.error('알림 건수 조회 실패:', error);
        return NextResponse.json(
            { error: '알림 건수 조회 실패' },
            { status: 500 }
        );
    }
}
