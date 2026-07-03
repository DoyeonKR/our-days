import type { Metadata, Viewport } from "next";
import { BASE } from "@/lib/base";
import ZoomLock from "@/components/ZoomLock";
import "./globals.css";

// Next 는 metadata 의 manifest/icons 에 basePath 를 자동 접두하지 않으므로 직접 붙인다.
const DESC = "둘이 함께한 날을 세고, 기념일·사진·일기를 함께하는 커플 D-day 공간";

export const metadata: Metadata = {
  // OG 이미지 상대경로를 절대 URL 로 해석 (링크 공유 미리보기 크롤러용)
  metadataBase: new URL("https://doyeonkr.github.io/our-days/"),
  title: "우리의 하루 · 커플 D-day",
  description: DESC,
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "우리의 하루",
  },
  icons: { icon: `${BASE}/icon-192.png`, apple: `${BASE}/apple-touch-icon.png` },
  // 링크 공유(카톡·SNS) 시 리치 미리보기
  openGraph: {
    title: "우리의 하루 · 커플 D-day 💗",
    description: DESC,
    type: "website",
    locale: "ko_KR",
    siteName: "우리의 하루",
    url: "/",
    images: [{ url: "icon-512.png", width: 512, height: 512, alt: "우리의 하루" }],
  },
  twitter: {
    card: "summary",
    title: "우리의 하루 · 커플 D-day 💗",
    description: DESC,
    images: ["icon-512.png"],
  },
};

export const viewport: Viewport = {
  // 상태바(브라우저 크롬) 색 — 앱 배경과 자연스럽게 이어지도록 라이트/다크 분기
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#150f18" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // viewportFit=cover 로 노치/홈 인디케이터 영역까지 확장 → safe-area 인셋 사용.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        {/* 저장된 색 테마를 페인트 전에 적용 — 색 깜빡임(FOUC) 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('ourdays:theme');if(t&&t!=='rose')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
        {/* 첫 데이터 쿼리 전에 DNS/TLS 미리 연결 — 모바일 첫 로딩 단축 */}
        {supabaseOrigin && (
          <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
        )}
        <ZoomLock />
        {children}
        {/* 형광 볼드 앱 프레임 — 전 화면 공통 시그니처(맨 위, 인터랙션 비차단) */}
        <div className="app-frame" aria-hidden />
      </body>
    </html>
  );
}
