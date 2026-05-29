'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingDone, saveUserName, saveOnboardingStep, loadBoard } from '@/lib/storage';

type Step = 1 | 2 | 3 | 4 | 5;

const SECTION_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#F97316', '#06B6D4'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [nameInput, setNameInput] = useState('');
  const [savedName, setSavedName] = useState('');
  const [stateChoice, setStateChoice] = useState<'foggy' | 'vivid' | null>(null);

  useEffect(() => {
    const board = loadBoard();
    if (board.onboardingStep && board.onboardingStep > 1) {
      setStep(board.onboardingStep as Step);
    }
    if (board.userName) {
      setSavedName(board.userName);
      setNameInput(board.userName);
    }
  }, []);

  const name = savedName || '너';

  function goToStep(s: Step) {
    setStep(s);
    saveOnboardingStep(s);
  }

  function nextStep() {
    goToStep((step + 1) as Step);
  }

  function handleNameSubmit() {
    const n = nameInput.trim();
    setSavedName(n);
    saveUserName(n);
    nextStep();
  }

  function handleFinish() {
    markOnboardingDone();
    router.replace('/dashboard');
  }

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10">
      {/* 진행 바 */}
      <div className="flex gap-1.5 mb-10">
        {([1, 2, 3, 4, 5] as Step[]).map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-all duration-500"
            style={{ backgroundColor: s <= step ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col animate-fadeIn" key={step}>

        {/* STEP 1: 인사 + lumi 소개 */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center space-y-7">
            {/* lumi 아이콘 */}
            <div className="space-y-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)',
                  boxShadow: '0 8px 24px rgba(28,27,25,0.18), 0 2px 8px rgba(28,27,25,0.08)',
                }}
              >
                <span className="text-white text-2xl">✦</span>
              </div>
              <p className="text-xs font-semibold text-[#9CA3AF] tracking-widest">LUMI</p>
            </div>

            {/* 대화 */}
            <div className="space-y-3">
              <p className="text-2xl font-bold leading-snug">
                안녕, 나는 <span className="text-[#8B5CF6]">lumi</span>야.
              </p>
              <p className="text-[#1C1B19] leading-relaxed">
                너한테 원하는 게 뭔지 알려줄 수는 없어.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                근데, 스스로 발견할 수 있게 빛을 비춰줄 수 있어.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                네가 원하는 삶으로 나아갈 수 있도록 — 같이 해볼래?
              </p>
            </div>

            <button
              onClick={nextStep}
              className="mt-2 w-full text-white py-4 rounded-2xl text-base font-semibold transition-opacity active:opacity-80"
              style={{
                background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)',
                boxShadow: '0 4px 16px rgba(28,27,25,0.16)',
              }}
            >
              좋아, 해보자
            </button>
          </div>
        )}

        {/* STEP 2: 이름 묻기 */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-2xl font-bold leading-snug">
                시작하기 전에 —
              </p>
              <p className="text-xl leading-snug text-[#1C1B19]">
                너를 뭐라고 부르면 좋을까?
              </p>
              <p className="text-sm text-[#9CA3AF]">
                이름이나 닉네임, 뭐든 괜찮아.
              </p>
            </div>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (nameInput.trim() ? handleNameSubmit() : nextStep())}
              placeholder="이름이나 닉네임"
              className="w-full bg-white border border-[#E5E3DF] rounded-2xl px-4 py-4 text-base placeholder-[#C4C2BE] focus:outline-none focus:border-[#1C1B19] transition-colors"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
              autoFocus
            />
            <div className="space-y-2.5">
              <button
                onClick={nameInput.trim() ? handleNameSubmit : nextStep}
                className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
                style={{ boxShadow: '0 4px 16px rgba(28,27,25,0.12)' }}
              >
                응, 이렇게 불러줘
              </button>
              <button
                onClick={nextStep}
                className="w-full text-[#9CA3AF] py-2 text-sm"
              >
                그냥 시작할래
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: 이름 받아주기 + 비전보드 소개 */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-5">
            <div className="space-y-3">
              <p className="text-2xl font-bold">
                {savedName ? `${savedName}, 반가워!` : '반가워!'}
              </p>
              <p className="text-[#1C1B19] leading-relaxed">
                혹시 <span className="font-semibold">'비전보드'</span>라고 들어봤어?
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                원하는 삶의 모습을 이미지로 모아두고, 매일 보면서 그쪽으로 살아가는 거야.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                좋은 건 아는데… 막상 혼자 하려면 막막하지.
              </p>
              <p className="font-semibold text-[#1C1B19] leading-relaxed">
                뭘 원하는지도 모르겠고, 뭐부터 시작해야 할지도 모르겠고.
              </p>
            </div>

            {/* 예시 보드 placeholder */}
            <div
              className="w-full aspect-video rounded-2xl flex items-center justify-center border border-[#E5E3DF]"
              style={{ background: 'linear-gradient(135deg, #F9F8F6 0%, #F3F1EE 100%)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {SECTION_COLORS.map((c, i) => (
                    <div
                      key={i}
                      className="w-10 h-8 rounded-lg opacity-60"
                      style={{ backgroundColor: c + '30', border: `1px solid ${c}40` }}
                    />
                  ))}
                </div>
                <p className="text-[10px] text-[#C4C2BE]">예시 비전보드</p>
              </div>
            </div>

            <button
              onClick={nextStep}
              className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
              style={{ boxShadow: '0 4px 16px rgba(28,27,25,0.12)' }}
            >
              오… 그래서 어떻게 하는 건데?
            </button>
          </div>
        )}

        {/* STEP 4: 상태 공감 */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xl font-bold leading-snug">
                아마 둘 중 하나일 거야.
              </p>
              <div
                className="rounded-2xl p-4 space-y-2"
                style={{ background: 'linear-gradient(135deg, #F9F8F6 0%, #F5F3F0 100%)', border: '1px solid #EEECE8' }}
              >
                <p className="text-[#6B7280] leading-relaxed text-sm">
                  "원하는 게 있긴 한데… 잘 안 그려져."
                </p>
                <p className="text-[#C4C2BE] text-xs font-medium">또는</p>
                <p className="text-[#6B7280] leading-relaxed text-sm">
                  "어렴풋이 보이는데, 더 생생하게 그려보고 싶어."
                </p>
              </div>
              <p className="text-[#1C1B19] font-medium text-sm">
                둘 다 괜찮아. 사실 그래서 이게 있는 거거든.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                { value: 'foggy' as const, label: '잘 안 그려져', sub: '원하는 게 흐릿해' },
                { value: 'vivid' as const, label: '더 생생히 그리고 싶어', sub: '어렴풋이는 보여' },
              ].map((opt) => {
                const selected = stateChoice === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setStateChoice(opt.value); nextStep(); }}
                    className="w-full py-4 px-5 rounded-2xl text-base font-medium border-2 transition-all active:opacity-70 flex items-center justify-between"
                    style={{
                      borderColor: selected ? '#1C1B19' : '#E5E3DF',
                      backgroundColor: selected ? '#1C1B19' : 'white',
                      color: selected ? 'white' : '#1C1B19',
                      boxShadow: selected ? '0 4px 16px rgba(28,27,25,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div className="text-left">
                      <p>{opt.label}</p>
                      <p className="text-xs mt-0.5 opacity-60 font-normal">{opt.sub}</p>
                    </div>
                    {selected && <span className="text-base ml-2">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 5: 초대 + 안심 */}
        {step === 5 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-2xl font-bold leading-snug">
                {savedName ? `그렇다면 잘 왔어, ${savedName}.` : '그렇다면 잘 왔어.'}
              </p>
              <p className="text-[#1C1B19] leading-relaxed">
                나, 건강, 관계, 일, 돈, 공간.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                원하는 게 흐릿할수록, 이 6가지를 들여다보면 선명해져.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                하나씩 답하다 보면, 몰랐던 것들이 보이기 시작해.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                막히면 같이 찾아줄게. 속도는 네가 정해.
              </p>
            </div>

            {/* 6섹션 컬러 도트 */}
            <div className="flex gap-2">
              {SECTION_COLORS.map((c, i) => (
                <div
                  key={i}
                  className="flex-1 h-1.5 rounded-full"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <button
              onClick={handleFinish}
              className="w-full text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
              style={{
                background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)',
                boxShadow: '0 4px 16px rgba(28,27,25,0.16)',
              }}
            >
              좋아, 나부터 그려볼래
            </button>
          </div>
        )}

      </div>

      {step > 1 && step < 5 && (
        <button
          onClick={() => goToStep((step - 1) as Step)}
          className="w-full text-[#C4C2BE] py-2 text-xs mt-4 flex items-center justify-center gap-1"
        >
          ← 이전
        </button>
      )}
    </main>
  );
}
