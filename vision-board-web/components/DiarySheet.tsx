'use client';

import { useState } from 'react';
import useFocusTrap from './useFocusTrap';
import { renderStory } from './StoryModal';
import { BoardData } from '@/lib/types';
import { SECTIONS } from '@/lib/questions';

// 쓴 미래 일기 모아 읽기 (v7.9 A안) — 섹션 산출물이 쌓이는 감각을 대시보드에서 제공.
// 일기가 1편도 없으면 트리거 자체를 렌더하지 않는다 (높이 예산 v71r3 — 조건부 1줄만 추가).
export default function DiarySheet({ board }: { board: BoardData }) {
  const [open, setOpen] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(open, () => setOpen(false));
  const entries = SECTIONS.filter((s) => {
    const story = board.sections[s.id]?.miniStory;
    return !!story && story.trim() !== '';
  });
  if (entries.length === 0) return null;

  return (
    <>
      {/* 대시보드 높이 예산(≤1.2뷰포트, v71r3 R3-1b) — 📷 행과 한 줄을 공유하는 컴팩트 트리거 */}
      <button
        onClick={() => setOpen(true)}
        className="whitespace-nowrap px-2 py-2 text-caption text-[#6E6962] underline active:opacity-70"
      >
        📖 미래 일기 {entries.length}편 →
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5 animate-fadeIn"
          onClick={() => setOpen(false)}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label="미래 일기 모아 읽기"
            className="w-full max-w-sm md:max-w-md rounded-2xl bg-white overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F5F5F3]">
              <p className="text-body font-semibold">📖 미래 일기 {entries.length}편</p>
              <button
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="w-7 h-7 rounded-full bg-[#F5F5F3] text-[#6E6962] text-body flex items-center justify-center active:opacity-70"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 max-h-[65vh] overflow-y-auto space-y-5">
              {entries.map((s) => (
                <div key={s.id}>
                  <p className="text-caption font-semibold mb-1.5" style={{ color: s.color }}>
                    {s.shortTitle ?? s.title.split(' — ')[0]}
                  </p>
                  <p
                    className="text-body leading-relaxed text-[#374151]"
                    style={{ borderLeft: `2px solid ${s.color}40`, paddingLeft: 10 }}
                  >
                    {renderStory(board.sections[s.id].miniStory!)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
