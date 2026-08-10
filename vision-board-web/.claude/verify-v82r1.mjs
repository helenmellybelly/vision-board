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

// ── V82-4) 18장 PC 모자이크 — 최소 셀 실측 ≥100px ──
{
  const { ctx, page } = await newPage(boardWithN(18), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const widths = await boardOf(page, 'desktop').locator('img').evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  const minW = Math.min(...widths);
  ok('V82-4 18장 최소 셀 ≥100px', widths.length === 18 && minW >= 100, `n=${widths.length} min=${minW.toFixed(0)}`);
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
  await bd.click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(600);
  const imgs = bd.locator('img');
  const before = await imgs.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; }));
  // 두 번째 사진(1×1)의 ⤡ 핸들을 셀 하나만큼 끌어 2×2로
  const handle = bd.locator('div[aria-label="크기 조절"]').nth(1);
  const hb = await handle.boundingBox();
  const grow = before[1].w * 1.1;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + grow, hb.y + hb.height / 2 + grow, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const after = await imgs.evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; }));
  // 리사이즈 시작 시 bringToFront로 z(=DOM 순서)가 바뀌므로 인덱스 비교 불가 — 넓은 사진(≥1.5×최소)
  // 개수가 1 늘었는지로 판정 (시드 n=6엔 히어로 [2,2]와 [2,1]이 이미 있다)
  const bigCount = (arr) => { const m = Math.min(...arr.map((r) => r.w)); return arr.filter((r) => r.w > m * 1.5).length; };
  ok('V82-6a 타깃 사진 확대(스팬 스냅)', bigCount(after) === bigCount(before) + 1, `before=${bigCount(before)} after=${bigCount(after)}`);
  const othersMoved = before.some((b, i) => Math.abs(b.x - after[i].x) > 2 || Math.abs(b.y - after[i].y) > 2);
  ok('V82-6b 나머지 사진 자동 재배치', othersMoved);
  const layout = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data')).collageDeviceLayouts?.desktop?.mosaic);
  ok('V82-6c edited:true 저장', layout?.edited === true);
  await ctx.close();
}

// ── V82-7) 라이트박스 — 감상 모드 사진 탭 → 확대, 닫기 ──
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page, 'desktop');
  const img = await bd.locator('img').first().boundingBox();
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

// ── V82-8) 배경 탭 → 편집 진입(기존 계약) + 편집 칩 버튼 ──
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const bd = boardOf(page, 'desktop');
  await bd.click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(600);
  ok('V82-8a 배경 탭 → 편집 진입', (await page.getByRole('button', { name: '완료', exact: true }).count()) === 1);
  await page.getByRole('button', { name: '완료', exact: true }).click();
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
