'use client';

import useFocusTrap from './useFocusTrap';
import { boardSummary } from '@/lib/merge';
import { BoardData } from '@/lib/types';

// v8.5 — 시각까지 표기: 같은 날 두 보드가 "2026.7.31 vs 2026.7.31"로 보이면 고를 근거가 없다
function fmt(ts: number | null | undefined): string {
  if (!ts) return '기록 없음';
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${hh}:${mm}`;
}

function summaryLine(b: BoardData): string {
  const { diaryCount, photoCount } = boardSummary(b);
  const parts = [];
  if (diaryCount > 0) parts.push(`일기 ${diaryCount}편`);
  if (photoCount > 0) parts.push(`사진 ${photoCount}장`);
  return parts.length > 0 ? parts.join(' · ') : '내용 적음';
}

// 병합 선택 (기획서 §5) — 자동 덮어쓰기 금지. 닫으면 아무 것도 덮지 않고 이번 세션 동기화 보류.
// v8.5 — 왜 떴는지·각 보드에 뭐가 들었는지 설명 강화 (오너: "언제 어떤 이유로 뜨는지 모르겠다")
export default function MergeSheet({
  newer,
  localAt,
  serverAt,
  localBoard,
  serverBoard,
  onChoose,
  onDismiss,
}: {
  newer: 'local' | 'server';
  localAt: number | null;
  serverAt: number | null;
  localBoard: BoardData;
  serverBoard: BoardData;
  onChoose: (choice: 'local' | 'server') => void;
  onDismiss: () => void;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onDismiss);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="보드 선택"
    >
      <div ref={trapRef} className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slideUp">
        <h2 className="text-title font-bold mb-1">보드가 두 개 있어</h2>
        <p className="text-body text-[#6B7280] mb-5">
          Google 계정에 저장해둔 보드랑, 지금 이 기기에서 만든 보드의 내용이 서로 달라서 물어보는
          거야. 어느 쪽으로 이어갈지 골라줘 — 고른 쪽만 남고 다른 쪽은 덮어써져.
        </p>
        <button
          onClick={() => onChoose('local')}
          className={`w-full text-left rounded-2xl border p-4 mb-3 ${
            newer === 'local' ? 'border-[#1C1B19]' : 'border-[#E5E1DA]'
          }`}
        >
          <span className="text-body font-bold block">
            이 기기의 보드 쓰기{newer === 'local' ? ' · 더 최신이야' : ''}
          </span>
          <span className="text-caption text-[#6B7280]">
            {summaryLine(localBoard)} · 마지막 작업 {fmt(localAt)}
          </span>
        </button>
        <button
          onClick={() => onChoose('server')}
          className={`w-full text-left rounded-2xl border p-4 mb-3 ${
            newer === 'server' ? 'border-[#1C1B19]' : 'border-[#E5E1DA]'
          }`}
        >
          <span className="text-body font-bold block">
            저장된 보드 가져오기{newer === 'server' ? ' · 더 최신이야' : ''}
          </span>
          <span className="text-caption text-[#6B7280]">
            {summaryLine(serverBoard)} · 마지막 저장 {fmt(serverAt)}
          </span>
        </button>
        <button onClick={onDismiss} className="w-full py-3 text-body text-[#6B7280]">
          나중에 정할게
        </button>
        <p className="text-micro text-[#9CA3AF] text-center">
          이번엔 동기화를 쉬어 갈게 — 두 보드 다 그대로 있어
        </p>
      </div>
    </div>
  );
}
