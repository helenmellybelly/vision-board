// v7.6 검증 — 숲 테마(딥 포레스트 그라디언트·프레임리스 사진·연도 카드), 시작 어포던스(글로우 링·여기서 시작),
// 예시 세트 로테이션(다른 예시 보기), 씬 브리지(섹션 채팅 안 안내→CTA), 스티커 프리셋 다양화, 도토리 채팅 딤 제거
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
const withPhoto = (extra = {}) =>
  textComplete({ sceneText: '하루', miniStory: '스토리.', status: 'completed', uploadedImages: [PIXEL, null, null, null, null], ...extra });
const doneBoard = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4, ...extra,
});

const browser = await chromium.launch();

async function newPage(seed, ctxOpts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...ctxOpts });
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

// ── 1) 숲 테마 — 산책길 지도 그라디언트 + 완료 수풀 장식 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const mapBg = await page
    .locator('div[style*="linear-gradient"]')
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundImage)
    .catch(() => '');
  ok('V6-1a 산책길 지도 그라디언트', mapBg.includes('linear-gradient') && mapBg.includes('rgb(31, 46, 34)'), mapBg.slice(0, 80));
  const body = await page.locator('body').innerText();
  ok('V6-1b 완료 스테이션 수풀 장식(🌿)', body.includes('🌿'));
  ok('V6-1c 구 다크(#2D2B29) 인라인 부재', (await page.locator('div[style*="45, 43, 41"], div[style*="#2D2B29"]').count()) === 0);
  await ctx.close();
}

// ── 2) 숲 테마 — 콜라주 보드 그라디언트·연도 카드·프레임리스 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  const board = page.locator('[data-testid="collage-board"]');
  const boardBg = await board.evaluate((el) => getComputedStyle(el).backgroundImage).catch(() => '');
  ok('V6-2a 콜라주 보드 그라디언트', boardBg.includes('linear-gradient') && boardBg.includes('rgb(31, 46, 34)'), boardBg.slice(0, 80));
  const cardCount = await board
    .evaluate((el) =>
      [...el.querySelectorAll('div')].filter((d) => getComputedStyle(d).backgroundColor === 'rgb(51, 71, 58)').length
    )
    .catch(() => 0);
  ok('V6-2b 연도 카드 숲 컬러(#33473A)', cardCount >= 1, `count=${cardCount}`);
  ok('V6-2c 흰 폴라로이드 프레임 부재', (await board.locator('.bg-white.p-1').count()) === 0);
  ok('V6-2d 사진 라운드 래퍼', (await board.locator('.rounded-xl img').count()) >= 1);
  ok('V6-2e 템플릿 라벨 숲', await page.getByText('숲', { exact: true }).first().isVisible().catch(() => false));
  await ctx.close();
}

// ── 3) 시작 어포던스 — 첫 방문 라벨 + 글로우 링, 진행 후 라벨 소멸 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V6-3a 여기서 시작 라벨(첫 방문)', await page.getByText('여기서 시작').isVisible().catch(() => false));
  ok('V6-3b 글로우 링 존재', (await page.locator('.animate-glowRing').count()) === 1);
  // aria-label 계약 유지 + 라우팅
  await page.locator('button[aria-label="나 — 시작 전"]').click();
  await page.waitForTimeout(600);
  ok('V6-3c 나 스테이션 탭 → 양경로 시트', await page.getByText('어떻게 시작할까?').isVisible().catch(() => false));
  // pathSheet 기대값 서브라인 (v7.6 마이크로 카피)
  ok('V6-3d 시트 기대값 카피(질문→일기)', await page.getByText('질문 4개에 답하면').isVisible().catch(() => false));
  ok('V6-3e 시트 기대값 카피(사진→절반)', await page.getByText('사진 3장을 담으면').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({ 1: { uploadedImages: [PIXEL, null, null] } }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V6-3f 진행 후 라벨 소멸', (await page.getByText('여기서 시작').count()) === 0);
  ok('V6-3g 토리 마커는 유지', (await page.locator('button[aria-label*=" — "] img[src*="tori"]').count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}), { reducedMotion: 'reduce' });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  const anim = await page
    .locator('.animate-glowRing')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName)
    .catch(() => 'missing');
  ok('V6-3h reduced-motion → 글로우 정지', anim === 'none', anim);
  await ctx.close();
}

