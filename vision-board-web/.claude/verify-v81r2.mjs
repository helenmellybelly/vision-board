// v8.1 Slice 2 검증 — v8.2에서 재작성: 나란히(lg) 철회 → 전 뷰포트 2탭·보드 1개·저장 버튼 1개.
// 유지: finish 딥링크·출처 배지·인라인 교체/삭제·깨진 사진 ⚠️·저장 버튼별 시트
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// 1×1 검정 픽셀 — 교체 검증용 (PIXEL과 값이 달라야 한다)
const PIXEL2 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGAAAAAEAAH2FzhVAAAAAElFTkSuQmCC';
const BROKEN_URL = 'https://invalid.example/broken.jpg';
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
const withPhoto = (img = PIXEL, extra = {}) => ({
  status: 'completed', extractedSlots: { ...FULL_EXTRACTED }, sceneText: '하루', miniStory: '스토리.',
  uploadedImages: [img, null, null], ...extra,
});
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});

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

const readSection = (page, id) =>
  page.evaluate((sid) => JSON.parse(localStorage.getItem('vision-board-data')).sections[sid], id);
// 보드 좌상단 탭 — 타이틀 밴드(사진 없음)를 노려 배경 탭 = 편집 진입 (v8.2에서도 계약 유지)
const boardOf = (page, view) => page.locator(`[data-testid="collage-board"][data-view="${view}"]`);

// ── V-1) lg: 2탭 노출·기본 desktop·보드 1개·현재 뷰 저장 버튼 1개 (v8.2) ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  ok('V-1a lg 뷰 라디오 2개 노출', (await page.getByRole('radiogroup', { name: '보기 방식' }).getByRole('radio').count()) === 2);
  ok('V-1b lg 기본 desktop 탭', await page.getByRole('radio', { name: '🖥️ PC' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('V-1c 보드 1개(desktop)', (await page.locator('[data-testid="collage-board"]').count()) === 1 && (await boardOf(page, 'desktop').count()) === 1);
  ok('V-1d 템플릿 셀렉터 1개(공통)', (await page.getByRole('radiogroup', { name: '콜라주 템플릿' }).count()) === 1);
  const pcSave = await page.getByText('PC 배경화면 저장').isVisible().catch(() => false);
  const phSave = await page.getByText('폰 배경화면 저장').isVisible().catch(() => false);
  ok('V-1e 저장 버튼 1개(현재 뷰)', pcSave && !phSave, `pc=${pcSave} ph=${phSave}`);
  // 탭 전환 → 보드·저장 버튼이 함께 전환
  await page.getByRole('radio', { name: '📱 폰' }).click();
  await page.waitForTimeout(800);
  ok('V-1f 폰 탭 전환 시 보드·저장 전환', (await boardOf(page, 'phone').count()) === 1 && (await page.locator('[data-testid="collage-board"]').count()) === 1 && (await page.getByText('폰 배경화면 저장').isVisible().catch(() => false)));
  await ctx.close();
}

// ── V-2) 좁은 화면: 2탭·기본 phone·보이는 보드 1개 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), NARROW);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  ok('V-2a 뷰 라디오 2개 노출', (await page.getByRole('radiogroup', { name: '보기 방식' }).getByRole('radio').count()) === 2);
  ok('V-2b 기본 phone 탭', await page.getByRole('radio', { name: '📱 폰' }).getAttribute('aria-checked').then((v) => v === 'true').catch(() => false));
  ok('V-2c 보드 1개(phone)', (await page.locator('[data-testid="collage-board"]').count()) === 1 && (await boardOf(page, 'phone').count()) === 1);
  ok('V-2d 폰 저장 버튼', await page.getByText('폰 배경화면 저장').isVisible().catch(() => false));
  await ctx.close();
}

// ── V-3) /finish CTA → /collage (lg 기본 desktop 단일 보드) ──
{
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto();
  const { ctx, page } = await newPage(
    board(overrides, { futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 6, oneSentence: '여유로운 사람.' }),
    WIDE
  );
  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1800);
  // 스토리 화면 → '비전보드 완성 →'으로 complete 단계 진입 후 CTA 확인
  await page.getByRole('button', { name: '비전보드 완성 →', exact: true }).click();
  await page.waitForTimeout(800);
  const cta = page.getByRole('button', { name: '내 비전보드 보러 가기 →', exact: true });
  ok('V-3a finish CTA 존재', await cta.isVisible().catch(() => false));
  await cta.click();
  await page.waitForURL('**/collage**', { timeout: 8000 }).catch(() => {});
  ok('V-3b /collage 이동(phone 강제 없음)', page.url().includes('/collage') && !page.url().includes('view=phone'), page.url());
  await page.waitForTimeout(1200);
  ok('V-3c lg 단일 보드(desktop)', (await boardOf(page, 'desktop').count()) === 1 && (await page.locator('[data-testid="collage-board"]').count()) === 1);
  await ctx.close();
}

