'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder = '여기에 써봐...\n(Enter로 줄바꿈, 다 쓰면 버튼 눌러)' }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [text]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    // Ctrl+Enter or Cmd+Enter to send (desktop shortcut)
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
    // plain Enter = newline (default textarea behavior)
  }

  const canSend = !!text.trim() && !disabled;

  return (
    <div className="border-t border-[#E5E3DF] bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none text-[15px] md:text-sm leading-relaxed bg-white border border-[#E5E3DF] focus:border-[#1C1B19] transition-colors rounded-xl px-3 py-2.5 outline-none max-h-32 overflow-y-auto placeholder:text-[#6E6962]"
          style={{ color: '#1C1B19' }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold flex-shrink-0 transition-colors"
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
