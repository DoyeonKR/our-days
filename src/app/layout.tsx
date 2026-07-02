import type { Metadata, Viewport } from "next";
import { BASE } from "@/lib/base";
import "./globals.css";

// Next 는 metadata 의 manifest/icons 에 basePath 를 자동 접두하지 않으므로 직접 붙인다.
export const metadata: Metadata = {
  title: "우리의 하루 · 커플 D-day",
  description: "둘이 함께한 날을 세고, 다가오는 기념일을 알려주는 커플 D-day",
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "우리의 하루",
  },
  icons: { icon: `${BASE}/icon-192.png`, apple: `${BASE}/apple-touch-icon.png` },
};

export const viewport: Viewport = {
  // 상태바(브라우저 크롬) 색 — 앱 배경과 자연스럽게 이어지도록 라이트/다크 분기
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#150f18" },
  ],
  width: "device-width",
  initialScale: 1,
  // 핀치줌은 접근성상 막지 않는다. viewportFit=cover 로 노치/홈 인디케이터 영역까지 확장 → safe-area 인셋 사용.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        {/* 첫 데이터 쿼리 전에 DNS/TLS 미리 연결 — 모바일 첫 로딩 단축 */}
        {supabaseOrigin && (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        )}
        {children}
      </body>
    </html>
  );
}
