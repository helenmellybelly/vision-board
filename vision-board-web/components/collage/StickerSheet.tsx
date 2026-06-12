'use client';

import { useState } from 'react';
import { CollageSticker, StickerStyle } from '@/lib/types';
import { STICKER_PRESETS } from '@/lib/collageTemplates';
import useFocusTrap from '../useFocusTrap';

interface Props {
  /** 수정 모드 — 기존 스티커 값으로 채움 */
  initial?: CollageSticker;
  onConfirm: (data: { text: string; style: StickerStyle; color?: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const STYLE_LABELS: { id: StickerStyle; label: string }[] = [
  { id: 'script', label: '손글씨' },
  { id: 'chip', label: '라벨' },
  { id: 'outline', label: '아웃라인' },
];

// script 스타일 글자색 — 다크/라이트 보드 양쪽에서 보이는 색만 제공
const SCRIPT_COLORS = ['#FFFFFF', '#1C1B19', '#E8B4C8', '#A5B4FC', '#C9A86A'];

// 문구 스티커 추가/수정 바텀 시트 — 프리셋 칩 + 자유 입력 + 스타일 미리보기
export default function StickerSheet({ initial, onConfirm, onDelete, onClose }: Props) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);
  const [text, setText] = useState(initial?.text ?? '');
  const [style, setStyle] = useState<StickerStyle>(initial?.style ?? 'chip');
  const [color, setColor] = useState<string | undefined>(initial?.color);

  const canConfirm = text.trim().length > 0;

  function preview() {
    const t = text.trim() || '문구를 입력해봐';
    if (style === 'chip') {
      return (
        <span className="inline-block bg-white rounded-md shadow-md px-3 py-2 text-body font-semibold text-[#1C1B19]">
          {t}
        </span>
      );
    }
    if (style === 'outline') {
      return (
        <span
          className="text-title font-extrabold uppercase tracking-wide"
          style={{ color: '#FFFFFF', WebkitTextStroke: '0.07em #1C1B19', paintOrder: 'stroke fill' }}
        >
          {t}
        </span>
      );
    }
    return (
      <span className="font-script text-display font-bold" style={{ color: color ?? '#1C1B19' }}>
        {t}
      </span>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sticker-title"
        className="bg-white w-full max-w-md rounded-t-3xl px-6 pt-6 pb-8 max-h-[88dvh] overflow-y-auto scroll-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#E5E3DF] rounded-full mx-auto mb-5" />
        <h2 id="sticker-title" className="text-heading font-bold mb-1">
          {initial ? '문구 수정' : '문구 스티커 추가'}
        </h2>
        <p className="text-caption text-[#6E6962] mb-4">내 보드에 붙일 한마디 — 프리셋을 고르거나 직접 써봐.</p>

        {/* 미리보기 */}
        <div className="rounded-2xl bg-[#F5F5F3] py-5 px-4 mb-4 text-center overflow-hidden">{preview()}</div>

        {/* 자유 입력 */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 40))}
          placeholder="원하는 문구를 직접 써도 좋아"
          className="w-full rounded-xl border border-[#E5E3DF] px-4 py-3 text-body focus:border-[#1C1B19] mb-3"
        />

        {/* 프리셋 칩 */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {STICKER_PRESETS.map((p) => (
            <button
              key={p.text}
              onClick={() => {
                setText(p.text);
                setStyle(p.style);
              }}
              className={`px-3 py-1.5 rounded-full text-caption font-medium border transition-colors ${
                text === p.text ? 'bg-[#1C1B19] text-white border-[#1C1B19]' : 'bg-white text-[#1C1B19] border-[#E5E3DF]'
              }`}
            >
              {p.text}
            </button>
          ))}
        </div>

        {/* 스타일 선택 */}
        <div className="flex gap-1.5 mb-4 bg-[#F5F5F3] rounded-xl p-1" role="radiogroup" aria-label="스티커 스타일">
          {STYLE_LABELS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={style === s.id}
              onClick={() => setStyle(s.id)}
              className={`flex-1 py-2 rounded-lg text-caption font-semibold transition-colors ${
                style === s.id ? 'bg-white text-[#1C1B19] shadow-sm' : 'text-[#6E6962]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 손글씨 색상 */}
        {style === 'script' && (
          <div className="flex items-center gap-2.5 mb-4" role="radiogroup" aria-label="글자색">
            {SCRIPT_COLORS.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={color === c}
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-full border ${color === c ? 'ring-2 ring-offset-2 ring-[#1C1B19]' : ''}`}
                style={{ backgroundColor: c, borderColor: c === '#FFFFFF' ? '#E5E3DF' : c }}
                aria-label={`글자색 ${c}`}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => canConfirm && onConfirm({ text: text.trim(), style, color: style === 'script' ? color : undefined })}
          disabled={!canConfirm}
          className="w-full py-4 rounded-2xl text-heading font-semibold text-white disabled:opacity-40 transition-opacity active:opacity-80"
          style={{ backgroundColor: '#1C1B19' }}
        >
          {initial ? '수정 완료' : '보드에 붙이기'}
        </button>
        {onDelete && (
          <button onClick={onDelete} className="mt-2 w-full py-2 text-body text-[#B91C1C]">
            이 스티커 삭제
          </button>
        )}
        <button onClick={onClose} className="mt-1 w-full py-2 text-body text-[#6E6962]">
          닫기
        </button>
      </div>
    </div>
  );
}
