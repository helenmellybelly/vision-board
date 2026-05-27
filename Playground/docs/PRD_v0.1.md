# 비전보드 웹 서비스 PRD v0.1

**작성일:** 2026-05-27  
**상태:** 확정

---

## Context

정체성 기반 비전보드 웹 서비스를 실제 웹으로 빌드하기 위한 PRD. 플로우차트 Playground(flowchart.html)까지는 완성된 상태이며, 이제 실제 클라이언트 셀프 서비스 웹앱으로 구현하기 위한 기획 전체를 정리한다.

**핵심 전제:**
- 질문 흐름 자체가 IP — 보드(UI)가 아님
- 정체성 우선, 언어 먼저 이미지 나중
- PHASE 순서(1→2→3→4) 변경 불가

---

## 1. 서비스 개요 & 핵심 원칙

"막연한 감정을 삶의 구체적 장면으로, 그 장면을 매일 보고 싶은 이미지 1장으로 바꿔주는 정체성 기반 비전보드 웹 서비스"

| 원칙 | 설명 |
|---|---|
| 정체성 우선 | "무엇을 이루고 싶나"가 아닌 "나는 어떤 사람인가"부터 |
| 언어 → 이미지 | 텍스트 탐색이 완료된 후에 이미지 선택 |
| 질문 흐름 불변 | PHASE 순서(1→2→3→4)는 변경 불가한 UX 원칙 |
| 모바일 퍼스트 | 폰 브라우저 기준 설계, 데스크탑은 향상(Enhancement) |
| 진행 보존 | 언제든 이탈해도 재개 가능 |
| 점진적 수익화 | 현재 무료, 구조는 유료 플랜 수용 가능하게 |

**포지셔닝:**
- 코칭 프로그램 포함 도구 (별도 결제 없음, 현재)
- 클라이언트 셀프 서비스 (회원가입 → 독립 진행)

---

## 2. 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 프레임워크 | Next.js (App Router) | React 기반, Vercel 최적화, P1 AI API Route 추가 용이 |
| 인증/DB/Storage | Supabase | Auth + PostgreSQL + Storage 원스톱, 무료 플랜 시작 |
| 배포 | Vercel | git push 한 번으로 배포 |
| 이미지 최적화 | Next.js Image | 자동 리사이징, WebP 변환 |

---

## 3. 사용자 여정 (전체 흐름)

```
[랜딩/소개] → [회원가입/로그인]
    ↓
[온보딩: 서비스 설명 + 6섹션 소개] (최초 1회)
    ↓
[대시보드 - 섹션 선택]
    ↓ (섹션 하나 선택)
[섹션 작업 흐름]
    PHASE 1: ①지금 → ②방향키워드 → ③원해! → ⑤더들여다보기
    PHASE 2: ①②③⑤ 답 한눈에 보기 + 수정 가능
    PHASE 3: ④장면 묘사 (②키워드 참조하며)
    PHASE 4: 이미지 3장 선택
    → 섹션 완료 체크인
    ↓
[다음 섹션 OR 저장 후 나가기]
    ↓ (6섹션 모두 완료)
[FINISH 단계 → 비전보드 18장 그리드]
    ↓
[비전보드 홈 (재방문 기준점)]
```

---

## 4. P0 기능 명세

### 인증 화면
- 이메일 + 비밀번호 가입/로그인
- Google 소셜 로그인 (Supabase OAuth)
- 비밀번호 찾기 (Supabase 기본 이메일 플로우)
- ⚠️ 이메일 인증 필수 여부 → D2 결정 필요

### 온보딩 (최초 1회)
- 핵심 원칙 3줄 + 6섹션 소개 카드 + PHASE 흐름 4단계 인포그래픽
- `users.onboarding_completed = true` 처리로 재표시 방지

### 대시보드
- 6개 섹션 카드 (미시작 / 진행중 + 현재PHASE / 완료 + 썸네일)
- 완료 섹션 수 / 6 프로그레스 바
- 완성된 보드 미리보기 버튼 (부분 완성 상태도 가능)

### 섹션 작업 화면

**공통:** 현재 섹션명 + PHASE 인디케이터 상단 고정, 자동저장 상태 표시

**PHASE 1:** 슬롯별 한 화면씩
- ①: textarea "지금 이 영역은..."
- ②: text input "키워드나 짧은 문장으로"
- ③: textarea "솔직하게, 나는..."
- ⑤: 섹션별 고정 서브질문 2~3개 (각각 textarea)

