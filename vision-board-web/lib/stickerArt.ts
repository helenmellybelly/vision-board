// 장식 요소 아트 (v10) — 문구 스티커 옆에 놓이는 라인 아이콘·테이프.
//
// 왜 이모지가 아니라 path인가: 스티커는 DOM(CollageBoard)과 canvas(wallpaper) 두 곳에서
// 똑같이 그려져야 한다. 이모지는 폰트가 결정하므로 두 렌더러가 어긋나고, 저장 이미지에서
// 두부(□)가 되거나 OS마다 다른 그림이 나온다. 단위(0..1) SVG path 하나를 두 렌더러가
// 공유하면 그런 일이 없다 — DOM은 <svg viewBox="0 0 1 1">, canvas는 new Path2D(d).
//
// 굵은 아이콘(Lucide·Material 계열)을 쓰지 않는 것도 의도다. 사진 위에 얹히는 장식이라
// 선이 굵으면 사진을 이긴다. 전부 초경량 라인이다.
//
// ⚠️ 순수 모듈 — 아무것도 import하지 않는다.

export type IconId = 'rule' | 'sparkle' | 'arrow' | 'corner' | 'plus' | 'tape' | 'bracket';

export interface IconDef {
  /** 단위 정사각(0..1) 좌표계의 SVG path */
  d: string;
  mode: 'stroke' | 'fill';
  /** 자연 가로세로비 w/h — 스티커 박스 높이를 폭에서 역산한다 */
  ratio: number;
  /** 선 굵기 (박스 짧은 변 대비) */
  stroke: number;
  /** fill 모드의 불투명도 — 테이프는 반투명이라야 아래 사진이 비친다 */
  alpha?: number;
  label: string;
}

export const ICONS: Record<IconId, IconDef> = {
  rule: {
    d: 'M0 0.5 H1',
    mode: 'stroke',
    ratio: 8,
    stroke: 0.055,
    label: '밑줄',
  },
  bracket: {
    d: 'M0.14 0.06 H0 V0.94 H0.14 M0.86 0.06 H1 V0.94 H0.86',
    mode: 'stroke',
    ratio: 1.6,
    stroke: 0.045,
    label: '괄호',
  },
  corner: {
    d: 'M0 0.34 V0 H0.34',
    mode: 'stroke',
    ratio: 1,
    stroke: 0.06,
    label: '코너',
  },
  arrow: {
    d: 'M0 0.5 H0.88 M0.63 0.22 L0.94 0.5 L0.63 0.78',
    mode: 'stroke',
    ratio: 3.2,
    stroke: 0.05,
    label: '화살표',
  },
  plus: {
    d: 'M0.5 0.1 V0.9 M0.1 0.5 H0.9',
    mode: 'stroke',
    ratio: 1,
    stroke: 0.07,
    label: '십자',
  },
  sparkle: {
    d: 'M0.5 0 C0.55 0.36 0.64 0.45 1 0.5 C0.64 0.55 0.55 0.64 0.5 1 C0.45 0.64 0.36 0.55 0 0.5 C0.36 0.45 0.45 0.36 0.5 0 Z',
    mode: 'fill',
    ratio: 1,
    stroke: 0,
    label: '반짝임',
  },
  tape: {
    d: 'M0.04 0.1 L1 0 L0.96 0.9 L0 1 Z',
    mode: 'fill',
    ratio: 3.4,
    stroke: 0,
    alpha: 0.34,
    label: '테이프',
  },
};

export const ICON_IDS = Object.keys(ICONS) as IconId[];

export const isIconId = (v: unknown): v is IconId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(ICONS, v);

/**
 * canvas가 Path2D를 쓸 수 있는가.
 *
 * ⚠️ 모듈 최상위 상수로 만들면 안 된다 — 서버 렌더에서는 Path2D가 없어 false, 클라이언트에서는
 * true가 되어 하이드레이션 불일치가 난다. 캔버스 코드 안에서만 호출할 것.
 * 못 쓰는 환경이면 아이콘 UI 자체를 숨긴다(화면에는 보이는데 저장 이미지엔 없는 '반쪽 렌더' 금지).
 */
export function hasPath2D(): boolean {
  try {
    return typeof Path2D !== 'undefined' && !!new Path2D('M0 0 H1');
  } catch {
    return false;
  }
}
