/* 낚시 (2026-11-02) — [사용자: "낚시 게임 레퍼런스 확인하고 낚시 게임을 만들어 … 낚시에 성공한 물고기들만 수조에 보관 …
 * 낚시에 성공했다고 다 가능한것도 아니고 내 능력치 … 포획 능력치 같은거에 따라서 확률로 보관 … 낚시 게임을 메인으로"]
 * 순수 엔진(화면은 components/FishingGame). 저장은 섬 상태의 옵셔널 칸 s.fishing, 물고기는 s.aquarium — DB 변경 없음.
 *
 * 흐름(장르의 표준 세 박자 + 우리 규칙):
 *  1. 던지기 — 누르고 있다가 놓는다. 좋은 자리에서 놓으면 귀한 물고기가 잘 문다.
 *  2. 입질 — 찌가 살짝 흔들리는 건 간 보기. 크게 잠길 때 눌러야 걸린다(일찍 누르면 달아난다, 늦으면 뱉는다).
 *  3. 힘겨루기 — 누르면 감기고 줄이 팽팽해진다. 끊어지기 전에 놓고, 너무 오래 놓으면 바늘이 빠진다. 물고기는 수시로 차고 나간다.
 *  4. 보관 판정 — 끌어올려도 **포획 확률**을 넘어야 수조에 들어간다. 놓치면 하트 절반. 수조에 안 넣고 팔면 하트 전부.
 *  · 물고기는 대개 치어 · 어린 물고기로 잡혀서 수조에서 키운다. 다 큰 놈이 잡히는 건 드문 대박이다.
 *  · 힘겨루기는 stepFight 한 곳 — 화면은 매 프레임 이걸 부르기만 한다. fishing.test 의 자동 플레이가 난이도를 잠근다.
 *  · 하트 벌이는 하루 상한이 있다. 낚시는 공짜로 무한히 할 수 있어서, 상한이 없으면 하트 경제가 끝난다.
 *  · ⚠ 섬 엔진은 타입만 부른다. 뽑기는 호출자가 넘긴 seed 로만(같은 입력 = 같은 결과, 테스트 가능). */
import type { IslandState } from "./island.ts";
import { GRADES, addFish, aquaOf, familyOf, fishArtKey, fishName, fryLockReason, speciesOf, tankOf, type AquaFamily, type Grade } from "./aquarium.ts";

export type FishStat = "catch" | "power" | "line" | "luck";
export const STAT_INFO: Record<FishStat, { name: string; desc: string }> = {
  catch: { name: "포획", desc: "끌어올린 물고기를 수조에 담을 확률" },
  power: { name: "힘", desc: "줄을 감는 속도 · 물고기가 덜 차고 나감" },
  line: { name: "줄 다루기", desc: "줄이 덜 팽팽해지고 잘 안 끊어짐" },
  luck: { name: "행운", desc: "귀한 물고기와 다 큰 물고기가 잘 잡힘" },
};
export const STAT_KEYS = Object.keys(STAT_INFO) as FishStat[];
export const STAT_CAP = 40;
export const MAX_LEVEL = 50;
export const POINTS_PER_LEVEL = 2;
export const DAILY_FISH_COINS = 800;

export type FishSpot = { key: string; name: string; minLevel: number; pool: readonly (readonly [string, number])[] };
export const SPOTS: readonly FishSpot[] = [
  { key: "brook", name: "동네 개울", minLevel: 1, pool: [["guppy", 60], ["tetra", 40]] },
  { key: "pond", name: "연꽃 연못", minLevel: 3, pool: [["goldfish", 50], ["betta", 35], ["koi", 15]] },
  { key: "jungle", name: "열대 강", minLevel: 7, pool: [["angel", 40], ["discus", 30], ["ray", 20], ["arowana", 10]] },
  { key: "reef", name: "산호초 바다", minLevel: 12, pool: [["clown", 55], ["sea_turtle", 30], ["manta", 15]] },
  { key: "ocean", name: "먼 바다", minLevel: 18, pool: [["bluefin", 60], ["manta", 25], ["whale_shark", 15]] },
  { key: "palace", name: "용궁 앞바다", minLevel: 25, pool: [["rising", 80], ["whale_shark", 20]] },
  { key: "starsea", name: "별의 바다", minLevel: 32, pool: [["astral", 70], ["rising", 30]] },
];
export const spotOf = (key: string) => SPOTS.find((x) => x.key === key);

