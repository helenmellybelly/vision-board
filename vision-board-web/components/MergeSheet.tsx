'use client';

import useFocusTrap from './useFocusTrap';

function fmt(ts: number | null | undefined): string {
  if (!ts) return '기록 없음';
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

// 병합 선택 (기획서 §5) — 자동 덮어쓰기 금지. 닫으면 아무 것도 덮지 않고 이번 세션 동기화 보류.
export default function MergeSheet({
  newer,
  localAt,
  serverAt,
  onChoose,
  onDismiss,
}: {
  newer: 'local' | 'server';
  localAt: number | null;
  serverAt: number | null;
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
          이 기기의 보드와 저장해둔 보드가 달라. 어느 쪽을 쓸까? 선택한 쪽이 남고, 다른 쪽은
          덮어써져.
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
          <span className="text-caption text-[#6B7280]">마지막 작업 {fmt(localAt)}</span>
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
          <span className="text-caption text-[#6B7280]">마지막 저장 {fmt(serverAt)}</span>
        </button>
        <button onClick={onDismiss} className="w-full py-3 text-body text-[#6B7280]">
          나중에 정할게
        </button>
      </div>
    </div>
  );
}
