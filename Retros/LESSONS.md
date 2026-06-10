# 교훈 기록 (Lessons Learned)

코딩 및 전략 교훈. /wrap 세션에서 기록됩니다.
#coding 태그 항목은 SessionStart 시 자동 주입됩니다.
반복 패턴은 /wrap HITL 승급을 통해 적절한 vehicle로 적용됩니다.

## Marketing / 전환 설계

### 랜딩 차별점은 기능 나열이 아니라 잘못된 전제를 뒤집는 것이다 #strategy #ux
"비전보드를 만들려면 이미 원하는 게 있어야 한다"는 사용자의 기존 전제를 Hero에서 먼저 표면화하고 Contrast 섹션으로 뒤집을 때 가장 강한 포지셔닝이 나온다. 경쟁 서비스와의 차이를 기능 목록으로 설명하는 것보다, 사용자가 암묵적으로 가진 잘못된 전제를 교정하는 방식이 더 효과적인 차별화 수단이다.

### 시간 기반 카피("15분이면")는 비용으로 읽힌다 #strategy #ux
"15분이면 첫 영역을 채울 수 있어요"는 완성 속도를 강조하려 했지만 사용자는 "15분이나 걸린다"로 해석한다. Activation Energy 원칙에서 시간 표현보다 첫 행동의 크기를 표현하는 것("첫 질문 하나부터")이 더 효과적이다. 시간 카피는 빠르다는 인상을 줄 때만 쓰고, 그렇지 않으면 행동 단위로 표현하라.

### "어디서든 시작해도 돼"는 시작을 막는다 #strategy #ux
대시보드에서 "어디서부터 해도 괜찮아"라고 쓰면 선택 마비가 생긴다. Paradox of Choice — 선택지가 많으면 아무것도 안 한다. 첫 번째 행동을 명확히 하나로 지정해야 전환율이 올라간다. 온보딩 완료 후 대시보드 대신 첫 섹션으로 직행시키는 것이 정답.

### 버튼 텍스트는 다음에 일어나는 일을 정확히 반영해야 한다 #strategy #ux
"이미지 찾으러 가기 →"처럼 버튼이 약속하는 것과 실제 동작이 다르면 Peak-End Rule에서 최악의 타이밍에 실망을 준다. 특히 감정적으로 고양된 완료 순간(Peak)에 버튼 텍스트 불일치는 신뢰를 깎는다. 기능 미완성 시 버튼 텍스트를 실제 경로로 맞추는 게 먼저다.

## UX / 플로우 설계

### 캐릭터 메타포는 첫 화면에서 완전히 설명해야 다음 단계에서 자연스럽게 쓸 수 있다 #strategy #ux
도토리/참나무 비유를 Step 2에서 갑자기 "심고 싶은 도토리"라고 쓰면 유저 입장에서 연결이 끊긴다. Step 1에서 비유의 의미(도토리=잠재력, 땅에 심는다=시작한다)를 먼저 가르쳐야 Step 2의 행동 요청("도토리를 심어봐")이 이어진다. 메타포 기반 UX는 첫 화면이 "교육", 이후 화면이 "활용" 구조여야 한다.

### 중간 분기 선택지는 이탈 버튼이다 #strategy #ux
사용자가 장면을 다 쓴 시점(commitment peak)에 "계속하기" vs "다른 섹션 먼저"를 나란히 두면, 이미 투자한 사람도 이탈한다. Hick's Law + Commitment & Consistency — 분기는 모멘텀을 끊는다. 탈출구는 헤더 소형 링크 하나로 충분하다. 중간 선택지는 제거하거나 극단적으로 격하하라.

## Tooling / 미디어 처리

### MP4는 브라우저에서 투명 배경 불가 — ffmpeg colorkey로 WebM 변환이 표준 해결책 #coding #video
ffmpeg `colorkey=white:similarity:blend` + `-pix_fmt yuva420p` + WebM VP9 조합이 웹 투명 영상의 실용적 경로. similarity 낮춤(0.15)으로 캐릭터 하이라이트 보존, blend 높임(0.25)으로 경계 부드럽게. `<source src=".webm">` 우선, MP4 fallback 구조로 크로스브라우저 대응.

