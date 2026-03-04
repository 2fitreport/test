import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const authToken = request.cookies.get('auth_token')?.value;
    if (!authToken) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    // 토큰 디코딩
    let tokenData;
    try {
      const decodedToken = Buffer.from(authToken, 'base64').toString('utf-8');
      tokenData = JSON.parse(decodedToken);
    } catch (err) {
      return NextResponse.json(
        { error: '유효하지 않은 토큰입니다.' },
        { status: 401 }
      );
    }

    const userId = tokenData.user_id;

    // 현재 사용자 정보 조회 (권한 확인용)
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('*, position(level)')
      .eq('user_id', userId)
      .single();

    if (userError || !currentUser) {
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const userLevel = currentUser.position?.level;
    const userIdNumber = currentUser.id;

    const statusFilter = request.nextUrl.searchParams.get('status');

    // 사용자 조회
    let queryBuilder = supabase
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
        password,
        supervisor_id,
        bank_name,
        account_holder,
        account_number,
        created_at
      `)
      .order('position_id', { ascending: true })
      .order('created_at', { ascending: false });

    if (statusFilter) {
      queryBuilder = queryBuilder.eq('status', statusFilter);
    }

    let { data, error } = await queryBuilder;

    if (error) throw error;

    if (!data) {
      return NextResponse.json([], { status: 200 });
    }

    // 소속 정보 조회 (inspector_affiliations + user_affiliations)
    const { data: inspectorAffData } = await supabase
      .from('inspector_affiliations')
      .select('inspector_id, affiliation_name');

    const { data: userAffData } = await supabase
      .from('user_affiliations')
      .select('user_id, affiliations(name)');

    // inspector_id → affiliation_name 맵
    const inspectorAffMap = new Map<number, string>();
    inspectorAffData?.forEach((ia: any) => {
      if (!inspectorAffMap.has(ia.inspector_id)) {
        inspectorAffMap.set(ia.inspector_id, ia.affiliation_name);
      }
    });

    // user_id → affiliation name 맵
    const userAffMap = new Map<number, string>();
    userAffData?.forEach((ua: any) => {
      if (ua.affiliations?.name && !userAffMap.has(ua.user_id)) {
        userAffMap.set(ua.user_id, ua.affiliations.name);
      }
    });

    // 각 유저에 affiliation_name 추가
    data = data.map((u: any) => ({
      ...u,
      affiliation_name: inspectorAffMap.get(u.id) || userAffMap.get(u.id) || null
    }));

    // 역할별 필터링
    if (userLevel === 4) {
      // 영업자: 자신의 정보만
      data = data.filter((u: any) => u.user_id === userId);
    } else if (userLevel === 6) {
      // 검수자: 자신의 담당 소속에 해당하는 사용자들만
      const { data: affiliationsData } = await supabase
        .from('inspector_affiliations')
        .select('affiliation_name')
        .eq('inspector_id', userIdNumber);

      if (affiliationsData) {
        const affiliationNames = affiliationsData.map((a: any) => a.affiliation_name);
        data = data.filter((u: any) => affiliationNames.includes(u.affiliation_name));
      } else {
        data = [];
      }
    }
    // Level 1, 2: 필터링 없음 (모든 사용자)

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('사용자 조회 실패:', error);
    return NextResponse.json(
      { message: '사용자 조회 실패' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { user_id, name, position_id, password, phone, email_display, address, address_detail, company_name, status, affiliations, is_affiliation_representative, bank_name, account_holder, account_number } = body;

    // 필수 항목 검증
    if (!user_id || !name || !position_id || !password) {
      return NextResponse.json(
        { message: '필수 항목을 입력해주세요.' },
        { status: 400 }
      );
    }

    // 중복 체크
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

    // position level 확인
    const { data: positionData } = await supabase
      .from('position')
      .select('level')
      .eq('id', position_id)
      .single();

    const isInspector = positionData?.level === 6;
    const isEmployee = positionData?.level === 4;

    // 영업자/검수자인 경우 소속 필수 확인
    if ((isEmployee || isInspector) && (!affiliations || affiliations.length === 0)) {
      return NextResponse.json(
        { message: '소속을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 검수자인 경우 이미 사용 중인 소속 확인 ('소속없음'은 중복 허용)
    if (isInspector && affiliations && affiliations.length > 0) {
      const affiliationsToCheck = affiliations.filter((a: string) => a !== '소속없음');
      if (affiliationsToCheck.length > 0) {
        const { data: takenData, error: takenError } = await supabase
          .from('inspector_affiliations')
          .select('affiliation_name')
          .in('affiliation_name', affiliationsToCheck);

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

    // 새 사용자 생성
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          user_id,
          name,
          position_id,
          password,
          phone: phone || null,
          email_display: email_display || null,
          address: address || null,
          address_detail: address_detail || null,
          company_name: company_name || null,
          status: status || 'active',
          is_affiliation_representative: is_affiliation_representative || false,
          bank_name: bank_name || null,
          account_holder: account_holder || null,
          account_number: account_number || null,
        },
      ])
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
        bank_name,
        account_holder,
        account_number,
        created_at
      `)
      .single();

    if (createError) throw createError;

    // 영업자/검수자인 경우 소속 저장
    if ((isEmployee || isInspector) && affiliations && affiliations.length > 0) {
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
          user_id: newUser.id,
          affiliation_id: affMap.get(affName)
        }))
        .filter((item: any) => item.affiliation_id !== undefined);

      if (insertData.length > 0) {
        const { error: affError } = await supabase
          .from('user_affiliations')
          .insert(insertData);

        if (affError) {
          // 사용자 삭제 (롤백)
          await supabase.from('users').delete().eq('id', newUser.id);
          throw affError;
        }
      }
    }

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error('사용자 생성 실패:', error);
    return NextResponse.json(
      { message: '사용자 생성 실패' },
      { status: 500 }
    );
  }
}
