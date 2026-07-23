import { NextRequest, NextResponse } from 'next/server';

// 무인증 공개 LLM 라우트의 최소 방어선 (v7.4 출시 전 감사 C1).
// - rateLimited: 워밍된 Fluid Compute 인스턴스 메모리 기반 IP 레이트리밋(베스트에포트).
//   인스턴스가 여러 개면 완벽하진 않으므로, 지속적·분산 방어는 Vercel Firewall
//   레이트룰 또는 Upstash 등 외부 스토어로 보강할 것.
// - clampStr/clampStrArray: 입력 길이·개수 상한. 인프라와 무관하게 100% 유효 —
//   프롬프트 토큰 비용 증폭과 localStorage quota 폭주를 코드 레벨에서 차단한다.

const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

/** true면 한도 초과 — 호출부에서 tooManyRequests()를 반환한다. */
export function rateLimited(req: NextRequest, max = 20): boolean {
  const fwd = req.headers.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0]?.trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  // 맵이 무한정 커지지 않도록 가끔 만료 항목 정리
  if (hits.size > 10_000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > max;
}

export function tooManyRequests(): NextResponse {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}

/** 문자열이 아니면 ''로, 길면 max자로 자른다. */
export function clampStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** 배열이 아니면 []로. 최대 maxItems개, 각 원소는 maxLen자로 자른다. */
export function clampStrArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, maxItems).map((s) => (typeof s === 'string' ? s.slice(0, maxLen) : ''));
}
