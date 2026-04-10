import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROGRESS_STAGES = ['상담요청', '서류요청', '분석', '심사', '진행', '승인요청', '승인'];
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

        // 유저 정보 조회
        const userResult = await supabase
            .from('users')
            .select('id, user_id, position_id, company_name, is_affiliation_representative, position(level)')
            .eq('user_id', userId)
            .single();

        const user = userResult.data;
        const userLevel = (user as any)?.position?.level || 0;
        const userDbId = user?.id || 0;
        const userCompanyName = user?.company_name || '';
        const isRep = user?.is_affiliation_representative || false;

        // 유효하지 않은 역할이면 차단
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        let myDocs: any[] = [];
        // 소속 정보 캐싱 (문서 필터 + 영업자 목록에서 재사용)
        let cachedAffDbIds: number[] = [];
        let cachedInspectorAffDbIds: number[] = [];

        // 2단계: 권한별로 필터링된 문서 조회
        let docsQuery = supabase.from('documents')
            .select('id, user_id, submitter_id, status, progress_details, approval_amount, revenue_amount, created_at, updated_at, inspector_id, manager_id');

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
                    .select('affiliation_id')
                    .eq('user_id', userDbId);

                const myAffIds = (myAffiliations || []).map((a: any) => a.affiliation_id).filter(Boolean);

                if (myAffIds.length > 0) {
                    // 같은 소속의 모든 유저 조회
                    const { data: affUserLinks } = await supabase
                        .from('user_affiliations')
                        .select('user_id')
                        .in('affiliation_id', myAffIds);
                    const affDbIds = [...new Set((affUserLinks || []).map((a: any) => a.user_id))];
                    cachedAffDbIds = affDbIds;

                    if (affDbIds.length > 0) {
                        const { data: affUsers } = await supabase
                            .from('users')
                            .select('user_id')
                            .in('id', affDbIds);
                        const affUserIds = (affUsers || []).map((u: any) => u.user_id);
                        const allUserIds = [...new Set([...affUserIds, userId])];
                        if (allUserIds.length > 0) {
                            docsQuery = docsQuery.in('user_id', allUserIds);
                        } else {
                            docsQuery = docsQuery.eq('user_id', 'no_user_found');
                        }
                    } else {
                        docsQuery = docsQuery.eq('user_id', userId);
                    }
                } else {
                    docsQuery = docsQuery.eq('user_id', userId);
                }
            } else {
                // 일반 영업자: 자신의 문서 + submitter_id 문서 + 소개한 영업자의 문서
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
            // 검수자: 소속이 같은 영업자의 문서 + inspector_id로 배정받은 문서
            const { data: myAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userDbId);

            const myInspAffIds = (myAffiliations || []).map((a: any) => a.affiliation_id).filter(Boolean);

            let allowedUserIds: string[] = [];
            if (myInspAffIds.length > 0) {
                const { data: affUserLinks } = await supabase
                    .from('user_affiliations')
                    .select('user_id')
                    .in('affiliation_id', myInspAffIds);
                const affDbIds = [...new Set((affUserLinks || []).map((a: any) => a.user_id))];
                cachedInspectorAffDbIds = affDbIds;

                if (affDbIds.length > 0) {
                    const { data: usersData } = await supabase
                        .from('users').select('user_id').in('id', affDbIds);
                    allowedUserIds = (usersData || []).map((u: any) => u.user_id);
                }
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

        // 로그 조회: 권한 있는 문서의 로그만 DB에서 필터링
        let allLogs: any[] = [];
        if (!chartOnly && allowedDocIds.size > 0) {
            const { data: logsData } = await supabase
                .from('document_logs')
                .select(LOG_COLUMNS)
                .in('document_id', [...allowedDocIds])
                .order('created_at', { ascending: false })
                .limit(200);
            allLogs = logsData || [];

            // 역할별 로그 action_type 필터링 (백엔드에서 처리)
            allLogs = allLogs.filter(log => {
                if (log.action_type === 'memo_delete') return false;
                if (log.action_type === 'manager_assigned' && userLevel !== 1 && userLevel !== 2) return false;
                if (log.action_type === 'salesperson_assigned' && ![1, 2, 4, 6].includes(userLevel)) return false;
                return true;
            });
        }

        // === 날짜 계산 ===
        const now = new Date();
        const toLocalDateStr = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        // ISO 문자열을 KST 기준 YYYY-MM-DD 문자열로 변환
        const toKSTDateStr = (isoString: string): string => {
            if (!isoString) return '';
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return '';
            const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
        };
        const firstDayStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
        const nextMonthFirstStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 1));
        const prevMonthFirstStr = toLocalDateStr(new Date(now.getFullYear(), now.getMonth() - 1, 1));

        const formatChangeRate = (current: number, prev: number): string | null => {
            if (prev > 0) {
                const rate = Math.round(((current - prev) / prev) * 100);
                return `${rate > 0 ? '+' : ''}${rate}%`;
            }
            return null;
        };

        // === 진행상황 차트 (chartOnly에서도 필요) ===
        const chartMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [cYear, cMonth] = chartMonth.split('-');
        // Level 4 비대표: 차트는 본인 문서만 (소개받은 영업자 문서 제외)
        const ownDocs = (userLevel === 4 && !isRep)
            ? myDocs.filter((d: any) => d.user_id === userId || d.submitter_id === userId)
            : myDocs;
        const filteredDocs = ownDocs.filter((doc: any) => {
            if (!doc.created_at) return false;
            const dateStr = toKSTDateStr(doc.created_at);
            const [y, m] = dateStr.split('-');
            return y === cYear && m === cMonth.padStart(2, '0');
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

        // === 영업자 목록 (level 1, 2, 4, 6) ===
        let salesData: any[] = [];
        let salespeople: any[] | null = null;

        if (userLevel === 1 || userLevel === 2) {
            // 대표자/대표실무자: 전체 영업자
            const { data } = await supabase
                .from('users')
                .select('user_id, name')
                .eq('position_id', 4);
            salespeople = data;
        } else if (userLevel === 4) {
            if (isRep) {
                // 소속대표: 캐싱된 소속 DB ID 재사용
                if (cachedAffDbIds.length > 0) {
                    const { data } = await supabase
                        .from('users')
                        .select('user_id, name')
                        .eq('position_id', 4)
                        .in('id', cachedAffDbIds);
                    salespeople = data;
                }
            } else {
                // 일반 영업자: 본인만
                const { data } = await supabase
                    .from('users')
                    .select('user_id, name')
                    .eq('user_id', userId);
                salespeople = data;
            }
        } else if (userLevel === 6) {
            // 검수자: 캐싱된 소속 DB ID 재사용
            if (cachedInspectorAffDbIds.length > 0) {
                const { data } = await supabase
                    .from('users')
                    .select('user_id, name')
                    .eq('position_id', 4)
                    .in('id', cachedInspectorAffDbIds);
                salespeople = data;
            }
        }

        if (salespeople && salespeople.length > 0) {
                const salesUserIds = new Set(salespeople.map((p: any) => p.user_id));
                // 영업자 현황: user_id 기준만 (상담요청 문서는 B영업자에게 귀속)
                const salesDocs = myDocs.filter(d => salesUserIds.has(d.user_id));
                const docsByUser: Record<string, any[]> = {};
                for (const doc of salesDocs) {
                    if (!docsByUser[doc.user_id]) docsByUser[doc.user_id] = [];
                    docsByUser[doc.user_id].push(doc);
                }

                // 지급수수료 5% 계산을 위한 소개자 정보 로드
                const salesDocUserIds = [...new Set([
                    ...salesDocs.map((d: any) => d.user_id),
                    ...salesDocs.map((d: any) => d.submitter_id),
                ].filter(Boolean))];
                const salesFeeUserInfoMap: Record<string, { introducer?: string }> = {};
                if (salesDocUserIds.length > 0) {
                    const { data: salesUsersData } = await supabase
                        .from('users')
                        .select('user_id, introducer')
                        .in('user_id', salesDocUserIds);
                    for (const u of salesUsersData || []) {
                        salesFeeUserInfoMap[u.user_id] = { introducer: u.introducer };
                    }
                }

                salesData = salespeople.map((person: any) => {
                    const userDocs = docsByUser[person.user_id] || [];

                    const monthlyDocs = userDocs.filter(d => {
                        const date = toKSTDateStr(d.created_at || '');
                        return date >= firstDayStr && date < nextMonthFirstStr;
                    });

                    const monthlyApprovedDocs = userDocs.filter(d => {
                        if (d.progress_details !== '승인') return false;
                        const date = toKSTDateStr(d.updated_at || '');
                        return date >= firstDayStr && date < nextMonthFirstStr;
                    });

                    const approvedCount = monthlyApprovedDocs.length;
                    const registrationCount = monthlyDocs.length;

                    // 지급수수료 계산 (기업등록 40%, 상담요청 20%, 소개 5%)
                    let totalFee = 0;
                    monthlyApprovedDocs.forEach((doc: any) => {
                        const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                        if (doc.submitter_id === person.user_id) totalFee += Math.round(rev * 0.2 * 10) / 10;
                        else if (doc.user_id === person.user_id && !doc.submitter_id) totalFee += Math.round(rev * 0.4 * 10) / 10;
                        const docUserId = doc.submitter_id || doc.user_id;
                        if ((salesFeeUserInfoMap[docUserId] || {}).introducer === person.user_id) totalFee += Math.round(rev * 0.05 * 10) / 10;
                    });
                    const feeWon = totalFee * 10000;
                    const amountStr = feeWon > 0 ? feeWon.toLocaleString('ko-KR') + '원' : '-';

                    return {
                        userId: person.user_id,
                        name: person.name,
                        registrations: registrationCount,
                        inProgress: userDocs.filter(d => d.progress_details === '진행').length,
                        approved: approvedCount,
                        approvalAmount: amountStr,
                        approvalAmountRaw: totalFee,
                        conversionRate: registrationCount > 0 ? `${Math.round((approvedCount / registrationCount) * 100)}%` : '-'
                    };
                });
        }

        // === 통계 계산 ===
        // 현재 진행중인 케이스 전체 (날짜 무관)
        const inProgressCount = ownDocs.filter(d =>
            d.progress_details === '진행'
        ).length;

        // monthlyApproved는 수수료 계산 때문에 소개받은 문서 포함(myDocs 기준)
        const monthlyApproved = myDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const date = toKSTDateStr(d.updated_at || '');
            return date >= firstDayStr && date < nextMonthFirstStr;
        });
        const prevMonthApproved = myDocs.filter((d: any) => {
            if (d.progress_details !== '승인') return false;
            const date = toKSTDateStr(d.updated_at || '');
            return date >= prevMonthFirstStr && date < firstDayStr;
        });

        const totalApprovalAmount = ownDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const date = toKSTDateStr(d.updated_at || '');
            return date >= firstDayStr && date < nextMonthFirstStr;
        }).reduce((sum, doc) => {
            const amount = doc.approval_amount;
            const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        const newRegistrations = ownDocs.filter(d => {
            const date = toKSTDateStr(d.created_at || '');
            return date >= firstDayStr && date < nextMonthFirstStr;
        }).length;
        const prevNewRegistrations = ownDocs.filter(d => {
            const date = toKSTDateStr(d.created_at || '');
            return date >= prevMonthFirstStr && date < firstDayStr;
        }).length;

        const approvedCount = ownDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const date = toKSTDateStr(d.updated_at || '');
            return date >= firstDayStr && date < nextMonthFirstStr;
        }).length;
        const prevApprovedCount = ownDocs.filter(d => {
            if (d.progress_details !== '승인') return false;
            const date = toKSTDateStr(d.updated_at || '');
            return date >= prevMonthFirstStr && date < firstDayStr;
        }).length;

        // === 로그 분류 (각 50개씩) ===
        const revisionLogs: any[] = [];
        const memoLogs: any[] = [];
        for (const log of allLogs) {
            if (log.action_type === 'status_change' && ['보완', '보류'].includes(log.new_value)) {
                if (revisionLogs.length < 50) revisionLogs.push(log);
            } else if (
                ['memo_add', 'progress_details_change', 'manager_assigned', 'salesperson_assigned'].includes(log.action_type) ||
                (log.action_type === 'status_change' && ['정상', '검수'].includes(log.new_value))
            ) {
                if (memoLogs.length < 50) memoLogs.push(log);
            }
            if (revisionLogs.length >= 50 && memoLogs.length >= 50) break;
        }

        // 수수료 계산 헬퍼 (Level 4 비대표 전용)
        const calcFee = async (docs: any[]): Promise<number> => {
            const docUserIds = [...new Set([
                ...docs.map((d: any) => d.user_id),
                ...docs.map((d: any) => d.submitter_id),
            ].filter(Boolean))];
            const introMap: Record<string, string> = {};
            if (docUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users').select('user_id, introducer').in('user_id', docUserIds);
                for (const u of usersData || []) {
                    if (u.introducer) introMap[u.user_id] = u.introducer;
                }
            }
            let fee = 0;
            for (const doc of docs) {
                const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                if (doc.submitter_id === userId) fee += Math.round(rev * 0.2 * 10) / 10;
                else if (doc.user_id === userId && !doc.submitter_id) fee += Math.round(rev * 0.4 * 10) / 10;
                const docOwnerId = doc.submitter_id || doc.user_id;
                if (introMap[docOwnerId] === userId) fee += Math.round(rev * 0.05 * 10) / 10;
            }
            return fee;
        };

        const sumRevenue = (docs: any[]) => docs.reduce((sum: number, doc: any) => {
            const amount = doc.revenue_amount;
            const numAmount = typeof amount === 'string' ? (parseInt(amount) || 0) : Number(amount) || 0;
            return sum + numAmount;
        }, 0);

        // 소속대표: 소속 영업자 전체 지급수수료 합산
        const calcAffilFee = async (docs: any[]): Promise<number> => {
            const docUserIds = [...new Set([
                ...docs.map((d: any) => d.user_id),
                ...docs.map((d: any) => d.submitter_id),
            ].filter(Boolean))];
            const introMap: Record<string, string> = {};
            if (docUserIds.length > 0) {
                const { data: usersData } = await supabase
                    .from('users').select('user_id, introducer').in('user_id', docUserIds);
                for (const u of usersData || []) {
                    if (u.introducer) introMap[u.user_id] = u.introducer;
                }
            }
            // 같은 소속 영업자 user_id set (소개자 필터링용)
            let affUserIdSet = new Set<string>();
            if (cachedAffDbIds.length > 0) {
                const { data: affUsers } = await supabase
                    .from('users')
                    .select('user_id')
                    .in('id', cachedAffDbIds);
                affUserIdSet = new Set((affUsers || []).map((u: any) => u.user_id));
            }
            let fee = 0;
            for (const doc of docs) {
                const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                if (doc.submitter_id) {
                    // 상담요청: submitter가 소속원일 때만 20%
                    if (affUserIdSet.has(doc.submitter_id)) {
                        fee += Math.round(rev * 0.2 * 10) / 10;
                    }
                    const submitterIntro = introMap[doc.submitter_id];
                    if (submitterIntro && affUserIdSet.has(submitterIntro)) {
                        fee += Math.round(rev * 0.05 * 10) / 10;
                    }
                } else {
                    // 기업등록: user_id는 항상 소속원 (docsQuery 필터 보장)
                    fee += Math.round(rev * 0.4 * 10) / 10;
                    const userIntro = introMap[doc.user_id];
                    if (userIntro && affUserIdSet.has(userIntro)) {
                        fee += Math.round(rev * 0.05 * 10) / 10;
                    }
                }
            }
            return fee;
        };

        let monthlyRevenueValue: number;
        let prevMonthRevenueValue: number;
        if (userLevel === 4 && !isRep) {
            [monthlyRevenueValue, prevMonthRevenueValue] = await Promise.all([
                calcFee(monthlyApproved),
                calcFee(prevMonthApproved),
            ]);
        } else if (userLevel === 4 && isRep) {
            // 소속원 user_id set 빌드 (외부 인센티브 계산용)
            let homeAffMemberUserIds = new Set<string>();
            if (cachedAffDbIds.length > 0) {
                const { data: affUsersForExt } = await supabase.from('users').select('user_id').in('id', cachedAffDbIds);
                homeAffMemberUserIds = new Set((affUsersForExt || []).map((u: any) => u.user_id));
            }

            let externalMonthlyIncentive = 0;
            let externalPrevMonthIncentive = 0;

            if (homeAffMemberUserIds.size > 0) {
                const { data: introducedUsersRaw } = await supabase
                    .from('users')
                    .select('user_id, introducer')
                    .in('introducer', [...homeAffMemberUserIds]);

                const otherAffUsers = (introducedUsersRaw || []).filter((u: any) => !homeAffMemberUserIds.has(u.user_id));
                const otherAffUserIds = otherAffUsers.map((u: any) => u.user_id);
                const otherUserIntroMap: Record<string, string> = {};
                for (const u of otherAffUsers) {
                    otherUserIntroMap[u.user_id] = u.introducer;
                }

                if (otherAffUserIds.length > 0) {
                    const myDocIds = new Set(myDocs.map((d: any) => d.id));
                    const [{ data: submitterDocs }, { data: userOwnDocs }] = await Promise.all([
                        supabase.from('documents')
                            .select('id, user_id, submitter_id, revenue_amount, updated_at, progress_details')
                            .in('submitter_id', otherAffUserIds)
                            .eq('progress_details', '승인'),
                        supabase.from('documents')
                            .select('id, user_id, submitter_id, revenue_amount, updated_at, progress_details')
                            .in('user_id', otherAffUserIds)
                            .is('submitter_id', null)
                            .eq('progress_details', '승인'),
                    ]);
                    const allExternal = [...(submitterDocs || []), ...(userOwnDocs || [])].filter((d: any) => !myDocIds.has(d.id));

                    for (const doc of allExternal) {
                        const dateStr = toKSTDateStr(doc.updated_at || '');
                        const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                        const incentive = Math.round(rev * 0.05 * 10) / 10;
                        if (dateStr >= firstDayStr && dateStr < nextMonthFirstStr) externalMonthlyIncentive += incentive;
                        if (dateStr >= prevMonthFirstStr && dateStr < firstDayStr) externalPrevMonthIncentive += incentive;
                    }
                }
            }

            [monthlyRevenueValue, prevMonthRevenueValue] = await Promise.all([
                calcAffilFee(monthlyApproved),
                calcAffilFee(prevMonthApproved),
            ]);
            monthlyRevenueValue += externalMonthlyIncentive;
            prevMonthRevenueValue += externalPrevMonthIncentive;
        } else {
            monthlyRevenueValue = sumRevenue(monthlyApproved);
            prevMonthRevenueValue = sumRevenue(prevMonthApproved);
        }

        return NextResponse.json({
            stats: {
                inProgressCount,
                approvalAmount: totalApprovalAmount,
                monthlyRevenue: monthlyRevenueValue,
                newRegistrations,
                approvedCount,
                inProgressChangeRate: null,
                revenueChangeRate: formatChangeRate(monthlyRevenueValue, prevMonthRevenueValue),
                newRegistrationsChangeRate: formatChangeRate(newRegistrations, prevNewRegistrations),
                approvedCountChangeRate: formatChangeRate(approvedCount, prevApprovedCount),
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
