import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      user_id, name, password, phone, email, 
      address, address_detail, company_name,
      bank_name, account_holder, account_number 
    } = body;

    // 필수 항목 검증
    if (!user_id || !name || !password) {
      return NextResponse.json(
        { message: '필수 항목(아이디, 이름, 비밀번호)을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 아이디 중복 체크
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (existingUser) {
      return NextResponse.json(
        { message: '이미 존재하는 사용자 ID입니다.' },
        { status: 409 }
      );
    }

    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          user_id,
          name,
          password,
          phone: phone || null,
          email_display: email || null, // 프론트의 email을 email_display로 매핑
          address: address || null,
          address_detail: address_detail || null,
          company_name: company_name || null,
          bank_name: bank_name || null,
          account_holder: account_holder || null,
          account_number: account_number || null,
          status: 'pending',
          position_id: 6, // 기본 직급
        },
      ])
      .select('id, user_id, name, status, created_at')
      .single();

    if (createError) throw createError;

    return NextResponse.json(
      { message: '회원가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.', data: newUser },
      { status: 201 }
    );
  } catch (error) {
    console.error('회원가입 신청 실패:', error);
    return NextResponse.json(
      { message: '회원가입 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
