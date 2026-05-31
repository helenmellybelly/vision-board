'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  onHelp?: () => void;
  showHelp?: boolean;
}

export default function InlineInput({ onSubmit, placeholder = '여기에 써봐...', disabled = false, onHelp, showHelp }: Props) {
  const [text, setText] = useState('');
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
    onSubmit(trimmed);
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
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className="w-full resize-none text-sm leading-relaxed px-4 pt-3 pb-2 outline-none max-h-40 overflow-y-auto bg-transparent"
        style={{ color: '#1C1B19' }}
      />
      <div className="flex justify-end px-3 pb-3">
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          style={{
            backgroundColor: canSend ? '#1C1B19' : '#E5E3DF',
            color: canSend ? '#fff' : '#9CA3AF',
          }}
        >
          다 썼어 →
        </button>
      </div>
      {onHelp && showHelp && (
        <button
          onClick={onHelp}
          className="w-full text-xs text-[#9CA3AF] pb-3 text-center active:opacity-60"
        >
          답변 도와줘
        </button>
      )}
    </div>
  );
}