// ── V-4) 탭 전환 시 편집 종료 — 편집 중 다른 탭으로 가도 잔존 편집 UI 없음 (v8.2) ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  await boardOf(page, 'desktop').click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(600);
  ok('V-4a PC 보드 편집 진입', (await page.getByRole('button', { name: '완료', exact: true }).count()) === 1);
  await page.getByRole('radio', { name: '📱 폰' }).click();
  await page.waitForTimeout(800);
  // 뷰 전환은 CollageBoard 리마운트(key에 view 포함) — 편집 상태가 넘어오지 않는다
  ok('V-4b 탭 전환 후 편집 종료', (await page.getByRole('button', { name: '완료', exact: true }).count()) === 0);
  await ctx.close();
}

// ── V-5) 출처 배지 — 편집 모드에서만 섹션명 칩 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), NARROW);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  const bd = boardOf(page, 'phone');
  ok('V-5a 감상 모드 배지 없음', (await bd.getByText('원하는 내 모습').count()) === 0);
  await bd.click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(600);
  ok('V-5b 편집 모드 배지(섹션명 칩)', await bd.getByText('원하는 내 모습').isVisible().catch(() => false));
  await ctx.close();
}

// ── V-6) 사진 탭 → '지우기' — 슬롯·보드·localStorage에서 제거 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), NARROW);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  const bd = boardOf(page, 'phone');
  await bd.click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(600);
  // 편집 모드에서 사진(첫 img)을 탭 → 액션 칩
  await bd.locator('img').first().click({ force: true });
  await page.waitForTimeout(400);
  ok('V-6a 액션 칩(지우기) 노출', await page.getByRole('button', { name: '사진 지우기' }).isVisible().catch(() => false));
  await page.getByRole('button', { name: '사진 지우기' }).click();
  await page.waitForTimeout(600);
  const sec = await readSection(page, 1);
  ok('V-6b localStorage 슬롯 비움', !sec.uploadedImages?.[0], String(sec.uploadedImages?.[0]).slice(0, 30));
  ok('V-6c 보드에서 사진 제거(빈 보드 문구)', await page.getByText('아직 담긴 사진이 없어').isVisible().catch(() => false));
  await ctx.close();
}

