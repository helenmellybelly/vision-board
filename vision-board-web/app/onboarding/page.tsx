'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  markOnboardingDone,
  saveUserName,
  saveOnboardingStep,
  loadBoard,
} from '@/lib/storage';
import ChapterProgress from '@/components/ChapterProgress';

type Act = 0 | 1 | 2 | 3 | 4 | 5;

function getNameSuffix(name: string): string {
  if (!name) return '';
  const code = name.charCodeAt(name.length - 1);
  if (code < 0xAC00 || code > 0xD7A3) return '야';
  return (code - 0xAC00) % 28 === 0 ? '야' : '아';
}

// Act 0 CTA — swap to A/B/D to try other options
// A: "나의 꿈을 위한 정원사구나!"
// B: "나도 궁금해, 같이 찾아볼게 →"
// C: "내 이야기 들려줄게 →"  ← current
// D: "꿈 찾는 걸 도와줘 →"
const ACT0_CTA = '내 이야기 들려줄게 →';

const ACORN_MESSAGES = [
  (name: string) =>
    `${name ? `${name}${getNameSuffix(name)}, ` : ''}토리가 좋아하는 이야기가 있어.\n들어봐.`,
  () =>
    `도토리 있잖아, 그 2.5cm짜리 씨앗.\n흙에 심으면 최대 60m 참나무가 돼.`,
  () =>
    `성인 남자 엄지손톱만한 씨앗 안에\n이미 60m짜리 참나무가 들어있는 거야.\n2.5cm가 60m로 변하면 2,400배 성장한 거야.`,
  () =>
    `정말 대단하지 않아? 근데 흙에 심어야만 그렇게 돼.\n책상 위에 올려두면 그저 도토리야.`,
  () =>
    `도토리한테 가장 중요한 건\n어디에 놓이느냐인 거야.\n가능성을 꺼내줄 환경이 필요한 거지.`,
  () =>
    `비전보드를 만드는 것도\n너의 가능성이 펼쳐질 환경을 만드는 일이야.`,
  (name: string) =>
    `${name ? `${name}라는` : '너라는'} 도토리를 땅에 심는 거야.\n참나무가 될 엄청난 잠재력을 가졌으니까.`,
];

const VISION_INTRO = `그 가능성이 펼쳐질 환경을 만드는 도구가 있어. 바로 '비전보드'야.`;

const VISION_CARDS = [
  {
    emoji: '🧠',
    title: '원하는 삶을 현실로 믿게 해줘',
    desc: '비전보드를 매일 보다 보면, 뇌는 그걸 이미 경험한 것처럼 받아들이기 시작해.',
    color: '#8B5CF6',
  },
  {
    emoji: '🧭',
    title: '삶의 방향을 잡아줘',
    desc: '흔들릴 때마다 내가 원하는 방향으로 다시 돌아오게 해줘. 내 삶의 주도권을 내 손에 쥐게 해줘.',
    color: '#10B981',
  },
  {
    emoji: '🪞',
    title: '되고 싶은 나를 그려줘',
    desc: '어떤 사람이 되고 싶은지 정의하고, 어떤 습관을 들이고 무엇을 멀리할지 살피며 살게 돼.',
    color: '#F59E0B',
  },
];

const SIX_AREAS = [
  { label: '나', desc: '감정·성장·정체성', color: '#8B5CF6' },
  { label: '건강', desc: '몸·마음·루틴', color: '#10B981' },
  { label: '관계', desc: '사랑·우정·연결', color: '#F59E0B' },
  { label: '일', desc: '일·배움·성취', color: '#3B82F6' },
  { label: '돈', desc: '소비·저축·가치', color: '#F97316' },
  { label: '공간', desc: '환경·물건·분위기', color: '#06B6D4' },
];

const CHAPTERS = [
  { id: 1, label: '인사' },
  { id: 2, label: '가능성' },
  { id: 3, label: '비전' },
  { id: 4, label: '시작' },
];

