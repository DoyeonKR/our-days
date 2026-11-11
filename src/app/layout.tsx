import type { Metadata, Viewport } from "next";
import { BASE } from "@/lib/base";
import { heroPreloadScript } from "@/lib/homeworldart";
import ViewportFit from "@/components/ViewportFit";
import ScrollLockManager from "@/components/ScrollLockManager";
import ZoomLock from "@/components/ZoomLock";
import UpdateChip from "@/components/UpdateChip";
import GlobalStatusHost from "@/components/GlobalStatusHost";
import VisitPing from "@/components/VisitPing";
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
  /* 확대 허용(2026-11-05, README §10.13) — 예전엔 maximumScale:1 + userScalable:false 로 앱 전체 확대를 막았다
     [사용자 요청 2026-09-01 "키보드 올리고 핀치아웃 인 줌 하면 UI가 다 깨져"]. 그 근거였던 'OS 글꼴 크기는 먹는다'가
     지금은 아니다(본문 Galmuri14 15px 고정). 막는 건 ZoomLock 이 글쓰기 중 · 게임 창에서만 한다.
     iOS 입력칸 자동 확대는 아래 IOS_NO_FOCUS_ZOOM 이 iOS 에만 maximum-scale=1 을 붙여 막는다(iOS 는 핀치엔 그 값을 안 쓴다). */
  // viewportFit=cover 로 노치/홈 인디케이터 영역까지 확장 → safe-area 인셋 사용.
  viewportFit: "cover",
};

/** iOS 에서만 maximum-scale=1 — 15px 이하 입력칸에 초점이 가면 iOS 가 화면을 키워 fixed 층이 어긋난다.
 *  안드로이드 크롬은 그 값이 핀치까지 막으므로 붙이지 않는다. -webkit-touch-callout 은 iOS WebKit 에만 있다(iosfixed 와 같은 표식). */
const IOS_NO_FOCUS_ZOOM = `try{if(CSS.supports('-webkit-touch-callout','none')){var m=document.querySelector('meta[name=viewport]');if(m&&m.content.indexOf('maximum-scale')<0)m.content+=', maximum-scale=1';}}catch(e){}`;

/* 서체(2026-11-05) — @font-face 를 globals.css 의 상대 경로로 두면 번들러가 _next/static/media 에 해시 사본을 하나 더 만들고
   (public/fonts 와 두 벌 배포), 해시 이름을 몰라 preload 도 못 했다. public 사본 하나를 basePath 를 붙여 직접 가리키고
   본문 서체만 미리 받는다. font-display:swap — 예전 block 은 서체가 늦으면 글자가 아예 안 보였다(565KB). */
const FONT_URL = (f: string) => `${BASE}/fonts/${f}`;
const FONT_CSS = [
  `@font-face{font-family:"Galmuri11";src:url("${FONT_URL("Galmuri11.woff2")}") format("woff2");font-weight:100 500;font-style:normal;font-display:swap}`,
  `@font-face{font-family:"Galmuri11";src:url("${FONT_URL("Galmuri11-Bold.woff2")}") format("woff2");font-weight:501 900;font-style:normal;font-display:swap}`,
  `@font-face{font-family:"Galmuri14";src:url("${FONT_URL("Galmuri14.woff2")}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}`,
].join("");

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // 서체는 미리 받지 않는다(2026-11-06) — 본문이 시스템 서체가 된 뒤(2026-11-05 현대화) Galmuri 를 쓰는 화면이 없는데
  // preload 가 첫 방문마다 565KB 를 받았다. @font-face 는 남겨 둔다: 쓰는 글자가 생기면 그때 swap 으로 받는다.
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <style dangerouslySetInnerHTML={{ __html: FONT_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: IOS_NO_FOCUS_ZOOM }} />
        {/* 저장된 색 테마를 페인트 전에 적용 — 색 깜빡임(FOUC) 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('ourdays:theme');if(t&&t!=='rose')document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
        {/* 홈 히어로 계절 그림을 HTML 을 읽는 순간 미리 받는다(2026-11-11) — 예전엔 JS · 로그인 확인 뒤 HomeWorld 가 그려질 때에야
            요청이 나갔다. 로그인 기록이 있고 홈 주소일 때만. 주소 · srcset 은 HomeWorld 의 <img> 와 같은 값(lib/homeworldart) */}
        <script dangerouslySetInnerHTML={{ __html: heroPreloadScript(BASE, !!supabaseOrigin) }} />
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
        {/* 글쓰기 중 · 게임 창에서만 핀치/더블탭 확대를 막는다(그 밖에선 브라우저 기본대로 확대된다) */}
        <ZoomLock />
        <ScrollLockManager />
        {children}
        <GlobalStatusHost />
        <VisitPing />
        {/* 새 버전 감지 — 포그라운드 복귀 시 version.json 비교, 다르면 '탭해서 적용' 칩 */}
        <UpdateChip />
        {/* 형광 볼드 앱 프레임 — 전 화면 공통 시그니처(맨 위, 인터랙션 비차단) */}
        <div className="app-frame" aria-hidden />
      </body>
    </html>
  );
}
