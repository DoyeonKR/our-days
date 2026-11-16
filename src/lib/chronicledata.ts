/* 우리 연대기 — 가져오기. 기록 › 추억에서 연대기를 펼칠 때만 받는 조각(OurChronicle 이 부른다).
 * DB 변경 없음 — 이미 있는 표 · RPC 만 읽는다. 무거운 훑기 대신 한 쪽(MONTHS_PER_PAGE 달)씩, 달마다 종류별 limit 1.
 *
 *   · 달 숫자: memory_month_stats(getMonthRecap) — 0 인 종류는 첫 기록을 묻지 않는다.
 *   · 첫 일기 · 첫 사진 · 첫 로그: deco_entries · couple_photos(shot_at, 휴지통 제외) · couple_logs 를 그 달 범위 · 오름차순 · limit 1.
 *   · 이룬 버킷: couple_bucket.done_at 이 이 쪽 범위 · 최신 순 · limit BUCKET_CAP.
 *   · 처음 한 번(맥락): couples.start_date · created_at, 가장 이른 사진 · 일기 1행씩(바닥 달), couple_events(기념일 · 일정 수),
 *     couple_island.state(주인 · 펫 소식 — getIsland 는 읽기만 한다), fish_catches(전설 이상 · 등급마다 1행, 본인 행만 보인다),
 *     merge_scores(본인 최고 기록). 게임 쪽은 실패해도 연대기를 막지 않는다(빈 목록).
 * 썸네일만 싣는다(thumb_paths · thumb_path · poster_path) — 서명은 signedPhotoUrls(캐시)로 한 쪽에 한 번. */
import { getSupabase } from "@/lib/supabase";
import { getIsland, getMonthRecap, listCoupleEvents, signedPhotoUrls } from "@/lib/couple";
import { dateInTimezone, kstMonthRange, type MonthlyRecap } from "@/lib/memories";
import type { CoupleEvent } from "@/lib/dday";
import {
  BUCKET_CAP,
  anniversaryItems,
  bucketItem,
  eventsHeldInYear,
  firstDiaryItem,
  firstLogItem,
  firstPhotoItem,
  fishItem,
  floorMonth,
  gameMilestones,
  itemsInMonths,
  mergeChronicle,
  mergeItem,
  relationshipMilestones,
  yearMonths,
  yearSummary,
  type ChronicleItem,
  type FirstFishRow,
  type IslandSlice,
  type YearSummary,
} from "@/lib/chronicle";

type PgErr = { code?: string; message?: string } | null;
type PgRes = { data: unknown; error: PgErr };
const missingColumn = (e: PgErr) => !!e && (e.code === "42703" || e.code === "PGRST204" || /column .* does not exist|could not find the .* column/i.test(e.message ?? ""));
const nextMonthFirst = (mk: string) => {
  const [y, m] = mk.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
};

export type ChronicleContext = {
  startDate: string | null;
  floor: string;
  events: CoupleEvent[];
  /** 날짜가 정해진 게임 · 우리 사이 항목(쪽마다 그 달 것만 꺼낸다) */
  known: ChronicleItem[];
  /** 올해의 우리 카드 — 처음 낚은 전설 이상(내 기록) */
  fish: ChronicleItem[];
};

/** 처음 한 번 — 바닥 달 · 일정 · 게임 항목. */
export async function loadChronicleContext(coupleId: string, todayIso: string, nameOf: (uid: string) => string): Promise<ChronicleContext> {
  const sb = getSupabase();
  const empty: ChronicleContext = { startDate: null, floor: todayIso.slice(0, 7), events: [], known: [], fish: [] };
  if (!sb) return empty;
  const [couple, firstDiary, firstPhoto, events] = await Promise.all([
    sb.from("couples").select("start_date,created_at").eq("id", coupleId).maybeSingle(),
    sb.from("deco_entries").select("entry_date").eq("couple_id", coupleId).order("entry_date").limit(1),
    earliestPhotoDay(coupleId),
    listCoupleEvents(coupleId).catch(() => [] as CoupleEvent[]),
  ]);
  if (couple.error) throw new Error(couple.error.message);
  const row = (couple.data ?? null) as { start_date: string | null; created_at: string } | null;
  const startDate = row?.start_date ?? null;
  const diaryDay = ((firstDiary.data ?? []) as { entry_date: string }[])[0]?.entry_date ?? null;
  const annivDays = events.map((e) => e.date);
  const floor = floorMonth(todayIso, [startDate, row?.created_at ? dateInTimezone(row.created_at) : null, diaryDay, firstPhoto, ...annivDays]);
  const [game, fish, merge] = await Promise.all([gameItems(coupleId, nameOf), firstFishItems(), mergeBest()]);
  const rel = relationshipMilestones(startDate, floor, todayIso.slice(0, 7), todayIso);
  return { startDate, floor, events, known: mergeChronicle(rel, game, fish, merge), fish };
}

