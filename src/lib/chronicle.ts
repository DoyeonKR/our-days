/* 우리 연대기 — 기록 › 추억 아래, 처음부터 지금까지를 한 줄로 [2026-11-13 사용자 승인 "우리 연대기"]
 *
 * 순수 함수만 둔다(가져오기는 lib/chronicledata, 그리기는 components/OurChronicle). node --test 가 이 파일을 읽는다 —
 * 값 import 는 상대 경로 + .ts 만(tsimports.test).
 *
 * 무엇을 싣나(최신 순, 달 머리 아래):
 *   · 우리 사이 — 시작한 날 · 100일 단위 · N주년(lib/dday 의 dayCountToDate · anniversaryDate). 오늘 이후는 싣지 않는다.
 *   · 그 달의 첫 일기 · 첫 사진 · 첫 로그 — 한 달에 종류마다 한 줄(서버에서 limit 1 로 받는다).
 *   · 기념일로 표시한 일정(couple_events.category = anniversary) — 그 달의 회차(건너뛴 회차는 빼고).
 *   · 이룬 버킷(done_at).
 *   · 게임 — 저장에 날짜가 **있는 것만**:
 *       주인 토벌(BossRecord.last.day — 한 번 잡았으면 그날, 여러 번이면 '첫 토벌은 마지막 토벌 날 이전'으로 위 경계만),
 *       처음 낚은 전설 · 신화 · 태초(fish_catches.created_at — 표의 RLS 가 본인 행만 보여 준다: '내가'),
 *       합치기 최고 기록(merge_scores.best_at — 본인),
 *       펫 진화(섬 소식 s.feed 의 진화 줄 — 최근 30줄 안에 남은 것만).
 *     날짜도 경계도 없는 것(수조 단계 · 모험 지역 · 박물관)은 싣지 않는다 — 날짜를 지어내지 않는다.
 */
import type { AppRoute } from "./activity.ts";
import type { CoupleEvent } from "./dday.ts";
import type { MonthlyRecap } from "./memories.ts";
import { anniversaryDate, dayCountToDate, eventDaysInMonth, isAnniversary, parseDate, toISODate } from "./dday.ts";
import { shiftedMonthKey } from "./memories.ts";
import { josa } from "./josa.ts";
import { BOSS_RETURN_DAYS, addDays, bossOf, type BossRecord } from "./fishingworld.ts";

/** components/Icon 의 이름 중 연대기가 쓰는 것(값은 Icon 이 그린다 — UI 크롬에 이모지 없음) */
export type ChronicleIcon = "heart" | "calendar" | "target" | "book" | "image" | "play" | "star" | "gamepad" | "sparkles" | "flame";

export type ChronicleKind =
  | "start"
  | "days"
  | "years"
  | "diary"
  | "photo"
  | "log"
  | "anniv"
  | "bucket"
  | "boss"
  | "fish"
  | "merge"
  | "pet";

export type ChronicleItem = {
  key: string;
  kind: ChronicleKind;
  /** 'YYYY-MM-DD'(KST). approx = "before" 이면 '이 날 또는 그 전' — 정확한 날이 저장돼 있지 않고 위 경계만 안다 */
  date: string;
  approx?: "before";
  title: string;
  sub?: string;
  icon: ChronicleIcon;
  /** 썸네일 경로(480px · 첫 장면) — 원본은 싣지 않는다. 서명은 화면이 한 번에 */
  thumbPath?: string | null;
  route: AppRoute;
};

export type ChronicleMonth = { monthKey: string; items: ChronicleItem[] };

/** 한 번에 받는 달 수 · 한 쪽에서 받는 버킷 상한 · 거슬러 올라가는 최대 달 수 */
export const MONTHS_PER_PAGE = 3;
export const BUCKET_CAP = 30;
export const MAX_MONTHS_BACK = 240;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const monthOf = (date: string) => date.slice(0, 7);

