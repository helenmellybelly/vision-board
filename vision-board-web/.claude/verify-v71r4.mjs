// v7.1-r4 검증 — 사진 먼저 플로우(링크·배너·저장 분기·넛지 시트) + AI 힌트 게이트 + 추천 우선순위 + 복귀 인사
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
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
const doneBoard = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4, ...extra,
});

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
    }, seed);
  }
  return { ctx, page };
}

const readBoard = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? 'null'));

// ── 1+2) 사진 먼저 e2e: 질문 페이지 링크 → 배너 → 픽 → 저장 → 넛지 시트, dismiss 영속 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1800);
  ok('R4-1a 질문 페이지 사진 먼저 링크', await page.getByText('사진 먼저 담기').isVisible().catch(() => false));
  await page.getByText('사진 먼저 담기').click();
  await page.waitForTimeout(1500);
  ok('R4-1b 링크 → /scenes/1', new URL(page.url()).pathname === '/scenes/1', page.url());
  ok('R4-1c 넛지 배너', await page.getByText('이 사진들이 일기가 돼').isVisible().catch(() => false));

  // 큐레이션 픽 → 저장 → 넛지 시트
  await page.locator('button[aria-label*="비전보드에 담기"], button[aria-label="샘플 사진 담기"]').first().click();
  await page.waitForFunction(() => {
    const b = JSON.parse(localStorage.getItem('vision-board-data') ?? '{}');
    return !!b?.sections?.[1]?.uploadedImages?.[0];
  }, undefined, { timeout: 20000 }).catch(() => {});
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1500);
  ok('R4-1d 저장 → 사진 넛지 시트', await page.getByText('🌰 사진 담았어!').isVisible().catch(() => false));
  ok('R4-1e 시트에 이야기 CTA', (await page.getByText('내 이야기 들려주기').count()) > 0);
  const b1 = await readBoard(page);
  ok('R4-1f status=in_progress (not completed)', b1?.sections?.[1]?.status === 'in_progress', `status=${b1?.sections?.[1]?.status}`);
  ok('R4-1g 사진 영속', !!b1?.sections?.[1]?.uploadedImages?.[0]);

  // 시트 닫고 배너 dismiss → 리로드 후 미재노출
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.getByLabel('안내 닫기').click();
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForTimeout(1500);
  ok('R4-2 배너 dismiss 영속', (await page.getByText('이 사진들이 일기가 돼').count()) === 0);
  await ctx.close();
}

// ── 3) AI 힌트 게이트 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByText('더 찾아보기').click();
  await page.waitForTimeout(500);
  ok('R4-3a 무답변 → 힌트 게이트 링크', await page.getByText('네 이야기를 들려주면 어울리는 사진 힌트').isVisible().catch(() => false));
  ok('R4-3b 무답변 → 토리 힌트 버튼 없음', (await page.getByText('토리에게 힌트 받기').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete({ sceneText: '하루', miniStory: '스토리.' }) }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByText('더 찾아보기').click();
  await page.waitForTimeout(500);
  ok('R4-3c 답변有 → 토리 힌트 버튼', await page.getByText('토리에게 힌트 받기').isVisible().catch(() => false));
  ok('R4-3d 답변有 → 배너 없음', (await page.getByText('이 사진들이 일기가 돼').count()) === 0);

  // 4) 답변有 저장 → 기존 완료 시트 회귀
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1500);
  ok('R4-4 답변有 저장 → 완료 시트', (await page.getByText('완성!').count()) > 0);
  await ctx.close();
}

// ── 5) 추천 카드 열린 고리 우선순위 + 미시작 셀 양경로 시트 ──
{
  const { ctx, page } = await newPage(doneBoard({
    3: { status: 'in_progress', uploadedImages: [PIXEL, null, null, null, null] },
  }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R4-5a 열린 고리 부캡션', await page.getByText('사진은 담았는데 이야기가 비어 있어').isVisible().catch(() => false));
  ok('R4-5b 추천 타깃 = 관계(3)', await page.getByText('관계 →').isVisible().catch(() => false));

  // 미시작 셀(나, 1) 탭 → 양경로 시트
  await page.locator('button[aria-label="나 — 시작 전"]').click();
  await page.waitForTimeout(600);
  ok('R4-5c 양경로 시트', await page.getByText('어떻게 시작할까?').isVisible().catch(() => false));
  await page.getByText('📷 사진부터 골라볼래').click();
  await page.waitForTimeout(1200);
  ok('R4-5d 사진 경로 → /scenes/1', new URL(page.url()).pathname === '/scenes/1', page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.locator('button[aria-label="나 — 시작 전"]').click();
  await page.waitForTimeout(600);
  await page.getByText('✍️ 질문에 답하며 시작').click();
  await page.waitForTimeout(1200);
  ok('R4-5e 질문 경로 → /section/1', new URL(page.url()).pathname === '/section/1', page.url());
  await ctx.close();
}

// ── 6) 복귀 인사 갭 분기 ──
{
  const { ctx, page } = await newPage(doneBoard({}, { lastVisitAt: Date.now() - 3 * 24 * 3600 * 1000 }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R4-6a 3일 갭 → 복귀 인사', await page.getByText('다시 왔네, 헬렌아!').isVisible().catch(() => false));
  const b = await readBoard(page);
  ok('R4-6b lastVisitAt 갱신', Date.now() - (b?.lastVisitAt ?? 0) < 60_000);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}, { lastVisitAt: Date.now() - 3600 * 1000 }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R4-6c 1시간 갭 → 기본 헤더', await page.getByText('정원사 토리와 함께').isVisible().catch(() => false));
  await ctx.close();
}

// ── 7) 사진만 섹션 정합: 텍스트 진행바 미포함·미니보드 셀 채움·ProcessBar 4단계 잠금 ──
{
  const { ctx, page } = await newPage(doneBoard({
    3: { status: 'in_progress', uploadedImages: [PIXEL, null, null, null, null] },
  }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('R4-7a 텍스트 진행바 미노출(0/6)', (await page.getByText('채워짐').count()) === 0);
  const cellImg = await page.locator('button[aria-label^="관계 — "] img').count();
  ok('R4-7b 미니보드 셀 사진 채움', cellImg > 0, `imgs=${cellImg}`);
  const step4 = page.locator('button', { hasText: '완성' }).last();
  ok('R4-7c ProcessBar 4단계 잠금', await step4.isDisabled().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.1-r4 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
