# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** v6.21 전체 플로우 리뷰 개선(질문 단일화·용어 통일·상태 기반 내비·완료 시트·welcome 제거) — **푸시·프로덕션 배포 완료** (커밋 5c49363, vercel inspect target=production + 4경로 200, /welcome 404 정상) + **UNSPLASH_ACCESS_KEY 등록 완료**(/scenes 추천 활성)
- **주요 기능:**
  - 질문 정의 단일 소스: lib/questions.ts phaseOneQuestions(example·helpQuestions 병합)+sceneStep — slots[] 이중 정의 제거. 라벨은 lib/slotLabels.ts(지금/원해/더 들여다보기/방향 키워드, 순서 [1,3,5,2])
  - 상태 기반 내비: lib/sectionRoute.ts getNextIncompleteRoute(review CTA)·getStepRoute(ProcessBar 단계 탭이 작업 위치로) — '/scene/1' 하드코딩·step2·3 중복 /review 해소
  - 섹션 완료 바텀시트(/scenes 저장 후): "{섹션} 완성! n/6" + 다음 미완성 섹션 연속 진행 CTA + 대시보드 보조
  - 진입 축소: /welcome·/scene 허브 삭제(온보딩 → /dashboard 직행), /dashboard 온보딩 가드, 보드 CTA는 사진 있을 때만
  - 용어 통일: 완성물=비전보드(이미지보드 제거), /scenes 표시명 '순간 N'·'사진 담기', 관계 섹션 일반화(연인·가족·친구, '남편' 제거), 온보딩 6영역 카드는 SECTIONS 파생
  - finish 피날레: 완성 확정 시에만 finishedAt 기록, 이름 헤드라인+한 문장 인용+키워드 칩+배경화면 CTA (peak-end)
  - /scenes: 순간 1·2·3 묘사에 어울리는 Unsplash 추천 행 (/api/image/keywords, imageKeywords 저장). /section: 규칙+AI 의미 검증(fail-open). /collage: 보드 기본+기기 사이즈 우선 플로우
- **알려진 이슈:** hydration #418 경고는 전 페이지 공통 useState(loadBoard()) 패턴의 기존 이슈(표시는 정상)

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

### 2026-07-07 (임시 파일·미사용 에셋 정리)
- 미참조 public 에셋 18개 git rm(인사*·프로필상반신·tori-final*·tori-hello·tori-gardener·tori-profile·기본 svg 5종 — 참조 5개만 잔존), untracked 미참조 tori-alpha.webm·tori-fallback.mp4 삭제
- 루트 미디어 원본 8개는 삭제 대신 `_archive/`(gitignore)로 보존 이동, 재생성 가능 산출물(스크린샷·.playwright-mcp 로그·commit-msg 임시·shots/) 삭제
- .gitignore 보강: _archive/·.omo/·.playwright-mcp/·.claude/skills/(루트), .claude/shots/·commit-msg-*.txt·.superpowers/(web) + verify-v618~620.mjs 커밋으로 status 청소

### 2026-07-07 (v6.21 프로덕션 배포 + UNSPLASH_ACCESS_KEY 등록)
- `npx vercel --prod` 배포 → vercel inspect target=production 확인, 4경로 200 + /welcome 404(삭제 정상)
- UNSPLASH_ACCESS_KEY 발급(사용자)·등록: .env.local + Vercel production env(기존 빈 값 변수 rm 후 add 필요) → 재배포, 로컬·프로덕션 /api/unsplash 사진 반환 확인 — /scenes 순간별 추천 활성

### 2026-07-07 (v6.21 — 전체 플로우 리뷰 개선: P0 혼란 제거 + P1 동선 최적화 + P2 콘텐츠 품질)
- 전체 플로우 리뷰(Explore 3에이전트) → P0~P2 플랜 승인 후 일괄 구현: 질문 이중 정의(slots[]) 단일화, 죽은 코드 13개 삭제(Phase* 6종·ChatInput·helpContent·placeholders·onboarding-prompt·api/chat), 슬롯 라벨·6영역 부제·완성물 용어 단일 소스화, '남편' 하드코딩 일반화+토리 질문 주어 너/네 통일
- 동선: review CTA·ProcessBar 상태 기반 라우팅(getNextIncompleteRoute/getStepRoute), /scenes 저장 후 완료 바텀시트로 다음 섹션 연속 진행, /welcome·/scene 허브 삭제(첫 질문까지 1화면 단축), /dashboard 온보딩 가드+보드 CTA 조건 노출, finish 마운트 부작용(finishedAt) 제거
- 카피: '장면' 이중 의미 해소(순간 N·사진 담기), renderStory·굵게 안내·describe 프롬프트 공통부 단일화, scene 쿠션 여정 위치 안내, review 헤더 역할 명시, finish 완성 화면 peak-end 강화(한 문장 인용+키워드 칩)
- 검증: build 통과 + .claude/verify-v621.mjs 30/30 PASS → 커밋 5c49363 (배포는 다음 세션)

### 2026-06-12 (v6.20 — Unsplash /scenes 이동 + 온보딩·웰컴·moment 폴리시)
- Unsplash 추천을 /section 채팅에서 /scenes 장면별 추천으로 이동: /api/image/keywords(gpt-4o-mini)가 묘사 3개를 영어 검색어로 변환해 SectionData.imageKeywords에 저장, SceneImageSuggestions가 장면 1·2·3 행 렌더(키워드 없으면 imageQuery+page 분산 폴백)
- 온보딩 Act4 효능 카드 간격 확대(제목-설명 mb-1, py-2.5, 카드 간 2.5), /welcome 단계 0.25s 순차 등장+텍스트 확대(17/15px), /moment CTA "비전보드 이미지 만들기"
- Playwright 13건 검증 통과(.claude/verify-v620*.mjs) → 커밋 10fcf58 푸시 + 프로덕션 배포(dpl_3wSZwKS9h6AxLL7ichVDJo8xnaLf)

### 2026-06-12 (v6.19 — 답변 검증 + 콜라주 사이즈 우선 재설계)
- /section 답변 하이브리드 검증: lib/answerValidation.ts(규칙) + /api/validate/answers(gpt-4o-mini 의미 검증, 실패 시 fail-open). InlineInput onSubmit이 false 반환 시 입력 유지, 리뷰 카드를 질문 전문+답변 구조로 재설계(차단 시 예시+인라인 수정 자동 오픈)
- /collage 사이즈 우선 플로우: 보드/폰/PC 3탭 제거 → 보드 기본 + 기기 플로우(사이즈 선택 → 비율 그대로 편집 → 무크롭 내보내기). collageTemplates를 aspect 파라미터화, renderBoardLayout이 선택 해상도로 직접 렌더(센터크롭 제거 — 맥북 16:10·울트라와이드 잘림 버그 해소), CollageLayout.aspect + collageDevicePresets 마이그레이션
- /moment·/scenes "더 수정하기" 메뉴 제거, resetTo* 헬퍼 4종 삭제
- Playwright 35건 검증 통과 (.claude/verify-v619.mjs)

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
