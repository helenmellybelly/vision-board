# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** v3.6 프로덕션 라이브 — 미니스토리·이미지 프롬프트 품질 개선 + 스크롤 버그 수정
- **주요 기능:**
  - 섹션 채팅(lumi) → 장면 → 미니스토리(소설체 450-600자) → 이미지 3장(gpt-image-1 1024×1024)
  - 채팅 스크롤 즉시 바닥 이동 (requestAnimationFrame)
  - 이미지 프롬프트: 35mm film / grain / documentary style, sceneText 우선 반영
- **알려진 이슈:** 실사용 테스트 미완 (미니스토리·이미지 품질 실제 확인 필요)

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

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
