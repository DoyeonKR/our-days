"use client";

/* 오늘 앱을 연 기기를 한 번 센다 — 로그인 화면에서 나간 방문자도 세려고 레이아웃에 둔다. 기기마다 무작위 id 하나만 보낸다.
 * supabase 클라이언트를 안 불러온다(이 조각이 모든 화면 첫 로드에 실린다). 실패해도 앱에는 영향이 없다. */
import { useEffect } from "react";
import { kstDate } from "@/lib/kst";

const ID_KEY = "ourdays:visit:device";
const DAY_KEY = "ourdays:visit:day";

export default function VisitPing() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    try {
      const today = kstDate(Date.now());
      if (localStorage.getItem(DAY_KEY) === today) return;
      let id = localStorage.getItem(ID_KEY);
      if (!id) {
        id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
        localStorage.setItem(ID_KEY, id);
      }
      void fetch(`${url}/rest/v1/rpc/note_visit`, {
        method: "POST",
        headers: { apikey: key, "Content-Type": "application/json" },
        body: JSON.stringify({ p_device: id }),
      }).then((r) => {
        if (r.ok) localStorage.setItem(DAY_KEY, today);
      }).catch(() => {});
    } catch {
      /* 저장소가 막힌 기기는 세지 않는다 */
    }
  }, []);
  return null;
}