### 배경제거 도구 처리본보다 단색 배경 원본에 colorkey가 더 깨끗하다 #coding #video
외부 배경제거 도구가 캐릭터 디테일(왼쪽 눈)을 흰 원으로 망가뜨린 사례. 흰 배경 처리본에 colorkey=white를 쓰면 밝은 캐릭터의 하이라이트까지 반투명하게 뚫린다. 검은 배경 원본이 있다면 `colorkey=black:0.1:0.1`이 어두운 눈동자를 보존하면서 가장 깨끗했다. 변환 후에는 마젠타 배경에 overlay 합성한 프레임을 추출해 구멍 여부를 반드시 눈으로 검증할 것.

### ffmpeg alphamerge 필터는 Windows PowerShell에서 filter_complex 세미콜론 파싱 실패 #coding #ffmpeg
split+alphaextract+gblur+alphamerge 체인은 `-filter_complex_script` 파일 방식에서도 실패. 단순 `-vf colorkey` 파라미터 조정이 Windows 환경에서 더 안정적. alphamerge가 필요하면 Linux/Mac 환경을 사용할 것.

### AI 스토리가 인공적으로 느껴지면 사용자 표현을 격상했기 때문이다 #coding #ai-prompt
"가벼운"을 "활기찬"으로 바꾸거나 아침→점심→저녁 구조를 강제하면 AI가 쓴 티가 난다. IKEA Effect — 자신의 말이 그대로 들어가야 "내 이야기"로 느껴진다. 프롬프트에 "위에 적힌 표현을 그대로 살려. 의역·격상 금지"를 명시하고, 구조보다 선명한 장면 1~2개에 집중하도록 유도하면 자연스러워진다.

### 질문 순서가 심리적 흐름을 결정한다 #strategy #ux
비전보드 장면 묘사(④) 슬롯은 반드시 다른 답(①②③⑤) 모두 작성 후에 제시해야 한다. PDF 실제 사용자 흐름 분석으로 확인. 순서가 바뀌면 "뭘 써야 할지 모르겠다"는 막힘이 생긴다.

### "막기"보다 "유도"로 빈칸을 줄인다 #strategy #ux
빈 슬롯을 막으면(validation) UX 마찰이 생기고 다른 완료 조건(D6)과 충돌한다. 대신 "나중에 답할게요" + "도움이 필요해요 → 서브질문"으로 빈칸이 생기지 않도록 유도하면 두 문제를 동시에 해결할 수 있다.

### 예시 문장은 다양한 사용자 상황을 골고루 커버해야 한다 #strategy #ux
"이런 식으로 써봐" 예시가 부정적 답변만 나열되면, 긍정적 상태의 사용자는 자신이 잘못 쓰는 것처럼 느낀다. 예시는 부정·중립·긍정이 섞여야 사용자가 자신의 상황에서 자연스럽게 답할 수 있다. current 질문처럼 현재 상태를 묻는 항목은 특히 긍정적 상황 예시를 먼저 배치하라.

### 쿠션 메시지와 질문 버블은 역할을 분리해야 한다 #coding #ux
cushionText와 질문 버블이 같은 키워드를 반복하면 어색한 중복이 된다. 쿠션은 "무엇을 왜 하는지" 맥락과 이유를 주는 역할, 질문 버블은 실제 입력 요청에만 집중하는 역할로 분리해야 한다. 장면 그리기처럼 사용자가 처음 접하는 단계일수록 쿠션에서 충분한 설명이 필요하다.

