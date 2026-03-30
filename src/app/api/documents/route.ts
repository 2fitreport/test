import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(request: NextRequest) {
    try {
        // 인증 확인
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json(
                { error: '인증이 필요합니다.' },
                { status: 401 }
            );
        }

        // 토큰 디코딩
        let tokenData;
        try {
            const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
            tokenData = JSON.parse(decodedToken);
        } catch (err) {
            return NextResponse.json(
                { error: '유효하지 않은 토큰입니다.' },
                { status: 401 }
            );
        }

        const userId = tokenData.user_id;

        // 현재 사용자 정보 조회 (역할 레벨 확인용)
        const { data: currentUser, error: userError } = await supabase
            .from('users')
            .select('*, position(level)')
            .eq('user_id', userId)
            .single();

        if (userError || !currentUser) {
            return NextResponse.json(
                { error: '사용자 정보를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        const userLevel = currentUser.position?.level;
        const userIdNumber = currentUser.id;

        // 모든 문서 조회
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        let filteredDocuments = data;

        // 역할별 필터링
        // 실무자 (position이 없는 경우, manager_id로 식별): 자신에게 배정받은 문서만
        if (!userLevel) {
            filteredDocuments = data.filter((doc: any) => doc.manager_id === userId);
        }
        // Level 3 (실무자): 자신에게 배정받은 문서만 (manager_id = 자신의 user_id)
        else if (userLevel === 3) {
            filteredDocuments = data.filter((doc: any) => doc.manager_id === userId);
        }
        // Level 4 (영업자): 자신의 문서 + 자신이 등록한 상담신청 문서(submitter_id)
        else if (userLevel === 4) {
            filteredDocuments = data.filter((doc: any) =>
                doc.user_id === userId || doc.submitter_id === userId
            );
        }
        // Level 6 (검수자): 자신의 소속에 해당하는 영업자 문서만
        else if (userLevel === 6) {
            // 검수자의 소속 조회 (user_affiliations 기준)
            const { data: affiliationsData, error: affiliationsError } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userIdNumber);

            if (!affiliationsError && affiliationsData && affiliationsData.length > 0) {
                const affiliationIds = affiliationsData.map((a: any) => a.affiliation_id);

                // 해당 소속에 속한 영업자들의 user_id 조회
                const { data: usersData, error: usersError } = await supabase
                    .from('user_affiliations')
                    .select('user_id')
                    .in('affiliation_id', affiliationIds);

                if (!usersError && usersData) {
                    const assignedUserIds = usersData.map((u: any) => {
                        // user_affiliations.user_id는 users.id (숫자)이므로 users 테이블에서 user_id(문자) 매핑 필요
                        return u.user_id;
                    });

                    // 같은 소속의 users.id 목록으로 users.user_id 조회
                    const { data: userIdData } = await supabase
                        .from('users')
                        .select('user_id')
                        .in('id', assignedUserIds);

                    const assignedUserStringIds = (userIdData || []).map((u: any) => u.user_id);

                    filteredDocuments = data.filter((doc: any) =>
                        assignedUserStringIds.includes(doc.user_id) ||
                        doc.inspector_id === userId
                    );
                }
            }
        }
        // Level 1 (대표자): 필터링 없음 (모든 문서)
        // Level 2 (대표실무자): 서류요청 단계 이전의 문서는 제외
        else if (userLevel === 2) {
            filteredDocuments = data.filter((doc: any) =>
                doc.progress_details !== '서류요청' && doc.progress_details !== '상담신청'
            );
        }

        // progress_start_date를 string으로 변환하여 반환 (TimeAgo 컴포넌트용)
        const documents = filteredDocuments.map((doc: any) => ({
            ...doc,
            progress_start_date: doc.progress_start_date ? String(doc.progress_start_date) : undefined,
        }));

        return NextResponse.json(documents);
    } catch (error) {
        console.error('기업 목록 조회 실패:', error);
        return NextResponse.json(
            { error: '기업 목록 조회 실패' },
            { status: 500 }
        );
    }
}

function validateBusinessNumberType(businessNumber: string, type: string): string | null {
    const digits = businessNumber.replace(/\D/g, '');
    if (digits.length !== 10) return null; // 형식 오류는 별도 검증
    const mid = parseInt(digits.substring(3, 5), 10);
    if (type === 'individual' && mid >= 80 && mid <= 99) {
        return '사업자등록번호가 법인사업자 번호입니다. 사업자 유형을 확인해주세요.';
    }
    if (type === 'business' && mid >= 1 && mid <= 79) {
        return '사업자등록번호가 개인사업자 번호입니다. 사업자 유형을 확인해주세요.';
    }
    return null;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // 인증 확인 및 영업자 소속 검증
        const authToken = request.cookies.get('auth_token')?.value;
        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                const actorUserId = tokenData.user_id;

                const { data: actorUser } = await supabase
                    .from('users')
                    .select('id, position(level)')
                    .eq('user_id', actorUserId)
                    .single();

                const actorLevel = (actorUser?.position as any)?.level;

                // 영업자(level 4)는 소속 없으면 문서 등록 불가
                if (actorLevel === 4 && actorUser) {
                    const { data: affiliations } = await supabase
                        .from('user_affiliations')
                        .select('id')
                        .eq('user_id', actorUser.id);

                    if (!affiliations || affiliations.length === 0) {
                        return NextResponse.json(
                            { error: '소속이 없는 영업자는 문서를 등록할 수 없습니다.' },
                            { status: 403 }
                        );
                    }
                }
            } catch {}
        }

        console.log('저장될 데이터:', {
            submitted_date: body.submitted_date,
            completed_date: body.completed_date
        });

        // 사업자등록번호 & 사업자 유형 검증
        if (body.business_number && body.type) {
            const typeError = validateBusinessNumberType(body.business_number, body.type);
            if (typeError) {
                return NextResponse.json({ error: typeError }, { status: 400 });
            }
        }

        // memos가 없으면 빈 배열로 초기화
        const documentData = {
            ...body,
            memos: body.memos || []
        };

        const { data, error } = await supabase
            .from('documents')
            .insert([documentData])
            .select();

        if (error) {
            throw error;
        }

        console.log('저장된 데이터:', {
            submitted_date: data[0]?.submitted_date,
            completed_date: data[0]?.completed_date
        });

        return NextResponse.json(data[0], { status: 201 });
    } catch (error: unknown) {
        console.error('기업 생성 실패:', error);
        let errorMessage = '알 수 없는 오류';
        if (error instanceof Error) {
            errorMessage = error.message;
        } else if (error && typeof error === 'object' && 'message' in error) {
            errorMessage = String((error as { message: unknown }).message);
        } else if (typeof error === 'string') {
            errorMessage = error;
        } else {
            errorMessage = JSON.stringify(error);
        }
        return NextResponse.json(
            { error: `기업 생성 실패: ${errorMessage}` },
            { status: 500 }
        );
    }
}
