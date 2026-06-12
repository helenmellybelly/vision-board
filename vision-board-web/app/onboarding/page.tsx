'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Brain, Compass, Sparkles, type LucideIcon } from 'lucide-react';
import {
  markOnboardingDone,
  saveUserName,
  saveOnboardingStep,
  loadBoard,
} from '@/lib/storage';
import { SECTION_COLORS } from '@/lib/colors';
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
    `도토리 있잖아, 그 2.5cm짜리 씨앗.\n땅에 심으면 최대 60m 참나무가 돼.`,
  () =>
    `성인 남자 엄지손톱만한 씨앗 안에\n이미 60m짜리 참나무가 들어있는 거야.\n2.5cm가 60m로 변하면 2,400배 성장한 거야.`,
  () =>
    `정말 대단하지 않아? 근데 땅에 심어야만 그렇게 돼.\n책상 위에 올려두면 그저 도토리야.`,
  () =>
    `도토리한테 가장 중요한 건\n어디에 놓이느냐인 거야.\n가능성을 꺼내줄 환경이 필요한 거지.`,
  () =>
    `비전보드를 만드는 것도\n너의 가능성이 펼쳐질 환경을 만드는 일이야.`,
  (name: string) =>
    `${name ? `${name}라는` : '너라는'} 도토리를 땅에 심는 거야.\n참나무가 될 엄청난 잠재력을 가졌으니까.`,
];

const VISION_INTRO = `그 가능성이 펼쳐질 환경을 만드는 도구가 있어. 바로 '비전보드'야.`;

const VISION_CARDS: { icon: LucideIcon; title: string; desc: string; color: string }[] = [
  {
    icon: Brain,
    title: '원하는 삶을 현실로 믿게 해줘',
    desc: '비전보드를 매일 보다 보면, 뇌는 그걸 이미 경험한 것처럼 받아들이기 시작해.',
    color: SECTION_COLORS[0],
  },
  {
    icon: Compass,
    title: '삶의 방향을 잡아줘',
    desc: '흔들려도 원하는 방향으로 갈 수 있도록 도와줘. 삶의 주도권을 놓지 않게 해주지.',
    color: SECTION_COLORS[1],
  },
  {
    icon: Sparkles,
    title: '되고 싶은 나를 그려줘',
    desc: '어떤 사람이 되고 싶은지 정의하고, 어떤 습관을 들이고 무엇을 멀리할지 살피며 살게 돼.',
    color: SECTION_COLORS[2],
  },
];

// Act 4 — 막연함 vs 선명함 자동 슬라이드 (Unsplash 무료 사진)
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

