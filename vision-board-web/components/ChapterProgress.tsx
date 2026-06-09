'use client';

interface Chapter {
  id: number;
  label: string;
}

interface Props {
  chapters: Chapter[];
  currentId: number;
}

export default function ChapterProgress({ chapters, currentId }: Props) {
  return (
    <div className="flex items-center justify-center gap-1">
      {chapters.map((ch, idx) => {
        const isDone = ch.id < currentId;
        const isCurrent = ch.id === currentId;
        const isFuture = ch.id > currentId;
        const isLast = idx === chapters.length - 1;

        return (
          <div key={ch.id} className="flex items-center min-w-0">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-300"
                style={{
                  backgroundColor: isDone || isCurrent ? '#1C1B19' : 'transparent',
                  border: isFuture ? '1.5px dashed #D1D5DB' : 'none',
                  color: isDone || isCurrent ? '#fff' : '#C4C2BE',
                  transform: isCurrent ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {isDone ? '✓' : ch.id}
              </div>
              <span
                className="text-[9px] font-medium whitespace-nowrap leading-tight transition-colors duration-300"
                style={{
                  color: isCurrent ? '#1C1B19' : isDone ? '#6B7280' : '#C4C2BE',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {ch.label}
              </span>
            </div>
            {!isLast && (
              <div
                className="w-4 sm:w-6 h-px mx-0.5 sm:mx-1 transition-colors duration-300"
                style={{ backgroundColor: isDone ? '#1C1B19' : '#E5E3DF' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
