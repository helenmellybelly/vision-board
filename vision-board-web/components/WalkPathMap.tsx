'use client';

import { SECTIONS } from '@/lib/questions';
import { BoardData, SectionId } from '@/lib/types';
import { sectionHasPhoto } from '@/lib/sectionRoute';
import { STATUS_LABEL } from '@/components/MiniBoardPreview';
import { statusEmoji, statusTitle } from '@/lib/stationStatus';
import { FOREST } from '@/lib/colors';

// 산책길 지도 (v7.5) — 대시보드 전용. 정원(미니보드) 대신 "토리와 걷는 산책길"로
// 진행을 여정으로 보여준다 (docs/산책길-대시보드-기획서.md R1: 정적 렌더·이모지 기반).
// 사진 썸네일은 표시하지 않음 — 상태 아이콘만 (🌰 → 💬 답하는 중 → 📷 사진 차례 → 🌳 완성, lib/stationStatus.ts 단일 소스).
// aria-label은 MiniBoardPreview와 같은 계약: `${label} — ${STATUS_LABEL[status]}` —
// 구 회귀 스위트(v7r2·v71r3)의 셀 라우팅 케이스가 이 형식에 의존한다.

// 출발(도토리) + 스테이션 6 + 도착(참나무 언덕) — 좁은 진폭 지그재그 (% 좌표 단일 소스,
// 경로 SVG와 마커 배치가 같은 배열에서 파생돼 어긋나지 않는다)
const ANCHORS = [
  { x: 16, y: 5 }, // 출발 — 심은 도토리
  { x: 64, y: 16 },
  { x: 26, y: 29 },
  { x: 68, y: 42 },
  { x: 28, y: 55 },
  { x: 66, y: 68 },
  { x: 30, y: 81 },
  { x: 72, y: 93 }, // 도착 — 참나무 언덕
];

// 세로 진행에 맞춘 부드러운 S자 — 세로 중간점을 제어점으로 한 cubic bezier.
// 구간별 독립 path (v7.7) — 도착 스테이션이 완성된 구간은 실선으로 "걸어온 길"이 되고,
// 건너뛴 구간은 점선("아직 안 걸은 길")으로 남는다. 경로 모양·순서는 지도처럼 고정.
function buildSegments(walkedByIndex: boolean[]): { d: string; walked: boolean }[] {
  return ANCHORS.slice(1).map((p, i) => {
    const prev = ANCHORS[i];
    const midY = (prev.y + p.y) / 2;
    return {
      d: `M ${prev.x} ${prev.y} C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`,
      walked: walkedByIndex[i] ?? false,
    };
  });
}

