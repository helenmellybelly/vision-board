# 교훈 기록 (Lessons Learned)

코딩 및 전략 교훈. /wrap 세션에서 기록됩니다.
#coding 태그 항목은 SessionStart 시 자동 주입됩니다.
반복 패턴은 /wrap HITL 승급을 통해 적절한 vehicle로 적용됩니다.

---

## 라우트 설계

### 페이지별 역할을 코드 레벨에서 단일하게 유지할 것 #coding #ux
`/dashboard`(진행 현황)와 `/board`(완성 결과물)처럼 역할이 다른 페이지에 같은 데이터(이미지·스토리)를 중복 표시하면 "어디서 보는 게 정답인가"가 모호해진다.
각 페이지가 보여줘야 할 데이터를 단일 책임으로 정의하고, 다른 페이지에서 동일 데이터를 표시하는 요구가 생기면 역할 분리를 재검토할 것.

---

## React / UI

### 그리드 셀 내 버튼 추가 시 absolute overlay 사용 #coding #react
`aspect-square` 그리드 셀에 버튼 영역을 flex-col wrapper로 아래에 붙이면 행 내 높이 불일치가 생긴다.
`absolute` 포지션 overlay로 셀 내부에 배치하면 `aspect-square` 치수가 유지되고 그리드 레이아웃이 깨지지 않는다.
버튼 클릭이 부모 클릭 핸들러(예: lightbox)로 전파되지 않도록 `e.stopPropagation()` 필수.

### Tailwind 동적 컬러 클래스 — inline style로 처리 #coding #react
런타임에 결정되는 색상(섹션 컬러 등)은 `border-[${color}]` 형태의 Tailwind 동적 클래스가 purge로 제거된다.
`focus-within` pseudo-class와 함께 쓰는 경우도 마찬가지다.
`onFocus`/`onBlur`로 상태를 추적하고 `style={{ borderColor: color + '60' }}` 형태의 inline style을 적용할 것.

### React ref 이중 할당 금지 — 마지막 할당만 유효 #coding #react
동일 ref를 JSX 트리에서 두 곳에 할당하면 마지막 노드만 가리킨다.
스크롤 컨테이너 ref를 외부 div와 내부 마커에 동시 할당했을 때 외부 div가 무시됐다.
스크롤 컨테이너는 별도 ref로 분리하고 `scrollTop = scrollHeight`로 직접 제어할 것.

### scrollIntoView(smooth)보다 requestAnimationFrame + scrollTop=scrollHeight #coding #react
`scrollIntoView({ behavior: 'smooth' })`는 레이아웃 완료 전에 실행되면 즉시성이 없고 크로스브라우저 동작이 다르다.
`requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; })`가 더 신뢰도 높고 즉시 바닥 이동이 보장된다.

---

## API 설계

### 사용자 확인이 필요한 흐름은 생성 API를 제안용/실행용으로 분리 #coding #api-design
단일 API가 프롬프트 생성+이미지 생성을 묶으면 중간에 사용자 개입(확인/수정)이 불가능하다.
`/describe`(제안·확인용) + `/generate`(실제 생성용)로 분리하면 단계별 UX 제어가 유연해진다.

### AI 검증 게이트는 fail-open + 무료 규칙 검증 선행 #coding #api-design
AI 호출을 사용자 진행의 차단 게이트로 둘 때, API 오류·타임아웃까지 차단하면 인프라 문제가 사용자를 가둔다(v6.19 답변 검증).
비용 없는 규칙 검증(길이·자모·반복)을 먼저 돌려 명백한 실패를 즉시 거르고, AI는 통과분만 검사하며 호출 실패 시엔 통과(fail-open)시킬 것.

---

## Storage

### 이미지 표시 로직은 모든 저장 경로를 커버해야 한다 #coding #storage
이미지가 두 가지 경로(AI 생성 `generatedImages` vs 직접 업로드 `uploadedImages`)로 저장될 때, 표시 로직이 한 경로만 읽으면 다른 경로 이미지가 조용히 사라진다.
표시 시 `uploaded[i] || generated[i]` 패턴으로 두 소스를 모두 합산할 것. 저장 경로가 늘어날 때마다 표시 로직도 함께 업데이트해야 한다.