/* ── 달 넘기기 ─────────────────────────────────────────── */

/** from 달부터 거꾸로 count 달(바닥 달 floor 아래로는 안 간다). 예: ("2026-02", 3, "2025-01") → 2026-02, 2026-01, 2025-12 */
export function monthsBack(from: string, count: number, floor: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = shiftedMonthKey(`${from}-01`, -i);
    if (m < floor) break;
    out.push(m);
  }
  return out;
}

/** 거슬러 올라갈 바닥 달 — 알고 있는 가장 이른 날의 달. 아무것도 모르면 오늘 달. 오늘에서 MAX_MONTHS_BACK 달 위로는 안 간다. */
/** 맨 아래가 보여도 저절로 다음 쪽을 받는 것은 빈 쪽이 이만큼 이어질 때까지 — 그 뒤는 '더 지난 달 보기' 버튼으로만.
 *  (기록 없는 달이 길게 이어지면 센티널이 계속 보여 손대지 않아도 쪽을 이어 받았다.) */
export const AUTO_EMPTY_PAGES = 2;
export function shouldAutoLoad(emptyStreak: number): boolean {
  return emptyStreak < AUTO_EMPTY_PAGES;
}

export function floorMonth(todayIso: string, dates: readonly (string | null | undefined)[]): string {
  const known = dates.filter((d): d is string => !!d && ISO_DAY.test(d.slice(0, 10))).map((d) => d.slice(0, 7));
  const earliest = known.length ? known.reduce((a, b) => (a < b ? a : b)) : monthOf(todayIso);
  const cap = shiftedMonthKey(todayIso, -MAX_MONTHS_BACK);
  return earliest < cap ? cap : earliest > monthOf(todayIso) ? monthOf(todayIso) : earliest;
}

/* ── 우리 사이(시작 · 100일 · 주년) ─────────────────────── */

/** 시작한 날 · 100일 단위 · N주년 중 [from, to] 안이고 오늘까지인 것. from/to 는 'YYYY-MM' 달(양 끝 포함). */
export function relationshipMilestones(startIso: string | null, fromMonth: string, toMonth: string, todayIso: string): ChronicleItem[] {
  if (!startIso || !ISO_DAY.test(startIso)) return [];
  const start = parseDate(startIso);
  const inRange = (iso: string) => iso <= todayIso && monthOf(iso) >= fromMonth && monthOf(iso) <= toMonth;
  const route: AppRoute = { view: "plan", sub: "cal" };
  const out: ChronicleItem[] = [];
  if (inRange(startIso)) out.push({ key: "rel:start", kind: "start", date: startIso, title: "우리가 시작한 날", sub: "1일째", icon: "heart", route });
  for (let n = 100; ; n += 100) {
    const iso = toISODate(dayCountToDate(start, n));
    if (iso > todayIso || monthOf(iso) > toMonth) break;
    if (inRange(iso)) out.push({ key: `rel:d${n}`, kind: "days", date: iso, title: `함께한 지 ${n.toLocaleString("ko-KR")}일`, icon: "heart", route });
  }
  for (let k = 1; ; k++) {
    const iso = toISODate(anniversaryDate(start, k));
    if (iso > todayIso || monthOf(iso) > toMonth) break;
    if (inRange(iso)) out.push({ key: `rel:y${k}`, kind: "years", date: iso, title: `${k}주년`, sub: "함께한 해", icon: "sparkles", route });
  }
  return out;
}

/* ── 기념일 일정 ──────────────────────────────────────── */

