// v7.3 검증 — 온보딩 카피(누락 문장·도토리 교체), 대시보드(사진 시트·연도 편집),
// collage(기본 PC·상시 칩·보드뷰 저장·?view=), scenes(리네임·URL 토글·스크롤 어포던스), scene 가이드
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

// ── 1) 온보딩: 스텝1 누락 문장 + 스텝2 새 도토리 문안 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/onboarding/1`);
  await page.waitForTimeout(1500);
  ok('V3-1a 스텝1 정원사 문장', (await page.getByText('꿈의 정원사지').count()) > 0);
  ok('V3-1b 스텝1 누락 문장 추가', (await page.getByText('우리가 함께 비전보드를 만들어 갈 거야').count()) > 0);
  await page.getByPlaceholder('이름 또는 닉네임').fill('헬렌');
  await page.getByText('이렇게 불러줘').click();
  await page.waitForTimeout(1200);
  ok('V3-1c 도토리 1: 심겨야 싹', (await page.getByText('헬렌아, 도토리도 땅에 심겨야 싹을 틔울 수 있어').count()) > 0);
  await page.getByText('계속하려면 탭').click();
  await page.waitForTimeout(400);
  ok('V3-1d 도토리 2: 비옥한 땅 (josa)', (await page.getByText('헬렌이라는 도토리를 비옥한 땅에 심는 일이야').count()) > 0);
  await page.getByText('계속하려면 탭').click();
  await page.waitForTimeout(400);
  ok('V3-1e 도토리 3: 함께 만들자', (await page.getByText('우리 함께 비전보드를 만들어 볼까?').count()) > 0);
  // v7.4 심기 인터랙션 — 심기 버튼을 눌러야 CTA가 나온다
  await page.getByText('도토리 심기').click();
  await page.waitForTimeout(1600);
  ok('V3-1f 새 CTA 버튼', await page.getByText('그래, 함께 해보자!').isVisible().catch(() => false));
  ok('V3-1g 구 CTA 부재', (await page.getByText('그 가능성, 꺼내볼게').count()) === 0);
  await ctx.close();
}

// ── 2) 대시보드: 사진 바로 담기 시트 + 연도 편집 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  // 연도 표시 + 편집
  ok('V3-2a 연도 캡션', await page.getByText('2029년의 나를 그리는 보드야').isVisible().catch(() => false));
  await page.getByText('연도 바꾸기').click();
  await page.waitForTimeout(300);
  await page.getByLabel('연도 늘리기').click();
  await page.waitForTimeout(300);
  // v7.5: 산책길 '완료' 칩과 다중 매칭 방지 — 연도 편집 완료 버튼은 role로
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.waitForTimeout(300);
  ok('V3-2b 연도 +1 반영', await page.getByText('2030년의 나를 그리는 보드야').isVisible().catch(() => false));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? '{}').targetDate);
  ok('V3-2c targetDate 연도만 변경 (월일 유지)', saved === '2030-07-07', `targetDate=${saved}`);
  // 사진 바로 담기 시트
  await page.getByText('질문 없이, 사진부터 담아볼래?').click();
  await page.waitForTimeout(500);
  ok('V3-2d 시트 타이틀', await page.getByText('어느 칸에 사진을 담을까?').isVisible().catch(() => false));
  ok('V3-2e 섹션1 사진 수', await page.getByText('사진 1장').isVisible().catch(() => false));
  ok('V3-2f 빈 섹션 표시', (await page.getByText('비어 있어').count()) >= 1);
  await page.getByRole('button', { name: '건강 비어 있어' }).click();
  await page.waitForTimeout(1000);
  ok('V3-2g 섹션 탭 → /scenes/2', new URL(page.url()).pathname === '/scenes/2', page.url());
  await ctx.close();
}