// ── V-7) 사진 탭 → '사진 바꾸기' — 게이트 검증·key 유지 교체 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), NARROW);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  const bd = boardOf(page, 'phone');
  await bd.click({ position: { x: 12, y: 12 } });
  await page.waitForTimeout(600);
  const beforeBox = await bd.locator('img').first().boundingBox();
  await bd.locator('img').first().click({ force: true });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '사진 바꾸기' }).click();
  await page.waitForTimeout(400);
  ok('V-7a 교체 패널(섹션명·카피)', await page.getByText('이 자리에 넣을 사진을 골라줘').isVisible().catch(() => false));
  // 핀 페이지 주소는 차단 (T3 게이트 재사용)
  const input = page.getByPlaceholder('이미지 URL 주소 붙여넣기');
  await input.fill('https://kr.pinterest.com/pin/123456/');
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V-7b 핀 주소 차단', await page.getByText('그건 핀 페이지 주소야').isVisible().catch(() => false));
  // 정상 이미지로 교체 → 같은 슬롯(key)에 저장, 배치 유지
  await input.fill(PIXEL2);
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(800);
  const sec = await readSection(page, 1);
  ok('V-7c 같은 슬롯에 교체 저장', sec.uploadedImages?.[0] === PIXEL2);
  const afterBox = await bd.locator('img').first().boundingBox();
  ok(
    'V-7d 배치(위치·크기) 유지',
    !!beforeBox && !!afterBox && Math.abs(beforeBox.x - afterBox.x) < 2 && Math.abs(beforeBox.width - afterBox.width) < 2,
    `before=${beforeBox?.x},${beforeBox?.width} after=${afterBox?.x},${afterBox?.width}`
  );
  ok('V-7e 패널 닫힘', (await page.getByText('이 자리에 넣을 사진을 골라줘').count()) === 0);
  await ctx.close();
}

// ── V-8) 깨진 사진 — 보드 ⚠️·저장 경고(차단 아님)·시트 skip 안내·scenes 오버레이 ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto(BROKEN_URL) }), NARROW);
  await page.route('**invalid.example**', (route) => route.abort());
  await page.route('**/api/image/proxy**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2500);
  const bd = boardOf(page, 'phone');
  ok('V-8a 보드 ⚠️ 타일', (await bd.locator('[data-broken-photo]').count()) === 1);
  ok('V-8b 못 불러왔어 카피', await bd.getByText('사진을 못 불러왔어').isVisible().catch(() => false));
  // 저장 → 경고 배너 1회, '그래도 저장할래'로 진행 가능(차단 아님)
  await page.getByText('폰 배경화면 저장').click();
  await page.waitForTimeout(400);
  ok('V-8c 저장 경고 배너', await page.getByText('몇 장은 못 불러와서 배경화면엔 안 들어가').isVisible().catch(() => false));
  await page.getByRole('button', { name: '그래도 저장할래' }).click();
  await page.waitForTimeout(2500);
  ok('V-8d 시트 열림(차단 아님)', await page.getByRole('dialog').isVisible().catch(() => false));
  ok('V-8e 시트 skip 안내', await page.getByText('못 불러와서 빠졌어').isVisible().catch(() => false));
  await page.getByRole('button', { name: '닫기', exact: true }).click();
  // scenes 슬롯 ⚠️ 오버레이
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(2000);
  ok('V-8f scenes 슬롯 ⚠️', await page.getByText('지우고 다시 담아줘').isVisible().catch(() => false));
  await ctx.close();
}

// ── V-9) 저장 버튼별 시트 프리셋 — 각 탭의 버튼이 해당 프리셋 시트 (v8.2 탭 순회) ──
{
  const { ctx, page } = await newPage(board({ 1: withPhoto() }), WIDE);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  await page.getByText('PC 배경화면 저장').click();
  await page.waitForTimeout(1500);
  let dialog = page.getByRole('dialog');
  ok('V-9a PC 버튼 → PC 시트', await dialog.getByText('PC FHD (16:9)').isVisible().catch(() => false));
  await dialog.getByRole('button', { name: '닫기', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('radio', { name: '📱 폰' }).click();
  await page.waitForTimeout(800);
  await page.getByText('폰 배경화면 저장').click();
  await page.waitForTimeout(1500);
  dialog = page.getByRole('dialog');
  ok('V-9b 폰 버튼 → 폰 시트', await dialog.getByText('기본 폰 (9:19.5)').isVisible().catch(() => false));
  await ctx.close();
}

await browser.close();
console.log('\n===== v8.1r2 검증 (v8.2 갱신) =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
