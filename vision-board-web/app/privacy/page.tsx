export const metadata = { title: '개인정보처리방침 — 비전보드' };

// 기획서 §7 — 가입 도입 시점 필수. 수집 최소화·삭제권·분석 본문 미포함 원칙을 그대로 문서화.
export default function PrivacyPage() {
  return (
    <main className="max-w-md md:max-w-xl mx-auto w-full px-6 py-10">
      <h1 className="text-display font-bold mb-6">개인정보처리방침</h1>
      <div className="space-y-5 text-body text-[#374151]">
        <section>
          <h2 className="text-title font-bold mb-1">수집하는 정보</h2>
          <p>
            Google 로그인 시 Google 계정 식별자·이메일·이름만 수집합니다. 그 외 정보는 수집하지
            않습니다. 로그인하지 않으면 어떤 개인정보도 서버에 저장되지 않습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">보드 데이터</h2>
          <p>
            작성한 보드(답변·이야기·사진)는 기본적으로 이 기기 브라우저에만 저장됩니다. Google로
            로그인한 경우에만 보관·기기 간 이어하기를 위해 서버에 저장됩니다. 보드 내용은 분석
            도구로 전송하지 않습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">마케팅 정보 수신 (선택)</h2>
          <p>
            선택 동의 시 마인드/자기발견/자기성장/코칭 관련 정보를 보내드릴 수 있습니다. 동의하지
            않아도 모든 기능을 쓸 수 있고, 계정 시트에서 언제든 철회할 수 있습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">보관과 삭제</h2>
          <p>
            계정 정보와 서버의 보드는 계정 삭제 시 즉시 삭제됩니다. 계정 삭제는 대시보드의 계정
            시트에서 직접 할 수 있습니다.
          </p>
        </section>
        <section>
          <h2 className="text-title font-bold mb-1">문의</h2>
          <p>helen.easytask@gmail.com</p>
        </section>
        <p className="text-caption text-[#9CA3AF]">시행일: 2026-07-24</p>
      </div>
    </main>
  );
}
