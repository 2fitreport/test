import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
    try {
        const data = await request.json();

        const {
            business_type,
            representative_name,
            company_name,
            business_number,
            phone,
            files,
            created_by,
            created_at,
        } = data;

        // 기업 정보 저장
        const { data: companyData, error } = await supabase
            .from('companies')
            .insert([
                {
                    business_type,
                    representative_name,
                    company_name,
                    business_number,
                    phone,
                    files: files || [],
                    created_by,
                    created_at,
                    updated_at: created_at,
                },
            ])
            .select();

        if (error) {
            return NextResponse.json(
                { error: `저장 실패: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: companyData,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '서버 오류' },
            { status: 500 }
        );
    }
}

function formatSubmittedDate(dateString: string): string {
    // "2025-12-17T15:19:24.68" 또는 "2025-12-17 15:19:24.68" -> "25-12-17 15:19"
    const date = new Date(dateString);
    const year = String(date.getFullYear()).slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export async function GET(request: NextRequest) {
    try {
        const { data, error } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            return NextResponse.json(
                { error: `조회 실패: ${error.message}` },
                { status: 500 }
            );
        }

        // companies 데이터를 Document 형식으로 변환
        const documents = data.map((company: any) => ({
            id: company.id,
            user_id: company.created_by || '',
            user_name: company.created_by || '',
            document_type: '기업등록',
            title: company.company_name,
            company_name: company.company_name,
            representative_name: company.representative_name,
            manager_name: company.representative_name,
            business_number: company.business_number,
            phone: company.phone,
            progress_details: '검수자',
            status: 'waiting' as const,
            progress_status: 'not_started' as const,
            submitted_date: formatSubmittedDate(company.created_at),
            completed_date: undefined,
            progress_start_date: undefined,
            progress_end_time: undefined,
            stopped_time: undefined,
            reason: undefined,
            reason_read: false,
        }));

        return NextResponse.json(documents);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '서버 오류' },
            { status: 500 }
        );
    }
}
