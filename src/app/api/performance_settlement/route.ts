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

        // ISO 문자열에서 연도/월/일 추출 (KST 기준, UTC+9)
        const extractYearMonthDay = (isoString: string): { year: number; month: number; day: number } => {
            if (!isoString) return { year: 0, month: 0, day: 0 };
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return { year: 0, month: 0, day: 0 };
            const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            return {
                year: kst.getUTCFullYear(),
                month: kst.getUTCMonth() + 1,
                day: kst.getUTCDate()
            };
        };

        // ISO 문자열을 KST 기준 YYYY-MM-DD 문자열로 변환 (날짜 비교용)
        const toKSTDateStr = (isoString: string): string => {
            if (!isoString) return '';
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return '';
            const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
        };

        // === 현재 달 범위 (stats 계산용) ===
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const currentMonthStartStr = toLocalDateStr(currentMonthStart);
        const currentMonthEndStr = toLocalDateStr(currentMonthEnd);

        // === 전월 범위 ===
        const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        const prevMonthStartStr = toLocalDateStr(prevMonthStart);
        const prevMonthEndStr = toLocalDateStr(prevMonthEnd);
        const prevYearNum = now.getFullYear() - 1;
        const thisYearStartStr = `${now.getFullYear()}-01-01`;
        const prevYearSamePeriodEndStr = toLocalDateStr(new Date(prevYearNum, now.getMonth() + 1, 0));

        const formatChangeRate = (current: number, prev: number): string | null => {
            if (prev > 0) {
                const rate = Math.round(((current - prev) / prev) * 100);
                return `${rate > 0 ? '+' : ''}${rate}%`;
            }
            return null;
        };

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
            .select('id, user_id, submitter_id, company_name, status, progress_details, approval_amount, revenue_amount, created_at, updated_at, inspector_id, manager_id, payment_date, document_type');

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
                    .select('affiliation_id')
                    .eq('user_id', userDbId);

                const myAffIds = (myAffiliations || []).map((a: any) => a.affiliation_id).filter(Boolean);

                if (myAffIds.length > 0) {
                    const { data: affUserLinks } = await supabase
                        .from('user_affiliations')
                        .select('user_id')
                        .in('affiliation_id', myAffIds);
                    const affDbIds = [...new Set((affUserLinks || []).map((a: any) => a.user_id))];
                    if (affDbIds.length > 0) {
                        const { data: affUsers } = await supabase
                            .from('users')
                            .select('user_id')
                            .in('id', affDbIds);
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
                    docsQuery = docsQuery.eq('user_id', 'no_user_found');
                }
            } else {
                // 일반 영업자: 자신이 올린 문서 + submitter_id 문서 + 소개한 영업자의 문서
                const [{ data: submitterDocs }, { data: introducedUsers }] = await Promise.all([
                    supabase.from('documents').select('id').eq('submitter_id', userId),
                    supabase.from('users').select('user_id').eq('introducer', userId),
                ]);
                const submitterIds = (submitterDocs || []).map((d: any) => d.id);
                const introducedUserIds = (introducedUsers || []).map((u: any) => u.user_id);

                const orParts: string[] = [`user_id.eq.${userId}`];
                if (submitterIds.length > 0) orParts.push(`id.in.(${submitterIds.join(',')})`);
                if (introducedUserIds.length > 0) orParts.push(`user_id.in.(${introducedUserIds.join(',')})`);
                docsQuery = docsQuery.or(orParts.join(','));
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

        // Level 4 비대표: 본인 직접 문서만 (승인금액/건수 통계용)
        const ownDocsBase = (userLevel === 4 && !isAffiliationRep)
            ? myDocs.filter(d => d.user_id === userId || d.submitter_id === userId)
            : myDocs;

        // === 현재달 통계 (stats는 항상 현재 달 기준) ===
        // 수수료 계산용: myDocs 전체 (소개받은 영업자 문서 포함)
        const monthlyApprovedForStats = myDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const approvedDateStr = toKSTDateStr(d.updated_at || '');
            return approvedDateStr >= currentMonthStartStr && approvedDateStr <= currentMonthEndStr;
        });

        // ownDocs 기준 이번달 승인 (승인금액/건수/전환율 통계용, 인센티브 문서 제외)
        const ownMonthlyApproved = ownDocsBase.filter(d => {
            if (d.progress_details !== '승인') return false;
            const approvedDateStr = toKSTDateStr(d.updated_at || '');
            return approvedDateStr >= currentMonthStartStr && approvedDateStr <= currentMonthEndStr;
        });

        const totalApprovalAmount = ownMonthlyApproved.reduce((sum, doc) => {
            const amount = doc.approval_amount;
            const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        const totalRevenueAmountRaw = monthlyApprovedForStats.reduce((sum, doc) => {
            const amount = doc.revenue_amount;
            const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        // === Level 4 일반 영업자: 본인이 받는 수수료 계산 ===
        let monthlyRevenueAmount = totalRevenueAmountRaw / 10000;

        if (userLevel === 4 && !isAffiliationRep) {
            // 영업자 정보 조회 (이번달 문서들)
            const statsDocUserIds = [...new Set([
                ...monthlyApprovedForStats.map(d => d.user_id),
                ...monthlyApprovedForStats.map(d => d.submitter_id),
            ].filter(Boolean))];
            let statsUserInfoMap: Record<string, { introducer?: string }> = {};
            if (statsDocUserIds.length > 0) {
                const { data: statsUsersData } = await supabase
                    .from('users')
                    .select('user_id, introducer')
                    .in('user_id', statsDocUserIds);
                for (const u of statsUsersData || []) {
                    statsUserInfoMap[u.user_id] = { introducer: u.introducer };
                }
            }

            // 이번달 본인 수수료 계산
            let monthlyFeeRaw = 0;
            for (const doc of monthlyApprovedForStats) {
                const revenueAmount = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                if (doc.submitter_id === userId) {
                    // 상담신청 A영업자: 20%
                    monthlyFeeRaw += Math.round(revenueAmount * 0.2 * 10) / 10;
                } else if (doc.user_id === userId && !doc.submitter_id) {
                    // 기업등록 영업자: 40%
                    monthlyFeeRaw += Math.round(revenueAmount * 0.4 * 10) / 10;
                } else if (doc.user_id === userId && doc.submitter_id === userId) {
                    // 자신이 작성한 상담신청 (이미 20% 계산됨, 중복 제외)
                    monthlyFeeRaw += 0;
                }
                // 소개자 인센티브: 5%
                const docUserId = doc.submitter_id || doc.user_id;
                const userInfo = statsUserInfoMap[docUserId] || {};
                if (userInfo.introducer === userId) {
                    monthlyFeeRaw += Math.round(revenueAmount * 0.05 * 10) / 10;
                }
            }
            monthlyRevenueAmount = monthlyFeeRaw / 10000;
        }

        const monthlyApprovalAmount = totalApprovalAmount / 10000;

        const ownDocs = ownDocsBase;

        // 이번달 신규 등록 문서 (created_at 기준)
        const thisMonthNewDocs = ownDocs.filter(d => {
            const docDateStr = toKSTDateStr(d.created_at || '');
            return docDateStr >= currentMonthStartStr && docDateStr <= currentMonthEndStr;
        });
        const newRegistrations = thisMonthNewDocs.length;

        // 전환율: 이번달 신규 등록 문서 중 (언제든) 승인된 비율
        const thisMonthNewApproved = thisMonthNewDocs.filter(d => d.progress_details === '승인').length;
        const currentConversionRate = newRegistrations > 0
            ? Math.round((thisMonthNewApproved / newRegistrations) * 100)
            : 0;

        // 전월 전환율: 전월 신규 등록 문서 중 (언제든) 승인된 비율
        const prevMonthNewDocs = ownDocs.filter(d => {
            const docDateStr = toKSTDateStr(d.created_at || '');
            return docDateStr >= prevMonthStartStr && docDateStr <= prevMonthEndStr;
        });
        const prevMonthNewApproved = prevMonthNewDocs.filter(d => d.progress_details === '승인').length;
        const prevMonthConversionRate = prevMonthNewDocs.length > 0
            ? Math.round((prevMonthNewApproved / prevMonthNewDocs.length) * 100)
            : 0;

        const conversionDiff = currentConversionRate - prevMonthConversionRate;
        const conversionChangeRate = (currentConversionRate > 0 || prevMonthConversionRate > 0)
            ? `${conversionDiff > 0 ? '+' : ''}${conversionDiff}%`
            : null;

        // === 요청한 달의 케이스별 매출 정산 데이터 (승인된 날짜 기준) ===
        const monthlyApprovedForSettlement = myDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const approvedDateStr = toKSTDateStr(d.updated_at || '');
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
            const paymentDate = doc.payment_date || toKSTDateStr(doc.updated_at || '');

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
                    fee: Math.round(revenueAmount * 0.2 * 10) / 10,
                    paymentDate,
                    settlementUserId: doc.submitter_id,
                });
                // A영업자의 소개자 → 실제매출의 5%
                if (aInfo.introducer) {
                    settlementData.push({
                        documentId: doc.id,
                        company: doc.company_name || '-',
                        approvalAmount,
                        realSales: revenueAmount,
                        manager: introducerNameMap[aInfo.introducer] || aInfo.introducer,
                        inflow: '인센티브',
                        fee: Math.round(revenueAmount * 0.05 * 10) / 10,
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
                    fee: Math.round(revenueAmount * 0.4 * 10) / 10,
                    paymentDate,
                    settlementUserId: doc.user_id,
                });
                // 영업자의 소개자 → 실제매출의 5%
                if (userInfo.introducer) {
                    settlementData.push({
                        documentId: doc.id,
                        company: doc.company_name || '-',
                        approvalAmount,
                        realSales: revenueAmount,
                        manager: introducerNameMap[userInfo.introducer] || userInfo.introducer,
                        inflow: '인센티브',
                        fee: Math.round(revenueAmount * 0.05 * 10) / 10,
                        paymentDate,
                        settlementUserId: userInfo.introducer,
                    });
                }
            }
        }

        let filteredSettlementData = settlementData;

        if (userLevel === 4 && !isAffiliationRep) {
            // 본인이 수수료를 받는 행 + 본인이 소개자인 인센티브 행 모두 포함
            filteredSettlementData = settlementData.filter((row: any) =>
                row.settlementUserId === userId
            );
        }

        // === 년별 월별 매출 추이 ===
        const yearData: Record<number, Record<number, number>> = {};
        const approvedDocs = myDocs.filter(d => d.progress_details === '승인');
        // 올해 1월~현재달 YTD (누적 매출 계산용)
        const ytdApprovedDocs = approvedDocs.filter(d => {
            const dateStr = toKSTDateStr(d.updated_at || '');
            return dateStr >= thisYearStartStr && dateStr <= currentMonthEndStr;
        });

        // === 누적 매출 계산 (전체 기간) ===
        let totalRevenueAmountForReturn = 0;
        let totalUserInfoMap: Record<string, { introducer?: string }> = {};
        if (userLevel === 4 && !isAffiliationRep) {
            const totalUserIds = [...new Set([
                ...approvedDocs.map(d => d.user_id),
                ...approvedDocs.map(d => d.submitter_id),
            ].filter(Boolean))];
            if (totalUserIds.length > 0) {
                const { data: totalUsersData } = await supabase
                    .from('users')
                    .select('user_id, introducer')
                    .in('user_id', totalUserIds);
                for (const u of totalUsersData || []) {
                    totalUserInfoMap[u.user_id] = { introducer: u.introducer };
                }
            }
            let totalFeeRaw = 0;
            for (const doc of approvedDocs) {
                const revenueAmount = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                if (doc.submitter_id === userId) {
                    totalFeeRaw += Math.round(revenueAmount * 0.2 * 10) / 10;
                } else if (doc.user_id === userId && !doc.submitter_id) {
                    totalFeeRaw += Math.round(revenueAmount * 0.4 * 10) / 10;
                }
                const docUserId = doc.submitter_id || doc.user_id;
                const userInfo = totalUserInfoMap[docUserId] || {};
                if (userInfo.introducer === userId) {
                    totalFeeRaw += Math.round(revenueAmount * 0.05 * 10) / 10;
                }
            }
            totalRevenueAmountForReturn = totalFeeRaw / 10000;
        } else {
            // 나머지 직급: 실제 매출 (전체 기간)
            totalRevenueAmountForReturn = approvedDocs.reduce((sum, doc) => {
                const amount = doc.revenue_amount;
                const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
                return sum + numAmount;
            }, 0) / 10000;
        }

        // === 전월/전년도 매출 계산 (변화율용) ===
        const prevMonthApprovedDocs = approvedDocs.filter(d => {
            const dateStr = toKSTDateStr(d.updated_at || '');
            return dateStr >= prevMonthStartStr && dateStr <= prevMonthEndStr;
        });
        const prevYearApprovedDocs = approvedDocs.filter(d => {
            const dateStr = toKSTDateStr(d.updated_at || '');
            return dateStr >= `${prevYearNum}-01-01` && dateStr <= prevYearSamePeriodEndStr;
        });

        let prevMonthRevenue = 0;
        let prevYearRevenue = 0;
        let ytdRevenue = 0;

        if (userLevel === 4 && !isAffiliationRep) {
            // Level 4 비대표: 수수료 기준
            const allDocUserIds = [...new Set([
                ...approvedDocs.map(d => d.user_id),
                ...approvedDocs.map(d => d.submitter_id),
            ].filter(Boolean))];
            let feeUserInfoMap: Record<string, { introducer?: string }> = {};
            if (allDocUserIds.length > 0) {
                const { data: feeUsersData } = await supabase
                    .from('users').select('user_id, introducer').in('user_id', allDocUserIds);
                for (const u of feeUsersData || []) {
                    feeUserInfoMap[u.user_id] = { introducer: u.introducer };
                }
            }
            const calcFee = (docs: any[]) => {
                let fee = 0;
                for (const doc of docs) {
                    const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                    if (doc.submitter_id === userId) fee += Math.round(rev * 0.2 * 10) / 10;
                    else if (doc.user_id === userId && !doc.submitter_id) fee += Math.round(rev * 0.4 * 10) / 10;
                    const docUserId = doc.submitter_id || doc.user_id;
                    if ((feeUserInfoMap[docUserId] || {}).introducer === userId) fee += Math.round(rev * 0.05 * 10) / 10;
                }
                return fee / 10000;
            };
            prevMonthRevenue = calcFee(prevMonthApprovedDocs);
            prevYearRevenue = calcFee(prevYearApprovedDocs);
            ytdRevenue = calcFee(ytdApprovedDocs);
        } else {
            const sumRevenue = (docs: any[]) => docs.reduce((sum, doc) => {
                const amt = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                return sum + amt;
            }, 0) / 10000;
            prevMonthRevenue = sumRevenue(prevMonthApprovedDocs);
            prevYearRevenue = sumRevenue(prevYearApprovedDocs);
            ytdRevenue = sumRevenue(ytdApprovedDocs);
        }

        const prevMonthChangeRate = formatChangeRate(monthlyRevenueAmount, prevMonthRevenue);
        // 전년도 대비: 올해 YTD vs 작년 동일 기간 비교
        const prevYearChangeRate = formatChangeRate(ytdRevenue, prevYearRevenue);

        approvedDocs.forEach(doc => {
            // updated_at 기준 연도/월 추출 (승인날짜)
            if (!doc.updated_at) return;
            const { year, month } = extractYearMonthDay(doc.updated_at || '');
            const revenueAmount = typeof doc.revenue_amount === 'string'
                ? (parseInt(doc.revenue_amount) || 0)
                : Number(doc.revenue_amount) || 0;

            let chartAmount = revenueAmount;
            if (userLevel === 4 && !isAffiliationRep) {
                let fee = 0;
                if (doc.submitter_id === userId) {
                    fee = Math.round(revenueAmount * 0.2 * 10) / 10;
                } else if (doc.user_id === userId && !doc.submitter_id) {
                    fee = Math.round(revenueAmount * 0.4 * 10) / 10;
                }
                const docUserId = doc.submitter_id || doc.user_id;
                if ((totalUserInfoMap[docUserId] || {}).introducer === userId) {
                    fee += Math.round(revenueAmount * 0.05 * 10) / 10;
                }
                chartAmount = fee;
            }

            if (year > 0 && month > 0) {
                if (!yearData[year]) yearData[year] = {};
                yearData[year][month] = (yearData[year][month] || 0) + chartAmount;
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
                monthlyApprovedCount: ownMonthlyApproved.length,
                newRegistrations,
                conversionRate: currentConversionRate,
                totalApprovedCount: ownDocs.filter(d => d.progress_details === '승인').length,
                totalApprovalAmount: ownDocs
                    .filter(d => d.progress_details === '승인')
                    .reduce((sum, doc) => {
                        const amount = doc.approval_amount;
                        const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
                        return sum + numAmount;
                    }, 0) / 10000,
                totalRevenueAmount: totalRevenueAmountForReturn,
                prevMonthChangeRate,
                prevYearChangeRate,
                conversionChangeRate,
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
