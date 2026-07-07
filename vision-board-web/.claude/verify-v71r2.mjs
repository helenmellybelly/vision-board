// v7.1-r2 검증 — 추천 사진 토글: 픽→source 기록, 재탭→해제, 슬롯 ×→갤러리 반영, 벌크 저장 source 보존, 레거시 무해
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PX_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedBoard(section1Extra = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = { id, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [] };
  }
  Object.assign(sections[1], {
    status: 'text_complete', sceneText: '하루', miniStory: '스토리.',
    extractedSlots: { current: '지금', keyword: '여유', want: '원해', feeling: '기분' },
    ...section1Extra,
  });
  return {
    sections, onboardingDone: true, dashboardIntroSeen: true, userName: '헬렌',
    startedAt: Date.now(), schemaVersion: 4,
  };
}

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
const sec1 = async (page) => (await readBoard(page))?.sections?.[1];

// ── 메인 토글 시나리오 (한 컨텍스트에서 순차) ──
{
  const { ctx, page } = await newPage(seedBoard());
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);

  // 1) 픽 → 슬롯 + source id 기록
  await page.locator('button[aria-label*="비전보드에 담기"], button[aria-label="샘플 사진 담기"]').first().click();
  await page.waitForFunction(() => {
    const b = JSON.parse(localStorage.getItem('vision-board-data') ?? '{}');
    return !!b?.sections?.[1]?.uploadedImageSources?.[0];
  }, undefined, { timeout: 20000 }).catch(() => {});
  let s = await sec1(page);
  const pickedId = s?.uploadedImageSources?.[0];
  ok('R2-1a 픽 → 슬롯 채움', !!s?.uploadedImages?.[0]);
  ok('R2-1b source id 기록', typeof pickedId === 'string' && pickedId.length > 0, `id=${pickedId}`);
  await page.waitForTimeout(300);
  ok('R2-1c 담았어 오버레이', (await page.getByText('탭해서 빼기').count()) > 0);

  // 2) 재탭 → 해제
  await page.locator('button[aria-label*="보드에서 빼기"]').first().click();
  await page.waitForTimeout(800);
  s = await sec1(page);
  ok('R2-2a 재탭 → 슬롯 빈', !s?.uploadedImages?.[0]);
  ok('R2-2b source null', !s?.uploadedImageSources?.[0]);
  ok('R2-2c 오버레이 소멸', (await page.getByText('탭해서 빼기').count()) === 0);

  // 3) 다시 픽 → 슬롯 ×로 제거 → 갤러리 반영
  await page.locator('button[aria-label*="비전보드에 담기"], button[aria-label="샘플 사진 담기"]').first().click();
  await page.waitForFunction(() => {
    const b = JSON.parse(localStorage.getItem('vision-board-data') ?? '{}');
    return !!b?.sections?.[1]?.uploadedImageSources?.[0];
  }, undefined, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: '×' }).first().click();
  await page.waitForTimeout(800);
  s = await sec1(page);
  ok('R2-3a 슬롯 × → 슬롯 빈', !s?.uploadedImages?.[0]);
  ok('R2-3b 슬롯 × → 갤러리 오버레이 해제', (await page.getByText('탭해서 빼기').count()) === 0);

  // 4) URL 수동 입력 → source null 유지
  await page.getByText('더 찾아보기').click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder('이미지 URL 주소 붙여넣기').fill(PX_GIF);
  await page.getByText('불러오기').click();
  await page.waitForTimeout(600);
  s = await sec1(page);
  ok('R2-4a URL 업로드 → 슬롯 채움', s?.uploadedImages?.[0] === PX_GIF);
  ok('R2-4b URL 업로드 → source null', !s?.uploadedImageSources?.[0]);

  // 5) 큐레이션 1장 더(슬롯1) + 저장(벌크) → source 보존
  await page.locator('button[aria-label*="비전보드에 담기"], button[aria-label="샘플 사진 담기"]').first().click();
  await page.waitForFunction(() => {
    const b = JSON.parse(localStorage.getItem('vision-board-data') ?? '{}');
    return !!b?.sections?.[1]?.uploadedImageSources?.[1];
  }, undefined, { timeout: 20000 }).catch(() => {});
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1500);
  s = await sec1(page);
  ok('R2-5a 벌크 저장 후 source 보존', typeof s?.uploadedImageSources?.[1] === 'string' && s.uploadedImageSources[1].length > 0);
  ok('R2-5b 완료 시트 회귀', (await page.getByText('완성!').count()) > 0);
  await ctx.close();
}

// ── 6) 레거시(출처 없는) 시드 무해성 ──
{
  const { ctx, page } = await newPage(seedBoard({
    uploadedImages: [PX_GIF, null, null, null, null],
    // uploadedImageSources 없음 = v7.0 레거시
  }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  ok('R2-6a 레거시 렌더', (await page.getByText('샘플에서 고르기').count()) > 0);
  ok('R2-6b 레거시 갤러리 전부 idle', (await page.getByText('탭해서 빼기').count()) === 0);
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.1-r2 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
