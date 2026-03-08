import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        let userId = 'unknown';
        try {
            const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
            userId = tokenData.user_id || 'unknown';
        } catch {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const { data: user } = await supabase
            .from('users')
            .select('position_id, company_name')
            .eq('user_id', userId)
            .single();

        // 이번달 날짜 범위
        const now = new Date();
        const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDayStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // 역할별 필터 조건
        const roleFilter = (q: any) => {
            if (user?.position_id === 4) return q.eq('user_id', userId);
            if (user?.position_id === 6) return q.eq('inspector_id', userId);
            return q; // 대표(1), 대표실무자(2): 전체
        };

        // 전체 문서를 한 번에 조회 (이번달 범위)
        let allDocsQuery = supabase
            .from('documents')
            .select('progress_details, approval_amount, created_at, updated_at');

        allDocsQuery = roleFilter(allDocsQuery);

        const { data: allDocs } = await allDocsQuery;
        const docs = allDocs || [];

        // 1. 진행중 케이스 (오늘 업데이트된 진행 문서)
        const inProgressToday = docs.filter(d =>
            d.progress_details === '진행' && d.updated_at >= todayStr
        ).length;

        // 어제 업데이트된 진행 문서
        const inProgressYesterday = docs.filter(d =>
            d.progress_details === '진행' &&
            d.updated_at >= yesterdayStr + 'T00:00:00' &&
            d.updated_at < todayStr + 'T00:00:00'
        ).length;

        // 2. 이번달 승인 문서 (승인금액, 승인건수, 매출)
        const monthlyApproved = docs.filter(d =>
            d.progress_details === '승인' &&
            d.updated_at >= firstDayStr &&
            d.updated_at <= lastDayStr + 'T23:59:59'
        );

        const totalApprovalAmount = monthlyApproved.reduce((sum, doc) =>
            sum + (Number(doc.approval_amount) || 0), 0
        );

        const approvalAmountEok = Math.round(totalApprovalAmount / 100000000 * 10) / 10;
        const monthlyRevenueEok = Math.round(totalApprovalAmount * 0.03 / 100000000 * 10) / 10;

        // 3. 이번달 신규 등록 건수
        const newRegistrations = docs.filter(d =>
            d.created_at >= firstDayStr &&
            d.created_at <= lastDayStr + 'T23:59:59'
        ).length;

        return NextResponse.json({
            inProgressCount: inProgressToday,
            inProgressDifference: inProgressToday - inProgressYesterday,
            approvalAmount: approvalAmountEok,
            monthlyRevenue: monthlyRevenueEok,
            newRegistrations,
            approvedCount: monthlyApproved.length
        });
    } catch (error) {
        console.error('홈 통계 조회 실패:', error);
        return NextResponse.json({ error: '홈 통계 조회 실패' }, { status: 500 });
    }
}
