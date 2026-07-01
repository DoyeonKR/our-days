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

    const { couple_id, message, test } = await req.json().catch(() => ({}));
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
            url: "/",
          }
        : {
            title: "💗 콕! 상대가 찔렀어요",
            body: message || "콕!",
            url: "/",
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
