// 매일(pg_cron) 실행 → 다가온 기념일(주년/커스텀)을 D-7/3/1/당일에 양쪽 푸시
// + [2026-09-24] 아침 질문 알림 — 그 사람의 아침(6~12시)에 '오늘의 질문'을 한 번(이미 답했으면 안 보냄).
// + [2026-11-05] 같은 날 알림이 여럿이면 한 푸시에 묶는다(예전엔 첫 하나만 보내고 나머지는 버렸다) · 일정은 축하 문구를 안 쓴다 ·
//   누르면 그 일정의 달력으로(?go=event&f=) · 저녁 회차에 '상대가 먼저 답한 오늘의 질문'을 한 번 살짝 알린다.
// + [2026-09-24] 3초 로그 영상 보관 정리 — 90일 지난 영상만 떼어 내고 파일을 지운다(2026-11-06: 100편 묶음을 8초 안에서 되풀이 · 평생 보관은 함수가 건너뛴다).
// verify_jwt=false + x-cron-secret 헤더로 보호(크론만 호출).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
// 앱과 같은 질문 풀·회전(글자 하나까지 같은 복사본 — questionsync.test 가 잠근다)
import { todaysQuestion } from "../_shared/questions.ts";
// 기념일 · 일정 알림의 순수 로직(앱의 src/lib/reminders.ts 와 글자 하나까지 같은 복사본 — reminders.test 가 잠근다)
import { coupleReminders, questionNudgeBody, reminderBody, reminderUrl, type Reminder, type ReminderEventRow } from "../_shared/reminders.ts";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@our-days.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
/** 3초 로그 영상 보관 기간 — src/lib/logretention.ts 와 같은 숫자(logretention.test). */
const LOG_VIDEO_KEEP_DAYS = 90;
/** 한 번에 정리하는 편 수. [2026-11-06] 예전엔 실행마다 100편 한 번이라 하루 200편이 끝이었다 — 커플이 늘면
 *  하루에 찍히는 편 수(커플 × 4)가 이걸 넘어 정리가 영영 밀린다. 지금은 시간 예산 안에서 묶음을 되풀이한다. */
const LOG_VIDEO_BATCH = 100;
/** 한 실행에서 정리에 쓰는 시간 · 묶음 상한(알림 응답이 크론의 30초 대기를 넘지 않게). */
const LOG_VIDEO_BUDGET_MS = 8_000;
const LOG_VIDEO_MAX_ROUNDS = 10;
const MEDIA_BUCKET = "couple-photos";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

/** 저녁 질문 알림 — 상대가 답한 지 이만큼 지나야 보낸다. 상대가 답하는 순간 앱이 이미 "답했어요" 푸시를 보내서,
 *  바로 뒤에 또 보내면 조르기가 된다. */
const QNUDGE_AFTER_MS = 2 * 3600_000;

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

const EVENT_COLS = "id,title,event_date,repeat_yearly,recurrence,reminder_offsets,category,event_time,skip_dates,end_date";
const EVENT_COLS_OLD = "id,title,event_date,repeat_yearly,recurrence,reminder_offsets,category,event_time";
const missingColumn = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /column .* does not exist|Could not find the/i.test(e.message ?? ""));

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

/** 장부에서 지운다 — 모든 기기에 보내기가 일시 오류로 실패했으면 저녁 회차가 다시 보내게. */
async function release(sb: Sb, userId: string, sentOn: string, rKeys: string[]): Promise<void> {
  if (!rKeys.length) return;
  const { error } = await sb.from("reminder_log").delete().eq("user_id", userId).eq("sent_on", sentOn).in("r_key", rKeys);
  if (error) console.error("reminder release failed", error.message);
}

/** 장부에 올린(claim) 알림을 보낸다. 하나도 못 갔고 실패가 전부 일시 오류면(만료 404/410 이 아닌) 장부를 되돌린다 —
 *  예전엔 claim 뒤 발송이 실패해도 장부가 남아 그날 알림이 영영 사라졌다. 기기가 아예 없으면 되돌리지 않는다(보낼 곳이 없다). */
async function deliver(
  sb: Sb,
  userId: string,
  sentOn: string,
  rKeys: string[],
  body: { title: string; body: string; url: string },
): Promise<{ sent: number; failed: number }> {
  let res: { sent: number; failed: number; transient: number };
  try {
    res = await sendTo(sb, userId, body);
  } catch (err) {
    await release(sb, userId, sentOn, rKeys);
    throw err;
  }
  if (res.sent === 0 && res.transient > 0) await release(sb, userId, sentOn, rKeys);
  return { sent: res.sent, failed: res.failed };
}

/** 그 사람의 모든 기기 구독에 보낸다. 만료(404/410)된 구독은 지운다. transient = 만료가 아닌 실패(다시 하면 갈 수 있다). */
async function sendTo(sb: Sb, userId: string, body: { title: string; body: string; url: string }): Promise<{ sent: number; failed: number; transient: number }> {
  const { data: subs, error: subscriptionsError } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", userId);
  if (subscriptionsError) throw subscriptionsError;
  const payload = JSON.stringify(body);
  let sent = 0;
  let failed = 0;
  let transient = 0;
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
          transient++;
          console.error("push delivery failed", code ?? "unknown");
        }
      }
    }),
  );
  return { sent, failed, transient };
}

/** 커플의 일정 — 새 칸(skip_dates · end_date, 20261106050000_home_plan)이 아직 없는 DB 면 옛 칸으로 다시 읽는다. */
async function loadEvents(sb: Sb, coupleId: string) {
  const first = await sb.from("couple_events").select(EVENT_COLS).eq("couple_id", coupleId);
  if (first.error && missingColumn(first.error)) return await sb.from("couple_events").select(EVENT_COLS_OLD).eq("couple_id", coupleId);
  return first;
}

