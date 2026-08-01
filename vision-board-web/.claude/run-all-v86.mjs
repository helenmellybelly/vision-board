// v8.6 회귀 일괄 러너 — .claude/verify-*.mjs 전부 + 기하 계약. 결과 요약만 출력.
import { execSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const suites = readdirSync('.claude')
  .filter((f) => /^verify-.*\.mjs$/.test(f))
  .sort();
suites.push('verify-collage-layout.js'); // scripts/ 기하 계약

const summary = [];
for (const s of suites) {
  const path = s.endsWith('.js') ? `scripts/${s}` : `.claude/${s}`;
  const t0 = Date.now();
  try {
    const out = execSync(`node ${path}`, { encoding: 'utf8', stdio: 'pipe', timeout: 600000 });
    const tail = out.trim().split('\n').at(-1);
    summary.push(`PASS ${s} — ${tail} (${Math.round((Date.now() - t0) / 1000)}s)`);
  } catch (e) {
    const out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
    const fails = out.split('\n').filter((l) => l.startsWith('FAIL')).slice(0, 10);
    summary.push(`FAIL ${s}\n${fails.join('\n')}`);
  }
}
console.log(summary.join('\n'));
const failed = summary.filter((l) => l.startsWith('FAIL')).length;
console.log(`\n== ${suites.length - failed}/${suites.length} suites PASS ==`);
process.exit(failed ? 1 : 0);
