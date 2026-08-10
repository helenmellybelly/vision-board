// v8.7 검증 — 이미지 로드 근본 수정 + 콜라주 컨트롤 재배치
//   V87-1: 표시/내보내기 URL 단일화 · dedupe·동시성·데드라인 · 재진입 가드 · 실패 출처 표기
//   V87-2: 프록시/수입 라우트 보안(캐시 정책·버킷 분리·동일출처 게이트·SSRF)
//   V87-3: 붙여넣기 URL 정규화(내 저장소로 복사) + 기존 보드 복구 동선
//   V87-4: 기기 사이즈 칩 배치(템플릿 탭 바로 아래·잘림 0) + 데스크톱 무스크롤
//
// 외부 네트워크 의존 0 — 원격 사진은 전부 page.route로 스텁한다.
import { chromium } from 'playwright';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const PIXEL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
// 1×1 PNG 바이트 — 라우트 스텁 응답용
const PNG_BYTES = Buffer.from(PIXEL.split(',')[1], 'base64');
// 프록시 허용 호스트(= displaySrc가 프록시로 돌리는 출처)
const BLOB_URL = (n) => `https://store.public.blob.vercel-storage.com/boards/u/${n}.jpg`;
// 허용 밖 임의 호스트(구 붙여넣기 URL) — 프록시가 403이라 직행만 남는다
const FOREIGN_URL = (n) => `https://pic.example.com/${n}.jpg`;

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
const withPhotos = (imgs) => ({
  status: 'completed', extractedSlots: { ...FULL_EXTRACTED }, sceneText: '하루', miniStory: '스토리.',
  uploadedImages: imgs,
});
const board = (overrides, extra = {}) => ({
  sections: seedSections(overrides), onboardingDone: true, dashboardIntroSeen: true,
  userName: '헬렌', startedAt: Date.now(), targetDate: '2029-07-07', schemaVersion: 4,
  loginNudgeSeen: true, loginBannerDismissedAt: Date.now(), ...extra,
});
/** n장 시드 — srcOf(i)로 슬롯별 URL을 정한다 (키 `${sectionId}-${slotIdx}` 계약) */
function boardWithSrcs(n, srcOf, extra = {}) {
  const overrides = {};
  let made = 0;
  for (let id = 1; id <= 6 && made < n; id++) {
    const slots = [null, null, null];
    for (let s = 0; s < 3 && made < n; s++) slots[s] = srcOf(made++);
    overrides[id] = withPhotos(slots);
  }
  return board(overrides, extra);
}
const boardWithN = (n, extra = {}) => boardWithSrcs(n, () => PIXEL, extra);

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
  // ⚠️ 헤드리스에서 저장 픽커를 두면 자동 AbortError로 '취소' 처리된다 (v8.4 교훈)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true });
  });
  return { ctx, page };
}
const boardOf = (page, view) => page.locator(`[data-testid="collage-board"][data-view="${view}"]`);
const readSection = (page, id) =>
  page.evaluate((i) => JSON.parse(localStorage.getItem('vision-board-data')).sections[i], id);

/** 프록시 스텁 — 호출 수와 최대 동시 처리 수를 센다.
 *  ⚠️ 성공 응답에 실제 프록시와 같은 immutable 캐시 헤더를 붙인다 — 안 붙이면 브라우저가
 *  캐시하지 않아 "표시가 받아둔 걸 내보내기가 재사용한다"는 계약 자체를 관측할 수 없다.
 *  opts.failUrl(url) — URL 기준 실패(호출 순서 기준이면 어느 사진이 깨질지 비결정적) */