export const RODS: readonly { key: string; name: string; price: number; power: number; line: number }[] = [
  { key: "rod_bamboo", name: "대나무 낚싯대", price: 0, power: 0, line: 0 },
  { key: "rod_glass", name: "유리섬유 낚싯대", price: 1500, power: 3, line: 3 },
  { key: "rod_carbon", name: "카본 낚싯대", price: 6000, power: 7, line: 7 },
  { key: "rod_titan", name: "티타늄 낚싯대", price: 18000, power: 12, line: 12 },
  { key: "rod_dragon", name: "용골 낚싯대", price: 50000, power: 18, line: 18 },
  { key: "rod_star", name: "별빛 낚싯대", price: 120000, power: 25, line: 25 },
];
export const NETS: readonly { key: string; name: string; price: number; catch: number }[] = [
  { key: "net_bug", name: "잠자리채", price: 0, catch: 0 },
  { key: "net_cotton", name: "면 뜰채", price: 1000, catch: 4 },
  { key: "net_rubber", name: "고무 뜰채", price: 5000, catch: 9 },
  { key: "net_silver", name: "은실 뜰채", price: 15000, catch: 15 },
  { key: "net_gold", name: "황금 뜰채", price: 40000, catch: 22 },
  { key: "net_moon", name: "달빛 뜰채", price: 100000, catch: 30 },
];

export type FishingState = {
  level: number;
  xp: number;
  points: number;
  stats: Record<FishStat, number>;
  rod: number;
  net: number;
  day: string;
  dayCoins: number;
  landed: number;
  stored: number;
};

export function fishingOf(st: Pick<IslandState, "fishing">): FishingState {
  const f = st.fishing;
  return {
    level: f?.level ?? 1,
    xp: f?.xp ?? 0,
    points: f?.points ?? 0,
    stats: { catch: f?.stats?.catch ?? 1, power: f?.stats?.power ?? 1, line: f?.stats?.line ?? 1, luck: f?.stats?.luck ?? 1 },
    rod: Math.min(RODS.length - 1, Math.max(0, f?.rod ?? 0)),
    net: Math.min(NETS.length - 1, Math.max(0, f?.net ?? 0)),
    day: f?.day ?? "",
    dayCoins: f?.dayCoins ?? 0,
    landed: f?.landed ?? 0,
    stored: f?.stored ?? 0,
  };
}

/** 지금 능력치 — 올린 능력치 + 장비 */
export function effectiveStats(f: Pick<FishingState, "stats" | "rod" | "net">): Record<FishStat, number> {
  return {
    catch: f.stats.catch + NETS[f.net].catch,
    power: f.stats.power + RODS[f.rod].power,
    line: f.stats.line + RODS[f.rod].line,
    luck: f.stats.luck,
  };
}

/** 다음 레벨까지 필요한 경험치 */
export const xpNeed = (level: number) => 30 + level * level * 6;

/* ── 물고기 뽑기 ─────────────────────────────────────── */

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(items: readonly (readonly [T, number])[], r: number): T {
  const total = items.reduce((n, x) => n + x[1], 0);
  let v = r * total;
  for (const [it, w] of items) {
    if (v < w) return it;
    v -= w;
  }
  return items[items.length - 1][0];
}

export type FishCatch = { family: string; stage: 0 | 1 | 2; species?: string; grade: Grade; difficulty: number };

/** 난이도 — 등급(0~7) + 클수록 조금 더 */
function difficultyOf(fam: AquaFamily, stage: 0 | 1 | 2, species?: string): { grade: Grade; difficulty: number } {
  const grade = speciesOf(species)?.grade ?? fam.finals[0].grade;
  return { grade, difficulty: GRADES.indexOf(grade) + stage * 0.5 };
}

