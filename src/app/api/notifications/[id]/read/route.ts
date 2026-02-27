import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// POST: 읽음 처리
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const notificationId = parseInt(id);
        const body = await request.json();
        const { user_id } = body;

        if (!user_id) {
            return NextResponse.json(
                { error: 'user_id가 필요합니다.' },
                { status: 400 }
            );
        }

        // upsert로 중복 방지
        const { data, error } = await supabase
            .from('notification_reads')
            .upsert(
                { notification_id: notificationId, user_id },
                { onConflict: 'notification_id,user_id' }
            )
            .select()
            .single();

        if (error) throw error;

        return NextResponse.json({ message: '읽음 처리 완료', data });
    } catch (error) {
        console.error('읽음 처리 실패:', error);
        return NextResponse.json(
            { error: '읽음 처리 실패' },
            { status: 500 }
        );
    }
}
