// v8.4 검증 — 배경화면 내보내기 복구·저장 픽커·완주 카피·/diary 탭·재작성 넛지·프록시 허용
// 계약: ① 완주 대시보드 "완성 ≠ 종결" 카피 + 일기 버튼 승격(보더 필)
// ② 프롬프트 업그레이드 재작성 넛지(스탬프 없는 구 이야기만, 닫으면 재노출 없음)
// ③ /diary 탭(기본 전체 = v8.3 통합 스크롤 그대로, 섹션 탭 = 해당 일기만, 빈 섹션 안내)
// ④ 배경화면 저장 픽커(showSaveFilePicker 우선, AbortError = 조용한 취소)
// ⑤ /api/image/proxy — 자기 Blob 호스트(*.public.blob.vercel-storage.com) 허용
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
// 완주 시드 — finishCelebrated:true 필수(파티클 억제, v8.3 관례).
// ⚠️ storyPromptVersion을 안 주면 "구 프롬프트 이야기" = 업그레이드 넛지 대상 (v8.4 의도)
const finishedBoard = (extra = {}) => {
  const overrides = {};
  for (let id = 1; id <= 6; id++) overrides[id] = withPhoto(`일기${id}`);
  return board(overrides, {
    futureDayStory: '미래의 어느 하루.', storyWrittenAtCount: 6, oneSentence: '여유로운 사람.',
    finishCelebrated: true, ...extra,
  });
};

const browser = await chromium.launch();

async function newPage(seed, init) {
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
  if (init) await page.addInitScript(init);
  return { ctx, page };
}

// ── 1) 완주 대시보드 — "완성 ≠ 종결" 카피 + 일기 버튼 승격 + 업그레이드 넛지 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  // v8.5 — "완성해도 끝은 아니야 …" 인과 어색 카피 교체 (오너 피드백)
  ok('V84-1a 완성 지속 카피', await page.getByText('비전보드는 계속 가꿔 나갈 수 있어').isVisible().catch(() => false));
  ok('V84-1b 구 연도 완료형 부재', (await page.getByText('나를 그린 보드야').count()) === 0);
  const diaryBtn = page.getByRole('button', { name: '📖 미래 일기 읽기 →', exact: true });
  ok('V84-1c 일기 버튼 존재', await diaryBtn.isVisible().catch(() => false));
  const cls = (await diaryBtn.getAttribute('class').catch(() => '')) ?? '';
  ok('V84-1d 일기 버튼 승격(보더 필)', cls.includes('border') && cls.includes('rounded-2xl'), cls.slice(0, 60));
  ok('V84-1e 업그레이드 넛지(구 이야기)', await page.getByText('이야기 짓는 솜씨가 늘었어').isVisible().catch(() => false));
  await ctx.close();
}

// ── 2) 업그레이드 넛지 — 닫기 스탬프 + 최신 스탬프 보드엔 비노출 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: '다시 쓰기 안내 닫기' }).click();
  await page.waitForTimeout(400);
  ok('V84-2a 닫기 후 비노출', (await page.getByText('이야기 짓는 솜씨가 늘었어').count()) === 0);
  const dismissed = await page.evaluate(
    () => JSON.parse(localStorage.getItem('vision-board-data') ?? '{}').storyUpgradeNudgeDismissed
  );
  ok('V84-2b dismissed 스탬프', dismissed === true, `dismissed=${dismissed}`);
  await ctx.close();
}
{
  // v8.5 — STORY_PROMPT_VERSION 3 (외국 문자 게이트) — 최신 스탬프 = 3
  const { ctx, page } = await newPage(finishedBoard({ storyPromptVersion: 3 }));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('V84-2c 최신 스탬프 보드 비노출', (await page.getByText('이야기 짓는 솜씨가 늘었어').count()) === 0);
  await ctx.close();
}