/** 기념일로 표시한 일정의 그 달 회차(첫날만 · 오늘까지). 반복 일정은 달마다 한 줄. */
export function anniversaryItems(events: readonly CoupleEvent[], monthKey: string, todayIso: string): ChronicleItem[] {
  const [y, m] = monthKey.split("-").map(Number);
  const out: ChronicleItem[] = [];
  for (const ev of events) {
    if (!isAnniversary(ev) || !ISO_DAY.test(ev.date)) continue;
    for (const d of eventDaysInMonth(ev, y, m - 1)) {
      if (!d.first) continue;
      const iso = `${monthKey}-${String(d.day).padStart(2, "0")}`;
      if (iso > todayIso) continue;
      out.push({ key: `anniv:${ev.id}:${iso}`, kind: "anniv", date: iso, title: ev.title.trim() || "기념일", sub: "기념일", icon: "calendar", route: { view: "plan", sub: "cal", focus: ev.id } });
    }
  }
  return out;
}

/** 이 해(1~12월)에 있었던 일정 회차 수(오늘까지 · 첫날만) — 올해의 우리 카드의 '함께한 일정'. */
export function eventsHeldInYear(events: readonly CoupleEvent[], year: number, todayIso: string): number {
  let n = 0;
  for (let mi = 0; mi < 12; mi++) {
    const mk = `${year}-${String(mi + 1).padStart(2, "0")}`;
    if (mk > monthOf(todayIso)) break;
    for (const ev of events) {
      if (!ISO_DAY.test(ev.date)) continue;
      for (const d of eventDaysInMonth(ev, year, mi)) if (d.first && `${mk}-${String(d.day).padStart(2, "0")}` <= todayIso) n++;
    }
  }
  return n;
}

/* ── 그 달의 첫 기록 · 버킷 ───────────────────────────── */

export type FirstDiaryRow = { id: string; entry_date: string; title: string | null; thumb_paths?: (string | null)[] | null };
export type FirstPhotoRow = { id: string; thumb_path: string | null; shot: string; caption?: string | null };
export type FirstLogRow = { id: string; log_date: string; body: string | null; poster_path?: string | null };
export type DoneBucketRow = { id: string; title: string; done_at: string };

export function firstDiaryItem(row: FirstDiaryRow): ChronicleItem {
  return {
    key: `diary:${row.id}`,
    kind: "diary",
    date: row.entry_date,
    title: "이 달의 첫 일기",
    sub: row.title?.trim() || undefined,
    icon: "book",
    // 썸네일만 — 없으면(옛 일기) 그림 없이
    thumbPath: row.thumb_paths?.find((p): p is string => !!p) ?? null,
    route: { view: "diary", focus: row.id },
  };
}

/** shot = 찍은 날(KST 'YYYY-MM-DD') — 화면이 shot_at(없으면 올린 시각)을 KST 날짜로 바꿔 넘긴다. */
export function firstPhotoItem(row: FirstPhotoRow): ChronicleItem {
  return {
    key: `photo:${row.id}`,
    kind: "photo",
    date: row.shot,
    title: "이 달의 첫 사진",
    sub: row.caption?.trim() || undefined,
    icon: "image",
    thumbPath: row.thumb_path,
    route: { view: "records", sub: "photos", focus: row.id },
  };
}

export function firstLogItem(row: FirstLogRow): ChronicleItem {
  return {
    key: `log:${row.id}`,
    kind: "log",
    date: row.log_date,
    title: "이 달의 첫 로그",
    sub: row.body?.trim() || undefined,
    icon: "play",
    thumbPath: row.poster_path ?? null,
    route: { view: "records", sub: "log" },
  };
}

/** done_at 은 timestamptz — 이룬 날은 KST 날짜(화면이 바꿔 넘긴다: doneDay). */
export function bucketItem(row: DoneBucketRow, doneDay: string): ChronicleItem {
  return { key: `bucket:${row.id}`, kind: "bucket", date: doneDay, title: row.title.trim() || "버킷 하나", sub: "버킷을 이뤘어요", icon: "target", route: { view: "plan", sub: "bucket" } };
}

/* ── 게임(저장에 날짜가 있는 것만) ─────────────────────── */

