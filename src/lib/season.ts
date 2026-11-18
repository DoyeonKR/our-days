/* 시즌 미션 (2026-11-13) — [사용자 승인: "시즌 미션"] 한 달(KST 달력 달)마다 커플이 함께 채우는 미션 12개.
 *
 * 저장은 섬 맨 위 칸 s.season 하나 — s.fishing · s.aquarium · s.aquaPlus 안에 두면 옛 앱이 아는 칸만 다시 지어 지운다.
 * 맨 위 칸은 옛 앱도 ...st 로 그대로 흘려보낸다(fishPlus · logStreak 와 같은 이유). DB 변경 없음.
 *
 *   m      — 이 기록이 쌓이는 달 "YYYY-MM". 지금 달이 더 뒤면 새 달로 비운다(날짜는 앞으로만 — §10.25).
 *            저장된 달이 지금보다 뒤면(시계가 빨랐던 폰) 그 달에 계속 쌓는다.
 *   n      — 함께 세는 수(낚아 올림 · 토벌 · 바나나킥 · 알 · 물갈이 · 손님 · 먹이 · 합치기 판 · 수확 · 진화)와
 *            이번 달 최고값(합치기 한 판 점수 · 단계)
 *   kinds  — 이번 달 낚은 서로 다른 물고기 계열(상한 KINDS_MAX — 목표만큼만 있으면 된다)
 *   (모험은 2026-11-15 앱에서 걷었다 — 모험 미션도 뺐다. 옛 기록의 adv 칸은 읽지 않고 그대로 흘려보낸다)
 *   got    — 이번 달 받은 단계(1 · 2 · 3) — 한 커플이 한 달에 한 번씩
 *   titles — 다 채운 달의 칭호(최근 TITLES_MAX 개)
 *   prev   — (2026-11-18) 달을 넘길 때 지난 달의 { m, done, got } 를 남긴다 — 다음 달 첫 7일(KST) 동안 못 받은 단계를 받게.
 *            진행 칸(n · kinds)은 그대로 비운다. 넘긴 뒤엔 지난 달 수를 다시 셀 수 없으니 넘기는 순간의 채운 미션 수를 적어 둔다.
 *
 * 펫 칭호(2026-11-18)는 새 최상위 칸 s.petTitle = { list: [{m, t, at}], on? } — 단계(t 1 · 2 · 3)를 받을 때 그 달 칭호가 오른다.
 *   on: 달고 있는 달("YYYY-MM") · ""(숨김) · 없음(가장 최근 달). s.season 안에 안 둔 이유: 고른 칭호는 달이 바뀌어도 남아야 하고,
 *   옛 앱의 달 넘김이 s.season 을 다시 쓰므로 거기 둔 새 칸이 살아남는지는 옛 앱 코드에 달린다 — 최상위 칸은 옛 앱도 ...st 로 흘린다.
 *
 * ⚠ 이 파일은 가볍게 — 런타임 import 는 lib/kst 하나다(게임 허브 · 홈이 부른다, firstload.test).
 *   엔진(island · fishing · aquarium · merge)은 이 파일을 불러 자기 동작이 끝난 상태에 수를 더한다. 거꾸로 부르지 않는다.
 * ⚠ 쓰기는 저장된 그대로의 값에서 바꿀 칸만 고친다 — 다음 버전이 더한 칸을 이 번들이 지우지 않게(fishlooks 의 writeLooks 와 같은 규칙). */
import { kstDate } from "./kst.ts";

export type SeasonGame = "fish" | "aqua" | "merge" | "island";
/** 함께 세는 수 */
export type CountStat = "landed" | "boss" | "kick" | "hatch" | "water" | "guest" | "feed" | "mergeGames" | "harvest" | "evolve";
/** 이번 달 최고값 */
export type MaxStat = "mergeScore" | "mergeTop";
export type SeasonStat = CountStat | MaxStat | "kinds";

export type Mission = { id: string; game: SeasonGame; stat: SeasonStat; goal: number; label: string };

export const GAME_NAME: Readonly<Record<SeasonGame, string>> = { fish: "낚시", aqua: "수조", merge: "합치기", island: "섬" };