### 실제 사용자 답변 패턴으로 질문 형식을 검증해야 한다 #strategy #ux
"한 단어로 써봐"라고 설계했지만 실제 사용자(박지현)는 "단단하고 트임"처럼 짧은 표현을 썼다. 질문 의도(느낌 단어)는 맞지만 형식 강제("한 단어")가 실제 답변과 맞지 않았다. 실제 작성 샘플로 검증 후 "짧은 표현도 가능"으로 완화해야 자연스럽다.

### 컨텍스트가 쌓인 후 해야 깊어지는 작업은 허브로 분리한다 #strategy #ux
장면 묘사(PHASE 3)를 섹션별로 즉시 처리하면 다른 섹션 맥락 없이 써야 해 얕아진다. "전체 섹션 텍스트 완료 → 장면 그리기 허브에서 원하는 순서로"로 분리하면 풍부한 맥락에서 쓸 수 있고 UX 흐름도 자연스러워진다.

### 도토리 은유는 철학 백본이지, 대화 인터페이스가 아니다 #coding #storytelling-ux
강력한 은유(도토리→참나무 2,400배 성장)일수록 직접 입에 담으면 설교가 된다.
철학은 시스템 프롬프트에 심고, 사용자 대화는 자연스러운 질문("버킷리스트 있니?")으로 풀어내야 한다.

### 버튼 카피는 기능명이 아닌 사용자 혼잣말이어야 한다 #strategy #ux
"다음/완료" 같은 기계적 단어 대신 "다음 질문은 뭐야?", "내 보드 드디어 보고 싶어"처럼 그 순간 사용자 입에서 나올 말로 쓰면 클릭이 내 의지처럼 느껴진다. 온보딩 설계 원칙(비전보드_온보딩_v0.1.md 2-2절)에서 확인.

### 완료 상태를 "잠금"으로 쓰면 수정 불가 함정이 생긴다 #coding #ux
`status === 'completed'` 일 때 complete 화면으로 점프하면 사용자가 답변을 수정할 수 없다. "완료됨 = 다시 못 함"이 아니라 "완료됨 = review 화면에서 시작"으로 설계해야 한다. 상태는 진행 추적용이지 접근 제어용이 아니다.

### 상태 라벨보다 진행 단계 시각화가 더 명확하다 #coding #ux
"글 완료"/"완성" 같은 텍스트 배지보다 2단계 도트(●● 완성, ●○ 글만 완료, ○○ 미시작)가 사용자에게 "얼마나 남았는지"를 직관적으로 보여준다. 다단계 완료 상태가 있는 항목에서는 라벨보다 시각적 진행 표시가 우선이다.

### 섹션 고유 색을 상태 표시에 쓰면 상태 구분이 흐려진다 #coding #ux
완료 배지에 섹션별 색을 쓰면 어떤 배지가 "완료"이고 어떤 게 "진행 중"인지 한눈에 안 보인다. 상태별 색은 전역 고정 팔레트(예: 완료=녹색, 진행=노랑)로, 섹션 고유 색은 섹션 ID 표시에만 분리해서 쓰는 게 명확하다.

### 순차 공개 UI에 자동 타이머와 탭을 동시에 걸지 않는다 #coding #ux
도토리 메시지에 2.5초 자동 진행 타이머와 탭 진행을 같이 두니 모바일에서 메시지가 "우르르" 쏟아지고, 탭과 타이머가 겹치면 2개씩 건너뛰었다. 순차 공개는 트리거를 하나(탭 전용 또는 자동 전용)로 정해야 진행 속도가 예측 가능하다.

### 렌더 중 조건부 사이드이펙트는 useEffect로 감싸야 한다 #coding #react
컴포넌트 렌더 함수 안에서 직접 콜백(setState 포함)을 호출하면 "Cannot update a component while rendering a different component" 에러 발생. `if (condition) callback()` 패턴 대신 `useEffect(() => { if (condition) callback(); }, [condition])` 으로 작성해야 한다. DeferredCheck의 `onDeferAll()` 직접 호출이 원인이었다.

## Deployment

## Next.js / React

