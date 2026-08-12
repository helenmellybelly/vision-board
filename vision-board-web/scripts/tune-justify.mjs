// 저스티파이드 가드레일 역산 스윕 (v10) — node scripts/tune-justify.mjs
//
// 왜 있나: 가드레일 상수를 눈대중으로 조이면 "채움률 47%짜리 성긴 배치가 남는" v9의 실패를
// 되풀이한다. 후보 공간 전체를 쓸어 실제로 어떤 배치가 살아남는지 보고, 그 데이터로 임계를 정한다.
//
// CI에는 넣지 않는다(느리고, 리포트지 계약이 아니다). 상수를 만질 때마다 손으로 돌린다.
// 계약 고정은 scripts/verify-justify.js가 한다.

import { solveTemplate } from '../lib/collageSolve';
import { clampRatio } from '../lib/collageJustify';
import { PORTRAIT_R, LANDSCAPE_R, regionFor } from '../lib/collageTokens';

// 실제로 쓰이는 비율만 — /collage는 폰·PC 2탭이고, 비율은 WALLPAPER_PRESETS가 정한다.
// v9 검증이 쓰던 4:5 '보드'는 v7.5에서 탭이 사라져 더는 도달할 수 없는 비율이다.
const ASPECTS = {
  zflipMain: 1080 / 2640, // 가장 세로로 긴 프리셋
  phone: 9 / 19.5,
  tablet: 1668 / 2388,
  zflipCover: 720 / 748, // 거의 정사각
  fhd: 16 / 9,
  macbook: 2560 / 1664,
  ultrawide: 3440 / 1440, // 가장 가로로 긴 프리셋
};
const TEMPLATES = ['editorial', 'magazine', 'studio'];
const MIXES = {
  allPortrait: [0.5625],
  allLandscape: [1.7778],
  allSquare: [1.0],
  mixed: [0.5625, 0.75, 1.0, 1.3333, 1.7778],
  extreme: [0.42, 2.4],
};

const items = (n, mix) =>
  Array.from({ length: n }, (_, i) => ({
    key: `${(i % 6) + 1}-${Math.floor(i / 6)}`,
    ratio: mix[(i * 7) % mix.length],
  }));

const rows = [];
for (const [aName, aspect] of Object.entries(ASPECTS)) {
  for (const template of TEMPLATES) {
    const region = regionFor(template, aspect);
    const regionArea = region.w * region.h;
    for (const [mName, mix] of Object.entries(MIXES)) {
      for (let n = 1; n <= 18; n++) {
        const its = items(n, mix);
        const t0 = process.hrtime.bigint();
        const res = solveTemplate(template, its, aspect);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;

        const rects = Object.values(res.rects);
        const area = rects.reduce((a, r) => a + r.w * r.h, 0);
        // 방향 적합도: 세로 사진의 박스 px비 < 1, 가로 사진의 박스 px비 > 1
        let misfit = 0;
        let minShort = 1;
        for (const it of its) {
          const r = res.rects[it.key];
          if (!r) continue;
          const px = (r.w / r.h) * aspect;
          const cr = clampRatio(it.ratio);
          if (cr < PORTRAIT_R && px >= 1) misfit++;
          if (cr > LANDSCAPE_R && px <= 1) misfit++;
          minShort = Math.min(minShort, Math.min(r.w, r.h * (1 / aspect)));
        }
        rows.push({
          aspect: aName,
          template,
          mix: mName,
          n,
          tier: res.tier,
          fill: area / regionArea,
          crop: res.crop,
          rowsN: res.spec.rows.length,
          hero: res.spec.hero ? 1 : 0,
          misfit,
          minShort,
          ms,
        });
      }
    }
  }
}

const fmt = (v, d = 3) => v.toFixed(d);
const agg = (list) => ({
  n: list.length,
  t1: list.filter((r) => r.tier === 1).length,
  t2: list.filter((r) => r.tier === 2).length,
  t3plus: list.filter((r) => r.tier >= 3).length,
  fillMin: Math.min(...list.map((r) => r.fill)),
  fillAvg: list.reduce((a, r) => a + r.fill, 0) / list.length,
  cropMax: Math.max(...list.map((r) => r.crop)),
  misfit: list.reduce((a, r) => a + r.misfit, 0),
  shortMin: Math.min(...list.map((r) => r.minShort)),
  msMax: Math.max(...list.map((r) => r.ms)),
});

