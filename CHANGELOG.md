# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** v2.9 UX 전면 개편 + 카피 개선 — Vercel 배포 완료
- **주요 기능:**
  - Next.js 비전보드 웹앱 (`vision-board-web/`) — Vercel 배포 https://vision-board-web.vercel.app
  - **랜딩 페이지 (v2.9 재설계):** Hero("비전보드, 원하는 게 생각나야 만들 수 있다고 생각했나요?") + Contrast(기존 vs lumi) + How it works(재작성) + CTA
  - **프로세스 오버뷰 (`/welcome`):** 온보딩 완료 후 경유 — 4단계 타임라인(발견→장면→이미지→완성), 기존 사용자 skip
  - 온보딩 완료 → `/welcome` → `/dashboard` 흐름 (신규 사용자 최초 1회)
  - **섹션 입력 UX (v2.9):** introText 맥락 연결, 질문 어조 부드럽게, 예시 긍정/혼합, 도움말 "③" 참조 제거
  - **장면 페이지 (v2.9):** cushionText 설명+이유, keyword 반복 제거, 멀티힌트, 2선택지(서브텍스트 통합)
  - **대시보드 카드:** shortTitle + 키워드 서브라인 ("나 자신 / 감정·성장·정체성")
  - AI 백엔드: Groq (`llama-3.1-8b-instant`, 500K TPD) — 모든 API 라우트 사용
  - `section/[id]`: InlineInput — example·hint prop, 도움말 패널 외부 렌더
  - 질문 순서: 지금(current) → 원해(want) → 더 들여다보기(feeling) → 방향 키워드(keyword)
  - CJK 문자(한자·히라가나·가타카나) 응답 필터 (`stripCJK`)
  - `finish`: 패턴→한 문장→스토리→완성 4페이즈
  - 온보딩 7단계, ProcessBar 4 STEP, localStorage 임시 저장
- **알려진 이슈:**
  - Unsplash 검색: `UNSPLASH_ACCESS_KEY` 미설정 (이미지 기능 비활성)
  - llama-3.1-8b-instant: 70b 대비 생성 품질 저하 가능 (모델 한도 초과 시 임시 조치)

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

### 2026-06-02 (카피 개선 7개 이슈 + 배포)
- `questions.ts`: introText 6개 맥락 연결, current questionText 3개 어조 개선, example 4개 긍정/혼합 교체, helpQuestion "③" 참조 제거
- `scene/[id]`: cushionText 설명+이유 추가·keyword 반복 제거, 멀티힌트, 3선택지→2선택지+서브텍스트
- v2.9 전체 Vercel 프로덕션 배포 완료 (commit fd35a5c)

### 2026-06-02 (v2.9 UX 전면 개편 — 랜딩·프로세스오버뷰·섹션·장면)
- 랜딩 페이지 구조 재설계: Hero 차별점 강조 + Contrast 섹션(기존 비전보드 vs lumi) 신규 + How it works·CTA 카피 전면 교체
- `/welcome` 신규 페이지: 온보딩 후 4단계 타임라인(발견→장면→이미지→완성) + 6색점 + 기존 사용자 skip (`welcomeSeen` 플래그)
- 섹션 UX: 브릿지 쿠션 메시지, InlineInput example·hint prop, 도움말 패널 연결, 리뷰 라벨+값 행 레이아웃, 대시보드 카드 키워드 서브라인
- 장면 페이지: keyword 기반 동적 질문, 완성 후 3선택지(이미지 지금/다른 영역/나중에 한꺼번에)

### 2026-06-01 (v2.8 섹션 카피 개선 구현 + 배포)
- `types.ts` `shortTitle?` / `whyText` 필드 추가, `questions.ts` 6개 introText "이번엔" 제거 + Section 1 `shortTitle: '나 자신'` + 6개 `whyText` 공감 버블 신규
- `dashboard`: 섹션 카드 제목 shortTitle 우선 표시, `section/[id]`: introText 다음 whyText 버블 노출, `SectionComplete`: "{title} 이야기, 다 썼어." 패턴 통일
- Vercel 프로덕션 배포 완료 (commit 99e3284)

