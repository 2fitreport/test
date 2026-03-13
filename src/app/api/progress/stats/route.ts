import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const PROGRESS_STAGES = ['상담신청', '서류요청', '분석', '심사', '진행', '승인요청', '승인'];
const STATUS_LIST = ['정상', '보완', '보류', '검수'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const companyName = searchParams.get('companyName');
        const month = searchParams.get('month');

        let query = supabase.from('documents').select('progress_details, status, user_id, created_at');

        // 소속대표: 같은 소속의 모든 영업자 문서
        if (companyName) {
            const { data: usersData } = await supabase
                .from('users')
                .select('user_id')
                .eq('company_name', companyName)
                .eq('position_id', 4);

            const userIds = (usersData || []).map((u: any) => u.user_id);
            if (userIds.length > 0) {
                query = query.in('user_id', userIds);
            } else {
                query = query.eq('user_id', '__none__');
            }
        } else if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: documents, error } = await query;

        if (error) throw error;

        // 월 필터링
        let filteredDocuments = documents || [];
        if (month) {
            const [year, monthNum] = month.split('-');
            filteredDocuments = filteredDocuments.filter((doc: any) => {
                if (!doc.created_at) return false;
                const docDate = new Date(doc.created_at);
                return docDate.getFullYear() === parseInt(year) &&
                       docDate.getMonth() + 1 === parseInt(monthNum);
            });
        }

        // 진행단계별 건수
        const stageCounts = PROGRESS_STAGES.map(stage =>
            filteredDocuments.filter((doc: any) => doc.progress_details === stage).length
        );

        // 상태별 건수
        const statusCounts = STATUS_LIST.map(status =>
            filteredDocuments.filter((doc: any) => doc.status === status).length
        );

        return NextResponse.json({
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
        });
    } catch (error) {
        console.error('진행단계 통계 조회 실패:', error);
        return NextResponse.json(
            { error: '진행단계 통계 조회 실패' },
            { status: 500 }
        );
    }
}
