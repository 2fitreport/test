import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const docId = parseInt(id);

        const { data, error } = await supabase
            .from('documents')
            .update(body)
            .eq('id', docId)
            .select();

        if (error) {
            throw error;
        }

        return NextResponse.json(data[0]);
    } catch (error) {
        console.error('서류 업데이트 실패:', error);
        return NextResponse.json(
            { error: '서류 업데이트 실패' },
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

        const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', docId);

        if (error) {
            throw error;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('서류 삭제 실패:', error);
        return NextResponse.json(
            { error: '서류 삭제 실패' },
            { status: 500 }
        );
    }
}
