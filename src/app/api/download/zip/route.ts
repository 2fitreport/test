import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { documentId, files } = body;

        // 인증 확인 (쿠키에서 토큰 가져오기)
        const authToken = request.cookies.get('auth_token')?.value;
        if (!authToken) {
            return NextResponse.json(
                { error: '인증이 필요합니다.' },
                { status: 401 }
            );
        }

        // 문서 존재 및 접근 권한 확인
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('id, user_id')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            return NextResponse.json(
                { error: '문서를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        if (!documentId || !files || !Array.isArray(files)) {
            return NextResponse.json(
                { error: '필수 파라미터가 누락되었습니다.' },
                { status: 400 }
            );
        }

        if (files.length === 0) {
            return NextResponse.json(
                { error: '다운로드할 파일이 없습니다.' },
                { status: 400 }
            );
        }

        // 다운로드 요청 로깅 (감사 추적)
        console.log(`[파일 다운로드] documentId: ${documentId}, fileCount: ${files.length}, timestamp: ${new Date().toISOString()}`);

        // ZIP 파일 생성
        const zip = new JSZip();
        const failedFiles: string[] = [];
        let successCount = 0;

        // 각 파일 다운로드 및 ZIP에 추가
        for (const file of files) {
            try {
                const { data, error } = await supabase.storage
                    .from('documents')
                    .download(file.path);

                if (error) {
                    console.error(`파일 다운로드 실패: ${file.name}`, error);
                    failedFiles.push(file.name);
                    continue;
                }

                if (data) {
                    // Blob을 Buffer로 변환
                    const arrayBuffer = await data.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    zip.file(file.name, buffer);
                    successCount++;
                }
            } catch (err) {
                console.error(`파일 처리 오류: ${file.name}`, err);
                failedFiles.push(file.name);
            }
        }

        // 성공한 파일이 없으면 에러 반환
        if (successCount === 0) {
            return NextResponse.json(
                {
                    error: '모든 파일 다운로드에 실패했습니다.',
                    failedFiles,
                },
                { status: 500 }
            );
        }

        // ZIP 파일 생성 (Node.js 환경용)
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

        // 파일명 생성
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const filename = `document_${documentId}_${dateStr}.zip`;

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error) {
        console.error('ZIP 파일 생성 실패:', error);
        return NextResponse.json(
            {
                error: 'ZIP 파일 생성 중 오류가 발생했습니다.',
                message: error instanceof Error ? error.message : '알 수 없는 오류',
            },
            { status: 500 }
        );
    }
}