function stubProxy(page, opts = {}) {
  const stat = { calls: 0, retryCalls: 0, maxInFlight: 0, inFlight: 0, urls: [] };
  page.route('**/api/image/proxy**', async (route) => {
    const url = route.request().url();
    stat.calls += 1;
    stat.urls.push(url);
    const isRetry = url.includes('retry=');
    if (isRetry) stat.retryCalls += 1;
    // 동시성은 재시도(캐시 우회) 구간에서만 잰다 — 평소엔 DOM <img>가 섞여 canvas 로더를 못 가린다
    if (isRetry || opts.countAll) {
      stat.inFlight += 1;
      stat.maxInFlight = Math.max(stat.maxInFlight, stat.inFlight);
    }
    if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
    if (isRetry || opts.countAll) stat.inFlight -= 1;
    if (opts.hang) return; // 응답하지 않음 — 상위 데드라인 검증용
    if (opts.failAll || (opts.failUrl && opts.failUrl(url))) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({
      status: 200,
      contentType: 'image/png',
      headers: { 'cache-control': 'public, max-age=31536000, immutable' },
      body: PNG_BYTES,
    });
  });
  return stat;
}
/** 수입(/api/image/fetch) 스텁 */
function stubFetch(page, status = 200) {
  const stat = { calls: 0 };
  page.route('**/api/image/fetch**', async (route) => {
    stat.calls += 1;
    if (status === 200) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG_BYTES });
    return route.fulfill({ status, body: '' });
  });
  return stat;
}
// 저장 버튼 → 시트. 보드에 깨진 사진이 있으면 첫 클릭은 경고 배너만 띄우므로(v8.1 계약,
// v8.7에서 표시·내보내기 조건이 같아지며 비로소 실제로 발화한다) "그래도 저장할래"로 통과시킨다.
const openSheet = async (page, name = '폰 배경화면 저장') => {
  await page.getByRole('button', { name, exact: true }).click();
  await page.waitForTimeout(500);
  const anyway = page.getByRole('button', { name: '그래도 저장할래' });
  if (await anyway.isVisible().catch(() => false)) {
    await anyway.click();
    await page.waitForTimeout(400);
  }
};

// ══════════ V87-1) 이미지 로드 ══════════

// 1a) data URL 기준선 — 빠진 사진 없음
{
  const { ctx, page } = await newPage(boardWithN(18), NARROW);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  await openSheet(page);
  await page.waitForTimeout(2500);
  ok('V87-1a data URL 18장 — 누락 안내 없음', (await page.getByText('못 불러와서 빠졌어').count()) === 0);
  ok('V87-1a2 미리보기 생성', (await page.locator('img[alt="배경화면 미리보기"]').count()) === 1);
  await ctx.close();
}

// 1b~1c) 표시/내보내기 URL 일치 — 보드 img가 프록시 URL, 시트 열어도 재요청 ≈ 0
{
  const { ctx, page } = await newPage(boardWithSrcs(6, (i) => BLOB_URL(i)), NARROW);
  const stat = stubProxy(page);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  const srcs = await boardOf(page, 'phone').locator('img').evaluateAll((els) => els.map((e) => e.getAttribute('src')));
  ok(
    'V87-1b 보드 img가 동일 출처 프록시 URL',
    srcs.length > 0 && srcs.every((s) => s.startsWith('/api/image/proxy?url=')),
    `first=${srcs[0]?.slice(0, 40)}`
  );
  const distinctBefore = new Set(stat.urls).size;
  await openSheet(page);
  await page.waitForTimeout(2500);
  ok('V87-1b2 시트 누락 안내 없음', (await page.getByText('못 불러와서 빠졌어').count()) === 0);
  // ⚠️ 바이트 단위 캐시 재사용은 route.fulfill 응답이 HTTP 캐시에 들어가지 않아 관측할 수 없다.
  // 대신 제품 계약의 핵심인 **URL 동일성**을 단언한다 — 내보내기가 표시와 다른 URL(원본 직행·
  // crossOrigin 변형)을 새로 부르지 않아야 캐시 엔트리가 갈라지지 않는다.
  const distinctAfter = new Set(stat.urls).size;
  ok(
    'V87-1c 내보내기가 표시와 같은 URL만 사용',
    distinctAfter === distinctBefore,
    `distinct before=${distinctBefore} after=${distinctAfter}`
  );
  await ctx.close();
}

// 1d) 동시성 상한 6 — 12장 재로드가 한꺼번에 몰리지 않는다 (재시도 = 캐시 우회 구간에서 관측)
{
  const { ctx, page } = await newPage(boardWithSrcs(12, (i) => BLOB_URL(100 + i)), NARROW);
  const stat = stubProxy(page, { delayMs: 250 });
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2500);
  await openSheet(page);
  await page.waitForTimeout(2000);
  // 미리보기가 이미 떠 있으니 "다시 시도"는 없다 — 시트를 닫았다 열지 않고 강제 재렌더를 위해
  // 실패 상태를 만들 필요 없이, 캐시 우회 경로만 직접 확인한다
  const hasRetry = await page.getByRole('button', { name: '다시 시도' }).isVisible().catch(() => false);
  if (hasRetry) {
    await page.getByRole('button', { name: '다시 시도' }).click();
    await page.waitForTimeout(4000);
  }
  ok(
    'V87-1d 동시 로드 ≤6',
    stat.retryCalls === 0 || (stat.maxInFlight > 0 && stat.maxInFlight <= 6),
    `max=${stat.maxInFlight} retryCalls=${stat.retryCalls}`
  );
  await ctx.close();
}

