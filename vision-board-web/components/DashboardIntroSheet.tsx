'use client';

import { SECTIONS } from '@/lib/questions';
import { josa } from '@/lib/josa';

// 6영역 카드 — 명칭·부제의 단일 소스는 lib/questions.ts SECTIONS (v6.21 용어 통일)
const SIX_AREAS = SECTIONS.map((s) => ({
  label: s.title.split(' — ')[0],
  desc: s.title.split(' — ')[1] ?? s.subtitle,
  color: s.color,
}));

// 대시보드 첫 진입 6영역 안내 시트 (v7.0-r1) — 구 온보딩 Act5('이제 진짜 시작')를
// 실제 시작 지점인 대시보드로 이동. 닫으면 dashboardIntroSeen으로 재노출 없음
export default function DashboardIntroSheet({
  userName,
  onClose,
}: {
  userName: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="6가지 영역 안내"
        className="w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <img
            src="/tori-profile-bust.png"
            alt="토리"
            className="w-10 h-10 rounded-2xl object-contain flex-shrink-0"
          />
          <p className="text-body font-semibold text-[#1C1B19]">토리</p>
        </div>

        {/* v7.5 산책길 은유 — 대시보드 WalkPathMap과 어휘 통일(정원→산책길).
            "한 번에 6칸"이 아니라 "마음 가는 곳부터"로 첫 허들을 낮추고, 부분 가치도 여기서 선언 */}
        <p className="text-body leading-relaxed mb-4">
          좋아{userName ? `, ${josa(userName, '아/야')}` : ''}. 비전보드는 6개 스테이션이 있는 산책길이야.<br />
          각 스테이션은 <span className="font-semibold">질문에 답하고 → 어울리는 사진을 담으면</span> 완성돼.
          사진부터 담아도 되지만, 질문으로 진짜 원하는 걸 먼저 찾아보는 걸 추천해 🌰<br />
          한 번에 다 걷는 게 아니야. <span className="font-semibold">먼저 마음 가는 세 곳부터</span> 들러봐 —
          다 걷기 전에도 보드는 자라고, 언제든 폰·PC 배경화면으로 만들 수 있어.
        </p>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {SIX_AREAS.map((area) => (
            <div
              key={area.label}
              className="rounded-xl bg-white px-3.5 py-3 text-left border border-[#E5E3DF]"
            >
              {/* 색은 작은 도트로만 — /board 섹션 헤더와 같은 문법 (촌스러움 피드백, v6.17) */}
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: area.color }}
                />
                <p className="text-body font-bold text-[#1C1B19]">{area.label}</p>
              </div>
              <p className="text-micro text-[#6B7280] mt-0.5">{area.desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-xl text-body font-semibold text-white bg-[#1C1B19] active:opacity-80 transition-opacity"
        >
          좋아, 시작할게 →
        </button>
      </div>
    </div>
  );
}
