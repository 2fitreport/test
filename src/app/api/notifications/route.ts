import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// GET: 알림 목록 조회
export async function GET(request: NextRequest) {
    try {
        const userId = request.nextUrl.searchParams.get('userId');

        if (!userId) {
            return NextResponse.json(
                { error: 'userId가 필요합니다.' },
                { status: 400 }
            );
        }

        const userIdNum = parseInt(userId);

        // 1. 전체 공지 (global)
        const { data: globalNotifications, error: globalError } = await supabase
            .from('notifications')
            .select('*, sender:users!sender_id(id, name, user_id, position_id)')
            .eq('type', 'global')
            .order('created_at', { ascending: false });

        if (globalError) throw globalError;

        // 2. 개인 알림 (personal) - receiver_id가 일치하는 것
        const { data: personalNotifications, error: personalError } = await supabase
            .from('notifications')
            .select('*, sender:users!sender_id(id, name, user_id, position_id)')
            .eq('type', 'personal')
            .eq('receiver_id', userIdNum)
            .order('created_at', { ascending: false });

        if (personalError) throw personalError;

        // 합치기
        const allNotifications = [...(globalNotifications || []), ...(personalNotifications || [])]
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // 3. 해당 유저의 읽음 기록 조회
        const notificationIds = allNotifications.map(n => n.id);
        let readSet = new Set<number>();

        if (notificationIds.length > 0) {
            const { data: reads, error: readError } = await supabase
                .from('notification_reads')
                .select('notification_id')
                .eq('user_id', userIdNum)
                .in('notification_id', notificationIds);

            if (readError) throw readError;
            readSet = new Set((reads || []).map(r => r.notification_id));
        }

        // is_read 필드 추가
        const result = allNotifications.map(n => ({
            ...n,
            is_read: readSet.has(n.id)
        }));

        return NextResponse.json(result);
    } catch (error) {
        console.error('알림 조회 실패:', error);
        return NextResponse.json(
            { error: '알림 조회 실패' },
            { status: 500 }
        );
    }
}

// POST: 알림 생성
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { title, content, type, sender_id, receiver_id, receiver_ids } = body;

        if (!title || !content || !type || !sender_id) {
            return NextResponse.json(
                { error: '필수 항목이 누락되었습니다.' },
                { status: 400 }
            );
        }

        if (type === 'personal' && !receiver_id && (!receiver_ids || receiver_ids.length === 0)) {
            return NextResponse.json(
                { error: '개인 알림은 수신자를 지정해야 합니다.' },
                { status: 400 }
            );
        }

        let data;
        let error;

        if (type === 'personal' && receiver_ids && receiver_ids.length > 0) {
            const notifications = receiver_ids.map((rid: number) => ({
                title,
                content,
                type,
                sender_id,
                receiver_id: rid
            }));
            const result = await supabase.from('notifications').insert(notifications).select();
            data = result.data;
            error = result.error;
        } else {
            const { data: singleData, error: singleError } = await supabase
                .from('notifications')
                .insert([{
                    title,
                    content,
                    type,
                    sender_id,
                    receiver_id: type === 'personal' ? receiver_id : null,
                }])
                .select()
                .single();
            data = singleData;
            error = singleError;
        }

        if (error) throw error;

        return NextResponse.json(data, { status: 201 });
    } catch (error) {
        console.error('알림 생성 실패:', error);
        return NextResponse.json(
            { error: '알림 생성 실패' },
            { status: 500 }
        );
    }
}
