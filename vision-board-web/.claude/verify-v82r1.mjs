// v8.2 검증 — 뷰 분리 복원 + 이미지 극대화 + 리사이즈 리플로우 + 라이트박스
//   V82-1~2: 보드 실측 크기(PC 전폭·폰 확대) + 폰 뷰 lg 사이드 레일
//   V82-3: sticky 저장 바 상시 가시
//   V82-4~5: 수량별 시드(18장 최소 셀·1장 히어로)
//   V82-6: 리사이즈 → 전체 리플로우(다른 사진이 자리를 내줌)
//   V82-7~9: 라이트박스(사진 탭 확대·배경 탭 편집·편집 칩 버튼) + scenes 회귀
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  for (const [id, extra] of Object.entries(overrides)) {
    Object.assign(sections[id], extra);
  }
  return sections;
}
const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };
const withPhotos = (imgs) => ({
  status: 'completed', extractedSlots: { ...FULL_EXTRACTED }, sceneText: '하루', miniStory: '스토리.',
  uploadedImages: imgs, ...{},
});
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});
// n장 시드 — 섹션 순회로 슬롯 채움 (키 `${sectionId}-${slotIdx}` 계약)
function boardWithN(n, extra = {}) {
  const overrides = {};
  let left = n;
  for (let id = 1; id <= 6 && left > 0; id++) {
    const take = Math.min(3, left);
    overrides[id] = withPhotos([take > 0 ? PIXEL : null, take > 1 ? PIXEL : null, take > 2 ? PIXEL : null]);
    left -= take;
  }
  return board(overrides, extra);
}

const browser = await chromium.launch();
const WIDE = { width: 1280, height: 900 };
const NARROW = { width: 390, height: 844 };

async function newPage(seed, viewport = NARROW) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (seed) {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('vision-board-data')) {
        localStorage.setItem('vision-board-data', JSON.stringify(data));
      }
      localStorage.setItem('vb-collage-coach-v1', '1');
    }, seed);
  }
  return { ctx, page };
}
const boardOf = (page, view) => page.locator(`[data-testid="collage-board"][data-view="${view}"]`);

// ── V82-1) lg PC 뷰 — 보드가 컨테이너 전폭(≥1000px) ──
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  const box = await boardOf(page, 'desktop').boundingBox();
  ok('V82-1 PC 보드 전폭(≥1000px)', !!box && box.width >= 1000, `w=${box?.width}`);
  await ctx.close();
}

// ── V82-2) lg 폰 뷰 — 보드 확대(≥300px) + 프리셋 칩 위치 ──
// ⚠️ V82-2b는 v8.7에서 계약이 뒤집혔다. v8.2는 칩을 보드 우측 20rem 레일에 넣었는데,
// 칩 7개가 그 폭에 안 들어가 화면 밖으로 잘렸다(오너 실사용 신고). 이제 칩은 템플릿 탭
// 바로 아래 전폭에 있고 레일은 폐지 — 단언도 "보드 위"로 뒤집는다.
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(1800);
  const bd = await boardOf(page, 'phone').boundingBox();
  ok('V82-2a 폰 보드 확대(≥300px)', !!bd && bd.width >= 300, `w=${bd?.width}`);
  const chips = await page.getByRole('radiogroup', { name: '기기 사이즈' }).boundingBox();
  ok('V82-2b 프리셋 칩이 보드 위(전폭)', !!bd && !!chips && chips.y + chips.height <= bd.y + 4, `chipsB=${chips ? chips.y + chips.height : '?'} boardT=${bd?.y}`);
  await ctx.close();
}

// ── V82-3) sticky 저장 바 — 페이지 최상단에서도 저장 버튼이 뷰포트 안 ──
{
  const { ctx, page } = await newPage(boardWithN(6, { futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 6 }), NARROW);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const btn = page.getByRole('button', { name: '폰 배경화면 저장' });
  const box = await btn.boundingBox();
  ok('V82-3 sticky 저장 버튼 뷰포트 내', !!box && box.y >= 0 && box.y + box.height <= 844, `y=${box?.y} h=${box?.height}`);
  await ctx.close();
}

// ── V82-4) 18장 PC — 최소 사진 실측 ──
// ⚠️ 계약 재정의 (v10): 구 단언은 "최소 **폭** ≥100px"이었다. 정사각 격자에서는 폭이 곧
//    크기였지만, 저스티파이드에서는 세로 사진이 원본 비율대로 **좁고 길게** 들어가는 게 정상이라
//    폭만 재면 정상 배치를 결함으로 잡는다. 크기의 대리 지표는 **면적**이다 —
//    18장이 균등하다면 한 장당 보드의 1/18 ≈ 5.6%다. 하한은 희망이 아니라 실측에서 잡는다:
//    현재 최악이 2.7%(1017×572 기준 ≈125×125px)이므로 2.5%로 고정한다.
//    ⚠️ 이 수치는 히어로 폭 상한(collageTokens heroMaxWFor)과 직결된다 — 상한을 0.6으로 두면
//    한 장이 보드의 53%를 먹고 나머지가 0.6%까지 잘아진다(실측). 이 단언이 그 회귀를 잡는다.
{
  const { ctx, page } = await newPage(boardWithN(18), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page, 'desktop');
  const bb = await bd.boundingBox();
  const areas = await bd
    .locator('img[data-photo]')
    .evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return r.width * r.height; }));
  const minShare = Math.min(...areas) / (bb.width * bb.height);
  ok('V82-4 18장 최소 사진 면적 ≥ 보드의 2.5%', areas.length === 18 && minShare >= 0.025,
    `n=${areas.length} min=${(minShare * 100).toFixed(1)}%`);
  await ctx.close();
}

