import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const docId = parseInt(id);

        // 액터 정보 파싱 (권한 체크용)
        let actorLevel = 0;
        const authToken = request.cookies.get('auth_token')?.value;
        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                const actorId = tokenData.user_id || 'unknown';
                const { data: actorUser } = await supabase
                    .from('users')
                    .select('position(level)')
                    .eq('user_id', actorId)
                    .single();
                if (actorUser) {
                    const positionArray = actorUser.position as any;
                    actorLevel = (Array.isArray(positionArray) ? positionArray[0]?.level : positionArray?.level) || 0;
                }
            } catch {}
        }

        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('id', docId)
            .single();

        if (error) {
            throw error;
        }

        if (!data) {
            return NextResponse.json(
                { error: '문서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        // 대표실무자(level 2)는 서류요청 단계 문서 접근 불가
        if (actorLevel === 2 && data.progress_details === '서류요청') {
            return NextResponse.json(
                { error: '접근 권한이 없습니다.' },
                { status: 403 }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error('문서 조회 실패:', error);
        return NextResponse.json(
            { error: '문서 조회 실패' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const docId = parseInt(id);

        // 액터 정보 파싱 (쿠키 토큰)
        let actorId = 'unknown';
        let actorName = '알 수 없음';
        let actorLevel = 0;
        const authToken = request.cookies.get('auth_token')?.value;
        if (authToken) {
            try {
                const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
                actorId = tokenData.user_id || 'unknown';
                const { data: actorUser } = await supabase
                    .from('users')
                    .select('name, position(level)')
                    .eq('user_id', actorId)
                    .single();
                if (actorUser) {
                    actorName = actorUser.name || actorId;
                    const positionArray = actorUser.position as any;
                    actorLevel = (Array.isArray(positionArray) ? positionArray[0]?.level : positionArray?.level) || 0;
                }
            } catch {}
        }

        // 변경 전 문서 조회
        const { data: prevDoc } = await supabase
            .from('documents')
            .select('status, progress_details, memos, title, company_name, manager_id, manager_name, business_number, type')
            .eq('id', docId)
            .single();

        // 문서 소유자 변경 방지 (모든 역할에 대해)
        if (body.user_id !== undefined) {
            return NextResponse.json(
                { error: '문서 소유자는 변경할 수 없습니다.' },
                { status: 403 }
            );
        }

        // 신용점수 검증 (1000 이하)
        if (body.company_credit_rating_kcb !== undefined) {
            const kcbValue = parseInt(body.company_credit_rating_kcb, 10);
            if (!isNaN(kcbValue) && kcbValue > 1000) {
                return NextResponse.json(
                    { error: 'KCB 신용점수는 1000 이하여야 합니다.' },
                    { status: 400 }
                );
            }
        }
        if (body.company_credit_rating_nice !== undefined) {
            const niceValue = parseInt(body.company_credit_rating_nice, 10);
            if (!isNaN(niceValue) && niceValue > 1000) {
                return NextResponse.json(
                    { error: 'NICE 신용점수는 1000 이하여야 합니다.' },
                    { status: 400 }
                );
            }
        }

        // 사업자등록번호 & 사업자 유형 검증
        if (body.business_number !== undefined || body.type !== undefined) {
            const bizNum = body.business_number ?? prevDoc?.business_number;
            const bizType = body.type ?? prevDoc?.type;
            if (bizNum && bizType) {
                const digits = String(bizNum).replace(/\D/g, '');
                if (digits.length === 10) {
                    const mid = parseInt(digits.substring(3, 5), 10);
                    if (bizType === 'individual' && mid >= 80 && mid <= 99) {
                        return NextResponse.json(
                            { error: '사업자등록번호가 법인사업자 번호입니다. 사업자 유형을 확인해주세요.' },
                            { status: 400 }
                        );
                    }
                    if (bizType === 'business' && mid >= 1 && mid <= 79) {
                        return NextResponse.json(
                            { error: '사업자등록번호가 개인사업자 번호입니다. 사업자 유형을 확인해주세요.' },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        // 승인요청/승인 단계에서는 대표자(level 1)만 수정 가능
        const currentProgressForCheck = prevDoc?.progress_details;
        if ((currentProgressForCheck === '승인요청' || currentProgressForCheck === '승인') && actorLevel !== 1) {
            return NextResponse.json(
                { error: '승인요청/승인 단계에서는 대표자만 수정할 수 있습니다.' },
                { status: 403 }
            );
        }

        // 심사 단계에서 대표자(level 1) 또는 배정된 실무자만 다음단계/보완요청/진행불가 가능
        const isAssignedManager = prevDoc?.manager_id && actorId === prevDoc.manager_id;
        if (currentProgressForCheck === '심사' && actorLevel !== 1 && !isAssignedManager) {
            const isProgressChange = body.progress_details !== undefined && body.progress_details !== prevDoc?.progress_details;
            const isStatusChange = body.status === '보완';
            if (isProgressChange || isStatusChange) {
                return NextResponse.json(
                    { error: '심사 단계에서는 대표자 또는 배정된 실무자만 단계 변경 및 보완/진행불가 처리를 할 수 있습니다.' },
                    { status: 403 }
                );
            }
        }

        // 권한 체크
        if (actorLevel === 4) {
            const currentProgress = prevDoc?.progress_details;
            const currentStatus = prevDoc?.status;

            // 분석, 심사, 진행 단계: 메모, 추가서류, status(검수로 변경) 수정 가능
            if (currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행') {
                const allowedKeys = ['memos', 'supplement_files', 'status'];
                const bodyKeys = Object.keys(body);
                const isOnlyAllowedFields = bodyKeys.every((k: string) => allowedKeys.includes(k));
                const isSecurityProcess = body.status === '검수';

                if (!isOnlyAllowedFields || (body.status !== undefined && !isSecurityProcess)) {
                    return NextResponse.json(
                        { error: '분석 이후 단계에서는 담당자메모와 추가서류만 수정할 수 있습니다.' },
                        { status: 403 }
                    );
                }
            }
            // 보완 상태: 메모, 추가서류, status(검수로 변경) 가능
            else if (currentStatus === '보완') {
                const allowedKeys = ['memos', 'supplement_files', 'status'];
                const bodyKeys = Object.keys(body);
                const isAllowedFields = bodyKeys.every((k: string) => allowedKeys.includes(k));
                const isSecurityProcess = body.status === '검수';

                if (!isAllowedFields || (body.status !== undefined && !isSecurityProcess)) {
                    return NextResponse.json(
                        { error: '보완 상태에서는 메모와 추가서류를 수정하고 보안완료만 가능합니다.' },
                        { status: 403 }
                    );
                }
            }
            // 기타 단계: CretabInfo 필드 수정 불가
            else {
                const cretabInfoFields = [
                    'company_credit_rating_kcb', 'company_credit_rating_nice', 'company_type', 'standard_classification',
                    'establishment_date', 'company_address', 'assessment_date', 'settlement_date',
                    'financial_data', 'income_data', 'extracted_images', 'cretop_none', 'cretop_file'
                ];

                const isModifyingCretabInfo = cretabInfoFields.some(field => body[field] !== undefined);

                if (isModifyingCretabInfo) {
                    return NextResponse.json(
                        { error: '영업자는 기업상세정보를 수정할 수 없습니다.' },
                        { status: 403 }
                    );
                }
            }
        } else if (actorLevel === 6) {
            // 검수자(level 6)는 승인요청/승인 단계 제외하고 수정 가능
            const currentProgress = prevDoc?.progress_details;
            const currentStatus = prevDoc?.status;

            if (currentProgress === '승인요청' || currentProgress === '승인') {
                return NextResponse.json(
                    { error: '승인 단계에서는 작업할 수 없습니다.' },
                    { status: 403 }
                );
            }

            // 분석/심사/진행 단계 보완 상태: 메모, 추가서류, status(검수로 변경)만 수정 가능
            if ((currentProgress === '분석' || currentProgress === '진행') && currentStatus === '보완') {
                const allowedKeys = ['memos', 'supplement_files', 'status'];
                const bodyKeys = Object.keys(body);
                const isOnlyAllowedFields = bodyKeys.every((k: string) => allowedKeys.includes(k));
                const isSecurityProcess = body.status === '검수';

                if (!isOnlyAllowedFields || (body.status !== undefined && !isSecurityProcess)) {
                    return NextResponse.json(
                        { error: '분석 단계 보완 상태에서는 메모와 추가서류만 수정할 수 있습니다.' },
                        { status: 403 }
                    );
                }
            }
            // OK - 다른 단계에서는 수정 가능
        } else if (actorLevel === 1 || actorLevel === 2) {
            // 대표자 및 대표실무자: progress_details 변경(이전단계, 초기화 등)은 모든 상태에서 가능
            const currentStatus = prevDoc?.status;
            const currentProgress = prevDoc?.progress_details;

            const hasProgressDetailsChange = body.progress_details !== undefined;
            const isStatusChange = body.status !== undefined && Object.keys(body).length === 1;
            const isEndAction = body.progress_details === '보류' && Object.keys(body).length === 1;

            // progress_details가 포함되면 모든 상태에서 가능 (이전단계, 초기화 등)
            if (hasProgressDetailsChange) {
                // OK - 항상 가능
            }
            // progress_details 없이 상태만 변경하는 경우
            else if (isEndAction) {
                // OK - 항상 가능
            }
            // 승인요청 단계에서는 status 변경(보완요청, 진행불가) 불가
            else if (currentProgress === '승인요청' && body.status !== undefined) {
                return NextResponse.json(
                    { error: '승인요청 단계에서는 상태 변경이 불가합니다.' },
                    { status: 403 }
                );
            }
            // 서류요청, 분석, 심사, 진행 단계에서는 status 변경도 자유롭게 가능 (보완, 보류, 정상 등)
            else if (currentProgress === '서류요청' || currentProgress === '분석' || currentProgress === '심사' || currentProgress === '진행') {
                // OK - 이 단계들에서는 모든 status 변경 가능
            }
            // 보완 상태: 보안완료(status='검수')만 가능
            else if (currentStatus === '보완' && body.status === '검수' && isStatusChange) {
                // OK
            }
            // 검수 상태: 검수완료(status='정상')만 가능
            else if (currentStatus === '검수' && body.status === '정상' && isStatusChange) {
                // OK
            }
            // 기타 상태: 보완요청(status='보완')만 가능
            else if (currentStatus !== '보류' && currentStatus !== '보완' && currentStatus !== '검수' && body.status === '보완' && isStatusChange) {
                // OK
            }
            else {
                return NextResponse.json(
                    { error: '현재 상태에서 불가능한 작업입니다.' },
                    { status: 403 }
                );
            }
        } else if (prevDoc?.manager_id === actorId) {
            // 실무자(level 3 또는 undefined): 다음 단계 이동, 상태 변경(보완요청, 진행불가 등)만 가능
            // 기업 정보 등 다른 필드는 수정 불가
            const currentProgress = prevDoc?.progress_details;

            if (currentProgress === '승인') {
                return NextResponse.json(
                    { error: '승인 단계에서는 작업할 수 없습니다.' },
                    { status: 403 }
                );
            }

            // progress_details 변경 (다음 단계 이동 또는 진행불가) 또는 status 변경만 허용
            const hasProgressDetailsChange = body.progress_details !== undefined;
            const isStatusChange = body.status !== undefined && Object.keys(body).length === 1;

            if (hasProgressDetailsChange) {
                // 진행불가(분석으로 돌아가면서 상태=보완)는 특례로 허용
                const isGoingBackToAnalysis = body.progress_details === '분석' && body.status === '보완';

                if (!isGoingBackToAnalysis) {
                    // 다음 단계로 이동만 가능 (이전 단계나 초기화는 불가)
                    const stepOrder = ['상담', '서류요청', '분석', '심사', '진행', '승인요청', '승인'];
                    const currentIndex = stepOrder.indexOf(currentProgress);
                    const newIndex = stepOrder.indexOf(body.progress_details);
                    if (newIndex !== currentIndex + 1) {
                        return NextResponse.json(
                            { error: '다음 단계로만 이동 가능합니다.' },
                            { status: 403 }
                        );
                    }
                }
                // OK - 다음 단계 이동 또는 진행불가 가능
            }
            // status 변경 (보완요청, 진행불가)
            else if (body.status === '보완' || body.status === '보류' || body.status === '검수' || (body.status === '정상' && prevDoc?.status === '검수')) {
                // OK - 보완요청, 진행불가, 보안완료, 검수완료 가능
            }
            else {
                return NextResponse.json(
                    { error: '문서 정보는 수정할 수 없습니다.' },
                    { status: 403 }
                );
            }
        } else {
            // 그 외 모든 권한: 진행 단계 변경 불가
            if (body.progress_details !== undefined || body.status !== undefined || body.manager_id !== undefined || body.manager_name !== undefined) {
                return NextResponse.json(
                    { error: '진행 단계를 변경할 권한이 없습니다.' },
                    { status: 403 }
                );
            }
        }

        // manager_name이 빈 문자열('')로 전송된 경우 덮어씌움 방지 (null은 의도적 초기화이므로 허용)
        if (body.manager_name === '') {
            delete body.manager_name;
        }
        if (body.manager_id === '') {
            delete body.manager_id;
        }

        // progress_start_date가 문자열 타임스탐프면 숫자로 변환
        if (body.progress_start_date && typeof body.progress_start_date === 'string') {
            const timestamp = parseInt(body.progress_start_date);
            if (!isNaN(timestamp)) {
                body.progress_start_date = timestamp;
            }
        }

        const { data, error } = await supabase
            .from('documents')
            .update(body)
            .eq('id', docId)
            .select();

        if (error) {
            throw error;
        }

        // 로그 생성
        if (prevDoc) {
            const logBase = {
                document_id: docId,
                document_title: prevDoc.title,
                company_name: prevDoc.company_name,
                actor_id: actorId,
                actor_name: actorName,
            };

            const logsToInsert: any[] = [];

            // 상태 변경 감지
            if (body.status !== undefined && body.status !== prevDoc.status) {
                logsToInsert.push({
                    ...logBase,
                    action_type: 'status_change',
                    old_value: prevDoc.status,
                    new_value: body.status,
                });
            }

            // 진행단계 변경 감지
            if (body.progress_details !== undefined && body.progress_details !== prevDoc.progress_details) {
                logsToInsert.push({
                    ...logBase,
                    action_type: 'progress_details_change',
                    old_value: prevDoc.progress_details,
                    new_value: body.progress_details,
                });
            }

            // 메모 변경 감지 (memos 필드가 명시적으로 포함되고, 실제로 배열인 경우에만)
            if ('memos' in body && Array.isArray(body.memos)) {
                const prevMemos: any[] = prevDoc.memos || [];
                const newMemos: any[] = body.memos;

                console.log('메모 변경 감지:', {
                    'prevMemos 길이': prevMemos.length,
                    'newMemos 길이': newMemos.length,
                    'prevMemos': prevMemos,
                    'newMemos': newMemos
                });

                if (newMemos.length > prevMemos.length) {
                    // 메모 추가: 마지막에 추가된 메모
                    const addedMemo = newMemos[newMemos.length - 1];
                    logsToInsert.push({
                        ...logBase,
                        action_type: 'memo_add',
                        new_value: addedMemo?.content || addedMemo?.text || JSON.stringify(addedMemo),
                    });
                } else if (newMemos.length < prevMemos.length) {
                    // 메모 삭제: 없어진 메모 찾기
                    const newIds = new Set(newMemos.map((m: any) => m.id));
                    const deletedMemo = prevMemos.find((m: any) => !newIds.has(m.id));
                    logsToInsert.push({
                        ...logBase,
                        action_type: 'memo_delete',
                        old_value: deletedMemo?.content || deletedMemo?.text || JSON.stringify(deletedMemo),
                    });
                }
            }

            // 실무자 배정 감지
            if (body.manager_id !== undefined && body.manager_id !== prevDoc.manager_id) {
                let newValue = '';
                if (body.manager_id) {
                    // manager_id가 설정된 경우, manager_name도 가져오기
                    const { data: managerData } = await supabase
                        .from('users')
                        .select('name')
                        .eq('user_id', body.manager_id)
                        .single();
                    newValue = managerData?.name || body.manager_id;
                } else {
                    newValue = '(제거됨)';
                }
                logsToInsert.push({
                    ...logBase,
                    action_type: 'manager_assigned',
                    old_value: prevDoc.manager_name || prevDoc.manager_id || '(없음)',
                    new_value: newValue,
                });
            }

            for (const log of logsToInsert) {
                const { error: logError } = await supabase.rpc('insert_document_log', {
                    p_document_id: docId,
                    p_document_title: log.document_title ?? null,
                    p_company_name: log.company_name ?? null,
                    p_action_type: log.action_type,
                    p_actor_id: log.actor_id,
                    p_actor_name: log.actor_name,
                    p_old_value: log.old_value ?? null,
                    p_new_value: log.new_value ?? null,
                });
                if (logError) {
                    console.error('로그 저장 실패:', logError);
                }
            }
        }

        return NextResponse.json(data[0]);
    } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const errorDetails = error?.details || error?.hint || '';
        console.error('기업 업데이트 실패:', {
            message: errorMessage,
            details: errorDetails,
            fullError: error
        });
        return NextResponse.json(
            { error: '기업 업데이트 실패', message: errorMessage, details: errorDetails },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const docId = parseInt(id);

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

        // 현재 사용자 정보 조회
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

        // 먼저 문서 조회하여 전체 데이터 가져오기 (히스토리 저장용)
        const { data: docData, error: fetchError } = await supabase
            .from('documents')
            .select('*')
            .eq('id', docId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        // 검수자(Level 6)인 경우: 대표실무자로 넘어간 문서는 삭제 불가
        if (userLevel === 6) {
            const progress = docData?.progress_details;
            if (progress !== '검수자') {
                return NextResponse.json(
                    { error: '대표실무자에게 넘어간 문서는 삭제할 수 없습니다.' },
                    { status: 403 }
                );
            }
        }

        // 히스토리 테이블에 삭제할 문서 데이터 저장
        const historyData = {
            original_id: docData.id,
            user_id: docData.user_id,
            user_name: docData.user_name,
            document_type: docData.document_type,
            title: docData.title,
            status: docData.status,
            progress_status: docData.progress_status,
            submitted_date: docData.submitted_date,
            completed_date: docData.completed_date,
            progress_start_date: docData.progress_start_date,
            progress_end_time: docData.progress_end_time,
            stopped_time: docData.stopped_time,
            reason: docData.reason,
            reason_read: docData.reason_read,
            files: docData.files,
            type: docData.type,
            company_name: docData.company_name,
            representative_name: docData.representative_name,
            manager_name: docData.manager_name,
            progress_details: docData.progress_details,
            business_number: docData.business_number,
            phone: docData.phone,
            manager_id: docData.manager_id,
            memos: docData.memos,
            inspector_id: docData.inspector_id,
            cretop_file: docData.cretop_file,
            cretop_none: docData.cretop_none,
            original_created_at: docData.created_at,
            original_updated_at: docData.updated_at,
            deleted_by_id: currentUser.user_id,
            deleted_by_name: currentUser.name || currentUser.user_id,
        };

        const { error: historyError } = await supabase
            .from('documents_history')
            .insert(historyData);

        if (historyError) {
            console.error('히스토리 저장 실패:', historyError);
            // 히스토리 저장 실패해도 삭제는 진행
        }

        // 스토리지에서 파일 삭제
        if (docData && docData.files && Array.isArray(docData.files) && docData.files.length > 0) {
            const filePaths = docData.files.map((file: any) => file.path);

            if (filePaths.length > 0) {
                const { error: deleteStorageError } = await supabase.storage
                    .from('documents')
                    .remove(filePaths);

                if (deleteStorageError) {
                    console.error('스토리지 파일 삭제 중 오류:', deleteStorageError);
                    // 스토리지 삭제 실패해도 문서 삭제는 진행
                }
            }
        }

        // 데이터베이스에서 문서 삭제
        const { error: deleteError } = await supabase
            .from('documents')
            .delete()
            .eq('id', docId);

        if (deleteError) {
            throw deleteError;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('기업 삭제 실패:', error);
        return NextResponse.json(
            { error: '기업 삭제 실패' },
            { status: 500 }
        );
    }
}
