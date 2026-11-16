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
 *   adv    — 모험은 사람마다 따로 저장된다(adventure_saves · 내 행만 보인다) — 사람마다 이번 달 수를 적고 더한다.
 *            쓰기는 '더하기'가 아니라 '큰 값으로'(이 기기에 센 값 — seasonsync) 라 다시 보내도 두 번 세지 않는다.
 *   got    — 이번 달 받은 단계(1 · 2 · 3) — 한 커플이 한 달에 한 번씩
 *   titles — 다 채운 달의 칭호(최근 TITLES_MAX 개)
 *
 * ⚠ 이 파일은 가볍게 — 런타임 import 는 lib/kst 하나다(게임 허브 · 홈 · 모험이 부른다, firstload.test).
 *   엔진(island · fishing · aquarium · merge)은 이 파일을 불러 자기 동작이 끝난 상태에 수를 더한다. 거꾸로 부르지 않는다.
 * ⚠ 쓰기는 저장된 그대로의 값에서 바꿀 칸만 고친다 — 다음 버전이 더한 칸을 이 번들이 지우지 않게(fishlooks 의 writeLooks 와 같은 규칙). */
import { kstDate } from "./kst.ts";

export type SeasonGame = "fish" | "aqua" | "merge" | "adv" | "island";
/** 함께 세는 수 */
export type CountStat = "landed" | "boss" | "kick" | "hatch" | "water" | "guest" | "feed" | "mergeGames" | "harvest" | "evolve";
/** 이번 달 최고값 */
export type MaxStat = "mergeScore" | "mergeTop";
/** 사람마다 세는 모험 수 */
export type AdvStat = "advBoss" | "advCatch" | "advWin";
export type SeasonStat = CountStat | MaxStat | AdvStat | "kinds";

export type Mission = { id: string; game: SeasonGame; stat: SeasonStat; goal: number; label: string };

export const GAME_NAME: Readonly<Record<SeasonGame, string>> = { fish: "낚시", aqua: "수조", merge: "합치기", adv: "모험", island: "섬" };

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
  { id: "adv_boss", game: "adv", stat: "advBoss", goal: 1, label: "모험 대장 관문 1번 이기기" },
  { id: "adv_catch", game: "adv", stat: "advCatch", goal: 5, label: "모험 생물 5마리 잡기" },
  { id: "adv_win", game: "adv", stat: "advWin", goal: 10, label: "모험 승부 10번 이기기" },
  { id: "island_harvest", game: "island", stat: "harvest", goal: 30, label: "섬 밭 30번 수확하기" },
  { id: "island_evolve", game: "island", stat: "evolve", goal: 1, label: "펫 1번 진화시키기" },
];
/** 게임마다 몇 개 — 합이 12. 섬은 풀이 둘이라 늘 둘 다 */
export const SEASON_QUOTA: Readonly<Record<SeasonGame, number>> = { fish: 3, aqua: 3, merge: 2, adv: 2, island: 2 };
export const GAME_ORDER: readonly SeasonGame[] = ["fish", "aqua", "merge", "adv", "island"];
/** 단계 — 미션을 이만큼 채우면 그 단계 보상(1: 수조 장식 · 2: 시즌 찌 · 3: 펫 칭호). 하트는 없다(§10.25 경제 표를 건드리지 않는다) */
export const TIERS: readonly number[] = [4, 8, 12];
export type TierReward = "decor" | "bobber" | "title";
export const TIER_REWARD: readonly TierReward[] = ["decor", "bobber", "title"];
/** 1단계 수조 장식 — 이미 있는 장식만(옛 앱 · 3D 모델 · 그림이 다 아는 것). 달마다 하나. 하트로 되파는 길이 없어 하트가 생기지 않는다 */
export const SEASON_DECOR: readonly string[] = ["heart_bubbler", "mailbox", "sand_castle", "windmill", "pearl_clam", "diver"];
/** 2단계 시즌 찌(fishlooks 의 LIMITED_LOOKS) — 이미 가졌으면 그 달 장식을 하나 더 */
export const SEASON_BOBBER = "bob_season";

export const KINDS_MAX = 30;
export const TITLES_MAX = 12;
const ADV_KEYS_MAX = 4;
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

export type SeasonTitle = { m: string; who: string; at: number };
export type SeasonView = {
  month: string;
  n: Partial<Record<CountStat | MaxStat, number>>;
  kinds: string[];
  adv: Record<string, Partial<Record<AdvStat, number>>>;
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
  if (storedMonth(raw) !== month) return { month, n: {}, kinds: [], adv: {}, got: [], titles };
  const n: SeasonView["n"] = {};
  if (isObj(raw.n)) for (const [k, v] of Object.entries(raw.n)) if (num(v) > 0) n[k as CountStat] = num(v);
  const kinds = Array.isArray(raw.kinds) ? [...new Set(raw.kinds.filter((x): x is string => typeof x === "string"))].slice(0, KINDS_MAX) : [];
  const adv: SeasonView["adv"] = {};
  if (isObj(raw.adv)) {
    for (const [uid, v] of Object.entries(raw.adv)) {
      if (!isObj(v)) continue;
      adv[uid] = { advBoss: num(v.advBoss), advCatch: num(v.advCatch), advWin: num(v.advWin) };
    }
  }
  const got = Array.isArray(raw.got) ? [...new Set(raw.got.filter((x): x is number => typeof x === "number" && x >= 1 && x <= TIERS.length))] : [];
  return { month, n, kinds, adv, got, titles };
}

