'use client';

import { useState } from 'react';

interface Props {
  year: string;
  onYearChange: (year: string) => void;
  /** 표시 상태 버튼 클래스 (font-display 포함 권장) */
  className?: string;
  /** 입력 상태 클래스 — 미지정 시 className 재사용 */
  inputClassName?: string;
}

// 콜라주 템플릿 공용 — 연도 탭하면 그 자리에서 수정
export default function EditableYear({ year, onYearChange, className = '', inputClassName }: Props) {
  const [editing, setEditing] = useState(false);
  const [yearInput, setYearInput] = useState(year);

  function commit() {
    const trimmed = yearInput.trim();
    if (trimmed) onYearChange(trimmed);
    else setYearInput(year);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        type="text"
        inputMode="numeric"
        value={yearInput}
        onChange={(e) => setYearInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        autoFocus
        className={`w-28 bg-transparent text-center outline-none border-b border-current ${inputClassName ?? className}`}
      />
    );
  }

  return (
    <button
      onClick={() => { setYearInput(year); setEditing(true); }}
      className={`active:opacity-70 ${className}`}
      title="연도 수정"
    >
      {year}
    </button>
  );
}