// ── V82-5) 1장 히어로 — 사진 면적 ≥ 보드의 25% ──
{
  const { ctx, page } = await newPage(boardWithN(1), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = await boardOf(page, 'desktop').boundingBox();
  const img = await boardOf(page, 'desktop').locator('img').first().boundingBox();
  const frac = bd && img ? (img.width * img.height) / (bd.width * bd.height) : 0;
  ok('V82-5 1장 히어로(면적 ≥25%)', frac >= 0.25, `frac=${(frac * 100).toFixed(1)}%`);
  await ctx.close();
}

// ── V82-6) 리사이즈 리플로우 — 한 장을 키우면 나머지가 자리를 내준다 ──
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page, 'desktop');
  // v10 에디토리얼은 풀블리드라 '빈 곳 탭'이 성립하지 않는다(12,12가 사진 위다) —
  // 상시 어포던스 버튼이 결정적 진입점이다
  await page.getByRole('button', { name: /탭해서 편집/ }).first().click();
  await page.waitForTimeout(600);
  const imgs = bd.locator('img[data-photo]');
  const before = await imgs.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; }));
  // 두 번째 사진(1×1)의 ⤡ 핸들을 셀 하나만큼 끌어 2×2로
  const handle = bd.locator('div[data-resize-for]:not([data-resize-for^="sticker:"])').nth(1);
  const hb = await handle.boundingBox();
  // v10 — 사진이 커져(타이틀 밴드 예약 폐지) 예전 거리로 끌면 포인터가 보드 밖으로 나가
  // pointerup이 보드에 도달하지 않는다. 보드 안에 머무는 거리로 줄인다
  const grow = Math.min(before[1].w * 0.5, 120);
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + grow, hb.y + hb.height / 2 + grow, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await imgs.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; }));
  // ⚠️ 계약 재정의 (v10): 구 단언은 "폭이 최소 셀의 **정수배**로 스냅됐는가"였다.
  //    저스티파이드에는 정수 스팬이라는 개념 자체가 없다 — 폭은 원본 비율에 비례해 정해진다.
  //    조작의 실체는 "이 행에 사진이 몇 장인가"이므로, 끈 사진이 실제로 커졌는지를 단언한다.
  ok('V82-6a 리사이즈 → 끈 사진이 커진다', after[1].w > before[1].w * 1.1,
    `${Math.round(before[1].w)} → ${Math.round(after[1].w)}`);
  const othersMoved = before.some((b, i) => Math.abs(b.x - after[i].x) > 2 || Math.abs(b.y - after[i].y) > 2);
  ok('V82-6b 나머지 사진 자동 재배치', othersMoved);
  const layout = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')).collageDeviceLayouts?.desktop?.editorial);
  ok('V82-6c edited:true 저장', layout?.edited === true);
  await ctx.close();
}

// ── V82-7) 라이트박스 — 감상 모드 사진 탭 → 확대, 닫기 ──
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page, 'desktop');
  const img = await bd.locator('img[data-photo]').first().boundingBox();
  await page.mouse.click(img.x + img.width / 2, img.y + img.height / 2);
  await page.waitForTimeout(600);
  const dialog = page.getByRole('dialog', { name: '이미지 확대 보기' });
  ok('V82-7a 사진 탭 → 라이트박스', await dialog.isVisible().catch(() => false));
  ok('V82-7b 편집 진입 아님', (await page.getByRole('button', { name: '완료', exact: true }).count()) === 0);
  await dialog.getByRole('button', { name: '닫기' }).click();
  await page.waitForTimeout(400);
  ok('V82-7c 닫기', (await dialog.count()) === 0);
  await ctx.close();
}

// ── V82-8) 편집 진입 동선 ──
// ⚠️ 계약 반전 (v10): 구 'V82-8a 배경 탭 → 편집 진입'은 이제 **성립할 수 없다**.
//    에디토리얼이 풀블리드(외곽 여백 0)라 탭할 '배경'이 보드에 없다 — 어디를 눌러도 사진이다.
//    감상 모드의 사진 탭은 라이트박스(확대)가 맞고, 편집 진입은 상시 칩이 유일한 결정적 동선이다.
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page, 'desktop');
  const img = await bd.locator('img[data-photo]').first().boundingBox();
  await page.mouse.click(img.x + img.width / 2, img.y + img.height / 2);
  await page.waitForTimeout(600);
  ok('V82-8a 감상 모드 사진 탭 → 확대(편집 아님)',
    (await page.getByRole('button', { name: '완료', exact: true }).count()) === 0);
  await page.getByRole('dialog', { name: '이미지 확대 보기' }).getByRole('button', { name: '닫기' }).click();
  await page.waitForTimeout(400);
  const chip = page.getByRole('button', { name: '✎ 탭해서 편집' });
  ok('V82-8b 편집 칩 버튼 노출', await chip.isVisible().catch(() => false));
  await chip.click();
  await page.waitForTimeout(600);
  ok('V82-8c 칩 → 편집 진입', (await page.getByRole('button', { name: '완료', exact: true }).count()) === 1);
  await ctx.close();
}

// ── V82-9) scenes 라이트박스 회귀 — 공용 컴포넌트 마이그레이션 무손실 ──
{
  const { ctx, page } = await newPage(boardWithN(1), NARROW);
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(2000);
  await page.locator('button:has(img)').first().click();
  await page.waitForTimeout(600);
  const dialog = page.getByRole('dialog', { name: '이미지 확대 보기' });
  ok('V82-9a scenes 슬롯 → 라이트박스', await dialog.isVisible().catch(() => false));
  await dialog.getByRole('button', { name: '닫기' }).click();
  await page.waitForTimeout(300);
  ok('V82-9b 닫기', (await dialog.count()) === 0);
  await ctx.close();
}

await browser.close();
console.log('\n===== v8.2 검증 =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
