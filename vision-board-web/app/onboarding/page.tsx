'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  markOnboardingDone,
  saveUserName,
  saveOnboardingStep,
  saveBucketListItems,
  saveBucketListFeeling,
  saveGardenState,
  loadBoard,
} from '@/lib/storage';
import ChapterProgress from '@/components/ChapterProgress';

type Act = 0 | 1 | 2 | 3 | 4 | 5;
type BucketPhase = 'input' | 'imagine' | 'no-bucket';

const ACORN_MESSAGES = [
  (_name: string) => `${_name ? `${_name}아, ` : ''}혹시 도토리 이야기 들어본 적 있어?`,
  () => '도토리는 책상 위에 올려두면\n그냥 도토리일 뿐이야.\n하지만 땅에 심으면?\n거대한 참나무가 돼.',
  () => '겨우 2.5cm짜리 도토리 안에\n최대 60m에 달하는 참나무가 들어있는 거야.\n무려 2,400배나 성장하는 셈이지.',
  () => '만약 책상 위에만 올려두면?\n아무 일도 일어나지 않아.\n영원한 도토리일 뿐이야.',
  () => '나는 우리 모두가 도토리라고 생각해.\n무한한 가능성을 가진,\n아직 심기지 않은 도토리.',
  () => '흙 속에 도토리를 심는 일은\n우리가 꿈을 마주하고, 표현하고,\n현실로 가꾸는 과정과 같아.',
];

const CHAPTERS = [
  { id: 1, label: '인사' },
  { id: 2, label: '꿈' },
  { id: 3, label: '감정' },
  { id: 4, label: '진단' },
  { id: 5, label: '시작' },
];

function actToChapterId(act: Act): number {
  if (act === 0) return 0; // Act 0 is pre-chapter
  return act; // Act 1→1, Act 2→2, etc.
}

