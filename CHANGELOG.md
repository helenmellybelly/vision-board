# Changelog

## 현재 상태
<!-- /wrap이 매 세션 이 섹션을 업데이트합니다 -->
- **상태:** v7.6 R1 실사용 피드백 라운드 — **프로덕션 배포 완료** (커밋 0e2d44c+bbeaaa5, https://vision-board-web.vercel.app 프로덕션 스모크 15/15 PASS). 숲 테마(다크 패널→딥 포레스트 그라디언트, 흰 폴라로이드 프레임 제거)·시작 어포던스("여기서 시작"+글로우 링)·예시 세트 로테이션("다른 예시 보기")·씬 브리지(섹션 채팅 안 안내→CTA). 회귀 15스위트 362/362 PASS(verify-v76r1 43케이스 신설). **로그인은 Google SSO 유지 확정**(이메일+비번 대안 기각 — 기획서 v7.6 재확인 블록)
- **리플래닝 기준 문서:** `vision-board-web/docs/리플래닝-v74.md` — 6섹션 구조 재진단(프레임 유지, 허들 3지점 해체: R1 카피↦R2 첫 보드 마일스톤↦R3 리빌 넛지, 선택형 섹션 폐기), R2=계정·영속성+첫 보드, R3=여정·결과물, R4+=백로그
- **주요 기능:**
  - 🐿️ 토리 캐릭터 (꿈의 정원사) — Acts 0-5 구조, 온보딩 전체 뷰포트 고정, 3뷰포트(375×667/390×844/1280×720) 무스크롤. v7.6: 이름 용도 힌트·"첫 스테이션은 5분" 기대값·도토리 채팅 딤 제거
  - 한국어 조사: `lib/josa.ts` 단일 소스(아/야·이/가·은/는·을/를·으로/로 ㄹ특례·이라는/라는, 비한글 fallback 무받침형) — 온보딩 이름 보간 + 씬 브리지/쿠션 키워드 조사
  - 디자인 시스템 (`docs/design-system.md`): 타입 스케일 7토큰 + UI Pretendard 단일 / 아트 Enjoystories(.font-script, collage 전용) (`scripts/check-typography.js` 기계 검증). **v7.6 숲 서피스 팔레트 `lib/colors.ts FOREST`**(deep #1F2E22→light #2A3D2E, card #33473A) — 산책길·미니보드·콜라주·배경화면 공유 단일 소스
  - 팔레트: 비비드 6색 `lib/colors.ts` 단일 소스 + 색 사용 문법 통일(색은 도트 전담, 텍스트·보더는 뉴트럴)
  - 대시보드 = 산책길 허브 (`components/WalkPathMap.tsx`): 숲 그라디언트 패널 위 도토리 출발→6스테이션(🌰/📷/✍️/🌳+완료 칩+🌿 수풀)→참나무 언덕. **첫 방문 "여기서 시작 ▾" 바운스 라벨 + 확산 글로우 링**(진행 생기면 라벨 소멸, reduced-motion 대응). aria-label 계약 `${label} — ${STATUS_LABEL}` 유지. pathSheet에 선택지별 기대값 서브라인
  - `/collage`: [폰|PC] 2탭, 템플릿 3종('숲'(구 폴라로이드, id는 polaroid 유지)·모자이크·미니멀) — **v7.6 프레임리스 라운드 사진 단일 경로**(DOM/canvas 락스텝), 스티커 프리셋 18종(이모지 chip/script 한정), 기기 프리셋 11종
  - 질문 플로우 (v7.6): 예시 `examples: string[]` 3세트(결핍·유지·성장 페르소나, 구체 명사/숫자) + "다른 예시 보기 ↻" 로테이션 + 형식형 플레이스홀더, want 복수 유도(3줄 멀티라인). **씬 브리지**: 방향 키워드 후 섹션 채팅 안에서 "미래의 하루 일기" 기대값 안내 버블→CTA로 /scene 진입, 씬 예시 산문/불릿 2형식
  - 하루 일기 (v7.3): 사용자 장면 중심 프롬프트(450-650자), scene 작성 가이드 카드(3행 — 형식 자유 포함)
  - 분석: @vercel/analytics 페이지뷰 + track 5종(커스텀 이벤트는 Pro 플랜 전용)
  - 이미지 추천: 섹션 채팅 첫 답변 직후 Unsplash 추천 4장 → 탭하면 슬롯 저장 → /collage 즉시 반영
- **알려진 이슈:** hydration #418은 전 페이지 공통 useState(loadBoard()) 패턴의 기존 이슈(표시는 정상). public에 미사용 한글 파일명 에셋 잔존(정리 대상). verify-v614의 팔레트 대비 정적 검사는 비비드 복원으로 FAIL이 정상.

## 세션 로그
<!-- ⚠️ APPEND ONLY — 아래 항목을 절대 삭제/수정하지 마세요. 새 항목은 이 줄 바로 아래에 추가합니다. -->

### 2026-07-23 (v7.6 R1 — 실사용 피드백 8건: 숲 테마·시작 어포던스·예시 로테이션·씬 브리지, 프로덕션 배포 완료)
- 오너 피드백 라운드: ① "검은 배경" 정체는 다크 패널 3곳(#2D2B29) → **딥 포레스트 그라디언트 채택**(사용자 결정, #1F2E22→#2A3D2E, `lib/colors.ts FOREST` 단일 소스, DOM/canvas 락스텝, 배경화면 픽셀 샘플 검증) + 완료 스테이션 🌿 수풀, ② 흰 폴라로이드 프레임 제거(사진만+라운드·그림자, 폭 +8%, 템플릿 라벨 '폴라로이드'→'숲'·id는 localStorage 키라 유지), ③ '나' 노드 시작 어포던스(glowRing 확산+정적 링 2겹, 첫 방문 "여기서 시작 ▾" — 사진 포함 진행 시 소멸), ④ 도토리 채팅 opacity-60 딤 제거
- 예시 전면 개편: `example: string`→`examples: string[]` 강제 rename(tsc로 소비처 전수 열거) — 질문당 3세트(결핍·유지·성장 페르소나, 구체 명사/숫자≥1, 오너 실답변의 구체성 수준으로 신규 작성), want 3줄 멀티라인+"떠오르는 만큼 여러 개 적어줘", 형식형 플레이스홀더, InlineInput "다른 예시 보기 ↻" 순환(세트 0 시작 — 테스트 결정성)+rows prop
- 씬 브리지(사용자 명세: 안내가 씬1 안에 나온 뒤 전환): 리뷰 검증 통과 → 토리 버블("'키워드'가 이뤄진 N년의 하루… '미래의 하루 일기'로 다듬어줄게", josaOnly 조사 처리)+CTA "미래의 하루 그려보기 →"가 페이지 전환. /scene 쿠션은 "질문은 끝났어"→재인사로 교체, 가이드 카드 3행("문장으로 써도, 장면 단어만 나열해도 좋아"), 씬 예시 산문/불릿 2세트 로테이션
- 마이크로 카피(행동→기대값): 이름 힌트·5분 기대값·인트로 최종 보상(참나무 언덕 배경화면)·pathSheet 선택지별 결과("질문 4개에 답하면 → 미래의 하루 일기"). 스티커 프리셋 8→18종(이모지는 chip/script만 — outline strokeText가 이모지 외곽선을 깨뜨림)
- **로그인 확정**: 이메일+비번 대안 검토 → 기각(비밀번호 재설정용 메일 발송 인프라·해시 저장이 추가 필요, 마케팅 동의 구조는 인증 방식 무관) → Google SSO 유지, 기획서 v7.6 재확인 블록 기록
- 검증·배포: verify-v76r1 신설 43케이스 + 구 4스위트 갱신('폴라로이드'→'숲' 3곳 `.first()`, v73r1 쿠션 단언) → **15스위트 362/362 PASS** + 배경화면 캔버스 픽셀 샘플 + `npx vercel --prod` + 프로덕션 스모크 15/15(콜라주 템플릿 셀렉터는 사진 있어야 노출 — 빈 시드 위양성 1건 교정)

### 2026-07-23 (v7.5 R1 — 산책길 대시보드 + 콜라주 2탭 + 회원가입 기획서 개정, 프로덕션 배포 완료)
- 실사용 피드백 라운드: ① 대시보드 미니보드(첫 사진 대표)가 공간 대비 정보 가치 낮음 → **산책길 지도 채택**(사용자 결정, 기존 산책길 기획서 R1 범위), ② "1칸이 채워졌어" 캡션 제거, ③ CTA를 타이틀 바로 아래로, ④ 콜라주 보드 탭 제거, ⑤ Google 로그인 유도 구조 재결정
- `components/WalkPathMap.tsx` 신설: % 좌표 앵커 8개 단일 소스 → SVG 점선 bezier 경로 + absolute 스테이션 버튼(44px, 상태 이모지 🌰/📷/✍️/🌳+완료 칩, 사진 미표시), 토리 마커 = 추천 스테이션. aria-label 계약 유지로 구 셀 라우팅 케이스 무수정 통과. 진행 카피 4분기(시작 전/산책 시작/N/6 스테이션/길 끝 도착, 분자=completed) — 대시보드 높이 ≤1.2뷰포트 유지(R3-1b 무완화 통과)
- 대시보드 재배치: 추천 카드→리뷰 버튼→내 비전보드 보기→사진부터 CTA 묶음이 타이틀 직하, 진행바→산책길 지도→연도 행 순. DashboardIntroSheet "6칸짜리 정원"→"6개 스테이션이 있는 산책길"("세 칸부터"→"세 곳부터")
- 콜라주 2탭: CollageView에서 board 제거, BOARD_EXPORT_PRESET·"이미지로 저장"·부분완성 안내 삭제, `?view=board`→desktop 정규화, 완성 CTA·미래의 하루 이야기 블록을 기기 뷰 공통 노출로 게이트 해제(collageLayouts 데이터는 스키마 보존)
- 회원가입 기획서 v7.5 개정(구현은 R2): 유도 = 온보딩 종료 "Google로 시작/게스트로 시작" 선택 화면(게스트 유의 카피 — '캐시' 어휘 금지, "이 기기 브라우저에만 저장돼") + 첫 사진 직후 소프트 게이트 주 유도(C 배경화면 저장은 보조 강등), 동의 2종(필수 개인정보 + 선택 마케팅 "마인드/자기발견/자기성장/코칭" — 미체크 가입 차단 불가, users.marketing_consent), §9 운영 가이드(Neon SQL 가입자·활동 조회, Web Analytics, track은 Pro 전용)
- 검증: verify-v75r1 신설 27케이스 + 구 스위트 7종 갱신(v73r1 보드 탭→부재·정규화, v74r1 카피, v7r5 산책길·사진 부재, v71r3 참나무 언덕, v72r1 🌱→🌰·PC 복귀, v7r1/v71r1 인트로 카피, v618b 아카이브) → **14스위트 319/319 PASS**. 신규 발견: 산책길 '완료' 칩이 연도 편집 '완료' 버튼과 strict 다중 매칭 → role 셀렉터로 교정. hydration #418은 기존 전역 패턴
- 배포: 사용자 승인 후 `npx vercel --prod` — Ready 확인, 10경로 200 + /moment 404, 프로덕션 번들 grep(스테이션 카피·참나무 언덕·산책길 인트로 존재, "1칸만 있어도" 부재)

### 2026-07-23 (v7.4 R1 — 전면 리뷰 리플래닝 + 6섹션 허들 해체 R1 + LLM 무료화, 프로덕션 배포)
- 전면 리뷰 4문항(가입·여정·Pinterest·일기) + 사용자 추가 요청 "6섹션이 최선인가" 진단 → `docs/리플래닝-v74.md` 확정: 6섹션 프레임 유지, 6/6 허들의 실체는 CTA 3곳+카피(시스템은 이미 부분 상태 관용), 3단 해체(R1 카피 → R2 3섹션 "첫 보드" 마일스톤 → R3 리빌 넛지), 선택형 섹션 폐기(회피 영역=발견 가치 최대), Pinterest 폐기·회원가입 기획서 R2 채택
- 구조 카피(R1 몫): 개화("피어나/피었어") 제거→중립 진행, 초반 분모 6 완화("N칸 채워짐"), 부분 가치("1칸만 있어도 네 보드야"+보드 버튼 배경화면 부제+collage 부분 상태 1줄), 인트로 시트 코어 경로("먼저 마음 가는 세 칸부터")
- 퀵윈: 일기 재생성 합산 2회 제한→직접 수정 유도, "나중에 답할게요" 슬롯 유예(keyword 불가, 완료 판정 "keyword 필수+답변/유예", 리뷰·/review 회수 동선), pathSheet 프리하이라이트+3연속 생략, 다중 파일 업로드, 완료 시트 "오늘은 여기까지도 충분해", scene 가이드 접힘, 질문 정비 4건(S3 current 현재 인식·S6/S2 feeling 각도·S4/S5 양방향)
- 온보딩 몰입(스킵 없이): Step1 실시간 호명 미리보기, Step2 도토리 심기 인터랙션(CSS 키프레임 낙하+새싹), Step3 막연→선명 슬라이더 직접 조작
- LLM 0원화: lib/llm.ts(Gemini flash 무료 티어 1차→Groq 2차), OpenAI 라우트 4개 전환, @anthropic-ai/sdk·openai 제거. 고정 모델명(gemini-2.5-*)이 "no longer available to new users" 404로 부패 → `gemini-flash(-lite)-latest` 별칭 채택. Vercel env는 파이프 stdin이 빈 값으로 등록되는 함정 → 개행 포함 파일 리다이렉트로 재등록+재배포
- 검증·배포: 사전 v7.4 감사 변경분 별도 커밋(b67d75b) → R1 커밋(cbc733a) → verify-v74r1 신설(32케이스)+구 스위트 5종 신 UX 갱신 → 13스위트 290/290 PASS, 일기 3편 기계 검증(450~650자·볼드 1곳), 프로덕션 스모크(11경로 200·번들 카피 grep·Gemini 시그니처 실측)
- 전역 규칙 승급 2건(HITL 승인): Gemini latest 별칭 규칙 + Vercel env 파이프 함정 → `~/.claude/CLAUDE.md` (LESSONS에 승급 표기)
- 온보딩: 스텝1 누락 문장("우리가 함께 비전보드를 만들어 갈 거야") 추가 — 프로덕션 번들 grep으로 '배포 문제 아님·카피 부재'로 판별. 스텝2 도토리 문안 반말 교체 + CTA "그래, 함께 해보자!"
- 대시보드: "질문 없이, 사진부터 담아볼래?" 시트(섹션별 /scenes 직행), 연도 캡션+스테퍼 편집. 하드코딩 "3년 뒤" → targetDate 파생(scene 쿠션·review·finish)
- collage 재구성: 기본 뷰 PC, 사이즈 칩 상시 노출('사이즈 바꾸기' 패널 삭제·프리셋 자동 시드), 보드 뷰 이미지 저장(4:5), ?view= URL 동기화(?device= 호환)
- 일기 프롬프트 자연화(아크·체크리스트 제거, 구체성 규칙, 450-650자·temp 0.9 — 볼드 1곳 불변), scene 작성 가이드 카드 + sceneStep.example 6종 연결형 예문
- scenes: "직접 사진 올리기" 리네임, URL 입력 ① 토글 이동, ScrollRow(페이드+셰브런)로 갤러리 '성취·여유' 잘림 해결
- @vercel/analytics 설치 + track 5종, 기획서 3건(docs/ 산책길·회원가입·프로세스 단순화 — 구현 보류)
- verify-v73r1 신설(39케이스) + 구 스위트 9종 갱신 → 12스위트 256/256 PASS, `npx vercel --prod` 배포 + 11경로 200 + 번들 문자열 스모크

### 2026-07-08 (v7.2 정원 맵 + collage 한 화면 통합 + 카피 정비, 푸시·프로덕션 배포)
- 중단된 세션 재개: 커밋된 10태스크 플랜(docs/superpowers/plans/2026-07-08-v72-*) 기준 Task 4~10 실행 — Task 4는 중단 시점의 미커밋 diff가 플랜 명세와 1:1 일치함을 확인 후 그대로 커밋
- 카피: 온보딩 스텝1 간결화(T1, 이전 세션), 섹션1 '원하는 내 모습'(T2), scene "사진 담으러 가기"·"다시 써줘", section "미래의 하루 그려보기"(T4)
- 정원 맵(T5·T6·T7): 미니보드 씨앗🌱/새싹🌿·뱃지 3종(✓/✍️/📷)·토리 마커, 정원 캡션·추천 카드 문장형·'내 비전보드 보기' 단일 버튼(📱/🖥️ 퀵 버튼·'그냥 보드로 볼래?' 삭제), 인트로 시트 진행 방식 안내
- collage 통합(T8): choose 뷰 제거 → view 3값+sizePanelOpen 상태머신, [보드|폰|PC] 토글, 인라인 사이즈 피커+'사이즈 바꾸기' 칩, /finish 폰 버튼 ?device=phone 딥링크, 코치마크 전 뷰 노출
- 검증(T9): verify-v72r1 신설(26케이스) + 구 스위트 갱신 — 플랜에 없던 깨짐 3건 발견·수정(구 인트로 카피 단언 5곳, v71r4 추천 문장형, v7r5의 미존재 프리셋 id 'iphone-pro' 시드) → 10스위트 207/207 PASS
- 배포(T10): master 푸시 + `npx vercel --prod` → 9경로 200 + /moment 404, 프로덕션 Playwright로 새 카피·토글·정원 캡션 5체크 OK

### 2026-07-07 (v7.1 피드백 리플래닝 4라운드 + 사전 정리, 푸시·프로덕션 배포)
- 사전 정리: /moment·/board 스텁 철거+slots/SlotId 타입 제거(v4 백필은 로컬 캐스트 유지), 큐레이션 80→65장 육안 선별(어두운 실루엣·동일 촬영 중복·텍스트 노출 컷, 다양화 쿼리 8장 보충, 데드링크 65/65 통과)
- R1 온보딩: 스텝1 "그다음엔 우리 같이 비전보드를 만들 거야" 여정 예고+"너 그거 아니?" 말 걸기 톤, 스텝3 자동 교차 카드→흑백/컬러 위아래 동시 대비(CompareStack)
- R2 버그: 추천 사진 재탭=담기 해제 — uploadedImageSources 출처 병렬 기록, 갤러리 2종 토글화, 슬롯 ×와 양방향 동기화
- R3 대시보드=미니보드 허브: 섹션 카드 6장 제거→셀 탭 내비(✓배지·next 링), 추천 카드 1장, 📱/🖥️ 배경화면 퀵 버튼(/collage?device= 딥링크)
- R4 사진 먼저: 질문 강제 해제(양경로 시트·질문 페이지 링크), 넛지 배너/저장 직후 시트(1회 dismiss 영속), AI 힌트 게이트, 추천 우선순위(열린 고리 최우선), 48h 복귀 인사
- Ultraplan 클라우드 세션으로 플랜 정제 후 로컬 구현. verify-v71r1~r4 신설(73케이스)+구 스위트 4개 신 UX 갱신 → 총 197/197 PASS, `npx vercel --prod` 배포

### 2026-06-12 (v6.17 피드백 4개 영역 개선, 푸시·프로덕션 배포)
- 조사 버그 수정: `lib/josa.ts` 통합 유틸 신규 — 온보딩 `${name}라는` 하드코딩("헬렌라는")을 이라는/라는 분기로, getNameSuffix 대체·getEunga 데드코드 삭제 (단위 16건+렌더 검증)
- 색상: 대시보드 상태 뱃지 뉴트럴화+완성만 잉크 솔리드(보라 카드×초록 뱃지 충돌 해소), 온보딩 Act4 카드 0색·Act5 도트 문법(무지개화 제거, /board와 문법 통일)
- /board 간격: grid-rows-3 stretch가 잉여 높이를 행 안에 분산시키던 원인 제거 — auto-rows-min content-center
- /collage 개편: 1회 코치마크+편집 칩+탭 스와치, 폰/PC 미리보기 토글(WallpaperPreview+useWallpaperPreview), 기기 프리셋 11종(renderForPreset cover-crop), Unsplash 추천(ImageSuggestions, 모킹 E2E 검증·키 없으면 조용한 숨김)
- Playwright 22건+조사 16건 ALL PASS → 커밋 6639fbf, `npx vercel --prod` 배포, 4경로 200

### 2026-06-12 (v6.16 Act 4 간격 확대 + 최초 비비드 팔레트 복원, 푸시·프로덕션 배포)
- 온보딩 Act 4 간격 확대: 이미지 카드↔핵심 메시지 8→20px, 힘 메시지↔좋은 이유 12→24px — flex-1 이미지가 흡수해 무스크롤 유지, 375×667은 높이 미디어쿼리 분기(간격 한 단계+패딩 회수)
- 팔레트를 최초 Stage 1 커밋(59fee78) 비비드 톤으로 복원(파스텔 폐기, 사용자 요청) — colors.ts 단일 소스 1파일 수정
- `scripts/verify-v616.js` 신규(3뷰포트 무스크롤+간격 실측) ALL OK → 커밋 0574263 푸시 + `npx vercel --prod` 배포, 3경로 200

### 2026-06-12 (v6.15 파스텔 복원 + 전체 UI/UX 개편, 푸시·프로덕션 배포)
- 팔레트 v6.13 파스텔 복원(사용자 원복 요청) + 폰트 체계 교체: 고운바탕 제거, UI Pretendard 단일, 아트 영역만 tvN Enjoystories 셀프호스팅
- 콜라주 개편: '내 배치' 탭 제거 → 3템플릿 통합 드래그 편집(CollageBoard), 문구 스티커 신규(3스타일), 저장 폰/PC 2분할, 배치 1:1 캔버스 export, legacy 마이그레이션
- 온보딩 Act4 간격(flex-1 잉여 공간 구멍 수정)·보드 슬롯 정사각·리뷰 작성하기/수정하기 분기·단계 리네이밍, Playwright 3뷰포트 검증(scripts/verify-v615.mjs)

### 2026-06-11 (v6.14 피드백 5건 반영 + 푸시·프로덕션 배포)
- 팔레트 선명 톤: 뮤트가 칙칙하다는 피드백 → 명도 대신 채도를 올려 밝게, 크림·흰색 4.5:1 유지 (colors.ts만 수정)
- 폰트 불일치 원인 규명: `text-display` 크기 토큰에 `font-display` 서체 클래스 누락 8곳 수정 + 페어링 규칙 명문화 + `check-typography.js` 가드 신설
- 온보딩: Act 4 결구 "그게 비전보드의 힘이야" 명조체 격상, "삶의 방향" 서브텍스트 사용자 카피로 교체(2줄 이내 검증)
- /board 2열×3행 무스크롤(h-dvh, 슬롯 높이 채움), StoryModal 아이콘 트리거 variant
- /collage 템플릿 4종 + 포인터 이벤트 기반 드래그·리사이즈 배치 편집(`components/collage/`, collageLayout 0..1 정규화 스키마)
- 배경화면 PC 타깃(1920×1080) 추가 — wallpaper.ts rect 기반 파라미터화(모바일 출력 픽셀 동일), 파일명 `-pc`
- `verify-v614.js` ALL OK → master 푸시(0d2105c) + `npx vercel --prod` 배포, 프로덕션 4경로 200

### 2026-06-11 (v6.13 디자인 시스템 정립 + 피드백 6건 — 미배포)
- 이름 입력칸 이중선 버그 수정: 전역 `:focus-visible`(unlayered)이 Tailwind v4 `outline-none` 유틸리티를 이기는 캐스케이드 문제 — input/textarea 예외 추가
- 타입 스케일 7토큰(@theme) 정의 후 임의 px·기본 유틸리티 357곳 전면 치환, 도토리 말풍선 Pretendard 통일, `docs/design-system.md` 신설
- Act 4: 리드인 삭제·"원하는 것이 뚜렷해지는 순간" 카피 수정, 비교 이미지 flex 흡수 구조(min-h 4.5rem~max-h 64)로 3뷰포트 무스크롤
- 팔레트 v6.11 뮤트 톤 복귀(4색만 2~9% 최소 다크닝으로 크림 4.5:1 충족), /board 데스크톱 3열 무스크롤
- 배경화면 디자인 2종: wallpaper.ts `style` 파라미터(polaroid/minimal), 미니멀=크림 배경 정렬 그리드+섹션 컬러 도트, WallpaperSheet 스타일 세그먼트
- `scripts/verify-v613.js` ALL OK (커밋 96b5094)

### 2026-06-11 (v6.12 사용자 피드백 6건 반영 — 미배포)
- 온보딩 뷰포트 고정: `h-dvh overflow-hidden`으로 전 Act 페이지 스크롤바 제거, Act 2 채팅 [헤더 고정+내부 스크롤+하단 CTA] 재구조화, `.scroll-soft` 신규
- Act 3 예시 이미지 flex 기반 축소(CTA 상시 가시), Act 4 자동 슬라이드 전용(스와이프·화살표 제거)+검은 박스→Gowun Batang 인용구+압축(812px에 CTA까지 수용)
- 컬러 팔레트 리뉴얼: 선명한 6색 + `lib/colors.ts` 단일 소스(4곳 하드코딩 통합), 틴트 배경 카드→흰 카드+컬러 좌측 보더
- 용어 교체: "장면 그리기"→"미래의 하루 그리기" (라벨성 문구 ~15곳, 자연 문장 속 "장면"은 유지)
- `/collage` 배경화면 저장 신규: `lib/wallpaper.ts`(Canvas 렌더)+`WallpaperSheet`(탭 2모드)+`api/image/proxy`, Web Share/다운로드 폴백
- 검증: `scripts/verify-v612.js` — 3개 뷰포트 × Act 0~5 페이지 스크롤바 없음+CTA 확인, 다운로드 이벤트 확인. flex shrink 클리핑 버그(`flex-shrink-0` 필요) 발견·수정

### 2026-06-11 (v6.11 UI/UX 품질+아이덴티티 개편 — 미배포)
- frontend-design × ui-ux-pro-max 조합 리뷰 → Phase A(품질)/B(아이덴티티) 2커밋(27142fc, 003e843)
- 품질: 대비 미달 `#9CA3AF` 전수 치환, focus-visible+포커스 트랩, 모바일 본문 15px, Act 0 진짜 알파 webm(colorkey 생성), UI 이모지→lucide SVG
- 아이덴티티: Gowun Batang 디스플레이 서체, 정원 톤 섹션 6색(4.5:1 검증), 랜딩 히어로 폴라로이드 보드 재설계, 대시보드 폴라로이드 썸네일
- 배포는 사용자 로컬 확인 후 진행하기로 — dev 서버 확인 상태로 세션 종료

### 2026-06-10 (v6.10 Act 0 영상 교체 + 배포)
- `최종3.mp4` → `public/tori-v3.mp4`로 복사, Act 0 영상 소스 교체
- `mix-blend-mode: multiply` + `contrast(1.15) saturate(1.1)` 필터로 배경 CSS 제거
- `vercel --prod` 프로덕션 배포 (3cfd4ad)

### 2026-06-10 (v6.9 온보딩·대시보드·질문 플로우 7건 + 배포)
- 온보딩: Act 0 영상 흰 배경 제거(`mix-blend-mode: multiply` — fadeIn stacking context 때문에 래퍼 배경색 필수), 도토리 문구 흙→땅 2곳, Act 4 다리 문장 다크 콜아웃 카드 강조(삭제 대신 UI 개선)
- 대시보드: 🐿️ → 토리 프로필 이미지, ProcessGuide(전체 과정 보기) 4→5단계 동기화(스토리 추가)
- 질문 플로우: 질문 단계 답변 버블에 인라인 수정(기존 review 패턴 재사용), ProcessBar `usePathname` 경로 인식(`/scenes`를 `/scene`보다 먼저 매칭, maxStep으로 클릭 범위 유지)
- Playwright 검증 로컬·프로덕션 각 15/15 + 회귀 프로브 4건 통과, `npx vercel --prod` 배포 (cced1ac)

### 2026-06-10 (v6.8 온보딩 마감·보드 단계 유도·한눈에 보기 분리 + 배포)
- 온보딩: Act 0 영상 `최종3.mp4`→`tori-final3.mp4`(720p CRF28, 166KB), Act 3 세로 이미지 48vh 제한, Act 4 카루셀 자동 순환·레이아웃 점프 제거(조건부 힌트가 원인)·텍스트 가독성 강화
- 보드: CTA 문구 재설계(/copywriting — 원하는 모습 답하러 가기·원하는 하루, 스토리로 보기), 사진만 올린 섹션 pill 강조(제안 톤), "6개 완성 시 열림" 가이드 삭제
- 한눈에 보기 `/collage` 별도 페이지 분리(데스크톱·모바일 공통), 보드 하단 활성화 버튼(0장이면 안내 문구), 사진 3장 통일, ProcessBar 5단계(스토리 단계 추가)
- 빌드 통과 후 `npx vercel --prod` 배포(2e3d634), 스모크 체크 5개 경로 200

### 2026-06-10 (v6.7 영상 교체·온보딩 모바일·Act4 스와이프·보드 재설계 + 배포)
- Act 0 영상 `최종2.mp4` → ffmpeg 720p CRF28 압축 172KB (`tori-final2.mp4`), Act 1 모바일 재구성(프로필 헤더+전폭 입력), Act 2/3/5 들여쓰기 통일
- Act 4 스와이프 카드: 막연한 바람(앉은 모습·grayscale) ↔ 생생한 장면(러닝) 2슬라이드, 사진 위 그라데이션 오버레이, 설명 한 줄 압축 — Unsplash 후보 17장 육안 선별
- 보드 재설계: CTA 상시 표시 + `lib/sectionRoute.ts` 공용화(not_started→채팅 라우팅 버그 수정), `StoryModal` 팝업(토글 폐기), 미래하루 스토리 보드 노출/수정, 웹 2-pane(sticky 콜라주)
- 스토리 직접 수정(보드·moment), finish "다시 써줘" 덮어쓰기 확인 프롬프트
- Playwright 28체크 통과 후 `vercel --prod` 배포 (4252f2e)

### 2026-06-10 (v6.6 온보딩·채팅·보드 개선 6건 + 프로덕션 배포)
- Act 0 캐릭터 영상 교체: `최종.mp4`(6.2MB) → ffmpeg 720p CRF28 압축 211KB (`tori-final.mp4`)
- Act 3/4 재구성: Unsplash 목업 제거 → 실제 비전보드 예시 이미지(모바일 세로/웹 가로), Act 4에 러닝 사진 + "비전보드를 하면 좋은 이유" 헤더 + 혜택 카드 3개 이동
- 채팅 아바타 🐿️ 이모지 → `프로필상반신.png`, 입력창 회색 배경 → 흰 배경+테두리
- /board "한눈에 보기" 폴라로이드 콜라주 신규 (`VisionBoardCollage.tsx`) — 다크 배경, 미세 회전, 중앙 연도 탭 수정(`boardYear`)
- 모바일 최적화: section `h-screen`→`h-dvh`, ChatInput·finish safe-area, scenes calc 폭→grid, 말풍선 반응형 폭
- Playwright QA 스크립트(`scripts/verify-v66.mjs`)로 11장 스크린샷 검증 후 master 머지(c38a64f) + `vercel --prod` 배포, 스모크 체크 5개 URL 전부 200

### 2026-06-10 (v6.5 온보딩 개선 7건 — QA 피드백 반영)
- Act 0 캐릭터 영상 교체: 배경제거 처리본이 왼쪽 눈을 흰색으로 망가뜨림 → 검은 배경 원본(`인사_0610-2.mp4`)에 `colorkey=black:0.1:0.1` 적용이 더 깨끗 (434KB, 흰배경 fallback MP4 별도 생성)
- 도토리 스토리: 2.5초 자동 진행 타이머 제거 → 탭 전용 (모바일에서 메시지 우르르 나오던 원인이 타이머였음)
- 상단 단계 표시: 라벨형 ChapterProgress → 라벨 없는 점 5개 (몰입 방해 최소화, 컴포넌트 삭제)
- Act 3: 완성 비전보드 미리보기 목업 추가 (6영역 + Unsplash 사진, 이름 개인화, -1.5° 기울임 카드)
- Act 3 CTA "그게 어떻게 가능한 건데?" → "와, 기대되는데?", Act 4 킥커 "이게 왜 효과 있는지 보여줄게."
- /board 빈 슬롯 탭 → 질문 없이 바로 사진 업로드 (× 삭제 포함), 대시보드 "나의 비전보드 보러가기 →" 상시 노출
- 워딩 통일: scenes·moment·section 페이지 존댓말 14곳 → 토리 반말 (랜딩은 존댓말 유지)
- Playwright 모바일 뷰포트(터치) 검증 18체크 전부 통과
- 프로덕션 배포 완료: https://vision-board-web.vercel.app (런타임 에러 0건, 새 WebM 서빙 확인)

### 2026-06-10 (v6.5 온보딩 비전 카피 개선 + 배포)
- 비전 카드 첫 제목 "뇌가 원하는 삶을 현실로 믿게 해줘" → "원하는 삶을 현실로 믿게 해줘"
- Act 3 CTA "어떻게 만드는 건데?" → "그게 어떻게 가능한 건데? →" (다음 단계 원리 설명과 연결)
- WebM video에 `transform: translateZ(0)` + `backfaceVisibility: hidden` 추가 — 눈 하얘짐 렌더링 플리커 완화
- 프로덕션 배포: https://vision-board-web.vercel.app

### 2026-06-09 (온보딩 영상 투명 WebM 교체)
- 온보딩 Act 0 영상을 `인사- 배경없음.mp4` → ffmpeg colorkey(white, similarity=0.15, blend=0.25) 변환 → `인사-투명.webm`으로 교체
- `<video>` 태그: WebM 우선 + MP4 fallback, 280×280 contain, 불필요한 `videoRef`/`useRef` 제거
- 배포 3회 (MP4 직접 → GIF → 투명WebM → 파라미터 조정 재배포)

### 2026-06-09 (v6.4 온보딩 5-Act 리스트럭처링 + 섹션 채팅 단순화)
- **온보딩 재편:** Acts 0-4 구조 — 토리 소개(신규 카피) → 이름 → 도토리 잠재력 스토리(별도 페이지) → 비전보드 시각 설명(정의박스+효과카드3개+인용구) → 6영역 그리드
- **코드 정리:** 버킷리스트·gardenState 완전 제거 (onboarding, storage, types, dashboard, finish)
- **섹션 채팅 단순화:** 도입 3→2 메시지, cushionText+questionText 하나의 말풍선으로 통합, ChatBubble whitespace-pre-line 추가
- **프로덕션 배포:** https://vision-board-web.vercel.app (commit b4f3302)

### 2026-06-09 (온보딩 리스트럭처링 기획 완료 — 구현 전 wrap)
- **온보딩 page.tsx 분석 완료:** 675줄 6-Act 구조 전면 파악, Act 4 정원 진단 코드 영역(l.440-560) 식별
- **리스트럭처링 플랜:** Acts 6→4(0→1→2→3) 축소 플랜 수립 — Act 4(garden 진단) 제거, 버킷리스트(bucketPhase) 제거, Act 2 신규 비전보드 스토리텔링(7개 말풍선) 추가
- **카피 방향:** Act 0 인사 간소화("다음 →"), Act 2 신규 카피(비전보드 정의→시각화 동기부여→삶의 주도권→구체화 예시), 도토리 이야기 은유 재구성
- **미해결 항목:** Image 2(채팅 양방향 말풍선 단순화), Image 4(어색한 한국어 표현 전면 점검)
- **HANDOFF 생성** — 새 세션에서 `/wrap` 후 `HANDOFF_2026-06-09-온보딩-리스트럭처링.md`로 이어서 구현

### 2026-06-09 (v6.3-story code implemented — deploy)
- **온보딩 page.tsx 전면 구현:** Acts 0-5 구조, Tori 첫인사(정원사), 도토리 이야기 6단 말풍선(2.5cm→60m 2,400배, 2.2초 자동 전환), 버킷리스트 유/무 분기, 정원/화단 은유 일관화
- **프롬프트 수정:** `lib/onboarding-prompt.ts` — 도토리/참나무 직접 언급 금지 제거, Tori가 당당히 도토리 세계관을 말하도록 변경
- **회복:** `git checkout HEAD`로 날아간 Acts 0-5 WIP를 대화 기록에서 복원 후 v6.3-story 카피 적용
- **배포:** Vercel preview 배포 완료 (fc680a0, feat/tori-rebrand)
- **Vercel preview:** https://vision-board-qc1il785y-heleneasytask-7494s-projects.vercel.app

### 2026-06-09 (v6.3-story implement)
- 온보딩 스토리텔링 전면 분석: 도토리→참나무 2,400배 성장 은유를 철학 백본으로 채택
- Act별 스토리보드 설계: 인사(영상) → 첫 만남(이름) → 버킷리스트(유/무 분기) → 감정 연결 → 정원 진단 → 6영역 안내
- 버킷리스트 유/무 분기 처리: 없으면 "괜찮아, 지금부터 나와 함께 찾아가자" 위로 플로우
- AI 모델 추천: Claude 3.5 Sonnet (한국어/캐릭터 일관성/공감 최적)
- **코드 구현:** Act 1~5 카피 전면 개선 — 씨앗/정원 은유 자연스럽게 위빙, 감정 곡선(호기심→기대→설렘→뿌듯함→의지) 반영
- **신규 파일:** `lib/onboarding-prompt.ts` — 온보딩 전용 Tori 시스템 프롬프트 (도토리 은유 백본, 한국어 전용, 카카오톡 톤, Act별 감정 곡선 명시)
- **완료 확인:** LSP diagnostics 0 에러, Production build 성공
- **HANDOFF 업데이트:** 2개 HANDOFF 모두 v6.3 구현 완료 상태로 갱신

### 2026-06-09 (v6.2-v6.3 온보딩 UX 개선 + 랜딩 캐러셀)
- 온보딩 Step 2: select phase 제거 — textarea 입력 후 바로 imagine → feeling → connect 직행 (BucketPhase.SELECT → 제거)
- "버킷리스트 없어요" fallback: 빈 textarea → 토리 위로 메시지 → noBucketPhase → Step 3 이동
- `globals.css`: `@keyframes float` (4s, 8px) + `@keyframes breath` (3s, scale 1.05) 추가
- Step 1 토리 이미지: `animate-float` 클래스 적용 (부드러운 상하 애니메이션)
- 랜딩 페이지: 예시 비전보드 오토 롤링 캐러셀 (Unsplash 3장, 4초 자동 전환, 닷 네비게이션, hover 일시정지)
- 캐러셀 verification.png: Playwright로 실제 렌더링 확인 완료
- 배운 점: `.next` 캐시 purge가 필요한 상황 인지; Start-Process → npm은 `cmd.exe` 경유 필요 (Windows)

### 2026-06-08 (v6.1 온보딩 카피 + 토리 이미지)
- 온보딩 Step 1: 이모지 박스 → 실제 토리 일러스트(`public/tori-gardener.png`) 교체
- Step 1 카피: 도토리→참나무 잠재력 비유 추가 + 다정한 어조 ("안녕? 나는 토리야. … 네가 어떤 참나무로 자라날지 나 정말 궁금해.") — /copywriting + /marketing-psychology 원칙 적용
- Step 2 input/connect: Step 1 비유와 자연스럽게 연결, connect phase "그 장면들이 모이면 네 참나무 모양이 보여" 마무리
- Vercel 프로덕션 배포 완료 (commit 77da487)

### 2026-06-04 (v3.8 이미지 섹션 전면 개선)
- **버그 수정 2개:** AI 이미지 3장 동일 문제 → describe/generate API에 와이드샷/미디엄샷/클로즈업 구도 강제 + 컴퓨터 장면 최대 1개 제한; images 단계 묘사 카드 중복 표시(opacity-60) 완전 제거
- **통합 5슬롯 갤러리:** AI/업로드 구분 없는 3+2 그리드, 어느 슬롯이나 사진 업로드 가능, AI 슬롯 개별 삭제 후 교체 가능, uploadedImages 5개로 확장 + resetAiImages 함수 추가
- **UX 개선:** 묘사 카드에 ✏ 아이콘 + hover/focus border + placeholder 추가; images 단계 스크롤 ~2000px → ~720px (스토리/묘사 블록 숨기고 접기/펼치기 요약 칩으로 대체)

### 2026-06-03 (v3.5 섹션 UX 개선 + 이미지 복구)
- **섹션 레이아웃 전면 개편:** `h-screen` 고정 뷰포트, 채팅 `flex-1 overflow-y-auto` 독립 스크롤, 입력창 sticky 하단 고정, JS `onMouseEnter/Leave`로 스크롤바 hover 토글 (CSS-only 방식은 Chrome에서 불안정)
- **섹션 UX 추가:** 헤더 `←` 뒤로가기 + `✓ 저장됨` 2초 인디케이터, 질문 단계 사용자 버블에 인라인 수정(textarea) 기능
- **이미지 생성 복구:** dall-e-3 → `gpt-image-1` 원복 (1024×1024 URL 방식); Vercel 프로덕션 배포 완료 (commit db541f0)

### 2026-06-03 (v3.4 이미지 저장·인라인 수정·반응형)
- **이미지 저장:** `dall-e-2 + b64_json` 전환 → JPEG 압축(`imageUtils.ts`) → localStorage 영구 저장; board 페이지 레거시 `images` → `generatedImages` 버그 수정; "저장 중..." 로딩 상태 추가
- **인라인 답변 수정:** 섹션 review 화면 개별 답변마다 "수정" 버튼 → textarea 전환 → 저장; 하위 데이터(장면/이미지) 있으면 "다시 만들기" 경고 표시 (marketing psychology: IKEA Effect + Commitment)
- **반응형 레이아웃:** `maximumScale` 제거, 전 페이지 `max-w-md md:max-w-xl`, 대시보드 2열 그리드, 비전보드 2열 섹션 그룹; Vercel 프로덕션 배포 완료

### 2026-06-02 (v3.3 AI 스택 전환 + 스토리 서술체)
- 스토리 API: Groq(llama) → OpenAI gpt-4o-mini, 프롬프트 톤 "반말" → 서술체("나는 ~한다, ~느낀다")
- 이미지 API: Groq 의존성 완전 제거, 프롬프트 변환 gpt-4o-mini, 이미지 생성 dall-e-3 → gpt-image-1
- 이미지 생성 디버깅: 400 "dall-e-3 does not exist" 원인 파악, gpt-image-1 전환 후에도 실패 — 미해결

### 2026-06-02 (v3.2 UX 흐름 개선, 수정 기능, 스토리 품질)
- **Plan 모드:** 6가지 이슈 분석 — marketing-psychology (Peak-End Rule·Hick's Law·Commitment·IKEA Effect) 프레임 적용
- **버그 수정:** 대시보드 status 기반 스마트 라우팅, moment step resume 버그(`situationText`→story step), 이미지 에러 핸들링(missing_key/failed 구분 + "글만 저장" fallback)
- **UX 개선:** Scene 2-버튼 분기 → 단일 CTA, Section review "다른 섹션 먼저 하기" 텍스트 링크 격하, 수정 메뉴 (4단계 cascade: 이미지/스토리/장면/답변)
- **AI 품질:** llama-3.1-8b → llama-3.3-70b-versatile, 사용자 표현 보존 프롬프트(200-300자, 격상 금지), storage.ts reset 함수 4개 추가; Production 배포 완료

### 2026-06-02 (v3.1 스토리 품질·흐름·이미지 강화)
- `api/story/section`: 프롬프트 전면 개선 — "복사 금지" 지침 삭제→확장 허용, 350-450자, 아침→저녁 구조, **볼드** 지침, temperature 0.85
- `moment/[id]`: `renderStory()` 마크다운 볼드 렌더링, `usedAdditional` 추가입력 1회 제한, placeholder 가이드 텍스트 개선
- `scene/[id]`: 버튼 카피 "구체적인 순간 담고 하루 그리기 →" + 서브텍스트 (흐름 명확화); `image/generate`: `Promise.allSettled` 부분 성공, JSON 파싱 fallback
- v2.4c 구식 플랜 파일 삭제, `OPENAI_API_KEY` Vercel 등록 + v3.0 첫 프로덕션 배포

### 2026-06-02 (v3.0 /moment/[id] — 상황 묘사·미니 스토리·DALL-E 이미지)
- `/moment/[id]` 신규 페이지: 3단계(상황 묘사 → Groq 미니스토리 → DALL-E 3 이미지 3장), 재생성·라이트박스 포함
- `/api/story/section`, `/api/image/generate` 신규 API; `openai` npm 패키지 설치
- `lib/types.ts·storage.ts·questions.ts` 확장 (situationText/miniStory/generatedImages 필드, 6섹션 situationChips); scene 라우팅 `/moment/[id]`로 변경

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
