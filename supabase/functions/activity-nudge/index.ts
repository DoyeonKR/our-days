// 오늘의 활동 리마인더 — "오전/오후 로그 안 올림" 또는 "오늘 일기 안 씀"이면 본인에게 푸시.
// cron 이 하루 2회 호출: 오전(KST~10시)엔 오전 로그, 저녁(KST~20시)엔 오후 로그+일기 점검.
// verify_jwt=false + x-cron-secret 헤더로 보호(크론만 호출, fail-closed).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendFcm } from "../_shared/fcm.ts";

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

// src/lib/aquanudge.ts 미러(2026-11-21 수조 알림) — 글자 그대로 같은 복사본(aquanudge.test 가 비교한다). 고치면 둘 다, 그리고 함수를 다시 배포한다.
const NUDGE_HUNGRY = 75;
const NUDGE_NET_H = 15;
const NUDGE_STALE_H = 48;
const NUDGE_LATE_H = 3;
// ── 엣지 함수 복사본 시작 ──
function aquaNudgeFor(
  aq: { hunger?: unknown; at?: unknown } | null | undefined,
  al: { perH?: unknown; prey?: unknown; net?: unknown } | null | undefined,
  now: number,
): { title: string; body: string } | null {
  if (!aq || !al) return null;
  const hunger = typeof aq.hunger === "number" ? aq.hunger : NaN;
  const at = typeof aq.at === "number" ? aq.at : NaN;
  const perH = typeof al.perH === "number" ? al.perH : NaN;
  const prey = typeof al.prey === "number" ? al.prey : 0;
  const net = typeof al.net === "number" ? al.net : NaN;
  const lines: string[] = [];
  if (prey > 0 && Number.isFinite(hunger) && Number.isFinite(at) && Number.isFinite(perH) && now - at <= NUDGE_STALE_H * 3600000) {
    const sinceH = Math.max(0, (now - at) / 3600000), nowHunger = hunger - sinceH * perH;
    if (nowHunger < NUDGE_HUNGRY) {
      // 문턱 밑으로 내려간 때 — 저장 때 이미 밑이었으면 저장 시각
      const crossedH = hunger < NUDGE_HUNGRY || perH <= 0 ? sinceH : sinceH - (hunger - NUDGE_HUNGRY) / perH;
      lines.push(crossedH >= NUDGE_LATE_H ? "배고픈 사냥꾼이 벌써 사냥했을 수 있어요 — 지금 먹이를 주면 더 잃지 않아요" : `배고픈 사냥꾼이 있어요 — 먹이를 안 주면 ${prey}마리가 잡아먹힐 수 있어요`);
    }
  }
  if (Number.isFinite(net) && net > now && net - now <= NUDGE_NET_H * 3600000) lines.push("대기 그물의 물고기가 곧 팔려요 — 수조로 옮겨 주세요");
  if (!lines.length) return null;
  return { title: "🐟 우리 수조", body: lines.join(" · ") };
}
// ── 엣지 함수 복사본 끝 ──

type PrefRow = {
  user_id: string;
  prefs?: Record<string, boolean> | null;
  quiet_start?: number | null;
  quiet_end?: number | null;
};

/** 이 사용자에게 이 카테고리 알림을 보낼 수 있나(카테고리 off / 조용시간 게이트). 조용시간은 받는 사람 시간대의 시(2026-11-23 — 예전엔 KST 라 해외에 있는 사람에게 그쪽 밤에 갔다) */
function canNudge(p: PrefRow | undefined, localHour: number, category: "remind" | "aquarium"): boolean {
  if (!p) return true; // 설정 없음 = 수신
  if (p.prefs && p.prefs[category] === false) return false;
  if (inQuietHours(localHour, p.quiet_start, p.quiet_end)) return false;
  return true;
}
/** 시간대의 지금 시(0~23) — 잘못된 시간대면 KST(daily-reminders 의 localParts 와 같은 방식) */
function hourIn(now: Date, timezone: string | null | undefined): number {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "Asia/Seoul", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const h = Number(parts.find((x) => x.type === "hour")?.value);
    return Number.isFinite(h) ? h : hourIn(now, "Asia/Seoul");
  } catch {
    return timezone === "Asia/Seoul" ? new Date(now.getTime() + 9 * 3600 * 1000).getUTCHours() : hourIn(now, "Asia/Seoul");
  }
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
  // 수조 알림 재료 — 섬 행에서 수조(포만 · 시각)와 앱이 적어 둔 aquaAlert 만 받는다(섬 전체는 크다)
  const { data: islands } = await sb.from("couple_island").select("couple_id, aq:state->aquarium, al:state->aquaAlert");
  const islandOf = new Map((islands ?? []).map((r: { couple_id: string; aq: unknown; al: unknown }) => [r.couple_id, r]));
  let aquaNudged = 0;
  let sent = 0;
  let nudged = 0;

  for (const c of couples ?? []) {
    const coupleId = (c as { id: string }).id;

    const [{ data: members }, { data: logs }, { data: diaries }] = await Promise.all([
      sb.from("couple_members").select("user_id, timezone").eq("couple_id", coupleId),
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
    const isl = islandOf.get(coupleId) as { aq?: { hunger?: unknown; at?: unknown } | null; al?: { perH?: unknown; prey?: unknown; net?: unknown } | null } | undefined;
    const aquaMsg = isl ? aquaNudgeFor(isl.aq, isl.al, Date.now()) : null;

    const { data: prefRows } = await sb
      .from("notify_prefs")
      .select("user_id, prefs, quiet_start, quiet_end")
      .in("user_id", ids);

    for (const uid of ids) {
      const pref = (prefRows ?? []).find(
        (r: PrefRow) => r.user_id === uid,
      ) as PrefRow | undefined;
      const tz = (members ?? []).find((m: { user_id: string; timezone?: string | null }) => m.user_id === uid)?.timezone;
      const localHour = hourIn(new Date(), tz);
      const okRemind = canNudge(pref, localHour, "remind"), okAqua = canNudge(pref, localHour, "aquarium");
      if (!okRemind && !okAqua) continue;

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
      const out: { title: string; body: string; url: string }[] = [];
      if (msg && okRemind) out.push({ ...msg, url: "./" });
      if (aquaMsg && okAqua) out.push({ ...aquaMsg, url: "./?go=aquarium" });
      if (!out.length) continue;

      const { data: subs } = await sb
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", uid);
      for (const m of out) {
      const { title, body: bodyMsg, url } = m;
      const native = await sendFcm(sb, [uid], { title, body: bodyMsg, url, category: "remind" });
      sent += native.sent;
      if (!subs?.length && !native.sent) continue;
      nudged++;
      if (url !== "./") aquaNudged++;

      // 수조 알림은 따로 쌓이게 태그를 단다(같은 태그면 크롬 · 안드로이드에서 앞의 알림을 갈아 끼운다)
      const payload = JSON.stringify({ title, body: bodyMsg, url, ...(url !== "./" ? { tag: "aquarium" } : {}) });
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
  }

  return new Response(
    JSON.stringify({ kstDate, kstHour, evening, nudged, aquaNudged, sent }),
    { headers: { "Content-Type": "application/json" } },
  );
});
