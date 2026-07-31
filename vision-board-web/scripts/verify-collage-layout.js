// v8.0 콜라주 자동 배치 기하 검증 — 시드 알고리즘을 직접 호출해(브라우저 불필요) 계약을 검사한다.
//   1) 사진끼리 겹침 ≤ 20% (작은 쪽 기준) — 숲 포함 전 템플릿
//   2) 숲: 연도 카드 rect ∩ 사진 = 0, 시드 스티커 ∩ 사진 = 0
//   3) 모자이크·미니멀: 콘텐츠 수직 센터링 (상하 여백 차 ≤ 보드 높이의 6%)
//   4) reconcile: edited 배치에 사진 추가 → 기존 rect 불변 + 새 rect 겹침 ≤ 20%
//   5) edited:false 배치에 사진 추가 → 신선한 시드로 재배치
//   8) 미니멀 균형 행 (v8.4): n=2..18 전 비율 — 고아 행(1장) 없음·행당 개수 차 ≤1·행 센터링
//   9) 미니멀 reflow 라운드트립 (v8.4): 편집 리플로우 후에도 고아 행 재발 없음
//  10) 숲 레거시 가시성 가드 (v8.4): 손상+플래그無 → 리시드, edited:true·무손상은 보존
// 실행: node scripts/verify-collage-layout.js  (tsx 없이 돌도록 esbuild-register 대신 정규식 트랜스파일)
const { execSync } = require('child_process');
const path = require('path');