/** 던진 힘 → 보너스. 끝까지 당기면 오히려 지나친다. */
export function castBonus(power: number): 0 | 0.5 | 1 {
  if (power >= 0.78 && power <= 0.95) return 1;
  return power >= 0.45 ? 0.5 : 0;
}

/** 무엇이 무는가 — 행운 · 캐스팅이 다 큰 물고기와 귀한 쪽으로 기울인다. 순수. */
export function rollCatch(spot: FishSpot, luck: number, cast: number, seed: number): FishCatch {
  const r = rng(seed);
  const lift = luck * 0.012 + cast * 0.12;
  // 뒤쪽(귀한) 계열일수록 무게를 더 받는다
  const family = pickWeighted(spot.pool.map(([k, w], i) => [k, w * (1 + lift * i)] as const), r());
  const fam = familyOf(family);
  if (!fam) throw new Error(`없는 계열: ${family}`);
  const adult = 0.02 + luck * 0.0015 + cast * 0.015;
  const juv = 0.2 + luck * 0.003;
  const v = r();
  const stage: 0 | 1 | 2 = v < adult ? 2 : v < adult + juv ? 1 : 0;
  const species = stage === 2
    ? pickWeighted(fam.finals.map((x, i) => [x.key, [60, 25, 12, 3][i] * (1 + lift * i * 2)] as const), r())
    : undefined;
  return { family, stage, ...(species ? { species } : {}), ...difficultyOf(fam, stage, species) };
}

export const catchArt = (c: Pick<FishCatch, "family" | "stage" | "species">) => fishArtKey(c);
export const catchName = (c: Pick<FishCatch, "family" | "stage" | "species">) => fishName(c);

/** 물고기 크기(그림자) — 0~1. 물기 전까지 물고기는 그림자로만 보인다. */
export const shadowSize = (c: Pick<FishCatch, "family" | "stage">) => {
  const size = familyOf(c.family)?.size ?? 16;
  return Math.min(1, (size / 45) * (c.stage === 2 ? 1 : c.stage === 1 ? 0.75 : 0.5));
};

/* ── 입질 ───────────────────────────────────────────── */

/** 물었을 때 눌러야 하는 시간(ms) — 큰 놈일수록 짧다 */
export const hookWindowMs = (difficulty: number, line: number) => Math.round(Math.max(380, 1050 - difficulty * 85 + line * 4));
/** 입질까지 기다리는 시간(ms) · 간 보기 횟수 */
export function waitPlan(seed: number): { waitMs: number; nibbles: number[] } {
  const r = rng(seed ^ 0x5bd1e995);
  const waitMs = 1800 + Math.round(r() * 3800);
  const n = Math.floor(r() * 3);
  const nibbles = Array.from({ length: n }, (_, i) => Math.round(waitMs * ((i + 1) / (n + 1)) + (r() - 0.5) * 300));
  return { waitMs, nibbles };
}

/* ── 힘겨루기 ────────────────────────────────────────── */

export const GREEN_LOW = 0.35;
export const GREEN_HIGH = 0.75;
export const SLACK_LIMIT_S = 2.5;
export const FIGHT_LIMIT_S = 90;

export type FightTune = { reel: number; tensionUp: number; tensionDown: number; surgeEvery: number; surgeLen: number; surgePull: number; run: number; drift: number };
export type FightStatus = "on" | "landed" | "snapped" | "slack" | "escaped";
export type Fight = {
  /** 1 = 멀리, 0 = 끌어올림 */
  dist: number;
  tension: number;
  t: number;
  slack: number;
  surgeLeft: number;
  nextSurge: number;
  good: number;
  rngState: number;
  status: FightStatus;
};

