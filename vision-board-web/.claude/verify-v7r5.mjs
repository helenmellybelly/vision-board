// v7.0-r5 검증 — /board→/collage 통합·기기 선택 퍼스트·대시보드 미니보드·완료 시트/피날레 peak
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '.claude/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      id, status: 'in_progress', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [],
    };
  }
  for (const [id, extra] of Object.entries(overrides)) {
    Object.assign(sections[id], extra);
  }
  return sections;
}

const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };

function textComplete(extra = {}) {
  return { status: 'text_complete', slots: {}, extractedSlots: { ...FULL_EXTRACTED }, ...extra };
}

const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const browser = await chromium.launch();

async function newPage(seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
  if (seed) {
    await page.addInitScript((data) => {
      if (!localStorage.getItem('vision-board-data')) {
        localStorage.setItem('vision-board-data', JSON.stringify(data));
      }
      localStorage.setItem('vb-collage-coach-v1', '1'); // 코치마크 억제
    }, seed);
  }
  return { ctx, page };
}

const doneBoard = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', ...extra,
});

const withPhoto = (extra = {}) =>
  textComplete({ sceneText: '하루', miniStory: '스토리.', status: 'completed', uploadedImages: [PIXEL, null, null, null, null], ...extra });

// ── 1·2) /collage 진입 즉시 보드 + 토글 (v7.2 한 화면 통합 — 구 choose 케이스를 재정의) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  // v7.3: 기본 뷰가 PC
  ok('R5-1a 진입 즉시 PC 탭 활성 (v7.3 기본)', await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('R5-1b 템플릿 셀렉터 노출', await page.getByText('폴라로이드').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r5-collage-unified.png`, fullPage: true });
  await page.getByRole('radio', { name: '📱 폰' }).click();
  await page.waitForTimeout(500);
  // v7.3: 빈 피커 대신 표준 프리셋 자동 선택 + 상시 칩 행
  ok('R5-1e 폰 탭 → 기본 폰 자동 선택', await page.getByRole('radio', { name: '기본 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  // R5-2: 뒤로가기는 대시보드로 (choose 왕복 단언은 v7.2에서 삭제)
  await page.getByLabel('대시보드로 돌아가기').click();
  await page.waitForTimeout(800);
  ok('R5-2c ← → 대시보드', new URL(page.url()).pathname === '/dashboard', page.url());
  await ctx.close();
}

// ── 3) 재방문: 저장된 프리셋 → 폰 탭에서 사이즈 칩 표시 (구 '지난번:' 부제를 재정의) ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }, {
    collageDevicePresets: { phone: 'iphone' }, // 실존 프리셋 id — 구 'iphone-pro'는 미존재라 칩이 안 뜬다
  }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  await page.getByRole('radio', { name: '📱 폰' }).click();
  await page.waitForTimeout(500);
  // v7.3: '사이즈 바꾸기' 패널 제거 — 저장된 프리셋이 상시 칩 행에서 선택 상태
  ok('R5-3 저장된 프리셋 → iPhone 칩 선택', await page.getByRole('radio', { name: 'iPhone', exact: true }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  await ctx.close();
}

// ── 4) /board 스텁 — v7.1에서 철거됨 (배포 1사이클 유예 종료), 404 확인으로 대체 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  const res = await page.goto(`${BASE}/board`);
  ok('R5-4 /board 스텁 철거 (404)', res?.status() === 404, `status=${res?.status()}`);
  await ctx.close();
}

// ── 5) 대시보드 미니보드 + goal-gradient 카피 + 사진 채움 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R5-5a 미니보드 렌더 (Vision Board)', await page.getByText('Vision Board').isVisible().catch(() => false));
  // v7.3: 연도 캡션('2029년의 나를...')과 다중 매칭 — first()로 확인
  ok('R5-5b 중앙 연도 = targetDate', await page.getByText('2029').first().isVisible().catch(() => false));
  // v7.2 'N/6 피었어' → v7.4 개화 카피 제거 + 부분 가치('1칸만 있어도 네 보드야')
  ok('R5-5c 진행 캡션(부분 가치)', await page.getByText('1칸만 있어도 네 보드야').isVisible().catch(() => false));
  const photoCount = await page.locator('img[alt="나"]').count();
  ok('R5-5d 완료 섹션 칸에 사진', photoCount >= 1, `imgs=${photoCount}`);
  // v7.2: 단일 진입 버튼 '내 비전보드 보기' → 보드 뷰 직행
  await page.getByText('내 비전보드 보기').click();
  await page.waitForTimeout(1500);
  ok('R5-5e 미니보드 탭 → /collage', new URL(page.url()).pathname === '/collage', page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R5-5f 0칸 카피', await page.getByText('질문에 답하고 사진을 담으면').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r5-dashboard-miniboard.png`, fullPage: true });
  await ctx.close();
}

// ── 6) /scenes 완료 시트에 미니보드 스냅샷 ──
{
  const { ctx, page } = await newPage(doneBoard({
    1: textComplete({ sceneText: '하루', miniStory: '스토리.', uploadedImages: [PIXEL, PIXEL, PIXEL, null, null] }),
  }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('R5-6a 완료 시트 미니보드 카피', await page.getByText('방금 이 칸이 채워졌어').isVisible().catch(() => false));
  ok('R5-6b 시트 안 미니보드', await page.getByText('Vision Board').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r5-complete-sheet.png`, fullPage: true });
  await ctx.close();
}

// ── 7) ProcessBar step3 목적지 회귀 — 전부 완성이면 /collage ──
{
  const all = {};
  for (let id = 1; id <= 6; id++) all[id] = withPhoto();
  const { ctx, page } = await newPage(doneBoard(all));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByText('사진 담기').click();
  await page.waitForTimeout(1500);
  ok('R5-7 ProcessBar 사진담기(전부 완성) → /collage', new URL(page.url()).pathname === '/collage', page.url());
  await ctx.close();
}

// ── 8) 기존 collageDeviceLayouts 무손실 (v6.19 마이그레이션 회귀) ──
{
  const layout = { items: { '1-0': { x: 0.1, y: 0.1, w: 0.4, z: 1 } }, aspect: 1170 / 2532 };
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }, {
    collageDevicePresets: { phone: 'phone' },
    collageDeviceLayouts: { phone: { polaroid: layout } },
  }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  const board = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? 'null'));
  const saved = board?.collageDeviceLayouts?.phone?.polaroid?.items?.['1-0'];
  ok('R5-8 기존 기기 배치 무손실', saved?.x === 0.1 && saved?.w === 0.4);
  await ctx.close();
}

// ── 9) /finish 피날레 미니보드 리빌 + CTA → /collage ──
{
  const all = {};
  for (let id = 1; id <= 6; id++) all[id] = withPhoto();
  const { ctx, page } = await newPage(doneBoard(all, {
    oneSentence: '내 페이스로 사는 3년 뒤.',
    futureDayStory: '미래의 하루 이야기.',
  }));
  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1500);
  // futureDayStory 있으면 story 단계 → 완성 확정
  await page.getByText('비전보드 완성 →').click();
  await page.waitForTimeout(1000);
  ok('R5-9a 피날레 미니보드 리빌', await page.getByText('Vision Board').isVisible().catch(() => false));
  await page.getByText('내 비전보드 보러 가기').click();
  await page.waitForTimeout(1500);
  ok('R5-9b 피날레 CTA → /collage', new URL(page.url()).pathname === '/collage', page.url());
  await page.screenshot({ path: `${OUT}/v7r5-finish.png`, fullPage: true });
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.0-r5 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
