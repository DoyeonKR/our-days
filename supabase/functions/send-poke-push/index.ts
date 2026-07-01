// 쿡찌르기 → 상대에게 웹 푸시 전송 (앱이 꺼져 있어도 도착).
// 클라이언트가 poke insert 후 이 함수를 호출. service_role 로 상대 구독을 읽어 web-push 발송.
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
    // verify_jwt=true 라 게이트웨이가 이미 JWT 를 검증 → sub(uid) 신뢰 가능
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    let fromUser: string | null = null;
    try {
      fromUser = JSON.parse(atob(jwt.split(".")[1])).sub;
    } catch {
      /* noop */
    }

    const { couple_id, message } = await req.json().catch(() => ({}));
    if (!couple_id || !fromUser) return json({ error: "bad request" }, 400);

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 같은 커플의 '상대' user_id 들
    const { data: members } = await sb
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", couple_id)
      .neq("user_id", fromUser);
    const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (!ids.length) return json({ sent: 0, reason: "no partner" });

    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("*")
      .in("user_id", ids);
    if (!subs || !subs.length) return json({ sent: 0, reason: "no subscription" });

    const payload = JSON.stringify({
      title: "💗 콕! 상대가 찔렀어요",
      body: message || "콕!",
      url: "/",
    });

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
          // 만료된 구독(404/410)은 정리
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
