# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** v6.1 카피/컨셉 개편 — 버킷리스트 자유입력+선택 플로우, 정원사 말투 통일, '꿈'→'원함' 교체
- **주요 기능:**
  - 온보딩 4단계: Step1 도토리 메타포 제거→비전보드 설명, Step2 textarea 다중항목+select phase 도입
  - 버킷리스트 배열 저장: `bucketListItems: string[]` 타입 확정, 다중 항목 지원
  - 대시보드: gardenState 이모지 표시 + 버킷리스트 서브 섹션
  - 피니시: 온보딩 버킷리스트→완료 연결고리 노출
  - 랜딩: 비전보드 설명+예시 질문 추가로 진입장벽 완화
  - 정원사 말투 통일: helpContent/placeholders/questions 전반
- **알려진 이슈:** 온보딩 Step 2 select phase 불필요 의견, 캐릭터 이미지/모션 미적용, 예시 비전보드 캐러셀 미구현

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

### 2026-06-10 (v6.1 — Bucket List 개선 + 카피/컨셉 정비)
- 온보딩 Step 2: 단일 입력→textarea 다중항목+select phase로 개편
- 온보딩 Step 1: 도토리 메타포 제거, 비전보드 설명으로 교체
- 저장 구조: `bucketListItem`→`bucketListItems: string[]` 배열 확정
- 랜딩/대시보드/피니시: 버킷리스트 컨텍스트 연결 추가
- lib/ 전반: 정원사 말투 통일, '꿈'→'원함' 교체 (helpContent/placeholders/questions)
- build 성공 + Playwright로 온보딩 Step 2 풀사이클 동작 확인

### 2026-06-08 (v6.0 — Tori Rebrand)
- AI 가이드 lumi(✦) → 🐿️ 토리(꿈의 정원사) 리브랜드
- 온보딩 7단계→4단계 압축: 토리 등장 → 버킷리스트+상상 → 이름+상태 → 진입
- 전체 UI에서 ✦→🐿️, 정원/화단 워딩 제거 (정원사 아이덴티티만 유지)
- 질문 cushionText/introText/whyText 원문 복원 (정원 메타포가 질문 의도 바꾸던 문제 수정)
- 타이핑 애니메이션 keyframe(animate-typing) 추가

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