async function earliestPhotoDay(coupleId: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  let r: PgRes = await sb.from("couple_photos").select("shot_at").eq("couple_id", coupleId).is("deleted_at", null).order("shot_at").limit(1);
  if (missingColumn(r.error)) r = await sb.from("couple_photos").select("created_at").eq("couple_id", coupleId).order("created_at").limit(1);
  const first = ((r.data ?? []) as { shot_at?: string; created_at?: string }[])[0];
  const at = first?.shot_at ?? first?.created_at;
  return at ? dateInTimezone(at) : null;
}

async function gameItems(coupleId: string, nameOf: (uid: string) => string): Promise<ChronicleItem[]> {
  try {
    const row = await getIsland(coupleId);
    return gameMilestones((row?.state ?? null) as IslandSlice | null, nameOf);
  } catch {
    return [];
  }
}

/** 전설 · 신화 · 태초를 처음 낚은 날 — 등급마다 1행(본인 행만 보인다 · 2026-11-02 부터 쌓인 표). */
async function firstFishItems(): Promise<ChronicleItem[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const rows = await Promise.all(
      [5, 6, 7].map((g) => sb.from("fish_catches").select("grade,name,stored,created_at").eq("grade", g).eq("junk", false).order("created_at").limit(1)),
    );
    return rows
      .flatMap((r) => (r.error ? [] : ((r.data ?? []) as FirstFishRow[])))
      .map((f) => fishItem(f, dateInTimezone(f.created_at)))
      .filter((x): x is ChronicleItem => !!x);
  } catch {
    return [];
  }
}

async function mergeBest(): Promise<ChronicleItem[]> {
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb.from("merge_scores").select("score,top_lv,best_at").limit(1);
    const row = (error ? null : ((data ?? []) as { score: number; top_lv: number; best_at: string }[])[0]) ?? null;
    const it = row?.best_at ? mergeItem(row, dateInTimezone(row.best_at)) : null;
    return it ? [it] : [];
  } catch {
    return [];
  }
}

export type ChroniclePage = { items: ChronicleItem[]; recaps: Record<string, MonthlyRecap> };

/** 한 쪽 — months 는 최신부터(monthsBack). 달 숫자 → 0 이 아닌 종류만 첫 기록. */
export async function loadChroniclePage(coupleId: string, months: readonly string[], ctx: ChronicleContext, todayIso: string): Promise<ChroniclePage> {
  const sb = getSupabase();
  const recaps: Record<string, MonthlyRecap> = {};
  if (!sb || months.length === 0) return { items: [], recaps };
  const stats = await Promise.all(months.map((m) => getMonthRecap(coupleId, m).catch(() => null)));
  months.forEach((m, i) => {
    const r = stats[i];
    if (r) recaps[m] = r;
  });
  const firsts = await Promise.all(
    months.flatMap((m) => {
      const r = recaps[m];
      // 숫자를 못 받은 달은 셋 다 묻는다(0 으로 지레짐작하지 않는다)
      return [
        !r || r.diaries > 0 ? firstDiaryOf(coupleId, m) : null,
        !r || r.photos > 0 ? firstPhotoOf(coupleId, m) : null,
        !r || r.logs > 0 ? firstLogOf(coupleId, m) : null,
      ];
    }),
  );
  const oldest = months[months.length - 1];
  const newest = months[0];
  const buckets = await doneBuckets(coupleId, `${oldest}-01`, nextMonthFirst(newest));
  const anniv = months.flatMap((m) => anniversaryItems(ctx.events, m, todayIso));
  const items = mergeChronicle(
    firsts.filter((x): x is ChronicleItem => !!x),
    anniv,
    buckets,
    itemsInMonths(ctx.known, months),
  );
  return { items, recaps };
}

async function firstDiaryOf(coupleId: string, mk: string): Promise<ChronicleItem | null> {
  const sb = getSupabase()!;
  const q = (cols: string) =>
    sb.from("deco_entries").select(cols).eq("couple_id", coupleId).gte("entry_date", `${mk}-01`).lt("entry_date", nextMonthFirst(mk)).order("entry_date").order("created_at").limit(1);
  let r = await q("id,entry_date,title,thumb_paths");
  if (missingColumn(r.error)) r = await q("id,entry_date,title");
  if (r.error) return null;
  const row = ((r.data ?? []) as unknown as Parameters<typeof firstDiaryItem>[0][])[0];
  return row ? firstDiaryItem(row) : null;
}

