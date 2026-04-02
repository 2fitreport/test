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

        try {
            const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
            userId = tokenData.user_id || 'unknown';
            const { data: userData } = await supabase
                .from('users')
                .select('id, position(level)')
                .eq('user_id', userId)
                .single();
            if (userData) {
                userLevel = (userData.position as any)?.level || 0;
                userDbId = userData.id || 0;
            }
        } catch (e) {}

        // 유효하지 않은 역할은 접근 차단
        if (![1, 2, 3, 4, 6].includes(userLevel)) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        // 역할별 실무자 목록 조회
        let staffList: any[] = [];

        if (userLevel === 4) {
            // 영업자: 실무자 성과 조회 불가
            return NextResponse.json([]);
        } else if (userLevel === 6) {
            // 검수자: 실무자 성과 조회 불가
            return NextResponse.json([]);
        } else if (userLevel === 3) {
            // 실무자: 본인 + 소속 관련 실무자
            const { data } = await supabase
                .from('users')
                .select('id, user_id, name')
                .eq('user_id', userId)
                .eq('position_id', 3);
            staffList = data || [];
            const { data: myAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userDbId);
            const myAffIds = (myAffiliations || []).map((a: any) => a.affiliation_id).filter(Boolean);
            let affUserIds: string[] = [];
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
                    affUserIds = (affUsers || []).map((u: any) => u.user_id);
                }
            }
            if (affUserIds.length > 0) {
                const { data: assignedDocs } = await supabase
                    .from('documents')
                    .select('manager_id')
                    .in('user_id', affUserIds)
                    .not('manager_id', 'is', null)
                    .neq('manager_id', 'admin');
                const managerIds = [...new Set((assignedDocs || []).map((d: any) => d.manager_id).filter(Boolean))];
                if (managerIds.length > 0) {
                    const { data: affStaff } = await supabase
                        .from('users')
                        .select('id, user_id, name')
                        .in('user_id', managerIds)
                        .eq('position_id', 3);
                    // 본인 + 소속 실무자 병합 (중복 제거)
                    const existingIds = new Set(staffList.map((s: any) => s.user_id));
                    for (const s of affStaff || []) {
                        if (!existingIds.has(s.user_id)) {
                            staffList.push(s);
                            existingIds.add(s.user_id);
                        }
                    }
                }
            }
        } else {
            // level 1, 2: 모든 실무자
            const { data } = await supabase
                .from('users')
                .select('id, user_id, name')
                .eq('position_id', 3);
            staffList = data || [];
        }

        if (staffList.length === 0) return NextResponse.json([]);

        const staffUserIds = staffList.map((p: any) => p.user_id);

        // 실무자가 담당한 문서 조회 (manager_id 기준)
        const { data: allDocuments } = await supabase
            .from('documents')
            .select('manager_id, progress_details, approval_amount, created_at, payment_date')
            .in('manager_id', staffUserIds);
        const docs = allDocuments || [];

        // 월 범위
        let monthStartStr = '', monthEndStr = '';
        if (monthParam) {
            const [y, m] = monthParam.split('-').map(Number);
            const endDate = new Date(y, m, 0).getDate();
            monthStartStr = `${y}-${String(m).padStart(2, '0')}-01`;
            monthEndStr = `${y}-${String(m).padStart(2, '0')}-${String(endDate).padStart(2, '0')}`;
        }

        // manager별 그룹핑
        const docsByManager: Record<string, any[]> = {};
        for (const doc of docs) {
            if (!doc.manager_id) continue;
            if (!docsByManager[doc.manager_id]) docsByManager[doc.manager_id] = [];
            docsByManager[doc.manager_id].push(doc);
        }

        const stats = staffList.map((person: any) => {
            const managerDocs = docsByManager[person.user_id] || [];

            // 상담수: 해당 월에 배정된 문서 (created_at 기준)
            const consultDocs = monthStartStr
                ? managerDocs.filter(d => {
                    const date = d.created_at?.substring(0, 10) || '';
                    return date >= monthStartStr && date <= monthEndStr;
                })
                : managerDocs;

            // 케이스수/승인금액: 해당 월 payment_date 기준 승인된 문서
            const approvedDocs = monthStartStr
                ? managerDocs.filter(d => d.progress_details === '승인' && d.payment_date && d.payment_date >= monthStartStr && d.payment_date <= monthEndStr)
                : managerDocs.filter(d => d.progress_details === '승인');

            const totalApproval = approvedDocs.reduce((sum: number, d: any) => {
                const amt = typeof d.approval_amount === 'string' ? (parseInt(d.approval_amount) || 0) : Number(d.approval_amount) || 0;
                return sum + amt;
            }, 0);

            const caseCount = approvedDocs.length;
            const consultCount = consultDocs.length;
            const rate = consultCount > 0 ? Math.round((caseCount / consultCount) * 100) : 0;

            // 금액 포맷
            const eok = Math.floor(totalApproval / 10000);
            const man = Math.round((totalApproval % 10000) / 1000);
            let amountStr = '-';
            if (totalApproval > 0) {
                if (eok > 0) amountStr = man > 0 ? `${eok}억 ${man}천만원` : `${eok}억원`;
                else amountStr = `${Math.round(totalApproval / 1000)}천만원`;
            }

            return {
                name: person.name,
                consult: consultCount,
                case: caseCount,
                amount: amountStr,
                amountNum: totalApproval,
                rate: `${rate}%`,
                rateNum: rate
            };
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error('실무자 통계 조회 실패:', error);
        return NextResponse.json({ error: '실무자 통계 조회 실패' }, { status: 500 });
    }
}