**PHASE 2:** ①②③⑤ 카드 4개 스크롤 리스트, 각 카드 인라인 수정 가능

**PHASE 3:** 슬롯② 카드 상단 고정 + 넓은 textarea (장면 묘사, 길이 제한 없음)

**PHASE 4:** 이미지 3장 슬롯, 각 슬롯 탭 → 이미지 추가 모달

**섹션 완료 체크인:** 전체 요약 + 이미지 3장 썸네일, "완료" / "다시 돌아보기" 선택

### 비전보드 보기
- 6섹션 × 3장 = 최대 18장 그리드 (미완성 = 회색 플레이스홀더)
- 섹션별 라벨 그룹핑
- 모바일: 세로 스크롤 2열 그리드 or 섹션별 가로 스크롤
- 이미지 탭 → 전체화면 보기 + 해당 섹션 편집 바로가기

### FINISH 단계 (P0 최소)
```
6섹션 완료 → 완성 축하 화면 → 비전보드 전체 보기(18장) → 재방문 홈
```

---

## 5. 데이터 모델 (Supabase 테이블 초안)

```sql
-- 사용자 (Auth 확장)
users
  id             uuid PK (= auth.users.id)
  email          text
  display_name   text
  plan           text DEFAULT 'free'   ← 수익화 대비 핵심 컬럼
  onboarding_completed  boolean DEFAULT false
  created_at, updated_at

-- 비전보드 (사용자당 1개, MVP)
vision_boards
  id             uuid PK
  user_id        uuid FK → users.id UNIQUE
  title          text DEFAULT '나의 비전보드'
  status         text  ← 'in_progress' | 'completed'
  completed_at, created_at, updated_at

-- 섹션 (보드당 6개)
sections
  id             uuid PK
  board_id       uuid FK → vision_boards.id
  section_type   text  ← 'self'|'health'|'relationship'|'work'|'money'|'space'
  status         text  ← 'not_started'|'phase1'|'phase2'|'phase3'|'phase4'|'completed'
  current_phase  integer DEFAULT 1
  completed_at, created_at, updated_at

-- 슬롯 답변
section_slots
  id             uuid PK
  section_id     uuid FK → sections.id
  slot_type      text  ← 'now'|'direction'|'want'|'scene'|'deep_1'|'deep_2'|'deep_3'
  content        text
  sub_question_id uuid FK → section_sub_questions.id
  created_at, updated_at

-- 서브질문 마스터
section_sub_questions
  id             uuid PK
  section_type   text
  question_order integer
  question_text  text
  version        integer DEFAULT 1

-- 이미지
section_images
  id             uuid PK
  section_id     uuid FK → sections.id
  slot_order     integer  ← 1, 2, 3
  image_type     text  ← 'upload'|'url'|'unsplash'
  storage_path   text
  source_url     text
  unsplash_id    text
  thumbnail_url  text
  is_primary     boolean DEFAULT false
  created_at, updated_at
```

**RLS:** 모든 테이블에 `auth.uid() = user_id` 기반 RLS 필수.

---

## 6. 이미지 방식

| 구분 | URL 입력 | 파일 업로드 | Unsplash API | Pinterest 링크 |
|---|---|---|---|---|
| 구현 난이도 | 최저 | 낮음 | 중간 | 높음 |
| 모바일 UX | 나쁨 | 보통 | 좋음 | 나쁨 |
| 저작권 리스크 | 매우 높음 | 사용자 책임 | 낮음 | 높음 |
| 이미지 지속성 | 불안정 | 안정 | 불안정 | 매우 불안정 |

**✅ P0 추천: 파일 업로드 + URL 병행**
- Supabase Storage 버킷: `vision-images/{user_id}/{section_id}/`
- 최대 5MB/장, jpg·png·webp·heic 허용
- HEIC → JPEG 서버사이드 변환 (sharp)
- URL 입력 시 서버사이드 fetch로 CORS 우회

**P1:** Unsplash API 연동 (Production 승인 신청 1~2주 소요)

---

## 7. 기획 허점 20가지 & 해결 방안

