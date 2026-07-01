import type { NextConfig } from "next";

// GitHub Pages 프로젝트 사이트는 /<repo>/ 하위경로로 서빙되므로 basePath 가 필요.
// 로컬/기타 호스트에서는 NEXT_PUBLIC_BASE_PATH 를 비워 루트(/)로 동작.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // 정적 export → 어떤 정적 호스트(GitHub Pages 등)에도 배포 가능
  basePath: basePath || undefined,
  trailingSlash: true, // /our-days/ 처럼 디렉터리 index.html 로 서빙 (Pages 호환)
  images: { unoptimized: true },
};

export default nextConfig;