/** 섬 상태에서 연대기가 읽는 칸만 — 엔진(lib/island)을 부르지 않는다. 모양이 어긋나도 던지지 않는다. */
export type IslandSlice = {
  fishing?: { bosses?: Record<string, Partial<BossRecord> | undefined> } | null;
  fishPlus?: Record<string, unknown> | null;
  feed?: unknown;
};

/** 주인 하나의 토벌 — 날짜가 있거나 위 경계를 아는 것만. 첫 토벌을 말한다.
 *  · 한 번 잡았고 last.day 가 있다 → 그날(정확).
 *  · 여러 번 잡았다 → 첫 토벌 ≤ 마지막 토벌(last.day). 경계만('이 날 이전').
 *    ⚠ '다시 나오기까지 7일'로 더 당기지 않는다 — 동시 토벌이 잡은 수를 한 날에 +2 하던 때(§10.24 전)와 기기 날짜를
 *    되돌려 재출현을 연 저장(§10.25 전)이 있어, 7 × (잡은 수 − 1) 을 빼면 실제 첫 토벌보다 앞선 날을 말할 수 있다.
 *  · last 가 없는 옛 기록 → until − BOSS_RETURN_DAYS(= 마지막 토벌 때의 at, 그날 이후) 가 위 경계.
 *  · 그 밖(날짜를 못 읽는다) → 싣지 않는다. */
export function bossFirstDefeat(rec: Partial<BossRecord> | undefined): { date: string; approx?: "before" } | null {
  const caught = Math.floor(Number(rec?.caught) || 0);
  if (!rec || caught <= 0) return null;
  const last = typeof rec.last?.day === "string" && ISO_DAY.test(rec.last.day) ? rec.last.day : null;
  if (last) return caught === 1 ? { date: last } : { date: last, approx: "before" };
  if (typeof rec.until === "string" && ISO_DAY.test(rec.until)) return { date: addDays(rec.until, -BOSS_RETURN_DAYS), approx: "before" };
  return null;
}

/** 섬 소식의 진화 줄 — island.ts evolve() 의 pushLog 문구와 같아야 한다(chronicle.test 가 맞춰 본다). */
export const EVOLVE_LINE = /\s([^\s→][^→]*?)\(으\)로 진화했어요/;

export function gameMilestones(state: IslandSlice | null | undefined, nameOf: (uid: string) => string): ChronicleItem[] {
  if (!state || typeof state !== "object") return [];
  const out: ChronicleItem[] = [];
  const fishing: AppRoute = { view: "game", open: "fishing" };
  const bossRecs: [string, Partial<BossRecord> | undefined][] = [
    ...Object.entries(state.fishing?.bosses ?? {}),
    ...Object.entries((state.fishPlus?.awake ?? {}) as Record<string, Partial<BossRecord> | undefined>),
  ];
  for (const [key, rec] of bossRecs) {
    const boss = bossOf(key);
    const when = boss ? bossFirstDefeat(rec) : null;
    if (!boss || !when) continue;
    const caught = Math.floor(Number(rec?.caught) || 0);
    out.push({
      key: `boss:${key}`,
      kind: "boss",
      date: when.date,
      ...(when.approx ? { approx: when.approx } : {}),
      title: `${josa(boss.name, "을/를")} 처음 잡았어요`,
      sub: caught > 1 ? `지금까지 ${caught}번 토벌` : "낚시터의 주인",
      icon: "flame",
      route: fishing,
    });
  }
  const feed = Array.isArray(state.feed) ? state.feed : [];
  for (const f of feed) {
    const e = f as { at?: unknown; by?: unknown; msg?: unknown };
    if (typeof e?.at !== "number" || !Number.isFinite(e.at) || typeof e.msg !== "string") continue;
    const m = EVOLVE_LINE.exec(e.msg);
    if (!m) continue;
    const date = new Date(e.at + 9 * 3_600_000).toISOString().slice(0, 10);
    out.push({
      key: `pet:${e.at}`,
      kind: "pet",
      date,
      title: `펫이 ${josa(m[1].trim(), "으로/로")} 진화했어요`,
      sub: typeof e.by === "string" && e.by ? `${nameOf(e.by)}의 돌봄으로` : undefined,
      icon: "sparkles",
      route: { view: "game", open: "island" },
    });
  }
  return out;
}