### Next.js 16 App Router children prop은 React 19 단순 포맷 확인 필요 #coding #next-js #typescript
온보딩 page.tsx 분석 시 layout/page 컴포넌트의 `children` prop 타입이 React 19에서 단순화됨(`React.ReactNode`). 이전 버전의 `React.ReactNode | React.ReactElement` 형태와 호환성 확인이 필요하다. 특별한 이슈가 없어도 세션 시작 시 `next.config.ts`와 함께 확인해야 할 항목.

## Copywriting / 카피라이팅

### 타입 필드 제거 시 소비자 파일 전체를 grep으로 먼저 파악한다 #coding #typescript
`types.ts`에서 필드(`bucketListItems`, `gardenState`)를 제거하면 dashboard, finish 등 소비자 파일에서 빌드 에러가 발생한다. 수정 전 `grep -r "fieldName" --include="*.tsx"` 로 참조 파일 전체를 확인하고 한 번에 처리해야 배포 실패를 막을 수 있다.

### 온보딩 스토리텔링 배경과 도구 설명은 별도 페이지로 분리한다 #strategy #ux
도토리 잠재력 이야기(WHY)와 비전보드 설명(WHAT/HOW)을 같은 화면에서 섞으면 메시지가 희석된다. 하나의 화면은 하나의 아이디어 원칙 — Act 2는 잠재력 발견, Act 3은 도구 소개로 명확히 분리하면 각 메시지가 선명해진다.

### skip 버튼 카피는 클릭 후 동작을 반영해야 한다 #strategy #ux
"맞아, 딱 내 얘기야"처럼 긍정 어감이지만 기능이 skip인 버튼은 사용자를 혼란스럽게 한다. 버튼 카피는 감정적 공감보다 클릭 후 무슨 일이 일어나는지를 우선 반영해야 한다. 역할이 불명확하면 삭제하는 게 낫다.

### 반복 컴포넌트의 텍스트는 문법 패턴을 통일한다 #strategy #ux
섹션 subtitle처럼 반복되는 UI 요소에서 5개는 질문형, 1개는 서술형이면 시각적 리듬이 깨진다. 카피 설계 단계에서 문법 패턴(예: 전부 질문형)을 먼저 결정하면 코드 적용 후 수정 비용이 없다.

### 온보딩 구조 변경은 카피라이팅을 먼저 확정한 후 코드에 반영한다 #strategy #copywriting #workflow
Act 2 비전보드 스토리텔링 말풍선 7개처럼 감정적 흐름이 중요한 UI는 카피가 먼저 확정되어야 코드 구조(Act 번호, transition timing, state machine)가 결정된다. `/copywriting` 스킬로 카피 초안을 먼저 작성한 후 코드 구현에 들어가면 리워크가 줄어든다. 반대로 코드를 먼저 짜고 카피를 나중에 붙이면 Act 구조 변경 시 코드 수정 비용이 커진다.

### 카피 작성과 코드 적용은 같은 스텝에서 처리한다 #strategy #ux
카피를 문서로 작성 후 나중에 "코드에 적용해줘"로 별도 요청하면 어떤 파일이 실제로 수정됐는지 추적이 어렵고 누락이 생긴다. 카피 초안이 확정되는 즉시 해당 파일을 수정하면 누락 방지와 빠른 피드백이 동시에 된다.

### 플랜 파일은 HANDOFF에 핵심 내용을 직접 임베드해야 한다 #coding #workflow
`.claude/plans/` 파일 경로만 HANDOFF에 남기면, 다음 세션에서 컨텍스트 압축으로 경로가 소실되거나 파일 자체가 사라져 참조 불가 상태가 된다. 플랜 파일은 git에 커밋하거나, 변경 대상 파일 목록·핵심 결정사항을 HANDOFF `## Immediate Next Steps` / `## Active Files`에 직접 기록해야 한다.

