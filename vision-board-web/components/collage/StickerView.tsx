'use client';

import { CollageLayoutItem, CollageSticker } from '@/lib/types';
import { STICKER_FONT_RATIO } from '@/lib/collageTokens';
import { ICONS, isIconId } from '@/lib/stickerArt';

// 문구 스티커 1개 — 글자 크기는 cqi(보드 폭 %)로, canvas 렌더(lib/wallpaper.ts)와 같은 비율식.
// v12에 CollageBoard에서 분리했다: /finish 축하 화면(BoardPreview)도 같은 그림을 그려야 하는데
// 편집 엔진까지 딸려 오면 안 되기 때문.
//
// ⚠️ 조판 수치(폰트 비율·줄 높이·여백)는 여기 쓰지 말 것 — lib/collageTokens가 단일 소스이고
//    canvas drawSticker가 같은 값을 읽는다. 여기 숫자를 박으면 화면과 저장 이미지가 갈라진다.
export default function StickerView({
  sticker,
  it,
  dark,
  editable,
  onCommit,
}: {
  sticker: CollageSticker;
  it: CollageLayoutItem;
  dark: boolean;
  /** 인라인 편집 중 (v12) — 글자 자체가 편집면이 된다 */
  editable?: boolean;
  /** 편집 종료(blur) 시 현재 글자를 올려보낸다 */
  onCommit?: (text: string) => void;
}) {
  const fontSize = `${it.w * 100 * STICKER_FONT_RATIO[sticker.style]}cqi`;
  // 라인 아이콘 (v10) — canvas(lib/wallpaper.ts)와 **같은 단위 path**를 그린다.
  // viewBox="0 0 1 1" + preserveAspectRatio="none"이면 박스가 곧 좌표계라 두 렌더러가 자동 일치한다
  if (sticker.kind === 'icon' && isIconId(sticker.icon)) {
    const def = ICONS[sticker.icon];
    const ink = sticker.color ?? (dark ? '#FFFFFF' : '#1C1B19');
    // ⚠️ 선 굵기는 **아이콘 박스의 짧은 변** 기준이어야 canvas(lineWidth = stroke × min(w,h))와 맞는다.
    //    `${def.stroke * 100}cqi`로 두면 보드 폭 기준이 되어 화살표 선이 50px로 뭉개진다
    //    (실측: 검은 덩어리). cqi는 보드 폭의 %이므로 박스 짧은 변을 cqi로 환산해 곱한다.
    const shortSideCqi = it.w * 100 * Math.min(1, 1 / def.ratio);
    return (
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="w-full block"
        style={{ aspectRatio: String(def.ratio), overflow: 'visible' }}
        aria-hidden="true"
      >
        <path
          d={def.d}
          fill={def.mode === 'fill' ? ink : 'none'}
          fillOpacity={def.mode === 'fill' ? def.alpha ?? 1 : undefined}
          stroke={def.mode === 'stroke' ? ink : 'none'}
          // 비등방 viewBox에서도 선 굵기가 찌그러지지 않게 — canvas의 lineWidth 처리와 같은 의도
          vectorEffect="non-scaling-stroke"
          strokeWidth={def.mode === 'stroke' ? `${def.stroke * shortSideCqi}cqi` : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  // 인라인 편집 (v12) — 글자 요소가 곧 편집면이다.
  //
  // 왜 오버레이 <textarea>가 아닌가:
  //  ① 타이포 정의가 하나로 남는다. textarea를 얹으면 chip 패딩·WebkitTextStroke·font-script·cqi
  //     폰트를 전부 재구현해야 하고, 그 순간 화면과 저장 이미지의 정의가 2벌이 된다.
  //  ② iOS가 페이지를 확대하지 않는다. 폼 컨트롤의 폰트가 16px 미만이면 Safari가 확대하는데,
  //     보드 폭 기준 cqi 폰트는 폰에서 14px 언저리라 확실히 걸린다.
  //  ③ 기하가 안 흔들린다. 스티커의 배치 데이터는 {x,y,w,z,rot}뿐이고 h가 없다 —
  //     텍스트가 바뀌어도 좌표 계산이 하나도 다시 안 돌고 높이는 DOM이 알아서 자란다.
  //
  // ⚠️ 비제어(defaultValue 개념)로 둔다. value를 React state로 물리면 한글 IME 조합 중
  //    캐럿이 튄다. 커밋은 blur·완료 등 조합이 끝난 시점에만 한다.
  const editProps = editable
    ? {
        contentEditable: (supportsPlaintextOnly() ? 'plaintext-only' : 'true') as 'plaintext-only' | 'true',
        suppressContentEditableWarning: true,
        // ⚠️ 부모 보드가 touchAction:'none'이라 상속받으면 캐럿 조작이 막힌다
        'data-sticker-edit': '1',
        // 빈 문구는 보드에서 안 보인다 — 자리표시가 없으면 "추가했는데 아무 일도 안 났다"가 된다
        'data-placeholder': '여기에 한마디',
        onBlur: (e: React.FocusEvent<HTMLDivElement>) => onCommit?.(e.currentTarget.innerText),
        // plaintext-only 미지원 폴백에서 붙여넣기가 HTML을 넣는 걸 막는다
        onPaste: (e: React.ClipboardEvent<HTMLDivElement>) => {
          e.preventDefault();
          const text = e.clipboardData.getData('text/plain');
          document.getSelection()?.getRangeAt(0).insertNode(document.createTextNode(text));
          document.getSelection()?.collapseToEnd();
        },
      }
    : {};
  // 편집 중에는 부모가 넘긴 sticker.text를 다시 그리지 않는다 — 리렌더가 캐럿을 날린다.
  // key로 마운트를 고정하고 브라우저가 DOM을 소유하게 둔다
  const body = editable ? undefined : sticker.text;

  if (sticker.style === 'chip') {
    return (
      <div
        data-sticker-text
        className={`w-full bg-white rounded-md shadow-md px-[0.7em] py-[0.5em] text-center font-semibold text-[#1C1B19] leading-snug ${editStyleCls(editable)}`}
        // ⚠️ pre-wrap — 사용자가 넣은 \n을 그대로 그린다. canvas wrapStickerText와 같은 규칙 (v12)
        style={{ fontSize, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', touchAction: editable ? 'auto' : undefined }}
        {...editProps}
      >
        {body}
      </div>
    );
  }
  if (sticker.style === 'outline') {
    return (
      <div
        data-sticker-text
        className={`w-full text-center font-extrabold uppercase leading-tight tracking-wide ${editStyleCls(editable)}`}
        style={{
          fontSize,
          color: '#FFFFFF',
          WebkitTextStroke: '0.07em #1C1B19',
          paintOrder: 'stroke fill',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          touchAction: editable ? 'auto' : undefined,
        }}
        {...editProps}
      >
        {body}
      </div>
    );
  }
  return (
    <div
      data-sticker-text
      className={`font-script w-full text-center font-bold leading-tight ${editStyleCls(editable)}`}
      style={{
        fontSize,
        color: sticker.color ?? (dark ? '#FFFFFF' : '#1C1B19'),
        textShadow: dark ? '0 2px 12px rgba(0,0,0,0.4)' : 'none',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        touchAction: editable ? 'auto' : undefined,
      }}
      {...editProps}
    >
      {body}
    </div>
  );
}

/** 편집 중임을 보이게 — 어떤 배경 위에서도 보이는 점선 링. 크기는 안 바꾼다(outline은 레이아웃 밖) */
const editStyleCls = (editable?: boolean) =>
  editable ? 'outline-dashed outline-2 outline-offset-2 outline-white/80 caret-current' : '';

/** Firefox는 'plaintext-only'를 무시하고 편집을 아예 끄는 버전이 있었다 — 지원 여부를 실제로 물어본다 */
function supportsPlaintextOnly(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.createElement('div');
  try {
    el.contentEditable = 'plaintext-only';
    return el.contentEditable === 'plaintext-only';
  } catch {
    return false;
  }
}
