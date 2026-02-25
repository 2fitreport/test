import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; memoId: string }> }
) {
    try {
        const { id, memoId } = await params;
        const docId = parseInt(id);

        // 기존 메모 조회
        const { data: docData, error: fetchError } = await supabase
            .from('documents')
            .select('memos')
            .eq('id', docId)
            .single();

        if (fetchError) {
            throw fetchError;
        }

        // 메모 삭제 (해당 메모 ID 제거)
        const memos = docData?.memos || [];
        const updatedMemos = memos.filter((m: any) => m.id !== memoId);

        // DB에 저장
        const { error: updateError } = await supabase
            .from('documents')
            .update({ memos: updatedMemos })
            .eq('id', docId);

        if (updateError) {
            throw updateError;
        }

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        console.error('메모 삭제 실패:', error);
        return NextResponse.json(
            { error: '메모 삭제 실패' },
            { status: 500 }
        );
    }
}
