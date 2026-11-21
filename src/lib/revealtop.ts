// 요소를 스크롤 창 맨 위로(2026-11-21) [사용자: "아이폰에서 하단에 물고기 목록을 선택하면 그 물고기에대한 포커스가 되면서 올라가져야 하는데 그렇지 못해"]
// 게임 창(수조 · 낚시)은 화면에 고정된 창 안에서 따로 스크롤한다. 아이폰 사파리는 그런 창 안의 element.scrollIntoView 를
// (특히 smooth 로) 무시하거나 문서를 움직이려 해서, 목록에서 물고기를 골라도 수조로 안 올라갔다. 고르는 순간 위에 물고기 카드가 새로 생겨 자리도 밀린다.
// 그래서 다음 두 프레임 뒤(새 카드가 자리를 잡은 뒤) 가장 가까운 스크롤 조상을 직접 찾아 scrollTop 을 맞춘다. 붙어 있는 머리글(sticky) 높이만큼 덜 올린다.

/** 세로로 스크롤되는 가장 가까운 조상 — 없으면 null(문서) */
export function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight + 1) return p;
  }
  return null;
}

/** 스크롤 창 안의 붙박이 머리글(sticky · fixed) 높이 — 그만큼 아래에 멈춘다 */
function stickyTop(box: HTMLElement): number {
  let h = 0;
  // 게임 머리글(.game-head)은 창의 바로 아래가 아니라 한 겹 안에 있다 — 그것도 본다
  const heads = [...(Array.from(box.children) as HTMLElement[]), ...(Array.from(box.querySelectorAll(".game-head")) as HTMLElement[])];
  for (const c of heads) {
    const pos = getComputedStyle(c).position;
    if (pos === "sticky" || pos === "fixed") h = Math.max(h, c.getBoundingClientRect().bottom - box.getBoundingClientRect().top);
  }
  return Math.max(0, h);
}

/** el 을 스크롤 창 맨 위(머리글 아래 gap)로. 움직임 줄이기면 바로 */
export function revealTop(el: HTMLElement | null, gap = 8): void {
  if (!el || typeof window === "undefined") return;
  const run = () => {
    const box = scrollParent(el);
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!box) {
      el.scrollIntoView({ block: "start", behavior: smooth ? "smooth" : "auto" });
      return;
    }
    const top = box.scrollTop + el.getBoundingClientRect().top - box.getBoundingClientRect().top - stickyTop(box) - gap;
    // 바로 옮긴다 — 고정 창 안의 부드러운 스크롤(scrollTo smooth)은 아이폰 · 숨은 탭에서 아예 안 움직였다(2026-11-21 실측: scrollTop 직접은 된다)
    box.scrollTop = Math.max(0, top);
  };
  // 두 프레임 뒤 또는 0.1초 뒤 중 먼저 — 숨은 탭 · 저전력에선 프레임이 멈춰 rAF 만 믿으면 안 올라간다
  let done = false;
  const once = () => { if (!done) { done = true; run(); } };
  requestAnimationFrame(() => requestAnimationFrame(once));
  window.setTimeout(once, 100);
}
