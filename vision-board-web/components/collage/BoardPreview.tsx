'use client';

import { BoardData } from '@/lib/types';
import {
  ASPECT,
  CollageItem,
  normalizeTemplate,
  resolveLayout,
} from '@/lib/collageTemplates';
import { ratioOf } from '@/lib/imageDims';
import { photoSlotsOf } from '@/lib/photoSlots';
import { getTargetYear } from '@/lib/targetDate';
import BoardCanvasDom, { boardVisuals, titleConfigOf } from './BoardCanvasDom';

// 읽기 전용 비전보드 (v12) — '비전보드가 완성됐어' 축하 화면용.
//
// 왜 생겼나: /finish는 실제 보드 렌더러를 안 쓰고 MiniBoardPreview(구 랜딩 HeroBoard에서 갈라져
// 나온 6칸 고정 그리드 + 숲 배경)를 그렸다. 그 컴포넌트는 collageTemplate·collageLayouts·
// collageBgColor를 한 줄도 읽지 않아, 사용자가 에디토리얼/매거진/스튜디오 중 무엇을 고르고
// 배경색을 무엇으로 바꿔도 축하 화면만 옛 숲 그림이었다(오너 신고).
//
// 이제 편집 화면과 **같은 DOM 렌더러**(BoardCanvasDom)를 쓴다. 편집 엔진은 딸려오지 않는다 —
// 축하 화면에 ✎ 버튼이나 드래그 핸들이 뜨면 안 되기 때문에 CollageBoard를 readOnly로
// 재사용하지 않고 표현부만 공유한다.
export default function BoardPreview({
  board,
  className,
}: {
  board: BoardData;
  className?: string;
}) {
  const template = normalizeTemplate(board.collageTemplate);
  const items: CollageItem[] = photoSlotsOf(board).map((s) => {
    const ratio = ratioOf(board.photoDims, s.key, s.src);
    return ratio === undefined ? s : { ...s, ratio };
  });
  if (items.length === 0) return null;

  // 폰 뷰의 저장 배치를 우선 쓰되, 비율(4:5)이 안 맞으면 resolveLayout이 알아서 새로 깐다.
  // "호환되면 내 배치, 아니면 표준 배치"가 정책 추가 없이 공짜로 나온다 — kitRemoved도 승계된다.
  // ⚠️ 축하 화면은 4:5 고정이다. 기기 프리셋 비율을 그대로 쓰면 축하 화면 레이아웃이 흔들린다
  const saved = board.collageDeviceLayouts?.phone?.[template] ?? board.collageLayouts?.[template];
  const layout = resolveLayout(template, items, saved, ASPECT);
  const titleCfg = titleConfigOf(template, layout, board.collageTitle);
  const { theme, titleLayout } = boardVisuals(template, board.collageBgColor, titleCfg, ASPECT);

  return (
    <BoardCanvasDom
      // ⚠️ 'collage-board'가 아니다 — /collage의 보드 개수를 세는 스위트(v81r2 V-3c)가 깨진다
      testId="board-preview"
      template={template}
      items={items}
      layout={layout}
      aspect={ASPECT}
      theme={theme}
      titleLayout={titleLayout}
      year={getTargetYear(board)}
      className={className}
      // 편집 관련 prop은 하나도 넘기지 않는다 — 핸들·배지·연도 편집이 구조적으로 나올 수 없다
    />
  );
}