export const FISH_GRADE_NAME: Readonly<Record<number, string>> = { 5: "전설", 6: "신화", 7: "태초" };
export type FirstFishRow = { grade: number; name: string; stored: boolean; created_at: string };

/** 처음 낚은 전설 · 신화 · 태초(내 기록 — fish_catches 는 본인 행만 읽힌다). day = created_at 의 KST 날짜. */
export function fishItem(row: FirstFishRow, day: string): ChronicleItem | null {
  const grade = FISH_GRADE_NAME[row.grade];
  if (!grade || !ISO_DAY.test(day)) return null;
  return {
    key: `fish:${row.grade}`,
    kind: "fish",
    date: day,
    title: `내가 처음 낚은 ${grade} 물고기`,
    sub: `${row.name}${row.stored ? " · 수조에 담았어요" : ""}`,
    icon: "star",
    route: { view: "game", open: "fishing" },
  };
}

export type MergeBestRow = { score: number; top_lv: number; best_at: string };
export function mergeItem(row: MergeBestRow, day: string): ChronicleItem | null {
  if (!(row.score > 0) || !ISO_DAY.test(day)) return null;
  return { key: "merge:best", kind: "merge", date: day, title: `정원 합치기 최고 기록 ${row.score.toLocaleString("ko-KR")}점`, sub: "내 기록", icon: "gamepad", route: { view: "game", open: "merge" } };
}

/* ── 합치기 · 정렬 · 묶기 ─────────────────────────────── */

/** 같은 날 안에서의 순서 — 우리 사이 > 기념일 > 기록 > 버킷 > 게임 */
const KIND_ORDER: Record<ChronicleKind, number> = { start: 0, years: 1, days: 2, anniv: 3, diary: 4, photo: 5, log: 6, bucket: 7, boss: 8, fish: 9, merge: 10, pet: 11 };

/** 최신 순으로 합친다. 같은 key 는 하나만(뒤에 온 쪽을 버린다). 경계만 아는 항목은 같은 날의 정확한 항목 뒤에. */
export function mergeChronicle(...lists: readonly (readonly ChronicleItem[])[]): ChronicleItem[] {
  const seen = new Set<string>();
  const all: ChronicleItem[] = [];
  for (const list of lists) for (const it of list) {
    if (seen.has(it.key) || !ISO_DAY.test(it.date)) continue;
    seen.add(it.key);
    all.push(it);
  }
  return all.sort(
    (a, b) => b.date.localeCompare(a.date) || (a.approx ? 1 : 0) - (b.approx ? 1 : 0) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.key.localeCompare(b.key),
  );
}

/** 달 머리로 묶는다(최신 달부터). 빈 달은 안 만든다. */
export function groupByMonth(items: readonly ChronicleItem[]): ChronicleMonth[] {
  const by = new Map<string, ChronicleItem[]>();
  for (const it of items) {
    const mk = monthOf(it.date);
    const list = by.get(mk);
    if (list) list.push(it);
    else by.set(mk, [it]);
  }
  return [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([monthKey, list]) => ({ monthKey, items: mergeChronicle(list) }));
}

/** 이미 받은 쪽에 새 쪽을 붙인다 — 같은 달이 두 쪽에 걸치면 한 머리로 합친다. */
export function appendMonths(prev: readonly ChronicleMonth[], next: readonly ChronicleMonth[]): ChronicleMonth[] {
  return groupByMonth([...prev.flatMap((m) => m.items), ...next.flatMap((m) => m.items)]);
}

