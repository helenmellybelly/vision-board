import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="ko" className="h-full">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 아트 서체(콜라주·스티커·배경화면) — canvas ctx.font와 family명을 공유해야 해서 next/font 대신 평문 @font-face */}
        <link
          rel="preload"
          as="font"
          type="font/woff"
          href="/fonts/Enjoystories.woff"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#FAF9F7] text-[#1C1B19]">
        {children}
      </body>
    </html>
  );
}
