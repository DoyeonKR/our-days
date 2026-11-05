"use client";

/* 게임이 열려 있는 동안 창이 화면 위로 밀리지 않게 지킨다. 그리는 것은 없다.
 * 1) 열 때 문서 스크롤을 0 으로 — scrollLock 이 body 를 스크롤만큼 위로 올려 고정하는데, iOS 에서 fixed 창이 함께 밀리면
 *    (README §10.5 '루트 클립'과 같은 계열) 게임 카드가 탭 아래쪽에 있을수록 머리가 화면 위로 올라간다. 닫으면 제자리로 돌려놓는다.
 * 2) 그래도 창이 밀려 있으면 창의 top 을 고친다. 패딩은 건드리지 않는다(이유는 lib/gamewindow). */
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

  useEffect(() => {
    let prev: number | null = null;
    const iv = window.setInterval(() => {
      const shells = document.querySelectorAll<HTMLElement>(SHELL);
      const shell = shells[shells.length - 1];
      if (!shell) return;
      const top = shell.getBoundingClientRect().top;
      const fix = shellShift(prev, top);
      if (fix) {
        shell.style.top = `${(parseFloat(shell.style.top) || 0) + fix}px`;
        prev = null;
      } else {
        prev = top;
      }
    }, 400);
    return () => window.clearInterval(iv);
  }, []);

  return null;
}
