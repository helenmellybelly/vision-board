'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingDone, saveUserName, saveOnboardingStep, loadBoard } from '@/lib/storage';

type Step = 1 | 2 | 3 | 4 | 5;

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
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-12">
      {/* 진행 바 */}
      <div className="flex gap-1.5 mb-10">
        {([1, 2, 3, 4, 5] as Step[]).map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ backgroundColor: s <= step ? '#1C1B19' : '#E5E3DF' }}
          />
        ))}
      </div>

      <div className="flex-1 flex flex-col animate-fadeIn" key={step}>

        {/* STEP 1: 인사 + lumi 소개 */}
        {step === 1 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-[#1C1B19] flex items-center justify-center">
              <span className="text-white text-2xl">✦</span>
            </div>
            <div className="space-y-3">
              <p className="text-2xl font-bold leading-snug">
                안녕, 나는 <span className="text-[#8B5CF6]">lumi</span>야.
              </p>
              <p className="text-[#1C1B19] leading-relaxed">
                너한테 원하는 게 뭔지 알려줄 수는 없어.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                근데 네가 스스로 발견할 수 있게 — 옆에서 빛을 비춰줄 순 있어.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                같이 해볼래?
              </p>
            </div>
            <button
              onClick={nextStep}
              className="mt-4 w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
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
              <p className="text-xl leading-snug">
                너를 뭐라고 부르면 좋을까?
              </p>
            </div>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (nameInput.trim() ? handleNameSubmit() : nextStep())}
              placeholder="이름이나 닉네임"
              className="w-full bg-white border border-[#E5E3DF] rounded-2xl px-4 py-4 text-base placeholder-[#C4C2BE] focus:outline-none focus:border-[#1C1B19] transition-colors"
              autoFocus
            />
            <div className="space-y-3">
              <button
                onClick={nameInput.trim() ? handleNameSubmit : nextStep}
                className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
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
                {savedName ? `${savedName}이구나, 반가워! 😊` : '반가워! 😊'}
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
              <p className="text-[#6B7280] leading-relaxed">
                <span className="font-semibold text-[#1C1B19]">뭘 원하는지도 모르겠고, 뭐부터 시작해야 할지도 모르겠고.</span>
              </p>
            </div>

            {/* 예시 보드 placeholder */}
            <div className="w-full aspect-video rounded-2xl bg-[#F3F4F6] flex items-center justify-center border border-[#E5E3DF]">
              <p className="text-xs text-[#9CA3AF]">예시 비전보드</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={nextStep}
                className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
              >
                오… 그래서 어떻게 하는 건데?
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: 상태 공감 */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div className="space-y-3">
              <p className="text-xl font-bold leading-snug">
                아마 둘 중 하나일 거야.
              </p>
              <div className="bg-[#F9F8F6] rounded-2xl p-4 space-y-1">
                <p className="text-[#6B7280] leading-relaxed">
                  😶‍🌫️ "원하는 게 있긴 한데… 잘 안 그려져."
                </p>
                <p className="text-[#9CA3AF] text-sm">아니면</p>
                <p className="text-[#6B7280] leading-relaxed">
                  ✨ "어렴풋이 보이는데, 더 생생하게 그려보고 싶어."
                </p>
              </div>
              <p className="text-[#1C1B19] font-medium">
                둘 다 괜찮아. 사실 그래서 이게 있는 거거든.
              </p>
            </div>

            <div className="space-y-2">
              {[
                { value: 'foggy' as const, label: '잘 안 그려져' },
                { value: 'vivid' as const, label: '더 생생히 그리고 싶어' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setStateChoice(opt.value); nextStep(); }}
                  className="w-full py-4 rounded-2xl text-base font-medium border transition-all active:opacity-70"
                  style={{
                    borderColor: stateChoice === opt.value ? '#1C1B19' : '#E5E3DF',
                    backgroundColor: stateChoice === opt.value ? '#1C1B19' : 'white',
                    color: stateChoice === opt.value ? 'white' : '#1C1B19',
                  }}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={nextStep}
                className="w-full text-[#9CA3AF] py-2 text-sm"
              >
                맞아, 딱 내 얘기야
              </button>
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
                내가 6개의 작은 영역으로 나눠뒀어. 한 번에 다 안 해도 돼.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                막히면 내가 옆에서 같이 찾아줄게. 속도는 네가 정해 — 저장하고 다음에 와도 되고.
              </p>
              <p className="text-[#6B7280] leading-relaxed">
                준비됐어?
              </p>
            </div>

            <button
              onClick={handleFinish}
              className="w-full bg-[#1C1B19] text-white py-4 rounded-2xl text-base font-semibold active:opacity-80 transition-opacity"
            >
              좋아, 나부터 그려볼래
            </button>
          </div>
        )}

      </div>

      {step > 1 && step < 5 && (
        <button
          onClick={() => goToStep((step - 1) as Step)}
          className="w-full text-[#9CA3AF] py-2 text-sm mt-4"
        >
          이전
        </button>
      )}
    </main>
  );
}
