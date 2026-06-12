// 타이포그래피 가드 — UI는 Pretendard 단일 서체. 아트 서체(.font-script, Enjoystories)는
// 콜라주 보드·스티커·배경화면(components/collage/**)에서만 허용한다.
// 구 클래스 font-display(Gowun Batang)는 v6.15에서 제거됨 — 어디서도 쓰면 안 된다.
// 규칙 출처: docs/design-system.md §1. node scripts/check-typography.js 로 단독 실행.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TARGET_DIRS = ['app', 'components'];
// font-script 허용 경로(접두사, ROOT 기준 상대경로)
const SCRIPT_ALLOWED = [path.join('components', 'collage')];

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
    const rel = path.relative(ROOT, file);
    const scriptAllowed = SCRIPT_ALLOWED.some((p) => rel.startsWith(p));
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (/\bfont-display\b/.test(line)) {
        violations.push(`${rel}:${i + 1}  [font-display 금지 — 제거된 서체] ${line.trim()}`);
      }
      if (!scriptAllowed && /\bfont-script\b/.test(line)) {
        violations.push(`${rel}:${i + 1}  [font-script는 components/collage 전용] ${line.trim()}`);
      }
    });
  }
}

if (violations.length) {
  console.error('FAIL — 서체 규칙 위반:');
  violations.forEach((v) => console.error('  ' + v));
  process.exit(1);
}
console.log('OK — UI는 Pretendard 단일, font-script는 콜라주 영역에서만 사용됨');
