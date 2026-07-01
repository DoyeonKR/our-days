// basePath 접두사 헬퍼. GitHub Pages(/our-days) 등 하위경로 배포에서 정적 자산
// 절대경로가 깨지지 않게 한다. 로컬/루트 배포에서는 BASE 가 "" 라 그대로.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${p}`;
}
