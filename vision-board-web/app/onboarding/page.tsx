'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markOnboardingDone, saveUserName, saveOnboardingStep, loadBoard } from '@/lib/storage';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const SECTION_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#F97316', '#06B6D4'];
const SECTION_NAMES = ['나', '건강', '관계', '일', '돈', '공간'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [nameInput, setNameInput] = useState('');
  const [savedName, setSavedName] = useState('');

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

  function handleNameSubmit() {
    const n = nameInput.trim();
    setSavedName(n);
    saveUserName(n);
    goToStep(3);
  }

  function handleFinish() {
    markOnboardingDone();
    router.replace('/welcome');
  }

  const totalSteps = 7;

  return (
    <main className="min-h-screen flex flex-col max-w-md mx-auto w-full px-6 py-10">
      {/* 진행 바 */}
      <div className="flex gap-1.5 mb-10">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
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
            <div className="space-y-3">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #2D2B29 0%, #1C1B19 100%)', boxShadow: '0 8px 24px rgba(28,27,25,0.18)' }}
              >
                <span className="text-white text-2xl">✦</span>
              </div>
              <div>
                <p className="text-sm text-[#9CA3AF] mb-1">나는 lumi야.</p>
                <h1 className="text-2xl font-bold leading-snug">
                  원하는 삶을<br />같이 그려보자.
                </h1>
              </div>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              막연하게 느끼는 것들도 이야기하다 보면 선명해져. 오늘 그 시작을 해보자.
            </p>
            <button
              onClick={() => goToStep(2)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              좋아, 시작해보자
            </button>
          </div>
        )}

        {/* STEP 2: 이름 */}
        {step === 2 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">먼저,</p>
              <h2 className="text-2xl font-bold">뭐라고 불러줄까?</h2>
            </div>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && nameInput.trim() && handleNameSubmit()}
              placeholder="이름 또는 닉네임"
              className="w-full text-lg border-b-2 border-[#E5E3DF] pb-2 outline-none bg-transparent focus:border-[#1C1B19] transition-colors"
              autoFocus
            />
            <button
              onClick={handleNameSubmit}
              disabled={!nameInput.trim()}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white disabled:opacity-40"
              style={{ backgroundColor: '#1C1B19' }}
            >
              이걸로 할게
            </button>
          </div>
        )}

        {/* STEP 3: 비전보드 소개 */}
        {step === 3 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">{name}아,</p>
              <h2 className="text-2xl font-bold leading-snug">
                비전보드가 뭔지<br />알아?
              </h2>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              원하는 삶을 이미지와 글로 구체적으로 그려놓은 것. 막연하게 "잘 살고 싶다"는 마음이 또렷한 방향이 되는 거야.
            </p>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              나, 건강, 관계, 일, 돈, 공간 — 6가지 영역을 lumi랑 같이 채우다 보면 네가 진짜 원하는 게 뭔지 보이기 시작해.
            </p>
            <button
              onClick={() => goToStep(4)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              계속
            </button>
          </div>
        )}

        {/* STEP 4: 효과성 체감 — 막연 vs 생생 */}
        {step === 4 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">이게 왜 다른지 보여줄게.</p>
              <h2 className="text-2xl font-bold leading-snug">막연함과 선명함의 차이</h2>
            </div>
            <div className="space-y-3">
              <div className="bg-[#F5F5F3] rounded-2xl p-4">
                <p className="text-xs text-[#9CA3AF] mb-1.5">막연한 바람</p>
                <p className="text-sm text-[#6B7280]">"언젠가 건강하게 살고 싶다."</p>
              </div>
              <div className="bg-white border border-[#1C1B19]/10 rounded-2xl p-4">
                <p className="text-xs text-[#1C1B19] font-semibold mb-1.5">생생한 장면</p>
                <p className="text-sm leading-relaxed">
                  "새벽 6시에 러닝 끝내고 샤워 후 커피 한 잔. 몸이 가볍고 하루가 내 것인 느낌."
                </p>
              </div>
            </div>
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              두 번째처럼 또렷해지면, 뇌는 그쪽으로 자연히 움직이기 시작해. 그게 비전보드의 힘이야.
            </p>
            <button
              onClick={() => goToStep(5)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              오, 그렇구나
            </button>
          </div>
        )}

        {/* STEP 5: 완성 비전보드 미리보기 */}
        {step === 5 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">다 하면 이게 {name}의 것이 돼.</p>
              <h2 className="text-2xl font-bold leading-snug">완성된 비전보드</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SECTION_COLORS.map((color, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
                  style={{ backgroundColor: color + '20', border: `1px solid ${color}30` }}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold" style={{ color }}>{SECTION_NAMES[i]}</span>
                </div>
              ))}
            </div>
            <div className="bg-[#F5F5F3] rounded-xl p-3 text-center">
              <p className="text-xs text-[#6B7280]">섹션별 이미지 보드 + 통합 1장 + <span className="font-semibold">미래의 하루 이야기(글)</span></p>
            </div>
            <button
              onClick={() => goToStep(6)}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              나도 만들고 싶어
            </button>
          </div>
        )}

        {/* STEP 6: 상태 공감 */}
        {step === 6 && (
          <div className="flex-1 flex flex-col justify-center space-y-6">
            <div>
              <h2 className="text-2xl font-bold leading-snug">
                {name}아, 요즘<br />어때?
              </h2>
            </div>
            <div className="space-y-2.5">
              {[
                { label: '솔직히 막연해. 뭘 원하는지 모르겠어.', value: 'foggy' },
                { label: '원하는 건 있는데 어떻게 해야 할지 모르겠어.', value: 'know' },
                { label: '방향은 있어. 좀 더 선명하게 만들고 싶어.', value: 'vivid' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => goToStep(7)}
                  className="w-full text-left px-4 py-3.5 rounded-xl border border-[#E5E3DF] text-sm leading-relaxed active:opacity-70 transition-opacity"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 7: 가벼운 첫 질문 + 초대 */}
        {step === 7 && (
          <div className="flex-1 flex flex-col justify-center space-y-7">
            <div>
              <p className="text-sm text-[#9CA3AF] mb-2">좋아.</p>
              <h2 className="text-2xl font-bold leading-snug">
                그럼 같이<br />그려보자.
              </h2>
            </div>
            <p className="text-[#6B7280] leading-relaxed text-sm">
              6가지 영역을 lumi랑 대화하면서 채워. 칸 채우기가 아니라 진짜 대화야. 어디서부터 해도 괜찮고, 언제든 이어서 해도 돼.
            </p>
            <div className="bg-[#F5F5F3] rounded-2xl p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">lumi가 이런 식으로 물어볼 거야</p>
              <p className="text-sm leading-relaxed">"{name}아, 지금 '나' 영역에서 어떤 상태야? 요즘 어떻게 지내고 있어?"</p>
            </div>
            <button
              onClick={handleFinish}
              className="w-full py-4 rounded-2xl text-base font-semibold text-white"
              style={{ backgroundColor: '#1C1B19' }}
            >
              시작할게 →
            </button>
          </div>
        )}

      </div>

      {step > 1 && (
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
