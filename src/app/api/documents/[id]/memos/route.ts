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

        const { data, error } = await supabase
            .from('documents')
            .select('memos')
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

        return NextResponse.json({
            memos: data.memos || []
        });
    } catch (error) {
        console.error('메모 조회 실패:', error);
        return NextResponse.json(
            { error: '메모 조회 실패' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const docId = parseInt(id);
        const { content, author, author_id } = await request.json();

        if (!content?.trim()) {
            return NextResponse.json(
                { error: '메모 내용을 입력해주세요.' },
                { status: 400 }
            );
        }

        // 기존 메모 조회
        const { data: docData, error: fetchError } = await supabase
            .from('documents')
            .select('memos')
            .eq('id', docId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        // 새 메모 생성
        const newMemo = {
            id: `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            author: author || '현재사용자',
            author_id: author_id || '0',
            content: content.trim(),
            created_at: new Date().toISOString(),
            replies: []
        };

        // 기존 메모에 새 메모 추가
        const updatedMemos = [...(docData?.memos || []), newMemo];

        // DB에 저장
        const { error: updateError } = await supabase
            .from('documents')
            .update({ memos: updatedMemos })
            .eq('id', docId);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ memo: newMemo }, { status: 201 });
    } catch (error) {
        console.error('메모 추가 실패:', error);
        return NextResponse.json(
            { error: '메모 추가 실패' },
            { status: 500 }
        );
    }
}
