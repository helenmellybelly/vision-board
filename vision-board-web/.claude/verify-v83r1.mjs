// v8.3 검증 — 완주 경험·재방문 로그인 (docs/완주경험-리플래닝-v83.md)
// 계약: ① /diary 통합 열람(하루 이야기 대표 + 섹션 일기 부록) ② 대시보드 일기 진입점 1원화
// ③ 완주 대시보드 정리(📷 행·연도 편집 숨김, 완료형 카피) ④ 온보딩 로그인 진입 링크
// ⑤ 완주 지도 연출(다 자란 참나무 → /collage, 첫 완주 파티클 1회 + finishCelebrated 스탬프)
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
  for (const [id, extra] of Object.entries(overrides)) Object.assign(sections[id], extra);
  return sections;
}

const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };
const withPhoto = (n = '스토리') =>
  ({ status: 'completed', extractedSlots: { ...FULL_EXTRACTED }, sceneText: '하루', miniStory: `${n}.`,
     uploadedImages: [PIXEL, null, null, null, null] });
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});
// 완주 시드 — finishCelebrated 기본 true (파티클 1회 연출이 타이밍을 흔들지 않게, v8.3 시드 관례)
const finishedBoard = (extra = {}) => {
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto(`일기${id}`);
  return board(overrides, {
    futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 6, oneSentence: '여유로운 사람.',
    finishCelebrated: true, ...extra,
  });
};

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
      localStorage.setItem('vb-collage-coach-v1', '1');
    }, seed);
  }
  return { ctx, page };
}

// ── 1) /diary 완주 렌더 — 하루 이야기 대표 + 섹션 일기 6편 부록 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  ok('V83-1a 헤더', await page.getByText('헬렌의 미래 일기').isVisible().catch(() => false));
  ok('V83-1b 하루 이야기 본문', await page.getByText('미래의 어느 하루.').isVisible().catch(() => false));
  ok('V83-1c 한 문장 블록', await page.getByText('여유로운 사람.').isVisible().catch(() => false));
  // v8.5 — 6편 부록 삭제(섹션 탭과 중복), 다듬기는 /finish 이동 대신 인라인 액션
  ok('V83-1d 전체 탭 6편 부록 부재', (await page.getByText('미래 일기 6편').count()) === 0);
  ok('V83-1f 인라인 다듬기 액션', (await page.getByText('✍️ 직접 수정하기').count()) >= 1 && (await page.getByText('🔄 AI로 다시 쓰기').count()) >= 1);
  await page.getByRole('tab', { name: '관계', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V83-1e 섹션 탭 일기 본문', await page.getByText('일기3.').isVisible().catch(() => false));
  await page.getByRole('button', { name: '내 비전보드 보기 →', exact: true }).click();
  await page.waitForURL('**/collage**', { timeout: 8000 }).catch(() => {});
  ok('V83-1g 하단 CTA → /collage', page.url().includes('/collage'), page.url());
  await ctx.close();
}

// ── 2) /diary 부분 진행 — 하루 이야기 자리 안내 + 있는 일기만 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto('일기1'), 2: withPhoto('일기2') }));
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  ok('V83-2a 미완성 안내', await page.getByText('여섯 그루가 다 자라면 하루 이야기가 완성돼').isVisible().catch(() => false));
  // v8.5 — 부록 삭제: 있는 일기는 섹션 탭에서 확인
  await page.getByRole('tab', { name: '원하는 내 모습', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V83-2b 섹션 탭에 있는 일기', await page.getByText('일기1.').isVisible().catch(() => false));
  ok('V83-2c 다듬기 링크 부재(이야기 없음)', (await page.getByText('이야기 다듬기').count()) === 0);
  await ctx.close();
}

// ── 3) /diary 온보딩 전 딥링크 가드 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1800);
  ok('V83-3 온보딩 전 → /onboarding 리다이렉트', page.url().includes('/onboarding'), page.url());
  await ctx.close();
}

// ── 4) 완주 대시보드 정리 — 📷 행·연도 편집 숨김 + 완료형 카피 + 일기 링크 1원화 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V83-4a 📷 행 부재', (await page.getByText('질문 없이, 사진부터 담아볼래?').count()) === 0);
  ok('V83-4b 일기 N편 트리거 부재', (await page.getByText(/미래 일기 \d+편/).count()) === 0);
  // v8.5 — "완성해도 끝은 아니야 …" 인과 어색 카피 교체 (오너 피드백)
  ok('V83-4c 완성 지속 카피', await page.getByText('비전보드는 계속 가꿔 나갈 수 있어').isVisible().catch(() => false));
  ok('V83-4c2 구 연도 완료형 부재', (await page.getByText('나를 그린 보드야').count()) === 0);
  ok('V83-4d 연도 바꾸기 부재', (await page.getByText('연도 바꾸기').count()) === 0);
  const diaryLink = page.getByRole('button', { name: '📖 미래 일기 읽기 →', exact: true });
  ok('V83-4e 보조 일기 링크', await diaryLink.isVisible().catch(() => false));
  await diaryLink.click();
  await page.waitForTimeout(800);
  ok('V83-4f 일기 링크 → /diary', page.url().includes('/diary'), page.url());
  await ctx.close();
}

