// v7.0-r1 검증 — 랜딩 제거·온보딩 3스텝 URL 분리·대시보드 6영역 인트로·schemaVersion 마이그레이션(v1)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '.claude/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections() {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      id, status: 'in_progress', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [],
    };
  }
  return sections;
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

// ── 1) 빈 상태: / → /onboarding/1 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  ok('R1-1 빈 상태 / → /onboarding/1', new URL(page.url()).pathname === '/onboarding/1', page.url());
  await ctx.close();
}

// ── 2) 레거시 Act4 시드(schemaVersion 없음) → v1 리맵으로 /onboarding/3 + schemaVersion 1 기록 ──
{
  const { ctx, page } = await newPage({
    sections: seedSections(), onboardingDone: false, onboardingStep: 4,
    userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  ok('R1-2a 레거시 step:4 → /onboarding/3 (v1 리맵)', new URL(page.url()).pathname === '/onboarding/3', page.url());
  const board = await readBoard(page);
  // 이후 라운드가 버전을 올리므로 >=1로 확인 (v1 리맵이 실행됐다는 사실은 R1-2c가 보장)
  ok('R1-2b schemaVersion 기록(>=1)', (board?.schemaVersion ?? 0) >= 1, `schemaVersion=${board?.schemaVersion}`);
  ok('R1-2c onboardingStep 리맵값 3', board?.onboardingStep === 3, `step=${board?.onboardingStep}`);
  await ctx.close();
}

// ── 3) 완료자: / → /dashboard + 마이그레이션이 dashboardIntroSeen 스탬프 → 인트로 시트 미노출 ──
{
  const { ctx, page } = await newPage({
    sections: seedSections(), onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  ok('R1-3a 완료자 / → /dashboard', new URL(page.url()).pathname === '/dashboard', page.url());
  const introVisible = await page.getByText('이제 진짜 시작이야').isVisible().catch(() => false);
  ok('R1-3b 기존 완료자에게 인트로 시트 미노출 (v1 스탬프)', !introVisible);
  const board = await readBoard(page);
  ok('R1-3c dashboardIntroSeen=true 마이그레이션', board?.dashboardIntroSeen === true);
  await ctx.close();
}

// ── 4~6) 신규 사용자 전체 플로우: 이름 → back → 도토리 2탭 → 비교 → 대시보드 + 인트로 시트 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/1`);
  await page.waitForTimeout(1200);
  ok('R1-4a 스텝1 이름 질문 렌더', await page.getByText('뭐라고 불러주면 좋을까').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r1-step1.png`, fullPage: true });

  await page.getByPlaceholder('이름 또는 닉네임').fill('헬렌');
  await page.getByText('이렇게 불러줘').click();
  await page.waitForTimeout(1200);
  ok('R1-4b 이름 저장 → /onboarding/2', new URL(page.url()).pathname === '/onboarding/2', page.url());

  await page.goBack();
  await page.waitForTimeout(1000);
  ok('R1-4c 브라우저 back → /onboarding/1 복귀', new URL(page.url()).pathname === '/onboarding/1', page.url());
  ok('R1-4d 복귀 시 이름 프리필', (await page.getByPlaceholder('이름 또는 닉네임').inputValue().catch(() => '')) === '헬렌');

  await page.getByText('이렇게 불러줘').click();
  await page.waitForTimeout(1200);

  // 스텝2: 도토리 메시지 3개 — 탭 2회로 전부 공개
  ok('R1-5a 도토리 첫 메시지(조사 처리)', await page.getByText('헬렌아, 너 그거 아니?').isVisible().catch(() => false));
  await page.getByText('계속하려면 탭').click();
  await page.waitForTimeout(500);
  await page.getByText('계속하려면 탭').click();
  await page.waitForTimeout(500);
  ok('R1-5b 탭 2회 → 마지막 메시지(심을 땅)', await page.getByText('너를 심을 땅이야').isVisible().catch(() => false));
  const cta2 = page.getByText('그 가능성, 꺼내볼게');
  ok('R1-5c 탭 2회 → CTA 노출', await cta2.isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r1-step2.png`, fullPage: true });
  await cta2.click();
  await page.waitForTimeout(1200);

  // 스텝3: 비교 카드 + 정의 + CTA
  ok('R1-6a /onboarding/3 진입', new URL(page.url()).pathname === '/onboarding/3', page.url());
  ok('R1-6b 막연함과 선명함 타이틀', await page.getByText('막연함과 선명함, 뭐가 다를까?').isVisible().catch(() => false));
  ok('R1-6c 비전보드 정의 통합', await page.getByText('너만의 지도').isVisible().catch(() => false));
  ok('R1-6d VISION_CARDS 삭제 확인', !(await page.getByText('비전보드를 하면 좋은 이유').isVisible().catch(() => false)));
  await page.screenshot({ path: `${OUT}/v7r1-step3.png`, fullPage: true });

  await page.getByText('비전보드 시작하기').click();
  await page.waitForTimeout(1500);
  ok('R1-6e 완료 → /dashboard', new URL(page.url()).pathname === '/dashboard', page.url());
  ok('R1-6f 인트로 시트 노출(이제 진짜 시작)', await page.getByText('이제 진짜 시작이야').isVisible().catch(() => false));
  // 시트와 대시보드 카드 양쪽에 같은 부제가 있어 다중 매칭 — first()로 확인
  ok('R1-6g 6영역 카드(몸·마음·에너지)', await page.getByText('몸·마음·에너지').first().isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v7r1-dashboard-intro.png`, fullPage: true });

  await page.getByText('좋아, 시작할게').click();
  await page.waitForTimeout(800);
  ok('R1-6h 시트 닫힘', !(await page.getByText('이제 진짜 시작이야').isVisible().catch(() => false)));
  await page.reload();
  await page.waitForTimeout(1500);
  ok('R1-6i 새로고침 후 재노출 없음', !(await page.getByText('이제 진짜 시작이야').isVisible().catch(() => false)));
  await ctx.close();
}

// ── 7) 가드: 범위 밖 스텝 → /onboarding/1, 완료자 스텝 진입 → /dashboard ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/9`);
  await page.waitForTimeout(1500);
  ok('R1-7a /onboarding/9 → /onboarding/1', new URL(page.url()).pathname === '/onboarding/1', page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage({
    sections: seedSections(), onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/onboarding/2`);
  await page.waitForTimeout(1500);
  ok('R1-7b 완료자 /onboarding/2 → /dashboard', new URL(page.url()).pathname === '/dashboard', page.url());
  await ctx.close();
}

// ── 8) 버전 게이트: schemaVersion:1 시드는 v1 리맵을 다시 타지 않는다 (2회 로드 무해성) ──
{
  const { ctx, page } = await newPage({
    sections: seedSections(), onboardingDone: false, onboardingStep: 5, schemaVersion: 1,
    userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(1500);
  const board = await readBoard(page);
  ok('R1-8a 게이트: schemaVersion 1이면 리맵 안 함(step 5 유지)', board?.onboardingStep === 5, `step=${board?.onboardingStep}`);
  ok('R1-8b 범위 밖 저장값은 URL 클램프로 방어', new URL(page.url()).pathname === '/onboarding/3', page.url());
  // 로드→저장→재로드 반복 무해성
  await page.reload();
  await page.waitForTimeout(1200);
  const board2 = await readBoard(page);
  ok('R1-8c 재로드 후에도 값 불변', board2?.onboardingStep === 5 && (board2?.schemaVersion ?? 0) >= 1);
  await ctx.close();
}

// ── 9) /welcome 404 (빈 디렉토리 제거) ──
{
  const { ctx, page } = await newPage(null);
  const res = await page.goto(`${BASE}/welcome`);
  ok('R1-9 /welcome 404', res?.status() === 404, `status=${res?.status()}`);
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.0-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
