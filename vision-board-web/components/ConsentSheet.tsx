'use client';

import { useState } from 'react';
import useFocusTrap from './useFocusTrap';

// 가입 폼 동의 (기획서 §5-1) — 필수(개인정보) + 선택(마케팅) 분리.
// 선택 미체크로 가입을 막을 수 없다(정보통신망법 분리 동의 원칙) — 버튼 활성 조건은 필수만.
export default function ConsentSheet({
  email,
  onAccept,
  onDecline,
}: {
  email: string;
  onAccept: (marketingConsent: boolean) => void;
  onDecline: () => void;
}) {
  const [privacyOk, setPrivacyOk] = useState(false);
  const [marketingOk, setMarketingOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true, onDecline);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="가입 동의"
    >
      <div ref={trapRef} className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slideUp">
        <h2 className="text-title font-bold mb-1">거의 다 됐어!</h2>
        <p className="text-body text-[#6B7280] mb-4">{email}(으)로 시작할게. 아래만 확인해줘.</p>
        <label className="flex items-start gap-2 mb-3">
          <input
            type="checkbox"
            checked={privacyOk}
            onChange={(e) => setPrivacyOk(e.target.checked)}
            className="mt-1"
          />
          <span className="text-body">
            [필수] 개인정보 수집·이용 동의 — Google 계정의 이메일·이름만 수집해.{' '}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline">
              자세히 보기
            </a>
          </span>
        </label>
        <label className="flex items-start gap-2 mb-5">
          <input
            type="checkbox"
            checked={marketingOk}
            onChange={(e) => setMarketingOk(e.target.checked)}
            className="mt-1"
          />
          <span className="text-body">
            [선택] 마인드/자기발견/자기성장/코칭 관련 정보를 받아보는 것에 동의합니다.
          </span>
        </label>
        <button
          disabled={!privacyOk || busy}
          onClick={() => {
            setBusy(true);
            onAccept(marketingOk);
          }}
          className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold disabled:opacity-40"
        >
          시작하기
        </button>
        <button onClick={onDecline} className="w-full py-3 text-body text-[#6B7280]">
          다음에 할게 (게스트로 계속)
        </button>
      </div>
    </div>
  );
}
