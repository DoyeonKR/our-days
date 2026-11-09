"use client";

/* 새 버전 감지 칩. [2026-07-28]
   배경(사용자 리포트 "배포된 거 맞아?"): 배포가 라이브에 반영돼도
   ① 백그라운드에서 재개된 PWA 는 재탐색을 안 해 옛 화면 그대로,
   ② GitHub Pages CDN 이 문서를 최대 10분(max-age=600) 캐시 —
   → '완전 종료 후 재실행'을 매번 요구하게 됐다. 빌드마다 version.json(커밋 sha)을 심고,
   앱이 포그라운드로 돌아올 때마다 비교해 다르면 '탭해서 적용' 칩을 띄운다.
   ?t= 캐시버스터가 CDN 엣지까지 우회하므로 감지는 CDN TTL 과 무관하게 즉시. */

import { useEffect, useState } from "react";
import { BASE } from "@/lib/base";
import { MicroIcon } from "@/components/PixelGlyph";
import { isBusy } from "@/lib/busy";

/** 지금 저절로 새로고침해도 되나 — 판을 하는 중이거나 글을 쓰는 중이면 안 된다 */
function canReloadNow(): boolean {
  // 올리기 · 내보내기 중(2026-11-09) — 사진첩 여러 장 올리기는 창 없이 진행 막대만 띄워서, 5분 점검 · 앱 복귀 때 새로고침이 끼어들어 남은 장이 끊겼다
  if (isBusy()) return false;
  const el = document.activeElement;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return false;
  return !document.querySelector(".aqua-shell, .merge-shell, .island-command, .fish-fever, [role='dialog']");
}
/** 같은 버전으로는 이 탭에서 한 번만 — 문서 캐시가 옛 판을 또 주면 끝없이 새로고침하게 된다 */
function reloadOnce(version: string): boolean {
  const key = `ourdays:auto-reload:${version}`;
  try {
    if (sessionStorage.getItem(key)) return false;
    sessionStorage.setItem(key, "1");
  } catch {
    return false;
  }
  location.reload();
  return true;
}

const MINE = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/* SW 캐시 청소 요청(2026-11-05) — SW 의 옛 청크 청소가 activate 에서만 돌아, SW 가 안 바뀌는 배포가 이어지면 계속 쌓였다.
   지금 페이지가 쓰는 _next/static 주소를 함께 보내 그것만 남기게 한다. 하루 한 번은 SW 가 캐시 도장으로 지킨다. */
function requestSwGc() {
  try {
    const sw = navigator.serviceWorker?.controller;
    if (!sw) return;
    const keep = new Set<string>();
    for (const e of performance.getEntriesByType("resource")) if (e.name.includes("/_next/static/")) keep.add(e.name);
    document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>("script[src], link[href]").forEach((el) => {
      const u = "src" in el && el.src ? el.src : (el as HTMLLinkElement).href;
      if (u && u.includes("/_next/static/")) keep.add(u);
    });
    sw.postMessage({ type: "gc", keep: [...keep] });
  } catch {
    /* 청소는 다음 기회에 */
  }
}

export default function UpdateChip() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // 첫 화면 조각이 다 받아진 뒤에(10초) 청소를 부탁한다
    const gcTimer = window.setTimeout(requestSwGc, 10_000);
    return () => window.clearTimeout(gcTimer);
  }, []);

  useEffect(() => {
    if (MINE === "dev") return; // 로컬/프리뷰 빌드: 감지 안 함
    let stop = false;
    const check = () => {
      fetch(`${BASE}/version.json?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { v?: string } | null) => {
          if (stop || !j?.v || j.v === "dev" || j.v === MINE) return;
          // 2026-11-04 [사용자: "다 반영해 제발"] 칩을 눌러야만 적용돼서 새 버전이 안 들어갔다 — 게임 창 안에선 칩이 가려져 보이지도 않았다.
          // 판 · 글쓰기 중이 아니면 저절로 적용한다. 그 중이면 칩을 띄우고 다음에 돌아올 때 다시 본다.
          if (!canReloadNow() || !reloadOnce(j.v)) setReady(true);
        })
        .catch(() => {}); // 오프라인 등 — 조용히(다음 기회에 다시)
    };
    check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(check, 5 * 60_000);
    return () => {
      stop = true;
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(t);
    };
  }, []);

  if (!ready) return null;
  return (
    <button
      onClick={() => location.reload()}
      // 하단 탭과 같은 이유로 변환 중앙정렬을 쓰지 않는다(모바일 가로 스크롤 유발).
      // 탭 바 윗변(--gnb-top — globals.css 가 --vv-bottom · safe-area · 바 높이로 계산) 위로 10px 띄운다.
      // 따로 숫자를 적으면 바 높이를 바꿀 때 칩이 바에 겹친다(2026-11-06).
      style={{ bottom: "calc(var(--gnb-top, calc(env(safe-area-inset-bottom) + 76px + var(--vv-bottom, 0px))) + 10px)" }}
      className="tap fixed inset-x-0 z-[96] mx-auto w-fit whitespace-nowrap rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-lg)] ring-1 ring-white/25"
    >
      <MicroIcon k="sparkle" size={12} className="mr-1" />
      새 버전이 도착했어요 · 탭해서 적용
    </button>
  );
}
