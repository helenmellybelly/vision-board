import type { Metadata, Viewport } from 'next';
import { Gowun_Batang } from 'next/font/google';
import './globals.css';

// 디스플레이 서체 — 히어로·온보딩 핵심 문장·폴라로이드 캡션 등 "일지" 정서가 필요한 곳에만 사용
const gowunBatang = Gowun_Batang({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: '비전보드',
  description: '질문에 답하다 보면, 나도 몰랐던 내가 나와.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`h-full ${gowunBatang.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#FAF9F7] text-[#1C1B19]">
        {children}
      </body>
    </html>
  );
}
