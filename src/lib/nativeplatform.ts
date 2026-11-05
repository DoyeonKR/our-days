/* Capacitor 앱 안인가 — 네이티브가 페이지에 넣어 주는 값을 본다. 다른 파일을 불러오지 않는다(node --test 에서도 읽힌다). */
export function nativePlatform(): string | null {
  if (typeof window === "undefined") return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  return cap?.isNativePlatform?.() ? cap.getPlatform?.() ?? null : null;
}