### UX 흐름
| # | 허점 | 해결 |
|---|---|---|
| H1 | PHASE 중간 이탈 후 재진입 지점 불명확 | `sections.current_phase` + `status`로 재진입 복원 |
| H2 | PHASE 간 되돌아가기 허용 범위 미정 | PHASE 2에서 수정 허용. PHASE 3 이후 수정 시 경고 토스트 |
| H3 | 섹션 순서 강제 여부 미정 | 자유 선택 허용. 중간 이탈 시 확인 모달 |
| H4 | 완료 후 수정 진입점 모호 | "섹션 요약 화면"으로 진입, 파트별 수정 버튼 |

### 데이터 구조
| # | 허점 | 해결 |
|---|---|---|
| H5 | 보드 리셋 시 데이터 처리 정책 없음 | `deleted_at` soft delete 보존 |
| H6 | 서브질문 변경 시 답변 매핑 깨짐 | `sub_question_id` FK + version 관리 |
| H7 | 이미지 삭제 시 Storage 파일 미정리 | 삭제 시 `Storage.remove()` 동시 호출 |

### 이미지
| # | 허점 | 해결 |
|---|---|---|
| H8 | 저작권 처리 정책 부재 | 이용약관에 사용자 책임 명시 |
| H9 | 모바일 HEIC 포맷 미처리 | sharp로 서버사이드 변환 |
| H10 | 외부 URL 이미지 404 시 UI 깨짐 | `onError` 핸들러 + 폴백 플레이스홀더 |

### FINISH 단계
| # | 허점 | 해결 |
|---|---|---|
| H11 | FINISH 진입 조건 미정 | 6섹션 모두 completed일 때만. 미리보기는 부분 완성도 가능 |
| H12 | FINISH 단계 UX 미설계 | 섹션 3 사용자 여정 FINISH 흐름 참고 |
| H13 | 완성 후 재방문 경험 미정 | 재방문 시 비전보드 전체 보기 기본 화면 |

### 엣지케이스
| # | 허점 | 해결 |
|---|---|---|
| H14 | 멀티 디바이스 동시 편집 | MVP: 최신 저장 우선. 충돌 감지는 P1 |
| H15 | 빈 슬롯 PHASE 진행 허용 여부 | ①②③ 최소 1자 필수, ⑤ 선택, ④ 권장(강제 아님) |

### 기술
| # | 허점 | 해결 |
|---|---|---|
| H16 | 모바일 키보드로 textarea 가림 | `visualViewport` API로 자동 스크롤 |
| H17 | 자동저장 타이밍 & 충돌 | Debounce 2초 + 언마운트 강제 저장 + localStorage 임시 저장 |
| H18 | Supabase RLS + Server Actions 혼용 버그 | Server Actions에서 반드시 `createServerClient` 사용 |
| H19 | 업로드 중 PHASE 전환 | 업로드 중 PHASE 버튼 비활성화 |
| H20 | Supabase 연결 수 고갈 (성장 시) | MVP는 문제 없음. 성장 시 PgBouncer 활성화 |

---

## 8. 즉시 결정 필요한 항목 (D1~D8)

| # | 결정 사항 | 권장 | 확정 |
|---|---|---|---|
| D1 | 이미지 방식 P0 | 업로드 + URL 병행 | |
| D2 | 이메일 인증 필수 여부 | 생략 고려 | |
| D3 | PHASE 순서 강제 | 강제 (1→4) | |
| D4 | 빈 슬롯 진행 허용 | 경고만 | |
| D5 | 보드 리셋 데이터 처리 | soft delete | |
| D6 | 6섹션 완료 전 FINISH 진입 | 불가 | |
| D7 | 섹션 작업 순서 | 자유 선택 | |
| D8 | 자동저장 debounce | 2초 | |

---

## 9. P1/P2 로드맵

### P1 — AI 기능
1. "도움이 필요해요" — Claude API, 스트리밍 서브질문 3개
2. ④ 장면 제안 3모드 — 선택형 / 수정형 / 빈칸형
3. ⑥ 검색어 3개 + Unsplash API 연동
4. FINISH AI 패턴 분석 — 핵심 키워드 3개 + 섹션 간 연결고리
5. 통합 이미지 1장 — AI 분위기 분석 → 이미지 생성 (비용 검토)

### P2 — 성장 기능
- PDF 다운로드
- 링크 공유 (`/board/[shareToken]`)
- 유료 플랜 (Stripe + `users.plan`)
- 보드 히스토리
- 코치 대시보드 (선택적)
