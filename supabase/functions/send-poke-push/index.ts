// 쿡찌르기/테스트 → 웹 푸시 전송 (앱이 꺼져 있어도 도착).
// body.test=true 면 '내 구독'으로 자가 테스트 발송(파이프라인 진단용).
// body.overtake_run=<판 id> 면 정원 합치기 순위 역전 알림 — 그 판이 넘어선 '10등 안 최고 기록'의 주인들에게(2026-11-01).
//   누구에게 보낼지는 DB 함수 merge_overtaken 이 정한다(판을 낸 본인만 · 판마다 한 번 · 10분 안). 커플과 무관한 사람에게도 간다.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@our-days.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// ⚠ src/lib/quiet.ts 의 미러 — Deno 라 클라 코드를 import 못해 본문 복사.
// 로직 변경 시 양쪽 함께 갱신 (단위 테스트는 src/lib/urlcache.test.ts 의 inQuietHours 케이스).
function inQuietHours(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined,
): boolean {
  if (start == null || end == null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

// 받는 사람 시간대의 지금 시(0~23). 예전엔 모두 KST 로 봐서, 해외에 있는 사람의 조용시간(예: 23~8시)이
// 그 사람의 낮에 걸리고 밤에는 쿡이 울렸다. 시간대는 couple_members.timezone(앱이 기기 값으로 맞춘다) — daily-reminders 와 같은 방식.
function hourIn(timezone: string | null | undefined, now = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "Asia/Seoul", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const h = Number(parts.find((x) => x.type === "hour")?.value);
    if (Number.isFinite(h)) return h % 24;
  } catch {
    /* 이상한 시간대 → KST */
  }
  return (now.getUTCHours() + 9) % 24;
}

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
    const { couple_id, message, title, category, url, test, overtake_run } = await req
      .json()
      .catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 수신자 알림 설정(카테고리 off / 조용시간) — 서버측 강제
    const allowed = async (
      list: string[],
      cat: string | undefined,
      tzOf: Map<string, string | null> = new Map(),
    ): Promise<string[]> => {
      if (!list.length) return list;
      const { data: prefRows } = await sb
        .from("notify_prefs")
        .select("user_id, prefs, quiet_start, quiet_end")
        .in("user_id", list);
      // 커플 밖 사람(순위 역전)은 시간대를 따로 읽는다 — 공간이 없으면 KST
      const missing = list.filter((id) => !tzOf.has(id));
      if (missing.length) {
        const { data: tzRows } = await sb.from("couple_members").select("user_id, timezone").in("user_id", missing);
        for (const r of (tzRows ?? []) as { user_id: string; timezone: string | null }[]) tzOf.set(r.user_id, r.timezone);
      }
      return list.filter((id) => {
        const p = (prefRows ?? []).find((r: { user_id: string }) => r.user_id === id) as
          | { prefs?: Record<string, boolean>; quiet_start?: number | null; quiet_end?: number | null }
          | undefined;
        if (!p) return true; // 설정 없음 = 전부 수신
        if (cat && p.prefs && p.prefs[cat] === false) return false;
        if (inQuietHours(hourIn(tzOf.get(id)), p.quiet_start, p.quiet_end)) return false; // 조용시간(받는 사람 시간대) — 발송 생략
        return true;
      });
    };
    const deliver = async (subs: { endpoint: string; p256dh: string; auth: string }[], payload: string): Promise<number> => {
      let n = 0;
      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
            n++;
          } catch (err) {
            const code = (err as { statusCode?: number })?.statusCode;
            if (code === 404 || code === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }),
      );
      return n;
    };

    if (overtake_run) {
      const runId = Number(overtake_run);
      if (!Number.isSafeInteger(runId) || runId <= 0) return json({ error: "bad request" }, 400);
      const { data: rows, error } = await sb.rpc("merge_overtaken", { p_run: runId, p_user: fromUser });
      if (error) return json({ error: error.message }, 500);
      const victims = (rows ?? []) as { user_id: string; best: number; run_nickname: string; run_score: number }[];
      const to = await allowed(victims.map((v) => v.user_id), "rank");
      if (!to.length) return json({ sent: 0, reason: victims.length ? "muted" : "no overtake" });
      const { data: subs } = await sb.from("push_subscriptions").select("*").in("user_id", to);
      let sent = 0;
      for (const v of victims.filter((x) => to.includes(x.user_id))) {
        const mine = (subs ?? []).filter((s: { user_id: string }) => s.user_id === v.user_id);
        if (!mine.length) continue;
        sent += await deliver(mine, JSON.stringify({
          title: "🏆 내 최고 기록이 역전됐어요",
          body: `${v.run_nickname}님이 ${v.run_score.toLocaleString("ko-KR")}점으로 내 최고 ${v.best.toLocaleString("ko-KR")}점을 넘었어요. 다시 1등 해 볼까요?`,
          url: "./game/?go=merge",
        }));
      }
      return json({ sent });
    }

    // 대상 user_id 목록: 테스트면 나 자신, 아니면 같은 커플의 상대
    let ids: string[];
    let senderName = "";
    if (test) {
      ids = [fromUser];
    } else {
      if (!couple_id) return json({ error: "bad request" }, 400);
      // 호출자가 그 커플의 멤버인지 서버측 검증 — 아니면 임의 couple_id 로 남의 커플에
      // 푸시를 쏠 수 있다 (service_role 조회라 RLS 미적용 → 명시 검증 필수).
      const { data: members } = await sb
        .from("couple_members")
        .select("user_id, nickname, timezone")
        .eq("couple_id", couple_id);
      const rows = (members ?? []) as { user_id: string; nickname: string | null; timezone: string | null }[];
      const all = rows.map((m) => m.user_id);
      if (!all.includes(fromUser)) return json({ error: "not a member" }, 403);
      ids = all.filter((id) => id !== fromUser);
      if (!ids.length) return json({ sent: 0, reason: "no partner" });
      senderName = (rows.find((m) => m.user_id === fromUser)?.nickname ?? "").trim().slice(0, 20);

      ids = await allowed(ids, category, new Map(rows.map((m) => [m.user_id, m.timezone])));
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
            // 쿡 제목에 보낸 사람 애칭을(2026-11-05) — 잠금 화면에서 누가 찔렀는지 바로 보인다. 애칭이 없으면 옛 제목.
            title: title || (category === "poke" && senderName ? `💗 ${senderName}님이 쿡 찔렀어요` : "💗 쿡! 상대가 찔렀어요"),
            body: message || "쿡!",
            url: url || "./",
            // SW 가 쿡 알림을 커플마다 하나로 묶는다(tag poke-<커플 id>). 옛 SW 는 모르는 칸이라 무시한다.
            category: category || undefined,
            couple_id,
            ...(category === "poke" ? { tag: `poke-${couple_id}` } : {}),
          },
    );

    const sent = await deliver(subs, payload);
    return json({ sent });
  } catch (e) {
    console.error("send-poke-push failed", e); return json({ error: "internal error" }, 500); // 내부 오류 내용(스택 · 키 이름)은 응답에 싣지 않는다
  }
});
