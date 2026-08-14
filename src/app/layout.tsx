import type { Metadata, Viewport } from "next";
import { BASE } from "@/lib/base";
import ZoomLock from "@/components/ZoomLock";
import ViewportFit from "@/components/ViewportFit";
import ScrollLockManager from "@/components/ScrollLockManager";
import UpdateChip from "@/components/UpdateChip";
import "./globals.css";

// Next 는 metadata 의 manifest/icons 에 basePath 를 자동 접두하지 않으므로 직접 붙인다.
/* 리브랜딩 [사용자 요청 2026-08-13 "개인형 스케쥴러 같은 느낌으로"] — 겉 이름은 중립적인
   데일리 플래너. 안의 기능은 그대로다(이름만 갈았다 — 기능 제거 아님). */
const DESC = "하루를 계획하고 기록하는 데일리 플래너";

export const metadata: Metadata = {
  // OG 이미지 상대경로를 절대 URL 로 해석 (링크 공유 미리보기 크롤러용)
  metadataBase: new URL("https://doyeonkr.github.io/our-days/"),
  title: "하루 · 데일리 플래너",
  description: DESC,
  manifest: `${BASE}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "하루",
  },
  icons: { icon: `${BASE}/icon-192.png`, apple: `${BASE}/apple-touch-icon.png` },
  // 링크 공유(카톡·SNS) 시 리치 미리보기
  openGraph: {
    title: "하루 · 데일리 플래너",
    description: DESC,
    type: "website",
    locale: "ko_KR",
    siteName: "하루",
    url: "/",
    images: [{ url: "opengraph.png", width: 1200, height: 630, alt: "하루" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "하루 · 데일리 플래너",
    description: DESC,
    images: ["opengraph.png"],
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
        {/* 하단 브라우저 툴바(삼성 인터넷 하단 주소창 등)에 GNB 가 가려지는 것 방지 —
            실제 보이는 영역을 재서 --vv-bottom 으로 흘려준다 */}
        <ViewportFit />
        {/* 앞에 오버레이가 뜨면 뒤 페이지 스크롤 잠금(스크롤 블리드 방지) */}
        <ScrollLockManager />
        {/* 앰비언트 아우라 배경 — 인스타 무드(보라·핑크·앰버 글로우 + 그레인). 콘텐츠 뒤 고정층 */}
        <div className="app-bg" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        {children}
        {/* 새 버전 감지 — 포그라운드 복귀 시 version.json 비교, 다르면 '탭해서 적용' 칩 */}
        <UpdateChip />
        {/* 형광 볼드 앱 프레임 — 전 화면 공통 시그니처(맨 위, 인터랙션 비차단) */}
        <div className="app-frame" aria-hidden />
      </body>
    </html>
  );
}
