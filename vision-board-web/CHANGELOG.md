# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** v6.18 콜라주 기기별 편집 재설계 + 온보딩 카드 컬러 + 보드 간격 조정 완료
- **주요 기능:**
  - /collage: 보드(4:5)/폰(9:19.5)/PC(16:9) 3탭 모두 직접 편집(드래그·리사이즈·스티커), 타깃별 배치 분리 저장(collageDeviceLayouts), 풀블리드 WYSIWYG 내보내기, 프리셋 타깃별 필터
  - "섹션 묶음 N장" 출력 및 WallpaperPreview/renderSectionPair/renderAllInOne 제거
  - 온보딩 Act 4 카드: 🧠🎯🌱 이모지 + 파스텔 팔레트(F2EDF7/8F5CF6, E9F4EF/10C6C1, F9F2E7/F59E0B)
  - /dashboard: 완성 섹션 폴라로이드 썸네일 제거(컬러 도트 통일), /board: content-evenly 간격 재분배
- **알려진 이슈:** 없음 (UNSPLASH_ACCESS_KEY 미설정으로 이미지 추천만 비활성)

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

### 2026-06-12 (v6.18 — 콜라주 기기별 편집 + 피드백 3건)
- /collage 재설계: 폰/PC 미리보기(읽기 전용) → 기기 비율 그대로의 편집 보드로 전환. CollageTarget(board/phone/desktop)별 배치 분리 저장, 시드 생성기 aspect 파라미터화(폰 시계영역 예약, PC 폭 축소), renderBoardLayout 풀블리드화, 섹션 묶음 모드·WallpaperPreview 삭제
- 온보딩 Act 4 카드: Lucide 아이콘 → 🧠🎯🌱 + 사용자 지정 파스텔 팔레트 (6/9 시안)
- /dashboard 완성 섹션 사진 썸네일 제거, /board 간격 content-center→content-evenly + 섹션 헤더 mb-2.5
- Playwright 17건 검증 통과 (무스크롤 667/800/900, 타깃별 배치 독립성, 프리셋 필터)

### 2026-06-09 (v6.3 — 온보딩 스토리텔링 최종 QA + 배포)
- 온보딩 Act 0: 인사 영상(인사.mp4) autoplay loop muted 적용, 재생 버튼 제거
- 온보딩 Act 0: 신규 텍스트("안녕, 나는 토리야...") 적용, 버튼 "다음 →" 통일
- 온보딩 Act 1: 프로필 이미지(프로필상반신.png) 교체, animate-float 제거
- 온보딩 Act 2: 도토리 이야기 2.2초 자동전환 → 탭 투 컨티뉴 + 4초 fallback
- globals.css: @keyframes float / .animate-float 완전 제거
- Playwright QA: Act 0→1→2→3→4 전체 흐름 정상 확인
- Vercel 배포 완료

### 2026-06-09 (v6.2 — 온보딩 UX 진단)
- 온보딩 전체 플로우 분석: 몰입도 저하 요소 7가지 진단
- 재설계 방향성 수립: 캐릭터 모션(framer-motion), select phase 제거, 비전보드 예시 캐러셀, 버킷리스트 없음 fallback
- 핸드오프 생성 — 다음 세션에서 구현 재개 필요

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