### localStorage 이미지 업로드는 maxWidth 제한 필수 #coding #storage
사용자 업로드 이미지를 quality 압축만 하면 원본이 클 때 수 MB가 된다.
`compressImage(raw, 0.60, 800)` 처럼 maxWidth 상한을 지정해야 섹션×이미지 누적이 localStorage 한도(5-10MB)를 초과하지 않는다.

### 정규화(0..1) 좌표 배치는 제작 비율을 함께 저장해야 한다 #coding #storage
0..1 정규화 좌표는 컨테이너 비율이 바뀌면 그대로 늘어나/눌려 왜곡된다(v6.19 콜라주 기기 사이즈 변경).
배치 데이터에 제작 당시 비율(`aspect`)을 스탬프하고, 로드 시 현재 비율과 임계(~2%) 이상 다르면 리시드할 것. 레거시 데이터는 마이그레이션으로 당시 고정 비율을 채워 무손실 이행.

---

## 세션 관리

### HANDOFF.md의 결정사항 기록이 재부팅 후 컨텍스트를 완전 복구시킨다 #strategy #workflow
플랜 확정 중 컴퓨터가 재부팅됐어도 HANDOFF.md에 URL 분리 방식, 저장 조건, 모달 방식 등 결정사항이 모두 기록돼 있어서 코드 없이 바로 구현 시작 가능했다.
HANDOFF.md에는 "무엇을 만드나"뿐 아니라 "어떤 방식으로 결정됐나"까지 명시해야 재개 비용이 0에 가까워진다.

---

## AI 프롬프트

### 단일 묘사 재생성 시 기존 묘사를 컨텍스트로 포함해야 중복 방지된다 #coding #ai-prompt
장면 1개만 재생성(`describe-one`)할 때 다른 2장의 기존 묘사를 "겹치지 않도록" 참조로 넘기지 않으면 유사한 각도·소재가 반복된다.
existingDescriptions 배열에서 해당 인덱스를 제외한 나머지를 프롬프트에 포함할 것.

### 감정 금지는 금지어 + ❌/✅ 대체 예시를 함께 줘야 효과적 #coding #ai-prompt
"감정 단어 금지"만 명시하면 동의어나 유사 표현으로 우회한다.
`❌ "행복했다" → ✅ "커피잔을 두 손으로 감싸 쥐었다"` 형식으로 금지와 대안을 쌍으로 주면 모델이 더 확실히 따른다.

---

## 리브랜드 / UX

### 리브랜드 메타포는 캐릭터 정체성에만 한정하고 콘텐츠에 확장 금지 #strategy #ux
메타포(정원)를 캐릭터 설명("꿈의 정원사")에는 사용해도 질문 내용(cushionText/introText/whyText)에 확장하면 질문 의도가 변질된다. 적용 범위를 "정체성"과 "콘텐츠"로 명확히 구분하고 변경 전에 사용자와 범위를 합의할 것.

### 다수 파일 변경 전 1개 파일로 스코프 검증 후 전체 적용 #strategy #workflow
작은 프리뷰(1개 파일 수정 → 사용자 확인) 없이 다수 파일을 한 번에 변경하면 방향이 틀렸을 때 되돌리는 비용이 크다. 텍스트/메타포 변경처럼 해석 여지가 있는 작업은 먼저 1개 파일로 스코프를 검증받은 후 확산시킬 것.

### 타입 변경은 모든 참조 파일을 동시에 검색/변경해야 한다 #coding #workflow
`string` → `string[]` 같은 필드 타입 변경 시 types.ts만 바꾸면 storage.ts, page.tsx 등 사용처에서 참조 타입 불일치 에러가 발생한다.
변경 전 `grep -r "legacyFieldName"`으로 모든 참조 파일을 찾은 후, 안전하게 일괄 수정할 것.

### UI 플로우 검증은 Playwright로 실제 브라우저 동작까지 확인 #strategy #ux
`build` 성공만으로 UI 플로우(phase 전환, 버튼 활성화 조건 등)가 올바른지 알 수 없다.
온보딩 같은 multi-step UI는 Playwright로 실제 textarea 입력→버튼 클릭→다음 phase 전환까지 풀사이클을 테스트해야 한다.

---

## Testing / QA

### Playwright addInitScript는 reload마다 재실행 — localStorage 시드는 "없을 때만" #coding #playwright
`addInitScript`로 localStorage를 시드하면 `page.reload()` 때도 다시 실행돼 앱이 저장한 상태를 덮어쓴다(영속성 테스트가 거짓 FAIL).
`if (!localStorage.getItem(key))` 가드를 넣어 최초 1회만 시드할 것.

