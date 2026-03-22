import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROGRESS_STAGES = ['상담신청', '서류요청', '분석', '심사', '진행', '승인요청', '승인'];
const STATUS_LIST = ['정상', '보완', '보류', '검수'];

// 로그에서 필요한 컬럼만
const LOG_COLUMNS = 'id,document_id,document_title,company_name,action_type,actor_id,actor_name,old_value,new_value,created_at,staff_read,submitter_id,submitter_name';

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

        const { searchParams } = new URL(request.url);
        const month = searchParams.get('month');
        const chartOnly = searchParams.get('chart_only') === 'true';

        // 유저 정보 + 문서 + 로그 + 영업자 최대한 병렬로
        const userPromise = supabase
            .from('users')
            .select('id, user_id, position_id, company_name, is_affiliation_representative, position(level)')
            .eq('user_id', userId)
            .single();

        // chart_only 모드에서는 로그 조회 스킵
        const logsPromise = chartOnly
            ? Promise.resolve({ data: [] })
            : supabase.from('document_logs')
                .select(LOG_COLUMNS)
                .order('created_at', { ascending: false })
                .limit(200);

        // 1단계: 유저 + 로그 조회
        const [userResult, logsResult] = await Promise.all([
            userPromise,
            logsPromise
        ]);

        const user = userResult.data;
        const userLevel = (user as any)?.position?.level || 0;
        const userDbId = user?.id || 0;
        const userCompanyName = user?.company_name || '';
        const isRep = user?.is_affiliation_representative || false;

        // 유효하지 않은 역할이면 차단
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        let allLogs = logsResult.data || [];
        let myDocs: any[] = [];

        // 2단계: 권한별로 필터링된 문서 조회
        let docsQuery = supabase.from('documents')
            .select('id, user_id, status, progress_details, approval_amount, revenue_amount, created_at, updated_at, inspector_id, manager_id');

        if (userLevel === 2) {
            // 대표실무자: admin 제외
            docsQuery = docsQuery.neq('manager_id', 'admin');
        } else if (userLevel === 3) {
            // 실무자: manager_id로 배정받은 문서만
            docsQuery = docsQuery.eq('manager_id', userId);
        } else if (userLevel === 4) {
            if (isRep) {
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
                // 일반 영업자: 자신의 문서 + submitter_id 문서
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
            // 검수자: 소속이 같은 영업자의 문서 + inspector_id로 배정받은 문서
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

            // inspector_id로 직접 배정받은 문서도 포함
            const { data: assignedDocs } = await supabase
                .from('documents')
                .select('id')
                .eq('inspector_id', userId);
            const assignedDocIds = (assignedDocs || []).map((d: any) => d.id);

            if (allowedUserIds.length > 0 || assignedDocIds.length > 0) {
                // 소속 기반 user_id 필터 + inspector_id 배정 문서 OR 조건
                const conditions: string[] = [];
                if (allowedUserIds.length > 0) {
                    conditions.push(`user_id.in.(${allowedUserIds.join(',')})`);
                }
                if (assignedDocIds.length > 0) {
                    conditions.push(`id.in.(${assignedDocIds.join(',')})`);
                }
                docsQuery = docsQuery.or(conditions.join(','));
            } else {
                docsQuery = docsQuery.eq('user_id', 'no_user_found');
            }
        }
        // Level 1: 모든 문서 (필터 적용 안 함)

        const docsResult = await docsQuery;
        myDocs = docsResult.data || [];
        const allowedDocIds = new Set(myDocs.map(d => d.id));

        // 로그 권한 필터링
        allLogs = allLogs.filter(log => allowedDocIds.has(log.document_id));

        // === 날짜 계산 ===
        const now = new Date();
        const toLocalDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const firstDayStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
        const lastDayStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

        // === 진행상황 차트 (chartOnly에서도 필요) ===
        const chartMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [cYear, cMonth] = chartMonth.split('-');
        const filteredDocs = myDocs.filter((doc: any) => {
            if (!doc.created_at) return false;
            const docDate = new Date(doc.created_at);
            return docDate.getFullYear() === parseInt(cYear) &&
                   docDate.getMonth() + 1 === parseInt(cMonth);
        });

        const progressData = {
            stage: {
                labels: PROGRESS_STAGES,
                datasets: [{
                    label: '진행단계',
                    data: PROGRESS_STAGES.map(stage =>
                        filteredDocs.filter(d => d.progress_details === stage).length
                    ),
                    backgroundColor: ['#b0b9c6', '#f2e7a2', '#d8c9f1', '#e0b0ff', '#82cbc4', '#ffd6a5', '#a0c4ff'],
                    borderColor: ['#8a9aaa', '#e8d670', '#c9a5e8', '#c990e8', '#5ca9a0', '#ffb873', '#7aacff'],
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            status: {
                labels: STATUS_LIST,
                datasets: [{
                    label: '상태',
                    data: STATUS_LIST.map(status =>
                        filteredDocs.filter(d => d.status === status).length
                    ),
                    backgroundColor: ['#a5d6a7', '#ffd6a5', '#ffadad', '#90caf9'],
                    borderColor: ['#66bb6a', '#ffb873', '#ff8b8b', '#42a5f5'],
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            }
        };

        // chart_only 모드: 차트 데이터만 반환 (로그, 영업자, 통계 스킵)
        if (chartOnly) {
            return NextResponse.json({ progressData });
        }

        // === 영업자 목록 (level 1, 2만) ===
        let salesData: any[] = [];
        if (userLevel === 1 || userLevel === 2) {
            const { data: salespeople } = await supabase
                .from('users')
                .select('user_id, name')
                .eq('position_id', 4);

            if (salespeople && salespeople.length > 0) {
                const salesUserIds = new Set(salespeople.map((p: any) => p.user_id));
                const salesDocs = myDocs.filter(d => salesUserIds.has(d.user_id));
                const docsByUser: Record<string, any[]> = {};
                for (const doc of salesDocs) {
                    if (!docsByUser[doc.user_id]) docsByUser[doc.user_id] = [];
                    docsByUser[doc.user_id].push(doc);
                }
                salesData = salespeople.map((person: any) => {
                    const userDocs = docsByUser[person.user_id] || [];

                    const monthlyDocs = userDocs.filter(d => {
                        const date = d.created_at?.substring(0, 10) || '';
                        return date >= firstDayStr && date <= lastDayStr;
                    });

                    const monthlyApprovedDocs = userDocs.filter(d =>
                        d.progress_details === '승인' &&
                        d.updated_at >= firstDayStr &&
                        d.updated_at <= lastDayStr + 'T23:59:59'
                    );

                    const approvedCount = monthlyApprovedDocs.length;
                    const registrationCount = monthlyDocs.length;

                    const totalApproval = monthlyApprovedDocs.reduce((sum, d) => {
                        const amt = typeof d.approval_amount === 'string' ? (parseInt(d.approval_amount) || 0) : Number(d.approval_amount) || 0;
                        return sum + amt;
                    }, 0);

                    const eok = Math.floor(totalApproval / 10000);
                    const man = Math.round((totalApproval % 10000) / 1000);
                    let amountStr = '-';
                    if (totalApproval > 0) {
                        if (eok > 0) amountStr = man > 0 ? `${eok}억 ${man}천만원` : `${eok}억원`;
                        else amountStr = `${Math.round(totalApproval / 1000)}천만원`;
                    }

                    return {
                        userId: person.user_id,
                        name: person.name,
                        registrations: registrationCount,
                        inProgress: userDocs.filter(d => d.progress_details === '진행').length,
                        approved: approvedCount,
                        rejected: userDocs.filter(d => d.status === '보류').length,
                        approvalAmount: amountStr,
                        approvalAmountRaw: totalApproval,
                        conversionRate: registrationCount > 0 ? `${Math.round((approvedCount / registrationCount) * 100)}%` : '-'
                    };
                });
            }
        }

        // === 통계 계산 ===
        const todayStr = toLocalDateStr(now);

        const inProgressToday = myDocs.filter(d =>
            d.progress_details === '진행' && d.updated_at >= todayStr
        ).length;

        const monthlyApproved = myDocs.filter(d =>
            d.progress_details === '승인' &&
            d.updated_at >= firstDayStr &&
            d.updated_at <= lastDayStr + 'T23:59:59'
        );
        const totalApprovalAmount = monthlyApproved.reduce((sum, doc) => {
            const amount = doc.approval_amount;
            const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        const newRegistrations = myDocs.filter(d =>
            d.created_at >= firstDayStr &&
            d.created_at <= lastDayStr + 'T23:59:59'
        ).length;

        // === 로그 분류 (각 50개씩) ===
        const revisionLogs: any[] = [];
        const memoLogs: any[] = [];
        for (const log of allLogs) {
            if (log.action_type === 'status_change' && ['보완', '보류'].includes(log.new_value)) {
                if (revisionLogs.length < 50) revisionLogs.push(log);
            } else if (
                ['memo_add', 'memo_delete', 'progress_details_change', 'manager_assigned', 'salesperson_assigned'].includes(log.action_type) ||
                (log.action_type === 'status_change' && ['정상', '검수'].includes(log.new_value))
            ) {
                if (memoLogs.length < 50) memoLogs.push(log);
            }
            if (revisionLogs.length >= 50 && memoLogs.length >= 50) break;
        }

        return NextResponse.json({
            stats: {
                inProgressCount: inProgressToday,
                approvalAmount: Math.round(totalApprovalAmount / 10000 * 10) / 10,
                monthlyRevenue: Math.round(monthlyApproved.reduce((sum, doc) => {
                    const amount = doc.revenue_amount;
                    const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
                    return sum + numAmount;
                }, 0) / 10000 * 10) / 10,
                newRegistrations,
                approvedCount: monthlyApproved.length
            },
            revisionLogs,
            memoLogs,
            salesData,
            progressData,
            currentUserId: userId,
            userLevel,
            isRepresentative: isRep,
            companyName: userCompanyName
        });
    } catch (error) {
        console.error('홈 데이터 조회 실패:', error);
        return NextResponse.json({ error: '홈 데이터 조회 실패' }, { status: 500 });
    }
}