export default function OnboardingPage() {
  const router = useRouter();
  const [act, setAct] = useState<Act>(0);
  const [nameInput, setNameInput] = useState('');
  const [savedName, setSavedName] = useState('');
  const [bucketRaw, setBucketRaw] = useState('');
  const [bucketItems, setBucketItems] = useState<string[]>([]);
  const [bucketPhase, setBucketPhase] = useState<BucketPhase>('input');
  const [feelingInput, setFeelingInput] = useState('');
  const [gardenValue, setGardenValue] = useState<string | null>(null);
  const [showNameResponse, setShowNameResponse] = useState(false);
  const [acornStep, setAcornStep] = useState(-1); // -1=unseen, 0..5=story message, 6=done
  const [typingDots, setTypingDots] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Load saved state
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
    if (board.bucketListItems && board.bucketListItems.length > 0) {
      setBucketItems(board.bucketListItems);
      setBucketRaw(board.bucketListItems.join('\n'));
    }
    if (board.bucketListFeeling) {
      setFeelingInput(board.bucketListFeeling);
    }
    if (board.gardenState) {
      setGardenValue(board.gardenState);
    }
  }, []);

  // 도토리 이야기: Act 2에 진입하면 시작
  useEffect(() => {
    if (act === 2 && acornStep === -1) {
      setAcornStep(0);
    }
  }, [act, acornStep]);

  // 도토리 이야기: 탭 투 컨티뉴 + 4초 자동 진행 fallback
  useEffect(() => {
    if (acornStep >= 0 && acornStep < ACORN_MESSAGES.length - 1) {
      const timer = setTimeout(() => setAcornStep((s) => s + 1), 4000);
      return () => clearTimeout(timer);
    }
  }, [acornStep]);

  function handleAcornTap() {
    if (acornStep >= 0 && acornStep < ACORN_MESSAGES.length - 1) {
      setAcornStep((s) => s + 1);
    }
  }

  const name = savedName || '너';

  function goToAct(a: Act) {
    setAct(a);
    saveOnboardingStep(a);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Act 1: 이름 ──
  function handleNameSubmit() {
    const n = nameInput.trim();
    if (!n) return;
    setSavedName(n);
    saveUserName(n);
    setShowNameResponse(true);
    setTimeout(() => {
      setAcornStep(-1); // 도토리 이야기 처음부터 시작
      goToAct(2);
    }, 2200);
  }

  // ── Act 2: 버킷리스트 ──
  function handleBucketSubmit() {
    const items = bucketRaw.split('\n').map((s) => s.trim()).filter(Boolean);
    if (items.length === 0) {
      setBucketPhase('no-bucket');
      return;
    }
    setBucketItems(items);
    saveBucketListItems(items);
    setBucketPhase('imagine');
    setTypingDots(true);
    setTimeout(() => {
      setTypingDots(false);
      goToAct(3);
    }, 2000);
  }

  // ── Act 3: 감정 ──
  function handleFeelingSubmit() {
    const f = feelingInput.trim();
    if (!f) return;
    saveBucketListFeeling(f);
    goToAct(4);
  }

  // ── Act 4: 정원 진단 ──
  function handleGardenSelect(value: string) {
    setGardenValue(value);
    saveGardenState(value as 'empty' | 'seeds' | 'sprouting');
    setTimeout(() => goToAct(5), 400);
  }

  // ── Act 5: 완료 ──
  function handleFinish() {
    markOnboardingDone();
    router.replace('/welcome');
  }

  // ── 뒤로가기 ──
  function handleBack() {
    if (act === 1) { goToAct(0); return; }
    if (act === 2) {
      if (bucketPhase === 'no-bucket') { setBucketPhase('input'); return; }
      if (bucketPhase === 'imagine') { setBucketPhase('input'); return; }
      goToAct(1); return;
    }
    if (act === 3) { goToAct(2); return; }
    if (act === 4) { goToAct(3); return; }
    if (act === 5) { goToAct(4); return; }
  }

  function canGoBack(): boolean {
    if (act === 0) return false;
    if (act === 2 && bucketPhase === 'imagine') return false;
    return true;
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full px-6 py-8">
      {/* 챕터 진행 바 (Act 0 제외) */}
      {act > 0 && (
        <div className="mb-8 mt-1">
          <ChapterProgress chapters={CHAPTERS} currentId={actToChapterId(act)} />
        </div>
      )}

      <div className="flex-1 flex flex-col animate-fadeIn" key={act}>

        {/* ══════════ ACT 0: 인사 (비디오) ══════════ */}
        {act === 0 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="relative w-full aspect-video rounded-3xl overflow-hidden bg-[#F5F5F3]">
              <video
                ref={videoRef}
                src="/인사.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-2 text-center">
              <p className="text-sm text-[#6B7280] leading-relaxed">
                안녕, 나는 토리야.<br />
                네가 원하는 삶을 발견할 수 있도록<br />
                도와주는 정원사지.<br />
                나는 네가 원하는 삶의 이야기가 너무 궁금해.<br />
                내 얘기 들려줄래?
              </p>
            </div>

            <button
              onClick={() => goToAct(1)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
              style={{ backgroundColor: '#1C1B19' }}
            >
              다음 →
            </button>
          </div>
        )}

        {/* ══════════ ACT 1: 첫 만남 — 이름 ══════════ */}
        {act === 1 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* 토리 프로필 + 첫인사 (정원사 정체성 + 이름 질문 통합) */}
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
                    안녕, 나는 토리야.<br />
                    나는 네가 원하는 삶을 발견할 수 있도록<br />
                    도와주는 너만의 정원사야.<br />
                    만나서 반가워.<br />
                    <strong>너는 어떻게 불러줄까?</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* 이름 입력 */}
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

            {/* 이름 응답 */}
            {showNameResponse && (
              <div className="flex items-start gap-4 animate-fadeIn">
                <img
                  src="/프로필상반신.png"
                  alt="토리"
                  className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
                />
                <div className="bg-[#1C1B19] text-white rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">
                    아, {savedName}아! 만나서 정말 반가워 😊<br />
                    네 꿈을 함께 가꿀 수 있어서 기쁘다.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════ ACT 2: 도토리 이야기 + 버킷리스트 ══════════ */}
        {act === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* ── 기획서 회고: 도토리 이야기 (아직 안 봤을 때만) ── */}
            {acornStep >= 0 && acornStep < 6 && (
              <div className="space-y-3">
                {(() => {
                  const msgs = ACORN_MESSAGES;
                  const shown = acornStep;
                  // 지금까지의 메시지를 모두 보여줌
                  return Array.from({ length: shown + 1 }, (_, i) => (
                    <div key={i} className="flex items-start gap-4" style={{ animationDelay: `${i * 100}ms` }}>
                      {i === shown && (
                        <img
                          src="/프로필상반신.png"
                          alt="토리"
                          className="w-12 h-12 rounded-xl object-contain flex-shrink-0 animate-fadeIn"
                        />
                      )}
                      <div className={i === shown ? 'flex-1 space-y-2 animate-fadeIn' : 'flex-1 space-y-2'}>
                        {i === shown && <p className="text-xs text-[#9CA3AF] font-medium">토리</p>}
                        <div
                          className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3"
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-line">
                            {msgs[i](savedName)}
                          </p>
                        </div>
                      </div>
                      {/* 이전 메시지들은 말풍선만 (프로필 없이) */}
                      {i < shown && (
                        <div className="flex-1">
                          <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3 opacity-70">
                            <p className="text-sm leading-relaxed whitespace-pre-line">
                              {msgs[i](savedName)}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  ));
                })()}

                {/* 탭 투 컨티뉴 인디케이터 (마지막 메시지 제외) */}
                {acornStep < 5 && (
                  <div
                    className="text-center pt-2 pb-1 cursor-pointer select-none"
                    onClick={handleAcornTap}
                  >
                    <span className="text-xs text-[#9CA3AF] animate-pulse">
                      ▼ 계속하려면 탭
                    </span>
                  </div>
                )}

                {/* 마지막 메시지까지 보여준 후 계속 버튼 */}
                {acornStep === 5 && (
                  <div className="animate-fadeIn pt-2">
                    <button
                      onClick={() => setAcornStep(6)}
                      className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
                      style={{ backgroundColor: '#1C1B19' }}
                    >
                      그래, 나도 궁금해 →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── 버킷리스트 영역 (도토리 이야기 완료 후) ── */}
            {acornStep >= 6 && (
              <>
                {/* 토리 메시지 */}
                <div className="flex items-start gap-4">
                  <img
                    src="/프로필상반신.png"
                    alt="토리"
                    className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
                  />
                  <div className="space-y-3 flex-1">
                    <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                    <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm leading-relaxed">
                        그래서 말인데, {savedName ? `${savedName}아, ` : ''}<br />
                        우리가 원하는 인생이 어떤 모습인지<br />
                        생생하게 그리는 작업을 하게 될 거야.<br />
                        <strong>너는 혹시 버킷리스트가 있니?</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Phase: 입력 */}
                {bucketPhase === 'input' && (
                  <div className="space-y-4 ml-16">
                    <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm leading-relaxed">
                        해보고 싶은 것, 가보고 싶은 곳, 경험해보고 싶은 것.<br />
                        크든 작든, 떠오르는 대로 다 적어봐.
                      </p>
                    </div>
                    <textarea
                      value={bucketRaw}
                      onChange={(e) => setBucketRaw(e.target.value)}
                      placeholder="예: 혼자 해외여행 가기&#10;춤 배우기&#10;좋아하는 팀 우승 직관"
                      className="w-full text-sm border border-[#E5E3DF] rounded-xl px-4 py-3 outline-none bg-white focus:border-[#1C1B19] transition-colors resize-none"
                      rows={4}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setBucketPhase('no-bucket'); }}
                        className="px-4 py-3 rounded-xl text-xs text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
                      >
                        버킷리스트는 없어
                      </button>
                      <button
                        onClick={handleBucketSubmit}
                        disabled={!bucketRaw.trim()}
                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                        style={{ backgroundColor: '#1C1B19' }}
                      >
                        다 썼어 →
                      </button>
                    </div>
                  </div>
                )}

                {/* Phase: 상상 중 */}
                {bucketPhase === 'imagine' && (
                  <div className="flex-1 flex flex-col justify-center space-y-4 ml-16">
                    <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm leading-relaxed">
                        그 목록들 중에서<br />
                        하나가 이루어진 하루를 상상해봐.
                      </p>
                    </div>
                    <p className="text-xs text-[#6B7280] pl-1">
                      구체적으로. 어디서? 누구랑? 어떤 표정?
                    </p>
                    {typingDots && (
                      <div className="flex gap-1.5 items-center pl-2">
                        <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                )}

                {/* Phase: 버킷리스트 없음 fallback */}
                {bucketPhase === 'no-bucket' && (
                  <div className="flex-1 flex flex-col justify-center space-y-5 ml-16">
                    <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm leading-relaxed">
                        괜찮아, 전혀 문제 없어 😊<br />
                        지금부터 나랑 함께<br />
                        네가 진짜 원하는 삶을 발견해가면 돼.
                      </p>
                    </div>
                    <div className="bg-white border border-[#E5E3DF] rounded-2xl p-4">
                      <p className="text-sm leading-relaxed text-[#6B7280]">
                        질문 하나하나 따라서 가다 보면<br />
                        네가 몰랐던 바람도 나올 거야.
                      </p>
                    </div>
                    <button
                      onClick={() => goToAct(4)}
                      className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
                      style={{ backgroundColor: '#1C1B19' }}
                    >
                      그래, 함께 찾아보자
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════ ACT 3: 감정 연결 ══════════ */}
        {act === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* 토리 메시지 */}
            <div className="flex items-start gap-4">
              <img
                src="/프로필상반신.png"
                alt="토리"
                className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
              />
              <div className="space-y-3 flex-1">
                <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">
                    그 목록을 생각하면<br />
                    <strong>어떤 기분이 들어?</strong>
                  </p>
                </div>
              </div>
            </div>

            {!feelingInput.trim() ? (
              <div className="space-y-4 ml-16">
                <input
                  type="text"
                  value={feelingInput}
                  onChange={(e) => setFeelingInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && feelingInput.trim() && handleFeelingSubmit()}
                  placeholder="설레는? 뿌듯한? 자유로운?"
                  className="w-full text-base px-4 py-3 rounded-xl border border-[#E5E3DF] outline-none bg-white focus:border-[#1C1B19] transition-colors"
                  autoFocus
                />
                <button
                  onClick={handleFeelingSubmit}
                  disabled={!feelingInput.trim()}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  이 기분, 기억할게
                </button>
              </div>
            ) : (
              <div className="flex-1 flex flex-col justify-center space-y-6 animate-fadeIn">
                {/* 요약 카드 */}
                <div className="ml-16 space-y-3">
                  <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                    <p className="text-xs text-[#9CA3AF] mb-1">네 버킷리스트</p>
                    {bucketItems.slice(0, 3).map((item, i) => (
                      <p key={i} className="text-sm font-semibold">{item}</p>
                    ))}
                  </div>
                  <div className="bg-white border border-[#E5E3DF] rounded-2xl rounded-tl-sm px-4 py-3">
                    <p className="text-xs text-[#9CA3AF] mb-1">그 기분</p>
                    <p className="text-sm font-semibold">"{feelingInput}"</p>
                  </div>
                </div>

                <div className="bg-[#1C1B19] text-white rounded-2xl px-5 py-4 ml-16">
                  <p className="text-sm leading-relaxed">
                    바로 그 기분이야.<br />
                    그 기분을 생생하게 느끼게 해주는 게<br />
                    바로 비전보드야.
                  </p>
                </div>

                <button
                  onClick={() => goToAct(4)}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white transition-opacity active:opacity-80"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  좋아, 그려보자 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════ ACT 4: 정원 진단 ══════════ */}
        {act === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex items-start gap-4">
              <img
                src="/프로필상반신.png"
                alt="토리"
                className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
              />
              <div className="space-y-3 flex-1">
                <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                <div className="bg-[#F5F5F3] rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">
                    {savedName ? `${savedName}아, ` : ''}마지막으로 하나만 더 물어볼게.<br />
                    <strong>지금 네 삶의 정원은 어떤 상태야?</strong>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 ml-16">
              {[
                {
                  label: '아직 씨앗도 없는 텅 빈 땅이야',
                  sub: '막연하지만, 뭔가 심고 싶다는 생각은 들어',
                  value: 'empty',
                },
                {
                  label: '씨앗은 있는데 어디에 심을지 모르겠어',
                  sub: '하고 싶은 게 많아서 오히려 방향을 못 정하겠어',
                  value: 'seeds',
                },
                {
                  label: '이미 싹이 나고 있어. 더 잘 가꾸고 싶어',
                  sub: '무언가 시작했는데, 더 단단하게 키워가고 싶어',
                  value: 'sprouting',
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleGardenSelect(opt.value)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border text-sm leading-relaxed transition-all active:opacity-70"
                  style={{
                    borderColor: gardenValue === opt.value ? '#1C1B19' : '#E5E3DF',
                    backgroundColor: gardenValue === opt.value ? '#F5F5F3' : 'white',
                  }}
                >
                  <p className="font-semibold">{opt.label}</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ══════════ ACT 5: 6영역 안내 → 시작 ══════════ */}
        {act === 5 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="flex items-start gap-4">
              <img
                src="/프로필상반신.png"
                alt="토리"
                className="w-12 h-12 rounded-xl object-contain flex-shrink-0"
              />
              <div className="space-y-3 flex-1">
                <p className="text-xs text-[#9CA3AF] font-medium">토리</p>
                <div className="bg-[#1C1B19] text-white rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm leading-relaxed">
                    좋아, {savedName || '친구'}아.<br />
                    이제 진짜 시작이야.
                  </p>
                </div>
              </div>
            </div>

            <div className="ml-16 space-y-3">
              <p className="text-sm text-[#6B7280] leading-relaxed">
                비전보드는 6개의 화단으로 이루어져 있어.<br />
                하나씩 차근차근 가꾸다 보면<br />
                네 안의 참나무가 얼마나 클지 알게 될 거야.
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '나', desc: '감정·성장·정체성', color: '#8B5CF6' },
                  { label: '건강', desc: '몸·마음·루틴', color: '#10B981' },
                  { label: '관계', desc: '사랑·우정·연결', color: '#F59E0B' },
                  { label: '일', desc: '일·배움·성취', color: '#3B82F6' },
                  { label: '돈', desc: '소비·저축·가치', color: '#F97316' },
                  { label: '공간', desc: '환경·물건·분위기', color: '#06B6D4' },
                ].map((area) => (
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
              시작해보자 →
            </button>
          </div>
        )}

      </div>

      {/* 뒤로가기 (Act 0 제외) */}
      {canGoBack() && (
        <button
          onClick={handleBack}
          className="w-full text-[#C4C2BE] py-2 text-xs mt-4 flex items-center justify-center gap-1 hover:text-[#6B7280] transition-colors"
        >
          ← 이전
        </button>
      )}
    </main>
  );
}
