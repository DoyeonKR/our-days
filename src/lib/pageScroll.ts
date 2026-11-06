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

/** 맨 위로 — 지금 탭을 한 번 더 누를 때. iOS 는 main 이 스크롤해서 상태 표시줄 누르기(맨 위로)가 안 듣는다 — 그 대신이다.
 *  움직임 줄이기면 바로 간다. */
export function pageScrollToTop(): void {
  const still = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = pageScroller();
  (el ?? window).scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
}

/** 키보드가 올라온 뒤 입력칸이 가려졌으면 main 안에서 보이게(iOS 만 — 문서가 스크롤하면 브라우저가 알아서 한다).
 *  'nearest' 라 이미 보이는 칸은 움직이지 않는다. ⚠ 진짜 아이폰에서는 아직 못 봤다. */
export function revealFocusedField(): void {
  const el = pageScroller();
  if (!el || typeof document === "undefined") return;
  const a = document.activeElement;
  if (!(a instanceof HTMLElement) || !el.contains(a) || !a.matches("input, textarea, [contenteditable='true']")) return;
  a.scrollIntoView({ block: "nearest" });
}

export function pageScrollTo(top: number): void {
  const el = pageScroller();
  if (el) el.scrollTo({ top, behavior: "instant" });
  else window.scrollTo({ top, behavior: "instant" });
}

/** 페이지 안 요소가 보이는지 지켜본다. ⚠ rootMargin 은 root 에만 걸린다 — root 를 비우면(뷰포트) iOS 에선
 *  main 이 먼저 잘라 버려 '600px 앞에서 미리 받기'가 화면에 닿아야만 돈다. 그래서 root 는 늘 pageScroller().
 *  관찰자가 없는 브라우저면 null(버튼으로 대신한다). */
export function observeInPage(
  el: Element,
  cb: (entries: IntersectionObserverEntry[]) => void,
  opts: Omit<IntersectionObserverInit, "root"> = {},
): (() => void) | null {
  if (typeof IntersectionObserver === "undefined") return null;
  const io = new IntersectionObserver(cb, { ...opts, root: pageScroller() });
  io.observe(el);
  return () => io.disconnect();
}
