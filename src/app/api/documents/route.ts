import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            throw error;
        }

        // 데이터 변환 (timestamp를 ISO 문자열로 변환)
        const documents = data.map((doc: any) => ({
            ...doc,
            progress_start_date: doc.progress_start_date ? new Date(doc.progress_start_date).toISOString() : undefined,
        }));

        return NextResponse.json(documents);
    } catch (error) {
        console.error('서류 목록 조회 실패:', error);
        return NextResponse.json(
            { error: '서류 목록 조회 실패' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const { data, error } = await supabase
            .from('documents')
            .insert([body])
            .select();

        if (error) {
            throw error;
        }

        return NextResponse.json(data[0], { status: 201 });
    } catch (error) {
        console.error('서류 생성 실패:', error);
        return NextResponse.json(
            { error: '서류 생성 실패' },
            { status: 500 }
        );
    }
}
