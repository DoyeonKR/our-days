"use client";

/* 오늘 앱을 연 기기를 한 번 센다 — 로그인 화면에서 나간 방문자도 세려고 레이아웃에 둔다. 기기마다 무작위 id 하나만 보낸다.
 * supabase 클라이언트를 안 불러온다(이 조각이 모든 화면 첫 로드에 실린다). 실패해도 앱에는 영향이 없다. */
import { useEffect } from "react";
import { kstDate } from "@/lib/kst";

const ID_KEY = "ourdays:visit:device";
const DAY_KEY = "ourdays:visit:day";
// 서버(note_visit)가 UUID 모양만 센다(2026-11-05) — 공개 키로 아무 글자나 보내 표를 채우지 못하게
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function newDeviceId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function VisitPing() {
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    try {
      const today = kstDate(Date.now());
      if (localStorage.getItem(DAY_KEY) === today) return;
      let id = localStorage.getItem(ID_KEY);
      if (!id || !UUID.test(id)) {
        id = newDeviceId();
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