### 2026-06-01 (섹션 카피 개선 — 플랜 완성, 구현 대기)
- /copywriting + /marketing-psychology 스킬 적용 — 대시보드 "나" 단독 표시, 섹션 introText "이번엔" 패턴, SectionComplete 문구 문제 분석
- 최종 플랜 확정: `shortTitle` 필드 추가(Section 1 → "나 자신"), 6개 `introText` 전면 교체(패턴 다양화), 6개 `whyText` 신규(공감 메시지), SectionComplete " 이야기" suffix
- 변경 대상: `lib/types.ts`, `lib/questions.ts`, `app/dashboard/page.tsx`, `app/section/[id]/page.tsx`, `SectionComplete.tsx` — 구현 미진행

### 2026-05-31 (v2.7 섹션 입력 + 장면 페이지 개편)
- v2.7 섹션 입력 UX 전면 개편: AI 채팅 제거 → 고정 질문 4개 + 내러티브 리뷰 방식으로 전환
- 장면 페이지 개편: AI 채팅 제거 → 이전 답변 컨텍스트 활용 + 고정 질문 방식으로 전환

### 2026-05-31 (v2.6 랜딩 페이지 + UX 전환 개선)
- 랜딩 페이지 신규 (`app/page.tsx`): hero("목표가 없어도 괜찮아.") + problem + how it works + what you get, 기존 사용자 자동 대시보드 리다이렉트
- 온보딩 완료(`handleFinish`) → `/dashboard` 대신 `/section/1` 직행, 대시보드 첫 방문 배너 카피 "어디서부터 해도 괜찮아" → "나 섹션부터 시작해봐"
- 장면 완료 버튼 "이미지 찾으러 가기 →" → 완료 상태 기반 동적 텍스트 (마지막 섹션: "비전보드 완성하기 →", 중간: "대시보드로 돌아가기")

### 2026-05-31 (v2.5 섹션 UX 재설계)
- InlineInput 컴포넌트 신규 (`components/InlineInput.tsx`): 하단 고정 입력창 제거 → lumi 질문 아래 인라인 텍스트박스 (슬라이드 애니메이션, step별 placeholder 예시)
- 도움 버튼 재설계: "다른 질문 형태로 볼게" 제거 → InlineInput 하단 "답변 도와줘" + 섹션별 helpQuestions/example 데이터로 패널 내용 교체, 예시 버튼 → 텍스트
- 섹션 완료 전환: "장면 바로 그려가기" / "다른 섹션 질문 시작하기" + 가이드 설명, Scene 완료 후 dashboard 허브 방식
- AI 버그 수정: STEP 0 하드코딩 "건강" 예시 → 실제 섹션명 주입, "안녕하세요 친구" 인사 버그 프롬프트 수정
- Groq 모델 변경: llama-3.3-70b-versatile (100K TPD 소진) → llama-3.1-8b-instant (500K TPD)

### 2026-05-31 (v2.4 채팅 UX + 입력 개선)
- v2.4: 언어 혼용 차단 강화 (CJK 필터 `stripCJK`, 시스템 프롬프트 최상단 언어 규칙), 예시 형식 개선 (단답+문장형 병렬), `lib/helpContent.ts` 신규, "다른 질문 형태로 볼게" 도움 패널 (스텝당 최대 2회, 예시 카드 탭 전송)
- v2.4b: Enter=줄바꿈/"다 썼어 →" 버튼 전송으로 변경, 가이드 텍스트 placeholder 통합, lumi 질문 주어 "나는"→"너는/[이름]이는" 수정 (userName을 API에 주입)
- v2.4c 플랜 완료(미구현): 점수 범위별 반응 지침 / 말풍선당 역할 1개 원칙 / nextSlot contextNote 주입 / temperature 0.5 / "맞아" 버튼 API 없이 직접 완료 처리

