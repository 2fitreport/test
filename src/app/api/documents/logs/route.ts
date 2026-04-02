import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const documentId = searchParams.get('document_id');
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
        const revisionRejected = searchParams.get('revision_rejected') === 'true';
        const memoOnly = searchParams.get('memo_only') === 'true';
        const statusChangeOnly = searchParams.get('status_change_only') === 'true';
        const includeRead = searchParams.get('include_read') === 'true';

        // 요청자 정보 추출
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
                .select('id, position(level), company_name')
                .eq('user_id', userId)
                .single();

            if (userData) {
                userDbId = userData.id;
                userLevel = (userData.position as any)?.level || 0;
            }
        } catch {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        // 유효하지 않은 역할이면 차단
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        // level별 문서 필터링
        let allowedDocumentIds: number[] | null = null;

        if (userLevel === 4) {
            // 소속대표 여부 확인
            const { data: userInfo } = await supabase
                .from('users')
                .select('is_affiliation_representative')
                .eq('user_id', userId)
                .single();

            if (userInfo?.is_affiliation_representative) {
                // 소속대표: 본인 소속의 모든 영업자 문서 (manager_id 여부 무관)
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
                            const { data: affDocs } = await supabase
                                .from('documents')
                                .select('id')
                                .in('user_id', affUserIds);
                            allowedDocumentIds = (affDocs || []).map((d: any) => d.id);
                        } else {
                            allowedDocumentIds = [];
                        }
                    } else {
                        allowedDocumentIds = [];
                    }
                } else {
                    allowedDocumentIds = [];
                }
            } else {
                // 일반 영업자: 자신이 올린 문서 + submitter_id 문서
                const { data: myDocs } = await supabase
                    .from('documents')
                    .select('id')
                    .eq('user_id', userId);
                const { data: submitterDocs } = await supabase
                    .from('documents')
                    .select('id')
                    .eq('submitter_id', userId);
                const myIds = (myDocs || []).map((d: any) => d.id);
                const submitterIds = (submitterDocs || []).map((d: any) => d.id);
                allowedDocumentIds = [...new Set([...myIds, ...submitterIds])];
            }

        } else if (userLevel === 3) {
            // 실무자: 자신에게 배정된 문서만 (manager_id)
            const { data: myDocs } = await supabase
                .from('documents')
                .select('id')
                .eq('manager_id', userId);
            allowedDocumentIds = (myDocs || []).map((d: any) => d.id);

        } else if (userLevel === 2) {
            // 대표실무자: admin 배정 문서 제외
            const { data: myDocs } = await supabase
                .from('documents')
                .select('id')
                .neq('manager_id', 'admin');
            allowedDocumentIds = (myDocs || []).map((d: any) => d.id);

        } else if (userLevel === 6) {
            // 검수자: 자신이 담당하는 소속의 영업자 문서 OR 자신이 배정받은 문서

            // 1. 검수자의 담당 소속 조회 (user_affiliations 사용)
            const { data: myAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userDbId);

            const myAffIds = (myAffiliations || []).map((a: any) => a.affiliation_id).filter(Boolean);

            let allowedUserIds: string[] = [];
            if (myAffIds.length > 0) {
                // 2. 같은 소속의 유저 DB ID 조회
                const { data: affUserLinks } = await supabase
                    .from('user_affiliations')
                    .select('user_id')
                    .in('affiliation_id', myAffIds);
                const affDbIds = [...new Set((affUserLinks || []).map((a: any) => a.user_id))];

                if (affDbIds.length > 0) {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('user_id')
                        .in('id', affDbIds);
                    allowedUserIds = (usersData || []).map((u: any) => u.user_id);
                }
            }

            // 3. 담당 소속 영업자의 문서 조회
            let affiliationDocIds: number[] = [];
            if (allowedUserIds.length > 0) {
                const { data: myDocs } = await supabase
                    .from('documents')
                    .select('id')
                    .in('user_id', allowedUserIds);
                affiliationDocIds = (myDocs || []).map((d: any) => d.id);
            }

            // 4. inspector_id가 자신인 문서도 추가 (과거에 배정받은 문서)
            const { data: assignedDocs } = await supabase
                .from('documents')
                .select('id')
                .eq('inspector_id', userId);

            const assignedIds = (assignedDocs || []).map((d: any) => d.id);
            allowedDocumentIds = [...new Set([...affiliationDocIds, ...assignedIds])];
        }

        // home_all: 보완요청 + 알림사항 한번에 조회
        const homeAll = searchParams.get('home_all') === 'true';

        if (homeAll) {
            // 한번에 모든 로그 조회 후 프론트에서 분류
            let query = supabase
                .from('document_logs')
                .select('*')
                .order('created_at', { ascending: false });

            if (allowedDocumentIds !== null) {
                if (allowedDocumentIds.length === 0) {
                    return NextResponse.json({ revisionLogs: [], memoLogs: [], currentUserId: userId });
                }
                query = query.in('document_id', allowedDocumentIds);
            }

            const { data: allLogs, error } = await query;
            if (error) throw error;

            const logs = allLogs || [];

            // 서버에서 분류
            const revisionLogs = logs.filter((log: any) =>
                log.action_type === 'status_change' && ['보완', '보류'].includes(log.new_value)
            );

            const memoLogs = logs.filter((log: any) => {
                if (['memo_add', 'memo_delete', 'progress_details_change', 'manager_assigned', 'salesperson_assigned'].includes(log.action_type)) return true;
                if (log.action_type === 'status_change' && ['정상', '검수'].includes(log.new_value)) return true;
                return false;
            });

            return NextResponse.json({ revisionLogs, memoLogs, currentUserId: userId });
        }

        // 기본 쿼리
        let query = supabase
            .from('document_logs')
            .select('*')
            .order('created_at', { ascending: false });

        // 상태 필터
        if (statusChangeOnly) {
            query = query
                .eq('action_type', 'status_change')
                .in('new_value', ['보완', '보류']);
        } else if (memoOnly) {
            query = query.or('action_type.in.(memo_add,memo_delete,progress_details_change,manager_assigned,salesperson_assigned),and(action_type.eq.status_change,new_value.in.(정상,검수))');
        } else if (revisionRejected) {
            query = query
                .eq('action_type', 'status_change')
                .in('new_value', ['보완', '보류']);
        } else {
            query = query
                .eq('action_type', 'status_change')
                .not('new_value', 'in', '("보완","보류")');
        }

        // 문서별 필터
        if (documentId) {
            query = query.eq('document_id', parseInt(documentId));
        }

        // 자신이 올린 문서만 필터 (level 3, 4, 6)
        if (allowedDocumentIds !== null) {
            if (allowedDocumentIds.length === 0) {
                return NextResponse.json([]);
            }
            query = query.in('document_id', allowedDocumentIds);
        }

        const { data: allLogs, error } = await query;

        if (error) throw error;

        let filteredLogs = allLogs || [];

        // 읽음 상태 필터링 (include_read가 아닌 경우에만)
        if (!includeRead) {
            filteredLogs = filteredLogs.filter((log: any) => {
                const staffRead = log.staff_read || {};
                return staffRead[userId] !== true;
            });
        }

        if (limit) {
            filteredLogs = filteredLogs.slice(0, limit);
        }

        if (includeRead) {
            return NextResponse.json({ logs: filteredLogs, currentUserId: userId });
        }
        return NextResponse.json(filteredLogs);
    } catch (error) {
        console.error('로그 조회 실패:', error);
        return NextResponse.json({ error: '로그 조회 실패' }, { status: 500 });
    }
}
