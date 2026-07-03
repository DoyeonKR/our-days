// 순수 플랫폼 감지 (navigator/window 만 참조 — 다른 모듈 import 없음).
// push.ts 에서 분리해 CI(node --test, @/ 별칭 미해석)에서도 유닛 테스트 가능하게 함.

/** iOS(아이폰/아이패드) 여부 — 홈화면 설치가 필요한 대상 판별용. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 는 Mac 으로 위장 + 터치
    (navigator.platform === "MacIntel" && (navigator as { maxTouchPoints?: number }).maxTouchPoints
      ? (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1
      : false)
  );
}

/** 홈 화면 설치(standalone) 모드로 실행 중인지. iOS 는 이 상태에서만 푸시 가능. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
