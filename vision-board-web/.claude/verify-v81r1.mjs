// v8.1 Slice 1 검증 — 무변경 수정 플로우·완주 후 대시보드·/scenes URL 게이트·merge 유실 가드
// 계약: completed는 재진입·답변 편집으로 강등되지 않는다. 무변경 진행 = 검증 0회·경고 0회·기존 일기 그대로.
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
const textComplete = (extra = {}) =>
  ({ status: 'text_complete', extractedSlots: { ...FULL_EXTRACTED }, ...extra });
const withPhoto = (extra = {}) =>
  textComplete({ sceneText: '하루', miniStory: '기존 일기야.', status: 'completed', uploadedImages: [PIXEL, null, null], ...extra });
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});

const browser = await chromium.launch();

async function newPage(seed, viewport = { width: 390, height: 844 }) {
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

const readSection = (page, id) =>
  page.evaluate((sid) => JSON.parse(localStorage.getItem('vision-board-data')).sections[sid], id);

// ── A-1) 완료 섹션 무변경 재진입 → 검증 0회·바로 /scene·completed 유지·기존 일기 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  let validateCalls = 0;
  await page.route('**/api/validate/answers', (route) => {
    validateCalls += 1;
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: {} }) });
  });
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1800);
  const cleanCta = page.getByRole('button', { name: '미래 일기 보러 가기 →', exact: true });
  ok('A-1a clean CTA 라벨', await cleanCta.isVisible().catch(() => false));
  await cleanCta.click();
  await page.waitForURL('**/scene/1', { timeout: 8000 }).catch(() => {});
  ok('A-1b 바로 /scene 이동', page.url().includes('/scene/1'));
  await page.waitForTimeout(1500);
  ok('A-1c 검증 호출 0회', validateCalls === 0, `calls=${validateCalls}`);
  ok('A-1d 기존 일기 그대로', await page.getByText('기존 일기야.').isVisible().catch(() => false));
  const sec = await readSection(page, 1);
  ok('A-1e completed 유지', sec.status === 'completed', `status=${sec.status}`);
  await ctx.close();
}

// ── A-2) 동일값 저장 → 배너·저장 없이 편집만 닫힘 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '수정', exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(400);
  ok('A-2a 배너 없음', (await page.getByText('답이 바뀌었네').count()) === 0);
  ok('A-2b 편집 닫힘', (await page.locator('textarea').count()) === 0);
  ok('A-2c clean CTA 유지', await page.getByRole('button', { name: '미래 일기 보러 가기 →', exact: true }).isVisible().catch(() => false));
  await ctx.close();
}

// ── A-3) 변경 저장 → 선택지 배너 → '그대로 둘래' → 일기 불변·dirty CTA ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '수정', exact: true }).first().click();
  const ta = page.locator('textarea');
  const original = await ta.inputValue();
  await ta.fill('느긋하게 사는 사람이야');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(400);
  ok('A-3a 선택지 배너', await page.getByText('답이 바뀌었네').isVisible().catch(() => false));
  ok('A-3b 사진 유지 카피', await page.getByText('사진은 그대로 있어').isVisible().catch(() => false));
  await page.getByRole('button', { name: '그대로 둘래', exact: true }).click();
  await page.waitForTimeout(300);
  ok('A-3c 배너 닫힘', (await page.getByText('답이 바뀌었네').count()) === 0);
  ok('A-3d dirty CTA 전환', await page.getByRole('button', { name: '이 답들로 미래 일기 써보기 →', exact: true }).isVisible().catch(() => false));
  let sec = await readSection(page, 1);
  ok('A-3e 일기·사진 불변', sec.miniStory === '기존 일기야.' && sec.uploadedImages?.[0] === PIXEL);
  ok('A-3f completed 유지', sec.status === 'completed', `status=${sec.status}`);

  // ── A-5) 원래 값으로 되돌리면 자동 clean ──
  await page.getByRole('button', { name: '수정', exact: true }).first().click();
  await page.locator('textarea').fill(original);
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(400);
  ok('A-5 되돌리면 clean CTA', await page.getByRole('button', { name: '미래 일기 보러 가기 →', exact: true }).isVisible().catch(() => false));
  await ctx.close();
}

