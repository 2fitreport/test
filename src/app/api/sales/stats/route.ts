import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const monthParam = searchParams.get('month'); // YYYY-MM

        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

        let userId = 'unknown';
        let userLevel = 0;
        let userDbId = 0;
        let isAffiliationRep = false;

        try {
            const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
            userId = tokenData.user_id || 'unknown';
            const { data: userData } = await supabase
                .from('users')
                .select('id, is_affiliation_representative, company_name, position(level)')
                .eq('user_id', userId)
                .single();
            if (userData) {
                userLevel = (userData.position as any)?.level || 0;
                userDbId = userData.id || 0;
                isAffiliationRep = userData.is_affiliation_representative || false;
            }
        } catch (e) {}

        // 유효하지 않은 역할은 접근 차단
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        // 역할별 영업자 목록 조회
        let salespeople: any[] = [];

        if (userLevel === 4 && !isAffiliationRep) {
            // 일반 영업자: 자신만
            const { data } = await supabase
                .from('users')
                .select('id, user_id, name')
                .eq('user_id', userId)
                .eq('position_id', 4);
            salespeople = data || [];
        } else if (userLevel === 4 && isAffiliationRep) {
            // 소속대표: 같은 소속의 영업자들
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
                    const { data } = await supabase
                        .from('users')
                        .select('id, user_id, name')
                        .in('id', affDbIds)
                        .eq('position_id', 4);
                    salespeople = data || [];
                }
            }
        } else if (userLevel === 6) {
            // 검수자: 담당 소속 영업자
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
                    const { data } = await supabase
                        .from('users')
                        .select('id, user_id, name')
                        .in('id', affDbIds)
                        .eq('position_id', 4);
                    salespeople = data || [];
                }
            }
        } else if (userLevel === 3) {
            // 실무자: 자기가 담당하는 문서의 영업자만
            const { data: managedDocs } = await supabase
                .from('documents')
                .select('user_id')
                .eq('manager_id', userId)
                .not('user_id', 'is', null);
            const managedUserIds = [...new Set((managedDocs || []).map((d: any) => d.user_id).filter(Boolean))];
            if (managedUserIds.length > 0) {
                const { data } = await supabase
                    .from('users')
                    .select('id, user_id, name')
                    .in('user_id', managedUserIds)
                    .eq('position_id', 4);
                salespeople = data || [];
            }
        } else {
            // level 1, 2: 모든 영업자
            const { data } = await supabase
                .from('users')
                .select('id, user_id, name')
                .eq('position_id', 4);
            salespeople = data || [];
        }

        if (salespeople.length === 0) return NextResponse.json([]);

        const userIds = salespeople.map((p: any) => p.user_id);

        // 문서 조회 (user_id 기준, 대표실무자는 admin 배정 문서 제외)
        // 영업자 성과: 상담요청 문서는 B영업자(user_id)에게 귀속
        let docQuery = supabase
            .from('documents')
            .select('user_id, submitter_id, progress_details, revenue_amount, created_at, updated_at')
            .in('user_id', userIds);
        if (userLevel === 2) {
            docQuery = docQuery.neq('manager_id', 'admin');
        }
        const { data: allDocuments } = await docQuery;
        const docs = allDocuments || [];

        const toKSTDateStr = (isoString: string): string => {
            if (!isoString) return '';
            const d = new Date(isoString);
            if (isNaN(d.getTime())) return '';
            const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
            return `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, '0')}-${String(kst.getUTCDate()).padStart(2, '0')}`;
        };

        // 월 범위
        let monthStartStr = '', monthEndStr = '';
        if (monthParam) {
            const [y, m] = monthParam.split('-').map(Number);
            const endDate = new Date(y, m, 0).getDate();
            monthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;
            monthEndStr = `${y}-${String(m).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
        }

        // user별 그룹핑
        const docsByUser: Record<string, any[]> = {};
        for (const doc of docs) {
            if (!docsByUser[doc.user_id]) docsByUser[doc.user_id] = [];
            docsByUser[doc.user_id].push(doc);
        }

        // introducer 정보 미리 로드
        const userIds2 = salespeople.map((p: any) => p.user_id);
        const { data: usersData } = await supabase
            .from('users')
            .select('user_id, introducer')
            .in('user_id', userIds2);
        const feeUserInfoMap: Record<string, { introducer?: string }> = {};
        (usersData || []).forEach((u: any) => {
            feeUserInfoMap[u.user_id] = { introducer: u.introducer };
        });

        const stats = salespeople.map((person: any) => {
            const userDocs = docsByUser[person.user_id] || [];

            // 상담수: 해당 월에 생성된 문서 (KST 기준)
            const consultDocs = monthStartStr
                ? userDocs.filter(d => {
                    const date = toKSTDateStr(d.created_at || '');
                    return date >= monthStartStr && date <= monthEndStr;
                })
                : userDocs;

            // 케이스수/지급수수료: 해당 월에 승인된 문서 (updated_at KST 기준)
            const approvedDocs = monthStartStr
                ? userDocs.filter(d => {
                    if (d.progress_details !== '승인') return false;
                    const date = toKSTDateStr(d.updated_at || '');
                    return date >= monthStartStr && date <= monthEndStr;
                })
                : userDocs.filter(d => d.progress_details === '승인');

            // 지급수수료 계산
            let totalFee = 0;
            approvedDocs.forEach((doc: any) => {
                const rev = typeof doc.revenue_amount === 'string' ? (parseInt(doc.revenue_amount) || 0) : Number(doc.revenue_amount) || 0;
                if (doc.submitter_id === person.user_id) totalFee += Math.round(rev * 0.2 * 10) / 10;
                else if (doc.user_id === person.user_id && !doc.submitter_id) totalFee += Math.round(rev * 0.4 * 10) / 10;
                const docUserId = doc.submitter_id || doc.user_id;
                if ((feeUserInfoMap[docUserId] || {}).introducer === person.user_id) totalFee += Math.round(rev * 0.05 * 10) / 10;
            });

            const caseCount = approvedDocs.length;
            const consultCount = consultDocs.length;
            const rate = consultCount > 0 ? Math.round((caseCount / consultCount) * 100) : 0;

            // 금액 포맷 (원단위)
            const feeWon = totalFee * 10000;
            let amountStr = '-';
            if (feeWon > 0) {
                amountStr = feeWon.toLocaleString('ko-KR') + '원';
            }

            return {
                name: person.name,
                consult: consultCount,
                case: caseCount,
                amount: amountStr,
                amountNum: totalFee,
                rate: `${rate}%`,
                rateNum: rate
            };
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error('영업자 통계 조회 실패:', error);
        return NextResponse.json({ error: '영업자 통계 조회 실패' }, { status: 500 });
    }
}
