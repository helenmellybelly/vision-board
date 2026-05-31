# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** Stage 1 완료 + UI/UX 폴리시 1차 완료 + 플로우차트 v1.0 — https://vision-board-web.vercel.app
- **주요 기능:**
  - Next.js 비전보드 웹앱 (`vision-board-web/`) — Vercel 배포 완료
  - lumi 5단계 대화형 온보딩 — 카피 v2 + UI 폴리시 적용 (아이콘 그라디언트, 버튼 개선, 컬러 바)
  - 6섹션 PHASE 1+2 전체 질문 흐름 + 슬롯별 CTA 다양화 + 수정 중 배지
  - Review 페이지: 1열 레이아웃 + 4슬롯 전체 표시 + 섹션별 수정 링크 + AI 요약 카드
  - Scene 페이지: 답변 패널(접기/펼치기) + Tab-to-fill 스마트 플레이스홀더 + X/18 완료 인터루드
  - 이미지: 업로드 + Unsplash 키워드 검색 탭 전환 (`/api/unsplash`)
  - localStorage 임시 저장 + 모바일 퍼스트 레이아웃
  - 전체 마이크로카피 lumi 톤으로 완전 교체 (온보딩·질문·리뷰·장면 전 영역)
  - 대시보드: 2단계 진행 도트 + 완성 카드 섹션 색 배경 + "글 완료/✓ 완성" 상태 명확화
  - 접근성: `button { cursor: pointer }` 전역 + `prefers-reduced-motion` 지원
  - `Playground/flowchart.html` v1.0: 현재 빌드 기준 전체 플로우 + 6섹션 질문 최신화
- **알려진 이슈:**
  - AI 요약: `ANTHROPIC_API_KEY` Vercel 환경변수 미설정 (설정 필요)
  - Unsplash 검색: `UNSPLASH_ACCESS_KEY` Vercel 환경변수 미설정 (설정 필요)
  - 온보딩 예시 보드 — 실제 이미지 미제작 (컬러 그리드 placeholder로 대체)
  - 전체 UI 레퍼런스 기반 재설계 예정 (유저가 레퍼런스 제공 후 진행)

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

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