// ── A-4) '새 답으로 다시 쓸래' → /scene?rewrite=1 자동 재생성(모킹)·사진 불변 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.route('**/api/story/section', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ story: '새 일기야.' }) })
  );
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '수정', exact: true }).first().click();
  await page.locator('textarea').fill('느긋하게 사는 사람이야');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '새 답으로 다시 쓸래 →', exact: true }).click();
  await page.waitForURL('**/scene/1**', { timeout: 8000 }).catch(() => {});
  ok('A-4a /scene 이동', page.url().includes('/scene/1'));
  await page.waitForTimeout(2000);
  ok('A-4b 재생성된 일기 표시', await page.getByText('새 일기야.').isVisible().catch(() => false));
  const sec = await readSection(page, 1);
  ok('A-4c 일기 저장·사진 불변', sec.miniStory === '새 일기야.' && sec.uploadedImages?.[0] === PIXEL);
  ok('A-4d rewrite 파라미터 소비', !page.url().includes('rewrite=1'));
  await ctx.close();
}

// ── A-6) 강등 가드 — dirty 진행으로 브리지→완료 버튼을 눌러도 completed 유지 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.route('**/api/validate/answers', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ results: {} }) })
  );
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '수정', exact: true }).first().click();
  await page.locator('textarea').fill('느긋하게 사는 사람이야');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: '그대로 둘래', exact: true }).click();
  await page.getByRole('button', { name: '이 답들로 미래 일기 써보기 →', exact: true }).click();
  await page.waitForTimeout(1200);
  const bridgeBtn = page.getByRole('button', { name: '미래 일기 써보기 →', exact: true });
  ok('A-6a 브리지 노출(dirty 경로)', await bridgeBtn.isVisible().catch(() => false));
  await bridgeBtn.click();
  await page.waitForURL('**/scene/1', { timeout: 8000 }).catch(() => {});
  const sec = await readSection(page, 1);
  ok('A-6b 강등 가드: completed 유지', sec.status === 'completed', `status=${sec.status}`);
  await ctx.close();
}

// ── B) 완주 후 대시보드 — 주 CTA /collage·보조 링크·다크 CTA 1개·walkCaption ──
{
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto();
  const { ctx, page } = await newPage(
    // finishCelebrated: 축하 파티클 1회 연출이 스위트 타이밍을 흔들지 않게 시드에서 억제 (v8.3)
    board(overrides, { futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 6, oneSentence: '여유로운 사람.', finishCelebrated: true })
  );
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('B-1a 완주 주 CTA', await page.getByRole('button', { name: '완성한 내 비전보드 보기 →', exact: true }).isVisible().catch(() => false));
  ok('B-1b 보조 일기 링크', await page.getByRole('button', { name: '📖 미래 일기 읽기 →', exact: true }).isVisible().catch(() => false));
  ok('B-2a 구 CTA 부재', (await page.getByText('비전보드 완성하러 가기').count()) === 0);
  ok('B-2b 다른 다크 CTA 부재', (await page.getByText('다 됐다, 이제').count()) + (await page.getByText('첫 보드가 열렸어').count()) + (await page.getByText('보드가 더 자랐네').count()) === 0);
  ok('B-2c 중복 🖼️ 버튼 부재', (await page.getByText('🖼️ 내 비전보드 보기').count()) === 0);
  // v8.5 — 완주 walkCaption 삭제 (오너: "길 끝까지 다 걸어서 …" 군더더기 표현 제거)
  ok('B-3 walkCaption 완주 분기 부재', (await page.getByText('길 끝까지 다 걸었어').count()) === 0);
  await page.getByRole('button', { name: '완성한 내 비전보드 보기 →', exact: true }).click();
  await page.waitForURL('**/collage**', { timeout: 8000 }).catch(() => {});
  ok('B-4 주 CTA → /collage', page.url().includes('/collage'));
  await ctx.close();
}