/** 미션 풀 — 달마다 게임별 몫(SEASON_QUOTA)만큼 뽑는다. 줄을 더해도 이미 뽑힌 달의 다른 미션이 흔들리지 않게 미션마다 따로 해시로 줄 세운다. */
export const MISSION_POOL: readonly Mission[] = [
  { id: "fish_kinds", game: "fish", stat: "kinds", goal: 15, label: "서로 다른 물고기 15종 낚기" },
  { id: "fish_landed", game: "fish", stat: "landed", goal: 40, label: "물고기 40마리 끌어올리기" },
  { id: "fish_boss", game: "fish", stat: "boss", goal: 1, label: "낚시터 주인 1번 토벌하기" },
  { id: "fish_kick", game: "fish", stat: "kick", goal: 10, label: "바나나킥 10번 던지기" },
  { id: "aqua_hatch", game: "aqua", stat: "hatch", goal: 1, label: "수조 알에서 치어 1마리 태어나기" },
  { id: "aqua_water", game: "aqua", stat: "water", goal: 5, label: "수조 물갈이 5번 하기" },
  { id: "aqua_guest", game: "aqua", stat: "guest", goal: 3, label: "수조 손님 부탁 3번 들어주기" },
  { id: "aqua_feed", game: "aqua", stat: "feed", goal: 10, label: "수조 먹이 10번 주기" },
  { id: "merge_score", game: "merge", stat: "mergeScore", goal: 20000, label: "합치기 한 판 2만 점 넘기기" },
  { id: "merge_top", game: "merge", stat: "mergeTop", goal: 8, label: "합치기 8단계 재료 만들기" },
  { id: "merge_games", game: "merge", stat: "mergeGames", goal: 5, label: "합치기 5판 끝내기" },
  { id: "island_harvest", game: "island", stat: "harvest", goal: 30, label: "섬 밭 30번 수확하기" },
  { id: "island_evolve", game: "island", stat: "evolve", goal: 1, label: "펫 1번 진화시키기" },
];
/** 게임마다 몇 개 — 합이 12. 섬은 풀이 둘이라 늘 둘 다. 낚시는 넷 다(모험 몫 둘을 낚시 · 합치기로 — 2026-11-15 모험을 걷었다) */
export const SEASON_QUOTA: Readonly<Record<SeasonGame, number>> = { fish: 4, aqua: 3, merge: 3, island: 2 };
export const GAME_ORDER: readonly SeasonGame[] = ["fish", "aqua", "merge", "island"];
/** 단계 — 미션을 이만큼 채우면 그 단계 보상(1: 수조 장식 · 2: 시즌 찌 · 3: 펫 칭호). 하트는 없다(§10.25 경제 표를 건드리지 않는다) */
export const TIERS: readonly number[] = [4, 8, 12];
export type TierReward = "decor" | "bobber" | "title";
export const TIER_REWARD: readonly TierReward[] = ["decor", "bobber", "title"];
/** 1단계 수조 장식 — 이미 있는 장식만(옛 앱 · 3D 모델 · 그림이 다 아는 것). 달마다 하나. 하트로 되파는 길이 없어 하트가 생기지 않는다 */
export const SEASON_DECOR: readonly string[] = ["heart_bubbler", "mailbox", "sand_castle", "windmill", "pearl_clam", "diver"];
/** 2단계 시즌 찌(fishlooks 의 LIMITED_LOOKS) — 이미 가졌으면 그 달 장식을 하나 더 */
export const SEASON_BOBBER = "bob_season";
/** 지난 달 못 받은 보상 — 다음 달 1~7일(KST)에만, 단계마다 한 번. 채운 만큼만(새 보상을 만들지 않는다) */
export const MISSED_DAYS = 7;
/** 한 달 미션 수 — 서버 submit_season 의 상한(1~12)과 같아야 한다(seasonboard.test 가 견준다) */
export const MISSION_COUNT = 12;

export const KINDS_MAX = 30;
export const TITLES_MAX = 12;
const STAT_CAP = 1e9;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(STAT_CAP, Math.floor(v))) : 0);
export const isMonth = (v: unknown): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
/** KST 달 "YYYY-MM" */
export const monthOf = (now: number) => kstDate(now).slice(0, 7);
/** 받은 시각 · 날짜("YYYY-MM-DD") · 달을 달로 */
const monthAt = (at: number | string) => (typeof at === "number" ? monthOf(at) : at.slice(0, 7));