### 2026-05-31 (v2.3 섹션 채팅 UX)
- Groq API 키 Vercel 등록 (Production + Development), 프로덕션 배포
- 섹션 채팅 다중 말풍선 구조: `message: string` → `messages: string[]`, 300ms 스태거 딜레이
- lumi 질문 순서 재설계: 지금 → 원해 → 더 들여다보기 → 방향 키워드
- 프롬프트 품질 개선: 한국어 전용, STEP 브릿지 패턴, 슬롯 추출 강제, 미러링 안전 조건 (4개 슬롯 모두 채워야 진입)
- "잘 모르겠어 😅" 도움 버튼 추가 (lumi 마지막 말풍선 아래, helpQuestions 트리거)

### 2026-05-31 (v2.2 완료)
- Anthropic → Gemini 전체 마이그레이션: `@google/generative-ai` 설치, 4개 API 라우트 교체 (`gemini-1.5-flash`)
- v2.2 플랜 Task 4~10 완료: 구 컴포넌트 6개 삭제, ProcessBar 4-STEP, 온보딩 7단계, `/api/chat/scene`, `scene/[id]` 채팅 UI, `/api/story`, `finish` 4페이즈
- 로컬 실행 후 버그 수정: `gemini-2.0-flash` 무료 쿼터 초과 → `gemini-1.5-flash` 전환, 온보딩 step 7 뒤로가기 버튼 + 첫 질문 프리뷰 문구 수정

### 2026-05-31 (v2.2 재설계 시작)
- PRD v2.2 수령 + 구현 플랜 10개 Task 작성 (`docs/superpowers/plans/2026-05-31-v2-chat-redesign.md`)
- Task 1: `lib/types.ts` + `lib/storage.ts` — ChatMessage, ExtractedSlots 타입 + 채팅 저장 함수 5개
- Task 2: `/api/chat/section` — lumi 섹션 채팅 API (슬롯 추출 + JSON 반환)
- Task 3: `ChatBubble.tsx` + `ChatInput.tsx` 공용 컴포넌트 생성
- Task 4 진행 중: `section/[id]/page.tsx` 채팅 UI로 재작성 완료, 기존 컴포넌트 삭제 전 인터럽트