export function fightTune(difficulty: number, eff: Pick<Record<FishStat, number>, "power" | "line">): FightTune {
  const d = difficulty;
  return {
    reel: (0.15 * (1 + eff.power * 0.035)) / (1 + d * 0.22),
    tensionUp: (0.42 * (1 + d * 0.12)) / (1 + eff.line * 0.03),
    tensionDown: 0.55,
    surgeEvery: Math.max(1.6, 4.5 - d * 0.3),
    surgeLen: 0.9 + d * 0.1,
    surgePull: (0.8 * (1 + d * 0.1)) / (1 + eff.line * 0.03),
    run: (0.1 * (1 + d * 0.1)) / (1 + eff.power * 0.02),
    drift: 0.012,
  };
}

export function startFight(seed: number, tune: FightTune): Fight {
  const r = rng(seed);
  return { dist: 1, tension: 0.35, t: 0, slack: 0, surgeLeft: 0, nextSurge: tune.surgeEvery * (0.6 + r() * 0.6), good: 0, rngState: (seed * 31 + 7) >>> 0, status: "on" };
}

/** 한 칸 진행 — hold 면 감는다. 순수. dt 는 초(화면이 잘라서 넘긴다). */
export function stepFight(f: Fight, dt: number, hold: boolean, tune: FightTune): Fight {
  if (f.status !== "on") return f;
  const n: Fight = { ...f, t: f.t + dt };
  if (n.surgeLeft > 0) {
    n.surgeLeft = Math.max(0, n.surgeLeft - dt);
    n.tension += tune.surgePull * (hold ? 1 : 0.25) * dt;
    n.dist += tune.run * dt;
  } else {
    n.nextSurge -= dt;
    if (n.nextSurge <= 0) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 11) >>> 0;
      n.surgeLeft = tune.surgeLen * (0.7 + r() * 0.6);
      n.nextSurge = tune.surgeEvery * (0.7 + r() * 0.6);
    }
  }
  if (hold) {
    n.tension += tune.tensionUp * dt;
    // 좋은 구간에서 잘 감기고, 팽팽할수록 빠르지만 위험하다
    const eff = n.tension < GREEN_LOW ? 0.6 : n.tension > GREEN_HIGH ? 1.25 : 1;
    n.dist -= tune.reel * eff * (n.surgeLeft > 0 ? 0.35 : 1) * dt;
  } else {
    n.tension -= tune.tensionDown * dt;
    n.dist += tune.drift * dt;
  }
  n.tension = Math.max(0, n.tension);
  n.slack = n.tension < 0.05 ? n.slack + dt : 0;
  if (n.tension >= GREEN_LOW && n.tension <= GREEN_HIGH) n.good += dt;
  if (n.tension >= 1) n.status = "snapped";
  else if (n.dist <= 0) n.status = "landed";
  else if (n.slack >= SLACK_LIMIT_S) n.status = "slack";
  else if (n.dist >= 1.3 || n.t >= FIGHT_LIMIT_S) n.status = "escaped";
  return n;
}

/** 힘겨루기 솜씨 0~1 — 좋은 구간에 머문 비율 */
export const fightQuality = (f: Pick<Fight, "good" | "t">) => (f.t <= 0 ? 0 : Math.min(1, f.good / f.t));

/* ── 보관 판정 ────────────────────────────────────────── */

export const coinValue = (difficulty: number) => Math.round(8 * 1.7 ** difficulty);
export const xpValue = (difficulty: number) => Math.round(10 * 1.5 ** difficulty);

/** 포획 확률 — 포획 능력치가 등급을 얼마나 넘느냐 + 힘겨루기 솜씨 + 정확한 챔질. 5~95%. */
export function captureChance(catchStat: number, difficulty: number, quality: number, perfectHook: boolean): number {
  const p = 0.55 + (catchStat - difficulty * 9) * 0.02 + quality * 0.1 + (perfectHook ? 0.05 : 0);
  return Math.round(Math.max(0.05, Math.min(0.95, p)) * 100) / 100;
}

