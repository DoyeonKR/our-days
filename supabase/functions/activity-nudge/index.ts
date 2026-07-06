// 오늘의 활동 리마인더 — "오전/오후 로그 안 올림" 또는 "오늘 일기 안 씀"이면 본인에게 푸시.
// cron 이 하루 2회 호출: 오전(KST~10시)엔 오전 로그, 저녁(KST~20시)엔 오후 로그+일기 점검.
// verify_jwt=false + x-cron-secret 헤더로 보호(크론만 호출, fail-closed).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@our-days.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

// src/lib/quiet.ts 미러 — 로직 변경 시 함께 갱신.
function inQuietHours(
  hour: number,
  start: number | null | undefined,
  end: number | null | undefined,
): boolean {
  if (start == null || end == null || start === end) return false;
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

// src/lib/nudge.ts 미러 — 로직 변경 시 함께 갱신 (회귀 lock: src/lib/nudge.test.ts).
function nudgeFor(
  evening: boolean,
  s: { didAm: boolean; didPm: boolean; didDiary: boolean },
): { title: string; body: string } | null {
  if (!evening) {
    if (s.didAm) return null;
    return { title: "☀️ 오전 브이로그 아직이에요", body: "오전이 지나기 전에 3초만 남겨봐요" };
  }
  const missPm = !s.didPm;
  const missDiary = !s.didDiary;
  if (!missPm && !missDiary) return null;
  if (missPm && missDiary)
    return { title: "🌙 오늘 오후 로그와 일기가 아직이에요", body: "자기 전에 오늘의 우리를 남겨봐요" };
  if (missPm) return { title: "🌙 오후 브이로그 아직이에요", body: "오늘 오후 3초, 남겨볼까요?" };
  return { title: "📔 오늘 일기가 아직이에요", body: "오늘 하루 어땠는지 적어봐요" };
}

type PrefRow = {
  user_id: string;
  prefs?: Record<string, boolean> | null;
  quiet_start?: number | null;
  quiet_end?: number | null;
};

/** 이 사용자에게 리마인더를 보낼 수 있나(카테고리 off / 조용시간 게이트). */
function canNudge(p: PrefRow | undefined, kstHour: number): boolean {
  if (!p) return true; // 설정 없음 = 수신
  if (p.prefs && p.prefs["remind"] === false) return false;
  if (inQuietHours(kstHour, p.quiet_start, p.quiet_end)) return false;
  return true;
}

Deno.serve(async (req) => {
  if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

  // KST 기준 오늘 날짜 + 시각 (서버는 UTC)
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const kstDate = kstNow.toISOString().slice(0, 10); // YYYY-MM-DD (KST)
  const kstHour = kstNow.getUTCHours(); // 0~23 (KST)
  const evening = kstHour >= 12; // 오후 슬롯 열린 뒤 = 저녁 점검

  const { data: couples } = await sb.from("couples").select("id");
  let sent = 0;
  let nudged = 0;

  for (const c of couples ?? []) {
    const coupleId = (c as { id: string }).id;

    const [{ data: members }, { data: logs }, { data: diaries }] = await Promise.all([
      sb.from("couple_members").select("user_id").eq("couple_id", coupleId),
      sb
        .from("couple_logs")
        .select("created_by, slot")
        .eq("couple_id", coupleId)
        .eq("log_date", kstDate),
      sb
        .from("deco_entries")
        .select("created_by")
        .eq("couple_id", coupleId)
        .eq("entry_date", kstDate),
    ]);

    const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
    if (!ids.length) continue;

    const { data: prefRows } = await sb
      .from("notify_prefs")
      .select("user_id, prefs, quiet_start, quiet_end")
      .in("user_id", ids);

    for (const uid of ids) {
      const pref = (prefRows ?? []).find(
        (r: PrefRow) => r.user_id === uid,
      ) as PrefRow | undefined;
      if (!canNudge(pref, kstHour)) continue;

      // 이 사용자가 오늘 남긴 것
      const didAm = (logs ?? []).some(
        (l: { created_by: string; slot: string }) =>
          l.created_by === uid && l.slot === "am",
      );
      const didPm = (logs ?? []).some(
        (l: { created_by: string; slot: string }) =>
          l.created_by === uid && l.slot === "pm",
      );
      const didDiary = (diaries ?? []).some(
        (d: { created_by: string }) => d.created_by === uid,
      );

      const msg = nudgeFor(evening, { didAm, didPm, didDiary });
      if (!msg) continue;
      const { title, body: bodyMsg } = msg;

      const { data: subs } = await sb
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", uid);
      if (!subs || !subs.length) continue;
      nudged++;

      const payload = JSON.stringify({ title, body: bodyMsg, url: "./" });
      await Promise.all(
        (subs ?? []).map(
          async (s: { endpoint: string; p256dh: string; auth: string }) => {
            try {
              await webpush.sendNotification(
                { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                payload,
              );
              sent++;
            } catch (err) {
              const code = (err as { statusCode?: number })?.statusCode;
              if (code === 404 || code === 410)
                await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
            }
          },
        ),
      );
    }
  }

  return new Response(
    JSON.stringify({ kstDate, kstHour, evening, nudged, sent }),
    { headers: { "Content-Type": "application/json" } },
  );
});
