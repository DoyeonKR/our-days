// 쿡찌르기/테스트 → 웹 푸시 전송 (앱이 꺼져 있어도 도착).
// body.test=true 면 '내 구독'으로 자가 테스트 발송(파이프라인 진단용).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@our-days.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    // verify_jwt=true → 게이트웨이가 JWT 검증 → sub(uid) 신뢰 가능
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    let fromUser: string | null = null;
    try {
      fromUser = JSON.parse(atob(jwt.split(".")[1])).sub;
    } catch {
      /* noop */
    }
    if (!fromUser) return json({ error: "no auth" }, 401);

    // category: poke|log|diary|interact|letter|bucket|moodq — 수신자 설정으로 게이트
    const { couple_id, message, title, category, url, test } = await req
      .json()
      .catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 대상 user_id 목록: 테스트면 나 자신, 아니면 같은 커플의 상대
    let ids: string[];
    if (test) {
      ids = [fromUser];
    } else {
      if (!couple_id) return json({ error: "bad request" }, 400);
      const { data: members } = await sb
        .from("couple_members")
        .select("user_id")
        .eq("couple_id", couple_id)
        .neq("user_id", fromUser);
      ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
      if (!ids.length) return json({ sent: 0, reason: "no partner" });

      // 수신자 알림 설정(카테고리 off / 조용시간) — 서버측 강제
      const { data: prefRows } = await sb
        .from("notify_prefs")
        .select("user_id, prefs, quiet_start, quiet_end")
        .in("user_id", ids);
      const kstHour =
        (new Date().getUTCHours() + 9) % 24; // KST 시각
      ids = ids.filter((id) => {
        const p = (prefRows ?? []).find(
          (r: { user_id: string }) => r.user_id === id,
        ) as
          | {
              prefs?: Record<string, boolean>;
              quiet_start?: number | null;
              quiet_end?: number | null;
            }
          | undefined;
        if (!p) return true; // 설정 없음 = 전부 수신
        if (category && p.prefs && p.prefs[category] === false) return false;
        const qs = p.quiet_start;
        const qe = p.quiet_end;
        if (qs != null && qe != null && qs !== qe) {
          const inQuiet =
            qs < qe ? kstHour >= qs && kstHour < qe : kstHour >= qs || kstHour < qe;
          if (inQuiet) return false; // 조용시간 — 발송 생략
        }
        return true;
      });
      if (!ids.length) return json({ sent: 0, reason: "muted" });
    }

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("*")
      .in("user_id", ids);
    if (!subs || !subs.length)
      return json({ sent: 0, reason: test ? "no self subscription" : "no subscription" });

    const payload = JSON.stringify(
      test
        ? {
            title: "🔔 테스트 알림 도착!",
            body: "푸시가 정상 작동해요. 이제 상대의 쿡찌르기도 여기로 옵니다 💗",
            url: "./",
            force: true,
          }
        : {
            title: title || "💗 쿡! 상대가 찔렀어요",
            body: message || "쿡!",
            url: url || "./",
          },
    );

    let sent = 0;
    await Promise.all(
      subs.map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent++;
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }),
    );
    return json({ sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