export default function WalkPathMap({
  board,
  nextSectionId,
  onSelectSection,
}: {
  board: BoardData;
  /** 토리가 서 있는 다음 추천 스테이션 — 전부 완성이면 null(도착점에 선다) */
  nextSectionId?: SectionId | null;
  onSelectSection: (id: SectionId) => void;
}) {
  const allDone = SECTIONS.every((s) => board.sections[s.id].status === 'completed');
  // 첫 방문(전부 시작 전·사진도 없음)에만 "여기서 시작" 라벨 — 진행이 생기면 글로우+토리만 남긴다.
  // 사진 먼저 경로는 status가 not_started인 채 사진만 담기므로 사진 유무도 진행으로 본다 (저장 없이 파생)
  const showStartNudge = SECTIONS.every(
    (s) => board.sections[s.id].status === 'not_started' && !sectionHasPhoto(board.sections[s.id])
  );

  const tori = (
    <img
      src="/tori-profile-bust.png"
      alt=""
      aria-hidden="true"
      className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full object-cover z-10 shadow-md"
    />
  );

  return (
    <div
      className="relative rounded-3xl overflow-hidden h-[440px]"
      style={{ background: FOREST.gradientCss }}
    >
      {/* 산책길 — 걸어온 구간은 실선, 나머지는 점선 */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        {buildSegments([
          ...SECTIONS.map((s) => board.sections[s.id].status === 'completed'),
          allDone,
        ]).map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill="none"
            stroke={seg.walked ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)'}
            strokeWidth="2"
            strokeDasharray={seg.walked ? undefined : '1 7'}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {/* 출발 — 온보딩에서 심은 도토리 */}
      <div
        className="absolute flex items-center gap-1.5 select-none"
        style={{ left: `${ANCHORS[0].x}%`, top: `${ANCHORS[0].y}%`, transform: 'translate(-50%,-50%)' }}
      >
        <span className="text-body leading-none" aria-hidden="true">🌰</span>
        <span className="text-micro text-[#C4C2BE] whitespace-nowrap">심은 도토리</span>
      </div>

      {/* 스테이션 6곳 — 셀 탭 = 섹션 이동 (미니보드 허브 계약 유지) */}
      {SECTIONS.map((section, i) => {
        const anchor = ANCHORS[i + 1];
        const sec = board.sections[section.id];
        const label = section.title.split(' — ')[0];
        const hasPhoto = sectionHasPhoto(sec);
        const isNext = section.id === nextSectionId;
        const completed = sec.status === 'completed';
        const labelSide = anchor.x < 50 ? 'left-full ml-2' : 'right-full mr-2';
        return (
          <button
            key={section.id}
            onClick={() => onSelectSection(section.id)}
            aria-label={`${label} — ${STATUS_LABEL[sec.status]}`}
            title={statusTitle(label, sec.status, hasPhoto)}
            className="absolute active:opacity-80 transition-opacity"
            style={{ left: `${anchor.x}%`, top: `${anchor.y}%`, transform: 'translate(-50%,-50%)' }}
          >
            {/* 첫 방문 시작 라벨 — 버튼 내부라 터치 타깃이 커질 뿐 줄지 않는다 */}
            {isNext && showStartNudge && (
              <span
                aria-hidden="true"
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20"
              >
                <span className="block animate-nudgeBounce whitespace-nowrap rounded-full bg-white text-[#1F2E22] text-caption font-bold px-2.5 py-1 shadow-lg">
                  여기서 시작 ▾
                </span>
              </span>
            )}
            <span
              className="relative flex w-11 h-11 rounded-full items-center justify-center shadow-md"
              style={{ backgroundColor: section.lightColor, border: `2px solid ${section.color}` }}
            >
              {/* 다음 스테이션 — 정적 링 + 확산 글로우 링 2겹, 토리가 표지판 앞에서 기다린다 (v7.6 시작 어포던스) */}
              {isNext && (
                <>
                  <span
                    className="absolute -inset-1 rounded-full pointer-events-none"
                    style={{ boxShadow: `0 0 0 2px ${section.color}` }}
                    aria-hidden="true"
                  />
                  <span
                    className="absolute -inset-1 rounded-full animate-glowRing pointer-events-none"
                    style={{ boxShadow: `0 0 0 3px ${section.color}`, willChange: 'transform' }}
                    aria-hidden="true"
                  />
                </>
              )}
              {isNext && tori}
              {/* 완료 스테이션 — 수풀 장식: 완료할수록 산책길이 우거진다 */}
              {completed && (
                <span
                  className="absolute -bottom-1.5 -right-2 text-caption leading-none pointer-events-none select-none"
                  aria-hidden="true"
                >
                  🌿
                </span>
              )}
              <span className="text-heading leading-none" aria-hidden="true">
                {statusEmoji(sec.status, hasPhoto)}
              </span>
            </span>
            {/* 섹션명 — 지그재그 반대편에 라벨 (겹침 방지) */}
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${labelSide} flex items-center gap-1 whitespace-nowrap`}
            >
              <span className="text-caption font-semibold text-white">{label}</span>
              {completed && (
                <span className="text-[10px] leading-none font-semibold text-[#1F2E22] bg-[#A7F3D0] rounded-full px-1.5 py-0.5">
                  완료
                </span>
              )}
            </span>
          </button>
        );
      })}

      {/* 도착 — 참나무 언덕 (R3에서 /collage 딥링크 예정, R1은 장식) */}
      <div
        className="absolute flex items-center gap-1.5 select-none"
        style={{ left: `${ANCHORS[7].x}%`, top: `${ANCHORS[7].y}%`, transform: 'translate(-50%,-50%)' }}
      >
        <span className="relative text-title leading-none" aria-hidden="true">
          {allDone && tori}
          🌳
        </span>
        <span className="text-micro text-[#C4C2BE] whitespace-nowrap">참나무 언덕</span>
      </div>
    </div>
  );
}
