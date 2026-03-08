import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROGRESS_STAGES = ['상담', '서류요청', '분석', '심사', '진행', '승인요청', '승인'];
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

        // 유저 정보 + 문서 + 로그 + 영업자 최대한 병렬로
        const userPromise = supabase
            .from('users')
            .select('id, user_id, position_id, company_name, is_affiliation_representative')
            .eq('user_id', userId)
            .single();

        const docsPromise = supabase.from('documents')
            .select('id, user_id, status, progress_details, approval_amount, created_at, updated_at, inspector_id');

        const logsPromise = supabase.from('document_logs')
            .select(LOG_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(200);

        // 1단계: 유저 + 문서 + 로그 동시 조회
        const [userResult, docsResult, logsResult] = await Promise.all([
            userPromise,
            docsPromise,
            logsPromise
        ]);

        const user = userResult.data;
        const userLevel = user?.position_id || 0;
        const userDbId = user?.id || 0;
        const userCompanyName = user?.company_name || '';
        const isRep = user?.is_affiliation_representative || false;

        const allDocs = docsResult.data || [];
        let allLogs = logsResult.data || [];

        // 권한 필터링 (JS에서 처리 - 추가 DB 호출 최소화)
        let myDocs = allDocs;
        let allowedDocIds: Set<number> | null = null;

        if (userLevel === 4) {
            myDocs = allDocs.filter(d => d.user_id === userId);
            allowedDocIds = new Set(myDocs.map(d => d.id));
        } else if (userLevel === 6) {
            // 검수자: 소속 조회 필요
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

            const allowedUserSet = new Set(allowedUserIds);
            myDocs = allDocs.filter(d =>
                allowedUserSet.has(d.user_id) || d.inspector_id === userId
            );
            allowedDocIds = new Set(myDocs.map(d => d.id));
        }

        // 로그 권한 필터링
        if (allowedDocIds !== null) {
            allLogs = allLogs.filter(log => allowedDocIds!.has(log.document_id));
        }

        // 영업자 목록 (별도 쿼리 - 필요한 경우만)
        let salesData: any[] = [];
        if (userLevel === 1 || userLevel === 2 || userLevel === 4) {
            let salesQuery = supabase.from('users').select('user_id, name').eq('position_id', 4);
            if (userLevel === 4) {
                if (isRep && userCompanyName) {
                    salesQuery = salesQuery.eq('company_name', userCompanyName);
                } else {
                    salesQuery = salesQuery.eq('user_id', userId);
                }
            }
            const { data: salespeople } = await salesQuery;

            if (salespeople && salespeople.length > 0) {
                const salesUserIds = new Set(salespeople.map((p: any) => p.user_id));
                const salesDocs = allDocs.filter(d => salesUserIds.has(d.user_id));
                const docsByUser: Record<string, any[]> = {};
                for (const doc of salesDocs) {
                    if (!docsByUser[doc.user_id]) docsByUser[doc.user_id] = [];
                    docsByUser[doc.user_id].push(doc);
                }
                salesData = salespeople.map((person: any) => {
                    const userDocs = docsByUser[person.user_id] || [];
                    const approved = userDocs.filter(d => d.progress_details === '승인').length;
                    return {
                        userId: person.user_id,
                        name: person.name,
                        registrations: userDocs.length,
                        inProgress: userDocs.filter(d => d.progress_details === '진행').length,
                        approved,
                        rejected: userDocs.filter(d => d.status === '보류').length,
                        approvalAmount: '-',
                        conversionRate: userDocs.length > 0 ? `${Math.round((approved / userDocs.length) * 100)}%` : '-'
                    };
                });
            }
        }

        // === 통계 계산 ===
        const now = new Date();
        const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDayStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const inProgressToday = myDocs.filter(d =>
            d.progress_details === '진행' && d.updated_at >= todayStr
        ).length;
        const inProgressYesterday = myDocs.filter(d =>
            d.progress_details === '진행' &&
            d.updated_at >= yesterdayStr + 'T00:00:00' &&
            d.updated_at < todayStr + 'T00:00:00'
        ).length;

        const monthlyApproved = myDocs.filter(d =>
            d.progress_details === '승인' &&
            d.updated_at >= firstDayStr &&
            d.updated_at <= lastDayStr + 'T23:59:59'
        );
        const totalApprovalAmount = monthlyApproved.reduce((sum, doc) =>
            sum + (Number(doc.approval_amount) || 0), 0
        );

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
                ['memo_add', 'memo_delete', 'progress_details_change', 'manager_assigned'].includes(log.action_type) ||
                (log.action_type === 'status_change' && ['정상', '검수'].includes(log.new_value))
            ) {
                if (memoLogs.length < 50) memoLogs.push(log);
            }
            if (revisionLogs.length >= 50 && memoLogs.length >= 50) break;
        }

        // === 진행상황 차트 ===
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

        return NextResponse.json({
            stats: {
                inProgressCount: inProgressToday,
                inProgressDifference: inProgressToday - inProgressYesterday,
                approvalAmount: Math.round(totalApprovalAmount / 100000000 * 10) / 10,
                monthlyRevenue: Math.round(totalApprovalAmount * 0.03 / 100000000 * 10) / 10,
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
