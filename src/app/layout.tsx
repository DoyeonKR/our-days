import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "우리의 하루 · 커플 D-day",
  description: "둘이 함께한 날을 세고, 다가오는 기념일을 알려주는 커플 D-day",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "우리의 하루",
  },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#ff6b9d",
  width: "device-width",
  initialScale: 1,
  // 핀치줌은 접근성상 막지 않는다. viewportFit=cover 로 노치/홈 인디케이터 영역까지 확장 → safe-area 인셋 사용.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