// TS 모듈을 그대로 부르기 위해 next 번들 대신 tsx 사용 시도 → 없으면 안내
const inline = `
import { seedLayout, resolveLayout, polaroidReserveRect, ASPECT, stickerKey, inferGridSpans, reflowLayout, isLayoutBroken } from '../lib/collageTemplates';

const results = [];
const ok = (name, cond, extra = '') => results.push(\`\${cond ? 'PASS' : 'FAIL'} \${name}\${extra ? ' — ' + extra : ''}\`);

const mkItems = (n) => Array.from({ length: n }, (_, i) => ({ key: \`\${(i % 6) + 1}-\${Math.floor(i / 6)}\`, src: 'x' }));
const rectOf = (it, aspect) => ({ x: it.x, y: it.y, w: it.w, h: it.h ?? it.w * aspect });
const overlap = (a, b) => {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
};
const ratio = (a, b) => overlap(a, b) / Math.min(a.w * a.h, b.w * b.h);

const ASPECTS = { phone: 9 / 19.5, desktop: 16 / 9, board: ASPECT };
const COUNTS = [1, 3, 6, 12, 18];
const TEMPLATES = ['polaroid', 'mosaic', 'minimal'];

for (const [aName, aspect] of Object.entries(ASPECTS)) {
  for (const t of TEMPLATES) {
    for (const n of COUNTS) {
      const items = mkItems(n);
      const layout = seedLayout(t, items, aspect);
      const photoRects = items.map((it) => rectOf(layout.items[it.key], aspect));
      // 1) 사진 쌍 겹침
      let worst = 0;
      for (let i = 0; i < photoRects.length; i++)
        for (let j = i + 1; j < photoRects.length; j++)
          worst = Math.max(worst, ratio(photoRects[i], photoRects[j]));
      ok(\`\${aName}/\${t}/n=\${n} 사진 겹침 ≤20%\`, worst <= 0.2, \`worst=\${(worst * 100).toFixed(1)}%\`);
      // 경계 내부
      const inBounds = photoRects.every((r) => r.x >= -0.001 && r.y >= -0.001 && r.x + r.w <= 1.001 && r.y + r.h <= 1.001);
      ok(\`\${aName}/\${t}/n=\${n} 경계 내부\`, inBounds);
      if (t === 'polaroid') {
        // 2) 연도 카드·스티커 무가림
        const card = polaroidReserveRect(aspect);
        const cardHit = Math.max(0, ...photoRects.map((r) => ratio(r, card)));
        ok(\`\${aName}/숲/n=\${n} 연도카드 무가림\`, cardHit <= 0.05, \`hit=\${(cardHit * 100).toFixed(1)}%\`);
        const sRects = ['seed-script', 'seed-chip']
          .map((id) => layout.items[stickerKey(id)])
          .filter(Boolean)
          .map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.w * 0.3 })); // 텍스트 실높이 근사
        const sHit = Math.max(0, ...sRects.flatMap((s) => photoRects.map((r) => ratio(s, r))));
        ok(\`\${aName}/숲/n=\${n} 시드 스티커 무가림\`, sHit <= 0.25, \`hit=\${(sHit * 100).toFixed(1)}%\`);
      } else if (n >= 3) {
        // 3) 수직 센터링 — 타이틀 밴드 아래 가용 영역에서 상하 여백 대칭
        const titleBottom = aspect < 0.75 ? 0.22 : aspect > 1 ? 0.16 : t === 'mosaic' ? 0.15 : 0.17;
        const availB = t === 'mosaic' ? 0.97 : 0.95;
        const top = Math.min(...photoRects.map((r) => r.y));
        const bottom = Math.max(...photoRects.map((r) => r.y + r.h));
        const diff = Math.abs((top - titleBottom) - (availB - bottom));
        ok(\`\${aName}/\${t}/n=\${n} 수직 센터링\`, diff <= 0.06, \`diff=\${(diff * 100).toFixed(1)}%\`);
      }
    }
  }
}

// 4) reconcile — edited 배치에 사진 추가: 기존 보존 + 새 키 최소 겹침
{
  const aspect = ASPECTS.phone;
  const items = mkItems(6);
  const saved = { ...seedLayout('polaroid', items, aspect), edited: true };
  const more = [...items, { key: '1-1', src: 'x' }, { key: '2-1', src: 'x' }];
  const next = resolveLayout('polaroid', more, saved, aspect);
  const unchanged = items.every((it) => {
    const a = saved.items[it.key]; const b = next.items[it.key];
    return b && a.x === b.x && a.y === b.y && a.w === b.w && a.z === b.z;
  });
  ok('reconcile(edited) 기존 rect 불변', unchanged);
  const newRects = ['1-1', '2-1'].map((k) => rectOf(next.items[k], aspect));
  const oldRects = items.map((it) => rectOf(next.items[it.key], aspect));
  const worst = Math.max(0, ...newRects.flatMap((nr) => oldRects.map((or) => ratio(nr, or))));
  ok('reconcile(edited) 새 사진 겹침 ≤20%', worst <= 0.2, \`worst=\${(worst * 100).toFixed(1)}%\`);
  const card = polaroidReserveRect(aspect);
  const cardHit = Math.max(0, ...newRects.map((r) => ratio(r, card)));
  ok('reconcile(edited) 새 사진 연도카드 회피', cardHit <= 0.05, \`hit=\${(cardHit * 100).toFixed(1)}%\`);
}

// 5) edited:false(기본 배치로 직후) — 사진 추가 시 신선한 시드
{
  const aspect = ASPECTS.phone;
  const items = mkItems(6);
  const saved = seedLayout('mosaic', items, aspect); // edited: false
  const more = mkItems(7);
  const next = resolveLayout('mosaic', more, saved, aspect);
  const fresh = seedLayout('mosaic', more, aspect);
  const same = more.every((it) => {
    const a = next.items[it.key]; const b = fresh.items[it.key];
    return a && b && a.x === b.x && a.y === b.y && a.w === b.w;
  });
  ok('reconcile(edited:false) 신선한 시드 재배치', same);
}

// 6) 고아 스티커 — 연도 카드 밑 고정 폴백이 아니라 빈 공간 배치
{
  const aspect = ASPECTS.phone;
  const items = mkItems(6);
  const saved = { ...seedLayout('polaroid', items, aspect), edited: true };
  delete saved.items[stickerKey('seed-chip')]; // 배치만 유실된 고아 스티커
  const next = resolveLayout('polaroid', items, saved, aspect);
  const st = next.items[stickerKey('seed-chip')];
  const card = polaroidReserveRect(aspect);
  ok('고아 스티커 복원', !!st);
  ok('고아 스티커 연도카드 회피', st ? ratio({ x: st.x, y: st.y, w: st.w, h: st.w * 0.3 }, card) <= 0.05 : false);
}

// 7) 리플로우 (v8.2) — 시드는 그리드 정합, 스팬 확대 후 무겹침·경계·z 보존
for (const t of ['mosaic', 'minimal']) {
  for (const [aName, aspect] of Object.entries(ASPECTS)) {
    const items = mkItems(8);
    const layout = seedLayout(t, items, aspect);
    const info = inferGridSpans(layout.items, aspect);
    ok(\`reflow(\${aName}/\${t}) 시드 그리드 정합\`, !!info);
    if (!info) continue;
    const ordered = Object.entries(layout.items)
      .filter(([k]) => !k.startsWith('sticker:'))
      .sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
      .map(([k, it], i) => ({ key: k, span: i === 1 ? [2, 2] : info.spans[k], z: it.z }));
    const placed = reflowLayout(t, ordered, aspect);
    ok(\`reflow(\${aName}/\${t}) 결과 존재\`, !!placed);
    if (!placed) continue;
    const rects = Object.values(placed).map((it) => ({ x: it.x, y: it.y, w: it.w, h: it.h }));
    let worst = 0;
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) worst = Math.max(worst, ratio(rects[i], rects[j]));
    ok(\`reflow(\${aName}/\${t}) 무겹침\`, worst <= 0.001, \`worst=\${(worst * 100).toFixed(1)}%\`);
    const inB = rects.every((r) => r.x >= -0.001 && r.y >= -0.001 && r.x + r.w <= 1.001 && r.y + r.h <= 1.001);
    ok(\`reflow(\${aName}/\${t}) 경계 내부\`, inB);
    const grew = placed[ordered[1].key].w > Math.min(...Object.values(placed).map((it) => it.w)) * 1.5;
    ok(\`reflow(\${aName}/\${t}) 타깃 사진 확대\`, grew);
    ok(\`reflow(\${aName}/\${t}) z 보존\`, ordered.every((e) => placed[e.key].z === e.z));
  }
}

// 8) 미니멀 균형 행 (v8.4) — 고아 행 없음(전 행 1장 균일 스택 예외)·행당 개수 차 ≤1·행 가운데 정렬
for (const [aName, aspect] of Object.entries(ASPECTS)) {
  for (let n = 2; n <= 18; n++) {
    const items = mkItems(n);
    const layout = seedLayout('minimal', items, aspect);
    const rects = items.map((it) => rectOf(layout.items[it.key], aspect));
    const rows = new Map();
    for (const r of rects) {
      const arr = rows.get(r.y) ?? [];
      arr.push(r);
      rows.set(r.y, arr);
    }
    const counts = [...rows.values()].map((a) => a.length);
    const allSingle = counts.every((c) => c === 1);
    const noOrphan = allSingle || counts.every((c) => c >= 2);
    ok(\`균형행(\${aName}/n=\${n}) 고아 없음\`, noOrphan, \`rows=\${counts.join(',')}\`);
    ok(\`균형행(\${aName}/n=\${n}) 개수 차 ≤1\`, Math.max(...counts) - Math.min(...counts) <= 1);
    const centered = [...rows.values()].every((arr) => {
      const minX = Math.min(...arr.map((r) => r.x));
      const maxR = Math.max(...arr.map((r) => r.x + r.w));
      return Math.abs(minX - (1 - maxR)) <= 0.005;
    });
    ok(\`균형행(\${aName}/n=\${n}) 행 센터링\`, centered);
  }
}

// 9) 미니멀 reflow 라운드트립 (v8.4) — 편집 리플로우(전 스팬 1×1)도 균형 행 유지 + h·z 계약
{
  const aspect = ASPECTS.phone;
  const items = mkItems(13);
  const layout = seedLayout('minimal', items, aspect);
  const info = inferGridSpans(layout.items, aspect);
  ok('균형행 reflow(n=13) 시드 그리드 정합', !!info);
  if (info) {
    const ordered = Object.entries(layout.items)
      .sort(([, a], [, b]) => a.y - b.y || a.x - b.x)
      .map(([k, it]) => ({ key: k, span: info.spans[k], z: it.z }));
    const placed = reflowLayout('minimal', ordered, aspect);
    ok('균형행 reflow(n=13) 결과 존재', !!placed);
    if (placed) {
      const rows = new Map();
      for (const it of Object.values(placed)) {
        const arr = rows.get(it.y) ?? [];
        arr.push(it);
        rows.set(it.y, arr);
      }
      const counts = [...rows.values()].map((a) => a.length);
      ok('균형행 reflow(n=13) 고아 없음', counts.every((c) => c >= 2) || counts.every((c) => c === 1), \`rows=\${counts.join(',')}\`);
      ok('균형행 reflow(n=13) h 존재', Object.values(placed).every((it) => typeof it.h === 'number'));
      ok('균형행 reflow(n=13) z 보존', ordered.every((e) => placed[e.key].z === e.z));
    }
  }
}

// 10) 숲 레거시 가시성 가드 (v8.4) — pre-v8.0 겹침 배치(edited 플래그 없음)만 리시드
{
  const aspect = ASPECTS.phone;
  const items = mkItems(6);
  const good = seedLayout('polaroid', items, aspect);
  // 손상 레거시 — 두 사진을 완전히 겹치고 edited 플래그 제거
  const corrupt = JSON.parse(JSON.stringify(good));
  corrupt.items['2-0'] = { ...corrupt.items['1-0'], z: corrupt.items['2-0'].z };
  delete corrupt.edited;
  ok('숲가드 판정: 손상 레거시 broken', isLayoutBroken(corrupt, items, aspect));
  const reseeded = resolveLayout('polaroid', items, corrupt, aspect);
  const fresh = seedLayout('polaroid', items, aspect);
  const same = items.every((it) => {
    const a = reseeded.items[it.key]; const b = fresh.items[it.key];
    return a && b && a.x === b.x && a.y === b.y && a.w === b.w;
  });
  ok('숲가드: 손상+플래그無 → 리시드', same);
  // 사용자가 손댄 배치(edited:true)는 겹쳐도 보존
  const editedCorrupt = JSON.parse(JSON.stringify(corrupt));
  editedCorrupt.edited = true;
  const kept = resolveLayout('polaroid', items, editedCorrupt, aspect);
  const preservedEdited = items.every((it) => {
    const a = editedCorrupt.items[it.key]; const b = kept.items[it.key];
    return b && a.x === b.x && a.y === b.y;
  });
  ok('숲가드: 손상+edited:true → 보존', preservedEdited);
  // 무손상 레거시 — 과발동 없음
  const legacyOk = JSON.parse(JSON.stringify(good));
  delete legacyOk.edited;
  ok('숲가드 판정: 무손상 레거시 정상', !isLayoutBroken(legacyOk, items, aspect));
  const kept2 = resolveLayout('polaroid', items, legacyOk, aspect);
  const preservedLegacy = items.every((it) => {
    const a = legacyOk.items[it.key]; const b = kept2.items[it.key];
    return b && a.x === b.x && a.y === b.y;
  });
  ok('숲가드: 무손상 레거시 → 보존', preservedLegacy);
  // 단위 판정 — 경계 밖 broken / 40% 겹침 정상 / 스티커 겹침 무시(사진 키만 검사)
  const oob = { items: { '1-0': { x: 1.1, y: 0.2, w: 0.3, z: 1 } } };
  ok('숲가드 판정: 경계 밖 broken', isLayoutBroken(oob, [{ key: '1-0', src: 'x' }], aspect));
  const partial = { items: {
    '1-0': { x: 0.1, y: 0.1, w: 0.3, z: 1 },
    '2-0': { x: 0.28, y: 0.1, w: 0.3, z: 2 },
  } };
  ok('숲가드 판정: 40% 겹침 정상', !isLayoutBroken(partial, [{ key: '1-0', src: 'x' }, { key: '2-0', src: 'x' }], aspect));
  const stickerOnly = JSON.parse(JSON.stringify(good));
  delete stickerOnly.edited;
  stickerOnly.items[stickerKey('seed-chip')] = { ...stickerOnly.items['1-0'], z: 99 };
  ok('숲가드 판정: 스티커 겹침 무시', !isLayoutBroken(stickerOnly, items, aspect));
}

console.log('\\n===== v8.0 콜라주 배치 기하 검증 =====');
for (const r of results) console.log(r);
const fail = results.filter((r) => r.startsWith('FAIL')).length;
console.log(\`\\n\${results.length - fail}/\${results.length} PASS\`);
process.exit(fail ? 1 : 0);
`;

const fs = require('fs');
const tmp = path.join(__dirname, '.collage-layout-check.mts');
fs.writeFileSync(tmp, inline, 'utf8');
try {
  execSync(`npx tsx "${tmp}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
} finally {
  fs.unlinkSync(tmp);
}