/** 수조에 담을 수 없는 이유 — 있으면 확률 판정 없이 팔기만 된다 */
export function storeBlock(st: Pick<IslandState, "aquarium">, c: Pick<FishCatch, "family">): string | null {
  const a = aquaOf(st);
  const fam = familyOf(c.family);
  if (!fam) return "없는 물고기예요";
  const lock = fryLockReason(a, fam);
  if (lock) return lock;
  if (a.fish.length >= tankOf(a).fish) return "수조가 가득 찼어요";
  return null;
}

export type FishResult = { ok: true; state: IslandState; outcome: "stored" | "slipped" | "sold"; coins: number; levelUp: number } | { ok: false; reason: string };

function gain(st: IslandState, f: FishingState, difficulty: number, wantCoins: number, today: string): { f: FishingState; coins: number; levelUp: number } {
  const used = f.day === today ? f.dayCoins : 0;
  const coins = Math.max(0, Math.min(wantCoins, DAILY_FISH_COINS - used));
  let { level, xp, points } = f;
  xp += xpValue(difficulty);
  let levelUp = 0;
  while (level < MAX_LEVEL && xp >= xpNeed(level)) {
    xp -= xpNeed(level);
    level++;
    levelUp++;
    points += POINTS_PER_LEVEL;
  }
  return { f: { ...f, level, xp, points, day: today, dayCoins: used + coins, landed: f.landed + 1 }, coins, levelUp };
}

/** 수조에 담아 보기 — roll(0~1) 이 확률 밑이면 수조로, 아니면 빠져나간다(하트 절반). */
export function tryStore(st: IslandState, c: FishCatch, chance: number, roll: number, now: number, today: string): FishResult {
  const block = storeBlock(st, c);
  if (block) return { ok: false, reason: block };
  const win = roll < chance;
  const g = gain(st, fishingOf(st), c.difficulty, win ? 0 : Math.round(coinValue(c.difficulty) / 2), today);
  if (!win) return { ok: true, state: { ...st, coins: st.coins + g.coins, fishing: g.f }, outcome: "slipped", coins: g.coins, levelUp: g.levelUp };
  const added = addFish(st, c.family, c.stage, c.species, now);
  return { ok: true, state: { ...added, fishing: { ...g.f, stored: g.f.stored + 1 } }, outcome: "stored", coins: 0, levelUp: g.levelUp };
}

/** 수조에 안 담고 팔기 — 하트 전부 */
export function sellCatch(st: IslandState, c: FishCatch, today: string): FishResult {
  const g = gain(st, fishingOf(st), c.difficulty, coinValue(c.difficulty), today);
  return { ok: true, state: { ...st, coins: st.coins + g.coins, fishing: g.f }, outcome: "sold", coins: g.coins, levelUp: g.levelUp };
}

/* ── 키우기 ──────────────────────────────────────────── */

export type GearResult = { ok: true; state: IslandState } | { ok: false; reason: string };

export function spendPoint(st: IslandState, stat: FishStat): GearResult {
  const f = fishingOf(st);
  if (f.points <= 0) return { ok: false, reason: "쓸 수 있는 점수가 없어요" };
  if (f.stats[stat] >= STAT_CAP) return { ok: false, reason: "이 능력치는 가득 찼어요" };
  return { ok: true, state: { ...st, fishing: { ...f, points: f.points - 1, stats: { ...f.stats, [stat]: f.stats[stat] + 1 } } } };
}

function buyTier(st: IslandState, kind: "rod" | "net"): GearResult {
  const f = fishingOf(st);
  const list = kind === "rod" ? RODS : NETS;
  const next = list[f[kind] + 1];
  if (!next) return { ok: false, reason: "가장 좋은 장비예요" };
  if (st.coins < next.price) return { ok: false, reason: `하트가 ${(next.price - st.coins).toLocaleString()}개 모자라요` };
  return { ok: true, state: { ...st, coins: st.coins - next.price, fishing: { ...f, [kind]: f[kind] + 1 } } };
}
export const buyRod = (st: IslandState) => buyTier(st, "rod");
export const buyNet = (st: IslandState) => buyTier(st, "net");