### 2026-05-31
- `Playground/flowchart.html` v0.7 → v1.0 업데이트: 현재 빌드 기준 전체 플로우 반영
- 전체 플로우: deferred phase(DeferredCheck), /scene 허브(순서 자유), /finish 완성 페이지, AI 요약 카드 추가
- 섹션 상세 탭: PHASE 3+4 제거, 최신 질문 텍스트(questions.ts) + 컬러(관계#F59E0B/돈#F97316/공간#06B6D4) 동기화
- 로컬 HTTP 서버(포트 8765) 실행 → 크롬에서 라이브 URL로 오픈

### 2026-05-30 (3차)
- UI/UX Pro Max 스킬 적용: 디자인 시스템 분석 + 접근성 이슈 발견 (`cursor-pointer` 누락, `prefers-reduced-motion` 미지원)
- `globals.css`: `button { cursor: pointer }` 전역 + `prefers-reduced-motion` 추가
- 카피 완료: onboarding Step 5(페인포인트+효과), review 헤더, scene 인트로/이미지 안내 lumi 톤
- 대시보드 상태 명확화: 2단계 도트 + 완성 카드 배경색 + "글 완료/✓ 완성" 라벨
- 온보딩 UI 폴리시: lumi 아이콘 그라디언트+그림자, Step 4 버튼 개선, Step 5 컬러 바
- Vercel 배포 2회 완료

### 2026-05-30 (2차)
- 전체 카피 리뷰 + lumi 톤 최종 정리: 온보딩 Step1 훅 강화, Step4 불필요한 skip 버튼 삭제, Step5 비전보드 효과 담은 문구로 교체
- 섹션 subtitle 3개 교체: 일·성장 → "어떤 일로 배우며 성장하고 싶어?", 돈·생활 → "여유로운 상태에서 어떤 선택을 하고 싶어?", 공간·환경 → 질문형으로
- Review 헤더 + AI 서브텍스트 교체, Scene 마이크로카피 lumi 톤, SlotQuestion 마지막 버튼 교체
- Vercel 배포 완료

### 2026-05-30
- lumi 캐릭터 방향 확정: "빛을 비추는 안내자" (Option B) + 친근한 말투 (Option C) 혼합
- 랜딩 페이지 카피 전체 작성: 헤드라인 3안 → "비전보드, 목표가 없어도 만들 수 있어요" 채택
- lumi 온보딩 스크립트 v2 작성 + 코드 적용 (Step 1~5 전면 개선)
- 전체 마이크로카피 lumi 톤으로 교체: SlotQuestion, PhaseReview, SectionComplete, Dashboard, Board, Finish, questions.ts subtitle 6개
- 건강 섹션 subtitle 정렬 이슈 수정 (짧은 1줄 → 질문형으로 교체)

### 2026-05-29 (2차)
- 실기기 피드백 반영 UX 전면 개선: 섹션 이름 명시, CTA 다양화, Review 1열 레이아웃, Scene 답변 패널 + Tab-to-fill
- Scene done 인터루드: 비전보드 X/18 진행 바 + 다음 섹션 CTA
- Unsplash API 연동: 장면 텍스트 기반 이미지 키워드 검색 (`/api/unsplash`)
- DeferredCheck 렌더 중 setState 버그 수정 (useEffect로 이전)

### 2026-05-29
- Review 페이지 개편: 헤더 카피 변경, 6섹션 2열 그리드, AI 종합 요약 카드 (Claude Haiku `/api/summarize`), 장면 그리기 온보딩 블록
- Scene 페이지 대개편: intro 스텝(맥락 설명 + 이전 답변 요약), 3개 독립 장면 textarea, 이미지-장면 연결 UX
- 대시보드 완료 배지 색상 버그 픽스: 섹션별 색상 → 일관된 녹색
- 섹션 답변 수정 버그 픽스: 완료 후 재진입 시 review 화면으로 시작
- 타입/스토리지 확장: `SectionData.sceneTexts[]`, `saveSectionSceneTexts()`

### 2026-05-28
- Stage 1 Next.js 프로토타입 구현 — 랜딩, 온보딩, 대시보드, 섹션 PHASE 1+2, 비전보드 그리드, FINISH
- lumi 5단계 대화형 온보딩 재설계 (이름 입력 → localStorage 저장, 공감 선택, 초대)
- 섹션 타이틀 PDF 기반 업데이트 (나→감정·성장·정체성, 건강→몸·마음·에너지 등)
- CTA 버튼 로직 개선: 텍스트 입력 시만 활성화 + "잠시 스킵할게요" + 미답변 슬롯 체크 화면
- PHASE 3 분리: 장면 그리기 허브(`/scene`) — 전체 섹션 완료 후 원하는 섹션부터 선택
- Vercel 배포 완료 — https://vision-board-web.vercel.app
- 온보딩 구현 변경사항 문서화 (`온보딩_구현_변경사항_v0.2.md`)

### 2026-05-27 (2차)
- PRD v0.1 작성 — 기능 명세, 데이터 모델, 이미지 옵션 비교, 기획 허점 20개 분석
- PRD v0.2 업데이트 — D4/D6 충돌 해소("나중에 답할게요"), 단계별 빌드 플랜 STAGE 1~5
- question_flow.md 완성 — 6섹션 × 슬롯별 메인 질문 + placeholder + 예시 + 서브질문 전체 확정
- 기술 스택 확정: Next.js + Supabase + Vercel

### 2026-05-27
- 비전보드_플로우_v0.6.md 분석 + Playground/docs/ 저장
- 박지현 PDF 6섹션 이미지 분석 → 섹션 내 올바른 흐름 확정 (①②③⑤→리뷰→④→⑥)
- 인터랙티브 플로우차트 HTML 제작 (전체 플로우차트 탭 + 6섹션 컬러 탭)
- GitHub 레포 생성 + Pages 배포 (https://helenmellybelly.github.io/vision-board/)
