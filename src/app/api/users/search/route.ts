import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
    try {
        const query = request.nextUrl.searchParams.get('q');

        if (!query) {
            return NextResponse.json(
                { error: 'Query parameter "q" is required' },
                { status: 400 }
            );
        }

        // 이름 또는 ID로 검색 (LIKE %)
        const { data, error } = await supabase
            .from('users')
            .select('id, user_id, name, position(name)')
            .or(`name.ilike.%${query}%,user_id.ilike.%${query}%`)
            .limit(10); // 최대 10명만 반환

        if (error) throw error;

        return NextResponse.json(data);
    } catch (error) {
        console.error('Error searching users:', error);
        return NextResponse.json(
            { error: 'Failed to search users' },
            { status: 500 }
        );
    }
}
