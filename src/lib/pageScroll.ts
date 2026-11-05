/* 페이지 스크롤이 어디서 일어나나 — iOS 에선 문서가 아니라 <main class="app-scroller"> 다(globals.css).
 *
 * [사용자 영상 2026-11-05 · 2026-08-31] 사파리에서 하단 바가 스크롤을 따라 올라온다.
 * 루트 클립을 푸는 처방(2026-08-31) 뒤에도 재발해서, 문서 자체가 스크롤되지 않게 바꿨다 —
 * 문서가 움직이지 않으면 position: fixed 가 따라 움직일 수 없다.
 * window.scrollY · window.scrollTo 를 직접 쓰지 말고 이 함수들을 쓴다. */

/** iOS 처럼 안쪽 영역이 스크롤되면 그 요소, 문서가 스크롤되면 null. */
export function pageScroller(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  // 스크롤 잠금이 main 의 overflow 를 잠깐 바꾸므로 main 이 아니라 뿌리를 본다.
  if (typeof getComputedStyle === "undefined" || getComputedStyle(document.documentElement).overflowY !== "hidden") return null;
  return document.querySelector<HTMLElement>(".app-scroller");
}

export function pageScrollY(): number {
  return pageScroller()?.scrollTop ?? window.scrollY;
}

export function pageScrollTo(top: number): void {
  const el = pageScroller();
  if (el) el.scrollTo({ top, behavior: "instant" });
  else window.scrollTo({ top, behavior: "instant" });
}
