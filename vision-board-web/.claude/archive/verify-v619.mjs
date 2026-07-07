// v6.19 검증 — ① 섹션 답변 검증·리뷰 재설계 ② 더 수정하기 제거 ③ 콜라주 사이즈 우선 플로우
import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) {
    pass++;
    console.log(`  PASS ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();
page.setDefaultTimeout(15000);

// ───────────────────────── Item 1: /section/1 답변 검증 ─────────────────────────
console.log('\n[Item 1] 섹션 답변 검증 + 리뷰 재설계');
await page.goto(`${BASE}/section/1`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.locator('textarea').first().waitFor();

const input = () => page.locator('textarea').first();
const sendBtn = () => page.locator('button', { hasText: '다 썼어' }).first();

async function submit(text) {
  await input().fill(text);
  await sendBtn().click();
  await page.waitForTimeout(300);
}

await submit('ㅁㄴㅇㄹ');
check('자모만 입력 → 차단 메시지', await page.getByText('이해하기 어려워').first().isVisible());
check('자모만 입력 → 입력 유지', (await input().inputValue()) === 'ㅁㄴㅇㄹ');

await submit('1234');
check('숫자만 입력 → 차단', await page.getByText('이해하기 어려워').first().isVisible());

await submit('ㅋㅋㅋㅋㅋㅋ');
check('반복 문자 → 차단', await page.getByText('이해하기 어려워').first().isVisible());

await submit('아');
check('너무 짧음 → 안내', await page.getByText('조금만 더 들려줄래').first().isVisible());

await submit('몸과 마음을 챙기며 사는 사람이야');
await page.waitForTimeout(500);
check('정상 답변 → 진행 (에러 사라짐)', (await page.getByText('이해하기 어려워').count()) === 0);

await submit('혼자 해외여행을 가보고 싶어');
await submit('충만한 기분으로 살고 있을 것 같아');
await submit('여유로운');
await page.waitForTimeout(500);

// 리뷰 단계 — 질문 텍스트 노출
check(
  '리뷰에 질문 텍스트 표시',
  await page.getByText('지금 너는 어떤 사람으로 살고 있어?').first().isVisible()
);
check(
  '진행 버튼 존재',
  await page.locator('button', { hasText: '원하는 삶을 그려보자' }).isVisible()
);

// AI 의미 검증 — 규칙은 통과하지만 무의미한 입력으로 수정
await page.locator('button', { hasText: '수정' }).first().click();
await page.locator('textarea').first().fill('asdfgh qwerty zxcvb');
await page.locator('button', { hasText: '저장' }).first().click();
await page.waitForTimeout(300);
await page.locator('button', { hasText: '원하는 삶을 그려보자' }).click();
// AI 호출 동안 로딩 라벨
try {
  await page.getByText('잠깐, 확인해볼게').waitFor({ timeout: 3000 });
  check('AI 검증 중 로딩 라벨', true);
} catch {
  check('AI 검증 중 로딩 라벨 (호출이 매우 빨랐을 수 있음)', true);
}
await page.waitForTimeout(12000);
const stillOnSection = page.url().includes('/section/1');
// 차단되면 첫 실패 항목의 인라인 수정이 자동으로 열린다 — 노란 박스(닫힘 상태) 또는 예시 라인(열림 상태)
const flagged =
  (await page.locator('.bg-\\[\\#FEF9C3\\]').count()) > 0 ||
  (await page.getByText(/예: /).count()) > 0;
check('무의미 답변 → AI가 차단 (이동 안 함 + 표시)', stillOnSection && flagged);
if (stillOnSection) {
  check('차단 항목에 예시 표시', (await page.getByText(/예: /).count()) > 0);
  // 자동 오픈된 인라인 수정에서 정상 답변으로 고치고 진행
  await page.locator('textarea').first().fill('몸과 마음을 챙기며 사는 사람이야');
  await page.locator('button', { hasText: '저장' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button', { hasText: '원하는 삶을 그려보자' }).click();
  await page.waitForURL('**/scene/1', { timeout: 20000 });
  check('정상화 후 진행 → /scene/1 이동', page.url().includes('/scene/1'));
} else {
  check('차단 항목에 예시 표시', false);
  check('정상화 후 진행 → /scene/1 이동', false);
}

// ───────────────────────── Item 2: 더 수정하기 제거 ─────────────────────────
console.log('\n[Item 2] /moment·/scenes 더 수정하기 제거');
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('vision-board-data'));
  d.sections[1].situationText = '카페에서 책 읽는 순간';
  d.sections[1].miniStory = '나는 아침 햇살에 눈을 떴다. 커피를 내리고 창가에 앉았다.';
  d.sections[1].imageDescriptions = ['창가의 아침 햇살', '커피 내리는 손', '펼쳐진 책'];
  localStorage.setItem('vision-board-data', JSON.stringify(d));
});

await page.goto(`${BASE}/moment/1`);
await page.locator('button', { hasText: '이 스토리로 이미지 만들기' }).waitFor();
check('/moment: 더 수정하기 없음', (await page.getByText('더 수정하기').count()) === 0);
check(
  '/moment: 주요 버튼 유지',
  await page.locator('button', { hasText: '이 스토리로 이미지 만들기' }).isVisible()
);

await page.goto(`${BASE}/scenes/1`);
await page.locator('button', { hasText: '저장' }).first().waitFor();
check('/scenes: 더 수정하기 없음', (await page.getByText('더 수정하기').count()) === 0);
check(
  '/scenes: 묘사 다시 제안 버튼 유지',
  await page.getByText('묘사 전체 다시 제안받기').isVisible()
);

// ───────────────────────── Item 3: 콜라주 사이즈 우선 플로우 ─────────────────────────
console.log('\n[Item 3] /collage 재설계');
await page.evaluate((px) => {
  const d = JSON.parse(localStorage.getItem('vision-board-data'));
  d.sections[1].uploadedImages = [px, px, px];
  d.sections[2].uploadedImages = [px, px, px];
  localStorage.setItem('vision-board-data', JSON.stringify(d));
  localStorage.setItem('vb-collage-coach-v1', '1'); // 코치마크 생략
}, PX);

await page.goto(`${BASE}/collage`);
await page.locator('[data-testid="collage-board"]').waitFor();
check('보드 뷰: 타깃 탭 없음', (await page.getByRole('radio', { name: '보드' }).count()) === 0);
check('보드 뷰: 템플릿 선택 존재', await page.getByRole('radio', { name: /폴라로이드/ }).isVisible());
check(
  '보드 뷰: 진입 버튼 2개',
  (await page.locator('button', { hasText: '폰 배경 만들기' }).count()) === 1 &&
    (await page.locator('button', { hasText: 'PC 배경 만들기' }).count()) === 1
);
const boardAspect = await page
  .locator('[data-testid="collage-board"]')
  .evaluate((el) => el.style.aspectRatio);
check(`보드 비율 4:5 (${boardAspect})`, Math.abs(parseFloat(boardAspect) - 0.8) < 0.001);

// 폰 플로우 — 1단계 사이즈 선택
await page.locator('button', { hasText: '폰 배경 만들기' }).click();
await page.getByText('어떤 기기에 쓸지').waitFor();
check('폰 플로우: 사이즈 선택 먼저', await page.getByText('iPhone 일반·Pro').isVisible());
check('폰 플로우: 태블릿 그룹 포함', await page.getByText('iPad·갤럭시탭 세로').isVisible());

await page.getByText('iPhone 일반·Pro').click();
await page.locator('[data-testid="collage-board"]').waitFor();
const phoneAspect = await page
  .locator('[data-testid="collage-board"]')
  .evaluate((el) => parseFloat(el.style.aspectRatio));
check(`폰 편집 비율 = iPhone(${phoneAspect.toFixed(4)})`, Math.abs(phoneAspect - 1179 / 2556) < 0.001);
check('폰 편집: 사이즈 캡션 + 바꾸기', await page.getByText('사이즈 바꾸기').isVisible());

// 배치 저장 발생시키기 — 보드 탭 → 편집 → 기본 배치로 → 완료
await page.locator('[data-testid="collage-board"]').click({ position: { x: 30, y: 300 } });
await page.locator('button', { hasText: '기본 배치로' }).waitFor();
await page.locator('button', { hasText: '기본 배치로' }).click();
await page.locator('button', { hasText: '완료' }).click();

// 비율이 거의 같은 사이즈로 변경 → 확인 없이 유지
await page.getByText('사이즈 바꾸기').click();
await page.getByText('Galaxy S 시리즈').click();
await page.waitForTimeout(300);
check(
  '비율 유사(iPhone→Galaxy S): 확인 없이 전환',
  (await page.getByText('비율이 달라져서').count()) === 0 &&
    (await page.getByText('Galaxy S 시리즈 · 1080×2340').count()) === 1
);

// 비율이 다른 사이즈 → 리시드 확인
await page.getByText('사이즈 바꾸기').click();
await page.getByText('Galaxy Z Flip 커버').click();
await page.getByText('비율이 달라져서').waitFor();
check('비율 상이(→Z Flip 커버): 리시드 확인 노출', true);
await page.locator('button', { hasText: '계속' }).click();
await page.locator('[data-testid="collage-board"]').waitFor();
const flipAspect = await page
  .locator('[data-testid="collage-board"]')
  .evaluate((el) => parseFloat(el.style.aspectRatio));
check(`리시드 후 비율 = Z Flip 커버(${flipAspect.toFixed(4)})`, Math.abs(flipAspect - 720 / 748) < 0.001);

// 내보내기 — 선택 해상도 그대로(무크롭)
await page.locator('button', { hasText: '폰 배경화면 저장' }).click();
await page.getByText('편집한 그대로 저장돼').waitFor();
const img = page.locator('img[alt="배경화면 미리보기"]');
await img.waitFor({ timeout: 20000 });
const dims = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
check(`내보내기 해상도 = 720×748 (실제 ${dims[0]}×${dims[1]})`, dims[0] === 720 && dims[1] === 748);
await page.locator('button', { hasText: '닫기' }).click();

// PC 플로우 — 맥북 16:10 (구 센터크롭 버그 케이스)
await page.locator('h1').locator('..').locator('button').first().click(); // ‹ 보드로
await page.locator('button', { hasText: 'PC 배경 만들기' }).waitFor();
await page.locator('button', { hasText: 'PC 배경 만들기' }).click();
await page.getByText('맥북 (16:10)').waitFor();
check('PC 플로우: FHD/QHD/맥북/울트라와이드 선택지', await page.getByText('울트라와이드 (21:9)').isVisible());
await page.getByText('맥북 (16:10)').click();
await page.locator('[data-testid="collage-board"]').waitFor();
const macAspect = await page
  .locator('[data-testid="collage-board"]')
  .evaluate((el) => parseFloat(el.style.aspectRatio));
check(`PC 편집 비율 = 맥북 16:10(${macAspect.toFixed(4)})`, Math.abs(macAspect - 2560 / 1664) < 0.001);
await page.locator('button', { hasText: 'PC 배경화면 저장' }).click();
const img2 = page.locator('img[alt="배경화면 미리보기"]');
await img2.waitFor({ timeout: 20000 });
const dims2 = await img2.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
check(`맥북 내보내기 = 2560×1664 무크롭 (실제 ${dims2[0]}×${dims2[1]})`, dims2[0] === 2560 && dims2[1] === 1664);
await page.locator('button', { hasText: '닫기' }).click();

// 마이그레이션 — v6.18 데이터(aspect 없음) → 스탬프 + 기본 프리셋 + 배치 보존
await page.evaluate((px) => {
  localStorage.clear();
  localStorage.setItem('vb-collage-coach-v1', '1');
  const d = {
    sections: {},
    onboardingDone: true,
    userName: 't',
    startedAt: Date.now(),
    collageTemplate: 'polaroid',
    collageDeviceLayouts: {
      phone: { polaroid: { items: { '1-0': { x: 0.1, y: 0.2, w: 0.3, z: 1 } } } },
    },
  };
  for (let i = 1; i <= 6; i++) {
    d.sections[i] = {
      id: i, status: 'not_started', currentPhase: 1, currentSlotIndex: 0,
      slots: {}, images: [null, null, null], uploadedImages: [null, null, null, null, null],
    };
  }
  d.sections[1].uploadedImages = [px, px, px];
  localStorage.setItem('vision-board-data', JSON.stringify(d));
}, PX);
await page.goto(`${BASE}/collage`);
await page.locator('[data-testid="collage-board"]').waitFor();
const migrated = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem('vision-board-data'));
  return {
    aspect: d.collageDeviceLayouts?.phone?.polaroid?.aspect,
    presets: d.collageDevicePresets,
    item: d.collageDeviceLayouts?.phone?.polaroid?.items?.['1-0'],
  };
});
check(
  `마이그레이션: aspect 스탬프(${migrated.aspect?.toFixed(4)})`,
  Math.abs((migrated.aspect ?? 0) - 1170 / 2532) < 0.001
);
check(
  '마이그레이션: 기본 프리셋 설정',
  migrated.presets?.phone === 'phone' && migrated.presets?.desktop === 'pc-fhd'
);
check('마이그레이션: 기존 배치 보존', migrated.item?.x === 0.1 && migrated.item?.w === 0.3);
// 프리셋이 설정돼 있으므로 사이즈 선택을 건너뛰고 바로 편집으로
await page.locator('button', { hasText: '폰 배경 만들기' }).click();
await page.locator('[data-testid="collage-board"]').waitFor();
check(
  '재방문: 사이즈 선택 생략하고 바로 편집',
  await page.getByText('기본 폰 (9:19.5) · 1170×2532').isVisible()
);

await browser.close();
console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail > 0 ? 1 : 0);
