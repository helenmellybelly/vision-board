// v6.20 검증 — 온보딩 Act4 카드 간격, /moment CTA 문구, /welcome 단계 순차 등장 + 텍스트 크기
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT = '.claude/shots';
mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:3000';

const results = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

function seedSections(extra1 = {}) {
  const sections = {};
  for (let id = 1; id <= 6; id++) {
    sections[id] = {
      id, status: 'in_progress', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [],
    };
  }
  Object.assign(sections[1], extra1);
  return sections;
}

const browser = await chromium.launch();

// ── 1) 온보딩 Act 4: 카드 간격 ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript((data) => {
    if (!localStorage.getItem('vision-board-data')) {
      localStorage.setItem('vision-board-data', JSON.stringify(data));
    }
  }, { sections: seedSections(), onboardingStep: 4, userName: '헬렌', startedAt: Date.now() });
  await page.goto(`${BASE}/onboarding`);
  await page.waitForTimeout(1200);
  const title = page.getByText('원하는 삶을 현실로 믿게 해줘');
  ok('onboarding act4 카드 표시', await title.isVisible().catch(() => false));
  // 제목과 설명 사이 간격(mb-1=4px) 적용 확인
  const gap = await page.evaluate(() => {
    const els = [...document.querySelectorAll('p')];
    const t = els.find((e) => e.textContent === '원하는 삶을 현실로 믿게 해줘');
    if (!t) return null;
    const d = t.nextElementSibling;
    if (!d) return null;
    return d.getBoundingClientRect().top - t.getBoundingClientRect().bottom;
  });
  ok('카드 제목-설명 간격 > 2px', gap !== null && gap > 2, `gap=${gap?.toFixed(1)}px`);
  await page.screenshot({ path: `${OUT}/v620-onboarding-act4.png`, fullPage: true });
  await ctx.close();
}

// ── 2) /moment/1 CTA 문구 ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript((data) => {
    if (!localStorage.getItem('vision-board-data')) {
      localStorage.setItem('vision-board-data', JSON.stringify(data));
    }
  }, {
    sections: seedSections({
      situationText: '아침 러닝을 마치고 햇살 아래 스트레칭',
      miniStory: '3년 뒤의 나는 강가를 달린다.',
      status: 'text_complete',
    }),
    onboardingDone: true, welcomeSeen: true, userName: '헬렌', startedAt: Date.now(),
  });
  await page.goto(`${BASE}/moment/1`);
  await page.waitForTimeout(1200);
  const cta = page.getByText('비전보드 이미지 만들기');
  ok('/moment CTA = 비전보드 이미지 만들기', await cta.isVisible().catch(() => false));
  const old = page.getByText('이 스토리로 이미지 만들기');
  ok('구 CTA 문구 없음', !(await old.isVisible().catch(() => false)));
  await page.screenshot({ path: `${OUT}/v620-moment-cta.png`, fullPage: true });
  await ctx.close();
}

// ── 3) /welcome 순차 등장 + 텍스트 크기 ──
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/welcome`);
  // 등장 직후: 마지막 단계는 아직 안 보임(opacity 0), 첫 단계는 보임 → 순차 등장 동작 확인
  await page.waitForTimeout(350);
  const opacityOf = (txt) => page.evaluate((t) => {
    const els = [...document.querySelectorAll('p')];
    const el = els.find((e) => e.textContent === t);
    if (!el) return null;
    const card = el.closest('.animate-slideUp');
    return card ? Number(getComputedStyle(card).opacity) : null;
  }, txt);
  const firstEarly = await opacityOf('나 발견하기');
  const lastEarly = await opacityOf('완성');
  ok('순차 등장: 초반에 1단계 표시', firstEarly !== null && firstEarly > 0.5, `opacity=${firstEarly}`);
  ok('순차 등장: 초반에 4단계 미표시', lastEarly !== null && lastEarly < 0.5, `opacity=${lastEarly}`);
  await page.waitForTimeout(2000);
  const lastLate = await opacityOf('완성');
  ok('순차 등장: 이후 4단계 표시', lastLate !== null && lastLate > 0.9, `opacity=${lastLate}`);
  // 텍스트 크기: 제목 17px(heading), 설명 15px(body)
  const sizes = await page.evaluate(() => {
    const els = [...document.querySelectorAll('p')];
    const t = els.find((e) => e.textContent === '나 발견하기');
    const d = t?.nextElementSibling;
    return {
      title: t ? getComputedStyle(t).fontSize : null,
      desc: d ? getComputedStyle(d).fontSize : null,
    };
  });
  ok('단계 제목 17px', sizes.title === '17px', sizes.title ?? 'null');
  ok('단계 설명 15px', sizes.desc === '15px', sizes.desc ?? 'null');
  const btn = page.getByText('시작할게 →');
  ok('시작할게 버튼 표시', await btn.isVisible().catch(() => false));
  await page.screenshot({ path: `${OUT}/v620-welcome.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL'));
process.exit(fails.length ? 1 : 0);
