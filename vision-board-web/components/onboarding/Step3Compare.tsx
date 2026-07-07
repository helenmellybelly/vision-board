'use client';

// 스텝3: 막연함 vs 선명함 (v7.1-r1 — 자동 순환 페이드 카드 → 위아래 동시 대비 스택.
// 대비는 두 상태가 한눈에 보일 때 가장 직관적이라는 피드백. 구 CompareAutoCard(setInterval)·점 인디케이터 삭제)
const COMPARE_SLIDES = [
  {
    key: 'vague',
    label: '막연한 바람',
    text: '"언젠가 건강하게 살고 싶다..."',
    img: 'https://images.unsplash.com/photo-1492447166138-50c3889fccb1?auto=format&fit=crop&w=800&q=60',
    grayscale: true,
  },
  {
    key: 'vivid',
    label: '생생한 장면',
    text: '"새벽 6시 러닝 끝내고 샤워 후 커피 한 잔.\n몸이 가볍고 하루가 내 것인 느낌."',
    img: 'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=60',
    grayscale: false,
  },
];

// 흑백(막연)·컬러(선명) 카드를 동시에 쌓아 보여준다 — 하단 카드에 강한 보더·섀도로 시선 유도(시선 = 교훈)
function CompareStack() {
  const [vague, vivid] = COMPARE_SLIDES;

  return (
    <div className="flex flex-col gap-2">
      {/* 막연한 바람 — 채도 죽인 카드 */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#E5E3DF] bg-white px-3 py-2.5">
        <img
          src={vague.img}
          alt={vague.label}
          className="w-16 h-16 [@media(min-height:700px)]:w-20 [@media(min-height:700px)]:h-20 rounded-xl object-cover flex-shrink-0"
          style={{ filter: 'grayscale(0.9) brightness(0.92)' }}
        />
        <div className="min-w-0">
          <p className="text-caption font-bold tracking-wide text-[#9CA3AF] mb-0.5">{vague.label}</p>
          <p className="text-body text-[#6E6962] leading-snug whitespace-pre-line">{vague.text}</p>
        </div>
      </div>

      {/* 커넥터 — 변환 프레이밍 */}
      <p className="text-center text-micro font-semibold text-[#6E6962] select-none" aria-hidden="true">
        ↓ 선명하게 바꾸면
      </p>

      {/* 생생한 장면 — 컬러 카드에 시선 */}
      <div
        className="flex items-center gap-3 rounded-2xl border-2 bg-white px-3 py-2.5 shadow-md"
        style={{ borderColor: '#A5B4FC' }}
      >
        <img
          src={vivid.img}
          alt={vivid.label}
          className="w-16 h-16 [@media(min-height:700px)]:w-20 [@media(min-height:700px)]:h-20 rounded-xl object-cover flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-caption font-bold tracking-wide mb-0.5" style={{ color: '#6366F1' }}>
            {vivid.label}
          </p>
          <p className="text-body font-semibold text-[#1C1B19] leading-snug whitespace-pre-line">{vivid.text}</p>
        </div>
      </div>
    </div>
  );
}

export default function Step3Compare({ onComplete }: { onComplete: () => void }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
      <div className="min-h-full flex-shrink-0 flex flex-col justify-center">
        <p className="text-title font-bold text-[#1C1B19] leading-snug flex-shrink-0 mb-2 [@media(min-height:700px)]:mb-3">
          막연함과 선명함, 뭐가 다를까?
        </p>

        <CompareStack />

        {/* 핵심 메시지 — 카드와 한 호흡 띄운다 (v6.16 간격 피드백) */}
        <div className="text-center px-2 flex-shrink-0 mt-3 [@media(min-height:700px)]:mt-5">
          <p className="text-body text-[#1C1B19] leading-snug">
            원하는 것이 뚜렷해지는 순간, <span className="font-bold">뇌는 그쪽으로 움직이기 시작해.</span>
          </p>
          <p className="text-body font-bold text-[#1C1B19] leading-snug mt-1">그게 비전보드의 힘이야.</p>
        </div>

        {/* 비전보드 정의 — 구 Act3 정의 박스를 한 줄로 압축 흡수 */}
        <div
          className="rounded-2xl px-5 py-4 border flex-shrink-0 mt-4 [@media(min-height:700px)]:mt-6"
          style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DF' }}
        >
          <p className="text-caption font-semibold text-[#6E6962] mb-1 tracking-wide uppercase">비전보드란?</p>
          <p className="text-body text-[#1C1B19] leading-relaxed">
            네가 원하는 삶을 이미지와 글로 시각화한, 너만의 지도야.
          </p>
        </div>

        <button
          onClick={onComplete}
          className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80 flex-shrink-0 mt-4 [@media(min-height:700px)]:mt-5"
          style={{ backgroundColor: '#1C1B19' }}
        >
          비전보드 시작하기 →
        </button>
      </div>
    </div>
  );
}
