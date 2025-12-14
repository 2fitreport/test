import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json(
        { message: '상태 값이 필요합니다' },
        { status: 400 }
      );
    }

    const userId = parseInt(id, 10);

    const { data, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', userId)
      .select();

    if (error) throw error;

    return NextResponse.json(
      { message: '상태가 변경되었습니다', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('사용자 상태 변경 실패:', error);
    return NextResponse.json(
      { message: '사용자 상태 변경 실패' },
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
    const userId = parseInt(id, 10);

    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .select();

    if (error) throw error;

    return NextResponse.json(
      { message: '사용자가 삭제되었습니다', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('사용자 삭제 실패:', error);
    return NextResponse.json(
      { message: '사용자 삭제 실패' },
      { status: 500 }
    );
  }
}