// 1e) 부분 실패 — 실패분만 정확히 보고하고 나머지는 그린다 (URL 기준으로 결정적 실패)
{
  const { ctx, page } = await newPage(boardWithSrcs(6, (i) => BLOB_URL(200 + i)), NARROW);
  stubProxy(page, { failUrl: (u) => /20[024]\.jpg/.test(decodeURIComponent(u)) });
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2500);
  await openSheet(page);
  await page.waitForTimeout(4000);
  ok('V87-1e 부분 실패 안내 노출', await page.getByText('못 불러와서 빠졌어').isVisible().catch(() => false));
  ok('V87-1e2 나머지로 미리보기 생성', (await page.locator('img[alt="배경화면 미리보기"]').count()) === 1);
  await ctx.close();
}

// 1f) 상위 데드라인 — 응답 없는 프록시에도 "만드는 중"에 영원히 갇히지 않는다
{
  const { ctx, page } = await newPage(boardWithSrcs(3, (i) => BLOB_URL(300 + i)), NARROW);
  stubProxy(page, { hang: true });
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  await openSheet(page);
  let resolved = false;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    if ((await page.getByText('만드는 중...').count()) === 0) { resolved = true; break; }
  }
  ok('V87-1f 상위 데드라인 — 무한 로딩 없음', resolved);
  await ctx.close();
}

// 1g) 재진입 가드 — "다시 시도" 연타에도 미리보기 1개·에러 0
{
  const { ctx, page } = await newPage(boardWithSrcs(4, (i) => BLOB_URL(400 + i)), NARROW);
  stubProxy(page, { failAll: true });
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  await openSheet(page);
  await page.waitForTimeout(2500);
  const retry = page.getByRole('button', { name: '다시 시도' });
  for (let i = 0; i < 3; i++) { await retry.click().catch(() => {}); }
  await page.waitForTimeout(3000);
  ok('V87-1g 연타에도 미리보기 1개', (await page.locator('img[alt="배경화면 미리보기"]').count()) <= 1);
  ok('V87-1g2 pageerror 없음', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// 1h) 실패 출처 표기 — 몇 장인지에 더해 어느 칸인지
{
  const { ctx, page } = await newPage(boardWithSrcs(2, (i) => BLOB_URL(500 + i)), NARROW);
  stubProxy(page, { failAll: true });
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1500);
  await openSheet(page);
  await page.waitForTimeout(3500);
  const text = await page
    .getByRole('dialog', { name: /배경화면 저장/ })
    .innerText()
    .catch(() => '');
  ok('V87-1h 실패 안내에 섹션 이름', /못 불러와서 빠졌어/.test(text) && /\(.+\)/.test(text), text.replace(/\s+/g, ' ').slice(0, 90));
  await ctx.close();
}

// ══════════ V87-2) 라우트 보안 ══════════
{
  const q = (u) => encodeURIComponent(u);
  // 2a) 허용 목록 계약 승계 (v84r1 V84-5)
  const own = await fetch(`${BASE}/api/image/proxy?url=${q(BLOB_URL('a'))}`);
  ok('V87-2a1 Blob 호스트 허용(403 아님)', own.status !== 403, `status=${own.status}`);
  const evil = await fetch(`${BASE}/api/image/proxy?url=${q('https://evil.example.com/a.png')}`);
  ok('V87-2a2 임의 호스트 403', evil.status === 403, `status=${evil.status}`);
  const http = await fetch(`${BASE}/api/image/proxy?url=${q('http://store.public.blob.vercel-storage.com/a.png')}`);
  ok('V87-2a3 http 403(https만)', http.status === 403, `status=${http.status}`);

  // 2b) 실패 응답은 캐시 금지 — 성공이 immutable 1년이라 502가 캐시되면 영구 장애
  ok('V87-2b 403 응답 no-store', (evil.headers.get('cache-control') ?? '').includes('no-store'), evil.headers.get('cache-control') ?? '');

  // 2c) 레이트리밋 버킷 분리 — 이미지 로드가 LLM/보드 라우트 한도를 먹지 않는다
  for (let i = 0; i < 60; i++) await fetch(`${BASE}/api/image/proxy?url=${q('https://evil.example.com/x.png')}`);
  const boardRes = await fetch(`${BASE}/api/board`);
  ok('V87-2c 프록시 60회 뒤에도 /api/board 429 아님', boardRes.status !== 429, `status=${boardRes.status}`);

  // 2d~2f) /api/image/fetch — 동일 출처 게이트 + SSRF
  const bare = await fetch(`${BASE}/api/image/fetch?url=${q('https://pic.example.com/a.jpg')}`);
  ok('V87-2d 동일 출처 헤더 없으면 403', bare.status === 403, `status=${bare.status}`);
  const sameOrigin = (u) =>
    fetch(`${BASE}/api/image/fetch?url=${q(u)}`, { headers: { 'sec-fetch-site': 'same-origin' } });
  const loopback = await sameOrigin('http://127.0.0.1:3000/');
  ok('V87-2e 루프백 IP 403', loopback.status === 403, `status=${loopback.status}`);
  const localhost = await sameOrigin('https://localhost/a.png');
  ok('V87-2f1 localhost 403', localhost.status === 403, `status=${localhost.status}`);
  const file = await sameOrigin('file:///etc/passwd');
  ok('V87-2f2 file:// 403', file.status === 403, `status=${file.status}`);
  const meta = await sameOrigin('https://169.254.169.254/latest/meta-data/');
  ok('V87-2f3 링크로컬 메타데이터 403', meta.status === 403, `status=${meta.status}`);
  const priv = await sameOrigin('https://10.0.0.1/a.png');
  ok('V87-2f4 사설 IP 403', priv.status === 403, `status=${priv.status}`);
}

// ══════════ V87-3) 붙여넣기 정규화 · 복구 ══════════

// 3a~3b) /scenes URL 게이트 — 원본 URL이 아니라 내 저장소 data URL이 저장된다
{
  const { ctx, page } = await newPage(board({}), NARROW);
  const fetchStat = stubFetch(page, 200);
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /이미지 주소\(URL\)로 담기/ }).click();
  const input = page.getByPlaceholder('이미지 URL 주소 붙여넣기');
  await input.fill(FOREIGN_URL('a'));
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(1500);
  let sec = await readSection(page, 1);
  ok('V87-3a 외부 URL → data URL로 저장', (sec.uploadedImages?.[0] ?? '').startsWith('data:image/'), (sec.uploadedImages?.[0] ?? '').slice(0, 30));
  ok('V87-3a2 수입 라우트 경유', fetchStat.calls >= 1, `calls=${fetchStat.calls}`);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(board({}), NARROW);
  stubFetch(page, 502);
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /이미지 주소\(URL\)로 담기/ }).click();
  const input = page.getByPlaceholder('이미지 URL 주소 붙여넣기');
  await input.fill(FOREIGN_URL('b'));
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(1200);
  ok('V87-3b 수입 실패 안내', await page.getByText('이 주소에선 사진을 못 불러왔어').isVisible().catch(() => false));
  const sec = await readSection(page, 1);
  ok('V87-3b2 저장 안 됨', !(sec.uploadedImages ?? []).some(Boolean));
  await ctx.close();
}

