// v6.21 검증 — P0(질문 단일화·용어·내비), P1(동선: 완료시트·ProcessBar·welcome 제거·가드), P2(카피)
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '.claude/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const results = [];
const errors = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections(overrides = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      id, status: 'in_progress', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [],
    };
  }
  for (const [id, extra] of Object.entries(overrides)) {
    Object.assign(sections[id], extra);
  }
  return sections;
}

const FULL_SLOTS = {
  1: { text: '바쁘게 사는 사람', isDeferred: false },
  2: { text: '여유로운', isDeferred: false },
  3: { text: '혼자 여행', isDeferred: false },
  5: { text: '충만한', isDeferred: false },
};
const FULL_EXTRACTED = { current: '바쁘게 사는 사람', keyword: '여유로운', want: '혼자 여행', feeling: '충만한' };

function textComplete(extra = {}) {
  return {
    status: 'text_complete',
    slots: { ...FULL_SLOTS },
    extractedSlots: { ...FULL_EXTRACTED },
    ...extra,
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

// ── 1) 온보딩 가드: 빈 상태로 /dashboard 직접 진입 → /(랜딩) 리다이렉트 ──
{
  const { ctx, page } = await newPage(null);
  await page.goto(`${BASE}/dashboard`);
  await page.waitForTimeout(1500);
  ok('P1-4 온보딩 미완료 /dashboard → / 리다이렉트', new URL(page.url()).pathname === '/', page.url());
  await ctx.close();
}

// ── 2) 온보딩 Act5 완료 → /dashboard 직행 (welcome 삭제) + SIX_AREAS 파생 라벨 ──
{
  const { ctx, page } = await newPage({
    sections: seedSections(), onboardingStep: 5, userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/onboarding`);
  await page.waitForTimeout(1200);
  ok('P0-3 Act5 파생 부제(몸·마음·에너지)', await page.getByText('몸·마음·에너지').isVisible().catch(() => false));
  ok('P0-4 관계 부제(연인·가족·친구)', await page.getByText('연인·가족·친구').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v621-onboarding-act5.png`, fullPage: true });
  await page.getByText('비전보드 시작하기').click();
  await page.waitForTimeout(1500);
  ok('P1-4 온보딩 완료 → /dashboard 직행', new URL(page.url()).pathname === '/dashboard', page.url());
  ok('P1-5 이미지 없으면 보드 CTA 미노출', !(await page.getByText('나의 비전보드 보러가기').isVisible().catch(() => false)));
  await ctx.close();
}

// ── 3) /section/1 질문 렌더 회귀 (P0-2 단일화) ──
{
  const { ctx, page } = await newPage({
    sections: seedSections(), onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/section/1`);
  await page.waitForTimeout(1200);
  ok('첫 질문 표시', await page.getByText('지금 너는 어떤 사람으로 살고 있어?').isVisible().catch(() => false));
  ok('예시(example) 표시', await page.getByText('열심히 사는데 방향이 아직 안 보이는 사람').isVisible().catch(() => false));
  await page.getByText('답변 도와줘').click();
  await page.waitForTimeout(400);
  ok('도움질문(helpQuestions) 표시', await page.getByText('지금 네 삶에서 가장 많은 에너지를 쓰는 게 뭐야?').isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v621-section1.png`, fullPage: true });
  await ctx.close();
}

// ── 4) /review: 캐논 라벨 + 상태 기반 CTA (P0-3·P0-5) ──
{
  const seed = {
    sections: seedSections({
      1: textComplete({ sceneText: '카페 창가에서 책 읽는 하루', miniStory: '3년 뒤의 나는 여유롭다.' }),
      2: textComplete({ sceneText: '아침 러닝 후 개운한 하루' }),
      3: textComplete(), 4: textComplete(), 5: textComplete(), 6: textComplete(),
    }),
    onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
  };
  const { ctx, page } = await newPage(seed);
  await page.goto(`${BASE}/review`);
  await page.waitForTimeout(1500);
  ok('P0-3 캐논 라벨(방향 키워드)', (await page.getByText('방향 키워드').count()) > 0);
  ok('P0-3 구 라벨(이뤄졌을때) 없음', (await page.getByText('이뤄졌을때').count()) === 0);
  ok('P2-5 새 헤더 부제', await page.getByText('한자리에 모았어').isVisible().catch(() => false));
  await page.getByText('미래의 하루 그리기 시작').click();
  await page.waitForTimeout(1500);
  ok('P0-5 review CTA → 상태 기반(/scene/3)', new URL(page.url()).pathname === '/scene/3', page.url());
  await page.screenshot({ path: `${OUT}/v621-review-cta-landing.png`, fullPage: true });
  await ctx.close();

  // ProcessBar 단계별 목적지 (P1-2) — 각 단계가 활성화되는 진행 상태로 시드
  const scene = { sceneText: '하루 묘사' };
  const sceneStory = { sceneText: '하루 묘사', miniStory: '이야기' };
  const stepCases = [
    // step2 활성(텍스트 6/6, scene 일부): 첫 sceneText 없는 섹션 → /scene/3
    ['하루 그리기', '/scene/3', { 1: textComplete(scene), 2: textComplete(scene), 3: textComplete(), 4: textComplete(), 5: textComplete(), 6: textComplete() }],
    // step3 활성(scene 6/6, story 일부): 첫 miniStory 없는 섹션 → /moment/3
    ['미래 스토리', '/moment/3', { 1: textComplete(sceneStory), 2: textComplete(sceneStory), 3: textComplete(scene), 4: textComplete(scene), 5: textComplete(scene), 6: textComplete(scene) }],
    // step4 활성(story 6/6, 이미지 미완): 첫 미완성 섹션 → /scenes/1
    ['사진 담기', '/scenes/1', { 1: textComplete(sceneStory), 2: textComplete(sceneStory), 3: textComplete(sceneStory), 4: textComplete(sceneStory), 5: textComplete(sceneStory), 6: textComplete(sceneStory) }],
  ];
  for (const [label, expectPath, overrides] of stepCases) {
    const { ctx: c2, page: p2 } = await newPage({
      sections: seedSections(overrides), onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
    });
    await p2.goto(`${BASE}/dashboard`);
    await p2.waitForTimeout(1200);
    await p2.getByText(label, { exact: true }).click();
    await p2.waitForTimeout(1500);
    ok(`P1-2 ProcessBar '${label}' → ${expectPath}`, new URL(p2.url()).pathname === expectPath, p2.url());
    await c2.close();
  }
}

// ── 5) /scene/1: 위치 안내 쿠션 + InlineInput 예시 (P2-2·P2-3) ──
{
  const { ctx, page } = await newPage({
    sections: seedSections({ 1: textComplete() }),
    onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/scene/1`);
  await page.waitForTimeout(1200);
  ok('P2-3 쿠션(질문은 끝났어)', await page.getByText('질문은 끝났어').isVisible().catch(() => false));
  ok('P2-2 InlineInput 예시 패널', await page.getByText('이런 식으로 써봐').isVisible().catch(() => false));
  ok('P0-6 뒤로가기 ← 글리프', await page.getByText('←').first().isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v621-scene1.png`, fullPage: true });
  await ctx.close();
}

// ── 6) /scenes/1: 용어(순간·사진 담기) + 저장 → 완료 시트 → 다음 섹션 (P1-1·P2-1) ──
{
  const { ctx, page } = await newPage({
    sections: seedSections({
      1: textComplete({
        sceneText: '카페 창가', miniStory: '이야기', situationText: '순간',
        imageDescriptions: ['넓은 창가에 앉은 나', '책장을 넘기는 손', '햇살이 비치는 테이블'],
        imageKeywords: ['cafe window', 'reading hands', 'sunny table'],
      }),
    }),
    onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/scenes/1`);
  await page.waitForTimeout(1500);
  ok('P2-1 헤더(사진 담기)', await page.getByText('나 · 사진 담기').isVisible().catch(() => false));
  ok('P2-1 카드 라벨(순간 1)', await page.getByText('순간 1', { exact: true }).isVisible().catch(() => false));
  ok('P2-1 구 라벨(장면 1) 없음', (await page.getByText('장면 1', { exact: true }).count()) === 0);
  await page.getByText('저장', { exact: true }).click();
  await page.waitForTimeout(1200);
  ok('P1-1 완료 시트 표시', await page.getByText('완성! 1/6이야').isVisible().catch(() => false));
  const nextBtn = page.getByText('다음:');
  ok('P1-1 다음 섹션 CTA 표시', await nextBtn.isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v621-complete-sheet.png` });
  await nextBtn.click();
  await page.waitForTimeout(1500);
  ok('P1-1 다음 섹션 착지(/section/2)', new URL(page.url()).pathname === '/section/2', page.url());
  await ctx.close();
}

// ── 7) /finish: 마운트 부작용 제거 + complete 피날레 (P0-5·P2-4) ──
{
  const { ctx, page } = await newPage({
    sections: seedSections({
      1: textComplete(), 2: textComplete(), 3: textComplete(),
      4: textComplete(), 5: textComplete(), 6: textComplete(),
    }),
    onboardingDone: true, userName: '헬렌', startedAt: Date.now(),
    oneSentence: '여유롭게 내 페이스로 사는 사람.',
    futureDayStory: '아침 햇살에 눈을 뜬다. 오늘도 내 하루다.',
  });
  await page.goto(`${BASE}/finish`);
  await page.waitForTimeout(1500);
  const finishedAtBefore = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vision-board-data') ?? '{}').finishedAt ?? null
  );
  ok('P0-5 마운트만으로 finishedAt 미기록', finishedAtBefore === null, String(finishedAtBefore));
  await page.getByText('비전보드 완성').click();
  await page.waitForTimeout(800);
  ok('P2-4 이름 포함 축하 헤드라인', await page.getByText('헬렌의 비전보드가 완성됐어').isVisible().catch(() => false));
  ok('P2-4 한 문장 인용', await page.getByText('여유롭게 내 페이스로 사는 사람.').isVisible().catch(() => false));
  ok('P2-4 키워드 칩', (await page.getByText('여유로운', { exact: true }).count()) > 0);
  ok('P0-3 이미지보드 용어 없음', (await page.getByText('이미지보드').count()) === 0);
  const finishedAtAfter = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('vision-board-data') ?? '{}').finishedAt ?? null
  );
  ok('P0-5 완성 확정 시 finishedAt 기록', finishedAtAfter !== null);
  await page.screenshot({ path: `${OUT}/v621-finish-complete.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
if (errors.length) console.log('\n[pageerror 수집]\n' + [...new Set(errors)].join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL'));
process.exit(fails.length ? 1 : 0);
