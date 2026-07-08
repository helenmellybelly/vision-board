// v7.1-r1 검증 — 온보딩 카피 개편(여정 예고·너 그거 아니 톤) + Step3 위아래 동시 대비 + 무스크롤
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch();

async function newPage(seed, viewport = { width: 375, height: 667 }) {
  const ctx = await browser.newContext({ viewport });
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

const noScroll = (page) =>
  page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2);

// ── 1) 스텝1: 여정 예고 문장 + 이름 입력 → 스텝2, 각 스텝 무스크롤(375×667) ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/1`);
  await page.waitForTimeout(1500);
  ok('R1-1a 여정 예고 문장 제거', (await page.getByText('그다음엔 우리 같이 비전보드를 만들 거야').count()) === 0);
  ok('R1-1b 이름 질문(새 카피)', (await page.getByText('너를 뭐라고 불러주면 좋을까?').count()) > 0);
  ok('R1-4a 스텝1 무스크롤', await noScroll(page));
  await page.getByPlaceholder('이름 또는 닉네임').fill('헬렌');
  await page.getByText('이렇게 불러줘').click();
  await page.waitForTimeout(1200);
  ok('R1-1c 이름 입력 → 스텝2', new URL(page.url()).pathname === '/onboarding/2', page.url());

  // ── 2) 스텝2: '헬렌아, 도토리도...' josa + 탭 2회 → 스텝3 (v7.3 문안 교체) ──
  ok('R1-2a 첫 버블 josa+훅', (await page.getByText('헬렌아, 도토리도 땅에 심겨야').count()) > 0);
  ok('R1-4b 스텝2 무스크롤', await noScroll(page));
  await page.getByText('도토리도 땅에 심겨야').click();
  await page.waitForTimeout(400);
  ok('R1-2b 두번째 버블(헬렌이라는·비옥한 땅)', (await page.getByText('헬렌이라는 도토리를 비옥한 땅에').count()) > 0);
  await page.getByText('우리도 도토리랑 같아').click();
  await page.waitForTimeout(400);
  ok('R1-2c 세번째 버블(함께 만들자)', (await page.getByText('우리 함께 비전보드를 만들어 볼까?').count()) > 0);
  await page.getByText('그래, 함께 해보자!').click();
  await page.waitForTimeout(1200);
  ok('R1-2d 스텝3 진입', new URL(page.url()).pathname === '/onboarding/3', page.url());

  // ── 3) 스텝3: 두 라벨 동시 visible + 무스크롤 → 완료 → 대시보드 인트로 시트 ──
  const vagueVisible = await page.getByText('막연한 바람').isVisible().catch(() => false);
  const vividVisible = await page.getByText('생생한 장면').isVisible().catch(() => false);
  ok('R1-3a 두 라벨 동시 표시', vagueVisible && vividVisible, `vague=${vagueVisible} vivid=${vividVisible}`);
  ok('R1-3b 새 제목', (await page.getByText('막연함과 선명함, 뭐가 다를까?').count()) > 0);
  ok('R1-3c 커넥터', (await page.getByText('선명하게 바꾸면').count()) > 0);
  ok('R1-4c 스텝3 무스크롤', await noScroll(page));
  await page.getByText('비전보드 시작하기').click();
  await page.waitForTimeout(1500);
  ok('R1-5a 완료 → /dashboard', new URL(page.url()).pathname === '/dashboard', page.url());
  ok('R1-5b 인트로 시트(첫 진입)', (await page.getByText('6칸짜리 정원이야').count()) > 0);
  await ctx.close();
}

// ── 6) 영문 이름 josa 무받침 폴백 무크래시 ──
{
  const { ctx, page } = await newPage({
    sections: Object.fromEntries(
      Array.from({ length: 6 }, (_, i) => [i + 1, {
        id: i + 1, status: 'not_started', currentPhase: 1, currentSlotIndex: 0, images: [],
      }])
    ),
    onboardingDone: false, onboardingStep: 2, userName: 'Helen', startedAt: Date.now(), schemaVersion: 4,
  });
  await page.goto(`${BASE}/onboarding/2`);
  await page.waitForTimeout(1500);
  ok('R1-6 영문 이름 Helen야 렌더', (await page.getByText('Helen야, 도토리도 땅에 심겨야').count()) > 0);
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.1-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
