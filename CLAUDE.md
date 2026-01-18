# CLAUDE.md

이 파일은 Claude Code가 이 저장소의 코드를 작업할 때 참고하는 지침입니다.

## 프로젝트 개요

이 프로젝트는 **역할 기반 문서 관리 및 워크플로우 시스템**입니다. 기업의 문서 제출, 검수, 승인 프로세스를 관리하는 B2B 애플리케이션입니다.

**핵심 기능:**
- 문서 제출 및 관리 (영업자 → 검수자 → 승인 단계)
- 역할 기반 접근 제어 (RBAC)
- 파일 업로드/다운로드 (ZIP 지원)
- 문서 히스토리 추적
- 사용자 및 회사 관리

## 기술 스택

**Frontend:**
- Next.js 16.0.10 (App Router)
- React 19.2.1 with React Compiler
- TypeScript 5
- CSS Modules

**Backend:**
- Next.js API Routes
- Supabase (PostgreSQL + Authentication)

**도구:**
- Playwright 1.57.0 (E2E 테스트)
- ESLint 9 (린팅)

**라이브러리:**
- Chart.js & react-chartjs-2 (데이터 시각화)
- Swiper 12.0.3 (캐러셀)
- jszip (ZIP 파일 생성)
- react-icons (아이콘)

## 주요 커맨드

```bash
# 개발 서버 시작 (localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드된 앱 실행
npm start

# ESLint 실행
npm run lint
```

## 프로젝트 구조

```
src/
├── app/
│   ├── api/                    # API 라우트 (백엔드 엔드포인트)
│   │   ├── auth/              # 인증 (로그인, 로그아웃, 사용자 정보)
│   │   ├── documents/         # 문서 CRUD & 작업
│   │   ├── users/             # 사용자 관리
│   │   ├── upload/            # 파일 업로드
│   │   ├── download/          # 다운로드 (ZIP)
│   │   ├── history/           # 문서 히스토리
│   │   ├── positions/         # 직책 관리
│   │   └── affiliations/      # 조직 소속
│   ├── components/            # 재사용 가능한 UI 컴포넌트
│   │   ├── Modal/            # 모달 다이얼로그
│   │   └── AuthProvider/     # 인증 컨텍스트
│   ├── login/                 # 로그인 페이지
│   ├── main/                  # 메인 애플리케이션 페이지
│   │   ├── document_submission/  # 문서 제출 인터페이스
│   │   ├── user_management/     # 사용자 관리 페이지
│   │   ├── company_create/      # 회사 생성 폼
│   │   └── history/            # 히스토리 조회 페이지
│   ├── globals.css            # 전역 스타일
│   └── layout.tsx             # 루트 레이아웃
├── lib/
│   ├── auth.ts               # 인증 유틸리티
│   └── permissions.ts        # 권한 제어 로직
└── middleware.ts             # 라우트 보호 (토큰 검증)
```

## 아키텍처 특징

### 역할 기반 접근 제어 (RBAC)

사용자 역할별 권한 (권한 수준):
- **1 (영업자)**: 모든 문서 편집 가능
- **2 (매니저)**: 모든 문서 편집 가능
- **4 (영업사원)**: 자신의 문서만 "영업자" 단계에서 편집 가능
- **6 (검수자)**: 담당 영업자의 문서만 "검수자" 단계에서 편집 가능

**권한 로직:** `src/lib/permissions.ts`에서 문서 소유권, 감독자 할당, 진행 단계를 확인합니다.

### 인증 시스템

- **쿠키 기반**: `auth_token` (미들웨어 검증용)
- **localStorage 기반**: `auth_token`, `admin_data` (클라이언트 지속성)
- Supabase API 키를 통한 백엔드 작업

**라우트 보호:** `src/middleware.ts`에서 모든 요청에 대해 토큰을 검증합니다.

### 파일 처리

- Supabase Storage를 통한 파일 업로드/다운로드
- 서명된 URL(Signed URL) 지원
- ZIP 다운로드 기능 (`jszip` 사용)

**중요:** Vercel에서 업로드 라우트의 타임아웃이 60초로 설정되어 있습니다. (`vercel.json` 참고)

## 환경 설정

### 필수 환경 변수 (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

### TypeScript 설정

- `strict: false`로 설정 (기존 코드와의 호환성)
- 경로 별칭: `@/*` → `src/*`

## 개발 시 주의사항

### 권한 검사

새로운 기능을 추가할 때는 반드시 `src/lib/permissions.ts`의 권한 로직을 검토하고, 필요시 업데이트하세요.

### API 라우트

모든 API 라우트는 다음과 같이 구조화됩니다:
- 요청 검증 (토큰, 파라미터)
- Supabase 쿼리 실행
- 에러 처리 및 응답 반환

### 상태 관리

클라이언트 상태는 주로 `localStorage`에 저장됩니다. 새로운 상태 필드를 추가할 때는 일관성을 유지하세요.

## 배포

이 프로젝트는 **Vercel**에 최적화되어 있습니다.

```bash
# 프로덕션 빌드
npm run build

# 로컬에서 빌드 테스트
npm start
```

배포 설정은 `vercel.json`에서 관리됩니다.

## 성능 최적화

- **React Compiler** 활성화: 자동 메모이제이션을 통한 렌더링 최적화
- **미들웨어**: 조기 단계에서 인증되지 않은 요청 차단
- **파일 크기**: Swiper와 Chart.js를 통한 효율적인 UI 구성

## 문서 워크플로우

```
문서 생성 (영업자)
    ↓
"영업자" 단계 (영업자/매니저 편집)
    ↓
"검수자" 단계 (검수자 검수)
    ↓
"승인" 단계 (최종 승인)
```

각 단계에서 권한 확인이 이루어집니다.