/** 미리 다 아는 항목(게임 · 우리 사이)에서 이 쪽 달들에 드는 것만. */
export function itemsInMonths(items: readonly ChronicleItem[], months: readonly string[]): ChronicleItem[] {
  const set = new Set(months);
  return items.filter((it) => set.has(monthOf(it.date)));
}

/** "11월 3일" · 경계만 알면 "11월 3일 이전" */
export function chronicleDateLabel(it: Pick<ChronicleItem, "date" | "approx">): string {
  const label = `${Number(it.date.slice(5, 7))}월 ${Number(it.date.slice(8, 10))}일`;
  return it.approx === "before" ? `${label} 이전` : label;
}

/** 달 머리 — "2026년 11월" · 그 달 숫자(서버 집계)가 있으면 한 줄 덧붙인다. */
export function monthHeadLabel(monthKey: string): string {
  return `${monthKey.slice(0, 4)}년 ${Number(monthKey.slice(5, 7))}월`;
}
export function monthCountsLine(recap: Pick<MonthlyRecap, "diaries" | "photos" | "logs"> | null | undefined): string {
  if (!recap) return "";
  const parts = ([["일기", recap.diaries], ["사진", recap.photos], ["로그", recap.logs]] as const).filter(([, n]) => n > 0).map(([l, n]) => `${l} ${n}`);
  return parts.join(" · ");
}

/* ── 올해의 우리 ──────────────────────────────────────── */

export type YearSummary = {
  year: number;
  diaries: number;
  photos: number;
  logs: number;
  events: number;
  activeDays: number;
  total: number;
  /** 카드 · 화면에 싣는 줄(많아야 YEAR_MOMENTS_MAX) */
  moments: string[];
};
export const YEAR_MOMENTS_MAX = 4;

/** 한 해 요약 — months = 그 해 달들의 서버 집계(없는 달은 빼고 넘긴다). 줄은 지어내지 않고 있는 것만 말한다. */
export function yearSummary(input: {
  year: number;
  months: readonly MonthlyRecap[];
  events: number;
  relationship: readonly ChronicleItem[];
  bucketsDone: number;
  firstFish: ChronicleItem | null;
}): YearSummary {
  const sum = (k: "diaries" | "photos" | "logs" | "activeDays" | "total") => input.months.reduce((n, r) => n + (r[k] || 0), 0);
  const moments: string[] = [];
  const rel = [...input.relationship].sort((a, b) => b.date.localeCompare(a.date));
  const big = rel.find((r) => r.kind === "years") ?? rel.find((r) => r.kind === "days") ?? rel.find((r) => r.kind === "start");
  if (big) moments.push(`${chronicleDateLabel(big)} · ${big.title}`);
  const best = [...input.months].filter((r) => r.total > 0).sort((a, b) => b.total - a.total || a.monthKey.localeCompare(b.monthKey))[0];
  if (best) moments.push(`가장 많이 남긴 달 · ${Number(best.monthKey.slice(5, 7))}월 ${best.total}개`);
  if (input.bucketsDone > 0) moments.push(`함께 이룬 버킷 ${input.bucketsDone}개`);
  if (input.firstFish) moments.push(`${chronicleDateLabel(input.firstFish)} · ${input.firstFish.title}`);
  return {
    year: input.year,
    diaries: sum("diaries"),
    photos: sum("photos"),
    logs: sum("logs"),
    events: input.events,
    activeDays: sum("activeDays"),
    total: sum("total"),
    moments: moments.slice(0, YEAR_MOMENTS_MAX),
  };
}

/** 이 해에 고를 수 있는 달(1월 ~ 오늘 달 / 12월). 바닥 달 앞은 뺀다. */
export function yearMonths(year: number, todayIso: string, floor: string): string[] {
  const out: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const mk = `${year}-${String(m).padStart(2, "0")}`;
    if (mk > monthOf(todayIso)) break;
    if (mk >= floor) out.push(mk);
  }
  return out;
}