async function firstPhotoOf(coupleId: string, mk: string): Promise<ChronicleItem | null> {
  const sb = getSupabase()!;
  const [from, to] = kstMonthRange(mk);
  let r: PgRes = await sb
    .from("couple_photos")
    .select("id,thumb_path,shot_at,caption")
    .eq("couple_id", coupleId)
    .is("deleted_at", null)
    .gte("shot_at", from)
    .lt("shot_at", to)
    .order("shot_at")
    .limit(1);
  if (missingColumn(r.error)) {
    r = await sb.from("couple_photos").select("id,thumb_path,created_at").eq("couple_id", coupleId).gte("created_at", from).lt("created_at", to).order("created_at").limit(1);
  }
  if (r.error) return null;
  const row = ((r.data ?? []) as { id: string; thumb_path: string | null; shot_at?: string; created_at?: string; caption?: string | null }[])[0];
  const at = row?.shot_at ?? row?.created_at;
  return row && at ? firstPhotoItem({ id: row.id, thumb_path: row.thumb_path, shot: dateInTimezone(at), caption: row.caption }) : null;
}

async function firstLogOf(coupleId: string, mk: string): Promise<ChronicleItem | null> {
  const sb = getSupabase()!;
  const q = (cols: string) =>
    sb.from("couple_logs").select(cols).eq("couple_id", coupleId).gte("log_date", `${mk}-01`).lt("log_date", nextMonthFirst(mk)).order("log_date").order("created_at").limit(1);
  let r = await q("id,log_date,body,poster_path");
  if (missingColumn(r.error)) r = await q("id,log_date,body");
  if (r.error) return null;
  const row = ((r.data ?? []) as unknown as Parameters<typeof firstLogItem>[0][])[0];
  return row ? firstLogItem(row) : null;
}

async function doneBuckets(coupleId: string, fromDay: string, toDay: string): Promise<ChronicleItem[]> {
  const sb = getSupabase()!;
  // done_at 은 timestamptz — KST 하루 경계로 자른다(UTC 전날 15시)
  const kst = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 9 * 3_600_000).toISOString();
  const { data, error } = await sb
    .from("couple_bucket")
    .select("id,title,done_at")
    .eq("couple_id", coupleId)
    .eq("done", true)
    .gte("done_at", kst(fromDay))
    .lt("done_at", kst(toDay))
    .order("done_at", { ascending: false })
    .limit(BUCKET_CAP);
  if (error) return [];
  return ((data ?? []) as { id: string; title: string; done_at: string }[]).map((b) => bucketItem(b, dateInTimezone(b.done_at)));
}

/** 썸네일 경로 → 서명 주소(캐시). 실패하면 빈 맵 — 그림 없이 그린다. */
export async function signChronicleThumbs(items: readonly ChronicleItem[]): Promise<Record<string, string>> {
  const paths = [...new Set(items.map((i) => i.thumbPath).filter((p): p is string => !!p))];
  if (paths.length === 0) return {};
  return signedPhotoUrls(paths).catch(() => ({}));
}

/** 올해의 우리 — 그 해 달 숫자(많아야 12번 · 서버 집계) · 일정 회차 · 이룬 버킷 수 · 우리 사이 · 처음 낚은 전설. */
export async function loadYearSummary(coupleId: string, year: number, todayIso: string, ctx: ChronicleContext): Promise<YearSummary> {
  const sb = getSupabase();
  const months = yearMonths(year, todayIso, ctx.floor);
  const recaps = (await Promise.all(months.map((m) => getMonthRecap(coupleId, m).catch(() => null)))).filter((r): r is MonthlyRecap => !!r);
  let bucketsDone = 0;
  if (sb) {
    const kst = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 9 * 3_600_000).toISOString();
    const { count } = await sb
      .from("couple_bucket")
      .select("id", { count: "exact", head: true })
      .eq("couple_id", coupleId)
      .eq("done", true)
      .gte("done_at", kst(`${year}-01-01`))
      .lt("done_at", kst(`${year + 1}-01-01`));
    bucketsDone = count ?? 0;
  }
  const yk = String(year);
  const rel = relationshipMilestones(ctx.startDate, `${yk}-01`, `${yk}-12`, todayIso);
  const firstFish = [...ctx.fish].filter((f) => f.date.startsWith(yk)).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  return yearSummary({ year, months: recaps, events: eventsHeldInYear(ctx.events, year, todayIso), relationship: rel, bucketsDone, firstFish });
}
