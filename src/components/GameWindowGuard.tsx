"use client";

/* 게임이 열려 있는 동안 창이 화면 위로 밀리지 않게 지킨다. 그리는 것은 없다.
 * 1) 열 때 문서 스크롤을 0 으로 — scrollLock 이 body 를 스크롤만큼 위로 올려 고정하는데, iOS 에서 fixed 창이 함께 밀리면
 *    (README §10.5 '루트 클립'과 같은 계열) 게임 카드가 탭 아래쪽에 있을수록 머리가 화면 위로 올라간다. 닫으면 제자리로 돌려놓는다.
 * 2) 그래도 창이 밀려 있으면 창의 top 을 고친다. 패딩은 건드리지 않는다(이유는 lib/gamewindow).
 * 3) 창은 좌우로 스크롤하지 않는다(2026-11-15) [사용자: 캡처 — 낚시 화면이 통째로 왼쪽으로 밀리고 수조 카드가 오른쪽으로 삐져나왔다 "좌우 스크롤이 안되어야해"]
 *    창은 위아래 스크롤(overflow-y auto)인데 그러면 좌우도 auto 가 되어, 판 위의 무언가가 잠깐 넓어지면 손가락 · 포커스로 옆으로 밀렸다.
 *    CSS 로 좌우를 막고(games.css 의 overflow-x clip — 위아래가 auto 라 브라우저가 hidden 으로 계산한다, 손가락으로는 안 밀린다), 그래도 스크립트 · 포커스가 옆으로 밀면 여기서 바로 0 으로 되돌린다. */
import { useEffect, useLayoutEffect } from "react";
import { shellShift } from "@/lib/gamewindow";
import { pageScrollTo, pageScrollY } from "@/lib/pageScroll";

const SHELL = ".aqua-shell, .merge-shell, .island-shell";

export default function GameWindowGuard() {
  useLayoutEffect(() => {
    const saved = pageScrollY();
    pageScrollTo(0);
    return () => {
      window.setTimeout(() => pageScrollTo(saved), 80); // 스크롤 잠금이 풀린 뒤
    };
  }, []);

  // 2026-11-11 배터리 — 예전엔 창이 열린 내내 400ms 마다 querySelectorAll + getBoundingClientRect(강제 레이아웃)를 돌렸다.
  // 이제 창 자리가 바뀔 수 있는 때(스크롤 잠금이 body · html 을 바꿀 때 · 창이 새로 붙을 때 · 화면 크기 · 보이는 영역 ·
  // 스크롤 · 앱 복귀)만 잰다. 재는 방식은 그대로다 — 400ms 간격으로 두 번 같은 값일 때만 믿고(shellShift) 고친 뒤엔 한 번 더 잰다.
  // 값이 멈추면(두 번 연속 2px 안) 다음 일이 생길 때까지 쉰다.
  useEffect(() => {
    let prev: number | null = null;
    let timer = 0;
    let left = 0; // 이번에 더 잴 횟수 — 계속 움직이는 창(애니메이션)에서 끝없이 돌지 않게
    const sample = () => {
      timer = 0;
      const shells = document.querySelectorAll<HTMLElement>(SHELL);
      const shell = shells[shells.length - 1];
      let again = !shell; // 창이 아직 없으면(조각을 받는 중) 조금 더 기다린다
      if (shell) {
        const top = shell.getBoundingClientRect().top;
        const fix = shellShift(prev, top);
        if (fix) {
          shell.style.top = `${(parseFloat(shell.style.top) || 0) + fix}px`;
          prev = null;
          again = true; // 고친 자리를 다시 잰다
        } else {
          again = prev === null || Math.abs(prev - top) > 2; // 처음 쟀거나 아직 움직이는 중
          prev = top;
        }
      }
      if (again && --left > 0) timer = window.setTimeout(sample, 400);
    };
    const kick = () => {
      left = Math.max(left, 12);
      if (!timer) timer = window.setTimeout(sample, 400);
    };
    // 창이 새로 붙을 때만 깨운다 — 게임 판이 그리는 DOM 변화마다 재면 폴링보다 비싸다
    const isShell = (n: Node) => n instanceof Element && (n.matches(SHELL) || !!n.querySelector(SHELL));
    const added = new MutationObserver((records) => {
      for (const r of records) for (const n of r.addedNodes) if (isShell(n)) return kick();
    });
    added.observe(document.body, { childList: true, subtree: true });
    // 스크롤 잠금(ScrollLockManager)은 body · html 의 style · class 를 바꾼다 — 그 둘만(자손의 속성 변화는 안 본다)
    const locked = new MutationObserver(kick);
    locked.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });
    locked.observe(document.documentElement, { attributes: true, attributeFilter: ["style", "class"] });
    // 3) 옆으로 밀린 창은 바로 제자리로 — 스크롤 사건은 거품이 안 올라오니 capture 로 듣는다
    const onShellScroll = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLElement && t.scrollLeft !== 0 && t.matches(SHELL)) t.scrollLeft = 0;
    };
    document.addEventListener("scroll", onShellScroll, { capture: true, passive: true });
    const vv = window.visualViewport;
    const onVis = () => { if (document.visibilityState === "visible") kick(); };
    window.addEventListener("resize", kick);
    window.addEventListener("scroll", kick, { capture: true, passive: true });
    vv?.addEventListener("resize", kick);
    vv?.addEventListener("scroll", kick);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", kick);
    kick(); // 여는 순간(스크롤 잠금 · 창이 뜨는 동안)
    return () => {
      added.disconnect();
      locked.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("resize", kick);
      window.removeEventListener("scroll", kick, { capture: true });
      document.removeEventListener("scroll", onShellScroll, { capture: true });
      vv?.removeEventListener("resize", kick);
      vv?.removeEventListener("scroll", kick);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", kick);
    };
  }, []);

  return null;
}