/** 그 달의 남은 날 — 오늘을 넣는다(마지막 날이면 1). 날짜 문자열로만 센다(기기 시간대와 상관없다) */
export function daysLeft(now: number): number {
  const d = kstDate(now);
  const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)), day = Number(d.slice(8, 10));
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return last - day + 1;
}

/** 32비트 FNV-1a — 두 폰이 같은 값을 낸다 */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 이 달의 미션 12개 — 달(seed)만 보고 정한다. 섬 상태 · 레벨을 안 보니 두 폰 · 한 달 내내 같다. 풀 순서대로 돌려준다 */
export function missionsFor(month: string): Mission[] {
  const out: Mission[] = [];
  for (const g of GAME_ORDER) {
    const pool = MISSION_POOL.filter((x) => x.game === g);
    const keep = new Set([...pool].sort((a, b) => hash(`season:${month}:${a.id}`) - hash(`season:${month}:${b.id}`) || (a.id < b.id ? -1 : 1)).slice(0, SEASON_QUOTA[g]).map((x) => x.id));
    out.push(...pool.filter((x) => keep.has(x.id)));
  }
  return out;
}

export const seasonDecorFor = (month: string) => SEASON_DECOR[hash(`decor:${month}`) % SEASON_DECOR.length];
/** 칭호 글 — "11월 시즌 완주" */
export const titleText = (month: string) => `${Number(month.slice(5, 7))}월 시즌 완주`;
/** 단계별 칭호 — 1 · 2 · 3단계(미션 4 · 8 · 12개). 3단계는 옛 칭호 글 그대로(옛 앱 · 카드가 같은 글을 보인다) */
const TIER_TITLE = ["시즌 새싹", "시즌 열매"] as const;
export const tierTitleText = (month: string, t: number) => (t >= 3 ? titleText(month) : `${Number(month.slice(5, 7))}월 ${TIER_TITLE[Math.max(0, t - 1)]}`);
/** 바로 앞 달 "YYYY-MM" */
export function prevMonth(month: string): string {
  const y = Number(month.slice(0, 4)), m = Number(month.slice(5, 7));
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export type SeasonTitle = { m: string; who: string; at: number };
export type SeasonView = {
  month: string;
  n: Partial<Record<CountStat | MaxStat, number>>;
  kinds: string[];
  got: number[];
  titles: SeasonTitle[];
};

type Seasoned = { season?: unknown };
const rawOf = (st: object): Record<string, unknown> => {
  const v = (st as Seasoned).season;
  return isObj(v) ? v : {};
};
const storedMonth = (raw: Record<string, unknown>) => (isMonth(raw.m) ? raw.m : "");

function readTitles(v: unknown): SeasonTitle[] {
  if (!Array.isArray(v)) return [];
  return v.filter((t): t is SeasonTitle => isObj(t) && isMonth(t.m) && typeof t.who === "string").map((t) => ({ m: t.m, who: t.who, at: num(t.at) }));
}

/** 지금 보이는 달 — 지금 달과 저장된 달 중 늦은 쪽(날짜는 앞으로만) */
export function activeMonth(st: object, now: number): string {
  const m = monthOf(now), s = storedMonth(rawOf(st));
  return s > m ? s : m;
}

/** 읽기 — 그 달의 기록이 아니면 빈 진행(칭호는 늘 남는다). 모르는 값 · 잘못된 모양은 버린다 */
export function seasonOf(st: object, month: string): SeasonView {
  const raw = rawOf(st);
  const titles = readTitles(raw.titles);
  if (storedMonth(raw) !== month) return { month, n: {}, kinds: [], got: [], titles };
  const n: SeasonView["n"] = {};
  if (isObj(raw.n)) for (const [k, v] of Object.entries(raw.n)) if (num(v) > 0) n[k as CountStat] = num(v);
  const kinds = Array.isArray(raw.kinds) ? [...new Set(raw.kinds.filter((x): x is string => typeof x === "string"))].slice(0, KINDS_MAX) : [];
  const got = readGot(raw.got);
  return { month, n, kinds, got, titles };
}

/** 그 달 기록에서 채운 미션 수 */
const doneIn = (v: SeasonView) => missionsFor(v.month).filter((ms) => missionValue(v, ms) >= ms.goal).length;

/** 쓰기 대상 — at 의 달과 저장된 달 중 늦은 쪽. 새 달이면 진행 칸을 비운다(칭호 · 모르는 칸은 남긴다).
 *  비우기 전에 저장된 달의 채운 수 · 받은 단계를 prev 로 남긴다 — 지난 달 못 받은 보상(missedBoard)이 읽는다 */
function target(st: object, at: number | string): { raw: Record<string, unknown>; month: string } {
  const raw = rawOf(st), stored = storedMonth(raw), m = monthAt(at);
  if (!isMonth(m)) return { raw: { ...raw }, month: stored };
  if (stored && stored >= m) return { raw: { ...raw }, month: stored };
  const next: Record<string, unknown> = { ...raw, m, n: {}, kinds: [], got: [] };
  if (stored) {
    const old = seasonOf(st, stored);
    next.prev = { m: stored, done: doneIn(old), got: old.got };
  }
  return { raw: next, month: m };
}
const put = <S extends object>(st: S, raw: Record<string, unknown>): S => ({ ...st, season: raw }) as S;

/** 수 더하기 · 최고값 · 낚은 계열 — 엔진이 동작이 끝난 상태에 부른다. 순수. 바뀐 게 없으면 원본 그대로.
 *  at: 그 동작의 시각(ms) 또는 날짜 "YYYY-MM-DD" */
export function seasonAdd<S extends object>(st: S, at: number | string, add: Partial<Record<CountStat, number>>, opt: { kind?: string; max?: Partial<Record<MaxStat, number>> } = {}): S {
  const { raw, month } = target(st, at);
  if (!month) return st;
  const n0 = isObj(raw.n) ? raw.n : {};
  const n: Record<string, unknown> = { ...n0 };
  let changed = storedMonth(rawOf(st)) !== month;
  for (const [k, v] of Object.entries(add)) {
    const d = num(v);
    if (d > 0) { n[k] = Math.min(STAT_CAP, num(n0[k]) + d); changed = true; }
  }
  for (const [k, v] of Object.entries(opt.max ?? {})) {
    const d = num(v);
    if (d > num(n0[k])) { n[k] = d; changed = true; }
  }
  let kinds = Array.isArray(raw.kinds) ? raw.kinds : [];
  if (opt.kind && !kinds.includes(opt.kind) && kinds.length < KINDS_MAX) {
    kinds = [...kinds, opt.kind];
    changed = true;
  }
  if (!changed) return st;
  return put(st, { ...raw, m: month, n, kinds });
}

/** 미션 하나의 지금 값 */
export function missionValue(v: SeasonView, ms: Mission): number {
  if (ms.stat === "kinds") return v.kinds.length;
  return v.n[ms.stat] ?? 0;
}

export type TierRow = { tier: number; need: number; reward: TierReward; reached: boolean; got: boolean };
const tierRows = (done: number, got: number[]): TierRow[] =>
  TIERS.map((need, i) => ({ tier: i + 1, need, reward: TIER_REWARD[i], reached: done >= need, got: got.includes(i + 1) }));

/** 지난 달 못 받은 보상 — 지금(KST) 달의 1~MISSED_DAYS 일, 바로 앞 달 기록이 남아 있을 때만.
 *  저장된 달이 아직 지난 달(이번 달에 동작이 없었다)이면 그 기록을 그대로, 이미 넘겼으면 prev 를 읽는다.
 *  저장된 달이 지금보다 뒤면(시계가 빨랐던 폰) 열지 않는다 — 날짜는 앞으로만(§10.25). */
export type MissedBoard = { month: string; done: number; daysLeft: number; tiers: TierRow[] };
export function missedBoard(st: object, now: number): MissedBoard | null {
  const cur = monthOf(now);
  if (activeMonth(st, now) !== cur) return null;
  const day = Number(kstDate(now).slice(8, 10));
  if (day > MISSED_DAYS) return null;
  const pm = prevMonth(cur), raw = rawOf(st);
  let done: number, got: number[];
  if (storedMonth(raw) === pm) {
    const v = seasonOf(st, pm);
    done = doneIn(v);
    got = v.got;
  } else if (isObj(raw.prev) && raw.prev.m === pm) {
    done = Math.min(MISSION_COUNT, num(raw.prev.done));
    got = readGot(raw.prev.got);
  } else return null;
  return { month: pm, done, daysLeft: MISSED_DAYS - day + 1, tiers: tierRows(done, got) };
}

export type SeasonBoard = {
  month: string;
  daysLeft: number;
  rows: { m: Mission; value: number; done: boolean }[];
  done: number;
  tiers: TierRow[];
  titles: SeasonTitle[];
  /** 지난 달 못 받은 보상(받을 단계가 없어도 창이 열려 있으면 있다) */
  missed: MissedBoard | null;
  /** 펫 칭호 — 받은 것 모두(달마다 가장 높은 단계)와 지금 단 것 */
  petTitles: PetTitle[];
  worn: PetTitle | null;
};
/** 허브 카드 · 시트가 그리는 값 — 섬 상태와 시각만 본다(가벼운 계산, 엔진을 부르지 않는다) */
export function seasonBoard(st: object, now: number): SeasonBoard {
  const month = activeMonth(st, now);
  const v = seasonOf(st, month);
  const rows = missionsFor(month).map((m) => {
    const value = missionValue(v, m);
    return { m, value, done: value >= m.goal };
  });
  const done = rows.filter((r) => r.done).length;
  const petTitles = petTitlesOf(st);
  return {
    month,
    daysLeft: month === monthOf(now) ? daysLeft(now) : 0,
    rows,
    done,
    tiers: tierRows(done, v.got),
    titles: v.titles,
    missed: missedBoard(st, now),
    petTitles,
    worn: wornOf(st, petTitles),
  };
}

/** 받기 판정 — 그 달 · 그 단계 · 아직 안 받음 · 채운 미션 수. 순수. 보상을 붙이는 건 seasonclaim(수조 · 찌 엔진을 부른다)
 *  missed = 지난 달 못 받은 보상(다음 달 첫 7일 · 단계마다 한 번 — 받음 표시가 지난 달 기록에 남는다) */
export function claimBlock(st: object, tier: number, now: number, missed = false): string | null {
  if (!Number.isInteger(tier) || tier < 1 || tier > TIERS.length) return "없는 단계예요";
  if (missed) {
    const m = missedBoard(st, now);
    if (!m) return `지난 달 보상은 이번 달 ${MISSED_DAYS}일까지만 받을 수 있어요`;
    const t = m.tiers[tier - 1];
    if (t.got) return "지난 시즌에 이미 받았어요";
    if (!t.reached) return `지난 달에 미션을 ${t.need}개 채우지 못했어요`;
    return null;
  }
  const b = seasonBoard(st, now);
  const t = b.tiers[tier - 1];
  if (t.got) return "이번 시즌에 이미 받았어요";
  if (!t.reached) return `미션을 ${t.need}개 채우면 받을 수 있어요`;
  return null;
}

/** 보상을 붙일 달 — 이번 달 또는(missed) 지난 달 */
export const claimMonth = (st: object, now: number, missed = false) => (missed ? prevMonth(monthOf(now)) : activeMonth(st, now));

/** 받음 표시 — 보상과 같은 저장에 넣는다(두 폰이 같이 눌러도 늦은 쪽은 claimBlock 에 걸린다). 옛 칭호 칸(titles)은 3단계만.
 *  펫 칭호(s.petTitle)는 어느 단계든 그 달 칭호를 올린다. missed 면 지난 달 기록(저장된 달이 지난 달이면 그 got, 아니면 prev.got)에 적는다 */
export function markClaimed<S extends object>(st: S, tier: number, now: number, who: string, missed = false): S {
  const month = claimMonth(st, now, missed);
  const raw0 = rawOf(st);
  let next: Record<string, unknown>;
  if (missed && storedMonth(raw0) !== month) {
    // 이미 이번 달로 넘겼다 — prev 의 받음 표시만 고친다(진행 칸은 이번 달 것)
    const prev = isObj(raw0.prev) ? raw0.prev : {};
    const got = readGot(prev.got);
    if (!got.includes(tier)) got.push(tier);
    next = { ...raw0, prev: { ...prev, got } };
  } else {
    // 이번 달 받기 · 아직 넘기지 않은 지난 달 받기 — 저장된 달 기록의 got 에 적는다(지난 달이면 넘기지 않는다)
    const raw = missed ? { ...raw0 } : target(st, month).raw;
    const got = Array.isArray(raw.got) ? [...raw.got] : [];
    if (!got.includes(tier)) got.push(tier);
    next = { ...raw, m: month, got };
  }
  let titles = Array.isArray(next.titles) ? [...next.titles] : [];
  if (TIER_REWARD[tier - 1] === "title" && !readTitles(titles).some((t) => t.m === month)) titles = [...titles, { m: month, who, at: now } satisfies SeasonTitle].slice(-TITLES_MAX);
  return grantPetTitle(put(st, { ...next, titles }), month, tier, now);
}

// ── 펫 칭호(2026-11-18) — 새 최상위 칸 s.petTitle ─────────────────
export type PetTitle = { m: string; t: number; text: string };
type Titled = { petTitle?: unknown };
const titleRaw = (st: object): Record<string, unknown> => {
  const v = (st as Titled).petTitle;
  return isObj(v) ? v : {};
};
function readGot(v: unknown): number[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= TIERS.length))] : [];
}

