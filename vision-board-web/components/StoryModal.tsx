'use client';

import { useState } from 'react';
import { BookOpen, Pencil } from 'lucide-react';
import useFocusTrap from './useFocusTrap';

// 스토리 편집 안내 문구 — 편집 UI가 있는 곳(moment 포함)에서 공용
export const BOLD_EDIT_HINT = '**굵게** 표시는 그대로 두면 강조로 보여.';

interface StoryModalProps {
  story: string;
  color: string;
  /** 트리거 버튼 라벨 (기본: 스토리 보기) */
  label?: string;
  /** 모달 상단 제목 (기본: 라벨과 동일) */
  title?: string;
  triggerClassName?: string;
  /** 트리거 형태 — card(기본): 전체폭 카드 버튼, icon: 헤더행용 소형 원형 아이콘 */
  triggerVariant?: 'card' | 'icon';
  /** 전달하면 모달 안에서 직접 수정 가능 */
  onSave?: (next: string) => void;
}

// **굵게** 마크다운 볼드 렌더러 — moment 페이지와 공용 (v6.21 중복 제거)
export function renderStory(text: string) {
  const lines = text.split('\n');
  return lines.map((line, li) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);
    return (
      <span key={li}>
        {parts.map((part, i) =>
          i % 2 === 1
            ? <strong key={i} className="font-semibold text-[#1C1B19]">{part}</strong>
            : part
        )}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
}

export default function StoryModal({
  story,
  color,
  label = '스토리 보기',
  title,
  triggerClassName = '',
  triggerVariant = 'card',
  onSave,
}: StoryModalProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const trapRef = useFocusTrap<HTMLDivElement>(open, close);

  function close() {
    setOpen(false);
    setEditing(false);
  }

  function handleSave() {
    if (!onSave || !draft.trim()) return;
    onSave(draft.trim());
    setEditing(false);
  }

  return (
    <>
      {triggerVariant === 'icon' ? (
        <button
          onClick={() => setOpen(true)}
          aria-label={title ?? label}
          title={title ?? label}
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-70 ${triggerClassName}`}
          style={{ backgroundColor: `${color}1A`, color }}
        >
          <BookOpen size={12} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className={`w-full rounded-xl border border-[#E5E3DF] bg-white px-4 py-2.5 text-caption text-[#6E6962] flex justify-between items-center active:opacity-70 ${triggerClassName}`}
        >
          <span className="flex items-center gap-1.5">
            <BookOpen size={13} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </span>
          <span className="text-micro">↗</span>
        </button>
      )}

      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5 animate-fadeIn"
          onClick={close}
        >
          <div
            ref={trapRef}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? label}
            className="w-full max-w-sm md:max-w-md rounded-2xl bg-white overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[#F5F5F3]">
              <p className="text-body font-semibold" style={{ color }}>
                {title ?? label}
              </p>
              <button
                onClick={close}
                aria-label="닫기"
                className="w-7 h-7 rounded-full bg-[#F5F5F3] text-[#6E6962] text-body flex items-center justify-center active:opacity-70"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              {editing ? (
                <>
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={10}
                    autoFocus
                    className="w-full text-body leading-relaxed rounded-xl border border-[#E5E3DF] px-3 py-2.5 resize-none focus:outline-none focus:border-[#C9C5BE]"
                  />
                  <p className="text-micro text-[#C9C5BE] mt-1">{BOLD_EDIT_HINT}</p>
                </>
              ) : (
                <p
                  className="text-body leading-relaxed text-[#374151]"
                  style={{ borderLeft: `2px solid ${color}40`, paddingLeft: 10 }}
                >
                  {renderStory(story)}
                </p>
              )}
            </div>

            <div className="px-5 pb-4 flex gap-3">
              {editing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={!draft.trim()}
                    className="flex-1 py-2.5 rounded-xl text-caption font-semibold text-white disabled:opacity-40"
                    style={{ backgroundColor: color }}
                  >
                    저장
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2.5 rounded-xl text-caption text-[#6E6962] border border-[#E5E3DF]"
                  >
                    취소
                  </button>
                </>
              ) : (
                onSave && (
                  <button
                    onClick={() => {
                      setDraft(story);
                      setEditing(true);
                    }}
                    className="flex-1 py-2.5 rounded-xl text-caption font-medium text-[#374151] border border-[#E5E3DF] active:opacity-70 flex items-center justify-center gap-1.5"
                  >
                    <Pencil size={12} strokeWidth={1.8} aria-hidden="true" />
                    직접 수정하기
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
