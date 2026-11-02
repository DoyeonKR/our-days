"use client";

/* 게임이 열려 있는 동안 닫기 버튼이 노치 · 상태 표시줄 밑으로 들어가지 않게 지킨다. 그리는 것은 없다.
 * 1) 열 때 문서 스크롤을 0 으로 — scrollLock 이 body 를 스크롤만큼 위로 올려 고정하는데, iOS 에서 fixed 창이 함께 밀리면
 *    (README §10.5 '루트 클립'과 같은 계열) 게임 카드가 탭 아래쪽에 있을수록 머리가 화면 위로 올라간다. 닫으면 제자리로 돌려놓는다.
 * 2) 그래도 어긋나면 실제 자리를 재서 모자란 만큼 --game-safe-top 을 올린다(iOS 판마다 fixed 기준이 달라서 값 하나로 못 박지 않는다). */
import { useEffect, useLayoutEffect } from "react";
import { IOS_SAFE_FLOOR, headDeficit } from "@/lib/gamewindow";
import { isIOS } from "@/lib/platform";

const SHELL = ".aqua-shell, .merge-shell, .island-shell";
const HEAD = ".aqua-head, .merge-head, .island-command";

export default function GameWindowGuard() {
  useLayoutEffect(() => {
    const saved = window.scrollY;
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      window.setTimeout(() => window.scrollTo({ top: saved, behavior: "instant" }), 80); // 스크롤 잠금이 풀린 뒤
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const floor = isIOS() ? IOS_SAFE_FLOOR : 0;
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;visibility:hidden;padding-top:var(--game-safe-top)";
    document.body.appendChild(probe);
    const base = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    let extra = 0;

    const check = () => {
      const heads = document.querySelectorAll<HTMLElement>(HEAD);
      const head = heads[heads.length - 1];
      const shell = head?.closest<HTMLElement>(SHELL);
      if (!head || !shell) return;
      const lack = headDeficit(shell.getBoundingClientRect().top, window.visualViewport?.offsetTop ?? 0, parseFloat(getComputedStyle(head).paddingTop) || 0, floor);
      if (lack <= 0) return;
      extra += lack;
      root.style.setProperty("--game-safe-top", `${base + extra}px`);
    };
    check();
    const iv = window.setInterval(check, 500); // 툴바 · 회전 · 수조를 위에 연 경우까지 — 재는 값이 작아 부담이 없다
    window.addEventListener("resize", check);
    window.visualViewport?.addEventListener("resize", check);
    window.visualViewport?.addEventListener("scroll", check);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener("resize", check);
      window.visualViewport?.removeEventListener("resize", check);
      window.visualViewport?.removeEventListener("scroll", check);
      root.style.removeProperty("--game-safe-top");
    };
  }, []);

  return null;
}
