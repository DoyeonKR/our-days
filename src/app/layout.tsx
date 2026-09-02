import type { Metadata, Viewport } from "next";
import { BASE } from "@/lib/base";
import ViewportFit from "@/components/ViewportFit";
import ScrollLockManager from "@/components/ScrollLockManager";
import ZoomLock from "@/components/ZoomLock";
import UpdateChip from "@/components/UpdateChip";
import GlobalStatusHost from "@/components/GlobalStatusHost";
import "./globals.css";

// Next 는 metadata 의 manifest/icons 에 basePath 를 자동 접두하지 않으므로 직접 붙인다.
/* 리브랜딩 [사용자 요청 2026-08-13 "개인형 스케쥴러 같은 느낌으로"] — 겉 이름은 중립적인
   데일리 플래너. 안의 기능은 그대로다(이름만 갈았다 — 기능 제거 아님). */
const DESC = "일정·기념일·날씨·사진·일기를 한곳에 계획하고 기록하는 데일리 플래너. 설치 없이 쓰는 무료 웹앱(PWA).";

export const metadata: Metadata = {
  // OG 이미지 상대경로를 절대 URL 로 해석 (링크 공유 미리보기 크롤러용)
  metadataBase: new URL("https://doyeonkr.github.io/our-days/"),
  title: "하루 · 데일리 플래너",
  description: DESC,
  // 검색 태그 [사용자 요청 2026-08-13 "블로그 유입이 늘었어, 태그 더 넣을 수 있는게"]
  applicationName: "하루",
  keywords: ["데일리 플래너", "하루 계획", "일정 관리 앱", "기념일 디데이", "디데이 계산", "날씨 앱", "일기 앱", "사진 일기", "무료 플래너", "웹앱", "PWA", "설치 없는 앱"],
  category: "productivity",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false },
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
  /* 핀치 줌 차단 [사용자 요청 2026-09-01 "키보드 올리고 핀치아웃 인 줌 하면 UI가 다 깨져,
     막아줘 어느 브라우저에서도"]. 키보드가 올라오면 시각 뷰포트가 줄어드는데 거기서 확대까지
     하면 fixed 레이어(GNB·네온 베젤·시트)가 전부 어긋난다.
     ⚠ **메타만으로는 못 막는다.** iOS Safari 는 iOS 10 부터 user-scalable=no 를 무시한다 —
       WebKit 쪽은 ZoomLock 이 gesture 계열 이벤트·멀티터치·더블탭을 preventDefault 로 막는다.
       메타와 ZoomLock 은 짝이다 — 한쪽만 있으면 한쪽 진영에서 뚫린다.
     ⚠ 접근성 트레이드오프: 브라우저 확대를 막는 건 일반적으로 권장되지 않는다(WCAG 1.4.4).
       그래서 본문은 시스템 글꼴 + 상대 단위를 그대로 두어 OS 글꼴 크기 설정은 계속 먹는다. */
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
        {/* 하단 브라우저 툴바(삼성 인터넷 하단 주소창 등)에 GNB 가 가려지는 것 방지 —
            실제 보이는 영역을 재서 --vv-bottom 으로 흘려준다 */}
        <ViewportFit />
        {/* 앞에 오버레이가 뜨면 뒤 페이지 스크롤 잠금(스크롤 블리드 방지) */}
        {/* 구조화 데이터(JSON-LD) — 검색엔진이 '웹앱'으로 인식하고 리치 결과(무료·카테고리)를 뽑아 쓴다.
            [사용자 요청 2026-08-13 블로그 유입 대응]. 정적 문자열이라 XSS 표면 없음. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "하루",
              alternateName: "하루 · 데일리 플래너",
              url: "https://doyeonkr.github.io/our-days/",
              description: DESC,
              applicationCategory: "ProductivityApplication",
              operatingSystem: "Web, iOS, Android",
              browserRequirements: "Requires JavaScript",
              inLanguage: "ko",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
              image: "https://doyeonkr.github.io/our-days/opengraph.png",
              featureList: ["일정·기념일 D-day", "날씨 예보(서울·인천)", "사진·일기 기록", "오프라인 PWA"],
            }),
          }}
        />
        {/* 핀치/더블탭 줌 차단 — 메타(user-scalable=no)를 무시하는 iOS Safari 용 짝.
            ⚠ 만들어만 두고 **마운트를 안 해서** 그동안 아무 일도 안 했다(2026-09-01 확인). */}
        <ZoomLock />
        <ScrollLockManager />
        {/* 앰비언트 아우라 배경 — 인스타 무드(보라·핑크·앰버 글로우 + 그레인). 콘텐츠 뒤 고정층 */}
        <div className="app-bg" aria-hidden>
          <i />
          <i />
          <i />
        </div>
        {children}
        <GlobalStatusHost />
        {/* 새 버전 감지 — 포그라운드 복귀 시 version.json 비교, 다르면 '탭해서 적용' 칩 */}
        <UpdateChip />
        {/* 형광 볼드 앱 프레임 — 전 화면 공통 시그니처(맨 위, 인터랙션 비차단) */}
        <div className="app-frame" aria-hidden />
      </body>
    </html>
  );
}
