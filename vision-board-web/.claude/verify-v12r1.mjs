// v12 검증 — 콜라주 편집 자율성 (인라인 문구 · 축하 화면 실제 보드 · 자유 배치 왕복 · 사진 발견성)
//
// 오너 피드백 4건에서 출발한 릴리스라, 계약도 그 4건을 그대로 잠근다.
//
// 계약:
//  ① 모달 폐기 — 문구를 탭해도 시트가 안 뜬다. 글자 자체가 편집면(contentEditable)이다
//  ② 줄바꿈 — ↵ 버튼이 캐럿 자리에 줄을 넣고, \n이 저장까지 살아남고, 스티커가 세로로 자란다
//  ③ 프리셋 — '+ 문구' 직후 프리셋 칩이 보인다 (v76r1 V6-7의 계약을 시트 없이 승계)
//  ④ 신규 문구가 겹치지 않는다 — 3연속 추가가 서로 다른 자리 (v11 "추가해도 안 늘어난다" 회귀 잠금)
//  ⑤ 크기·삭제 — ➖➕가 폭을 바꾸고 저장되며, 🗑이 문구를 지운다
//  ⑥ 빈 문구는 남지 않는다 — 아무것도 안 쓰고 나가면 유령 항목이 안 생긴다
//  ⑦ 자유 배치 왕복 무손실 — 옮기고 → 정렬로 → 다시 자유 배치 → 내 좌표가 돌아온다
//  ⑧ 사진 발견성 — 편집 모드에서 사진마다 ⋯ 가 있고, 누르면 '사진 바꾸기' 칩이 열린다
//  ⑨ 축하 화면 — /finish가 **실제 보드 렌더러**를 쓴다(숲 그리드 아님) + 편집 어포던스 0
//  ⑩ 편집 진입 어포던스 44px — 에디토리얼 풀블리드의 유일한 진입점
//  ⑪ 예산 무회귀 — 새 컨트롤이 보드 안이라 페이지 높이를 0 먹는다(PC 무스크롤·보드 폭)
//  ⑫ 육안 리뷰용 스크린샷 (⚠️ Read로 열어봐야 검증 완료)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:3000';
const OUT = 'verify-shots';
const svg = (w, h, fill) =>
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`
  ).toString('base64');
const COLORS = ['#7C8B6B', '#C98B6B', '#6B7C8B', '#8B6B7C', '#B5A36B', '#6B8B7C', '#9E7B5C', '#5C7B9E', '#7B5C9E'];

const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections() {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      id,
      status: 'completed',
      currentPhase: 4,
      currentSlotIndex: 0,
      images: [],
      extractedSlots: { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' },
      sceneText: '하루',
      miniStory: `일기${id}.`,
      uploadedImages: [
        svg(300, 400, COLORS[(id * 3) % 9]),
        svg(400, 300, COLORS[(id * 3 + 1) % 9]),
        svg(350, 350, COLORS[(id * 3 + 2) % 9]),
      ],
    };
  }
  return sections;
}
const fullBoard = (extra = {}) => ({
  sections: seedSections(),
  onboardingDone: true,
  dashboardIntroSeen: true,
  userName: '헬렌',
  startedAt: Date.now(),
  targetDate: '2029-07-07',
  schemaVersion: 5,
  loginNudgeSeen: true,
  loginBannerDismissedAt: Date.now(),
  finishCelebrated: true,
  collageTemplate: 'editorial',
  ...extra,
});

const browser = await chromium.launch();
const WIDE = { width: 1280, height: 900 };

async function newPage(seed, viewport = WIDE) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 140)));
  if (seed) {
    await page.addInitScript(
      ({ data }) => {
        // ⚠️ 가드 필수 — reload가 앱 스탬프를 덮어써 위양성이 난다 (R2-2 교훈)
        if (!localStorage.getItem('vision-board-data')) {
          localStorage.setItem('vision-board-data', JSON.stringify(data));
        }
        localStorage.setItem('vb-collage-coach-v1', '1');
      },
      { data: seed }
    );
  }
  return { ctx, page };
}
const loadStored = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('vision-board-data') ?? '{}'));

// 에디토리얼은 풀블리드라 '빈 곳 탭'이 성립하지 않는다 — 상시 어포던스 버튼이 결정적 진입점
async function enterEdit(page) {
  await page.getByRole('button', { name: /탭해서 편집/ }).first().click();
  await page.waitForTimeout(450);
}
const editEl = (page) => page.locator('[data-sticker-edit]');
const toolbar = (page) => page.locator('[data-testid="sticker-toolbar"]');

/** 편집 중인 문구에 글자를 넣는다 — 사용자의 타이핑과 같은 input 이벤트 경로 */
async function typeInSticker(page, text) {
  await page.evaluate((t) => {
    const el = document.querySelector('[data-sticker-edit]');
    el.focus();
    document.execCommand('insertText', false, t);
  }, text);
  await page.waitForTimeout(120);
}
/** 폰 뷰 배치에서 사용자 문구(kit: 아닌 것)만 */
const userStickers = (b, tpl = 'editorial') => {
  const L = b.collageDeviceLayouts?.phone?.[tpl] ?? b.collageLayouts?.[tpl] ?? {};
  return Object.entries(L.stickers ?? {}).filter(([id]) => !id.startsWith('kit:'));
};
const layoutOf = (b, tpl = 'editorial') =>
  b.collageDeviceLayouts?.phone?.[tpl] ?? b.collageLayouts?.[tpl] ?? {};

// ══════════════════════════════════════════════════════════════
// ①②③ 인라인 편집 · 줄바꿈 · 프리셋
// ══════════════════════════════════════════════════════════════
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(900);
  await enterEdit(page);

  await page.getByRole('button', { name: '+ 문구', exact: true }).click();
  await page.waitForTimeout(500);

  ok('V12-1a 문구 추가에 모달이 안 뜬다', (await page.locator('[role="dialog"]').count()) === 0);
  ok('V12-1b 글자 자체가 편집면', (await editEl(page).count()) === 1);
  ok(
    'V12-1c 편집면에 포커스',
    await page.evaluate(() => document.activeElement === document.querySelector('[data-sticker-edit]'))
  );
  ok('V12-1d 문구 툴바가 보드 안에 뜬다', await toolbar(page).isVisible());
  ok('V12-1e ✥ 전용 이동 핸들', (await page.locator('[data-move-for]').count()) === 1);

  // ③ 프리셋 — v76r1 V6-7의 계약을 시트 없이 승계한다
  const tb = toolbar(page);
  ok('V12-3a 프리셋(자라나는 중 🌱)', await tb.getByText('자라나는 중 🌱').isVisible().catch(() => false));
  ok('V12-3b 프리셋(운을 심는 중 🍀)', await tb.getByText('운을 심는 중 🍀').isVisible().catch(() => false));
  ok('V12-3c 프리셋(MAKE IT HAPPEN)', await tb.getByText('MAKE IT HAPPEN').isVisible().catch(() => false));
  ok('V12-3d 프리셋(잘 될 거야)', await tb.getByText('잘 될 거야').isVisible().catch(() => false));

  // ② 줄바꿈
  const h0 = (await editEl(page).boundingBox()).height;
  await typeInSticker(page, 'I got everything');
  await tb.getByRole('button', { name: '줄바꿈' }).click();
  await page.waitForTimeout(150);
  await typeInSticker(page, 'I need');
  const domText = await editEl(page).evaluate((e) => e.innerText);
  ok('V12-2a 줄바꿈이 캐럿 자리에 들어간다', domText === 'I got everything\nI need', JSON.stringify(domText));
  const h1 = (await editEl(page).boundingBox()).height;
  ok('V12-2b 스티커가 세로로 자란다', h1 > h0, `${Math.round(h0)} → ${Math.round(h1)}`);

  await tb.getByRole('button', { name: '완료', exact: true }).click();
  await page.waitForTimeout(600);
  ok('V12-2c 완료하면 툴바가 닫힌다', (await toolbar(page).count()) === 0);

  const stored = await loadStored(page);
  const mine = userStickers(stored);
  ok('V12-2d \\n이 저장까지 살아남는다', mine.length === 1 && mine[0][1].text === 'I got everything\nI need',
    JSON.stringify(mine.map(([, s]) => s.text)));

  // 리로드 후에도 두 줄
  await page.reload();
  await page.waitForTimeout(900);
  const after = await loadStored(page);
  ok('V12-2e 리로드 후에도 유지', userStickers(after)[0]?.[1].text === 'I got everything\nI need');
  ok(
    'V12-2f 보드가 실제로 두 줄로 그린다',
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-sticker-text]')).some((e) => e.innerText.includes('\n'))
    )
  );

  mkdirSync(OUT, { recursive: true });
  await page.locator('[data-testid="collage-board"]').first().screenshot({ path: `${OUT}/v12-sticker-multiline.png` });
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ④⑤⑥ 신규 문구 자리 · 크기/삭제 · 빈 문구
// ══════════════════════════════════════════════════════════════
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(900);
  await enterEdit(page);

  const spots = [];
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '+ 문구', exact: true }).click();
    await page.waitForTimeout(400);
    await typeInSticker(page, `문구${i}`);
    await toolbar(page).getByRole('button', { name: '완료', exact: true }).click();
    await page.waitForTimeout(500);
    const b = await loadStored(page);
    const L = layoutOf(b);
    const id = userStickers(b).map(([k]) => k).sort().at(-1);
    const it = L.items[`sticker:${id}`];
    spots.push(`${it.x.toFixed(3)},${it.y.toFixed(3)}`);
  }
  ok('V12-4a 3연속 추가가 서로 다른 자리', new Set(spots).size === 3, spots.join(' | '));
  const stored3 = await loadStored(page);
  ok('V12-4b 문구 3개가 모두 남는다', userStickers(stored3).length === 3);
  // 추가가 배치를 날려먹지 않는다 (v11 add 경로가 spec을 통째로 잃던 버그)
  ok('V12-4c 추가해도 spec이 살아 있다', !!layoutOf(stored3).spec, JSON.stringify(Object.keys(layoutOf(stored3))));

  // ⑤ 크기 — 편집으로 다시 들어가 ➕
  const first = userStickers(stored3)[0][0];
  const wBefore = layoutOf(stored3).items[`sticker:${first}`].w;
  await page.locator(`[data-item="sticker:${first}"] [data-sticker-text]`).click();
  await page.waitForTimeout(400);
  await toolbar(page).getByRole('button', { name: '문구 크게' }).click();
  await page.waitForTimeout(400);
  const wAfter = layoutOf(await loadStored(page)).items[`sticker:${first}`].w;
  ok('V12-5a ➕가 문구를 키운다', wAfter > wBefore, `${wBefore.toFixed(3)} → ${wAfter.toFixed(3)}`);
  await toolbar(page).getByRole('button', { name: '문구 작게' }).click();
  await page.waitForTimeout(400);
  ok('V12-5b ➖가 되돌린다', layoutOf(await loadStored(page)).items[`sticker:${first}`].w < wAfter);

  // 삭제
  await toolbar(page).getByRole('button', { name: '문구 삭제' }).click();
  await page.waitForTimeout(500);
  ok('V12-5c 🗑이 문구를 지운다', userStickers(await loadStored(page)).length === 2);

  // ⑥ 빈 문구 — 추가만 하고 편집 종료
  await page.getByRole('button', { name: '+ 문구', exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: '완료', exact: true }).last().click();
  await page.waitForTimeout(600);
  ok('V12-6a 빈 문구는 남지 않는다', userStickers(await loadStored(page)).length === 2);
  await page.reload();
  await page.waitForTimeout(800);
  ok('V12-6b 리로드해도 유령이 없다', userStickers(await loadStored(page)).length === 2);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ⑦ 자유 배치 왕복 무손실
// ══════════════════════════════════════════════════════════════
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(900);
  await enterEdit(page);

  const freeBtn = page.getByRole('button', { name: '자유 배치' });
  ok('V12-7a 자유 배치 토글의 접근 이름이 유지된다', (await freeBtn.count()) === 1);
  ok('V12-7b 라벨이 행동을 말한다', /자유롭게 옮기기/.test(await freeBtn.textContent()));

  await freeBtn.click();
  await page.waitForTimeout(500);
  ok('V12-7c 켜면 회전 핸들이 사진에도 생긴다', (await page.locator('[data-rot-for]').count()) > 2);

  // 사진 하나를 옮긴다
  const key = await page.evaluate(
    () => document.querySelector('[data-photo]')?.getAttribute('data-photo')
  );
  // ⚠️ CSS.escape는 브라우저 전역이라 node에는 없다 — 키가 `1-0` 꼴이라 따옴표만으로 충분하다
  const box = await page.locator(`[data-item="${key}"]`).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 60, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const moved = layoutOf(await loadStored(page)).items[key];

  await page.getByRole('button', { name: '자유 배치' }).click(); // 끄기
  await page.waitForTimeout(600);
  const stored = await loadStored(page);
  ok('V12-7d 끄면 정렬로 돌아온다', layoutOf(stored).freeform !== true);
  ok('V12-7e 내 좌표는 보관된다', !!layoutOf(stored).freeItems?.[key]);

  await page.getByRole('button', { name: '자유 배치' }).click(); // 다시 켜기
  await page.waitForTimeout(600);
  const back = layoutOf(await loadStored(page)).items[key];
  ok(
    'V12-7f 다시 켜면 좌표가 복원된다',
    Math.abs(back.x - moved.x) < 1e-6 && Math.abs(back.y - moved.y) < 1e-6,
    `${moved.x.toFixed(3)},${moved.y.toFixed(3)} → ${back.x.toFixed(3)},${back.y.toFixed(3)}`
  );
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ⑧⑩⑪ 사진 발견성 · 진입 어포던스 · 예산
// ══════════════════════════════════════════════════════════════
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(900);

  // ⑩ 진입 버튼 터치 타깃
  const editBtn = page.getByRole('button', { name: /탭해서 편집/ }).first();
  const eb = await editBtn.boundingBox();
  ok('V12-10a 편집 진입 버튼 ≥44px', eb.height >= 44, `${Math.round(eb.height)}px`);

  await enterEdit(page);
  const photos = await page.locator('[data-photo]').count();
  const menus = await page.locator('[data-photo-menu-for]').count();
  ok('V12-8a 사진마다 ⋯ 진입점', menus === photos, `${menus}/${photos}`);

  await page.locator('[data-photo-menu-for]').first().click();
  await page.waitForTimeout(400);
  ok('V12-8b ⋯ 를 누르면 사진 바꾸기가 열린다', await page.getByRole('button', { name: '사진 바꾸기', exact: true }).isVisible());
  ok('V12-8c 지우기도 함께', await page.getByRole('button', { name: '사진 지우기' }).isVisible());

  // ⑬ '기본 배치로'는 되돌릴 수 없는 유일한 동작 — 한 번 더 묻는다
  await page.getByRole('button', { name: '사진 액션 닫기' }).click();
  await page.waitForTimeout(200);
  const reset = page.getByRole('button', { name: '기본 배치로' });
  await reset.click();
  await page.waitForTimeout(250);
  ok('V12-13a 첫 탭은 확인만 묻는다', /정말/.test(await reset.textContent()), await reset.textContent());
  ok('V12-13b 접근 이름은 그대로', (await page.getByRole('button', { name: '기본 배치로' }).count()) === 1);
  await page.waitForTimeout(5200);
  ok('V12-13c 가만 두면 원래대로 돌아온다', /기본 배치로/.test(await reset.textContent()), await reset.textContent());

  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/v12-edit-mode.png` });
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ⑪ 예산 — 새 컨트롤이 전부 보드 안이라 편집을 켜도 페이지가 안 길어진다
// ⚠️ 반드시 **PC 뷰**로 잰다 (V87-4d와 같은 조건). 폰 뷰는 9:19.5 보드라 1280×900에서
//    원래 스크롤이 생긴다 — 거기서 재면 무관한 실패가 난다
// ══════════════════════════════════════════════════════════════
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/collage?view=desktop`);
  await page.waitForTimeout(2200);
  const before = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  await enterEdit(page);
  const after = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  ok('V12-11a PC 뷰 무스크롤 (편집 전)', before <= 2, `${before}px`);
  ok('V12-11b 편집을 켜도 페이지가 안 길어진다', after <= Math.max(2, before), `${before}px → ${after}px`);
  const bw = (await page.locator('[data-testid="collage-board"]').first().boundingBox()).width;
  ok('V12-11c PC 보드 폭 ≥1000px', bw >= 1000, `${Math.round(bw)}px`);
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// ⑨ 축하 화면이 실제 보드를 그린다
// ══════════════════════════════════════════════════════════════
{
  // ⚠️ futureDayStory를 시드에 넣으면 /finish가 'story' 단계로 바로 들어간다 —
  //    LLM 생성을 타면 회귀 스위트가 외부 API 응답 시간에 매달려 불안정해진다(v83r1 시드 관례)
  const { ctx, page } = await newPage(
    fullBoard({
      oneSentence: '올해는 내 속도로 산다',
      futureDayStory: '미래의 어느 하루.',
      storyWrittenAtCount: 6,
    })
  );
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(900);
  // 문구를 하나 남겨 축하 화면까지 따라오는지 본다
  await enterEdit(page);
  await page.getByRole('button', { name: '+ 문구', exact: true }).click();
  await page.waitForTimeout(400);
  await typeInSticker(page, '나는 내 편');
  await toolbar(page).getByRole('button', { name: '완료', exact: true }).click();
  await page.waitForTimeout(600);

  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1000);
  // 시드에 이야기가 있으므로 'story' 단계로 바로 들어간다 → 완성 버튼 한 번이면 축하 화면
  await page.getByRole('button', { name: /비전보드 완성/ }).click();
  await page.waitForTimeout(1200);

  const preview = page.locator('[data-testid="board-preview"]');
  ok('V12-9a 축하 화면에 실제 보드', (await preview.count()) === 1);
  ok('V12-9b 사진이 전부 실린다', (await page.locator('[data-photo]').count()) >= 6);
  ok('V12-9c 타이틀 카드도 같은 렌더러', (await page.locator('[data-testid="board-title"]').count()) === 1);
  ok(
    'V12-9d 내 문구가 축하 화면까지 따라온다',
    await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-sticker-text]')).some((e) => e.innerText.includes('나는 내 편'))
    )
  );
  // 구 숲 그리드가 아니다 — FOREST 그라디언트가 배경에 없어야 한다
  const bgImage = await preview.evaluate((e) => getComputedStyle(e).backgroundImage);
  ok('V12-9e 숲 그라디언트가 아니다', bgImage === 'none', bgImage.slice(0, 60));
  // 편집 어포던스가 새어 나오지 않는다
  ok('V12-9f 편집 버튼 없음', (await page.getByRole('button', { name: /탭해서 편집/ }).count()) === 0);
  ok(
    'V12-9g 편집 핸들 없음',
    (await page.locator('[data-resize-for],[data-rot-for],[data-photo-menu-for],[data-title-resize],[data-move-for]').count()) === 0
  );
  ok('V12-9h /collage 보드는 안 새어 나온다', (await page.locator('[data-testid="collage-board"]').count()) === 0);

  mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: `${OUT}/v12-finish-complete.png` });
  await ctx.close();
}

// ══════════════════════════════════════════════════════════════
// /scenes 진행 그리드는 그대로 (보드 프리뷰가 아니다)
// ══════════════════════════════════════════════════════════════
{
  const { ctx, page } = await newPage(fullBoard());
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1200);
  ok('V12-9i /scenes는 여전히 진행 그리드', (await page.locator('[data-testid="board-preview"]').count()) === 0);
  await ctx.close();
}

await browser.close();

console.log('===== v12-r1 검증 결과 =====');
results.forEach((r) => console.log(r));
if (errors.length) console.log('\n[페이지 에러]', [...new Set(errors)].slice(0, 6).join(' / '));
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${results.length - fails.length} PASS / ${fails.length} FAIL (총 ${results.length})`);
process.exit(fails.length ? 1 : 0);
