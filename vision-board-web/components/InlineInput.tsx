'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  // false 반환 시 입력을 비우지 않는다 (검증 실패 — 다시 쓸 수 있게 유지)
  onSubmit: (text: string) => boolean | void;
  placeholder?: string;
  disabled?: boolean;
  onHelp?: () => void;
  example?: string;
  hint?: string;
  error?: string | null;
  // controlled 모드 (v7.0-r2) — 칩 탭으로 외부에서 텍스트를 보태는 /scene 통합 페이지용.
  // 둘 다 넘기면 내부 state 대신 부모 state를 쓴다
  value?: string;
  onChangeText?: (text: string) => void;
}

export default function InlineInput({ onSubmit, placeholder = '여기에 써봐...', disabled = false, onHelp, example, hint, error, value, onChangeText }: Props) {
  const [internalText, setInternalText] = useState('');
  const isControlled = value !== undefined && onChangeText !== undefined;
  const text = isControlled ? value : internalText;
  const setText = isControlled ? onChangeText : setInternalText;
  const [visible, setVisible] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    const ok = onSubmit(trimmed);
    if (ok === false) return;
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  }

  const canSend = !!text.trim() && !disabled;

  return (
    <div
      className="mt-4 mb-2 rounded-2xl border bg-white overflow-hidden"
      style={{
        borderColor: '#E5E3DF',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 0.3s ease, transform 0.3s ease',
      }}
    >
      {example && (
        <div className="px-4 pt-3 pb-2 border-b border-[#F5F5F3]">
          <p className="text-caption text-[#6E6962] font-medium mb-1">이런 식으로 써봐</p>
          <p className="text-caption text-[#6E6962] leading-relaxed">{example}</p>
        </div>
      )}
      {hint && (
        <p className="text-caption text-[#6E6962] px-4 pt-2">{hint}</p>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="w-full resize-none text-body md:text-body leading-relaxed px-4 pt-3 pb-2 outline-none max-h-40 overflow-y-auto bg-transparent placeholder:text-[#6E6962]"
        style={{ color: '#1C1B19' }}
      />
      {error && (
        <p className="text-caption text-[#B45309] px-4 pb-2">{error}</p>
      )}
      <div className="flex items-center justify-between px-3 pb-3">
        {onHelp ? (
          <button
            onClick={onHelp}
            className="text-caption text-[#6E6962] active:opacity-60"
          >
            답변 도와줘
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="px-4 py-2 rounded-xl text-body font-semibold transition-colors"
          style={{
            backgroundColor: canSend ? '#1C1B19' : '#E5E3DF',
            color: canSend ? '#fff' : '#9CA3AF',
          }}
        >
          다 썼어 →
        </button>
      </div>
    </div>
  );
}