### UI 컴포넌트의 텍스트 길이는 카피 설계 단계에서 통일한다 #coding #ux
섹션 카드 subtitle처럼 반복 컴포넌트의 텍스트 길이가 제각각이면 카드 높이가 달라져 정렬이 깨진다. 카피 설계 시 패턴(질문형, 비슷한 길이)을 먼저 결정하면 코드 적용 후 수정 비용이 없어진다.

### 파일 삭제 전 목록 확인을 먼저 받는다 #coding #workflow
`rm` 명령으로 파일을 한 번에 삭제하면 복구 어려운 액션이라 사용자가 거부할 수 있다. 삭제 대상 파일 목록을 먼저 보여주고 OK를 받은 후 삭제 명령을 실행한다. 코드 삭제·파일 삭제는 "확인 후 실행" 패턴을 기본으로.

### AI 프롬프트 "추가 금지" 지침이 추가 입력 기능도 무력화한다 #coding #ai-prompt
`"새로운 내용을 추가하지 말고, 위에 나온 것들만 재료로 써"` 한 줄이 두 가지 버그를 만들었다: (1) AI가 사용자 입력을 그대로 복사해서 출력, (2) `additionalInput` 추가 입력 기능이 있어도 프롬프트 지침이 충돌해 반영되지 않음. AI 기능 옵션(추가 입력, 재생성 등)을 구현할 때는 해당 입력이 실제로 프롬프트에 영향을 주도록 지침을 설계해야 한다.

### 핸드오프 커밋 SHA와 현재 코드베이스 사이에 여러 세션 차이가 생길 수 있다 #coding #workflow
세션 시작 시 핸드오프 내용을 그대로 실행하면 안 된다. `git log`로 핸드오프 이후 커밋을 먼저 확인하고, 이미 해결된 작업이나 방향이 바뀐 계획을 걸러낸 뒤 실행한다. 이번 세션에서 v2.4c AI 채팅 버그 플랜이 v2.7에서 채팅 자체가 제거되면서 완전히 무효화된 상태였다.

## Git / Workflow

### PowerShell에서 한글·특수문자 커밋 메시지는 here-string도 깨진다 — `git commit -F 파일` 사용 #coding #git #powershell
`git commit -m @'...'@` 안에 따옴표가 포함된 한글 멀티라인 메시지를 넣으면 인자가 따옴표 기준으로 쪼개져 pathspec 에러가 난다. 메시지를 UTF-8 파일로 쓰고 `git commit -F <파일>`로 커밋하는 것이 Windows에서 유일하게 안정적인 방법.

### `git checkout HEAD`는 tracked 파일의 uncommitted 변경을 모두 파괴한다 #coding #git
`git checkout HEAD` (혹은 checkout -- .)는 브랜치 전환이 아니라 HEAD로 tracked 파일을 리셋하는 동작으로, `git reset --hard`와 동일한 효과를 낸다. stash/commit하지 않은 모든 WIP가 사라진다. 의도한 동작이 "특정 파일만 HEAD로 복원"이라면 `git checkout HEAD -- <file>` 패턴을 써야 한다. 단일 파일이 아닌 전체 복원이 필요하면 `git stash`가 안전한 대안이다.

### 핸드오프는 커밋된 코드로만 검증해야 한다 #coding #workflow
HANDOFF.md에 "구현 완료"라고 적혀 있어도, `git diff HEAD --stat`로 실제 변경사항을 확인해야 한다. 본 세션에서는 HANDOFF에 v6.3-story = "구현 완료"로 기록되어 있었지만 실제로는 기획만 되어 있고 코드는 적용되지 않은 상태였다. 또한 prompt 파일에 "도토리/참나무 직접 언급 금지"가 있어 HANDOFF의 실제 기획안과 충돌했다. HANDOFF는 절대적 진실 공급원이 아니라 시작점일 뿐이며, 모든 상태 주장은 커밋/코드로 교차 검증해야 한다.

## Deployment