// ── 3) collage: 기본 PC + 자동 시드 + 상시 칩 + 보드뷰 저장 + ?view= ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  ok('V3-3a 기본 뷰 = PC', await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('V3-3b URL 정규화 ?view=desktop', new URL(page.url()).search === '?view=desktop', page.url());
  ok('V3-3c PC 프리셋 자동 시드 (FHD 선택)', await page.getByRole('radio', { name: 'FHD', exact: true }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('V3-3d 저장 버튼 즉시 노출', await page.getByText('PC 배경화면 저장').isVisible().catch(() => false));
  // 칩 탭 즉시 적용
  await page.getByRole('radio', { name: 'QHD', exact: true }).click();
  await page.waitForTimeout(500);
  ok('V3-3e 칩 탭 → 즉시 적용', await page.getByText('PC QHD (16:9)').isVisible().catch(() => false));
  // v7.5: 보드 탭 제거 — 폰/PC 2탭만, 보드 뷰 저장 버튼도 함께 제거
  ok('V3-3f 보드 탭 부재', (await page.getByRole('radio', { name: '보드', exact: true }).count()) === 0);
  ok('V3-3g 이미지로 저장 버튼 부재', (await page.getByText('🖼️ 이미지로 저장').count()) === 0);
  ok('V3-3h 뷰 라디오 2개 (폰/PC)', (await page.getByRole('radiogroup', { name: '보기 방식' }).getByRole('radio').count()) === 2);
  await ctx.close();
}
// 레거시 ?device= 딥링크 호환 + ?view= 딥링크
{
  const { ctx, page } = await newPage(doneBoard({ 1: withPhoto() }));
  await page.goto(`${BASE}/collage?device=phone`);
  await page.waitForTimeout(1200);
  ok('V3-3i 레거시 ?device=phone → 폰 탭', await page.getByRole('radio', { name: '📱 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('V3-3j URL이 ?view=phone으로 정규화', new URL(page.url()).search === '?view=phone', page.url());
  ok('V3-3k 폰 프리셋 자동 시드 (기본 폰)', await page.getByRole('radio', { name: '기본 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  // v7.5: 레거시 ?view=board 딥링크는 desktop으로 흡수·정규화
  await page.goto(`${BASE}/collage?view=board`);
  await page.waitForTimeout(1200);
  const pcChecked = await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false);
  ok('V3-3l 레거시 ?view=board → PC 탭 + ?view=desktop 정규화', pcChecked && new URL(page.url()).search === '?view=desktop', page.url());
  await ctx.close();
}

// ── 4) scenes: 리네임 + URL 토글 위치 + 스크롤 어포던스 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete({ sceneText: '카페의 하루', miniStory: '완성된 스토리.' }) }));
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  ok('V3-4a 직접 사진 올리기 리네임', await page.getByText('직접 사진 올리기').isVisible().catch(() => false));
  ok('V3-4b 구 버튼명 부재', (await page.getByText('내 사진 올리기').count()) === 0);
  // URL 토글이 ① 영역(더 찾아보기 밖)에서 즉시 보임 — 더 찾아보기는 접힌 상태
  ok('V3-4c URL 토글 상시 노출', await page.getByText('이미지 주소(URL)로 담기').isVisible().catch(() => false));
  ok('V3-4d 더 찾아보기 캡션에서 URL 제거', (await page.getByText('검색·힌트·URL').count()) === 0);
  await page.getByText('이미지 주소(URL)로 담기').click();
  await page.waitForTimeout(400);
  ok('V3-4e 토글 → URL 인풋', await page.getByPlaceholder('이미지 URL 주소 붙여넣기').isVisible().catch(() => false));
  // 갤러리 가로 스크롤 어포던스 — 카테고리 칩 행 오른쪽 '옆으로 더 보기' 버튼
  const moreBtns = await page.getByLabel('옆으로 더 보기').count();
  ok('V3-4f 스크롤 어포던스 노출', moreBtns >= 1, `count=${moreBtns}`);
  // 셰브런 탭 → 스크롤 이동 (마지막 카테고리 '성취·여유' 도달 가능)
  await page.getByLabel('옆으로 더 보기').first().click();
  await page.waitForTimeout(600);
  ok('V3-4g 셰브런 탭 → 성취·여유 노출', await page.getByText('성취·여유').isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) scene: 작성 가이드 카드 + 새 힌트 + 연도 파생 쿠션 ──
{
  const { ctx, page } = await newPage(doneBoard({ 1: textComplete() }));
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1500);
  ok('V3-5a 가이드 카드', await page.getByText('이렇게 쓰면 일기가 진짜같아져').isVisible().catch(() => false));
  // v7.4: 가이드 카드가 기본 접힘(details) — 펼친 뒤 본문 확인
  await page.getByText('이렇게 쓰면 일기가 진짜같아져').click();
  await page.waitForTimeout(300);
  ok('V3-5b 가이드: 순간 2~3개(펼침)', await page.getByText('순간 2~3개면 충분해').isVisible().catch(() => false));
  ok('V3-5c 칩 힌트(고쳐 써봐)', await page.getByText('막막하면 탭해서 넣고').isVisible().catch(() => false));
  // v7.6 쿠션 카피 교체("…년의 하루야") — 예고문은 섹션 채팅 브리지로 이동
  ok('V3-5d 쿠션 연도 파생 (2029년)', await page.getByText('2029년의 하루야').isVisible().catch(() => false));
  ok('V3-5e 구 하드코딩(3년 뒤) 부재', (await page.getByText('3년 뒤의 하루').count()) === 0);
  ok('V3-5f 연결형 예문 렌더', await page.getByText('이런 식으로 써봐').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();

console.log('\n===== v7.3-r1 검증 결과 =====');
for (const r of results) console.log(r);
const failCount = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failCount}/${results.length} PASS`);
if (errors.length) {
  console.log('\n[pageerror]');
  for (const e of [...new Set(errors)]) console.log('-', e);
}
process.exit(failCount ? 1 : 0);