// 막연함 ↔ 선명함 자동 순환 비교 카드 — 수동 조작 없음, 점은 진행 표시만
function CompareAutoCard() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % COMPARE_SLIDES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const slide = COMPARE_SLIDES[idx];

  return (
    // 이미지가 남는 공간만큼만 차지하되 카드 전체에 상한(max-h-72)을 둠 —
    // 상한 없이는 flex-1이 잉여 높이를 흡수해 도트와 다음 문구 사이에 빈 공간이 생긴다(v6.15 간격 피드백)
    <div className="flex-1 min-h-0 max-h-72 flex flex-col space-y-1.5">
      <div className="relative rounded-2xl overflow-hidden select-none shadow-sm flex-1 min-h-16">
        <div className="relative h-full">
          {COMPARE_SLIDES.map((s, i) => (
            <img
              key={s.key}
              src={s.img}
              alt={s.label}
              loading={i === 0 ? undefined : 'lazy'}
              className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
              style={{
                opacity: i === idx ? 1 : 0,
                filter: s.grayscale ? 'grayscale(0.9) brightness(0.92)' : 'none',
              }}
            />
          ))}
          {/* 하단 그라데이션 + 텍스트 오버레이 */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-5 pt-16 pb-4 pointer-events-none">
            <p
              className="text-caption font-bold tracking-wide mb-0.5 drop-shadow"
              style={{ color: slide.key === 'vivid' ? '#A5B4FC' : '#D1D5DB' }}
            >
              {slide.label}
            </p>
            <p className="text-body font-semibold text-white leading-snug whitespace-pre-line drop-shadow">
              {slide.text}
            </p>
          </div>
        </div>
      </div>

      {/* 점 인디케이터 — 표시 전용 */}
      <div className="flex items-center justify-center gap-1.5 flex-shrink-0" aria-hidden="true">
        {COMPARE_SLIDES.map((s, i) => (
          <span
            key={s.key}
            className="w-2 h-2 rounded-full transition-colors"
            style={{ backgroundColor: i === idx ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>
    </div>
  );
}

const SIX_AREAS = [
  { label: '나', desc: '감정·성장·정체성', color: SECTION_COLORS[0] },
  { label: '건강', desc: '몸·마음·루틴', color: SECTION_COLORS[1] },
  { label: '관계', desc: '사랑·우정·연결', color: SECTION_COLORS[2] },
  { label: '일', desc: '일·배움·성취', color: SECTION_COLORS[3] },
  { label: '돈', desc: '소비·저축·가치', color: SECTION_COLORS[4] },
  { label: '공간', desc: '환경·물건·분위기', color: SECTION_COLORS[5] },
];

const TOTAL_ACTS = 5; // Act 1~5 진행 점 표시

export default function OnboardingPage() {
  const router = useRouter();
  const [act, setAct] = useState<Act>(0);
  const [nameInput, setNameInput] = useState('');
  const [savedName, setSavedName] = useState('');
  const [showNameResponse, setShowNameResponse] = useState(false);
  const [acornStep, setAcornStep] = useState(-1);
  const acornScrollRef = useRef<HTMLDivElement>(null);

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

  // 새 도토리 메시지가 나오면 메시지 영역만 맨 아래로 — 페이지 스크롤바 대신 내부 스크롤
  useEffect(() => {
    const el = acornScrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [acornStep]);

  function handleAcornTap() {
    if (acornStep >= 0 && acornStep < ACORN_MESSAGES.length - 1) {
      setAcornStep((s) => s + 1);
    }
  }

  function goToAct(a: Act) {
    setAct(a);
    saveOnboardingStep(a);
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
    // 페이지 자체는 뷰포트에 고정 — 어떤 Act에서도 웹 전체 스크롤바가 생기지 않게.
    // 내용이 넘치는 경우는 각 Act 내부의 scroll-soft 영역이 받는다.
    <main className="h-dvh overflow-hidden flex flex-col max-w-md md:max-w-xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
      {act > 0 && (
        <div className="mb-4 mt-1 flex items-center justify-center gap-1.5">
          {Array.from({ length: TOTAL_ACTS }, (_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-colors duration-300"
              style={{ backgroundColor: i < act ? '#1C1B19' : '#E5E3DF' }}
            />
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 flex flex-col animate-fadeIn" key={act}>

        {/* ══════════ ACT 0: 토리 소개 ══════════ */}
        {act === 0 && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
          <div className="min-h-full flex-shrink-0 flex flex-col justify-center space-y-6">
            {/* webm은 진짜 알파 채널. mp4 폴백은 흰 배경이라 multiply로 투과 — 페이지 배경이 밝아야 자연스러움 */}
            <div className="flex justify-center" style={{ backgroundColor: 'transparent' }}>
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: "280px",
                  height: "280px",
                  objectFit: "contain",
                  backgroundColor: "transparent",
                  mixBlendMode: "multiply",
                  filter: "contrast(1.15) saturate(1.1)",
                }}
              >
                <source src="/tori-v3-alpha.webm" type="video/webm" />
                <source src="/tori-v3.mp4" type="video/mp4" />
              </video>
            </div>

            <div className="space-y-1 text-center px-2">
              <p className="text-body text-[#1C1B19] leading-relaxed font-medium">
                안녕, 나는 토리(Tory)야.
              </p>
              <p className="text-body text-[#6B7280] leading-relaxed">
                네가 원하는 삶을 발견할 수 있도록<br />
                도와주는 꿈의 정원사지.<br />
                나는 네가 원하는 삶의 이야기가 너무 궁금해.
              </p>
            </div>

            <button
              onClick={() => goToAct(1)}
              className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              {ACT0_CTA}
            </button>
          </div>
          </div>
        )}

        {/* ══════════ ACT 1: 이름 ══════════ */}
        {act === 1 && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
          <div className="min-h-full flex-shrink-0 flex flex-col justify-center space-y-4">
            {/* 토리 프로필 헤더 — 사진 옆 이름, 그 아래로 채팅이 흐름 */}
            <div className="flex items-center gap-3">
              <img
                src="/tori-profile-bust.png"
                alt="토리"
                className="w-12 h-12 rounded-2xl object-contain flex-shrink-0"
              />
              <p className="text-body font-semibold text-[#1C1B19]">토리</p>
            </div>

            <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="text-body leading-relaxed">
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

            {!showNameResponse && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && handleNameSubmit()}
                  placeholder="이름 또는 닉네임"
                  className="flex-1 min-w-0 px-4 py-3 rounded-xl border border-[#E5E3DF] text-body outline-none focus:border-[#1C1B19] transition-colors bg-white"
                  autoFocus
                />
                <button
                  onClick={handleNameSubmit}
                  disabled={!nameInput.trim()}
                  className="px-5 py-3 rounded-xl text-body font-semibold text-white disabled:opacity-40 transition-opacity flex-shrink-0 whitespace-nowrap"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  저장
                </button>
              </div>
            )}

            {showNameResponse && (
              <>
                <div className="bg-[#1C1B19] text-white rounded-2xl rounded-tl-sm px-4 py-3 animate-fadeIn">
                  <p className="text-body leading-relaxed">
                    아, {savedName}! 좋은 이름이다 😊<br />
                    이제 같이 시작해보자.
                  </p>
                </div>
                <button
                  onClick={() => goToAct(2)}
                  className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80 animate-fadeIn"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  그래 좋아 !
                </button>
              </>
            )}
          </div>
          </div>
        )}

        {/* ══════════ ACT 2: 도토리 이야기 ══════════ */}
        {act === 2 && (
          <div className="flex-1 min-h-0 flex flex-col cursor-pointer" onClick={handleAcornTap}>
            {acornStep >= 0 && (
              <>
                {/* 토리 프로필 헤더 — 고정 */}
                <div className="flex items-center gap-3 mb-3 flex-shrink-0">
                  <img
                    src="/tori-profile-bust.png"
                    alt="토리"
                    className="w-12 h-12 rounded-2xl object-contain flex-shrink-0"
                  />
                  <p className="text-body font-semibold text-[#1C1B19]">토리</p>
                </div>

                {/* 메시지 영역 — 페이지 대신 여기만 스크롤, 새 메시지는 자동으로 아래에 보임 */}
                <div ref={acornScrollRef} className="flex-1 min-h-0 overflow-y-auto scroll-soft">
                  <div className="min-h-full flex-shrink-0 flex flex-col justify-center space-y-3">
                    {Array.from({ length: acornStep + 1 }, (_, i) => (
                      <div
                        key={i}
                        className={
                          i === acornStep
                            ? 'bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 animate-fadeIn'
                            : 'bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 opacity-60'
                        }
                      >
                        <p className="text-body leading-relaxed whitespace-pre-line">
                          {ACORN_MESSAGES[i](name)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 탭 힌트 / CTA — 스크롤 영역 밖 하단 고정 */}
                {acornStep < ACORN_MESSAGES.length - 1 ? (
                  <div className="text-center pt-3 pb-1 select-none flex-shrink-0">
                    <span className="text-caption text-[#6E6962] animate-pulse">▼ 계속하려면 탭</span>
                  </div>
                ) : (
                  <div className="animate-fadeIn pt-4 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); goToAct(3); }}
                      className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80"
                      style={{ backgroundColor: '#1C1B19' }}
                    >
                      그 가능성, 꺼내볼게 →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════ ACT 3: 비전보드 설명 (시각) ══════════ */}
        {act === 3 && (
          <div className="flex-1 min-h-0 flex flex-col space-y-5">
            {/* 토리 말풍선 */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/tori-profile-bust.png"
                  alt="토리"
                  className="w-12 h-12 rounded-2xl object-contain flex-shrink-0"
                />
                <p className="text-body font-semibold text-[#1C1B19]">토리</p>
              </div>
              <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-body leading-relaxed">{VISION_INTRO}</p>
              </div>
            </div>

            {/* 비전보드 정의 박스 */}
            <div
              className="rounded-2xl px-5 py-4 border"
              style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DF' }}
            >
              <p className="text-caption font-semibold text-[#6E6962] mb-1 tracking-wide uppercase">비전보드란?</p>
              <p className="text-body text-[#1C1B19] leading-relaxed">
                네가 원하는 삶을 이미지와 글로 시각화한 나만의 지도.
              </p>
            </div>

            {/* 실제 비전보드 예시 — 모바일은 세로형, 웹은 가로형 */}
            {/* 이미지가 남는 공간만큼만 차지 — 화면 크기와 무관하게 CTA까지 스크롤 없이 보이게 */}
            <div className="flex-1 min-h-0 px-1 flex flex-col items-center">
              <img
                src="/example-board-portrait.jpg"
                alt="비전보드 예시"
                className="flex-1 min-h-0 w-auto max-w-full object-contain rounded-2xl border border-[#E5E3DF] shadow-md md:hidden"
              />
              <img
                src="/example-board-landscape.jpg"
                alt="비전보드 예시"
                className="flex-1 min-h-0 w-auto max-w-full object-contain rounded-2xl border border-[#E5E3DF] shadow-md hidden md:block"
              />
              <p className="text-micro text-[#6E6962] text-center mt-3 flex-shrink-0">완성하면 이런 모습이 돼.</p>
            </div>

            <button
              onClick={() => goToAct(4)}
              className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              와, 기대되는데? →
            </button>
          </div>
        )}

        {/* ══════════ ACT 4: 막연함과 선명함의 차이 ══════════ */}
        {act === 4 && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
          <div className="min-h-full flex-shrink-0 flex flex-col justify-center">
            <p className="text-title font-bold text-[#1C1B19] leading-snug flex-shrink-0 mb-2">막연함과 선명함의 차이</p>

            <CompareAutoCard />

            {/* 핵심 메시지 — 이미지의 결론이므로 카드에 바짝 붙인다 */}
            <div className="text-center px-2 flex-shrink-0 mt-2">
              <p className="text-body text-[#1C1B19] leading-snug">
                원하는 것이 뚜렷해지는 순간, <span className="font-bold">뇌는 그쪽으로 움직이기 시작해.</span>
              </p>
              <p className="text-body font-bold text-[#1C1B19] leading-snug mt-1">그게 비전보드의 힘이야.</p>
            </div>

            {/* 비전보드를 하면 좋은 이유 — 새 주제 블록이므로 위쪽에 더 큰 호흡 */}
            <div className="space-y-1.5 flex-shrink-0 mt-3">
              <p className="text-body font-bold text-[#1C1B19]">비전보드를 하면 좋은 이유</p>
              <div className="space-y-1.5">
                {VISION_CARDS.map((card) => (
                  <div
                    key={card.title}
                    className="flex items-start gap-3 rounded-xl bg-white px-4 py-1.5 border border-[#E5E3DF]"
                    style={{ borderLeft: `3px solid ${card.color}` }}
                  >
                    <card.icon size={20} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" style={{ color: card.color }} aria-hidden="true" />
                    <div>
                      <p className="text-body font-semibold leading-snug" style={{ color: card.color }}>{card.title}</p>
                      <p className="text-caption text-[#6B7280] leading-snug">{card.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => goToAct(5)}
              className="w-full py-3 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80 flex-shrink-0 mt-3"
              style={{ backgroundColor: '#1C1B19' }}
            >
              오, 그렇구나
            </button>
          </div>
          </div>
        )}

        {/* ══════════ ACT 5: 6 화단 안내 → 시작 ══════════ */}
        {act === 5 && (
          <div className="flex-1 min-h-0 overflow-y-auto scroll-soft flex flex-col">
          <div className="min-h-full flex-shrink-0 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/tori-profile-bust.png"
                  alt="토리"
                  className="w-12 h-12 rounded-2xl object-contain flex-shrink-0"
                />
                <p className="text-body font-semibold text-[#1C1B19]">토리</p>
              </div>
              <div className="bg-[#1C1B19] text-white rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-body leading-relaxed">
                  좋아{name ? `, ${name}${getNameSuffix(name)}` : ''}.<br />
                  이제 진짜 시작이야.<br />
                  비전보드는 삶의 6가지 영역으로 이루어져 있어.<br />
                  하나씩 채워가다 보면 네 삶 전체가 그려지기 시작할 거야.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SIX_AREAS.map((area) => (
                <div
                  key={area.label}
                  className="rounded-xl bg-white px-3.5 py-3 text-left border border-[#E5E3DF]"
                  style={{ borderLeft: `3px solid ${area.color}` }}
                >
                  <p className="text-body font-bold" style={{ color: area.color }}>{area.label}</p>
                  <p className="text-micro text-[#6B7280] mt-0.5">{area.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl text-heading font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              비전보드 시작하기 →
            </button>
          </div>
          </div>
        )}

      </div>

      {canGoBack() && (
        <button
          onClick={handleBack}
          className="w-full text-[#6E6962] py-2 text-caption mt-4 flex items-center justify-center gap-1 hover:text-[#1C1B19] transition-colors"
        >
          ← 이전
        </button>
      )}
      {act > 1 && act < 5 && (
        <button
          onClick={goToStart}
          className="w-full text-[#6E6962] py-1 text-caption flex items-center justify-center hover:text-[#1C1B19] transition-colors"
        >
          처음부터 다시 보기
        </button>
      )}
    </main>
  );
}
