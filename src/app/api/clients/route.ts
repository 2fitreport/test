import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        let userId = 'unknown';
        let userLevel = 0;
        let userDbId = 0;

        try {
            const tokenData = JSON.parse(Buffer.from(authToken, 'base64').toString('utf-8'));
            userId = tokenData.user_id || 'unknown';

            const { data: userData } = await supabase
                .from('users')
                .select('id, position(level)')
                .eq('user_id', userId)
                .single();

            if (userData) {
                userLevel = (userData.position as any)?.level || 0;
                userDbId = userData.id || 0;
            }
        } catch (e) {
            console.error('토큰 파싱 실패:', e);
        }

        let query = supabase
            .from('documents')
            .select('id, company_name, business_number, company_type, representative_name, progress_details, status, cretop_file, cretop_none, user_id, inspector_id, created_at, company_credit_rating_kcb, company_credit_rating_nice, financial_data, income_data, extracted_images, standard_classification, approval_amount')
            .order('created_at', { ascending: false });

        // 기업상세정보 저장 여부 필터: cretop_file IS NOT NULL OR cretop_none = true
        query = query.or('cretop_file.not.is.null,cretop_none.eq.true');

        // 권한별 필터링
        if (userLevel === 2) {
            // 대표실무자: admin 제외
            query = query.neq('manager_id', 'admin');
        } else if (userLevel === 3) {
            // 실무자: manager_id로 배정받은 문서만
            query = query.eq('manager_id', userId);
        } else if (userLevel === 4) {
            // 영업자: 자신이 올린 문서만
            query = query.eq('user_id', userId);
        } else if (userLevel === 6) {
            // 검수자: 소속이 같은 영업자의 문서만
            // 먼저 소속 조회
            const { data: myAffiliations } = await supabase
                .from('user_affiliations')
                .select('affiliation_id')
                .eq('user_id', userDbId);

            const myAffIds = (myAffiliations || []).map((a: any) => a.affiliation_id).filter(Boolean);

            let allowedUserIds: string[] = [];
            if (myAffIds.length > 0) {
                const { data: affUserLinks } = await supabase
                    .from('user_affiliations')
                    .select('user_id')
                    .in('affiliation_id', myAffIds);
                const affDbIds = [...new Set((affUserLinks || []).map((a: any) => a.user_id))];
                if (affDbIds.length > 0) {
                    const { data: usersData } = await supabase
                        .from('users')
                        .select('user_id')
                        .in('id', affDbIds);
                    allowedUserIds = (usersData || []).map((u: any) => u.user_id);
                }
            }

            if (allowedUserIds.length > 0) {
                query = query.in('user_id', allowedUserIds);
            } else {
                // 소속이 없으면 빈 결과
                query = query.eq('user_id', 'no_user_found');
            }
        }
        // Level 1: 모든 문서 (필터 적용 안 함)

        const { data: documents, error } = await query;

        if (error) throw error;

        const filteredDocuments = documents || [];

        // business_number 기준으로 그룹핑하여 고객사 목록 생성
        const clientsMap = new Map<string, {
            company_name: string;
            business_number: string;
            company_type: string;
            standard_classification: string | null;
            representative_name: string;
            company_credit_rating_kcb: string | null;
            company_credit_rating_nice: string | null;
            annual_sales: string | null;
            creditRatingImage: string | null;
            totalCases: number;
            documents: Array<{
                id: number;
                progress_details: string;
                status: string;
                created_at: string;
                approval_amount: number | null;
            }>;
        }>();

        (filteredDocuments || []).forEach((doc: any) => {
            const key = doc.business_number;
            if (!clientsMap.has(key)) {
                // income_data에서 매출액(sales)의 마지막 값 추출 (백만원 단위 → 억원 단위로 변환)
                let annualSales = null;
                if (doc.income_data && typeof doc.income_data === 'object') {
                    const sales = doc.income_data.sales;
                    if (Array.isArray(sales) && sales.length > 0) {
                        const salesValue = sales[sales.length - 1];
                        if (salesValue && salesValue !== '-') {
                            const num = parseFloat(salesValue.toString().replace(/,/g, ''));
                            if (!isNaN(num)) {
                                const eokValue = num / 100; // 백만원을 억원으로 변환
                                const eok = Math.floor(eokValue);
                                const cheonman = Math.round((eokValue - eok) * 10);
                                if (cheonman > 0) {
                                    annualSales = `${eok}억 ${cheonman}천만원`;
                                } else {
                                    annualSales = `${eok}억원`;
                                }
                            }
                        }
                    }
                }

                // extracted_images의 첫 번째 이미지 추출
                let creditRatingImage = null;
                if (doc.extracted_images && typeof doc.extracted_images === 'object') {
                    creditRatingImage = doc.extracted_images.first || null;
                }

                clientsMap.set(key, {
                    company_name: doc.company_name,
                    business_number: doc.business_number,
                    company_type: doc.company_type,
                    standard_classification: doc.standard_classification || null,
                    representative_name: doc.representative_name,
                    company_credit_rating_kcb: doc.company_credit_rating_kcb,
                    company_credit_rating_nice: doc.company_credit_rating_nice,
                    annual_sales: annualSales,
                    creditRatingImage: creditRatingImage,
                    totalCases: 0,
                    documents: []
                });
            }

            const client = clientsMap.get(key)!;
            client.totalCases += 1;
            client.documents.push({
                id: doc.id,
                progress_details: doc.progress_details,
                status: doc.status,
                created_at: doc.created_at,
                approval_amount: doc.approval_amount ? Number(doc.approval_amount) : null
            });
        });

        // 각 고객사별로 가장 오래된(처음 등록된) company_name으로 업데이트
        const clientsArray = Array.from(clientsMap.values());
        const businessNumberToFirstDoc = new Map<string, any>();

        (filteredDocuments || []).forEach((doc: any) => {
            const key = doc.business_number;
            // 마지막으로 처리되는 것(가장 오래된 것)을 유지
            businessNumberToFirstDoc.set(key, doc);
        });

        clientsArray.forEach(client => {
            const firstDoc = businessNumberToFirstDoc.get(client.business_number);
            if (firstDoc) {
                client.company_name = firstDoc.company_name;
            }
        });

        return NextResponse.json({ clients: clientsArray, currentUserId: userId, userLevel });
    } catch (error) {
        console.error('고객사 조회 실패:', error);
        return NextResponse.json({ error: '고객사 조회 실패' }, { status: 500 });
    }
}
