"use client";

/* 브라우저 확대를 **필요할 때만** 막는다(2026-11-05 앱 공통 리뷰 — README §10.13).
 *
 * 2026-09-01 [사용자: "키보드 올리고 핀치아웃 인 줌 하면 UI가 다 깨져, 막아줘 어느 브라우저에서도"] 에 앱 전체 확대를 막았다.
 * 그때의 근거는 '본문은 시스템 글꼴 + 상대 단위라 OS 글꼴 크기 설정이 먹는다'였는데, 지금 본문은 Galmuri14 15px 고정이라
 * 글씨를 키울 길이 확대뿐이다(WCAG 1.4.4). 그래서 막는 범위를 원래 문제가 난 자리로 좁힌다:
 *   · 글을 쓰는 중(키보드가 올라온 상태) — 원래 신고된 깨짐(시각 뷰포트가 줄어든 채 확대하면 fixed 층이 어긋난다)
 *   · 게임 창이 열린 동안 — 손가락 두 개 조작 · 연타가 확대로 새면 판이 망가진다
 * 그 밖에서는 핀치 · 더블탭 · 키보드 확대가 브라우저 기본대로 된다.
 * iOS 의 입력칸 자동 확대는 layout 의 인라인 스크립트(maximum-scale=1, iOS 만)가 막는다 — iOS 는 그 값을 핀치에는 안 쓴다.
 *
 * ⚠ 아이폰은 늘 막는다(2026-11-26 [사용자: "아이폰 사파리 홈화면에 추가 후 사용할때 가끔씩 줌이 가능한 경우가 있어 그렇게 되면 모든 화면이 깨지게 돼"]).
 *   iOS 는 문서가 아니라 main(.app-scroller)이 스크롤하고(README §10.18) 하단 바 · 시트 · 게임 창이 fixed 라, 한 번 확대되면 시각 뷰포트만 커져
 *   fixed 층이 화면 밖으로 밀린다. 홈 화면 앱엔 주소창 · 되돌리기 버튼이 없어 되돌릴 길도 없었다. iOS 는 user-scalable=no · maximum-scale 을
 *   핀치에 안 지키므로(iOS 10+) gesture 이벤트를 막고, 그래도 확대되면(가장자리 핀치 · 손쉬운 사용 확대 전환 등) 뷰포트 메타를 다시 써서 1배로 되돌린다.
 *   글씨 크기는 iOS 설정의 '텍스트 크기'가 아니라 앱 화면에서 바꾸지 않으므로 대신 OS 의 손쉬운 사용 확대(세 손가락)는 그대로 쓸 수 있다. */
import { useEffect } from "react";

const zoomKeys = new Set(["+", "=", "-", "_", "0"]);
/** GameWindowGuard 의 SHELL 과 같은 창 + 낚시 피버(body 에 따로 그린다) */
export const GAME_SHELLS = ".aqua-shell, .merge-shell, .island-shell, .fish-fever";

function isInteractiveTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest("button, a, input, textarea, select, [role='button']"))
  );
}

function editing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

/** iOS WebKit(아이폰 사파리 · 홈 화면 앱 · 다른 아이폰 브라우저) — layout 의 스크립트 · iosfixed 와 같은 표식 */
export function isIOSWebKit(): boolean {
  try { return typeof CSS !== "undefined" && CSS.supports("-webkit-touch-callout", "none"); } catch { return false; }
}
/** 지금 확대를 막아야 하나 — 아이폰이거나, 글쓰기 중이거나, 게임 창이 열려 있다 */
export function zoomLockedNow(): boolean {
  return isIOSWebKit() || editing() || !!document.querySelector(GAME_SHELLS);
}
/** 확대된 채로 남았으면 1배로 — 뷰포트 메타를 다른 글자로 다시 쓰면 iOS 가 maximum-scale=1 을 다시 적용한다 */
export function resetIOSZoom(): boolean {
  const vv = window.visualViewport;
  if (!isIOSWebKit() || !vv || vv.scale <= 1.01) return false;
  const m = document.querySelector<HTMLMetaElement>("meta[name=viewport]");
  if (!m) return false;
  const c = m.content.replace(/,\s*maximum-scale=[\d.]+/g, "");
  m.content = c + (m.content.includes("maximum-scale=1.0") ? ", maximum-scale=1" : ", maximum-scale=1.0");
  return true;
}

export default function ZoomLock() {
  useEffect(() => {
    let lastTouchEnd = 0;

    const prevent = (e: Event) => {
      if (e.cancelable && zoomLockedNow()) e.preventDefault();
    };

    const preventMultiTouch = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable && zoomLockedNow()) e.preventDefault();
    };

    const preventDoubleTap = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300 && !isInteractiveTarget(e.target) && e.cancelable && zoomLockedNow()) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    };

    const preventWheelZoom = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.cancelable && zoomLockedNow()) e.preventDefault();
    };

    const preventKeyboardZoom = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && zoomKeys.has(e.key) && zoomLockedNow()) e.preventDefault();
    };

    document.addEventListener("touchmove", preventMultiTouch, {
      passive: false,
      capture: true,
    });
    document.addEventListener("touchend", preventDoubleTap, {
      passive: false,
      capture: true,
    });
    window.addEventListener("wheel", preventWheelZoom, { passive: false });
    window.addEventListener("keydown", preventKeyboardZoom, true);
    window.addEventListener("gesturestart", prevent, { passive: false });
    window.addEventListener("gesturechange", prevent, { passive: false });
    window.addEventListener("gestureend", prevent, { passive: false });
    // 막지 못하고 확대됐으면(아이폰) 손을 뗀 뒤 1배로 되돌린다
    let resetTimer = 0;
    const settle = () => { window.clearTimeout(resetTimer); resetTimer = window.setTimeout(() => { resetIOSZoom(); }, 250); };
    window.visualViewport?.addEventListener("resize", settle);
    document.addEventListener("visibilitychange", settle);
    settle();

    return () => {
      document.removeEventListener("touchmove", preventMultiTouch, true);
      document.removeEventListener("touchend", preventDoubleTap, true);
      window.removeEventListener("wheel", preventWheelZoom);
      window.removeEventListener("keydown", preventKeyboardZoom, true);
      window.removeEventListener("gesturestart", prevent);
      window.removeEventListener("gesturechange", prevent);
      window.removeEventListener("gestureend", prevent);
      window.visualViewport?.removeEventListener("resize", settle);
      document.removeEventListener("visibilitychange", settle);
      window.clearTimeout(resetTimer);
    };
  }, []);

  return null;
}