### 멀티스텝 플로우 QA는 버튼 클릭 루프보다 저장된 스텝 상태를 직접 시드 #coding #playwright
온보딩처럼 Act가 많은 플로우를 "보이는 버튼 클릭" 루프로 진행시키면 탭 투 컨티뉴·영상·입력 단계에서 쉽게 막힌다.
앱이 `onboardingStep` 같은 재개 상태를 저장한다면 그 값을 localStorage에 시드해 목표 화면으로 바로 진입하는 게 안정적이다.

### Playwright getByText()는 특수문자 포함 버튼에서 CSS selector 실패 #coding #playwright
버튼 텍스트에 `→` 같은 특수문자가 포함되면 Playwright 접근성 스냅샷의 `target` 파라미터가 CSS selector 파싱 에러를 발생시킨다.
`browser_run_code_unsafe`로 `page.getByText('다음').click()` 형태의 raw Playwright 코드를 실행하면 우회 가능하다.

### 온보딩 자동전환 타이머 QA 시 의도치 않은 플로우 진행 주의 #coding #testing
`setTimeout` 기반 자동전환(4초 fallback)과 탭 투 컨티뉴가 공존하는 온보딩에서, QA 중 탭 액션이 실패하면 fallback이 전체 스토리를 끝까지 진행시킨다.
QA 스크립트에 `waitForTimeout(1000)`만으로는 불충분 — fallback 시간보다 충분히 짧은 간격으로 연속 탭하거나, 타이머를 제어할 수 있는 테스트 전용 플래그 도입을 고려할 것.

### 페이지 삭제 후에는 .next 캐시를 지우고 빌드할 것 #coding #next-js
라우트 페이지(page.tsx)를 삭제하면 `.next/dev/types/validator.ts`가 삭제된 페이지를 계속 참조해 타입 체크가 실패한다(v6.21 /welcome·/scene 삭제).
페이지 추가·삭제·이동 후에는 `rm -rf .next` 후 빌드해야 stale 타입 캐시 오류를 피한다.

### 죽은 코드 grep은 부분 문자열 충돌을 걸러서 판정 #coding #workflow
`SectionComplete` 검색이 라이브 함수 `markSectionComplete`에 매치되는 식으로, 식별자 grep은 부분 문자열 오탐이 흔하다(v6.21 죽은 코드 13개 삭제).
삭제 판정 전 매치 라인을 실제로 읽어 import/사용인지 자기 정의·다른 식별자의 부분인지 구분할 것.

### pageerror 검증 FAIL은 변경 안 한 페이지에서 재현해 기존 이슈인지 판별 #coding #testing
localStorage 시드 + `useState(loadBoard())` 패턴은 모든 페이지에서 hydration #418을 내므로(서버=빈 보드, 클라이언트=시드 보드), 검증 스크립트의 `pageerror` 체크가 이번 변경과 무관하게 FAIL한다(v6.20 /scenes 검증).
새 에러를 만났을 때 같은 조건으로 변경하지 않은 페이지를 먼저 돌려 기존 전역 패턴 이슈인지 분리한 뒤 판정할 것.

### 단조 증가 값(schemaVersion 등)은 verify에서 `===`가 아니라 `>=`로 단언 #coding #testing
라운드별 검증 스크립트가 `schemaVersion === N`으로 고정 단언하면 다음 라운드가 버전을 올릴 때마다 리그레션이 위양성 FAIL한다(v7.0에서 r1·r2·r3 스크립트 3회 반복 수정).
마이그레이션 실행 여부는 결과 데이터 단언이 보장하므로, 버전 자체는 처음부터 `>= N`으로 쓸 것.

### Playwright getByText는 strict mode — 같은 문구가 2곳이면 isVisible()이 false로 오판 #coding #playwright
시트와 배경 카드에 같은 부제('몸·마음·에너지')가 동시에 있으면 `getByText(...).isVisible()`이 다중 매칭 에러를 던지고 `.catch(() => false)`에 삼켜져 조용한 FAIL이 된다(v7.0-r1 인트로 시트 검증).
재사용되는 문구는 `.first().isVisible()` 또는 `count() > 0`으로 단언할 것.