// ── B-5) 회귀: 6칸 완성이지만 스토리 없음 → 기존 '완성하러 가기' 유지 ──
{
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto();
  const { ctx, page } = await newPage(board(overrides));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('B-5 스토리 없으면 기존 CTA', await page.getByText('비전보드 완성하러 가기 →').isVisible().catch(() => false));
  await ctx.close();
}

// ── C) /scenes URL 게이트 ──
{
  const { ctx, page } = await newPage(board({}));
  await page.route('**invalid.example**', (route) => route.abort());
  await page.route('**/api/image/proxy**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /이미지 주소\(URL\)로 담기/ }).click();
  const input = page.getByPlaceholder('이미지 URL 주소 붙여넣기');

  // C-1 핀 페이지 주소 차단
  await input.fill('https://kr.pinterest.com/pin/1234567890/');
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(400);
  ok('C-1a 핀 주소 차단 안내', await page.getByText('그건 핀 페이지 주소야').isVisible().catch(() => false));
  let sec = await readSection(page, 1);
  ok('C-1b 저장 안 됨', !(sec.uploadedImages ?? []).some(Boolean));

  // C-2 로드 실패 URL 차단 (직접 로드·프록시 폴백 모두 실패)
  await input.fill('https://invalid.example/broken.jpg');
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(3000);
  ok('C-2a 실패 URL 차단 안내', await page.getByText('이 주소에선 사진을 못 불러왔어').isVisible().catch(() => false));
  sec = await readSection(page, 1);
  ok('C-2b 저장 안 됨', !(sec.uploadedImages ?? []).some(Boolean));

  // C-3 정상 이미지(데이터 URL)는 저장
  await input.fill(PIXEL);
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(1000);
  sec = await readSection(page, 1);
  ok('C-3 정상 이미지 저장', sec.uploadedImages?.[0] === PIXEL);
  await ctx.close();
}

// ── D-1) merge: 답변만 있는 로컬 보드는 meaningful → 자동 useServer 대신 ask ──
{
  let pass = false;
  let detail = '';
  try {
    const out = mkdtempSync(join(tmpdir(), 'vb-merge-'));
    execSync(
      `npx tsc lib/merge.ts --outDir ${out} --module esnext --target es2020 --moduleResolution bundler --skipLibCheck`,
      { cwd: process.cwd(), stdio: 'pipe' }
    );
    const { decideMerge } = await import(pathToFileURL(join(out, 'merge.js')).href);
    const mkBoard = (sec) => ({ sections: { 1: sec }, lastVisitAt: 10 });
    const localAnswersOnly = mkBoard({ id: 1, status: 'in_progress', extractedSlots: { current: '답변' } });
    const serverMeaningful = mkBoard({ id: 1, status: 'completed', miniStory: '스토리' });
    const d1 = decideMerge(localAnswersOnly, serverMeaningful, 99);
    const localDeferredOnly = mkBoard({ id: 1, status: 'in_progress', deferredSlots: ['want'] });
    const d2 = decideMerge(localDeferredOnly, serverMeaningful, 99);
    const localEmpty = mkBoard({ id: 1, status: 'not_started' });
    const d3 = decideMerge(localEmpty, serverMeaningful, 99);
    pass = d1.action === 'ask' && d2.action === 'ask' && d3.action === 'useServer';
    detail = `answers=${d1.action} deferred=${d2.action} empty=${d3.action}`;
  } catch (e) {
    detail = String(e).slice(0, 120);
  }
  ok('D-1 답변 보드 meaningful → ask', pass, detail);
}

await browser.close();
console.log('\n===== v8.1 Slice 1 검증 =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
