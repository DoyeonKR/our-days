// 매일(pg_cron) 실행 → 다가온 기념일(주년/커스텀)을 D-7/3/1/당일에 양쪽 푸시
// + [2026-09-24] 아침 질문 알림 — 그 사람의 아침(6~12시)에 '오늘의 질문'을 한 번(이미 답했으면 안 보냄).
// + [2026-09-24] 3초 로그 영상 보관 정리 — 90일 지난 영상만 회당 100편씩 떼어 내고 파일을 지운다.
// verify_jwt=false + x-cron-secret 헤더로 보호(크론만 호출).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
// 앱과 같은 질문 풀·회전(글자 하나까지 같은 복사본 — questionsync.test 가 잠근다)
import { todaysQuestion } from "../_shared/questions.ts";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@our-days.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
/** 3초 로그 영상 보관 기간 — src/lib/logretention.ts 와 같은 숫자(logretention.test). */
const LOG_VIDEO_KEEP_DAYS = 90;
/** 한 번에 정리하는 편 수. 크론이 하루 두 번이라 하루 200편 — 밀린 것도 며칠이면 따라잡는다. */
const LOG_VIDEO_BATCH = 100;
const MEDIA_BUCKET = "couple-photos";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const MS = 86_400_000;
const DEFAULT_THRESHOLDS = [0, 1, 3, 7];

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

type EventRow = {
  title: string;
  event_date: string;
  repeat_yearly: boolean;
  recurrence?: "none" | "monthly" | "yearly" | null;
  reminder_offsets?: number[] | null;
};

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function occurrence(e: EventRow, today: Date): Date {
  const base = new Date(e.event_date + "T00:00:00Z");
  const recurrence = e.recurrence ?? (e.repeat_yearly ? "yearly" : "none");
  if (recurrence === "none") return base;
  if (recurrence === "monthly") {
    const make = (year: number, month: number) =>
      new Date(Date.UTC(year, month, Math.min(base.getUTCDate(), daysInMonth(year, month))));
    let next = make(today.getUTCFullYear(), today.getUTCMonth());
    if (diffDays(today, next) < 0) {
      const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));
      next = make(month.getUTCFullYear(), month.getUTCMonth());
    }
    return next.getTime() < base.getTime() ? base : next;
  }
  let next = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      base.getUTCMonth(),
      Math.min(base.getUTCDate(), daysInMonth(today.getUTCFullYear(), base.getUTCMonth())),
    ),
  );
  if (diffDays(today, next) < 0) {
    const year = today.getUTCFullYear() + 1;
    next = new Date(
      Date.UTC(year, base.getUTCMonth(), Math.min(base.getUTCDate(), daysInMonth(year, base.getUTCMonth()))),
    );
  }
  return next.getTime() < base.getTime() ? base : next;
}

function localParts(now: Date, timezone: string): { today: Date; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
    return {
      today: new Date(Date.UTC(get("year"), get("month") - 1, get("day"))),
      hour: get("hour"),
    };
  } catch {
    return localParts(now, "Asia/Seoul");
  }
}

function inQuietHours(hour: number, start?: number | null, end?: number | null): boolean {
  if (start == null || end == null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

function coupleReminders(
  startDate: string | null,
  events: EventRow[],
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
        Date.UTC(
          start.getUTCFullYear() + k,
          start.getUTCMonth(),
          Math.min(
            start.getUTCDate(),
            daysInMonth(start.getUTCFullYear() + k, start.getUTCMonth()),
          ),
        ),
      );
      const du = diffDays(today, anniv);
      if (DEFAULT_THRESHOLDS.includes(du)) push(`${k}주년`, du);
      if (du > 8) break;
    }
  }

  for (const e of events) {
    const occ = occurrence(e, today);
    const du = diffDays(today, occ);
    if ((e.reminder_offsets ?? DEFAULT_THRESHOLDS).includes(du)) push(e.title, du);
  }
  return out;
}

type Sb = ReturnType<typeof createClient>;

/** 발송 dedup(reminder_log) — 크론이 하루 2회 돌아 시간대·조용시간과 겹쳐도 같은 알림은 한 번만.
 *  insert 가 못 들어가면(이미 보냄) false. */
async function claim(sb: Sb, userId: string, sentOn: string, rKey: string): Promise<boolean> {
  const { data, error } = await sb
    .from("reminder_log")
    .upsert({ user_id: userId, sent_on: sentOn, r_key: rKey }, { onConflict: "user_id,sent_on,r_key", ignoreDuplicates: true })
    .select("user_id");
  if (error) throw error;
  return !!data && data.length > 0;
}

/** 그 사람의 모든 기기 구독에 보낸다. 만료(404/410)된 구독은 지운다. */
async function sendTo(sb: Sb, userId: string, body: { title: string; body: string; url: string }): Promise<{ sent: number; failed: number }> {
  const { data: subs, error: subscriptionsError } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  if (subscriptionsError) throw subscriptionsError;
  const payload = JSON.stringify(body);
  let sent = 0;
  let failed = 0;
  await Promise.all(
    (subs ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (err) {
        failed++;
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          const { error: deleteError } = await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          if (deleteError) throw deleteError;
        } else {
          console.error("push delivery failed", code ?? "unknown");
        }
      }
    }),
  );
  return { sent, failed };
}

/** 오래된 로그 영상 정리 — DB 에서 먼저 떼어 내고(expire_log_videos) 그다음 파일을 지운다.
 *  파일 삭제가 실패해도 남는 건 아무도 안 가리키는 고아 파일이라 media-gc 가 수거한다.
 *  migration(20260924010000_log_video_retention)을 아직 안 돌렸으면 함수가 없어 조용히 건너뛴다 —
 *  그 SQL 을 실행하는 게 정리를 켜는 스위치다. 실패해도 알림 결과는 바꾸지 않는다(따로 보고만). */
