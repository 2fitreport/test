import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 허용된 파일 타입
const ALLOWED_FILE_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
];

// 파일 확장자 검증
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'zip'];

// 최대 파일 크기 (5GB)
const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024;

function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

function validatePath(path: string): boolean {
    // 디렉토리 트래버설 공격 방지
    if (path.includes('..') || path.includes('//') || path.startsWith('/')) {
        return false;
    }
    return true;
}

function generateSecureFileName(originalFileName: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = getFileExtension(originalFileName);
    return `${timestamp}_${random}.${ext}`;
}

export async function POST(request: NextRequest) {
    try {
        // 1. 인증 검증
        const token = request.cookies.get('auth_token')?.value;
        if (!token) {
            return NextResponse.json(
                { error: '인증이 필요합니다.' },
                { status: 401 }
            );
        }

        const { path, contentType, fileName, fileSize } = await request.json();

        if (!path || !fileName || fileSize === undefined) {
            return NextResponse.json(
                { error: '파일 경로, 이름, 크기가 필요합니다.' },
                { status: 400 }
            );
        }

        // 2. 파일 크기 검증
        if (fileSize > MAX_FILE_SIZE) {
            return NextResponse.json(
                { error: `파일 크기는 5GB 이하여야 합니다. (현재: ${(fileSize / 1024 / 1024 / 1024).toFixed(2)}GB)` },
                { status: 400 }
            );
        }

        if (fileSize === 0) {
            return NextResponse.json(
                { error: '빈 파일은 업로드할 수 없습니다.' },
                { status: 400 }
            );
        }

        // 3. 파일 확장자 검증
        const ext = getFileExtension(fileName);
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json(
                { error: `허용되지 않는 파일 형식입니다. (허용: ${ALLOWED_EXTENSIONS.join(', ')})` },
                { status: 400 }
            );
        }

        // 4. Content-Type 검증
        if (contentType && !ALLOWED_FILE_TYPES.includes(contentType)) {
            return NextResponse.json(
                { error: `허용되지 않는 파일 타입입니다.` },
                { status: 400 }
            );
        }

        // 5. 경로 검증
        if (!validatePath(path)) {
            return NextResponse.json(
                { error: '유효하지 않은 파일 경로입니다.' },
                { status: 400 }
            );
        }

        // 6. 사용자 정보 추출 (토큰에서)
        const userDataStr = request.cookies.get('admin_data')?.value;
        let userId = 'unknown';
        if (userDataStr) {
            try {
                const userData = JSON.parse(decodeURIComponent(userDataStr));
                userId = userData.id || 'unknown';
            } catch (e) {
                // userData 파싱 실패해도 계속 진행
            }
        }

        // 7. 보안된 파일명으로 변환
        const secureFileName = generateSecureFileName(fileName);
        const fullPath = `company_create1/${userId}/${path}/${secureFileName}`;

        // 8. Signed URL 생성 (1시간 유효)
        const { data, error } = await supabase.storage
            .from('documents')
            .createSignedUploadUrl(fullPath);

        if (error) {
            return NextResponse.json(
                { error: `Signed URL 생성 실패: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            signedUrl: data.signedUrl,
            token: data.token,
            path: fullPath,
            fileName: secureFileName,
            originalFileName: fileName,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : '서버 오류' },
            { status: 500 }
        );
    }
}
