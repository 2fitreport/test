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

        // 소속대표의 실제 소속원 user_id 목록 (인센티브 필터링용, 문서 여부와 무관)
        let affMemberUserIds = new Set<string>();

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
                        // 소속원 ID 저장 (인센티브 필터링용)
                        affMemberUserIds = new Set(affUserIds);
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
            // 검수자: 소속이 같은 영업자의 문서 + inspector_id로 직접 배정받은 문서
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

            // inspector_id로 직접 배정받은 문서도 포함 (홈과 동일)
            const { data: assignedDocs } = await supabase
                .from('documents')
                .select('id')
                .eq('inspector_id', userId);
            const assignedDocIds = (assignedDocs || []).map((d: any) => d.id);

            if (allowedUserIds.length > 0 || assignedDocIds.length > 0) {
                const conditions: string[] = [];
                if (allowedUserIds.length > 0) conditions.push(`user_id.in.(${allowedUserIds.join(',')})`);
                if (assignedDocIds.length > 0) conditions.push(`id.in.(${assignedDocIds.join(',')})`);
                docsQuery = docsQuery.or(conditions.join(','));
            } else {
                docsQuery = docsQuery.eq('user_id', 'no_user_found');
            }
        }
        // Level 1: 모든 문서 (필터 적용 안 함)

        const docsResult = await docsQuery;
        const myDocs = docsResult.data || [];

        // 소속대표: 소속원이 소개자인 다른 소속 영업자의 승인 문서 (인센티브 5% 계산용)
        let externalIncentiveDocs: any[] = [];
        const externalDocIntroMap: Record<string, string> = {}; // docId → 소속원 소개자 userId
        const affMemberNameMap: Record<string, string> = {}; // 소속원 userId → name

        if (userLevel === 4 && isAffiliationRep && affMemberUserIds.size > 0) {
            const { data: introducedUsersRaw } = await supabase
                .from('users')
                .select('user_id, introducer')
                .in('introducer', [...affMemberUserIds]);

            const { data: affMemberNamesData } = await supabase
                .from('users')
                .select('user_id, name')
                .in('user_id', [...affMemberUserIds]);
            for (const u of affMemberNamesData || []) {
                affMemberNameMap[u.user_id] = u.name;
            }

            // 다른 소속 영업자만 (소속원 자신은 제외)
            const otherAffUsers = (introducedUsersRaw || []).filter((u: any) => !affMemberUserIds.has(u.user_id));
            const otherAffUserIds = otherAffUsers.map((u: any) => u.user_id);
            const otherUserIntroMap: Record<string, string> = {};
            for (const u of otherAffUsers) {
                otherUserIntroMap[u.user_id] = u.introducer;
            }

            if (otherAffUserIds.length > 0) {
                const myDocIds = new Set(myDocs.map((d: any) => d.id));
                const [{ data: submitterDocs }, { data: userOwnDocs }] = await Promise.all([
                    supabase.from('documents')
                        .select('id, user_id, submitter_id, revenue_amount, updated_at, payment_date, company_name, progress_details')
                        .in('submitter_id', otherAffUserIds)
                        .eq('progress_details', '승인'),
                    supabase.from('documents')
                        .select('id, user_id, submitter_id, revenue_amount, updated_at, payment_date, company_name, progress_details')
                        .in('user_id', otherAffUserIds)
                        .is('submitter_id', null)
                        .eq('progress_details', '승인'),
                ]);
                const allExternal = [...(submitterDocs || []), ...(userOwnDocs || [])];
                externalIncentiveDocs = allExternal.filter((d: any) => !myDocIds.has(d.id));
                for (const doc of externalIncentiveDocs) {
                    const docUserId = doc.submitter_id || doc.user_id;
                    if (otherUserIntroMap[docUserId]) {
                        externalDocIntroMap[doc.id] = otherUserIntroMap[docUserId];
                    }
                }
            }
        }

        // Level 4 비대표: 본인 직접 문서만 (승인금액/건수 통계용)
        const ownDocsBase = (userLevel === 4 && !isAffiliationRep)
            ? myDocs.filter(d => d.user_id === userId || d.submitter_id === userId)
            : myDocs;

        // === Level 4 소속대표: 소속 영업자 지급수수료 합산용 사용자 정보 조회 ===
        const affUserInfoMap: Record<string, { introducer?: string }> = {};
        if (userLevel === 4 && isAffiliationRep) {
            const affDocUserIds = [...new Set([
                ...myDocs.map(d => d.user_id),
                ...myDocs.map(d => d.submitter_id),
            ].filter(Boolean))];
            if (affDocUserIds.length > 0) {
                const { data: affUsersData } = await supabase
                    .from('users')
                    .select('user_id, introducer')
                    .in('user_id', affDocUserIds);
                for (const u of affUsersData || []) {
                    affUserInfoMap[u.user_id] = { introducer: u.introducer };
                }
            }
        }

        // 소속대표: 소속 영업자 전체 지급수수료 합산 헬퍼 (소속원에게 귀속되는 수수료만)
        const calcAffilFee = (docs: any[]) => {
            let fee = 0;
            for (const doc of docs) {
                const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                if (doc.submitter_id) {
                    // 상담요청: submitter가 소속원일 때만 20%
                    if (affMemberUserIds.has(doc.submitter_id)) {
                        fee += Math.round(rev * 0.2 * 10) / 10;
                    }
                    const intro = (affUserInfoMap[doc.submitter_id] || {}).introducer;
                    if (intro && affMemberUserIds.has(intro)) {
                        fee += Math.round(rev * 0.05 * 10) / 10;
                    }
                } else {
                    // 기업등록: user_id는 항상 소속원 (docsQuery 필터 보장)
                    fee += Math.round(rev * 0.4 * 10) / 10;
                    const intro = (affUserInfoMap[doc.user_id] || {}).introducer;
                    if (intro && affMemberUserIds.has(intro)) {
                        fee += Math.round(rev * 0.05 * 10) / 10;
                    }
                }
            }
            return fee;
        };

        // === 현재달 통계 (stats는 항상 현재 달 기준 - 사용자 요청) ===
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

        // === Level 4 영업자: 상단 대시보드 수수료 일치 로직 ===
        let monthlyRevenueAmount = totalRevenueAmountRaw;

        if (userLevel === 4) {
            // 이번 달(현재 월) 기준의 정산 데이터를 미리 계산하여 상단 대시보드와 맞춤
            const currentMonthSettlement = []; // 이번달 정산행들
            
            // 영업자 정보 조회 (이번달 문서들 기준)
            const statsDocUserIds = [...new Set([
                ...monthlyApprovedForStats.map(d => d.user_id),
                ...monthlyApprovedForStats.map(d => d.submitter_id),
            ].filter(Boolean))];
            const statsUserInfoMap: Record<string, { introducer?: string }> = {};
            if (statsDocUserIds.length > 0) {
                const { data: statsUsersData } = await supabase
                    .from('users').select('user_id, introducer').in('user_id', statsDocUserIds);
                for (const u of statsUsersData || []) {
                    statsUserInfoMap[u.user_id] = { introducer: u.introducer };
                }
            }

            let currentMonthFeeSum = 0;
            for (const doc of monthlyApprovedForStats) {
                const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                
                if (isAffiliationRep) {
                    // 소속대표: 소속원들의 수수료 합산
                    if (doc.submitter_id && affMemberUserIds.has(doc.submitter_id)) {
                        currentMonthFeeSum += Math.round(rev * 0.2 * 10) / 10;
                    }
                    const intro = (statsUserInfoMap[doc.submitter_id || doc.user_id] || {}).introducer;
                    if (intro && affMemberUserIds.has(intro)) {
                        currentMonthFeeSum += Math.round(rev * 0.05 * 10) / 10;
                    }
                    if (!doc.submitter_id && affMemberUserIds.has(doc.user_id)) {
                        currentMonthFeeSum += Math.round(rev * 0.4 * 10) / 10;
                    }
                } else {
                    // 일반 영업자: 본인 수수료
                    if (doc.submitter_id === userId) {
                        currentMonthFeeSum += Math.round(rev * 0.2 * 10) / 10;
                    } else if (doc.user_id === userId && !doc.submitter_id) {
                        currentMonthFeeSum += Math.round(rev * 0.4 * 10) / 10;
                    }
                    const docUserId = doc.submitter_id || doc.user_id;
                    if (statsUserInfoMap[docUserId]?.introducer === userId) {
                        currentMonthFeeSum += Math.round(rev * 0.05 * 10) / 10;
                    }
                }
            }
            
            // 외부 도입 인센티브 (소속대표 전용)
            if (isAffiliationRep) {
                const externalMonthly = externalIncentiveDocs.filter(d => {
                    const dateStr = toKSTDateStr(d.updated_at || '');
                    return dateStr >= currentMonthStartStr && dateStr <= currentMonthEndStr;
                });
                for (const doc of externalMonthly) {
                    const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                    currentMonthFeeSum += Math.round(rev * 0.05 * 10) / 10;
                }
            }

            monthlyRevenueAmount = currentMonthFeeSum;
        }

        const monthlyApprovalAmount = totalApprovalAmount;

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
        const userInfoMap: Record<string, { name: string; introducer?: string }> = {};
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
        const introducerNameMap: Record<string, string> = {};
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
                // 상담요청 케이스: A영업자(submitter_id) 20%, B영업자(user_id) 0%
                const aInfo = userInfoMap[doc.submitter_id] || {};
                settlementData.push({
                    documentId: doc.id,
                    company: doc.company_name || '-',
                    approvalAmount,
                    realSales: revenueAmount,
                    manager: aInfo.name || doc.submitter_id,
                    inflow: '상담요청',
                    fee: Math.round(revenueAmount * 0.2 * 10) / 10,
                    paymentDate,
                    settlementUserId: doc.submitter_id,
                });
                // A영업자의 소개자 → 실제매출의 5%
                if (aInfo.introducer) {
                    settlementData.push({
                        documentId: doc.id,
                        company: isAffiliationRep ? (doc.company_name || '-') : '외부도입원',
                        approvalAmount: '-',
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
                        company: isAffiliationRep ? (doc.company_name || '-') : '외부도입원',
                        approvalAmount: '-',
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

        // 소속대표: 다른 소속 영업자 문서에서 소속원 인센티브(5%) 행 추가
        if (isAffiliationRep && externalIncentiveDocs.length > 0) {
            const externalSettlementDocs = externalIncentiveDocs.filter(d => {
                const dateStr = toKSTDateStr(d.updated_at || '');
                return dateStr >= targetMonthStartStr && dateStr <= targetMonthEndStr;
            });
            for (const doc of externalSettlementDocs) {
                const revenueAmount = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                const paymentDate = doc.payment_date || toKSTDateStr(doc.updated_at || '');
                const introducerId = externalDocIntroMap[doc.id];
                if (introducerId) {
                    settlementData.push({
                        documentId: doc.id,
                        company: doc.company_name || '-',
                        approvalAmount: '-',
                        realSales: revenueAmount,
                        manager: affMemberNameMap[introducerId] || introducerId,
                        inflow: '인센티브',
                        fee: Math.round(revenueAmount * 0.05 * 10) / 10,
                        paymentDate,
                        settlementUserId: introducerId,
                    });
                }
            }
        }

        let filteredSettlementData = settlementData;

        if (userLevel === 4) {
            if (isAffiliationRep) {
                // 소속대표: 소속원에게 귀속되는 수수료만 포함 (인센티브 포함)
                filteredSettlementData = settlementData.filter((row: any) =>
                    affMemberUserIds.has(row.settlementUserId)
                );
            } else {
                // 일반 영업자: 본인이 수수료를 받는 행만
                filteredSettlementData = settlementData.filter((row: any) =>
                    row.settlementUserId === userId
                );
            }
        }

        // level 4인 경우 settlement 테이블의 fee 합계로 monthlyRevenueAmount 일치 (선택한 월 기준)
        if (userLevel === 4) {
            const settlementMonthlyFee = filteredSettlementData.reduce((sum, row) => {
                const fee = typeof row.fee === 'number' ? row.fee : 0;
                return sum + fee;
            }, 0);
            monthlyRevenueAmount = settlementMonthlyFee; // 만원 단위 그대로
        }

        // === 년별 월별 매출 추이 ===
        const yearData: Record<number, Record<number, number>> = {};
        const approvedDocs = myDocs.filter(d => d.progress_details === '승인');
        // 올해 1월~현재달 YTD (누적 매출 계산용)
        const ytdApprovedDocs = approvedDocs.filter(d => {
            const dateStr = toKSTDateStr(d.updated_at || '');
            return dateStr >= thisYearStartStr && dateStr <= currentMonthEndStr;
        });

        // === 누적 매출 계산은 feeUserInfoMap 로드 후 계산 ===
        const allApprovedDocs = myDocs.filter(d => d.progress_details === '승인');
        let totalRevenueAmountForReturn = 0;

        // level 4 isAffiliationRep: calculated later (after extIncentive)
        // non-level-4: calculate now
        if (userLevel !== 4) {
            totalRevenueAmountForReturn = allApprovedDocs.reduce((sum, doc) => {
                const amt = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                return sum + amt;
            }, 0);
        }
        // level 4 !isAffiliationRep: calculated after feeUserInfoMap is populated

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
        const feeUserInfoMap: Record<string, { introducer?: string }> = {};

        if (userLevel === 4 && !isAffiliationRep) {
            // Level 4 비대표: 수수료 기준
            const allDocUserIds = [...new Set([
                ...approvedDocs.map(d => d.user_id),
                ...approvedDocs.map(d => d.submitter_id),
            ].filter(Boolean))];
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
                return fee;
            };
            prevMonthRevenue = calcFee(prevMonthApprovedDocs);
            prevYearRevenue = calcFee(prevYearApprovedDocs);
            ytdRevenue = calcFee(ytdApprovedDocs);
            // 누적 매출 (feeUserInfoMap 로드 후 계산)
            totalRevenueAmountForReturn = calcFee(allApprovedDocs);
        } else if (userLevel === 4 && isAffiliationRep) {
            const calcExtIncentive = (docs: any[]) =>
                docs.reduce((sum, doc) => {
                    const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                    return sum + Math.round(rev * 0.05 * 10) / 10;
                }, 0);

            const extPrevMonth = externalIncentiveDocs.filter(d => {
                const dateStr = toKSTDateStr(d.updated_at || '');
                return dateStr >= prevMonthStartStr && dateStr <= prevMonthEndStr;
            });
            const extPrevYear = externalIncentiveDocs.filter(d => {
                const dateStr = toKSTDateStr(d.updated_at || '');
                return dateStr >= `${prevYearNum}-01-01` && dateStr <= prevYearSamePeriodEndStr;
            });
            const extYtd = externalIncentiveDocs.filter(d => {
                const dateStr = toKSTDateStr(d.updated_at || '');
                return dateStr >= thisYearStartStr && dateStr <= currentMonthEndStr;
            });

            prevMonthRevenue = calcAffilFee(prevMonthApprovedDocs) + calcExtIncentive(extPrevMonth);
            prevYearRevenue = calcAffilFee(prevYearApprovedDocs) + calcExtIncentive(extPrevYear);
            ytdRevenue = calcAffilFee(ytdApprovedDocs) + calcExtIncentive(extYtd);
            // 누적 매출에도 외부 인센티브 전체 합산
            totalRevenueAmountForReturn = calcAffilFee(allApprovedDocs) + calcExtIncentive(externalIncentiveDocs);
        } else {
            const sumRevenue = (docs: any[]) => docs.reduce((sum, doc) => {
                const amt = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                return sum + amt;
            }, 0);
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
                if ((feeUserInfoMap[docUserId] || {}).introducer === userId) {
                    fee += Math.round(revenueAmount * 0.05 * 10) / 10;
                }
                chartAmount = fee;
            } else if (userLevel === 4 && isAffiliationRep) {
                let fee = 0;
                if (doc.submitter_id) {
                    fee = Math.round(revenueAmount * 0.2 * 10) / 10;
                    const intro = (affUserInfoMap[doc.submitter_id] || {}).introducer;
                    if (intro && affMemberUserIds.has(intro)) {
                        fee += Math.round(revenueAmount * 0.05 * 10) / 10;
                    }
                } else {
                    fee = Math.round(revenueAmount * 0.4 * 10) / 10;
                    const intro = (affUserInfoMap[doc.user_id] || {}).introducer;
                    if (intro && affMemberUserIds.has(intro)) {
                        fee += Math.round(revenueAmount * 0.05 * 10) / 10;
                    }
                }
                chartAmount = fee;
            }

            if (year > 0 && month > 0) {
                if (!yearData[year]) yearData[year] = {};
                yearData[year][month] = (yearData[year][month] || 0) + chartAmount;
            }
        });

        // 소속대표: 다른 소속 영업자 문서의 소속원 인센티브를 차트에 반영
        if (userLevel === 4 && isAffiliationRep) {
            for (const doc of externalIncentiveDocs) {
                if (!doc.updated_at) continue;
                const { year, month } = extractYearMonthDay(doc.updated_at || '');
                const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                if (year > 0 && month > 0) {
                    if (!yearData[year]) yearData[year] = {};
                    yearData[year][month] = (yearData[year][month] || 0) + Math.round(rev * 0.05 * 10) / 10;
                }
            }
        }

        // 선택된 연도의 월별 데이터 추출 (월별 기준, 억원 단위)
        const monthlyRevenues = Array.from({ length: 12 }, (_, i) => {
            const raw = yearData[targetYear]?.[i + 1] || 0;
            return Math.round((raw / 10000) * 10000) / 10000;
        });

        // 이전년도 데이터 추출 (월별 기준, 전년도 비교용)
        const previousYearMonthlyRevenues = Array.from({ length: 12 }, (_, i) => {
            const raw = yearData[targetYear - 1]?.[i + 1] || 0;
            return Math.round((raw / 10000) * 10000) / 10000;
        });

        // 선택된 연도의 합계 (승인금액, 실제매출, 지급수수료)
        // targetYear 기준 승인 문서 필터링
        const yearlyApprovedDocs = approvedDocs.filter(d => {
            const { year } = extractYearMonthDay(d.updated_at || '');
            return year === targetYear;
        });

        // 승인금액 (중복 제거)
        const seenYearlyApproval = new Set<number>();
        let yearlyApprovalAmount = 0;
        for (const doc of yearlyApprovedDocs) {
            if (!seenYearlyApproval.has(doc.id)) {
                seenYearlyApproval.add(doc.id);
                const amount = typeof doc.approval_amount === 'string' ? (parseInt(doc.approval_amount) || 0) : Number(doc.approval_amount) || 0;
                yearlyApprovalAmount += amount;
            }
        }

        // 실제매출 (중복 제거)
        const seenYearlyRealSales = new Set<number>();
        let yearlyRealSales = 0;
        for (const doc of yearlyApprovedDocs) {
            if (!seenYearlyRealSales.has(doc.id)) {
                seenYearlyRealSales.add(doc.id);
                const amount = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                yearlyRealSales += amount;
            }
        }

        // 지급수수료: yearData[targetYear]에 이미 역할별로 정확히 계산되어 있음 (만원 단위)
        // (소속대표 외부 인센티브도 이미 yearData에 포함됨)
        const yearlyFee = Object.values(yearData[targetYear] || {}).reduce((sum, val) => sum + val, 0);

        const revenueChartData = {
            labels: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
            currentYearData: monthlyRevenues,
            previousYearData: previousYearMonthlyRevenues,
            currentMonth: now.getMonth() + 1,
            currentYear: now.getFullYear(),
            selectedYear: targetYear,
            yearlyApprovalAmount,
            yearlyRealSales,
            yearlyFee
        };

        // 대표자의 모든 지급수수료 합계 (모든 건)
        const totalFeeAmount = filteredSettlementData.reduce((sum, row) => {
            const fee = typeof row.fee === 'number' ? row.fee : 0;
            return sum + fee;
        }, 0);

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
                    }, 0),
                totalRevenueAmount: totalRevenueAmountForReturn,
                totalFeeAmount: totalFeeAmount,
                prevMonthChangeRate,
                prevYearChangeRate,
                conversionChangeRate,
            },
            settlementData: filteredSettlementData,
            revenueChartData,
            userLevel,
            isAffiliationRep,
            currentUserId: userId,
        });
    } catch (error) {
        console.error('성과정산 데이터 조회 실패:', error);
        return NextResponse.json({ error: '성과정산 데이터 조회 실패' }, { status: 500 });
    }
}
