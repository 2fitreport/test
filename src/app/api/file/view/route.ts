import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

export async function POST(request: NextRequest) {
    try {
        const { filePath } = await request.json();

        if (!filePath) {
            return NextResponse.json(
                { error: '파일 경로가 필요합니다.' },
                { status: 400 }
            );
        }

        console.log('파일 조회 요청:', { filePath });

        // 파일 확장자 확인
        const fileExt = filePath.split('.').pop()?.toLowerCase() || '';
        const isOfficeFile = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(fileExt);
        const isHwpFile = fileExt === 'hwp';

        // 임시 서명된 URL 생성 (1시간 유효)
        const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUrl(filePath, 3600); // 3600초 = 1시간

        if (error) {
            console.error('서명된 URL 생성 실패:', { filePath, error });
            return NextResponse.json(
                { error: '파일을 찾을 수 없습니다. 파일이 삭제되었거나 업로드되지 않았을 수 있습니다.', details: error.message },
                { status: 404 }
            );
        }

        console.log('서명된 URL 생성 성공:', { filePath });

        // Office 파일인 경우 365 Viewer 사용
        if (isOfficeFile) {
            return NextResponse.json({
                url: data.signedUrl,
                viewerType: 'office365'
            });
        }

        // HWP 파일인 경우 PDF로 변환
        if (isHwpFile) {
            try {
                // 파일 다운로드
                const { data: fileData, error: downloadError } = await supabase.storage
                    .from('documents')
                    .download(filePath);

                if (downloadError) {
                    throw new Error(`파일 다운로드 실패: ${downloadError.message}`);
                }

                // 임시 디렉토리 경로
                const tempDir = os.tmpdir();
                const hwpFileName = path.basename(filePath);
                const pdfFileName = hwpFileName.replace(/\.hwp$/i, '.pdf');
                const hwpPath = path.join(tempDir, `hwp_${Date.now()}_${hwpFileName}`);
                const pdfPath = path.join(tempDir, `hwp_${Date.now()}_${pdfFileName}`);

                // HWP 파일을 임시 경로에 저장
                const arrayBuffer = await fileData.arrayBuffer();
                await fs.writeFile(hwpPath, Buffer.from(arrayBuffer));

                // LibreOffice를 사용하여 PDF로 변환
                try {
                    await execAsync(`libreoffice --headless --convert-to pdf --outdir "${tempDir}" "${hwpPath}"`, {
                        timeout: 30000
                    });
                } catch (libreError) {
                    console.error('LibreOffice 변환 실패:', libreError);
                    // LibreOffice 없으면 원본 파일로 진행 (다운로드만)
                    await fs.unlink(hwpPath).catch(() => {});
                    return NextResponse.json({
                        url: data.signedUrl,
                        error: 'PDF 변환 불가. 파일을 다운로드해주세요.'
                    });
                }

                // 변환된 PDF 읽기
                const pdfBuffer = await fs.readFile(pdfPath);

                // Supabase Storage에 임시 PDF 저장
                const uploadPath = `temp-converted/${Date.now()}_${pdfFileName}`;
                const { error: uploadError } = await supabase.storage
                    .from('documents')
                    .upload(uploadPath, pdfBuffer, {
                        contentType: 'application/pdf',
                        upsert: false
                    });

                if (uploadError) {
                    throw new Error(`PDF 업로드 실패: ${uploadError.message}`);
                }

                // 변환된 PDF의 서명 URL 생성
                const { data: pdfData, error: pdfUrlError } = await supabase.storage
                    .from('documents')
                    .createSignedUrl(uploadPath, 3600);

                if (pdfUrlError) {
                    throw new Error(`PDF URL 생성 실패: ${pdfUrlError.message}`);
                }

                // 임시 파일 삭제
                await fs.unlink(hwpPath).catch(() => {});
                await fs.unlink(pdfPath).catch(() => {});

                return NextResponse.json({
                    url: pdfData.signedUrl,
                    viewerType: 'pdf',
                    convertedFrom: 'hwp'
                });
            } catch (error) {
                console.error('HWP 변환 중 오류:', error);
                // 변환 실패 시 원본 파일 반환
                return NextResponse.json({
                    url: data.signedUrl,
                    error: error instanceof Error ? error.message : 'HWP 변환 중 오류 발생. 파일을 다운로드해주세요.'
                });
            }
        }

        // 기타 파일 (PDF, 이미지 등)
        return NextResponse.json({ url: data.signedUrl });
    } catch (error) {
        console.error('파일 뷰 API 오류:', error);
        return NextResponse.json(
            { error: '파일 조회 중 오류 발생' },
            { status: 500 }
        );
    }
}