### 이 레포는 GitHub 푸시로 Vercel 배포가 트리거되지 않는다 — CLI 배포 필수 #coding #deployment
master 푸시 후 5분을 폴링해도 새 에셋이 404였다. Vercel-GitHub 연동이 없는 프로젝트라 `gh api .../commits/<sha>/status`도 빈 상태. 배포는 `vercel --prod` CLI로 직접 실행해야 하며(전역 설치·인증 완료), 푸시 후에는 새 정적 에셋 URL이 200인지로 배포 여부를 검증할 것.

### Vercel env add는 대화형 터미널에서만 가능하다 #coding #deployment
`vercel env add KEY production`은 값을 대화형으로 입력받는다. Claude가 파이프(`echo value |`) 또는 변수 임베드로 자동화하면 보안 차단이 걸린다. 비밀키를 Vercel에 추가할 때는 사용자가 직접 `! vercel env add KEY production` 명령을 실행하도록 안내하는 것이 유일한 방법이다.

## Storage / 데이터 저장

### 외부 이미지 URL은 생성 즉시 base64로 변환해야 영구 저장된다 #coding #storage
OpenAI/DALL-E URL은 24시간 후 만료되어 localStorage에 URL 문자열로 저장하면 다음 날 이미지가 깨진다. 생성 직후 Canvas API로 base64 변환 + JPEG 압축(quality 0.65 → 원본 대비 ~10%)을 적용하면 localStorage 한도 내에서 영구 저장이 가능하다. API 응답에 `response_format: 'b64_json'`을 쓰면 변환 단계를 API 레벨에서 줄일 수 있다.

### 저장 필드가 2개 이상이면 렌더링 시점에 어느 것을 읽는지 명시적으로 확인해야 한다 #coding #storage
`SectionData.images`(레거시 `[null, null, null]`)와 `SectionData.generatedImages`가 공존하는 상황에서 board 페이지가 `images`를 읽어 항상 빈 화면을 보여주는 버그가 있었다. 동일한 목적의 필드가 여러 개일 때, 쓰는 코드(write path)와 읽는 코드(read path)가 같은 필드를 가리키는지 한 번에 추적 확인해야 한다.

## AI API

### 새 OpenAI 계정은 dall-e-3가 없고 gpt-image-1이 기본이다 #coding #openai #ai-api
2025년 이후 생성된 OpenAI 계정은 `dall-e-3` 모델이 없거나 접근 불가한 경우가 있음 (400 "The model does not exist"). 신규 계정용 이미지 생성 모델은 `gpt-image-1`이며 응답이 b64_json 형식. 새 프로젝트에 OpenAI 이미지 생성을 붙일 때는 dall-e-3보다 gpt-image-1부터 시도할 것. gpt-image-1이 작동하던 계정에서 dall-e-2/dall-e-3로 전환해도 실패할 수 있음 — 모델 다운그레이드가 오히려 더 좁은 접근 권한을 요구하는 경우가 있다.

### Vercel 런타임 로그는 --json 플래그로 찍어야 전체 에러 메시지가 보인다 #coding #debugging #deployment
Vercel CLI 기본 로그 뷰는 컬럼 너비 제한으로 에러 메시지가 잘림. `vercel logs <url> --level error --json`으로 찍어야 전체 에러 객체를 볼 수 있음. 코드에서도 `console.error(JSON.stringify({status, message, code, error}))` 형태로 구조화해서 찍어야 함.

### 한국어 AI 프롬프트 톤은 "반말" 한 단어로는 부족하다 #coding #ai-prompt
"반말"로만 지정하면 모델이 존댓말/반말/서술체를 혼용함. 원하는 스타일이 "나는 ~한다, ~느낀다" 소설·일기체라면 "서술체로 써. 반말(야, 해, 했어)이나 존댓말(요, 습니다) 절대 금지"처럼 원하는 패턴과 금지 패턴을 함께 명시해야 일관성이 생김.

