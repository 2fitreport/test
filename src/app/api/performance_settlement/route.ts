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
        let isAffiliationRep = false;

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
                isAffiliationRep = userData.is_affiliation_representative || false;
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

        // ISO 문자열에서 연도/월/일 추출 (UTC 기준)
        const extractYearMonthDay = (isoString: string): { year: number; month: number; day: number } => {
            const match = isoString.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (!match) return { year: 0, month: 0, day: 0 };
            return {
                year: parseInt(match[1]),
                month: parseInt(match[2]),
                day: parseInt(match[3])
            };
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

        // 유효하지 않은 역할이면 차단
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        // 권한별 문서 조회
        let docsQuery = supabase.from('documents')
            .select('id, user_id, submitter_id, company_name, status, progress_details, approval_amount, revenue_amount, created_at, updated_at, inspector_id, manager_id, payment_date');

        if (userLevel === 1 || userLevel === 2) {
            // 대표/대표실무자: admin 제외 (level 2) 또는 모든 것 (level 1)
            if (userLevel === 2) {
                docsQuery = docsQuery.neq('manager_id', 'admin');
            }
        } else if (userLevel === 3) {
            // 실무자: manager_id로 배정받은 문서만
            docsQuery = docsQuery.eq('manager_id', userId);
        } else if (userLevel === 4) {
            if (isAffiliationRep) {
                // 소속대표: 본인 소속의 모든 영업자 문서
                const { data: myAffiliations } = await supabase
                    .from('user_affiliations')
                    .select('affiliations(name)')
                    .eq('user_id', userDbId);

                const affNames = (myAffiliations || []).map((a: any) => a.affiliations?.name).filter(Boolean);

                if (affNames.length > 0) {
                    const { data: affUsers } = await supabase
                        .from('users')
                        .select('user_id')
                        .in('company_name', affNames);
                    const affUserIds = (affUsers || []).map((u: any) => u.user_id);
                    if (affUserIds.length > 0) {
                        docsQuery = docsQuery.in('user_id', affUserIds);
                    } else {
                        docsQuery = docsQuery.eq('user_id', 'no_user_found');
                    }
                } else {
                    docsQuery = docsQuery.eq('user_id', 'no_user_found');
                }
            } else {
                // 일반 영업자: 자신이 올린 문서 + submitter_id 문서
                const { data: submitterDocs } = await supabase
                    .from('documents')
                    .select('id')
                    .eq('submitter_id', userId);
                const submitterIds = (submitterDocs || []).map((d: any) => d.id);

                if (submitterIds.length > 0) {
                    docsQuery = docsQuery.or(`user_id.eq.${userId},id.in.(${submitterIds.join(',')})`);
                } else {
                    docsQuery = docsQuery.eq('user_id', userId);
                }
            }
        } else if (userLevel === 6) {
            // 검수자: 소속이 같은 영업자의 문서만 (user_affiliations 기준)
            const { data: myAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userDbId);

            const affiliationIds = (myAffiliations || []).map((a: any) => a.affiliation_id);

            let allowedUserIds: string[] = [];
            if (affiliationIds.length > 0) {
                const { data: sameAffUsers } = await supabase
                    .from('user_affiliations')
                    .select('user_id')
                    .in('affiliation_id', affiliationIds);

                const sameAffUserDbIds = (sameAffUsers || []).map((u: any) => u.user_id);

                if (sameAffUserDbIds.length > 0) {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('user_id')
                        .in('id', sameAffUserDbIds);
                    allowedUserIds = (usersData || []).map((u: any) => u.user_id);
                }
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
        const monthlyApprovedForStats = myDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const approvedDateStr = d.updated_at?.substring(0, 10) || '';
            return approvedDateStr >= currentMonthStartStr && approvedDateStr <= currentMonthEndStr;
        });

        const totalApprovalAmount = monthlyApprovedForStats.reduce((sum, doc) => {
            const amount = doc.approval_amount;
            const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        const totalRevenueAmountRaw = monthlyApprovedForStats.reduce((sum, doc) => {
            const amount = doc.revenue_amount;
            const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        const monthlyApprovalAmount = totalApprovalAmount / 10000;
        const monthlyRevenueAmount = totalRevenueAmountRaw / 10000;

        const newRegistrations = myDocs.filter(d => {
            // UTC 기준 ISO 문자열에서 YYYY-MM-DD 추출
            const docDateStr = d.created_at?.substring(0, 10) || '';
            return docDateStr >= currentMonthStartStr && docDateStr <= currentMonthEndStr;
        }).length;

        // === 요청한 달의 케이스별 매출 정산 데이터 (승인된 날짜 기준) ===
        const monthlyApprovedForSettlement = myDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const approvedDateStr = d.updated_at?.substring(0, 10) || '';
            return approvedDateStr >= targetMonthStartStr && approvedDateStr <= targetMonthEndStr;
        });

        // 영업자 정보 (이름 + 소개자) 일괄 조회 (user_id + submitter_id 모두)
        const docUserIds = [...new Set([
            ...monthlyApprovedForSettlement.map(d => d.user_id),
            ...monthlyApprovedForSettlement.map(d => d.submitter_id),
        ].filter(Boolean))];
        let userInfoMap: Record<string, { name: string; introducer?: string }> = {};
        if (docUserIds.length > 0) {
            const { data: usersData } = await supabase
                .from('users')
                .select('user_id, name, introducer')
                .in('user_id', docUserIds);
            for (const u of usersData || []) {
                userInfoMap[u.user_id] = { name: u.name, introducer: u.introducer };
            }
        }

        // 소개자 이름 일괄 조회
        const introducerIds = [...new Set(
            Object.values(userInfoMap).map(u => u.introducer).filter(Boolean) as string[]
        )];
        let introducerNameMap: Record<string, string> = {};
        if (introducerIds.length > 0) {
            const { data: intros } = await supabase
                .from('users')
                .select('user_id, name')
                .in('user_id', introducerIds);
            for (const u of intros || []) {
                introducerNameMap[u.user_id] = u.name;
            }
        }

        const settlementData: any[] = [];
        for (const doc of monthlyApprovedForSettlement) {
            const approvalAmount = typeof doc.approval_amount === 'string'
                ? (parseInt(doc.approval_amount) || 0)
                : Number(doc.approval_amount) || 0;
            const revenueAmount = typeof doc.revenue_amount === 'string'
                ? (parseInt(doc.revenue_amount) || 0)
                : Number(doc.revenue_amount) || 0;
            const paymentDate = doc.payment_date || new Date(doc.updated_at).toISOString().split('T')[0];

            if (doc.submitter_id) {
                // 상담신청 케이스: A영업자(submitter_id) 20%, B영업자(user_id) 0%
                const aInfo = userInfoMap[doc.submitter_id] || {};
                settlementData.push({
                    documentId: doc.id,
                    company: doc.company_name || '-',
                    approvalAmount,
                    realSales: revenueAmount,
                    manager: aInfo.name || doc.submitter_id,
                    inflow: '상담신청',
                    fee: Math.round(revenueAmount * 0.2),
                    paymentDate,
                    settlementUserId: doc.submitter_id,
                });
                // A영업자의 소개자 → 실제매출의 5%
                if (aInfo.introducer) {
                    const introducerName = introducerNameMap[aInfo.introducer] || aInfo.introducer;
                    settlementData.push({
                        documentId: doc.id,
                        company: doc.company_name || '-',
                        approvalAmount,
                        realSales: revenueAmount,
                        manager: introducerName,
                        inflow: '소개지급',
                        fee: Math.round(revenueAmount * 0.05),
                        paymentDate,
                        settlementUserId: aInfo.introducer,
                    });
                }
            } else {
                // 기업등록 케이스: 영업자(user_id) 40%
                const userInfo = userInfoMap[doc.user_id] || {};
                settlementData.push({
                    documentId: doc.id,
                    company: doc.company_name || '-',
                    approvalAmount,
                    realSales: revenueAmount,
                    manager: userInfo.name || doc.user_id || '-',
                    inflow: '기업등록',
                    fee: Math.round(revenueAmount * 0.4),
                    paymentDate,
                    settlementUserId: doc.user_id,
                });
                // 영업자의 소개자 → 실제매출의 5%
                if (userInfo.introducer) {
                    const introducerName = introducerNameMap[userInfo.introducer] || userInfo.introducer;
                    settlementData.push({
                        documentId: doc.id,
                        company: doc.company_name || '-',
                        approvalAmount,
                        realSales: revenueAmount,
                        manager: introducerName,
                        inflow: '소개지급',
                        fee: Math.round(revenueAmount * 0.05),
                        paymentDate,
                        settlementUserId: userInfo.introducer,
                    });
                }
            }
        }

        let filteredSettlementData = settlementData;

        if (userLevel === 4 && !isAffiliationRep) {
            // 1) 본인이 수수료를 받는 행만 표시 (소개지급 제외 — 별도 쿼리로 추가)
            filteredSettlementData = settlementData.filter((row: any) =>
                row.inflow !== '소개지급' && row.settlementUserId === userId
            );

            // 2) 내가 소개자로 등록된 문서에서 내 소개지급 행 추가
            const { data: myIntroducedUsers } = await supabase
                .from('users')
                .select('user_id')
                .eq('introducer', userId);
            const introducedUserIds = (myIntroducedUsers || []).map((u: any) => u.user_id);

            if (introducedUserIds.length > 0) {
                // 기업등록: user_id가 내 소개인 문서 (submitter_id 없음)
                // 상담신청: submitter_id가 내 소개인 문서
                const { data: introducedDocs } = await supabase
                    .from('documents')
                    .select('id, company_name, approval_amount, revenue_amount, payment_date, updated_at, user_id, submitter_id')
                    .eq('progress_details', '승인')
                    .gte('payment_date', targetMonthStartStr)
                    .lte('payment_date', targetMonthEndStr)
                    .or(`and(submitter_id.is.null,user_id.in.(${introducedUserIds.join(',')})),submitter_id.in.(${introducedUserIds.join(',')})`);

                const { data: myUserData } = await supabase
                    .from('users')
                    .select('name')
                    .eq('user_id', userId)
                    .single();
                const myName = myUserData?.name || userId;

                for (const doc of introducedDocs || []) {
                    const approvalAmount = typeof doc.approval_amount === 'string'
                        ? (parseInt(doc.approval_amount) || 0)
                        : Number(doc.approval_amount) || 0;
                    const revenueAmount = typeof doc.revenue_amount === 'string'
                        ? (parseInt(doc.revenue_amount) || 0)
                        : Number(doc.revenue_amount) || 0;
                    filteredSettlementData.push({
                        documentId: doc.id,
                        company: doc.company_name || '-',
                        approvalAmount,
                        realSales: revenueAmount,
                        manager: myName,
                        inflow: '소개지급',
                        fee: Math.round(revenueAmount * 0.05),
                        paymentDate: doc.payment_date || new Date(doc.updated_at).toISOString().split('T')[0],
                        settlementUserId: userId,
                    });
                }
            }
        }

        // === 년별 월별 매출 추이 ===
        const yearData: Record<number, Record<number, number>> = {};
        const approvedDocs = myDocs.filter(d => d.progress_details === '승인');

        approvedDocs.forEach(doc => {
            // updated_at 기준 연도/월 추출 (승인날짜)
            if (!doc.updated_at) return;
            const { year, month } = extractYearMonthDay(doc.updated_at?.substring(0, 10));
            const revenueAmount = typeof doc.revenue_amount === 'string'
                ? (parseInt(doc.revenue_amount) || 0)
                : Number(doc.revenue_amount) || 0;

            if (year > 0 && month > 0) {
                if (!yearData[year]) yearData[year] = {};
                yearData[year][month] = (yearData[year][month] || 0) + revenueAmount;
            }
        });

        // 선택된 연도의 월별 데이터 추출 (실제매출 합산, 억원 단위)
        const monthlyRevenues = Array.from({ length: 12 }, (_, i) => {
            const raw = yearData[targetYear]?.[i + 1] || 0;
            return raw / 10000;
        });

        // 이전년도 데이터 추출 (전년도 비교용)
        const previousYearMonthlyRevenues = Array.from({ length: 12 }, (_, i) => {
            const raw = yearData[targetYear - 1]?.[i + 1] || 0;
            return raw / 10000;
        });

        const revenueChartData = {
            labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
            currentYearData: monthlyRevenues,
            previousYearData: previousYearMonthlyRevenues,
            currentMonth: now.getMonth() + 1,
            currentYear: now.getFullYear(),
            selectedYear: targetYear
        };

        return NextResponse.json({
            stats: {
                monthlyRevenue: monthlyRevenueAmount,
                monthlyApprovalAmount: monthlyApprovalAmount,
                monthlyApprovedCount: monthlyApprovedForStats.length,
                newRegistrations,
                conversionRate: newRegistrations > 0
                    ? Math.round((monthlyApprovedForStats.length / newRegistrations) * 100)
                    : 0,
                totalApprovedCount: myDocs.filter(d => d.progress_details === '승인').length,
                totalApprovalAmount: myDocs
                    .filter(d => d.progress_details === '승인')
                    .reduce((sum, doc) => {
                        const amount = doc.approval_amount;
                        const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
                        return sum + numAmount;
                    }, 0) / 10000,
                totalRevenueAmount: myDocs
                    .filter(d => d.progress_details === '승인')
                    .reduce((sum, doc) => {
                        const amount = doc.revenue_amount;
                        const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
                        return sum + numAmount;
                    }, 0) / 10000,
            },
            settlementData: filteredSettlementData,
            revenueChartData,
            userLevel,
            currentUserId: userId,
        });
    } catch (error) {
        console.error('성과정산 데이터 조회 실패:', error);
        return NextResponse.json({ error: '성과정산 데이터 조회 실패' }, { status: 500 });
    }
}
