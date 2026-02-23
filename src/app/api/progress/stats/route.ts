import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const PROGRESS_STAGES = ['상담', '서류요청', '분석', '진행', '승인'];
const STATUS_LIST = ['보완', '보류'];

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const companyName = searchParams.get('companyName');
        const month = searchParams.get('month');

        let query = supabase.from('documents').select('progress_details, status, user_id, created_at');

        // 소속대표: 같은 소속의 모든 영업자 문서
        if (companyName) {
            // 해당 소속의 영업자 user_id 목록 조회
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
            // 일반 영업자: 자신의 문서만
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

        // 진행단계별 건수 계산
        const stageCounts = PROGRESS_STAGES.map(stage => {
            return filteredDocuments.filter((doc: any) => doc.progress_details === stage).length;
        });

        // 상태별 건수 계산 (보완, 보류만)
        const statusCounts = STATUS_LIST.map(status => {
            return filteredDocuments.filter((doc: any) => doc.status === status).length;
        });

        // 모든 레이블과 데이터 합치기
        const allLabels = [
            '상담',
            '서류요청',
            '분석',
            '진행',
            '승인',
            '보완',
            '보류'
        ];
        const allData = [...stageCounts, ...statusCounts];
        const allColors = ['#b0b9c6', '#f2e7a2', '#d8c9f1', '#82cbc4', '#a0c4ff', '#ffd6a5', '#ffadad'];
        const allBorderColors = ['#8a9aaa', '#e8d670', '#c9a5e8', '#5ca9a0', '#7aacff', '#ffb873', '#ff8b8b'];

        // Chart.js 형식으로 반환
        return NextResponse.json({
            labels: allLabels,
            datasets: [
                {
                    label: '진행상황',
                    data: allData,
                    backgroundColor: allColors,
                    borderColor: allBorderColors,
                    borderWidth: 1,
                    borderRadius: 4,
                }
            ]
        });
    } catch (error) {
        console.error('진행단계 통계 조회 실패:', error);
        return NextResponse.json(
            { error: '진행단계 통계 조회 실패' },
            { status: 500 }
        );
    }
}
