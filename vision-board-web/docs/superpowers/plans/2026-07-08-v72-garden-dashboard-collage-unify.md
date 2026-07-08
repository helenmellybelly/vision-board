# v7.2 정원 맵 대시보드 + 배경화면 한 화면 통합 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드를 "토리의 정원 맵"으로 개편(빈 사진 6칸 압박 제거), collage의 choose 뷰·별도 사이즈 스텝을 한 화면 토글로 통합, 어색한 카피 6건 정비.

**Architecture:** 스키마 변경 없음 — 전부 표시 계층(카피·시각·뷰 상태머신). collage는 `view: 'choose'|'board'|'phone'|'desktop'` + `picking` 2축 상태를 `view: 'board'|'phone'|'desktop'` + `sizePanelOpen` 으로 축소. MiniBoardPreview는 상태별 시각(씨앗🌱/새싹🌿/사진+뱃지)만 추가하고 props 계약은 불변.

**Tech Stack:** Next.js App Router(클라이언트 컴포넌트), localStorage 상태(lib/storage), Playwright verify 스크립트(.claude/verify-*.mjs, BASE=http://localhost:3000).

**검증 방식(프로젝트 관례):** 유닛 테스트 없음. 코드 수정 → 기존 verify 스위트의 관련 단언 갱신 → 마지막 태스크에서 `npm run build` + **기존 서버 종료 후** `next start` 재기동 → 스위트 전체 실행. 커밋 메시지는 한글이므로 **반드시 UTF-8 임시 파일 + `git commit -F`** (PowerShell `-m` 금지, 전역 규칙).

**작업 디렉토리:** 모든 경로는 `vision-board-web/` 기준. git 루트는 상위 `vision-board/`.

---

### Task 1: 온보딩 Step1 카피 수정 (스펙 A)

**Files:**
- Modify: `vision-board-web/components/onboarding/Step1Name.tsx:49-58`
- Modify: `vision-board-web/.claude/verify-v71r1.mjs:34-35`
- Modify: `vision-board-web/.claude/verify-v7r1.mjs:89`

- [ ] **Step 1: Step1Name.tsx 카피 수정**

49-53행의 소개 문단에서 "그다음엔~" 줄 삭제:

```tsx
          <p className="text-body text-[#6B7280] leading-relaxed">
            네가 원하는 삶을 발견하도록 돕는 꿈의 정원사지.
          </p>
```

57-59행의 이름 질문 수정 ("그 전에 —"는 앞 문장이 사라졌으므로 함께 제거):

```tsx
          <p className="text-body font-semibold text-center text-[#1C1B19]">
            너를 뭐라고 불러주면 좋을까? 🌱
          </p>
```

- [ ] **Step 2: verify 단언 갱신**

`verify-v71r1.mjs:34-35`:

```js
  ok('R1-1a 여정 예고 문장 제거', (await page.getByText('그다음엔 우리 같이 비전보드를 만들 거야').count()) === 0);
  ok('R1-1b 이름 질문(새 카피)', (await page.getByText('너를 뭐라고 불러주면 좋을까?').count()) > 0);
```

`verify-v7r1.mjs:89`:

```js
  ok('R1-4a 스텝1 이름 질문 렌더', await page.getByText('뭐라고 불러주면 좋을까').isVisible().catch(() => false));
```

- [ ] **Step 3: Commit**

```bash
printf '%s\n' "fix: v7.2 온보딩 Step1 카피 — 여정 예고 문장 제거, 이름 질문 간결화" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add vision-board-web/components/onboarding/Step1Name.tsx vision-board-web/.claude/verify-v71r1.mjs vision-board-web/.claude/verify-v7r1.mjs && git commit -F /tmp/cm.txt
```

---

### Task 2: 섹션 명칭 '나 자신' → '원하는 내 모습' (스펙 B)

**Files:**
- Modify: `vision-board-web/lib/questions.ts:13`

- [ ] **Step 1: shortTitle 교체**

```ts
    shortTitle: '원하는 내 모습',
```

노출 3곳(대시보드 추천 카드·시작 방법 시트·scenes 완료 시트 "다음: ○○ 이어가기")은 모두 `shortTitle ?? title.split(' — ')[0]` 폴백으로 자동 반영. 미니보드 셀 라벨은 `title.split(' — ')[0]` = "나"라 불변 — verify의 `aria-label="나 — 시작 전"` 단언(v71r3:89, v71r4:124,136)은 그대로 통과해야 한다.

- [ ] **Step 2: '나 자신' 잔존 검색**

Run: `grep -rn "나 자신" vision-board-web/app vision-board-web/components vision-board-web/lib vision-board-web/.claude --include="*.ts" --include="*.tsx" --include="*.mjs" | grep -v archive`
Expected: 결과 없음 (있으면 해당 지점도 같은 명칭으로 교체)

- [ ] **Step 3: Commit**

```bash
printf '%s\n' "fix: v7.2 섹션 명칭 — '나 자신' → '원하는 내 모습' (노출 3곳 문장형)" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add vision-board-web/lib/questions.ts && git commit -F /tmp/cm.txt
```

---

### Task 3: scenes 시트 X 닫기 버튼 (스펙 E)

**Files:**
- Modify: `vision-board-web/app/scenes/[id]/page.tsx` (완료 시트 534-541행, 넛지 시트 584-590행)

- [ ] **Step 1: 사진 담았어 넛지 시트에 X 추가**

시트 컨테이너 div(584-590행)에 `relative` 클래스 추가 후, `aria-label="사진 저장 완료"` div의 첫 자식으로:

```tsx
            <button
              onClick={() => setShowPhotoNudge(false)}
              aria-label="닫기"
              className="absolute top-4 right-5 w-8 h-8 rounded-full bg-[#F5F5F3] text-[#6E6962] text-body flex items-center justify-center active:opacity-70"
            >
              ×
            </button>
```

컨테이너 className은 `"relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slideUp"`.

- [ ] **Step 2: 섹션 완성 시트에도 동일 패턴 추가 (일관성)**

완료 시트 컨테이너(534-541행)에 `relative` 추가 + 첫 자식으로:

```tsx
              <button
                onClick={() => setShowComplete(false)}
                aria-label="닫기"
                className="absolute top-4 right-5 w-8 h-8 rounded-full bg-[#F5F5F3] text-[#6E6962] text-body flex items-center justify-center active:opacity-70"
              >
                ×
              </button>
```

- [ ] **Step 3: Commit**

```bash
printf '%s\n' "fix: v7.2 scenes 저장 시트 X 닫기 버튼 — backdrop 탭만으로는 발견 불가 피드백" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add "vision-board-web/app/scenes/[id]/page.tsx" && git commit -F /tmp/cm.txt
```

---

### Task 4: 카피 정비 — 목적지 명확화 + 동사 통일 (스펙 F)

**Files:**
- Modify: `vision-board-web/app/scene/[id]/page.tsx:389,400`
- Modify: `vision-board-web/app/section/[id]/page.tsx:432`
- Modify: `vision-board-web/.claude/verify-v7r2.mjs:119,201`

- [ ] **Step 1: scene 페이지 두 곳**

400행 CTA (AI 생성 오인 제거):

```tsx
                    이 하루에 어울리는 사진 담으러 가기 →
```

389행 재생성 버튼 (finish의 "다시 써줘"와 동사 통일):

```tsx
                      {regenerating ? '다시 쓰는 중...' : '다시 써줘'}
```

- [ ] **Step 2: section 리뷰 CTA 목적지 명시 (432행)**

```tsx
                {aiChecking ? '잠깐, 확인해볼게…' : '이 답들로 미래의 하루 그려보기 →'}
```

- [ ] **Step 3: verify-v7r2 단언 갱신 (119행, 201행)**

```js
  ok('R2-3b 다음 CTA(사진 담으러)', await page.getByText('사진 담으러 가기').isVisible().catch(() => false));
```

```js
  ok('R2-7c CTA', await page.getByText('사진 담으러 가기').isVisible().catch(() => false));
```

주의: archive/ 스위트는 실행 대상이 아니므로 갱신하지 않는다.

- [ ] **Step 4: Commit**

```bash
printf '%s\n' "fix: v7.2 카피 정비 — 사진 담기 CTA 명확화, 미래의 하루 목적지 명시, 재생성 동사 통일" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add "vision-board-web/app/scene/[id]/page.tsx" "vision-board-web/app/section/[id]/page.tsx" vision-board-web/.claude/verify-v7r2.mjs && git commit -F /tmp/cm.txt
```

---

### Task 5: MiniBoardPreview 정원 시각 언어 (스펙 C1)

**Files:**
- Modify: `vision-board-web/components/MiniBoardPreview.tsx:108-165` (MiniPolaroid)

**설계:** props 계약·aria-label(`{label} — {STATUS_LABEL}`)·slideUp 애니메이션 불변. 사진이 있으면 상태 무관하게 사진 표시(보상 유지). 빈 칸의 컬러 도트를 씨앗/새싹으로, 상태 뱃지 3종(✓/✍️/📷), 추천 칸에 토리 마커.

- [ ] **Step 1: 빈 칸 씨앗/새싹 렌더 (146-151행)**

```tsx
        {area.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={area.photo} alt={area.label} className="w-full h-full object-cover" />
        ) : (
          <span className="text-heading leading-none" aria-hidden="true">
            {area.status === 'not_started' ? '🌱' : '🌿'}
          </span>
        )}
```

- [ ] **Step 2: 상태 뱃지 확장 (154-161행의 ✓ 블록 교체)**

```tsx
      {/* 상태 뱃지 — ✓ 완성 / ✍️ 이야기만 / 📷 사진만 (v7.2 정원 맵) */}
      {area.status === 'completed' ? (
        <span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1C1B19] text-white text-[9px] leading-none flex items-center justify-center"
          aria-hidden="true"
        >
          ✓
        </span>
      ) : area.status === 'text_complete' ? (
        <span className="absolute -top-1 -right-1 text-[10px] leading-none" aria-hidden="true">✍️</span>
      ) : area.status === 'in_progress' && area.photo ? (
        <span className="absolute -top-1 -right-1 text-[10px] leading-none" aria-hidden="true">📷</span>
      ) : null}
```

- [ ] **Step 3: 추천 칸 토리 마커 (135-141행 isNext 링 아래에 추가)**

```tsx
      {/* 토리가 추천 칸에서 기다린다 — 게임 맵의 현재 스테이지 문법 (v7.2) */}
      {isNext && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/tori-profile-bust.png"
          alt=""
          aria-hidden="true"
          className="absolute -top-2 -left-2 w-5 h-5 rounded-full object-cover z-10 shadow-md"
        />
      )}
```

기존 펄스 링은 유지.

- [ ] **Step 4: 공유 렌더 확인**

MiniBoardPreview는 대시보드(interactive)·scenes 완료/넛지 시트(compact)·finish 피날레에서 공유. compact 시트에서는 `nextSectionId`를 안 넘기므로 토리 마커 없음 — 의도된 동작. 코드 리뷰로 확인만.

- [ ] **Step 5: Commit**

```bash
printf '%s\n' "feat: v7.2 정원 맵 — 미니보드 씨앗/새싹 시각, 상태 뱃지 3종, 추천 칸 토리 마커" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add vision-board-web/components/MiniBoardPreview.tsx && git commit -F /tmp/cm.txt
```

---

### Task 6: 대시보드 카피 + 진입 버튼 단일화 (스펙 C2·D2)

**Files:**
- Modify: `vision-board-web/app/dashboard/page.tsx:72-89,143-199`
- Modify: `vision-board-web/.claude/verify-v71r3.mjs:103-104,118-162`
- Modify: `vision-board-web/.claude/verify-v7r5.mjs:125-126`

- [ ] **Step 1: boardCaption 정원 은유 (72-77행)**

```tsx
  const boardCaption =
    photoSectionCount === 0
      ? '질문에 답하고 사진을 담으면 이 정원이 피어나 🌰'
      : photoSectionCount < 6
      ? `${photoSectionCount}/6 피었어 🌰`
      : '다 피었다! 배경화면으로 만들어봐 🐿️';
```

- [ ] **Step 2: 추천 카드 문장형 (79-89행 교체 + 143-153행 카드 본문)**

```tsx
  // 추천 카드 — 다음 할 일 1개만 (v7.1-r3 → v7.2 문장형: 섹션명 단독 노출이 어색하다는 피드백)
  const recommendedId = getRecommendedSection(board);
  const recommended = recommendedId ? getSection(recommendedId) : null;
  const recommendedStatus = recommendedId ? board.sections[recommendedId].status : null;
  const recommendLabel = recommended
    ? recommended.shortTitle ?? recommended.title.split(' — ')[0]
    : '';
  // 부캡션: 열린 고리(사진有·답변無) > 막판 goal-gradient > 토리 대기
  const completedCount = statuses.filter((s) => s === 'completed').length;
  const recommendCaption =
    recommendedId && isPhotoOnlySection(board.sections[recommendedId])
      ? '사진은 담았는데 이야기가 비어 있어 🌰'
      : completedCount >= 4
      ? `이제 ${6 - completedCount}칸이면 끝이야 🐿️`
      : '🐿️ 토리가 여기서 기다려';
  // 본문: 상태에 맞는 다음 행동을 문장으로
  const recommendAction =
    recommendedId && isPhotoOnlySection(board.sections[recommendedId])
      ? `${recommendLabel}, 이야기를 들려줄래? →`
      : recommendedStatus === 'text_complete'
      ? `${recommendLabel}, 사진을 담아볼까? →`
      : `${recommendLabel}, 이야기부터 시작해볼까? →`;
```

카드 본문(150-152행):

```tsx
            <p className="font-semibold text-body">{recommendAction}</p>
```

- [ ] **Step 3: 하단 액션 단일화 (175-199행 hasAnyImage 블록 교체)**

```tsx
          {hasAnyImage && (
            <button
              onClick={() => router.push('/collage')}
              className="w-full py-3.5 rounded-2xl border border-[#E5E3DF] bg-white text-body font-semibold text-[#1C1B19] active:opacity-70 transition-opacity"
            >
              🖼️ 내 비전보드 보기
            </button>
          )}
```

📱/🖥️ 퀵 버튼 grid와 "그냥 보드로 볼래?" 링크 삭제. `?device=` 딥링크 자체는 collage에 유지(Task 8) — /finish 진입용.

- [ ] **Step 4: verify-v71r3 갱신**

103-104행 (추천 카드):

```js
  ok('R3-3a 추천 카드 노출', await page.getByText('토리가 여기서 기다려').isVisible().catch(() => false));
  await page.getByText('이야기부터 시작해볼까?').click();
```

118-143행 (R3-4 퀵 버튼 → 단일 버튼 + 딥링크 직접 검증으로 재작성):

```js
  ok('R3-4a 사진 없으면 보드 버튼 숨김', (await page.getByText('내 비전보드 보기').count()) === 0);
```

(사진 시드 후)

```js
  ok('R3-4b 사진 있으면 보드 버튼 노출', await page.getByText('내 비전보드 보기').isVisible().catch(() => false));
  await page.getByText('내 비전보드 보기').click();
  await page.waitForTimeout(800);
  ok('R3-4c 진입 즉시 보드 뷰', await page.getByRole('radio', { name: '보드' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  // 딥링크는 URL 직접 진입으로 검증
  await page.goto(`${BASE}/collage?device=phone`);
  await page.waitForTimeout(800);
  ok('R3-4d 폰 딥링크 → 폰 탭 활성', await page.getByRole('radio', { name: '📱 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('R3-4e 프리셋 무 → 사이즈 피커 인라인', await page.getByText('휴대폰').first().isVisible().catch(() => false));
```

R3-4f/g(프리셋 저장 후 피커 건너뜀)은 같은 딥링크 재진입으로 유지하되 단언을 `(await page.getByText('사이즈 바꾸기').count()) > 0`으로 교체. 160-162행(R3-5 '그냥 보드로 볼래?')은 케이스 삭제하고 R3-4c가 대체함을 주석으로 남긴다.

- [ ] **Step 5: verify-v7r5:125-126 갱신**

```js
  // v7.2: 단일 진입 버튼 '내 비전보드 보기' → 보드 뷰 직행
  await page.getByText('내 비전보드 보기').click();
```

- [ ] **Step 6: Commit**

```bash
printf '%s\n' "feat: v7.2 대시보드 — 정원 캡션, 추천 카드 문장형, 진입 버튼 '내 비전보드 보기' 단일화" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add vision-board-web/app/dashboard/page.tsx vision-board-web/.claude/verify-v71r3.mjs vision-board-web/.claude/verify-v7r5.mjs && git commit -F /tmp/cm.txt
```

---

### Task 7: DashboardIntroSheet 진행 방식 안내 (스펙 C3)

**Files:**
- Modify: `vision-board-web/components/DashboardIntroSheet.tsx:40-44`

- [ ] **Step 1: 안내 문단 교체**

```tsx
        <p className="text-body leading-relaxed mb-4">
          좋아{userName ? `, ${josa(userName, '아/야')}` : ''}. 비전보드는 6칸짜리 정원이야. <span className="font-semibold">순서는 네 마음!</span><br />
          각 칸은 <span className="font-semibold">질문에 답하고 → 어울리는 사진을 담으면</span> 완성돼.<br />
          사진부터 담아도 되지만, 질문으로 진짜 원하는 걸 먼저 찾아보는 걸 추천해 🌰<br />
          6칸이 다 피면 폰·PC 배경화면으로 만들 수 있어.
        </p>
```

6영역 카드 그리드(46-63행)와 CTA는 불변.

- [ ] **Step 2: Commit**

```bash
printf '%s\n' "feat: v7.2 대시보드 첫 진입 시트 — 진행 방식 안내(순서 자유·질문 추천·배경화면 예고) 추가" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add vision-board-web/components/DashboardIntroSheet.tsx && git commit -F /tmp/cm.txt
```

---

### Task 8: collage 한 화면 통합 (스펙 D1·D2)

**Files:**
- Modify: `vision-board-web/app/collage/page.tsx` (상태·헤더·렌더 분기 전면)
- Modify: `vision-board-web/app/finish/page.tsx:269-274`
- Modify: `vision-board-web/.claude/verify-v7r5.mjs:64-92`
- Modify: `vision-board-web/.claude/verify-v7r3.mjs:144`

**불변 조건:** `collageLayouts`/`collageDeviceLayouts` 저장 키와 `handleLayoutChange` 이원화 로직, `handleSelectPreset`/`applyReseed`의 reseed 확인 플로우, `WallpaperSheet`·`DevicePresetPicker` 컴포넌트.

- [ ] **Step 1: 상태머신 축소 (27-34, 79-97행)**

```tsx
// 화면 구조 (v7.2) — choose 뷰 제거, 한 화면에서 [보드|폰|PC] 토글 + 인라인 사이즈 선택
type CollageView = 'board' | 'phone' | 'desktop';
```

`VIEW_TITLES` 상수 삭제. 상태 선언부:

```tsx
  const [view, setView] = useState<CollageView>('board');
  const [sizePanelOpen, setSizePanelOpen] = useState(false); // 프리셋 있는 상태에서 '사이즈 바꾸기'
```

딥링크 useEffect(91-96행):

```tsx
    const device = new URLSearchParams(window.location.search).get('device');
    if (device === 'phone' || device === 'desktop') {
      setView(device);
      history.replaceState(null, '', window.location.pathname);
    }
```

- [ ] **Step 2: 전환 함수 정리 (168-204행)**

`enterDevice`·`backToChoose` 삭제, 토글 전환 함수 추가:

```tsx
  // 탭 전환 — 사이즈 패널과 reseed 확인은 뷰 이동 시 접는다
  function switchView(v: CollageView) {
    setView(v);
    setSizePanelOpen(false);
    setConfirmReseed(null);
  }
```

`handleSelectPreset`(194행)과 `applyReseed`(203행)의 `setPicking(false)` → `setSizePanelOpen(false)`.

- [ ] **Step 3: 헤더 + 토글 (225-258행 교체)**

```tsx
      {/* 헤더 — 상위는 대시보드 하나 (v7.2 한 화면 통합) */}
      <div className="px-6 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.push('/dashboard')}
            aria-label="대시보드로 돌아가기"
            className="p-2 -ml-2 text-[#6B7280] active:opacity-60"
          >
            ←
          </button>
          <h1 className="text-title font-bold">내 비전보드</h1>
        </div>
        <div className="flex gap-1.5 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="보기 방식">
          {([
            { id: 'board' as const, label: '보드' },
            { id: 'phone' as const, label: '📱 폰' },
            { id: 'desktop' as const, label: '🖥️ PC' },
          ]).map((v) => (
            <button
              key={v.id}
              role="radio"
              aria-checked={view === v.id}
              onClick={() => switchView(v.id)}
              className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
                view === v.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
```

- [ ] **Step 4: 렌더 분기 재작성 (260-455행)**

`choose` 분기 삭제. 새 구조:

```tsx
        {collageImages.length === 0 ? (
          /* 빈 상태 — 기존 그대로 (261-274행) */
        ) : view === 'board' ? (
          <>
            {templateSelector}
            <CollageBoard
              key={`board-${template}`}
              template={template}
              items={keyedItems}
              layout={savedLayout}
              aspect={ASPECT}
              onLayoutChange={handleLayoutChange}
              year={boardYear}
              onYearChange={handleYearChange}
            />
            <p className="text-micro text-[#6E6962] text-center mt-2">
              위 탭에서 폰·PC를 고르면 배경화면으로 만들 수 있어.
            </p>
          </>
        ) : !devicePreset ? (
          <>
            {/* 사이즈 미선택 — 같은 화면에서 인라인 선택 (별도 스텝 아님) */}
            <p className="text-caption text-[#6E6962] mb-3">
              어떤 기기에 쓸지 사이즈를 골라줘. 고르면 바로 그 비율로 보여줄게.
            </p>
            <DevicePresetPicker
              groups={view === 'phone' ? ['휴대폰', '태블릿'] : ['PC']}
              selectedId={undefined}
              onSelect={handleSelectPreset}
            />
          </>
        ) : (
          <>
            {/* 사이즈 칩 행 — 선택값이 화면에 남아 바로 변경 가능 */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-caption text-[#6E6962]">
                {devicePreset.label} · {devicePreset.w}×{devicePreset.h}
              </p>
              <button
                onClick={() => setSizePanelOpen(!sizePanelOpen)}
                className="text-caption text-[#1C1B19] underline active:opacity-70"
              >
                {sizePanelOpen ? '접기' : '사이즈 바꾸기'}
              </button>
            </div>
            {sizePanelOpen && (
              <div className="mb-4 animate-fadeIn">
                <DevicePresetPicker
                  groups={view === 'phone' ? ['휴대폰', '태블릿'] : ['PC']}
                  selectedId={devicePreset.id}
                  onSelect={handleSelectPreset}
                />
                {confirmReseed && (
                  <div className="mt-4 rounded-xl bg-[#FEF9C3] px-4 py-3">
                    <p className="text-caption text-[#92400E] mb-2">
                      비율이 달라져서 배치를 새로 짜야 해. 지금까지 꾸민 배치는 사라져. 계속할까?
                    </p>
                    <div className="flex gap-3">
                      <button onClick={applyReseed} className="text-caption font-semibold text-[#92400E]">
                        계속
                      </button>
                      <button onClick={() => setConfirmReseed(null)} className="text-caption text-[#6E6962]">
                        취소
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {templateSelector}
            <CollageBoard
              key={`${view}-${devicePreset.id}-${template}`}
              template={template}
              items={keyedItems}
              layout={savedLayout}
              aspect={aspect}
              onLayoutChange={handleLayoutChange}
              year={boardYear}
              onYearChange={handleYearChange}
            />
            <p className="text-micro text-[#6E6962] text-center mt-2">
              {view === 'phone'
                ? '선택한 폰 화면 비율 그대로야. 배치를 다듬고 저장해봐.'
                : '선택한 PC 화면 비율 그대로야. 배치를 다듬고 저장해봐.'}
            </p>
            <button
              onClick={() => setSheetOpen(true)}
              className="mt-3 w-full py-3.5 rounded-2xl text-heading font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity"
            >
              {view === 'phone' ? '폰 배경화면 저장' : 'PC 배경화면 저장'}
            </button>
          </>
        )}
```

주의: 사이즈 미선택 분기에서도 confirmReseed 블록은 필요 없다(프리셋이 없으면 reseed 경고가 발생하지 않음 — `handleSelectPreset`의 `devicePreset && hasLayouts` 가드). 기존 "그대로 둘게" 버튼(381-388행)은 사이즈 칩 행의 '접기'가 대체하므로 삭제.

- [ ] **Step 5: futureDayStory·완성 CTA 조건 (421,443행)**

`(view === 'choose' || view === 'board')` → `view === 'board'` 두 곳.

- [ ] **Step 6: 코치마크 (458-459, 484-489행)**

노출 조건에서 `view === 'board'` 제거 (딥링크 직행 시에도 1회 노출):

```tsx
      {showCoach && collageImages.length > 0 && (
```

세 번째 불릿(486-488행) 카피를 토글 문법으로:

```tsx
                <p className="text-body text-[#1C1B19] leading-snug">
                  위 <span className="font-semibold">보드·폰·PC 탭</span>에서 기기 사이즈를 고르면, 그 비율 그대로 꾸며서 저장할 수 있어.
                </p>
```

- [ ] **Step 7: /finish 버튼 목적지 분리 (finish/page.tsx:269-274)**

```tsx
            <button
              onClick={() => router.push('/collage?device=phone')}
              className="w-full border border-[#E5E3DF] text-[#6B7280] py-3.5 rounded-2xl text-body font-semibold"
            >
              폰 배경화면으로 만들기
            </button>
```

- [ ] **Step 8: verify-v7r5 R5-1·R5-2 재작성 (64-92행)**

choose 전제 케이스를 통합 화면 기준으로:

```js
  // R5-1: /collage 진입 즉시 보드 + 토글 (v7.2 한 화면 통합)
  ok('R5-1a 진입 즉시 보드 탭 활성', await page.getByRole('radio', { name: '보드' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('R5-1b 템플릿 셀렉터 노출', await page.getByText('폴라로이드').isVisible().catch(() => false));
  await page.getByRole('radio', { name: '📱 폰' }).click();
  await page.waitForTimeout(500);
  ok('R5-1e 폰 탭 → 사이즈 피커 인라인', await page.getByText('휴대폰').first().isVisible().catch(() => false));
  // R5-2: 뒤로가기는 대시보드로
  await page.getByLabel('대시보드로 돌아가기').click();
  await page.waitForTimeout(800);
  ok('R5-2c ← → 대시보드', new URL(page.url()).pathname === '/dashboard');
```

기존 R5-1c/d(폰·보드 옵션 버튼)와 R5-2a/b 중 choose 왕복 단언은 삭제. 케이스 번호는 유지하되 주석으로 v7.2 재정의 명시.

- [ ] **Step 9: verify-v7r3:144 갱신**

```js
  // v7.2: choose 뷰 제거 — /collage 진입이 곧 보드 뷰
  await page.waitForTimeout(300);
```

('그냥 보드로 보기' 클릭 줄 삭제. 이후 단언이 보드 뷰 전제라면 그대로 통과.)

- [ ] **Step 10: Commit**

```bash
printf '%s\n' "feat: v7.2 collage 한 화면 통합 — choose 뷰 제거, [보드|폰|PC] 토글 + 인라인 사이즈, finish 딥링크" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add vision-board-web/app/collage/page.tsx vision-board-web/app/finish/page.tsx vision-board-web/.claude/verify-v7r5.mjs vision-board-web/.claude/verify-v7r3.mjs && git commit -F /tmp/cm.txt
```

---

### Task 9: 신규 verify-v72r1 작성 + 전체 회귀 실행

**Files:**
- Create: `vision-board-web/.claude/verify-v72r1.mjs`

- [ ] **Step 1: 신규 스위트 작성**

기존 스위트의 `newPage(seed)` 보일러플레이트(verify-v71r1.mjs:1-27)를 복사해 시작. 케이스:

```js
// v7.2 검증 — 온보딩 카피, 정원 맵 대시보드, collage 한 화면 통합, scenes 시트 X
// 시드는 verify-v71r3.mjs의 온보딩 완료 시드(onboardingDone:true, schemaVersion 최신)를 재사용

// ── 1) 온보딩 스텝1 새 카피 ──
//  V2-1a: '너를 뭐라고 불러주면 좋을까?' 노출
//  V2-1b: '그다음엔 우리 같이' count === 0
//  V2-1c: '그 전에 —' count === 0

// ── 2) 대시보드 정원 맵 (온보딩 완료 시드) ──
//  V2-2a: 미시작 6칸 → 🌱 이모지 count >= 1 (page.getByText('🌱'))
//  V2-2b: 추천 카드 '토리가 여기서 기다려' 노출
//  V2-2c: 추천 카드 본문 '원하는 내 모습, 이야기부터 시작해볼까?' 노출 (추천 1순위 = 섹션1)
//  V2-2d: 첫 진입 시트에 '순서는 네 마음' + '먼저 찾아보는 걸 추천해' 노출
//  V2-2e: 사진 없음 → '내 비전보드 보기' count === 0
//  V2-2f: (사진 1장 시드) '내 비전보드 보기' 노출 + 📱/🖥️ 퀵 버튼·'그냥 보드로 볼래?' count === 0

// ── 3) collage 통합 화면 (사진 시드) ──
//  V2-3a: /collage 진입 → radio '보드' aria-checked=true, '완성된 보드, 어디에 둘까?' count === 0
//  V2-3b: '📱 폰' 탭 → '휴대폰' 그룹 헤딩 노출 (인라인 피커)
//  V2-3c: 프리셋 선택 → '사이즈 바꾸기' 노출 + '폰 배경화면 저장' 버튼 노출 (같은 화면)
//  V2-3d: '사이즈 바꾸기' → 피커 재노출, '접기' → 닫힘
//  V2-3e: /collage?device=desktop 직접 진입 → '🖥️ PC' aria-checked=true
//  V2-3f: 보드 탭 복귀 → 템플릿 셀렉터 + 4:5 보드 렌더

// ── 4) scenes 저장 시트 X (사진 먼저 시드: 답변 없이 /scenes/1) ──
//  V2-4a: 사진 담고 저장 → '사진 담았어' 시트 노출
//  V2-4b: aria-label='닫기' 버튼 클릭 → 시트 닫힘 (같은 페이지 유지)

// ── 5) 섹션 명칭 ──
//  V2-5a: 대시보드 미시작 셀 탭 → 시트 제목 '원하는 내 모습, 어떻게 시작할까?' 노출
```

시드 데이터와 상호작용 코드는 verify-v71r3.mjs·verify-v71r4.mjs의 기존 시드/플로우를 그대로 차용해 작성한다 (스키마 버전 상수 포함).

- [ ] **Step 2: 빌드 + 서버 재기동 (전역 규칙 — 기존 프로세스 먼저 종료)**

```bash
cd vision-board-web && npm run build
```

Expected: 빌드 성공, 타입 에러 0.

포트 3000 기존 프로세스 종료 후 재기동 (PowerShell):

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -Confirm:$false }
```

그다음 `npm run start`를 background로 실행.

- [ ] **Step 3: 전체 회귀 실행**

```bash
cd vision-board-web && for f in .claude/verify-v7r*.mjs .claude/verify-v71r*.mjs .claude/verify-v72r1.mjs; do echo "== $f"; node "$f"; done
```

Expected: 전 케이스 PASS. FAIL 발생 시 **기준선 분리 원칙**(전역 규칙): 이번에 안 건드린 페이지·이전 커밋에서 같은 조건 재현으로 기존 이슈인지 먼저 판정. hydration #418은 기존 전역 패턴이므로 새 FAIL로 오인 금지.

- [ ] **Step 4: Commit**

```bash
printf '%s\n' "test: v7.2 회귀 스위트 verify-v72r1 추가 — 정원 맵·collage 통합·시트 X·명칭 검증" "" "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>" > /tmp/cm.txt && git add vision-board-web/.claude/verify-v72r1.mjs && git commit -F /tmp/cm.txt
```

---

### Task 10: 배포 + 프로덕션 확인

- [ ] **Step 1: 푸시**

```bash
git push origin master
```

- [ ] **Step 2: 프로덕션 배포 (CLI 필수 — GitHub 자동 배포 없음)**

```bash
cd vision-board-web && npx vercel --prod
```

- [ ] **Step 3: 신빌드 확인**

배포 URL에서: 주요 경로 200 확인 + 결정적 증거로 온보딩이 아닌 **/dashboard HTML이 아닌 CSR 페이지 특성**을 감안, `curl`로 `/collage` 200 및 (기존 관례대로) `/moment` 404 확인. 브라우저로 https://vision-board-web.vercel.app/onboarding/1 에서 새 카피 육안 확인.

---

## Self-Review 체크

- **스펙 커버리지:** A→Task1, B→Task2, C1→Task5, C2→Task6, C3→Task7, D1→Task8, D2→Task6(대시보드측)+Task8(finish·딥링크), E→Task3, F→Task4. 백로그 항목은 의도적 제외. ✓
- **플레이스홀더:** Task 9 Step 1의 케이스 목록은 주석 형태지만 단언 대상 문자열·조건을 전부 명시했고 보일러플레이트 출처를 지정함. ✓
- **타입 일관성:** `CollageView` 3값 축소에 따라 `VIEW_TITLES`·`enterDevice`·`backToChoose`·`picking` 참조를 전부 제거(Task 8 Step 1-4에서 일괄). `switchView`·`sizePanelOpen` 명칭 통일. ✓
