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

const MINE = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

export default function UpdateChip() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (MINE === "dev") return; // 로컬/프리뷰 빌드: 감지 안 함
    let stop = false;
    const check = () => {
      fetch(`${BASE}/version.json?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { v?: string } | null) => {
          if (!stop && j?.v && j.v !== "dev" && j.v !== MINE) setReady(true);
        })
        .catch(() => {}); // 오프라인 등 — 조용히(다음 기회에 다시)
    };
    check();
    const onVis = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = setInterval(check, 30 * 60_000);
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
      // 하단 탭과 같은 이유로 변환 중앙정렬을 쓰지 않는다(모바일 가로 스크롤 유발)
      className="tap fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+76px)] z-40 mx-auto w-fit whitespace-nowrap rounded-full bg-brand px-4 py-2 text-xs font-bold text-white shadow-[var(--shadow-lg)] ring-1 ring-white/25"
    >
      ✨ 새 버전이 도착했어요 · 탭해서 적용
    </button>
  );
}
