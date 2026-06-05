# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** v5.1 프로덕션 라이브 — AI 이미지 생성 제거, 업로드/URL 전용으로 전환
- **주요 기능:**
  - 섹션 채팅(lumi) → 장면 → 순간(`/moment/[id]`) → 장면카드+이미지(`/scenes/[id]`)
  - `/moment/[id]`: situation 입력 + 스토리 생성 (2단계), 헤더에 ← 뒤로가기 버튼
  - `/scenes/[id]`: 묘사 3카드 (편집/슬롯별 재생성) + 직접 업로드 + URL 입력으로 이미지 추가
  - `/board`: 섹션별 이미지 3칸 + 스토리 보기 토글 (uploadedImages + generatedImages 모두 표시)
  - `/dashboard`: 섹션 진행 현황만 표시, 헤더 "지금 그려가는 내 삶"
- **알려진 이슈:** 없음

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

### 2026-06-05 (v5.1)
- AI 이미지 생성 완전 제거 → 직접 업로드 + URL 입력 방식으로 교체 (`scenes/[id]`)
- `moment/[id]` 헤더에 뒤로가기(←) 버튼 추가
- `/board` 페이지: 섹션별 스토리 보기 토글 추가, uploadedImages 미표시 버그 수정
- `/dashboard`: 이미지/스토리 제거 (board 전용으로 분리), 헤더 "지금 그려가는 내 삶"으로 변경

### 2026-06-05 (v5.0 구현)
- `/moment/[id]` 단순화: situation+story 2단계만 남김, 스토리 완료 → `/scenes/[id]`로 이동
- `scenes/[id]/page.tsx` 신규: 묘사 3카드(편집+슬롯별 재생성) + AI이미지/업로드 + 이미지 없이도 저장
- `api/image/describe-one` 신규: 특정 장면 1개만 재생성, 기존 다른 묘사 컨텍스트 포함
- 대시보드 각색물 뷰: 완성 섹션에 이미지 스트립 + 스토리 프리뷰 + 이미지 클릭 라이트박스

### 2026-06-05 (v5.0 플랜)
- 흐름 재설계 플랜 확정: `/moment/[id]`(story) + `/scenes/[id]`(이미지 업로드 전용) 분리
- AI 이미지 생성 제거, 업로드 전용으로 단순화
- 대시보드 각색물 뷰 설계: 이미지 스트립 + 스토리 프리뷰 + 이미지 클릭 모달
- 마케팅 심리학(Goal-Gradient, Zeigarnik, IKEA Effect, Peak-End Rule, AIDA) 적용 포인트 정의

### 2026-06-04 (v4.0)
- 이미지 흐름 5단계 재설계: 순간→스토리→원하는모습→방법선택→이미지 (method 단계 신규)
- 묘사 편집 저장 버그 수정: 탭→textarea 펼침→저장 버튼 + `saveImageDescriptions` 즉시 호출
- AI 이미지 describe 프롬프트 강화: 정체성("그 순간의 나") + 피크 모먼트 + 감각 디테일 구조화

### 2026-06-04 (v3.9)
- 묘사 카드 편집 인디케이터: `✏ 수정 가능` 칩, 포커스 시 섹션 컬러 border/배경 tint, 하단 안내 텍스트
- AI 이미지 슬롯별 overlay 액션 버튼: `↻ 다시 생성` (슬롯 단독 재생성) / `↑ 직접 올리기`
- storage.ts createEmptySection uploadedImages 5슬롯 수정

### 2026-06-04 (v3.7)
- 이미지 흐름 4단계로 재설계: 순간→스토리→**묘사 확인**→이미지 (한국어 묘사 AI 제안 + 사용자 편집)
- 섹션당 이미지 5개 구조: AI 최대 3개 + 사용자 직접 업로드 2개 (compressImage maxWidth 800 추가)
- `/api/image/describe` 신규, `/api/image/generate` descriptions[] 기반으로 변경, scene 페이지 back 버튼

### 2026-06-03
- 미니스토리 프롬프트 2단계 업그레이드: PRD v2.3 스펙 → 소설 작가 버전(system/user 분리, 450-600자, 장면 묘사 감정 금지)
- 이미지 프롬프트: 35mm film/grain/documentary 스타일, sceneText→storyBold→sectionTitle 우선순위
- 섹션 채팅 스크롤 버그 수정: bottomRef 이중 할당 → chatRef 단일 ref + requestAnimationFrame 즉시 스크롤

### 2026-06-03 (v3.5)
- 섹션 UX 전면 개선: sticky 입력창, 스크롤바 hover, 뒤로가기, 저장 표시, 인라인 수정
- 이미지 생성 gpt-image-1 원복 (dall-e-3 → gpt-image-1)

### 2026-06-03 (v3.4)
- 이미지 영구 저장 (JPEG 압축 → localStorage), Board 버그 수정, 반응형 레이아웃

### 2026-06-02 (v3.3)
- AI 스택 Groq → OpenAI gpt-4o-mini 전환, 서술체 프롬프트, 이미지 디버깅

### 2026-06-02 (v3.2)
- 대시보드 스마트 라우팅, 수정 기능(cascade 재작성), 이미지 에러 핸들링

### 2026-06-02 (v3.1)
- 스토리 350-450자 + 볼드, moment/[id] 마크다운 렌더링, 부분 성공 처리

### 2026-06-02 (v3.0)
- /moment/[id] 신규: 상황묘사 → 미니스토리 → 이미지 3장 흐름

### 2026-05-31 (v2.5–v2.8)
- InlineInput 컴포넌트, 섹션 카피 개선, 랜딩 페이지, 온보딩 리디자인

### 2026-05-29 (Stage 1)
- Next.js 비전보드 프로토타입 초기 구현 + Vercel 배포
