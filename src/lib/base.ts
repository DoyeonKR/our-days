// basePath 접두사 헬퍼. GitHub Pages(/our-days) 등 하위경로 배포에서 정적 자산
// 절대경로가 깨지지 않게 한다. 로컬/루트 배포에서는 BASE 가 "" 라 그대로.
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${BASE}${p}`;
}

/** JSON.parse 안전 래퍼 — null/빈 값이나 깨진 JSON 이면 fallback 반환.
 *  localStorage 읽기 등 곳곳의 try/catch JSON.parse 중복을 한곳으로. */
export function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (raw == null || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 코드포인트 단위 안전 절단 — 이모지/한글 서로게이트 페어를 쪼개지 않는다.
 *  (str.slice 는 UTF-16 단위라 이모지 경계에서 '깨진 문자'가 됨: 푸시 알림 등). */
export function safeSlice(s: string, maxChars: number): string {
  return [...s].slice(0, maxChars).join("");
}
