'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingDone, saveUserName, saveOnboardingStep, saveBucketListItem, saveBucketListFeeling, saveGardenState, loadBoard } from '@/lib/storage';

type Step = 1 | 2 | 3 | 4;
type BucketPhase = 'input' | 'imagine' | 'feeling' | 'connect';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [bucketPhase, setBucketPhase] = useState<BucketPhase>('input');
  const [bucketInput, setBucketInput] = useState('');
  const [feelingInput, setFeelingInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [savedName, setSavedName] = useState('');
  const [gardenValue, setGardenValue] = useState<string | null>(null);
  const [typingDots, setTypingDots] = useState(false);

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingStep && board.onboardingStep > 1) {
      setStep(Math.min(board.onboardingStep, 4) as Step);
    }
    if (board.userName) {
      setSavedName(board.userName);
      setNameInput(board.userName);
    }
    if (board.bucketListItem) {
      setBucketInput(board.bucketListItem);
    }
  }, []);

  const name = savedName || '너';

  function goToStep(s: Step) {
    setStep(s);
    saveOnboardingStep(s);
  }

  function handleBucketSubmit() {
    const item = bucketInput.trim();
    if (!item) return;
    saveBucketListItem(item);
    setBucketPhase('imagine');
    setTypingDots(true);
    setTimeout(() => {
      setTypingDots(false);
      setBucketPhase('feeling');
    }, 1800);
  }

  function handleFeelingSubmit() {
    const f = feelingInput.trim();
    if (!f) return;
    saveBucketListFeeling(f);
    setBucketPhase('connect');
  }

  function handleNameSubmit() {
    const n = nameInput.trim();
    setSavedName(n);
    saveUserName(n);
    if (gardenValue) {
      saveGardenState(gardenValue as 'empty' | 'seeds' | 'sprouting');
    }
    goToStep(4);
  }

  function handleFinish() {
    markOnboardingDone();
    router.replace('/welcome');
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md md:max-w-xl mx-auto w-full px-6 py-10">
      {/* 진행 바 — 4단계 */}
      <div className="flex gap-1.5 mb-10">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-all duration-500"
            style={{ backgroundColor: s <= step ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col animate-fadeIn" key={step}>

        {/* STEP 1: 토리 등장 + 정원사 비유 */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center space-y-7">
            <div className="space-y-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)', boxShadow: '0 8px 24px rgba(28,27,25,0.18)' }}
              >
                <span>🐿️</span>
              </div>
              <div className="space-y-2">
              <p className="text-sm text-[#9CA3AF]">안녕, 나는 토리야.</p>
              <h1 className="text-2xl font-bold leading-snug">
                너의 꿈의 정원사.
              </h1>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[#6B7280] leading-relaxed text-sm">
                네가 꿈을 말하면, 난 그 꿈을 땅에 심을게. 네 정원사니까.
              </p>
              <div className="bg-[#F5F5F3] rounded-2xl p-4">
                <p className="text-sm leading-relaxed">
                  아직 씨앗도 없어도 괜찮아.<br />
                  너의 꿈을 찾는 것부터 함께 할게.
                </p>
              </div>
              <p className="text-[#6B7280] leading-relaxed text-sm">
                준비됐으면 시작해보자.
              </p>
            </div>
            <button
              onClick={() => goToStep(2)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              좋아, 시작해보자
            </button>
          </div>
        )}

        {/* STEP 2: 꿈꾸는 도토리 (버킷리스트 → 상상 → 감정 → 연결) */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {/* 토리 아이콘 */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)' }}
            >
              <span>🐿️</span>
            </div>

            {/* Phase: 버킷리스트 입력 */}
            {bucketPhase === 'input' && (
              <>
                <div>
                  <h2 className="text-2xl font-bold leading-snug">
                    심고 싶은 도토리<br />
                    하나만 떠올려봐.
                  </h2>
                  <p className="text-sm text-[#6B7280] mt-2 leading-relaxed">
                    언젠가 해보고 싶은 거. 크든 작든, 현실적이든 아니든.<br />
                    지금 당장 떠오르는 거면 충분해.
                  </p>
                </div>
                <input
                  type="text"
                  value={bucketInput}
                  onChange={(e) => setBucketInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && bucketInput.trim() && handleBucketSubmit()}
                  placeholder="예: 혼자 해외여행 가기"
                  className="w-full text-lg border-b-2 border-[#E5E3DF] pb-2 outline-none bg-transparent focus:border-[#1C1B19] transition-colors"
                  autoFocus
                />
                <button
                  onClick={handleBucketSubmit}
                  disabled={!bucketInput.trim()}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  이 도토리를 심어볼게
                </button>
              </>
            )}

            {/* Phase: 상상 중 (타이핑 애니메이션) */}
            {bucketPhase === 'imagine' && (
              <div className="flex-1 flex flex-col justify-center space-y-4">
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1">토리</p>
                  <h2 className="text-xl font-bold leading-snug">
                    그걸 이루고 있는<br />너의 모습을 상상해봐.
                  </h2>
                </div>
                <p className="text-[#6B7280] text-sm leading-relaxed">
                  구체적으로. 어디서? 누구랑? 어떤 표정?
                </p>
                {typingDots && (
                  <div className="flex gap-1 items-center py-2">
                    <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-[#9CA3AF] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            )}

            {/* Phase: 감정 입력 */}
            {bucketPhase === 'feeling' && (
              <>
                <div>
                  <h2 className="text-2xl font-bold">
                    어때, 기분이?
                  </h2>
                  <p className="text-sm text-[#6B7280] mt-2">
                    상상한 그 순간, 어떤 기분이 들었어?
                  </p>
                </div>
                <input
                  type="text"
                  value={feelingInput}
                  onChange={(e) => setFeelingInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && feelingInput.trim() && handleFeelingSubmit()}
                  placeholder="설레는? 뿌듯한? 자유로운?"
                  className="w-full text-lg border-b-2 border-[#E5E3DF] pb-2 outline-none bg-transparent focus:border-[#1C1B19] transition-colors"
                  autoFocus
                />
                <button
                  onClick={handleFeelingSubmit}
                  disabled={!feelingInput.trim()}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  이 기분, 기억할게
                </button>
              </>
            )}

            {/* Phase: 비전보드 연결 */}
            {bucketPhase === 'connect' && (
              <div className="flex-1 flex flex-col justify-center space-y-6">
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1">토리</p>
                  <h2 className="text-xl font-bold leading-snug">
                    바로 그 기분이야.
                  </h2>
                </div>
                <p className="text-[#6B7280] text-sm leading-relaxed">
                  지금 네가 느낀 그 생생한 기분.<br />
                  지금부터 만들 비전보드는 그걸 시각화하는 거야.
                </p>
                <div className="bg-[#F5F5F3] rounded-2xl p-4 space-y-1">
                  <p className="text-xs text-[#9CA3AF]">네가 말한 도토리</p>
                  <p className="text-sm font-semibold">"{bucketInput}"</p>
                  <p className="text-xs text-[#9CA3AF] mt-2">그 순간의 기분</p>
                  <p className="text-sm font-semibold">"{feelingInput}"</p>
                </div>
                <p className="text-[#6B7280] text-sm leading-relaxed">
                  이 감정을 6개의 영역에서 구체적인 장면으로 만들어볼 거야.<br />
                  그게 네 참나무야.
                </p>
                <button
                  onClick={() => goToStep(3)}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  좋아, 그려보자
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: 이름 + 상태 진단 */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)' }}
            >
              <span>🐿️</span>
            </div>

            {!savedName ? (
              <>
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1">아직 이름을 안 물어봤네.</p>
                  <h2 className="text-2xl font-bold">
                    뭐라고 불러줄까?
                  </h2>
                </div>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && setNameInput(nameInput.trim())}
                  placeholder="이름 또는 닉네임"
                  className="w-full text-lg border-b-2 border-[#E5E3DF] pb-2 outline-none bg-transparent focus:border-[#1C1B19] transition-colors"
                  autoFocus
                />
                <button
                  onClick={() => {
                    if (nameInput.trim()) {
                      setSavedName(nameInput.trim());
                      saveUserName(nameInput.trim());
                    }
                  }}
                  disabled={!nameInput.trim()}
                  className="w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-40"
                  style={{ backgroundColor: '#1C1B19' }}
                >
                  이 이름으로 불러줘
                </button>
              </>
            ) : (
              <>
                <div>
                  <p className="text-sm text-[#9CA3AF] mb-1">{name}아,</p>
                  <h2 className="text-2xl font-bold leading-snug">
                    지금 네 삶은<br />어떤 상태야?
                  </h2>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: '아직 씨앗도 없는 텅 빈 땅이야', value: 'empty' },
                    { label: '씨앗은 있는데 어디에 심을지 모르겠어', value: 'seeds' },
                    { label: '이미 싹이 나고 있어. 더 잘 가꾸고 싶어', value: 'sprouting' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setGardenValue(opt.value);
                        saveGardenState(opt.value as 'empty' | 'seeds' | 'sprouting');
                        goToStep(4);
                      }}
                      className="w-full text-left px-4 py-3.5 rounded-xl border border-[#E5E3DF] text-sm leading-relaxed active:opacity-70 transition-opacity"
                      style={{
                        borderColor: gardenValue === opt.value ? '#1C1B19' : '#E5E3DF',
                        backgroundColor: gardenValue === opt.value ? '#F5F5F3' : 'transparent',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 4: 진입 */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-7">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-1">토리</p>
              <h2 className="text-2xl font-bold leading-snug">
                좋아, {name}아.<br />
                같이 그려보자.
              </h2>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              나, 건강, 관계, 일, 돈, 공간 — 6가지 영역을 하나씩 채워가면<br />
              네가 진짜 원하는 게 뭔지 보이기 시작해.
            </p>
            <div className="bg-[#F5F5F3] rounded-2xl p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">토리가 이렇게 물어볼 거야</p>
              <p className="text-sm leading-relaxed">"{name}아, 지금 '나'는 어떤 상태야? 어떤 사람으로 살고 있어?"</p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              시작해보자 →
            </button>
          </div>
        )}

      </div>

      {step > 1 && bucketPhase === 'input' && (
        <button
          onClick={() => goToStep((step - 1) as Step)}
          className="w-full text-[#C4C2BE] py-2 text-xs mt-4 flex items-center justify-center gap-1"
        >
          ← 이전
        </button>
      )}
      {step > 1 && bucketPhase !== 'input' && bucketPhase !== 'imagine' && (
        <button
          onClick={() => {
            if (step === 2) {
              setBucketPhase('input');
            } else {
              goToStep((step - 1) as Step);
            }
          }}
          className="w-full text-[#C4C2BE] py-2 text-xs mt-4 flex items-center justify-center gap-1"
        >
          ← 이전
        </button>
      )}
    </main>
  );
}