// ── 실사용 케이스 ── 6섹션 × 3장 = 최대 18장, 폰 사진(세로)과 Unsplash(가로)가 섞인다.
// 평균에 묻히면 안 되는 구간이라 따로 본다.
console.log('== 실사용 (폰 9:19.5 · PC 16:9 × mixed) ==');
for (const aName of ['phone', 'fhd']) {
  for (const t of TEMPLATES) {
    const line = [6, 9, 12, 15, 18]
      .map((n) => {
        const r = rows.find(
          (x) => x.aspect === aName && x.template === t && x.mix === 'mixed' && x.n === n,
        );
        return `n${n}:${r.tier === 1 ? '◎' : r.tier === 2 ? '△' : '□'}${fmt(r.fill, 2)}/${fmt(r.crop, 2)}`;
      })
      .join('  ');
    console.log(`  ${aName.padEnd(5)} ${t.padEnd(10)} ${line}`);
  }
}
console.log('  (◎=무크롭 꽉참 △=크롭 후 꽉참 □=앰비언트 · 값은 채움률/크롭)\n');

console.log('== 템플릿 × 비율 ==');
for (const t of TEMPLATES) {
  for (const m of Object.keys(MIXES)) {
    const a = agg(rows.filter((r) => r.template === t && r.mix === m));
    console.log(
      `${t.padEnd(10)} ${m.padEnd(13)} tier1=${String(a.t1).padStart(2)}/${a.n} t2=${a.t2} t3+=${a.t3plus}  ` +
        `fill min=${fmt(a.fillMin)} avg=${fmt(a.fillAvg)}  crop≤${fmt(a.cropMax)}  ` +
        `misfit=${a.misfit}  short≥${fmt(a.shortMin)}  ${fmt(a.msMax, 1)}ms`,
    );
  }
}

console.log('\n== 앰비언트(tier≥3) 발동 — n≥4에서 0이어야 계약 통과 ==');
const amb = rows.filter((r) => r.tier >= 3);
if (!amb.length) console.log('없음');
for (const r of amb) {
  console.log(`  ${r.aspect}/${r.template}/${r.mix} n=${r.n} tier=${r.tier} fill=${fmt(r.fill)}`);
}

console.log('\n== 채움률 하위 12 (n≥4, tier≤2) ==');
rows
  .filter((r) => r.n >= 4 && r.tier <= 2)
  .sort((a, b) => a.fill - b.fill)
  .slice(0, 12)
  .forEach((r) =>
    console.log(
      `  fill=${fmt(r.fill)} ${r.aspect}/${r.template}/${r.mix} n=${r.n} rows=${r.rowsN} crop=${fmt(r.crop)}`,
    ),
  );

console.log('\n== 방향 부적합 사례 ==');
const bad = rows.filter((r) => r.misfit > 0);
if (!bad.length) console.log('없음');
bad
  .slice(0, 15)
  .forEach((r) => console.log(`  ${r.aspect}/${r.template}/${r.mix} n=${r.n} misfit=${r.misfit}`));

console.log('\n== 최소 사진 짧은 변 하위 8 ==');
rows
  .slice()
  .sort((a, b) => a.minShort - b.minShort)
  .slice(0, 8)
  .forEach((r) =>
    console.log(`  short=${fmt(r.minShort, 4)} ${r.aspect}/${r.template}/${r.mix} n=${r.n}`),
  );

const overall = agg(rows);
console.log(
  `\n== 전체 ${overall.n}건 · tier1 ${overall.t1} / tier2 ${overall.t2} / tier3+ ${overall.t3plus} · ` +
    `fill min ${fmt(overall.fillMin)} · crop ≤ ${fmt(overall.cropMax)} · 최대 ${fmt(overall.msMax, 1)}ms ==`,
);
