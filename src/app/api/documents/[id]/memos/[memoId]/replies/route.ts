import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; memoId: string }> }
) {
    try {
        const { id, memoId } = await params;
        const docId = parseInt(id);
        const { content, author, author_id } = await request.json();

        if (!content?.trim()) {
            return NextResponse.json(
                { error: '답글 내용을 입력해주세요.' },
                { status: 400 }
            );
        }

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

        // 기존 메모 조회
        const { data: docData, error: fetchError } = await supabase
            .from('documents')
            .select('memos, progress_details')
            .eq('id', docId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        // 승인요청/승인 단계에서는 대표자(level 1)만 댓글 추가 가능
        const progressDetails = docData?.progress_details;
        if ((progressDetails === '승인요청' || progressDetails === '승인') && actorLevel !== 1) {
            return NextResponse.json(
                { error: '승인 단계에서는 대표자만 댓글을 추가할 수 있습니다.' },
                { status: 403 }
            );
        }

        // 해당 메모 찾기
        const memos = docData?.memos || [];
        const memoIndex = memos.findIndex((m: any) => m.id === memoId);

        if (memoIndex === -1) {
            return NextResponse.json(
                { error: '메모를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        // 새 답글 생성
        const newReply = {
            id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            author: author || '현재사용자',
            author_id: author_id || '0',
            content: content.trim(),
            created_at: new Date().toISOString()
        };

        // 메모에 답글 추가
        memos[memoIndex].replies = [...(memos[memoIndex].replies || []), newReply];

        // DB에 저장
        const { error: updateError } = await supabase
            .from('documents')
            .update({ memos })
            .eq('id', docId);

        if (updateError) {
            throw updateError;
        }

        // 업데이트된 전체 메모 반환
        return NextResponse.json({
            memo: memos[memoIndex]
        }, { status: 201 });
    } catch (error) {
        console.error('답글 추가 실패:', error);
        return NextResponse.json(
            { error: '답글 추가 실패' },
            { status: 500 }
        );
    }
}
