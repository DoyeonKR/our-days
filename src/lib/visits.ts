"use client";

/* 오늘 방문자 수 (2026-11-03) — 적재는 VisitPing(레이아웃), 읽기는 useTodayVisitors(홈 머리글).
 * 볼 수 있는 계정은 서버(today_visitors)가 정한다 — 다른 계정엔 null 이 와서 아무것도 안 그린다. migrations/20261103010000_daily_visits.sql */
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export function useTodayVisitors(enabled: boolean): number | null {
  const [n, setN] = useState<number | null>(null);
  useEffect(() => {
    const sb = enabled ? getSupabase() : null;
    if (!sb) return;
    let alive = true;
    const read = () => {
      void sb.rpc("today_visitors").then(({ data, error }) => {
        if (alive && !error) setN(typeof data === "number" ? data : null);
      });
    };
    read();
    const onShow = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [enabled]);
  return n;
}
