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
    const userId = parseInt(id, 10);

    // status만 변경하는 경우
    if (Object.keys(body).length === 1 && body.status) {
      const { status } = body;

      const { data, error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', userId)
        .select(`
          id,
          user_id,
          name,
          position_id,
          position(id, name, level),
          status,
          phone,
          email_display,
          address,
          address_detail,
          company_name,
          password,
          created_at
        `)
        .single();

      if (error) throw error;

      return NextResponse.json(
        { message: '상태가 변경되었습니다', data },
        { status: 200 }
      );
    }

    // 전체 정보 수정
    const { name, position_id, password, phone, email_display, address, address_detail, company_name, status } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (position_id !== undefined) updateData.position_id = position_id;
    if (password !== undefined) updateData.password = password;
    if (phone !== undefined) updateData.phone = phone;
    if (email_display !== undefined) updateData.email_display = email_display;
    if (address !== undefined) updateData.address = address;
    if (address_detail !== undefined) updateData.address_detail = address_detail;
    if (company_name !== undefined) updateData.company_name = company_name;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select(`
        id,
        user_id,
        name,
        position_id,
        position(id, name, level),
        status,
        phone,
        email_display,
        address,
        address_detail,
        company_name,
        password,
        created_at
      `)
      .single();

    if (error) throw error;

    return NextResponse.json(
      { message: '사용자 정보가 수정되었습니다', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('사용자 수정 실패:', error);
    return NextResponse.json(
      { message: '사용자 수정 실패' },
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
