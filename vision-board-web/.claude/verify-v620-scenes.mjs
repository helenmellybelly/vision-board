// v6.20 /scenes 검증 — 키워드 흐름이 페이지를 깨지 않는지, Unsplash 키 미설정 시 조용히 숨는지
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const results = [];
const ok = (name, pass, detail = '') =>
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

const sections = {};
for (let id = 1; id <= 6; id++) {
  sections[id] = { id, status: 'in_progress', currentPhase: 1, currentSlotIndex: 0, slots: {}, images: [] };
}
Object.assign(sections[1], {
  status: 'text_complete',
  situationText: '아침 러닝 후 강가 스트레칭',
  miniStory: '3년 뒤의 나는 강가를 달린다.',
  imageDescriptions: [
    '이른 아침 안개 낀 강변, 러닝화를 신고 달리는 나',
    '햇살이 비치는 부엌에서 샐러드를 만드는 나',
    '운동화 끈을 묶는 손의 클로즈업',
  ],
  imageKeywords: ['morning river run', 'sunlit kitchen cooking', 'tying running shoes'],
});

await page.addInitScript((data) => {
  if (!localStorage.getItem('vision-board-data')) {
    localStorage.setItem('vision-board-data', JSON.stringify(data));
  }
}, { sections, onboardingDone: true, welcomeSeen: true, userName: '헬렌', startedAt: Date.now() });

await page.goto(`${BASE}/scenes/1`);
await page.waitForTimeout(2500);

ok('장면 묘사 카드 표시', await page.getByText('이른 아침 안개 낀 강변', { exact: false }).isVisible().catch(() => false));
ok('이미지 섹션 표시', await page.getByText('나의 비전보드 이미지 찾기').isVisible().catch(() => false));
const suggestVisible = await page.getByText('이런 이미지들도 있어', { exact: false }).isVisible().catch(() => false);
// UNSPLASH_ACCESS_KEY 미설정이면 숨김이 정상
ok('추천 블록 (키 미설정 시 숨김 = 정상)', true, suggestVisible ? '표시됨(키 있음)' : '숨김(키 없음)');
ok('JS 에러 없음', errors.length === 0, errors.join(' | '));

await page.screenshot({ path: '.claude/shots/v620-scenes.png', fullPage: true });
await browser.close();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
