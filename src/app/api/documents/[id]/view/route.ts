import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// 뷰 페이지용 통합 API - 한 번의 호출로 모든 필요한 데이터 반환
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const docId = parseInt(id);

        // 인증 확인
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        let tokenData;
        try {
            const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
            tokenData = JSON.parse(decodedToken);
        } catch {
            return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 });
        }

        const userId = tokenData.user_id;

        // 현재 사용자와 문서 조회
        const [
            { data: currentUser },
            { data: document }
        ] = await Promise.all([
            supabase.from('users').select('*, position(level)').eq('user_id', userId).single(),
            supabase.from('documents').select('*').eq('id', docId).single()
        ]);

        if (!currentUser) {
            return NextResponse.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (!document) {
            return NextResponse.json({ error: '문서를 찾을 수 없습니다.' }, { status: 404 });
        }

        const userLevel = currentUser.position?.level;
        const userIdNumber = currentUser.id;

        // 영업자(level 4)는 users 데이터 조회 안 함 (보안)
        // 소속대표는 작성자 정보 표시를 위해 조회
        // 검수자(level 6)와 대표/대표실무자(level 1,2)는 필요시 조회
        let users = null;
        const isAffiliationRep = userLevel === 4 && (currentUser.is_affiliation_representative || false);
        if (userLevel !== 4 || isAffiliationRep) {
            const { data: usersData } = await supabase
                .from('users')
                .select('id, user_id, name, position_id, position(id, name, level), company_name, supervisor_id');
            users = usersData;
        }

        // 권한 확인
        // 영업자(level=4)는 자신이 작성한 문서 또는 submitter_id가 본인인 문서만
        // 소속대표는 같은 소속 영업자의 문서도 열람 가능
        if (userLevel === 4 && userId !== document.user_id && userId !== document.submitter_id) {
            // 소속대표 여부 및 소속 확인
            const isAffiliationRep = currentUser.is_affiliation_representative || false;
            if (!isAffiliationRep) {
                return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
            }

            // 소속대표: 같은 소속의 영업자 문서인지 확인
            const { data: myAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userIdNumber);

            const myAffIds = (myAffiliations || []).map((a: any) => a.affiliation_id);

            if (myAffIds.length === 0) {
                return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
            }

            // 문서 작성자의 DB id 조회
            const { data: docAuthor } = await supabase
                .from('users')
                .select('id')
                .eq('user_id', document.user_id)
                .single();

            if (!docAuthor) {
                return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
            }

            // 문서 작성자가 같은 소속인지 확인
            const { data: authorAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', docAuthor.id);

            const authorAffIds = (authorAffiliations || []).map((a: any) => a.affiliation_id);
            const isSameAffiliation = myAffIds.some((id: number) => authorAffIds.includes(id));

            if (!isSameAffiliation) {
                return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
            }
        }

        // 검수자(level=6) 권한 확인
        let inspectorAffiliations: number[] = [];
        if (userLevel === 6) {
            const { data: affiliationsData } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userIdNumber);

            inspectorAffiliations = affiliationsData?.map((a: any) => a.affiliation_id) || [];

            // 문서 작성자의 소속 확인
            const { data: authorAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', users?.find((u: any) => u.user_id === document.user_id)?.id || 0);

            const authorAffiliationIds = authorAffiliations?.map((a: any) => a.affiliation_id) || [];

            const isAffiliatedDocument = inspectorAffiliations.some((id: number) => authorAffiliationIds.includes(id));
            const isPastInspector = document.inspector_id === userId;

            if (!isAffiliatedDocument && !isPastInspector) {
                return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
            }
        }

        // 대표실무자(level 2) 권한 확인: 서류요청, 상담요청 단계 문서 접근 불가
        if (userLevel === 2 && (document.progress_details === '서류요청' || document.progress_details === '상담요청')) {
            return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
        }

        // 실무자(manager) 권한 확인 (level 3 또는 position이 없는 경우)
        if (userLevel === 3 || userLevel === null || userLevel === undefined) {
            // 실무자는 자신의 manager_id가 지정된 문서만 접근 가능
            const isManager = document.manager_id === userId || document.manager_id === String(userIdNumber);
            if (!document.manager_id || !isManager) {
                console.log('실무자 접근 거부:', {
                    userId,
                    userIdNumber,
                    docManagerId: document.manager_id,
                    isManager
                });
                return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
            }
        }

        // 담당검수자 정보 조회
        let supervisorInfo = null;
        const documentOwner = users?.find((u: any) => u.user_id === document.user_id);
        if (documentOwner?.supervisor_id) {
            const supervisor = users?.find((u: any) => u.id === documentOwner.supervisor_id);
            if (supervisor) {
                supervisorInfo = { name: supervisor.name, user_id: supervisor.user_id };
            }
        }

        // 영업자(level 4)에게는 cretop_file 제거
        const responseDocument = { ...document };
        if (userLevel === 4) {
            responseDocument.cretop_file = null;
        }

        return NextResponse.json({
            document: responseDocument,
            users: users || [],
            currentUser: {
                id: currentUser.id,
                user_id: currentUser.user_id,
                name: currentUser.name,
                level: userLevel
            },
            supervisorInfo,
            inspectorAffiliations
        });
    } catch (error) {
        console.error('뷰 데이터 조회 실패:', error);
        return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 });
    }
}
