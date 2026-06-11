// 타이포그래피 가드 — text-display(-lg)는 반드시 font-display(Gowun Batang)와 페어링한다.
// 규칙 출처: docs/design-system.md §1·§2. node scripts/check-typography.js 로 단독 실행.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['app', 'components'];

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx|jsx)$/.test(entry.name)) yield full;
  }
}

const violations = [];
for (const dir of TARGET_DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/\btext-display(-lg)?\b/.test(line) && !/\bfont-display\b/.test(line)) {
        violations.push(`${path.relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
      }
    });
  }
}

if (violations.length) {
  console.error('FAIL — text-display 크기 토큰에 font-display 서체 클래스가 빠진 곳:');
  violations.forEach((v) => console.error('  ' + v));
  process.exit(1);
}
console.log('OK — 모든 text-display 사용처가 font-display와 페어링됨');