async function expireOldLogVideos(sb: Sb): Promise<{ expired: number; skipped?: string; error?: string }> {
  const { data, error } = await sb.rpc("expire_log_videos", { p_keep_days: LOG_VIDEO_KEEP_DAYS, p_limit: LOG_VIDEO_BATCH });
  if (error) {
    if (error.code === "PGRST202") return { expired: 0, skipped: "migration not applied" };
    throw error;
  }
  const paths = ((data ?? []) as { path: string | null }[])
    .map((row) => row.path)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
  for (let i = 0; i < paths.length; i += 100) {
    const { error: removeError } = await sb.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + 100));
    if (removeError) {
      console.error("log video retention: storage remove", removeError.message);
      return { expired: paths.length, error: "storage remove failed (media-gc will collect)" };
    }
  }
  return { expired: paths.length };
}

Deno.serve(async (req) => {
  // fail-closed: 시크릿 미설정이면 전면 거부 — 미설정 상태에서 미인증 호출로
  // 전체 커플 대상 푸시가 트리거되는 fail-open 구멍 차단.
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE || !VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response(JSON.stringify({ error: "server configuration missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const now = new Date();
    const { data: couples, error: couplesError } = await sb.from("couples").select("id, start_date");
    if (couplesError) throw couplesError;
    let sentTotal = 0;
    let failedTotal = 0;
    let coupleHit = 0;

    for (const c of couples ?? []) {
      const [eventResult, memberResult] = await Promise.all([
        sb
          .from("couple_events")
          .select("title, event_date, repeat_yearly, recurrence,reminder_offsets")
          .eq("couple_id", c.id),
        sb.from("couple_members").select("user_id,timezone").eq("couple_id", c.id),
      ]);
      if (eventResult.error) throw eventResult.error;
      if (memberResult.error) throw memberResult.error;
      const events = eventResult.data;
      const members = memberResult.data;
      const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
      if (!ids.length) continue;
      const { data: prefs, error: prefsError } = await sb
        .from("notify_prefs")
        .select("user_id,prefs,quiet_start,quiet_end")
        .in("user_id", ids);
      if (prefsError) throw prefsError;

      for (const member of members ?? []) {
        const typed = member as { user_id: string; timezone?: string | null };
        const { today, hour } = localParts(now, typed.timezone || "Asia/Seoul");
        const pref = (prefs ?? []).find((row: { user_id: string }) => row.user_id === typed.user_id) as
          | { prefs?: Record<string, boolean>; quiet_start?: number | null; quiet_end?: number | null }
          | undefined;
        if (inQuietHours(hour, pref?.quiet_start, pref?.quiet_end)) continue; // 조용시간 — 발송 생략
        const sentOn = today.toISOString().slice(0, 10);

        /* (1) 기념일 — 카테고리는 'dday'(기념일 알림)다. 'remind' 는 "오늘 남기기 알림"(activity-nudge 의
           자기 리마인더) 전용 키인데 여기까지 같이 게이트하면, 설명문대로 자기 리마인더만
           끄려던 사용자가 직접 예약한 주년·커스텀 D-day 푸시 전체를 무통보로 잃는다 [리뷰 2026-08-26]. */
        const rems = coupleReminders(c.start_date, (events ?? []) as EventRow[], today);
        if (rems.length && pref?.prefs?.dday !== false) {
          rems.sort((x, y) => x.days - y.days);
          const r = rems[0];
          if (await claim(sb, typed.user_id, sentOn, `${r.label}:${r.days}`)) {
            coupleHit++;
            const res = await sendTo(sb, typed.user_id, { title: "하루", body: phrase(r.label, r.days), url: "./" });
            sentTotal += res.sent;
            failedTotal += res.failed;
          }
        }

        /* (2) 아침 질문 — 그 사람의 아침(6~12시)에 한 번. 크론은 하루 두 번(09·19시 KST) 도는데, 저녁 회차는
           아침이 아니라 건너뛴다. 이미 답했으면 조르지 않는다. 누르면 홈의 질문 카드로(?go=answer). */
        if (hour >= 6 && hour < 12 && pref?.prefs?.question !== false) {
          const q = todaysQuestion(today);
          const { data: answered, error: answeredError } = await sb
            .from("qa_answers")
            .select("user_id")
            .eq("couple_id", c.id)
            .eq("question_id", q.id)
            .eq("user_id", typed.user_id)
            .limit(1);
          if (answeredError) throw answeredError;
          if (!answered?.length && (await claim(sb, typed.user_id, sentOn, `question:${q.id}`))) {
            const res = await sendTo(sb, typed.user_id, { title: "💌 오늘의 질문", body: q.text, url: "./?go=answer" });
            sentTotal += res.sent;
            failedTotal += res.failed;
          }
        }
      }
    }

    /* (3) 오래된 로그 영상 정리 — 알림이 다 나간 뒤에. 여기서 실패해도 알림 응답은 그대로다. */
    let videos: { expired: number; skipped?: string; error?: string };
    try {
      videos = await expireOldLogVideos(sb);
    } catch (err) {
      console.error("log video retention", err instanceof Error ? err.message : String(err));
      videos = { expired: 0, error: "log video retention failed" };
    }

    return new Response(
      JSON.stringify({ couples: (couples ?? []).length, coupleHit, sent: sentTotal, failed: failedTotal, videos }),
      {
        status: failedTotal ? 207 : 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("daily-reminders", error instanceof Error ? error.message : String(error));
    return new Response(JSON.stringify({ error: "reminder delivery failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
});
