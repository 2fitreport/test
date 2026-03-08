import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROGRESS_STAGES = ['상담', '서류요청', '분석', '심사', '진행', '승인요청', '승인'];
const STATUS_LIST = ['정상', '보완', '보류', '검수'];

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

        // 1. 유저 정보 조회 (1회만)
        const { data: user } = await supabase
            .from('users')
            .select('id, user_id, position_id, company_name, is_affiliation_representative')
            .eq('user_id', userId)
            .single();

        const userLevel = user?.position_id || 0;
        const userDbId = user?.id || 0;
        const userCompanyName = user?.company_name || '';
        const isRep = user?.is_affiliation_representative || false;

        // 2. 병렬 조회: 문서, 로그, 영업자 목록
        const docsPromise = supabase.from('documents')
            .select('id, user_id, status, progress_details, approval_amount, created_at, updated_at, inspector_id');

        // 로그: 권한 필터용 document_ids 구하기
        let allowedDocumentIds: number[] | null = null;

        if (userLevel === 4) {
            const { data: myDocs } = await supabase
                .from('documents').select('id').eq('user_id', userId);
            allowedDocumentIds = (myDocs || []).map((d: any) => d.id);
        } else if (userLevel === 6) {
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

            const { data: myDocs } = await supabase
                .from('documents').select('id').in('user_id', allowedUserIds.length > 0 ? allowedUserIds : ['__none__']);
            const { data: assignedDocs } = await supabase
                .from('documents').select('id').eq('inspector_id', userId);

            allowedDocumentIds = [
                ...(myDocs || []).map((d: any) => d.id),
                ...(assignedDocs || []).map((d: any) => d.id)
            ];
            allowedDocumentIds = [...new Set(allowedDocumentIds)];
        }

        let logsQuery = supabase.from('document_logs')
            .select('*')
            .order('created_at', { ascending: false });

        if (allowedDocumentIds !== null) {
            if (allowedDocumentIds.length === 0) {
                logsQuery = logsQuery.in('document_id', [-1]); // 없는 ID로 빈 결과
            } else {
                logsQuery = logsQuery.in('document_id', allowedDocumentIds);
            }
        }

        // 영업자 목록 (level 1,2,4만)
        let salesQuery = null;
        if (userLevel === 1 || userLevel === 2 || userLevel === 4) {
            let q = supabase.from('users').select('user_id, name').eq('position_id', 4);
            if (userLevel === 4) {
                if (isRep && userCompanyName) {
                    q = q.eq('company_name', userCompanyName);
                } else {
                    q = q.eq('user_id', userId);
                }
            }
            salesQuery = q;
        }

        // 병렬 실행
        const [docsResult, logsResult, salesResult] = await Promise.all([
            docsPromise,
            logsQuery,
            salesQuery || Promise.resolve({ data: null })
        ]);

        const allDocs = docsResult.data || [];
        const allLogs = logsResult.data || [];
        const salespeople = salesResult.data || [];

        // === 통계 계산 ===
        const now = new Date();
        const firstDayStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDayStr = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // 역할별 필터링된 문서
        let myDocs = allDocs;
        if (userLevel === 4) {
            myDocs = allDocs.filter(d => d.user_id === userId);
        } else if (userLevel === 6) {
            const allowedIds = new Set(allowedDocumentIds || []);
            myDocs = allDocs.filter(d => allowedIds.has(d.id));
        }

        // 진행중 케이스
        const inProgressToday = myDocs.filter(d =>
            d.progress_details === '진행' && d.updated_at >= todayStr
        ).length;
        const inProgressYesterday = myDocs.filter(d =>
            d.progress_details === '진행' &&
            d.updated_at >= yesterdayStr + 'T00:00:00' &&
            d.updated_at < todayStr + 'T00:00:00'
        ).length;

        // 이번달 승인
        const monthlyApproved = myDocs.filter(d =>
            d.progress_details === '승인' &&
            d.updated_at >= firstDayStr &&
            d.updated_at <= lastDayStr + 'T23:59:59'
        );
        const totalApprovalAmount = monthlyApproved.reduce((sum, doc) =>
            sum + (Number(doc.approval_amount) || 0), 0
        );

        // 이번달 신규
        const newRegistrations = myDocs.filter(d =>
            d.created_at >= firstDayStr &&
            d.created_at <= lastDayStr + 'T23:59:59'
        ).length;

        const stats = {
            inProgressCount: inProgressToday,
            inProgressDifference: inProgressToday - inProgressYesterday,
            approvalAmount: Math.round(totalApprovalAmount / 100000000 * 10) / 10,
            monthlyRevenue: Math.round(totalApprovalAmount * 0.03 / 100000000 * 10) / 10,
            newRegistrations,
            approvedCount: monthlyApproved.length
        };

        // === 로그 분류 ===
        const revisionLogs = allLogs.filter((log: any) =>
            log.action_type === 'status_change' && ['보완', '보류'].includes(log.new_value)
        );
        const memoLogs = allLogs.filter((log: any) => {
            if (['memo_add', 'memo_delete', 'progress_details_change', 'manager_assigned'].includes(log.action_type)) return true;
            if (log.action_type === 'status_change' && ['정상', '검수'].includes(log.new_value)) return true;
            return false;
        });

        // === 영업자 현황 ===
        let salesData: any[] = [];
        if (salespeople.length > 0) {
            const salesUserIds = salespeople.map((p: any) => p.user_id);
            const salesDocs = allDocs.filter(d => salesUserIds.includes(d.user_id));
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

        // === 진행상황 차트 ===
        let filteredDocs = myDocs;
        const chartMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [cYear, cMonth] = chartMonth.split('-');
        filteredDocs = myDocs.filter((doc: any) => {
            if (!doc.created_at) return false;
            const docDate = new Date(doc.created_at);
            return docDate.getFullYear() === parseInt(cYear) &&
                   docDate.getMonth() + 1 === parseInt(cMonth);
        });

        const stageCounts = PROGRESS_STAGES.map(stage =>
            filteredDocs.filter(d => d.progress_details === stage).length
        );
        const statusCounts = STATUS_LIST.map(status =>
            filteredDocs.filter(d => d.status === status).length
        );

        const progressData = {
            stage: {
                labels: PROGRESS_STAGES,
                datasets: [{
                    label: '진행단계',
                    data: stageCounts,
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
                    data: statusCounts,
                    backgroundColor: ['#a5d6a7', '#ffd6a5', '#ffadad', '#90caf9'],
                    borderColor: ['#66bb6a', '#ffb873', '#ff8b8b', '#42a5f5'],
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            }
        };

        return NextResponse.json({
            stats,
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
