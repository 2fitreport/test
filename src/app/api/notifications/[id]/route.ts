import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: 알림 상세 조회
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const notificationId = parseInt(id);
        const userId = request.nextUrl.searchParams.get('userId');

        const { data, error } = await supabase
            .from('notifications')
            .select('*, sender:users!sender_id(id, name, user_id, position_id)')
            .eq('id', notificationId)
            .single();

        if (error || !data) {
            return NextResponse.json(
                { error: '알림을 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        // 읽음 상태 확인
        let is_read = false;
        if (userId) {
            const { data: readData } = await supabase
                .from('notification_reads')
                .select('id')
                .eq('notification_id', notificationId)
                .eq('user_id', parseInt(userId))
                .maybeSingle();

            is_read = !!readData;
        }

        return NextResponse.json({ ...data, is_read });
    } catch (error) {
        console.error('알림 상세 조회 실패:', error);
        return NextResponse.json(
            { error: '알림 상세 조회 실패' },
            { status: 500 }
        );
    }
}

// DELETE: 알림 삭제
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const notificationId = parseInt(id);

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId);

        if (error) throw error;

        return NextResponse.json({ message: '알림이 삭제되었습니다.' });
    } catch (error) {
        console.error('알림 삭제 실패:', error);
        return NextResponse.json(
            { error: '알림 삭제 실패' },
            { status: 500 }
        );
    }
}