/** 받은 칭호 — s.petTitle.list 에 더해 옛 기록에서도 읽는다: s.season.titles(3단계) · 저장된 달 got · prev.got.
 *  그래서 이 버전 전에(또는 옛 앱에서) 받은 단계도 칭호가 된다. 달마다 가장 높은 단계 하나, 오래된 달 먼저, 최근 TITLES_MAX 개 */
export function petTitlesOf(st: object): PetTitle[] {
  const best = new Map<string, number>();
  const up = (m: unknown, t: number) => {
    if (isMonth(m) && t >= 1 && t <= TIERS.length && t > (best.get(m) ?? 0)) best.set(m, t);
  };
  const list = titleRaw(st).list;
  if (Array.isArray(list)) for (const x of list) if (isObj(x)) up(x.m, num(x.t));
  const raw = rawOf(st);
  for (const x of readTitles(raw.titles)) up(x.m, 3);
  const sm = storedMonth(raw);
  for (const t of readGot(raw.got)) up(sm, t);
  if (isObj(raw.prev)) for (const t of readGot(raw.prev.got)) up(raw.prev.m, t);
  return [...best.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-TITLES_MAX).map(([m, t]) => ({ m, t, text: tierTitleText(m, t) }));
}

/** 지금 단 칭호 — on 이 ""이면 숨김, 받은 달이면 그것, 아니면 가장 최근 달 */
export function wornOf(st: object, titles = petTitlesOf(st)): PetTitle | null {
  const on = titleRaw(st).on;
  if (on === "") return null;
  return titles.find((x) => x.m === on) ?? titles[titles.length - 1] ?? null;
}

function grantPetTitle<S extends object>(st: S, month: string, tier: number, now: number): S {
  const raw = titleRaw(st);
  const list = Array.isArray(raw.list) ? raw.list.filter(isObj) : [];
  const had = list.find((x) => x.m === month);
  if (had && num(had.t) >= tier) return st;
  const next = [...list.filter((x) => x.m !== month), { m: month, t: tier, at: now }]
    .sort((a, b) => (String(a.m) < String(b.m) ? -1 : 1)).slice(-TITLES_MAX);
  return { ...st, petTitle: { ...raw, list: next } } as S;
}

/** 칭호 고르기 — 받은 달("YYYY-MM") 또는 ""(숨기기). 받지 않은 달이면 그대로. 저장된 그대로에서 on 만 고친다 */
export function wearTitle<S extends object>(st: S, month: string): S {
  if (month !== "" && !petTitlesOf(st).some((x) => x.m === month)) return st;
  const raw = titleRaw(st);
  if (raw.on === month) return st;
  return { ...st, petTitle: { ...raw, on: month } } as S;
}
