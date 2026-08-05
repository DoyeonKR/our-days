"use client";

/* 화면 아래 브라우저 툴바(삼성 인터넷의 하단 주소창 등) 뒤로 GNB 가 숨는 문제를 없앤다.
 *
 * [사용자 리포트 2026-08-05]
 *   "삼성브라우저로 처음 접속했을 때 애초에 gnb 가 보이지 않고, 상하로 스크롤을 해야
 *    gnb 가 보이면서 그때부터 깨지기 시작해"
 *
 * 원인: Chromium 계열 모바일은 `position: fixed` 의 기준(**레이아웃 뷰포트**)을
 * **툴바가 접힌 큰 크기**로 잡는다. 그래서 툴바가 펼쳐져 있는 첫 진입에는
 * `bottom: 0` 이 화면 밖(툴바 뒤)에 있다. 스크롤해서 툴바가 접히면 그제서야 보인다.
 * 삼성 인터넷은 주소창이 **화면 아래**에 있어 이 현상이 정통으로 나온다.
 *
 * ⚠ env(safe-area-inset-bottom) 으로는 못 고친다 — 그건 기기 노치/홈인디케이터 값이지
 *   브라우저 UI 높이가 아니다. 실제로 **지금 보이는 영역**을 재야 한다.
 *
 * 재는 법: 레이아웃 뷰포트 높이 − (시각 뷰포트 상단 오프셋 + 시각 뷰포트 높이)
 *          = 화면 아래쪽에서 가려진 픽셀 수. 이 값을 --vv-bottom 으로 흘려보내고
 *          하단 고정 요소(GNB·네온 베젤)가 그만큼 위에 앉는다.
 *
 * ⚠ 키보드가 올라와도 시각 뷰포트가 줄어든다. 그때까지 GNB 를 끌어올리면 화면 한가운데
 *   떠서 입력창을 덮는다 → 툴바 높이 범위(KEYBOARD_MIN 미만)일 때만 반영한다.
 */

import { useEffect } from "react";

/** 이보다 크게 가려졌으면 툴바가 아니라 **키보드**로 본다(툴바는 보통 40~110px). */
const KEYBOARD_MIN = 160;

export default function ViewportFit() {
  useEffect(() => {
    const vv = window.visualViewport;
    // 미지원 브라우저는 --vv-bottom 이 없어 fallback 0px → 기존 동작 그대로.
    if (!vv) return;

    const root = document.documentElement;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const covered = root.clientHeight - (vv.offsetTop + vv.height);
      const gap = covered > 0 && covered < KEYBOARD_MIN ? Math.round(covered) : 0;
      root.style.setProperty("--vv-bottom", `${gap}px`);
    };
    // 툴바는 스크롤 중 매 프레임 높이가 변한다 — rAF 로 묶어 레이아웃 스래싱을 막는다.
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };

    apply();
    vv.addEventListener("resize", schedule);
    vv.addEventListener("scroll", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv.removeEventListener("resize", schedule);
      vv.removeEventListener("scroll", schedule);
      window.removeEventListener("orientationchange", schedule);
      root.style.removeProperty("--vv-bottom");
    };
  }, []);

  return null;
}