// ── 3) /diary 탭 — 기본 전체(통합 스크롤 유지) + 섹션 탭 전환 + 빈 섹션 안내 ──
{
  const { ctx, page } = await newPage(finishedBoard());
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  ok('V84-3a 탭 7개', (await page.getByRole('tab').count()) === 7);
  ok('V84-3b 기본 전체: 하루 이야기', await page.getByText('미래의 하루 이야기').isVisible().catch(() => false));
  // v8.5 — 6편 부록 삭제(섹션 탭과 중복, 오너 피드백) — 전체 탭은 대표 글 하나만
  ok('V84-3c 전체 탭: 6편 부록 부재', (await page.getByText('미래 일기 6편').count()) === 0);
  ok('V84-3d /diary 넛지(구 이야기)', await page.getByText('이야기 짓는 솜씨가 늘었어').isVisible().catch(() => false));
  await page.getByRole('tab', { name: '건강', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V84-3e 건강 탭: 해당 일기만', await page.getByText('일기2.').isVisible().catch(() => false));
  ok('V84-3f 건강 탭: 하루 이야기 숨김', (await page.getByText('미래의 하루 이야기').count()) === 0);
  ok('V84-3g 건강 탭: 부록 헤더 숨김', (await page.getByText('미래 일기 6편').count()) === 0);
  ok('V84-3h 건강 탭: 다른 섹션 숨김', (await page.getByText('일기3.').count()) === 0);
  await page.getByRole('tab', { name: '전체', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V84-3i 전체 복귀(대표 글)', await page.getByText('미래의 어느 하루.').isVisible().catch(() => false));
  await ctx.close();
}
{
  const { ctx, page } = await newPage(board({ 1: withPhoto('일기1'), 2: withPhoto('일기2') }));
  await page.goto(`${BASE}/diary`);
  await page.waitForTimeout(1500);
  await page.getByRole('tab', { name: '일·성장', exact: true }).click();
  await page.waitForTimeout(400);
  ok('V84-3j 빈 섹션 안내', await page.getByText('이 칸의 일기는 아직 안 썼어').isVisible().catch(() => false));
  ok('V84-3k 빈 섹션 → 대시보드 링크', await page.getByText('대시보드에서 이어 쓰기 →').isVisible().catch(() => false));
  await ctx.close();
}

// ── 4) 배경화면 저장 픽커 — 위치 선택 → 파일 기록 / 취소는 조용히 ──
const collageSeed = () =>
  finishedBoard({ collageDevicePresets: { phone: 'phone', desktop: 'pc-fhd' } });
{
  const { ctx, page } = await newPage(collageSeed(), () => {
    window.__pickerCalls = [];
    window.__savedBytes = 0;
    window.showSaveFilePicker = async (opts) => {
      window.__pickerCalls.push(opts?.suggestedName ?? '');
      return {
        createWritable: async () => ({
          write: async (blob) => { window.__savedBytes += blob?.size ?? 0; },
          close: async () => {},
        }),
      };
    };
  });
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: '폰 배경화면 저장', exact: true }).click();
  await page.waitForTimeout(2500); // 미리보기 렌더
  await page.getByRole('button', { name: '이미지로 저장', exact: true }).click();
  await page.waitForTimeout(2000);
  const calls = await page.evaluate(() => window.__pickerCalls);
  const bytes = await page.evaluate(() => window.__savedBytes);
  ok('V84-4a 픽커 호출 1회', Array.isArray(calls) && calls.length === 1, `calls=${JSON.stringify(calls)}`);
  ok('V84-4b 제안 파일명 계약', /^vision-board-\d{4}-(mosaic|polaroid|minimal)-phone\.png$/.test(calls?.[0] ?? ''), calls?.[0]);
  ok('V84-4c 파일 기록 > 0바이트', bytes > 0, `bytes=${bytes}`);
  ok('V84-4d 저장 실패 문구 부재', (await page.getByText('저장에 실패했어').count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await newPage(collageSeed(), () => {
    window.showSaveFilePicker = async () => {
      throw new DOMException('user cancelled', 'AbortError');
    };
  });
  await page.goto(`${BASE}/collage?view=phone`);
  await page.waitForTimeout(1800);
  await page.getByRole('button', { name: '폰 배경화면 저장', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: '이미지로 저장', exact: true }).click();
  await page.waitForTimeout(1200);
  ok('V84-4e 취소 시 에러 없음', (await page.getByText('저장에 실패했어').count()) === 0);
  ok('V84-4f 취소 후 버튼 복귀', await page.getByRole('button', { name: '이미지로 저장', exact: true }).isVisible().catch(() => false));
  await ctx.close();
}

// ── 5) 이미지 프록시 허용 호스트 — 자기 Blob 호스트 허용(403 아님), 임의 호스트 403 ──
{
  const own = await fetch(
    `${BASE}/api/image/proxy?url=${encodeURIComponent('https://x.public.blob.vercel-storage.com/a.png')}`
  );
  ok('V84-5a Blob 호스트 허용(403 아님)', own.status !== 403, `status=${own.status}`);
  const evil = await fetch(
    `${BASE}/api/image/proxy?url=${encodeURIComponent('https://evil.example.com/a.png')}`
  );
  ok('V84-5b 임의 호스트 403', evil.status === 403, `status=${evil.status}`);
  const http = await fetch(
    `${BASE}/api/image/proxy?url=${encodeURIComponent('http://x.public.blob.vercel-storage.com/a.png')}`
  );
  ok('V84-5c http 403(https만)', http.status === 403, `status=${http.status}`);
}

await browser.close();
console.log('\n===== v8.4 검증 =====');
for (const r of results) console.log(r);
if (errors.length) console.log('pageerrors:', errors.join(' | '));
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fail}/${results.length} PASS`);
process.exit(fail ? 1 : 0);
