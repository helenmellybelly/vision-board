// 슬롯 답변 값 렌더러 (v8.0) — 줄바꿈으로 나눠 쓴 답(want 등)은 불릿 리스트로 끊어 보여주고,
// 한 줄 답은 그대로 둔다. 사용자가 직접 붙인 '-'/'·' 머리표는 중복되지 않게 벗겨낸다.
// 회고 3곳(/section 리뷰 패널 · /scene '네가 말해준 것들' · /review)이 공유한다.
interface Props {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function SlotValue({ value, className = '', style }: Props) {
  const lines = value
    .split('\n')
    .map((l) => l.trim().replace(/^[-·•]\s*/, ''))
    .filter(Boolean);

  if (lines.length <= 1) {
    return (
      <p className={`whitespace-pre-line ${className}`} style={style}>
        {lines[0] ?? value}
      </p>
    );
  }

  return (
    <ul className={`space-y-1 ${className}`} style={style}>
      {lines.map((line, i) => (
        <li key={i} className="flex gap-1.5">
          <span className="text-[#C9C5BE] flex-shrink-0" aria-hidden="true">
            ·
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
