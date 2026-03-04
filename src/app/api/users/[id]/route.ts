import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseInt(id, 10);

    const { data, error } = await supabase
      .from('users')
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
        supervisor_id,
        is_affiliation_representative,
        bank_name,
        account_holder,
        account_number,
        created_at
      `)
      .eq('id', userId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error: any) {
    console.error('사용자 조회 실패:', error);
    return NextResponse.json(
      { message: '사용자 조회 실패', error: error?.message || error },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 인증 토큰 검증
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json({ message: '인증이 필요합니다.' }, { status: 401 });
    }

    let requesterId: number;
    try {
      const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
      requesterId = tokenData.id;
    } catch {
      return NextResponse.json({ message: '유효하지 않은 토큰입니다.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const userId = parseInt(id, 10);

    // 자기 자신의 비밀번호 변경인 경우 별도 처리 (모든 직급 허용)
    if (requesterId === userId && body.password !== undefined && Object.keys(body).filter(k => k !== 'currentPassword').length === 1) {
      // 현재 비밀번호 검증
      const { data: userCheck } = await supabase
        .from('users')
        .select('password')
        .eq('id', userId)
        .single();

      if (!body.currentPassword || userCheck?.password !== body.currentPassword) {
        return NextResponse.json({ message: '현재 비밀번호가 올바르지 않습니다.' }, { status: 400 });
      }

      const { error } = await supabase
        .from('users')
        .update({ password: body.password })
        .eq('id', userId);

      if (error) throw error;
      return NextResponse.json({ message: '비밀번호가 변경되었습니다.' }, { status: 200 });
    }

    // 그 외 수정은 level 1: 대표, level 2: 대표실무자만 허용
    const { data: requester } = await supabase
      .from('users')
      .select('position(level)')
      .eq('id', requesterId)
      .single();

    const requesterLevel = (requester?.position as any)?.level;
    if (requesterLevel !== 1 && requesterLevel !== 2) {
      return NextResponse.json({ message: '권한이 없습니다.' }, { status: 403 });
    }

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
          supervisor_id,
          bank_name,
          account_holder,
          account_number,
          created_at
        `)
        .single();

      if (error) throw error;

      return NextResponse.json(
        { message: '상태가 변경되었습니다', data },
        { status: 200 }
      );
    }

    // status와 함께 다른 정보(소속, 소속대표 여부 등)를 업데이트하는 경우
    const { status, company_name, is_affiliation_representative, affiliations, name, position_id, password, phone, email_display, address, address_detail, bank_name, account_holder, account_number } = body;

    // 소속대표로 선임하는 경우 기존 소속대표 해임 처리
    if (status === 'active' && is_affiliation_representative === true && company_name) {
      const { error: resetError } = await supabase
        .from('users')
        .update({ is_affiliation_representative: false })
        .eq('company_name', company_name)
        .eq('is_affiliation_representative', true);
      
      if (resetError) throw resetError;
    }

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
    if (bank_name !== undefined) updateData.bank_name = bank_name;
    if (account_holder !== undefined) updateData.account_holder = account_holder;
    if (account_number !== undefined) updateData.account_number = account_number;
    if (is_affiliation_representative !== undefined) updateData.is_affiliation_representative = is_affiliation_representative;

    // position level 확인 (새로운 position 또는 기존 position)
    let newPositionLevel = 0;
    let isInspector = false;
    let isSalesPerson = false;

    if (position_id !== undefined) {
      // 새로운 position이 지정된 경우
      const { data: positionData } = await supabase
        .from('position')
        .select('level')
        .eq('id', position_id)
        .single();
      newPositionLevel = positionData?.level || 0;
      isInspector = newPositionLevel === 6;
      isSalesPerson = newPositionLevel === 4;
    } else {
      // position이 지정되지 않은 경우 현재 position 조회
      const { data: currentUser } = await supabase
        .from('users')
        .select('*, position(level)')
        .eq('id', userId)
        .single();
      const currentLevel = currentUser?.position?.level || 0;
      isInspector = currentLevel === 6;
      isSalesPerson = currentLevel === 4;
      newPositionLevel = currentLevel;
    }

    // 검수자인 경우 소속 필수 확인
    if (isInspector && affiliations !== undefined && affiliations.length === 0) {
      return NextResponse.json(
        { message: '검수자는 최소 1개 이상의 소속을 선택해야 합니다.' },
        { status: 400 }
      );
    }

    // 검수자인 경우 이미 사용 중인 소속 확인 (자신의 소속 제외, '소속없음'은 중복 허용)
    if (isInspector && affiliations !== undefined && affiliations.length > 0) {
      const affiliationsToCheck = affiliations.filter((a: string) => a !== '소속없음');
      if (affiliationsToCheck.length > 0) {
        const { data: takenData, error: takenError } = await supabase
          .from('inspector_affiliations')
          .select('affiliation_name, inspector_id')
          .in('affiliation_name', affiliationsToCheck)
          .neq('inspector_id', userId);

        if (takenError) throw takenError;

        const takenAffiliations = takenData?.map((item: any) => item.affiliation_name).filter(Boolean) || [];
        if (takenAffiliations.length > 0) {
          return NextResponse.json(
            { message: `이미 다른 검수자에게 배정된 소속입니다: ${takenAffiliations.join(', ')}` },
            { status: 400 }
          );
        }
      }
    }

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
        bank_name,
        account_holder,
        account_number,
        created_at
      `)
      .single();

    if (error) throw error;

    // 검수자인 경우 inspector_affiliations에 소속 업데이트
    if (isInspector && affiliations !== undefined) {
      // 기존 소속 삭제
      const { error: deleteError } = await supabase
        .from('inspector_affiliations')
        .delete()
        .eq('inspector_id', userId);

      if (deleteError) throw deleteError;

      // 새 소속 추가
      if (affiliations.length > 0) {
        const insertData = affiliations.map((affName: string) => ({
          inspector_id: userId,
          affiliation_name: affName
        }));

        const { error: affError } = await supabase
          .from('inspector_affiliations')
          .insert(insertData);

        if (affError) throw affError;
      }
    }

    // 영업자인 경우 user_affiliations에 소속 업데이트
    if (isSalesPerson && affiliations !== undefined) {
      // 기존 소속 삭제
      const { error: deleteError } = await supabase
        .from('user_affiliations')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // 새 소속 추가
      if (affiliations.length > 0) {
        // affiliations 이름으로 id 조회
        const { data: affData, error: affQueryError } = await supabase
          .from('affiliations')
          .select('id, name')
          .in('name', affiliations);

        if (affQueryError) throw affQueryError;

        // affiliation_id 매핑
        const affMap = new Map(affData?.map((a: any) => [a.name, a.id]) || []);
        const insertData = affiliations
          .map((affName: string) => ({
            user_id: userId,
            affiliation_id: affMap.get(affName)
          }))
          .filter((item: any) => item.affiliation_id !== undefined);

        if (insertData.length > 0) {
          const { error: affError } = await supabase
            .from('user_affiliations')
            .insert(insertData);

          if (affError) throw affError;
        }
      }
    }

    return NextResponse.json(
      { message: '사용자 정보가 수정되었습니다', data },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('사용자 수정 실패:', error);
    return NextResponse.json(
      { message: '사용자 수정 실패', error: error?.message || error },
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

    // 사용자 정보 조회
    const { data: userData } = await supabase
      .from('users')
      .select('user_id')
      .eq('id', userId)
      .single();

    if (!userData) {
      return NextResponse.json(
        { message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 해당 사용자가 작성한 문서 삭제
    await supabase
      .from('documents')
      .delete()
      .eq('user_id', userData.user_id);

    // 해당 사용자가 담당자로 배정된 문서의 manager_id를 null로 변경
    await supabase
      .from('documents')
      .update({ manager_id: null })
      .eq('manager_id', userData.user_id);

    // 해당 사용자가 검수자로 배정된 문서의 inspector_id를 null로 변경
    await supabase
      .from('documents')
      .update({ inspector_id: null })
      .eq('inspector_id', userData.user_id);

    // 검수자 소속 정보 삭제
    await supabase
      .from('inspector_affiliations')
      .delete()
      .eq('inspector_id', userId);

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
  } catch (error: any) {
    console.error('사용자 삭제 실패:', error);
    return NextResponse.json(
      { message: error?.message || '사용자 삭제 실패' },
      { status: 500 }
    );
  }
}