### 한국어 → DALL-E 3 생성은 중간 변환 단계가 필요하다 #coding #ai-api
DALL-E 3은 한국어 프롬프트를 받으면 결과가 불안정하다. 한국어 상황 묘사를 LLM(Groq 등)으로 영어 프롬프트 3개로 먼저 변환 후 `Promise.all`로 병렬 생성하는 2단계 패턴을 쓸 것. 프롬프트에 "realistic, warm natural light, lifestyle photography" 스타일 고정을 넣으면 일관성이 높아진다.

### Gemini 무료 티어는 모델 버전마다 다르다 #coding #ai-api
`gemini-2.0-flash`는 무료 티어 quota=0 (유료 전용). 무료로 사용하려면 `gemini-1.5-flash` 또는 `gemini-1.5-flash-8b`를 써야 한다. 최신 모델이라고 무료 티어를 지원하지 않으므로, AI 모델 선택 시 Google AI Studio 무료 티어 지원 목록을 먼저 확인할 것.

### CSS :hover::-webkit-scrollbar는 Chrome에서 불안정 — JS 클래스 토글로 대체 #coding #css
`:hover::-webkit-scrollbar { width: 4px }` 패턴은 이론상 맞지만 실제 Chrome에서 hover 없이도 즉시 보이는 버그가 발생함. 신뢰할 수 있는 방식은 `onMouseEnter/Leave`로 `.scroll-hide`(숨김) / `.scroll-show`(표시) 클래스를 JS에서 토글하는 것. CSS-only hover scrollbar는 프로덕션에 쓰지 말 것.

### cursor:pointer 는 전역 CSS로 한 번에 처리한다 #coding #accessibility
개별 버튼마다 `cursor-pointer` 클래스를 추가하면 누락이 생긴다. `globals.css`에 `button { cursor: pointer }` 하나로 전체 앱에 적용. `prefers-reduced-motion` 도 같은 방식으로 전역 처리 가능. 접근성 기본기는 개별 컴포넌트가 아닌 전역 CSS에서 한 번에 잡는다.

### `public/` 에셋은 next/image보다 `<img>` 태그가 더 빠르다 #coding #next-js
`next/image`는 외부 도메인 이미지에 `next.config.js` 도메인 설정이 필요하지만, `public/` 폴더 파일은 `<img src="/파일명">` 한 줄로 즉시 쓸 수 있다. Next.js 설정을 건드리지 않고 로컬 이미지 교체만 할 때는 `<img>` 태그가 더 실용적이다.

### GitHub Pages 진입점은 root index.html 필요 #coding #deployment
Pages에서 하위 폴더 HTML 파일은 직접 URL로 접근은 되지만, 기본 진입점(/)은 root의 index.html만 인식한다. Playground 내 파일을 배포 진입점으로 쓰려면 root에 복사하거나 /docs 폴더 설정 필요.

### llama-3.3-70b는 한국어 전용 명시 없이 쓰면 언어 혼용이 생긴다 #coding #ai-api
JSON 배열 안 텍스트를 생성할 때 영어 단어가 섞여 나오는 현상 발생. 프롬프트 최상단에 "모든 텍스트는 반드시 한국어로만. 영어 단어·로마자 혼용 절대 금지"를 명시해야 억제된다. 한국어 앱에서 LLM을 쓸 때 언어 규칙은 항상 맨 위에 둘 것.

### AI 채팅 슬롯 추출은 필드·시점을 STEP별로 명시해야 한다 #coding #ai-api
"추출하라"는 지시만으로는 AI가 null을 반환하거나 이전 값을 덮어쓴다. "STEP 1 답변 → extractedSlots.current = 사용자 답 그대로 (필수)"처럼 어느 STEP에서 어느 필드에 무엇을 저장하는지 명시해야 한다. 모호하면 슬롯이 빈 채로 미러링에 진입해 빈 요약이 생성된다.

