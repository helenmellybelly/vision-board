import { track as vercelTrack } from '@vercel/analytics';

// v7.9 이중 전송 래퍼 — Vercel Analytics(custom events는 Pro 전용 no-op) + GA4(gtag).
// 호출부는 기존 시그니처 그대로 이 모듈에서 track을 import 한다. 이벤트에 보드 본문 금지(기획서 §7).
type EventProps = Record<string, string | number | boolean | null>;

declare global {
  interface Window {
    gtag?: (command: 'event', name: string, params?: EventProps) => void;
  }
}

export function track(name: string, props?: EventProps): void {
  vercelTrack(name, props);
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', name, props);
  }
}