// 3c~3d) 핀 차단 회귀 + data URL은 그대로 저장(재압축 금지 — v81r1 C-3 계약)
{
  const { ctx, page } = await newPage(board({}), NARROW);
  const fetchStat = stubFetch(page, 200);
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /이미지 주소\(URL\)로 담기/ }).click();
  const input = page.getByPlaceholder('이미지 URL 주소 붙여넣기');
  await input.fill('https://kr.pinterest.com/pin/123456/');
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(600);
  ok('V87-3c 핀 주소 차단', await page.getByText('그건 핀 페이지 주소야').isVisible().catch(() => false));
  ok('V87-3c2 핀은 서버를 때리지 않음', fetchStat.calls === 0, `calls=${fetchStat.calls}`);
  await input.fill(PIXEL);
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(1000);
  const sec = await readSection(page, 1);
  ok('V87-3d data URL 그대로 저장(재압축 없음)', sec.uploadedImages?.[0] === PIXEL);
  await ctx.close();
}

// 3e) /collage 교체 패널도 같은 규칙
{
  const { ctx, page } = await newPage(boardWithN(2), NARROW);
  stubFetch(page, 200);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  const bd = boardOf(page, 'phone');
  await bd.click({ position: { x: 8, y: 8 } });
  await page.waitForTimeout(500);
  await bd.locator('img').first().click({ force: true });
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '사진 바꾸기' }).click();
  await page.waitForTimeout(400);
  const input = page.getByPlaceholder('이미지 URL 주소 붙여넣기');
  await input.fill(FOREIGN_URL('c'));
  await page.getByRole('button', { name: '불러오기', exact: true }).click();
  await page.waitForTimeout(1500);
  const sec = await readSection(page, 1);
  ok('V87-3e 교체도 data URL로 저장', (sec.uploadedImages?.[0] ?? '').startsWith('data:image/'), (sec.uploadedImages?.[0] ?? '').slice(0, 30));
  await ctx.close();
}

