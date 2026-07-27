import Link from 'next/link';

// 브랜드 404 (v7.9) — Next 기본 404는 다크 스타일이라 위에 뜨는 시트(동의 등)의
// 무색 텍스트가 흰색 상속으로 묻힌다. 라이트 톤 고정 + 대시보드 복귀 동선 제공.
export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center max-w-md mx-auto w-full px-6 text-center bg-[#FAF9F7] text-[#1C1B19]">
      <p className="text-display font-bold mb-2">🌰 404</p>
      <p className="text-body text-[#6B7280] mb-6">
        여기엔 아무것도 없네. 토리랑 보드로 돌아갈까?
      </p>
      <Link
        href="/dashboard"
        className="w-full py-3.5 rounded-2xl bg-[#1C1B19] text-white font-bold"
      >
        내 보드로 가기 →
      </Link>
    </main>
  );
}