function actToChapterId(act: Act): number {
  if (act === 0) return 0;
  if (act === 5) return 4;
  if (act === 4) return 3;
  return act;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [act, setAct] = useState<Act>(0);
  const [nameInput, setNameInput] = useState('');
  const [savedName, setSavedName] = useState('');
  const [showNameResponse, setShowNameResponse] = useState(false);
  const [acornStep, setAcornStep] = useState(-1);

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingStep && board.onboardingStep > 1) {
      const savedAct = Math.min(board.onboardingStep, 5) as Act;
      setAct(savedAct);
    }
    if (board.userName) {
      setSavedName(board.userName);
      setNameInput(board.userName);
    }
  }, []);

  // Act 2 진입 시 도토리 스토리 시작
  useEffect(() => {
    if (act === 2 && acornStep === -1) {
      setAcornStep(0);
    }
  }, [act, acornStep]);

  // Act 2: 자동 전환 (2.5초)
  useEffect(() => {
    if (acornStep >= 0 && acornStep < ACORN_MESSAGES.length - 1) {
      const timer = setTimeout(() => setAcornStep((s) => s + 1), 2500);
      return () => clearTimeout(timer);
    }
  }, [acornStep]);

  function handleAcornTap() {
    if (acornStep >= 0 && acornStep < ACORN_MESSAGES.length - 1) {
      setAcornStep((s) => s + 1);
    }
  }

  function goToAct(a: Act) {
    setAct(a);
    saveOnboardingStep(a);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleNameSubmit() {
    const n = nameInput.trim();
    if (!n) return;
    setSavedName(n);
    saveUserName(n);
    setShowNameResponse(true);
  }

  function handleFinish() {
    markOnboardingDone();
    router.replace('/welcome');
  }

  function goToStart() {
    setAcornStep(-1);
    setShowNameResponse(false);
    goToAct(0);
  }

  function handleBack() {
    if (act === 1) { goToAct(0); return; }
    if (act === 2) { setAcornStep(-1); goToAct(1); return; }
    if (act === 3) { goToAct(2); return; }
    if (act === 4) { goToAct(3); return; }
    if (act === 5) { goToAct(4); return; }
  }

  function canGoBack(): boolean {
    if (act === 0) return false;
    if (act === 2 && acornStep >= 0 && acornStep < ACORN_MESSAGES.length - 1) return false;
    return true;
  }

  const name = savedName || '';

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full px-6 py-8">
      {act > 0 && (
        <div className="mb-8 mt-1">
          <ChapterProgress chapters={CHAPTERS} currentId={actToChapterId(act)} />
        </div>
      )}

      <div className="flex-1 flex flex-col animate-fadeIn" key={act}>

        {/* ══════════ ACT 0: 토리 소개 ══════════ */}
        {act === 0 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex justify-center">
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{ width: "280px", height: "280px", objectFit: "contain", transform: "translateZ(0)", backfaceVisibility: "hidden" }}
              >
                <source src="/인사-투명.webm" type="video/webm" />
                <source src="/인사- 배경없음.mp4" type="video/mp4" />
              </video>
            </div>

            <div className="space-y-1 text-center px-2">
              <p className="text-sm text-[#1C1B19] leading-relaxed font-medium">
                안녕, 나는 토리(Tory)야.
              </p>
              <p className="text-sm text-[#6B7280] leading-relaxed">
                네가 원하는 삶을 발견할 수 있도록<br />
                도와주는 꿈의 정원사지.<br />
                나는 네가 원하는 삶의 이야기가 너무 궁금해.
              </p>
            </div>

            <button
              onClick={() => goToAct(1)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              {ACT0_CTA}
            </button>
          </div>
        )}

        {/* ══════════ ACT 1: 이름 ══════════ */}
        {act === 1 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex items-start gap-4">
              <img
                src="/프로필상반신.png"
                alt="토리"
                className="w-14 h-14 rounded-2xl object-contain flex-shrink-0"
              />
              <div className="space-y-2 flex-1">
                <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">
                    만나서 반가워 😊<br />
                    앞으로 너의 비전보드를 함께 만들어갈 거야.<br />
                    <br />
                    내 목표는 네가 원하는 삶을 발견하고,<br />
                    그 삶을 생생하게 그려볼 수 있도록 돕는 거야.<br />
                    언제나 너의 삶을 지켜보고 응원해주는 정원사가 될게.<br />
                    <br />
                    <strong>앞으로 나는 너를 뭐라고 불러줄까? 🌱</strong>
                  </p>
                </div>
              </div>
            </div>

            {!showNameResponse && (
              <div className="flex gap-2 ml-16">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && handleNameSubmit()}
                  placeholder="이름 또는 닉네임"
                  className="flex-1 px-4 py-3 rounded-xl border border-[#E5E3DF] text-sm outline-none focus:border-[#1C1B19] transition-colors bg-white"
                  autoFocus
                />
                <button
                  onClick={handleNameSubmit}
                  disabled={!nameInput.trim()}
                  className="px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  저장
                </button>
              </div>
            )}

            {showNameResponse && (
              <>
                <div className="flex items-start gap-4 animate-fadeIn">
                  <img
                    src="/프로필상반신.png"
                    alt="토리"
                    className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
                  />
                  <div className="bg-[#1C1B19] text-white rounded-2xl rounded-tl-sm px-4 py-3">
                    <p className="text-sm leading-relaxed">
                      아, {savedName}! 좋은 이름이다 😊<br />
                      이제 같이 시작해보자.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => goToAct(2)}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80 animate-fadeIn"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  그래 좋아 !
                </button>
              </>
            )}
          </div>
        )}

        {/* ══════════ ACT 2: 도토리 이야기 ══════════ */}
        {act === 2 && (
          <div className="flex-1 flex flex-col justify-center">
            {acornStep >= 0 && (
              <div className="space-y-3 cursor-pointer" onClick={handleAcornTap}>
                {Array.from({ length: acornStep + 1 }, (_, i) => (
                  <div key={i} className="flex items-start gap-4">
                    {i === acornStep ? (
                      <>
                        <img
                          src="/프로필상반신.png"
                          alt="토리"
                          className="w-12 h-12 rounded-xl object-contain flex-shrink-0 animate-fadeIn"
                        />
                        <div className="flex-1 space-y-2 animate-fadeIn">
                          <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                          <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                            <p className="text-sm leading-relaxed whitespace-pre-line">
                              {ACORN_MESSAGES[i](name)}
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-12 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 opacity-60">
                            <p className="text-sm leading-relaxed whitespace-pre-line">
                              {ACORN_MESSAGES[i](name)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {acornStep < ACORN_MESSAGES.length - 1 && (
                  <div className="text-center pt-2 pb-1 select-none">
                    <span className="text-xs text-[#9CA3AF] animate-pulse">▼ 계속하려면 탭</span>
                  </div>
                )}

                {acornStep === ACORN_MESSAGES.length - 1 && (
                  <div className="animate-fadeIn pt-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); goToAct(3); }}
                      className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
                      style={{ backgroundColor: '#1C1B19' }}
                    >
                      그 가능성, 꺼내볼게 →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════ ACT 3: 비전보드 설명 (시각) ══════════ */}
        {act === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-5">
            {/* 토리 말풍선 */}
            <div className="flex items-start gap-4">
              <img
                src="/프로필상반신.png"
                alt="토리"
                className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
              />
              <div className="space-y-2 flex-1">
                <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">{VISION_INTRO}</p>
                </div>
              </div>
            </div>

            {/* 비전보드 정의 박스 */}
            <div
              className="rounded-2xl px-5 py-4 border"
              style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DF' }}
            >
              <p className="text-xs font-semibold text-[#9CA3AF] mb-1 tracking-wide uppercase">비전보드란?</p>
              <p className="text-sm text-[#1C1B19] leading-relaxed">
                네가 원하는 삶을 이미지와 글로 시각화한 나만의 지도.
              </p>
            </div>

            {/* 3가지 효과 카드 */}
            <div className="space-y-2">
              {VISION_CARDS.map((card) => (
                <div
                  key={card.title}
                  className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
                  style={{ backgroundColor: card.color + '12' }}
                >
                  <span className="text-xl flex-shrink-0 mt-0.5">{card.emoji}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: card.color }}>{card.title}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => goToAct(4)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              그게 어떻게 가능한 건데? →
            </button>
          </div>
        )}

        {/* ══════════ ACT 4: 막연함과 선명함의 차이 ══════════ */}
        {act === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="space-y-1">
              <p className="text-xs text-[#9CA3AF] font-medium">이게 왜 다른지 봐줄게.</p>
              <p className="text-2xl font-bold text-[#1C1B19] leading-snug">막연함과 선명함의 차이</p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl px-5 py-4 bg-[#F5F5F3]">
                <p className="text-xs font-semibold text-[#9CA3AF] mb-2">막연한 바람</p>
                <p className="text-sm text-[#6B7280] leading-relaxed">"언젠가 건강하게 살고 싶다."</p>
              </div>

              <div className="rounded-2xl px-5 py-4" style={{ backgroundColor: '#EEF2FF' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#6366F1' }}>생생한 장면</p>
                <p className="text-sm leading-relaxed font-medium" style={{ color: '#4338CA' }}>
                  "새벽 6시에 러닝 끝내고 샤워 후 커피 한 잔.<br />
                  몸이 가볍고 하루가 내 것인 느낌."
                </p>
              </div>
            </div>

            <p className="text-xs text-[#6B7280] leading-relaxed text-center px-2">
              두 번째처럼 뚜렷해지면, 뇌는 그쪽으로 자연히 움직이기 시작해.<br />
              그게 비전보드의 힘이야.
            </p>

            <button
              onClick={() => goToAct(5)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              오, 그렇구나
            </button>
          </div>
        )}

        {/* ══════════ ACT 5: 6 화단 안내 → 시작 ══════════ */}
        {act === 5 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex items-start gap-4">
              <img
                src="/프로필상반신.png"
                alt="토리"
                className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
              />
              <div className="space-y-2 flex-1">
                <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                <div className="bg-[#1C1B19] text-white rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">
                    좋아{name ? `, ${name}${getNameSuffix(name)}` : ''}.<br />
                    이제 진짜 시작이야.<br />
                    비전보드는 삶의 6가지 영역으로 이루어져 있어.<br />
                    하나씩 채워가다 보면 네 삶 전체가 그려지기 시작할 거야.
                  </p>
                </div>
              </div>
            </div>

            <div className="ml-16 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {SIX_AREAS.map((area) => (
                  <div
                    key={area.label}
                    className="rounded-xl px-3.5 py-3 text-left"
                    style={{ backgroundColor: area.color + '15' }}
                  >
                    <p className="text-sm font-bold" style={{ color: area.color }}>{area.label}</p>
                    <p className="text-[11px] text-[#6B7280] mt-0.5">{area.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              비전보드 시작하기 →
            </button>
          </div>
        )}

      </div>

      {canGoBack() && (
        <button
          onClick={handleBack}
          className="w-full text-[#C4C2BE] py-2 text-xs mt-4 flex items-center justify-center gap-1 hover:text-[#6B7280] transition-colors"
        >
          ← 이전
        </button>
      )}
      {act > 1 && act < 5 && (
        <button
          onClick={goToStart}
          className="w-full text-[#D1D5DB] py-1 text-[11px] flex items-center justify-center hover:text-[#9CA3AF] transition-colors"
        >
          처음부터 다시 보기
        </button>
      )}
    </main>
  );
}