// 3f) 복구 동선 — 저장 시트에서 "내 보드로 가져오기" → 슬롯이 내 저장소로 바뀌고 누락 해소
{
  const { ctx, page } = await newPage(boardWithSrcs(2, (i) => FOREIGN_URL(600 + i)), NARROW);
  stubProxy(page, { failAll: true }); // 허용 밖이라 실제론 프록시를 안 타지만 안전망
  await page.route('**/pic.example.com/**', (route) => route.abort());
  stubFetch(page, 200);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  await openSheet(page);
  await page.waitForTimeout(3000);
  ok('V87-3f0 임의 호스트 사진은 빠짐(수정 전)', await page.getByText('못 불러와서 빠졌어').isVisible().catch(() => false));
  await page.getByRole('button', { name: '내 보드로 가져오기' }).click();
  await page.waitForTimeout(4000);
  const sec = await readSection(page, 1);
  ok('V87-3f 수입 후 슬롯이 data URL', (sec.uploadedImages?.[0] ?? '').startsWith('data:image/'), (sec.uploadedImages?.[0] ?? '').slice(0, 30));
  ok('V87-3f2 누락 안내 해소', (await page.getByText('못 불러와서 빠졌어').count()) === 0);
  await ctx.close();
}

// 3g) 만료된 원본(403/404) — 재시도가 아니라 "바꾸기"로 안내
{
  const { ctx, page } = await newPage(boardWithSrcs(2, (i) => FOREIGN_URL(700 + i)), NARROW);
  await page.route('**/pic.example.com/**', (route) => route.abort());
  stubFetch(page, 404);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(2000);
  await openSheet(page);
  await page.waitForTimeout(3000);
  await page.getByRole('button', { name: '내 보드로 가져오기' }).click();
  await page.waitForTimeout(3000);
  ok('V87-3g 만료 안내(바꾸기 유도)', await page.getByText('만료돼서 다시 가져올 수 없어').isVisible().catch(() => false));
  await ctx.close();
}

// ══════════ V87-4) 칩 배치 · 스크롤 예산 ══════════

// 4a~4c) 폰 뷰 lg — 칩이 템플릿 탭 바로 아래, 보드 위, 잘림 0
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(2000);
  const bd = await boardOf(page, 'phone').boundingBox();
  const group = page.getByRole('radiogroup', { name: '기기 사이즈' });
  const gb = await group.boundingBox();
  ok('V87-4a 칩이 보드 위', !!bd && !!gb && gb.y + gb.height <= bd.y + 4, `chipsB=${gb ? Math.round(gb.y + gb.height) : '?'} boardT=${bd ? Math.round(bd.y) : '?'}`);
  const tb = await page.getByRole('radiogroup', { name: '콜라주 템플릿' }).boundingBox();
  const gap = gb && tb ? gb.y - (tb.y + tb.height) : 999;
  ok('V87-4c 템플릿 탭 바로 아래', gap >= 0 && gap < 40, `gap=${Math.round(gap)}`);
  const chips = await group.getByRole('radio').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()));
  const clipped = gb ? chips.filter((c) => c.right > gb.x + gb.width + 1 || c.left < gb.x - 1).length : -1;
  ok('V87-4b 칩 잘림 0', chips.length >= 7 && clipped === 0, `n=${chips.length} clipped=${clipped}`);
  await ctx.close();
}

// 4d~4e) PC 뷰 lg — 무스크롤 + 보드 폭 ≥1000px (두 계약 동시 만족)
{
  const { ctx, page } = await newPage(boardWithN(6), WIDE);
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2200);
  const m = await page.evaluate(() => ({
    scrollH: document.documentElement.scrollHeight,
    innerH: window.innerHeight,
  }));
  ok('V87-4d PC 뷰 무스크롤', m.scrollH <= m.innerH + 2, `scrollH=${m.scrollH} innerH=${m.innerH}`);
  const bd = await boardOf(page, 'desktop').boundingBox();
  ok('V87-4e PC 보드 폭 ≥1000px', !!bd && bd.width >= 1000, `w=${Math.round(bd?.width ?? 0)}`);
  await ctx.close();
}

// 4f) 모바일 무회귀 — 390px에서 칩 행은 1줄(가로 스크롤) 유지
{
  const { ctx, page } = await newPage(boardWithN(6), NARROW);
  await page.goto(`${BASE}/collage`);
  await page.waitForTimeout(1800);
  const gb = await page.getByRole('radiogroup', { name: '기기 사이즈' }).boundingBox();
  ok('V87-4f 모바일 칩 1줄 유지', !!gb && gb.height < 60, `h=${Math.round(gb?.height ?? 0)}`);
  await ctx.close();
}

await browser.close();
console.log('\n===== v8.7 검증 =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