/** 쓰기 대상 — at 의 달과 저장된 달 중 늦은 쪽. 새 달이면 진행 칸을 비운다(칭호 · 모르는 칸은 남긴다) */
function target(st: object, at: number | string): { raw: Record<string, unknown>; month: string } {
  const raw = rawOf(st), stored = storedMonth(raw), m = monthAt(at);
  if (!isMonth(m)) return { raw: { ...raw }, month: stored };
  if (stored && stored >= m) return { raw: { ...raw }, month: stored };
  return { raw: { ...raw, m, n: {}, kinds: [], adv: {}, got: [] }, month: m };
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

/** 모험 — 이 사람의 이번 달 수를 '큰 값으로' 적는다(seasonsync 가 이 기기에서 센 값). 다시 보내도 두 번 세지 않는다. 순수. */
export type AdvTally = { m: string } & Partial<Record<AdvStat, number>>;
export function seasonAdvMerge<S extends object>(st: S, uid: string, tally: AdvTally): S {
  if (!uid || !isMonth(tally.m)) return st;
  const { raw, month } = target(st, tally.m);
  if (month !== tally.m) return st; // 이미 지난 달의 수 — 버린다
  const adv0 = isObj(raw.adv) ? raw.adv : {};
  if (!(uid in adv0) && Object.keys(adv0).length >= ADV_KEYS_MAX) return st;
  const mine0 = isObj(adv0[uid]) ? adv0[uid] : {};
  const mine: Record<string, unknown> = { ...mine0 };
  let changed = storedMonth(rawOf(st)) !== month;
  for (const k of ["advBoss", "advCatch", "advWin"] as const) {
    const v = num(tally[k]);
    if (v > num(mine0[k])) { mine[k] = v; changed = true; }
  }
  if (!changed) return st;
  return put(st, { ...raw, m: month, adv: { ...adv0, [uid]: mine } });
}

/** 미션 하나의 지금 값 — local: 이 기기가 센 내 모험 수(아직 섬에 못 올렸어도 바로 보이게, 큰 값으로) */
export function missionValue(v: SeasonView, ms: Mission, local?: { uid: string; tally: AdvTally | null }): number {
  if (ms.stat === "kinds") return v.kinds.length;
  if (ms.stat === "advBoss" || ms.stat === "advCatch" || ms.stat === "advWin") {
    const k = ms.stat;
    const adv = { ...v.adv };
    if (local?.tally && local.tally.m === v.month) adv[local.uid] = { ...adv[local.uid], [k]: Math.max(adv[local.uid]?.[k] ?? 0, num(local.tally[k])) };
    return Object.values(adv).reduce((a, x) => a + (x[k] ?? 0), 0);
  }
  return v.n[ms.stat] ?? 0;
}

export type SeasonBoard = {
  month: string;
  daysLeft: number;
  rows: { m: Mission; value: number; done: boolean }[];
  done: number;
  tiers: { tier: number; need: number; reward: TierReward; reached: boolean; got: boolean }[];
  titles: SeasonTitle[];
};
/** 허브 카드 · 시트가 그리는 값 — 섬 상태와 시각만 본다(가벼운 계산, 엔진을 부르지 않는다) */
export function seasonBoard(st: object, now: number, local?: { uid: string; tally: AdvTally | null }): SeasonBoard {
  const month = activeMonth(st, now);
  const v = seasonOf(st, month);
  const rows = missionsFor(month).map((m) => {
    const value = missionValue(v, m, local);
    return { m, value, done: value >= m.goal };
  });
  const done = rows.filter((r) => r.done).length;
  return {
    month,
    daysLeft: month === monthOf(now) ? daysLeft(now) : 0,
    rows,
    done,
    tiers: TIERS.map((need, i) => ({ tier: i + 1, need, reward: TIER_REWARD[i], reached: done >= need, got: v.got.includes(i + 1) })),
    titles: v.titles,
  };
}

/** 받기 판정 — 그 달 · 그 단계 · 아직 안 받음 · 채운 미션 수. 순수. 보상을 붙이는 건 seasonclaim(수조 · 찌 엔진을 부른다) */
export function claimBlock(st: object, tier: number, now: number): string | null {
  if (!Number.isInteger(tier) || tier < 1 || tier > TIERS.length) return "없는 단계예요";
  const b = seasonBoard(st, now);
  const t = b.tiers[tier - 1];
  if (t.got) return "이번 시즌에 이미 받았어요";
  if (!t.reached) return `미션을 ${t.need}개 채우면 받을 수 있어요`;
  return null;
}

/** 받음 표시 — 보상과 같은 저장에 넣는다(두 폰이 같이 눌러도 늦은 쪽은 claimBlock 에 걸린다). 칭호는 3단계만 */
export function markClaimed<S extends object>(st: S, tier: number, now: number, who: string): S {
  const month = activeMonth(st, now);
  const { raw } = target(st, month);
  const got = Array.isArray(raw.got) ? [...raw.got] : [];
  if (!got.includes(tier)) got.push(tier);
  let titles = Array.isArray(raw.titles) ? [...raw.titles] : [];
  if (TIER_REWARD[tier - 1] === "title" && !readTitles(titles).some((t) => t.m === month)) titles = [...titles, { m: month, who, at: now } satisfies SeasonTitle].slice(-TITLES_MAX);
  return put(st, { ...raw, m: month, got, titles });
}
