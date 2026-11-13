/* 오늘의 의뢰(2026-11-13) [사용자: "낚시게임 업그레이드해"] — 날마다 세 가지 "어느 낚시터에서 이 물고기를 낚아 줘".
 * 4차로 물고기가 152종이 됐는데 늘 가던 낚시터의 늘 낚던 물고기만 낚게 된다 — 다른 낚시터 · 새 물고기로 끌어가는 하루 목표.
 *
 * 규칙
 *  · 고르기: 날짜 + 섬 시드의 해시만 쓴다(rngNext · Math.random 금지 — 두 폰이 같은 목록을 본다).
 *  · 후보: 열린 낚시터(minLevel ≤ 낚시 레벨)의 '기본 무리' 계열만 — 그 낚시터의 시작 미끼로 무는 계열(미끼 1% 띠에 걸리는 귀한 계열 · 때 손님은 안 넣는다).
 *    그래서 늘 오늘 잡을 수 있다. 어떤 방식(찌 · 루어 · 뜰채 · 심해 · 집어등)이든, 치어여도 그 계열이면 된다.
 *  · 목록은 그날 처음 끌어올릴 때 레벨로 굳는다(fishPlus.req.lv) — 낮에 레벨이 올라 목록이 바뀌지 않게.
 *  · 날짜는 앞으로만 — 저장된 날보다 이른 날(시계를 되돌림)이면 아무것도 안 센다. 늦은 날이면 새로 시작.
 *  · 진행은 끌어올린 순간(fishing.ts 의 mastered — 담기 · 그물 · 빠져나감 · 팔기 모두) 한 번. 꽝 · 주인 · 유리병 · 보물은 안 센다. 뽑기는 안 건드린다.
 *  · 보상: 의뢰마다 고정 하트(깊은 낚시터일수록 조금 더) + 셋 다 하면 덤. 하루 상한이 곧 이 합이다(econbalance — 하루 순수입 1~2만에 견줘 작게).
 *  · 저장: 섬 최상위 s.fishPlus.req(옛 앱이 흘린다) = { day, lv, done }. 커플이 함께 채운다(누가 낚든). 혼자 하는 섬도 같다. 순수. */
import type { IslandState } from "./island.ts";
import { SPOTS, familyBaitTier, fishingOf, type FishCatch, type FishSpot } from "./fishing.ts";
import { fishPlusOf, withFishPlus } from "./fishplus.ts";

export type FishRequest = { spot: string; family: string; coins: number };
export type RequestBook = { day: string; lv: number; done: number[] };
export const REQUEST_COUNT = 3;
/** 셋 다 하면 */
export const REQUEST_ALL_BONUS = 400;
/** 한 의뢰의 하트 — 첫 낚시터 200 에서 낚시터 하나 깊을수록 35 */
export const requestCoins = (spotIndex: number) => Math.round((200 + spotIndex * 35) / 10) * 10;

const hash = (s: string) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };
const next = (h: number) => (Math.imul(h ^ (h >>> 15), 2246822519) + 0x9e3779b9) >>> 0;

/** 이 낚시터의 시작 미끼로 무는 계열(기본 무리) — rollCatch 의 baseTier 와 같은 식(시작 미끼 단계 · common) */
export function baseFamilies(spot: FishSpot): string[] {
  const tiers = spot.pool.map(([k]) => familyBaitTier(k));
  const base = Math.max(Math.min(...tiers), spot.common ?? -1);
  return spot.pool.filter(([k]) => familyBaitTier(k) <= base).map(([k]) => k);
}

export function requestBook(st: Pick<IslandState, "fishPlus">): RequestBook | null {
  const r = fishPlusOf(st).req as RequestBook | undefined;
  return r && typeof r.day === "string" && Array.isArray(r.done) ? r : null;
}

/** 그날의 의뢰 셋 — 같은 날 · 시드 · 레벨이면 늘 같다 */
export function requestsFor(seed: number, day: string, level: number): FishRequest[] {
  const open = SPOTS.map((s, i) => ({ s, i })).filter(({ s }) => s.minLevel <= level);
  const pairs = open.flatMap(({ s, i }) => baseFamilies(s).map((family) => ({ spot: s.key, family, i })));
  if (!pairs.length) return [];
  const out: FishRequest[] = [];
  let h = hash(`${day}:${seed}`);
  // 낚시터가 다르고 계열이 다른 셋을 먼저, 모자라면(첫날 낚시터 하나) 계열만 다르게
  for (const needSpot of [true, false]) {
    for (let tries = 0; tries < 64 && out.length < REQUEST_COUNT; tries++) {
      h = next(h);
      const p = pairs[h % pairs.length];
      if (out.some((x) => x.family === p.family)) continue;
      if (needSpot && out.some((x) => x.spot === p.spot)) continue;
      out.push({ spot: p.spot, family: p.family, coins: requestCoins(p.i) });
    }
  }
  return out;
}

/** 화면용 — 오늘의 의뢰와 한 것. 시계가 저장된 날보다 이르면 비운다(되돌린 날엔 아무것도 안 센다) */
export function todayRequests(st: Pick<IslandState, "fishPlus" | "seed" | "fishing">, day: string): { list: FishRequest[]; done: boolean[]; frozen: boolean } {
  const book = requestBook(st);
  if (book && book.day > day) return { list: [], done: [], frozen: true };
  const lv = book && book.day === day ? book.lv : fishingOf(st as IslandState).level;
  const list = requestsFor(st.seed ?? 0, day, lv);
  const done = list.map((_, i) => !!(book && book.day === day && book.done.includes(i)));
  return { list, done, frozen: false };
}

export type RequestHit = { name?: string; spot: string; family: string; coins: number; all: boolean };

/** 끌어올린 물고기 하나를 오늘의 의뢰에 센다 — 맞는 의뢰가 있으면 하트를 더하고 hit 를 돌려준다. 순수 */
export function noteRequest(st: IslandState, c: Pick<FishCatch, "family" | "junk" | "boss" | "special" | "at">, day: string): { state: IslandState; hit: RequestHit | null } {
  if (!c.at || c.junk || c.boss || c.special || !day) return { state: st, hit: null };
  const book = requestBook(st);
  if (book && book.day > day) return { state: st, hit: null };
  const lv = book && book.day === day ? book.lv : fishingOf(st).level;
  const done = book && book.day === day ? book.done : [];
  const list = requestsFor(st.seed ?? 0, day, lv);
  const i = list.findIndex((r, k) => !done.includes(k) && r.spot === c.at && r.family === c.family);
  // 그날 처음 끌어올리면 레벨을 굳힌다(맞는 의뢰가 없어도)
  if (i < 0) return book && book.day === day ? { state: st, hit: null } : { state: withFishPlus(st, { req: { day, lv, done: [] } }), hit: null };
  const now = [...done, i];
  const all = now.length >= list.length;
  const coins = list[i].coins + (all ? REQUEST_ALL_BONUS : 0);
  const state = withFishPlus({ ...st, coins: st.coins + coins }, { req: { day, lv, done: now } });
  return { state, hit: { spot: list[i].spot, family: list[i].family, coins, all } };
}