/** 오래된 로그 영상 정리 — DB 에서 먼저 떼어 내고(expire_log_videos) 그다음 파일을 지운다.
 *  파일 삭제가 실패해도 남는 건 아무도 안 가리키는 고아 파일이라 media-gc 가 수거한다.
 *  migration(20260924010000_log_video_retention)을 아직 안 돌렸으면 함수가 없어 조용히 건너뛴다 —
 *  그 SQL 을 실행하는 게 정리를 켜는 스위치다. 실패해도 알림 결과는 바꾸지 않는다(따로 보고만). */
async function expireOldLogVideos(sb: Sb): Promise<{ expired: number; skipped?: string; error?: string }> {
  const started = Date.now();
  let expired = 0;
  for (let round = 0; round < LOG_VIDEO_MAX_ROUNDS && Date.now() - started < LOG_VIDEO_BUDGET_MS; round += 1) {
    const { data, error } = await sb.rpc("expire_log_videos", { p_keep_days: LOG_VIDEO_KEEP_DAYS, p_limit: LOG_VIDEO_BATCH });
    if (error) {
      if (error.code === "PGRST202") return { expired, skipped: "migration not applied" };
      throw error;
    }
    const rows = (data ?? []) as { log_id?: string | null; path: string | null }[];
    // 2026-11-06 부터 한 로그가 두 줄(영상 + 첫 장면 그림)일 수 있다 — 편 수는 로그 id 로 센다.
    const logs = new Set(rows.map((row) => row.log_id ?? row.path));
    const paths = rows
      .map((row) => row.path)
      .filter((p): p is string => typeof p === "string" && p.length > 0);
    for (let i = 0; i < paths.length; i += 100) {
      const { error: removeError } = await sb.storage.from(MEDIA_BUCKET).remove(paths.slice(i, i + 100));
      if (removeError) {
        console.error("log video retention: storage remove", removeError.message);
        return { expired: expired + logs.size, error: "storage remove failed (media-gc will collect)" };
      }
    }
    expired += logs.size;
    if (logs.size < LOG_VIDEO_BATCH) break; // 밀린 것이 없다
  }
  return { expired };
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
        loadEvents(sb, c.id),
        sb.from("couple_members").select("user_id,timezone,nickname").eq("couple_id", c.id),
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

      // 오늘의 질문 답(저녁 알림용) — 커플마다 한 번만 읽는다. 질문 id 는 사람마다 그 사람의 '오늘'로 정해서 아래에서 거른다.
      let coupleAnswers: { user_id: string; question_id: string; created_at: string }[] | null = null;

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
           끄려던 사용자가 직접 예약한 주년·커스텀 D-day 푸시 전체를 무통보로 잃는다 [리뷰 2026-08-26].
           [2026-11-05] 그날 보낼 것을 **전부** 장부에 올리고(하나씩 claim — 아침에 보낸 것은 저녁에 안 겹친다) 한 푸시에 묶는다. */
        const rems = coupleReminders(c.start_date, (events ?? []) as ReminderEventRow[], today);
        if (rems.length && pref?.prefs?.dday !== false) {
          const claimed: Reminder[] = [];
          for (const r of rems) {
            if (await claim(sb, typed.user_id, sentOn, r.key)) claimed.push(r);
          }
          if (claimed.length) {
            coupleHit++;
            const res = await deliver(sb, typed.user_id, sentOn, claimed.map((r) => r.key), {
              title: "하루",
              body: reminderBody(claimed),
              url: reminderUrl(claimed),
            });
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
            const res = await deliver(sb, typed.user_id, sentOn, [`question:${q.id}`], { title: "💌 오늘의 질문", body: q.text, url: "./?go=answer" });
            sentTotal += res.sent;
            failedTotal += res.failed;
          }
        }

        /* (2b) 저녁 질문 알림 [2026-11-05] — 상대는 오늘의 질문에 답했고 나는 아직이면, 그 사람의 저녁(17~23시)에 한 번.
           같은 '아침 질문 알림' 설정(question)으로 끈다. 상대가 답한 지 2시간이 안 됐으면 보내지 않는다(앱이 이미 알렸다).
           장부 키 qnudge:<질문 id> 로 질문마다 한 번. 누르면 홈의 질문 카드로. */
        if (hour >= 17 && hour < 23 && pref?.prefs?.question !== false && (members ?? []).length > 1) {
          const q = todaysQuestion(today);
          if (!coupleAnswers) {
            const { data: qa, error: nudgeError } = await sb
              .from("qa_answers")
              .select("user_id,question_id,created_at")
              .eq("couple_id", c.id)
              .gte("created_at", new Date(now.getTime() - 2 * 86_400_000).toISOString());
            if (nudgeError) throw nudgeError;
            coupleAnswers = (qa ?? []) as { user_id: string; question_id: string; created_at: string }[];
          }
          const forQ = coupleAnswers.filter((a) => a.question_id === q.id);
          const mineDone = forQ.some((a) => a.user_id === typed.user_id);
          const partnerAnswer = forQ.find(
            (a) => a.user_id !== typed.user_id && now.getTime() - new Date(a.created_at).getTime() >= QNUDGE_AFTER_MS,
          );
          if (!mineDone && partnerAnswer && (await claim(sb, typed.user_id, sentOn, `qnudge:${q.id}`))) {
            const partner = (members ?? []).find((m: { user_id: string }) => m.user_id === partnerAnswer.user_id) as
              | { nickname?: string | null }
              | undefined;
            const res = await deliver(sb, typed.user_id, sentOn, [`qnudge:${q.id}`], {
              title: "💌 오늘의 질문",
              body: questionNudgeBody(partner?.nickname),
              url: "./?go=answer",
            });
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
