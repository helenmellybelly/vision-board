'use client';

import { SECTIONS } from '@/lib/questions';

// 구 랜딩(/) HeroBoard 보존본 (v7.0-r1) — 콜라주와 동일한 폴라로이드 언어로 완성본의 룩을 미리 보여준다.
// R5에서 대시보드 상단 진행 피드백(완료 섹션은 첫 사진 채움 + "이제 N칸 남았어")으로 확장 예정.
const ROTATIONS = [-2.5, 1.5, -1.5, 2, -2, 2.5];

const AREAS = SECTIONS.map((s) => ({
  label: s.title.split(' — ')[0],
  color: s.color,
  lightColor: s.lightColor,
}));

export default function MiniBoardPreview() {
  return (
    <div className="rounded-3xl px-4 py-5" style={{ backgroundColor: '#2D2B29' }}>
      <div className="grid grid-cols-3 gap-3 items-center">
        {AREAS.slice(0, 3).map((area, i) => (
          <MiniPolaroid key={area.label} area={area} index={i} />
        ))}
        <div className="col-span-3 flex flex-col items-center justify-center text-center py-2.5 select-none">
          <p className="text-micro font-semibold tracking-[0.3em] text-[#C4C2BE] uppercase">
            Vision Board
          </p>
          <p className="text-title font-bold text-white tracking-widest mt-0.5">
            나의 해
          </p>
        </div>
        {AREAS.slice(3).map((area, i) => (
          <MiniPolaroid key={area.label} area={area} index={i + 3} />
        ))}
      </div>
    </div>
  );
}

function MiniPolaroid({
  area,
  index,
}: {
  area: { label: string; color: string; lightColor: string };
  index: number;
}) {
  return (
    <div
      className="bg-white p-1 pb-0.5 rounded-sm shadow-md animate-slideUp"
      style={{
        transform: `rotate(${ROTATIONS[index]}deg)`,
        animationDelay: `${200 + index * 130}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div
        className="w-full aspect-square flex items-center justify-center"
        style={{ backgroundColor: area.lightColor }}
      >
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: area.color }} />
      </div>
      <p className="text-micro text-center text-[#57534E] py-1">{area.label}</p>
    </div>
  );
}