// ── 4) 예시 세트 로테이션 — 섹션 질문 ──
{
  const { ctx, page } = await newPage(doneBoard({}));
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  ok('V6-4a 예시 패널 제목 유지', await page.getByText('이런 식으로 써봐').isVisible().catch(() => false));
  ok('V6-4b 세트 0 노출', await page.getByText('회사 다니면서 퇴근 후엔').isVisible().catch(() => false));
  const rotate = page.getByText('다른 예시 보기');
  ok('V6-4c 다른 예시 보기 버튼', await rotate.isVisible().catch(() => false));
  await rotate.click();
  await page.waitForTimeout(300);
  ok('V6-4d 세트 1로 순환', await page.getByText('새벽 한 시간에 글을 쓰면서').isVisible().catch(() => false));
  await rotate.click();
  await page.waitForTimeout(200);
  await rotate.click();
  await page.waitForTimeout(300);
  ok('V6-4e 3회 클릭 → 세트 0 랩', await page.getByText('회사 다니면서 퇴근 후엔').isVisible().catch(() => false));
  const ph = await page.locator('textarea').first().getAttribute('placeholder');
  ok('V6-4f 형식형 플레이스홀더', (ph ?? '').includes('한 문장이면 충분해'), ph ?? '');
  await ctx.close();
}
{
  // current만 답한 상태로 재개 → want 질문의 복수 유도 카피·플레이스홀더
  const { ctx, page } = await newPage(
    doneBoard({ 1: { status: 'in_progress', extractedSlots: { current: '바쁘게 사는 사람' } } })
  );
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  ok('V6-4g want 복수 유도 문구', await page.getByText('떠오르는 만큼 여러 개 적어줘').isVisible().catch(() => false));
  const ph = await page.locator('textarea').first().getAttribute('placeholder');
  ok('V6-4h want 플레이스홀더(줄 바꿔서)', (ph ?? '').includes('여러 개 적어도 좋아'), ph ?? '');
  ok('V6-4i want 멀티라인 세트 노출', await page.getByText('내 이름을 건 클래스 열어보기').isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) 씬 브리지 — 리뷰 진행 → 브리지 버블 → CTA → /scene ──
{
  const { ctx, page } = await newPage(
    doneBoard({ 1: { status: 'in_progress', extractedSlots: { ...FULL_EXTRACTED } } })
  );
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1500);
  await page.getByText('이 답들로 미래의 하루 그려보기').click();
  // AI 의미 검증(fail-open, 최대 10s) 후 브리지 노출
  const bridgeSeen = await page
    .getByText('미래의 하루 일기')
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok('V6-5a 브리지 버블 노출', bridgeSeen);
  ok('V6-5b 아직 /section에 머무름', new URL(page.url()).pathname === '/section/1', page.url());
  ok('V6-5c 브리지 가이드 문구', await page.getByText('시간, 장소, 감각까지 담아봐').isVisible().catch(() => false));
  await page.getByText('미래의 하루 그려보기 →', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('V6-5d 브리지 CTA → /scene/1', new URL(page.url()).pathname === '/scene/1', page.url());
  await ctx.close();
}
{
  // /scene 직접 도착 — 새 쿠션(재인사)과 구 카피 부재, 가이드 3행
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('V6-5e 새 쿠션(…년의 하루야)', await page.getByText('2029년의 하루야').isVisible().catch(() => false));
  ok('V6-5f 구 쿠션(질문은 끝났어) 부재', (await page.getByText('질문은 끝났어').count()) === 0);
  await page.getByText('이렇게 쓰면 일기가 진짜같아져').click();
  await page.waitForTimeout(300);
  ok('V6-5g 가이드 3행(형식 자유)', await page.getByText('장면 단어만 나열해도 좋아').isVisible().catch(() => false));
  await ctx.close();
}

// ── 6) 씬 예시 로테이션 — 산문 ↔ 불릿 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('V6-6a 세트 0 산문 노출', await page.getByText('햇살이 잘 드는 서재에서 커피를').isVisible().catch(() => false));
  await page.getByText('다른 예시 보기').click();
  await page.waitForTimeout(300);
  ok('V6-6b 세트 1 불릿 노출', await page.getByText('통창이 있는 서재').first().isVisible().catch(() => false));
  await ctx.close();
}

// ── 7) 스티커 프리셋 다양화 — 이모지 포함 신규 문구 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  // 중앙은 연도 카드가 덮고 있어 모서리를 탭해 편집 모드 진입
  await page.locator('[data-testid="collage-board"]').click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(700);
  await page.getByText('+ 문구').click();
  await page.waitForTimeout(600);
  ok('V6-7a 신규 이모지 프리셋(자라나는 중 🌱)', await page.getByText('자라나는 중 🌱').isVisible().catch(() => false));
  ok('V6-7b 신규 프리셋(운을 심는 중 🍀)', await page.getByText('운을 심는 중 🍀').isVisible().catch(() => false));
  ok('V6-7c 신규 아웃라인(MAKE IT HAPPEN)', await page.getByText('MAKE IT HAPPEN').isVisible().catch(() => false));
  ok('V6-7d 기존 프리셋 유지(잘 될 거야)', (await page.getByText('잘 될 거야').count()) >= 1);
  await ctx.close();
}

// ── 8) 도토리 채팅 — 이전 버블 딤 제거 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/1`);
  await page.waitForTimeout(1200);
  await page.locator('input[type="text"]').fill('헬렌');
  await page.getByText('이렇게 불러줘').click();
  await page.waitForTimeout(1000);
  // 탭 2회 → 버블 3개
  await page.locator('.rounded-tl-sm').first().click();
  await page.waitForTimeout(400);
  await page.locator('.rounded-tl-sm').first().click();
  await page.waitForTimeout(600);
  const opacities = await page
    .locator('.rounded-tl-sm')
    .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity));
  ok('V6-8a 버블 3개 렌더', opacities.length === 3, `count=${opacities.length}`);
  ok('V6-8b 전 버블 불투명(딤 제거)', opacities.every((o) => o === '1'), opacities.join(','));
  await ctx.close();
}

// ── 9) 온보딩 마이크로 카피 — 이름 힌트·시간 기대값 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/1`);
  await page.waitForTimeout(1200);
  ok('V6-9a 이름 용도 힌트', await page.getByText('토리가 부를 이름이면 돼').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}, { onboardingDone: false }));
  await page.goto(`${BASE}/onboarding/3`);
  await page.waitForTimeout(1200);
  ok('V6-9b 시간 기대값 카피(5분)', await page.getByText('첫 스테이션은 5분이면 돼').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(doneBoard({}, { dashboardIntroSeen: false }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V6-9c 인트로 최종 보상 카피(참나무 언덕)', await page.getByText('참나무 언덕에서 완성된 비전보드 배경화면').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.6-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