### LLM 프롬프트 예시 문장은 실제 입력과 무관하게 복사된다 #coding #ai-api
"5점이구나 — 딱 중간"이라는 예시를 7점에도 그대로 사용하는 현상 발생. AI는 예시 문장을 맥락 확인 없이 패턴 복사함. 구체적 예시 문장 대신 범위별 지침("1~4점: ...`, `5~6점: ...`")으로 작성해야 실제 입력에 맞는 반응이 나온다.

### LLM 언어 제어는 프롬프트만으로 불완전하다 — 코드 레벨 필터 필수 #coding #ai-api
CJK 문자(한자·히라가나·가타카나)는 정규식 필터로 응답에서 제거 가능하지만, 베트남어 등 라틴 문자 외국어는 코드 레벨 차단 불가. temperature를 낮추는 것(0.75→0.5)이 가장 효과적인 보완책. 프롬프트 강화 + 코드 필터 + temperature 조합으로 방어해야 한다.

### 소형 LLM은 프롬프트 예시 고유명사를 그대로 복사한다 #coding #ai-api
STEP 0 예시에 "이번엔 건강 이야기야"를 넣었더니 llama-3.1-8b-instant가 공간·나 등 모든 섹션에서 동일하게 출력함. 소형 모델은 예시 문장의 고유명사를 맥락 없이 복사한다. Fix: 예시 대신 `${실제변수}`를 직접 주입하고 "현재 섹션은 X야, 이 주제로 작성" 형식으로 지시.

### LLM 페르소나 키워드가 출력 첫 줄에 노출된다 #coding #ai-api
시스템 프롬프트에 "따뜻한 AI 친구야"가 있으면 소형 모델이 "안녕하세요 친구! 나도 친구야~"로 시작함. 페르소나 설명의 단어가 출력 패턴으로 재사용되는 현상. Fix: STEP별 출력 지침에 "절대 금지: 인사말·자기소개·페르소나 호칭 직접 언급"을 명시.

### AI 이미지 3장 다양성은 구도 유형을 명시적으로 지정해야 보장된다 #coding #ai-prompt
공통 컨텍스트(섹션 타이틀, 장면 설명)가 3장 모두에 적용되면 번역 모델이 비슷한 영어 프롬프트를 생성하여 이미지가 수렴됨. 해결: 번역 시스템 프롬프트에 "Scene 1: wide shot, Scene 2: medium shot, Scene 3: close-up"처럼 각 장면에 구도 유형을 명시적으로 강제하고 "같은 소재(책상/노트북)는 3개 중 최대 1개"처럼 중복 금지 규칙을 추가해야 한다.

### Windows에서 npm start는 Start-Process 직접 호출 불가 — cmd.exe 경유 필요 #coding #workflow
npm.exe는 실제로 cmd 스크립트이므로 `Start-Process npm`이 실패한다. `Start-Process cmd -ArgumentList "/c npm run dev"`로 경유해야 dev 서버가 정상 실행된다.

### .next 캐시가 오래된 컴포넌트를 제공하면 purge가 필요하다 #coding #workflow
개발 서버를 재시작해도 `.next` 디렉토리 내 이전 컴파일 캐시가 남아 있어 변경사항이 반영되지 않을 수 있다. `Remove-Item -Recurse -Force .next`로 캐시를 완전히 삭제한 후 재시작해야 최신 코드가 반영된다. 빌드(Vite/Turbopack)가 "통과"했어도 브라우저에 과거 코드가 표시되는 현상의 원인이다.

### 누적 렌더 조건에서 완료 단계 범위를 명시적으로 좁혀야 한다 #coding #react
chat-accumulation 패턴(`step === 'describe' || step === 'images'`)에서 이전 단계 내용을 다음 단계에서도 표시하면 중복 렌더가 생긴다. 특히 각 단계가 별도의 "확인 완료" 역할을 가질 때는 조건을 해당 단계에만 한정(`step === 'describe'`)하고, 다음 단계에서는 접기/펼치기 요약으로 대체하는 것이 안전하다.
