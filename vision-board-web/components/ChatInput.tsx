'use client';

import { useState, useRef, useEffect } from 'react';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({ onSend, disabled, placeholder = '여기에 써봐...' }: Props) {
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex items-end gap-2 px-4 py-3 border-t border-[#E5E3DF] bg-white">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="flex-1 resize-none text-sm leading-relaxed bg-[#F5F5F3] rounded-xl px-3 py-2.5 outline-none max-h-32 overflow-y-auto"
        style={{ color: '#1C1B19' }}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors"
        style={{
          backgroundColor: text.trim() && !disabled ? '#1C1B19' : '#E5E3DF',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 12h14M12 5l7 7-7 7"
            stroke={text.trim() && !disabled ? '#fff' : '#9CA3AF'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