// ── 5) 미완주 대시보드 회귀 — 📷 행·연도 편집·진행형 카피 유지 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V83-5a 📷 행 유지', await page.getByText('질문 없이, 사진부터 담아볼래?').isVisible().catch(() => false));
  ok('V83-5b 연도 진행형 유지', await page.getByText('2029년의 나를 그리는 보드야').isVisible().catch(() => false));
  ok('V83-5c 연도 바꾸기 유지', await page.getByText('연도 바꾸기').isVisible().catch(() => false));
  await ctx.close();
}

// ── 6) 온보딩 로그인 진입 — 셸 링크 + choice 캡션 (SSR 빈 body — 실렌더로만 검증) ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/1`);
  await page.waitForTimeout(1800);
  ok('V83-6a 셸 로그인 링크', await page.getByText('만들던 보드가 있어?').isVisible().catch(() => false));
  ok('V83-6b 이어가기 버튼', await page.getByRole('button', { name: 'Google로 이어가기 →', exact: true }).isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(board({}));
  await page.goto(`${BASE}/onboarding/choice`);
  await page.waitForTimeout(1800);
  ok('V83-6c choice 재방문자 캡션', await page.getByText('전에 만들던 보드가 있으면 그대로 이어져.').isVisible().catch(() => false));
  await ctx.close();
}

// ── 7) 완주 지도 연출 — 다 자란 참나무 → /collage, 미완주는 참나무 언덕 불변 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V83-7a 다 자란 참나무 라벨', await page.getByText('다 자란 참나무').isVisible().catch(() => false));
  ok('V83-7b 구 라벨 부재', (await page.getByText('참나무 언덕').count()) === 0);
  await page.getByRole('button', { name: '완성한 보드 보기', exact: true }).click();
  await page.waitForURL('**/collage**', { timeout: 8000 }).catch(() => {});
  ok('V83-7c 참나무 탭 → /collage', page.url().includes('/collage'), page.url());
  await ctx.close();
}
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V83-7d 미완주 참나무 언덕 불변', await page.getByText('참나무 언덕').isVisible().catch(() => false));
  ok('V83-7e 승격 라벨 부재', (await page.getByText('다 자란 참나무').count()) === 0);
  await ctx.close();
}

// ── 8) 첫 완주 파티클 — 미스탬프 진입 1회 연출 + finishCelebrated 스탬프 ──
{
  const { ctx, page } = await newPage(finishedBoard({ finishCelebrated: undefined }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1000);
  ok('V83-8a 잎 파티클 렌더', (await page.locator('.animate-leafFall').count()) >= 1);
  const stamped = await page.evaluate(
    () => JSON.parse(localStorage.getItem('vision-board-data') ?? '{}').finishCelebrated
  );
  ok('V83-8b finishCelebrated 스탬프', stamped === true, `stamped=${stamped}`);
  await page.waitForTimeout(2200);
  ok('V83-8c 연출 종료 후 제거', (await page.locator('.animate-leafFall').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1000);
  ok('V83-8d 스탬프 있으면 파티클 부재', (await page.locator('.animate-leafFall').count()) === 0);
  await ctx.close();
}

await browser.close();
console.log('\n===== v8.3 검증 =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
