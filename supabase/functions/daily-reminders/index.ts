// 매일 1회(pg_cron) 실행 → 다가온 기념일(100일/주년/커스텀)을 D-7/3/1/당일에 양쪽 푸시.
// verify_jwt=false + x-cron-secret 헤더로 보호(크론만 호출).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@our-days.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const MS = 86_400_000;
const THRESHOLDS = [0, 1, 3, 7];

function utcDate(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function diffDays(a: Date, b: Date): number {
  return Math.round((utcDate(b).getTime() - utcDate(a).getTime()) / MS);
}
function phrase(label: string, days: number): string {
  if (days === 0) return `오늘은 ${label}! 🎉`;
  if (days === 1) return `내일 ${label}이에요 💗`;
  return `${label} ${days}일 전이에요 ✨`;
}

type Reminder = { label: string; days: number };

function coupleReminders(
  startDate: string | null,
  events: { title: string; event_date: string; repeat_yearly: boolean }[],
  today: Date,
): Reminder[] {
  const out: Reminder[] = [];
  const seen = new Set<string>();
  const push = (label: string, days: number) => {
    const k = label + ":" + days;
    if (!seen.has(k)) {
      seen.add(k);
      out.push({ label, days });
    }
  };

  if (startDate) {
    const start = new Date(startDate + "T00:00:00Z");
    // 주년만 (일수 기념일 100·200일 등은 제외 — 사용자 요청)
    for (let k = 1; k <= 50; k++) {
      const anniv = new Date(
        Date.UTC(start.getUTCFullYear() + k, start.getUTCMonth(), start.getUTCDate()),
      );
      const du = diffDays(today, anniv);
      if (THRESHOLDS.includes(du)) push(`${k}주년`, du);
      if (du > 8) break;
    }
  }

  for (const e of events) {
    const base = new Date(e.event_date + "T00:00:00Z");
    let occ: Date;
    if (e.repeat_yearly) {
      occ = new Date(Date.UTC(today.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
      if (diffDays(today, occ) < 0)
        occ = new Date(Date.UTC(today.getUTCFullYear() + 1, base.getUTCMonth(), base.getUTCDate()));
    } else {
      occ = base;
    }
    const du = diffDays(today, occ);
    if (THRESHOLDS.includes(du)) push(e.title, du);
  }
  return out;
}

Deno.serve(async (req) => {
  if (CRON_SECRET && req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const today = utcDate(new Date());

  const { data: couples } = await sb.from("couples").select("id, start_date");
  let sentTotal = 0;
  let coupleHit = 0;

  for (const c of couples ?? []) {
    const { data: events } = await sb
      .from("couple_events")
      .select("title, event_date, repeat_yearly")
      .eq("couple_id", c.id);
    const rems = coupleReminders(c.start_date, events ?? [], today);
    if (!rems.length) continue;
    // 가장 임박한 것 하나
    rems.sort((a, b) => a.days - b.days);
    const r = rems[0];
    coupleHit++;

    const { data: members } = await sb
      .from("couple_members")
      .select("user_id")
      .eq("couple_id", c.id);
    const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (!ids.length) continue;
    const { data: subs } = await sb
      .from("push_subscriptions")
      .select("*")
      .in("user_id", ids);

    const payload = JSON.stringify({
      title: "💗 우리의 하루",
      body: phrase(r.label, r.days),
      url: "./",
    });
    await Promise.all(
      (subs ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sentTotal++;
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410)
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }),
    );
  }

  return new Response(JSON.stringify({ couples: (couples ?? []).length, coupleHit, sent: sentTotal }), {
    headers: { "Content-Type": "application/json" },
  });
});
