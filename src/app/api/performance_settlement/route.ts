import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        let userId = 'unknown';
        let userLevel = 0;
        let userDbId = 0;

        try {
            const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
            userId = tokenData.user_id || 'unknown';

            const { data: userData } = await supabase
                .from('users')
                .select('id, user_id, position_id, company_name, is_affiliation_representative, position(level)')
                .eq('user_id', userId)
                .single();

            if (userData) {
                userLevel = (userData.position as any)?.level || 0;
                userDbId = userData.id || 0;
            }
        } catch (e) {
            console.error('토큰 파싱 실패:', e);
        }

        // 쿼리 파라미터에서 연도와 월 가져오기
        const { searchParams } = new URL(request.url);
        const paramYear = searchParams.get('year');
        const paramMonth = searchParams.get('month');

        const now = new Date();
        const targetYear = paramYear ? parseInt(paramYear) : now.getFullYear();

        const toLocalDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        // === 현재 달 범위 (stats 계산용) ===
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const currentMonthStartStr = toLocalDateStr(currentMonthStart);
        const currentMonthEndStr = toLocalDateStr(currentMonthEnd);

        // === 요청한 달 범위 (settlementData 조회용) ===
        let targetMonthStart: Date, targetMonthEnd: Date;

        if (paramMonth) {
            const [y, m] = paramMonth.split('-').map(Number);
            targetMonthStart = new Date(y, m - 1, 1);
            targetMonthEnd = new Date(y, m, 0);
        } else {
            targetMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            targetMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        }

        const targetMonthStartStr = toLocalDateStr(targetMonthStart);
        const targetMonthEndStr = toLocalDateStr(targetMonthEnd);

        // 권한별 문서 조회
        let docsQuery = supabase.from('documents')
            .select('id, user_id, company_name, status, progress_details, approval_amount, revenue_amount, created_at, updated_at, inspector_id, manager_id, payment_date');

        if (userLevel === 1 || userLevel === 2) {
            // 대표/대표실무자: admin 제외 (level 2) 또는 모든 것 (level 1)
            if (userLevel === 2) {
                docsQuery = docsQuery.neq('manager_id', 'admin');
            }
        } else if (userLevel === 3) {
            // 실무자: manager_id로 배정받은 문서만
            docsQuery = docsQuery.eq('manager_id', userId);
        } else if (userLevel === 4) {
            // 영업자: 자신이 올린 문서만
            docsQuery = docsQuery.eq('user_id', userId);
        } else if (userLevel === 6) {
            // 검수자: 소속이 같은 영업자의 문서만
            const { data: myAffiliations } = await supabase
                .from('inspector_affiliations')
                .select('affiliation_name')
                .eq('inspector_id', userDbId);

            const affiliationNames = (myAffiliations || []).map((a: any) => a.affiliation_name);

            let allowedUserIds: string[] = [];
            if (affiliationNames.length > 0) {
                const { data: usersData } = await supabase
                    .from('users').select('user_id').in('company_name', affiliationNames);
                allowedUserIds = (usersData || []).map((u: any) => u.user_id);
            }

            if (allowedUserIds.length > 0) {
                docsQuery = docsQuery.in('user_id', allowedUserIds);
            } else {
                docsQuery = docsQuery.eq('user_id', 'no_user_found');
            }
        }
        // Level 1: 모든 문서 (필터 적용 안 함)

        const docsResult = await docsQuery;
        const myDocs = docsResult.data || [];

        // === 현재달 통계 (stats는 항상 현재 달 기준) ===
        const monthlyApprovedForStats = myDocs.filter(d =>
            d.progress_details === '승인' &&
            d.updated_at >= currentMonthStartStr &&
            d.updated_at <= currentMonthEndStr + 'T23:59:59'
        );

        const totalApprovalAmount = monthlyApprovedForStats.reduce((sum, doc) => {
            const amount = doc.approval_amount;
            const numAmount = typeof amount === 'string' ? parseInt(amount) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        const monthlyRevenue = totalApprovalAmount * 0.03; // 3% 수수료

        const monthlyApprovalAmount = Math.round(totalApprovalAmount / 10000 * 10) / 10;
        const monthlyRevenueAmount = Math.round(monthlyRevenue / 10000 * 10) / 10;

        const newRegistrations = myDocs.filter(d =>
            d.created_at >= currentMonthStartStr &&
            d.created_at <= currentMonthEndStr + 'T23:59:59'
        ).length;

        // === 요청한 달의 케이스별 매출 정산 데이터 ===
        const monthlyApprovedForSettlement = myDocs.filter(d =>
            d.progress_details === '승인' &&
            d.updated_at >= targetMonthStartStr &&
            d.updated_at <= targetMonthEndStr + 'T23:59:59'
        );

        const settlementData = monthlyApprovedForSettlement.map(doc => {
            const approvalAmount = typeof doc.approval_amount === 'string'
                ? parseInt(doc.approval_amount)
                : Number(doc.approval_amount) || 0;
            const revenueAmount = typeof doc.revenue_amount === 'string'
                ? parseInt(doc.revenue_amount)
                : Number(doc.revenue_amount) || 0;

            return {
                documentId: doc.id,
                company: doc.company_name || '-',
                approvalAmount: approvalAmount, // 만원 단위
                realSales: revenueAmount, // 만원 단위 (실제 수입 데이터)
                manager: doc.user_id || '-',
                inflow: doc.progress_details === '승인' ? '기업등록' : '지원요청', // 임시로 기업등록으로 설정
                fee: Math.round(approvalAmount * 0.03), // 만원 단위 (승인금액의 3%)
                paymentDate: doc.payment_date || new Date(doc.updated_at).toISOString().split('T')[0],
                };
                });

        // === 년별 월별 매출 추이 ===
        const yearData: Record<number, Record<number, number>> = {};
        const approvedDocs = myDocs.filter(d => d.progress_details === '승인');

        approvedDocs.forEach(doc => {
            const docDate = new Date(doc.updated_at);
            const year = docDate.getFullYear();
            const month = docDate.getMonth() + 1;
            const approvalAmount = typeof doc.approval_amount === 'string'
                ? parseInt(doc.approval_amount)
                : Number(doc.approval_amount) || 0;
            const revenue = Math.round(approvalAmount * 0.03 / 10000 * 10) / 10; // 3% 수수료, 억원 단위

            if (!yearData[year]) yearData[year] = {};
            yearData[year][month] = (yearData[year][month] || 0) + revenue;
        });

        // 선택된 연도의 월별 데이터 추출
        const monthlyRevenues = Array.from({ length: 12 }, (_, i) => {
            return yearData[targetYear]?.[i + 1] || 0;
        });

        const revenueChartData = {
            labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
            data: monthlyRevenues
        };

        return NextResponse.json({
            stats: {
                monthlyRevenue: monthlyRevenueAmount,
                monthlyApprovalAmount: monthlyApprovalAmount,
                monthlyApprovedCount: monthlyApprovedForStats.length,
                newRegistrations,
                conversionRate: myDocs.length > 0
                    ? Math.round((monthlyApprovedForStats.length / myDocs.length) * 100)
                    : 0,
                totalApprovedCount: myDocs.filter(d => d.progress_details === '승인').length,
                totalApprovalAmount: Math.round(myDocs
                    .filter(d => d.progress_details === '승인')
                    .reduce((sum, doc) => {
                        const amount = doc.approval_amount;
                        const numAmount = typeof amount === 'string' ? parseInt(amount) : Number(amount) || 0;
                        return sum + numAmount;
                    }, 0) / 10000 * 10) / 10,
            },
            settlementData,
            revenueChartData,
            userLevel,
            currentUserId: userId,
        });
    } catch (error) {
        console.error('성과정산 데이터 조회 실패:', error);
        return NextResponse.json({ error: '성과정산 데이터 조회 실패' }, { status: 500 });
    }
}
