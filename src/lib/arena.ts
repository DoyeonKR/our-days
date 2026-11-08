/* 모험 실시간 전투(2026-11-08 [사용자: "레조넌스 팬게임 전투방식을 따라하라고"]) — 순수 엔진. README §14.6
 *
 * 턴제를 걷어내고 실시간 아레나로 바꿨다. 가져온 것은 그 팬게임의 '방식'뿐이다 — 이동 · 가장 가까운 상대 자동 조준 ·
 * 기술 4칸(각자 재사용 대기) · 회피(무적 시간) · 교체(대기 시간) · 공 던지기 · 도망 · 시간제 상태이상 · 맞으면 끊기는 시전.
 * 코드 · 그림 · 이름 · 수치는 전부 우리 것이다(원작 · 팬게임 자료를 하나도 쓰지 않는다 — adventure.ts 머리 주석).
 *
 * 규칙
 *  - 1초 30틱 고정. 같은 시작 판 + 같은 입력 = 같은 결과(서버가 대전 입력 기록을 다시 돌려 판정한다 — replayDuel).
 *    ⚠ 그래서 이 파일은 + − × ÷ · sqrt · floor 만 쓴다(삼각함수 금지 — 엔진마다 끝자리가 다를 수 있다).
 *  - 기술 모양은 엔진의 연출 방식(fx)에서 나온다: 몸통 = 돌진 · 베기 = 앞 부채꼴 · 쏘기 = 탄 · 소용돌이 = 느린 유도탄 ·
 *    물결 = 넓은 탄 · 광선 = 조준선 뒤 직선(시전 시작 때 방향이 굳는다 — 옆으로 피한다) · 쏟아짐 / 터짐 = 표시된 원에 늦게 떨어짐 ·
 *    나에게 = 강화 · 상대에게 = 거리 안이면 명중 판정.
 *  - 피해는 엔진의 damage() 그대로에 DMG_SCALE 을 곱한다(실시간이라 맞는 횟수가 많다). 명중률은 회피가 대신한다(변화 기술만 굴린다).
 *  - 내 생물이 쓰러지면 다음을 고를 때까지 판이 멈춘다(needSwap). 상대는 1초 뒤 다음을 낸다.
 *  - PP 는 쓰지 않는다(재사용 대기가 대신한다). 판이 끝나면 finishBattle(adventure.ts)이 그대로 저장한다. */
import {
  MOVES, SPECIES, activeOf, applyItem, catchChance, damage, effectiveness, moveOf, rnd,
  type BallKey, type Battle, type Fighter, type ItemKey, type Move, type Rng, type StatKey, type Status,
} from "./adventure.ts";

export const TPS = 30;
/** 필드 — 화면(약 420 × 560)보다 넓고 카메라가 따라간다(2026-11-08 [사용자: "필드가 너무 작아"]) */
export const ARENA_W = 760;
export const ARENA_H = 1040;
export const BODY_R = 26;
export const DMG_SCALE = 0.42;
/** 대전 한 판의 최대 길이(틱) — 넘으면 남은 체력 비율로 가른다 */
export const DUEL_TICKS = 150 * TPS;
const sec = (s: number) => Math.round(s * TPS);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const rint = (r: Rng, a: number, b: number) => a + Math.floor(rnd(r) * (b - a + 1));
const stageMul = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));

/* ───────── 기술 모양 ───────── */

export type Shape = "dash" | "combo" | "leap" | "fan" | "shot" | "orb" | "wave" | "beam" | "rain" | "blast" | "nova" | "self" | "ward" | "hex";
/** 낙하 무늬: 한 곳 · 상대 둘레에 흩뿌림 · 나에게서 상대 쪽으로 줄지어 · 상대를 쫓아 차례로 */
export type Pattern = "one" | "scatter" | "line" | "follow";
export type Skill = {
  shape: Shape; windup: number; cd: number; range: number;
  /** 탄 · 원 반지름, 부채꼴 · 자기 둘레의 닿는 거리, 광선의 반폭 */
  r: number;
  speed: number; delay: number;
  /** 0 = 기술의 연타 횟수를 굴린다 */
  n: number;
  /** 동시에 벌려 쏘는 폭(0 = 하나씩 차례로) */
  spread: number;
  /** 한 발의 몫(여러 발이 나뉘는 기술) */
  frac: number;
  /** 돌진 틱 */
  dist: number;
  pierce: boolean; explode: number; home: number;
  /** 부채꼴의 cos(반각) */
  cos: number;
  pattern: Pattern;
  /** 끌어당기는 힘(틱당 거리) */
  pull: number;
  /** 같은 자리에서 몇 번 터지나 */
  pulses: number; every: number;
  /** 광선이 켜져 있는 틱 */
  sustain: number;
};

type Delivery = Partial<Skill> & { shape: Shape };
/** 기술마다 나가는 모양 — 값은 전부 이 게임 것. 새 기술은 여기에 한 줄(arena.test 가 빠진 기술을 잡는다) */
const DELIVERY: Record<string, Delivery> = {
  bump: { shape: "dash", dist: 8 }, flurry: { shape: "combo", dist: 9 }, roll: { shape: "dash", dist: 16, pierce: true, r: 34 },
  slam: { shape: "dash", dist: 18, windup: 10, explode: 110, r: 36 }, dash: { shape: "dash", dist: 12, r: 26 },
  stretch: { shape: "self" }, growl: { shape: "hex", range: 300 }, rest: { shape: "self" }, shell: { shape: "ward", r: 120, delay: 300 }, breeze: { shape: "self" },
  spark: { shape: "shot", r: 13, speed: 430 }, emberrain: { shape: "rain", pattern: "scatter", r: 42, delay: 20 }, flametail: { shape: "fan", r: 136, cos: -0.15, windup: 7 },
  lava: { shape: "blast", pattern: "line", n: 5, r: 58, delay: 10, frac: 0.42, windup: 12 },
  drop: { shape: "shot", r: 14, speed: 390 }, bubbles: { shape: "shot", r: 12, speed: 290, spread: 0.12 }, wave: { shape: "wave", r: 52, speed: 300, pierce: true },
  whirl: { shape: "blast", r: 96, delay: 12, pulses: 4, every: 9, frac: 0.32, pull: 5, windup: 11 },
  leafy: { shape: "shot", n: 3, spread: 0.14, frac: 0.42, r: 11, speed: 450 }, sap: { shape: "blast", r: 58, delay: 12 }, thorn: { shape: "beam", r: 14, windup: 8, sustain: 4, pulses: 1, every: 9 },
  grove: { shape: "nova", r: 205, windup: 16 }, lullaby: { shape: "orb", r: 15, speed: 240, home: 0.08 },
  zap: { shape: "nova", r: 104, windup: 4 }, jolt: { shape: "fan", r: 178, cos: 0.78, windup: 5 }, bolt: { shape: "beam", r: 17, sustain: 4, pulses: 1, every: 9 },
  thunder: { shape: "rain", pattern: "follow", n: 3, r: 60, delay: 9, frac: 0.46, windup: 9 },
  frost: { shape: "fan", r: 205, cos: 0.72, windup: 7 }, icicle: { shape: "shot", r: 12, speed: 520 }, shard: { shape: "shot", r: 18, speed: 400, explode: 78 }, glacier: { shape: "blast", r: 108, delay: 26, windup: 10 },
  antenna: { shape: "dash", dist: 9 }, buzz: { shape: "combo", dist: 10 }, sting: { shape: "shot", r: 9, speed: 590 }, horn: { shape: "dash", dist: 19, pierce: true, r: 34, windup: 9 },
  pinch: { shape: "dash", dist: 11, windup: 2 }, siphon: { shape: "blast", r: 62, delay: 12 }, nightfall: { shape: "wave", r: 34, speed: 440, pierce: true, windup: 5 }, moonless: { shape: "nova", r: 196, windup: 13 },
  beckon: { shape: "orb", r: 17, speed: 270, home: 0.07 }, spook: { shape: "blast", r: 66, delay: 6 }, blanket: { shape: "leap", r: 104, windup: 6 }, haunt: { shape: "orb", n: 5, r: 12, speed: 310, home: 0.16, frac: 0.3, windup: 10 },
  glitter: { shape: "shot", r: 13, speed: 420 }, candy: { shape: "orb", r: 10, speed: 350, home: 0.12 }, dreamy: { shape: "beam", r: 18, sustain: 13, pulses: 3, every: 5, frac: 0.36 }, rainbow: { shape: "beam", r: 30, sustain: 22, pulses: 5, every: 5, frac: 0.3, windup: 15 },
  scent: { shape: "hex", range: 320 },
  stomp: { shape: "leap", r: 96, windup: 6 }, shout: { shape: "nova", r: 150, windup: 8 },
  cinder: { shape: "shot", r: 18, speed: 360, explode: 90 }, firefan: { shape: "fan", r: 215, cos: 0.55, windup: 11 },
  spout: { shape: "blast", pattern: "follow", n: 2, r: 56, delay: 11, frac: 0.55 }, tide: { shape: "wave", r: 70, speed: 240, pierce: true, windup: 12 },
  seedgun: { shape: "shot", r: 10, speed: 480 }, vinepull: { shape: "blast", r: 84, delay: 10, pulses: 3, every: 9, frac: 0.4, pull: 6, windup: 10 },
  arc: { shape: "orb", r: 14, speed: 420, home: 0.14 }, cage: { shape: "rain", pattern: "scatter", n: 5, r: 46, delay: 16, frac: 0.34, windup: 10 },
  snowball: { shape: "shot", r: 22, speed: 300, explode: 70 }, veil: { shape: "nova", r: 175, windup: 12 },
  swarm: { shape: "orb", r: 10, speed: 300, home: 0.15 }, webnet: { shape: "fan", r: 150, cos: 0.6, windup: 7 },
  ambush: { shape: "leap", r: 90, windup: 4 }, nightrain: { shape: "rain", pattern: "line", n: 4, r: 56, delay: 10, frac: 0.4, windup: 11 },
  wail: { shape: "wave", r: 44, speed: 340, pierce: true }, gravecall: { shape: "blast", r: 90, delay: 14, pulses: 3, every: 8, frac: 0.42, pull: 4, windup: 11 },
  ribbon: { shape: "fan", r: 170, cos: 0.7, windup: 6 }, shooting: { shape: "rain", pattern: "scatter", n: 5, r: 44, delay: 16, frac: 0.34, windup: 10 },
  mudball: { shape: "shot", r: 15, speed: 360 }, gravel: { shape: "shot", r: 11, speed: 430 }, burrow: { shape: "dash", dist: 18, pierce: true, r: 34, windup: 7 },
  tremor: { shape: "nova", r: 200, windup: 15 }, pillar: { shape: "blast", pattern: "line", n: 3, r: 50, delay: 9, frac: 0.5, windup: 7 }, slide: { shape: "rain", pattern: "follow", n: 3, r: 64, delay: 9, frac: 0.46, windup: 10 },
  thought: { shape: "orb", r: 14, speed: 320, home: 0.1 }, echo: { shape: "orb", r: 11, speed: 360, home: 0.12 }, mindray: { shape: "beam", r: 17, sustain: 8, pulses: 2, every: 6, frac: 0.55, windup: 11 },
  headstorm: { shape: "blast", r: 110, delay: 18, windup: 11 }, foresee: { shape: "shot", r: 13, speed: 520 }, rift: { shape: "blast", pattern: "line", n: 4, r: 54, delay: 9, frac: 0.4, windup: 10 },
};

/** 틀 값 — 모양마다 */
const BASE: Record<Shape, { windup: number; range: number; r: number; speed: number; delay: number; dist: number }> = {
  dash: { windup: 4, range: 230, r: 30, speed: 540, delay: 0, dist: 10 },
  combo: { windup: 3, range: 220, r: 30, speed: 540, delay: 0, dist: 9 },
  leap: { windup: 6, range: 420, r: 100, speed: 0, delay: 0, dist: 0 },
  fan: { windup: 6, range: 118, r: 118, speed: 0, delay: 0, dist: 0 },
  shot: { windup: 5, range: 540, r: 12, speed: 400, delay: 0, dist: 0 },
  orb: { windup: 8, range: 600, r: 20, speed: 240, delay: 0, dist: 0 },
  wave: { windup: 8, range: 460, r: 44, speed: 300, delay: 0, dist: 0 },
  beam: { windup: 13, range: 620, r: 16, speed: 0, delay: 0, dist: 0 },
  rain: { windup: 8, range: 9999, r: 62, speed: 0, delay: 18, dist: 0 },
  blast: { windup: 8, range: 9999, r: 56, speed: 0, delay: 13, dist: 0 },
  nova: { windup: 8, range: 160, r: 150, speed: 0, delay: 0, dist: 0 },
  self: { windup: 9, range: 0, r: 0, speed: 0, delay: 0, dist: 0 },
  ward: { windup: 9, range: 0, r: 120, speed: 0, delay: 300, dist: 0 },
  hex: { windup: 8, range: 290, r: 0, speed: 0, delay: 0, dist: 0 },
};

/** 기술 하나의 실시간 규칙 */
export function skillOf(id: string): Skill {
  const mv = moveOf(id);
  const d: Delivery = DELIVERY[id] ?? { shape: "dash" };
  const b = BASE[d.shape];
  const avg = mv.hits ? (mv.hits[0] + mv.hits[1]) / 2 : 1;
  const total = mv.power * avg;
  const cd = mv.power === 0 ? sec(mv.heal ? 12 : d.shape === "ward" ? 16 : 7) : sec(0.7 + total / 50);
  // 센 기술일수록 범위가 커진다
  const grow = mv.power >= 90 ? 1.2 : 1;
  const sk: Skill = {
    shape: d.shape, cd,
    windup: mv.priority ? Math.min(2, d.windup ?? 2) : d.windup ?? b.windup,
    range: d.range ?? (d.shape === "fan" ? d.r ?? b.r : d.shape === "nova" ? d.r ?? b.r : b.range),
    r: Math.round((d.r ?? b.r) * (d.shape === "ward" ? 1 : grow)),
    speed: d.speed ?? b.speed, delay: d.delay ?? b.delay,
    n: d.n ?? 0, spread: d.spread ?? 0, frac: d.frac ?? 1, dist: d.dist ?? b.dist,
    pierce: d.pierce ?? false, explode: d.explode ?? 0, home: d.home ?? 0,
    cos: d.cos ?? 0.3, pattern: d.pattern ?? "one", pull: d.pull ?? 0,
    pulses: d.pulses ?? 1, every: d.every ?? 6, sustain: d.sustain ?? 0,
  };
  return sk;
}

/** 빠른 생물일수록 센 기술의 준비가 짧다(최대 60%) */
export function windupOf(sk: Skill, power: number, spd: number): number {
  if (power < 90) return sk.windup;
  return Math.max(3, Math.round(sk.windup * (1 - Math.min(0.6, spd / 260))));
}

const MELEE: readonly Shape[] = ["dash", "combo", "fan", "nova", "leap"];

/* ───────── 상태 ───────── */

type Cast = { slot: number; move: string; t: number; total: number; tx: number; ty: number; dx: number; dy: number };
type Lunge = { move: string; t: number; dx: number; dy: number; hits: number; done: boolean; more: number };
type Chain = { move: string; left: number; t: number; n: number };
type Follow = { move: string; left: number; t: number; n: number };
type Leap = { move: string; t: number; total: number; x0: number; y0: number; x1: number; y1: number };
type Burst = { move: string; left: number; t: number; n: number };
type Buff = { stat: StatKey; by: number; t: number };
type Channel = { kind: "item" | "run"; item?: ItemKey; t: number; total: number };

export type Unit = {
  x: number; y: number;
  /** 지난 틱 자리 — 화면이 사이를 메운다 */
  px: number; py: number;
  kx: number; ky: number;
  /** 보는 방향(가장 가까운 상대 쪽) */
  fx: number; fy: number;
  cd: number[];
  cast: Cast | null;
  lunge: Lunge | null;
  leap: Leap | null;
  chain: Chain | null;
  follow: Follow | null;
  /** 광선을 쏘는 동안 발이 묶인다 */
  lock: number;
  burst: Burst | null;
  channel: Channel | null;
  dodge: number; ddx: number; ddy: number; dodgeCd: number; iframe: number;
  stun: number; hitstun: number;
  statusT: number; dotT: number;
  buffs: Buff[];
  enter: number;
  /** 컴퓨터가 정한 것 — 생각 간격 · 옆걸음 방향 · 지금 방향 */
  ai: { think: number; strafe: number; dir: number };
};
export type Shot = { id: number; side: 0 | 1; move: string; x: number; y: number; px: number; py: number; dx: number; dy: number; speed: number; r: number; life: number; home: number; n: number; passed: boolean; frac: number; explode: number; pierce: boolean; done: boolean };
export type Zone = { id: number; side: 0 | 1; move: string; x: number; y: number; r: number; t: number; total: number; pulses: number; n: number; frac: number; every: number; pull: number; ward: boolean };
export type BeamNow = { id: number; side: 0 | 1; move: string; x: number; y: number; dx: number; dy: number; len: number; r: number; t: number; total: number; pulses: number; every: number; n: number; frac: number };
export type Throw = { ball: BallKey; x0: number; y0: number; x1: number; y1: number; t: number; total: number; aim: number };
export type Capture = { ball: BallKey; x: number; y: number; t: number; shakes: number; caught: boolean };
export type Bag = { balls: Record<BallKey, number>; items: Record<ItemKey, number> };

export type AEv =
  | { t: "cast"; side: 0 | 1; move: string }
  | { t: "release"; side: 0 | 1; move: string; x: number; y: number; tx: number; ty: number }
  | { t: "hit"; side: 0 | 1; dmg: number; eff: number; crit: boolean; move?: string; dot?: Status; recoil?: boolean; x: number; y: number }
  | { t: "miss"; side: 0 | 1; x: number; y: number }
  | { t: "heal"; side: 0 | 1; amount: number; drain?: boolean }
  | { t: "status"; side: 0 | 1; status: Status; on: boolean }
  | { t: "stat"; side: 0 | 1; stat: StatKey; by: number }
  | { t: "interrupt"; side: 0 | 1 }
  | { t: "dodge"; side: 0 | 1 }
  | { t: "faint"; side: 0 | 1 }
  | { t: "swap"; side: 0 | 1; to: number }
  | { t: "pulse"; side: 0 | 1; move: string; x: number; y: number; r: number }
  | { t: "nova"; side: 0 | 1; move: string; x: number; y: number; r: number }
  | { t: "throw"; ball: BallKey }
  | { t: "shake"; n: number }
  | { t: "capture"; caught: boolean }
  | { t: "text"; s: string }
  | { t: "end"; result: NonNullable<Battle["over"]> };

export type Arena = {
  b: Battle;
  mode: "wild" | "duel";
  tick: number;
  units: [Unit, Unit];
  swapCd: [number, number];
  shots: Shot[];
  zones: Zone[];
  beams: BeamNow[];
  nid: number;
  throwing: Throw | null;
  capture: Capture | null;
  /** 야생에서만 — 가방(쓰면 준다) */
  bag: Bag | null;
  /** 상대가 다음 생물을 낼 때까지 */
  foeNext: number;
  limit: number;
  ev: AEv[];
};

export type ArenaInput = { dir: number; skill?: number; dodge?: boolean; swap?: number; ball?: BallKey; item?: ItemKey; run?: boolean };

const S = Math.SQRT1_2;
/** 방향 8개(0 = 멈춤) — 1 위부터 시계 방향 */
export const DIRS: readonly [number, number][] = [[0, 0], [0, -1], [S, -S], [1, 0], [S, S], [0, 1], [-S, S], [-1, 0], [-S, -S]];

/** 막대 · 화살표 입력을 8방향으로(삼각함수 없이 — 22.5° 경계 = tan 0.4142) */
export function dirOf(x: number, y: number, dead = 0.28): number {
  if (x * x + y * y < dead * dead) return 0;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const sx = ax > 0.4142 * ay ? Math.sign(x) : 0;
  const sy = ay > 0.4142 * ax ? Math.sign(y) : 0;
  const k = `${sx},${sy}`;
  return ({ "0,-1": 1, "1,-1": 2, "1,0": 3, "1,1": 4, "0,1": 5, "-1,1": 6, "-1,0": 7, "-1,-1": 8 } as Record<string, number>)[k] ?? 0;
}

const STATUS_T: Record<Status, number> = { burn: sec(6), poison: sec(8), para: sec(5), sleep: sec(2.5) };
const nameOf = (f: Fighter) => SPECIES[f.mon.species].name;

function unit(side: 0 | 1, f: Fighter): Unit {
  const x = ARENA_W / 2;
  const y = side === 0 ? ARENA_H / 2 + 170 : ARENA_H / 2 - 170;
  return {
    x, y, px: x, py: y, kx: 0, ky: 0, fx: 0, fy: side === 0 ? -1 : 1,
    cd: [0, 0, 0, 0], cast: null, lunge: null, leap: null, chain: null, follow: null, lock: 0, burst: null, channel: null,
    dodge: 0, ddx: 0, ddy: 0, dodgeCd: 0, iframe: 0, stun: 0, hitstun: 0,
    statusT: f.mon.status ? STATUS_T[f.mon.status] : 0, dotT: sec(1), buffs: [], enter: sec(0.6),
    ai: { think: 0, strafe: side ? 1 : -1, dir: 0 },
  };
}

/** 판을 연다 — 전투(Battle)는 adventure.ts 의 것 그대로(startWild · startDuel 이 만든다). 넘긴 전투를 직접 바꾼다. */
export function newArena(b: Battle, bag: Bag | null, limit = b.wild ? 0 : DUEL_TICKS): Arena {
  for (const s of b.sides) for (const f of s.team) if (f.mon.status === "sleep") f.mon.status = undefined;
  return {
    b,
    mode: b.wild ? "wild" : "duel",
    tick: 0,
    units: [unit(0, activeOf(b, 0)), unit(1, activeOf(b, 1))],
    swapCd: [0, 0],
    shots: [],
    zones: [],
    beams: [],
    nid: 1,
    throwing: null,
    capture: null,
    bag: b.wild && bag ? { balls: { ...bag.balls }, items: { ...bag.items } } : null,
    foeNext: 0,
    limit,
    ev: [],
  };
}

/** 겨누기 고리 — 0(크다) → 1(가장 작다) → 0, 40틱 한 바퀴. 화면도 같은 값으로 그린다. */
export function ringAim(tick: number): number {
  const p = (tick % 40) / 40;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

export function moveSpeed(f: Fighter): number {
  const v = clamp(105 + f.stats.spd * stageMul(f.stages.spd) * 1.4, 105, 235);
  return f.mon.status === "para" ? v * 0.6 : v;
}

function norm(x: number, y: number): [number, number] {
  const m = Math.sqrt(x * x + y * y);
  return m > 1e-6 ? [x / m, y / m] : [0, 0];
}

/* ───────── 한 틱 ───────── */

/** 한 틱 진행. inp = 내 입력, foe = 상대 입력(없으면 컴퓨터). 사건은 a.ev 에 쌓인다(틱마다 비운다). */
export function stepArena(a: Arena, inp: ArenaInput, foe?: ArenaInput): void {
  a.ev = [];
  const b = a.b;
  if (b.over) return;
  const rng: Rng = { s: b.seed };
  if (b.needSwap) {
    if (inp.swap != null) swapTo(a, 0, inp.swap, true);
    b.seed = rng.s;
    return;
  }
  a.tick++;
  if (a.capture) {
    tickCapture(a);
    b.seed = rng.s;
    return;
  }
  const in1 = foe ?? think(a, 1, rng);
  control(a, 0, inp, rng);
  control(a, 1, in1, rng);
  separate(a);
  updateShots(a, rng);
  updateZones(a, rng);
  updateBeams(a, rng);
  updateThrow(a, rng);
  timers(a, 0);
  timers(a, 1);
  resolve(a);
  if (!b.over && a.limit && a.tick >= a.limit) {
    const win = share(b, 0) > share(b, 1);
    b.over = win ? "win" : "lose";
    a.ev.push({ t: "text", s: "시간 끝! 남은 체력으로 가른다" }, { t: "end", result: b.over });
  }
  b.seed = rng.s;
}

export function share(b: Battle, side: 0 | 1): number {
  const t = b.sides[side].team;
  const max = t.reduce((s, f) => s + f.stats.hp, 0);
  return max ? t.reduce((s, f) => s + Math.max(0, f.mon.hp), 0) / max : 0;
}

function control(a: Arena, side: 0 | 1, inp: ArenaInput, rng: Rng) {
  const b = a.b;
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const f = activeOf(b, side);
  u.px = u.x;
  u.py = u.y;
  if (f.mon.hp <= 0) return;
  const [ax, ay] = norm(o.x - u.x, o.y - u.y);
  if (ax || ay) {
    u.fx = ax;
    u.fy = ay;
  }
  // 밀려남은 언제나
  u.x += u.kx / TPS;
  u.y += u.ky / TPS;
  u.kx *= 0.8;
  u.ky *= 0.8;
  if (u.enter > 0) {
    u.enter--;
    clampPos(u);
    return;
  }
  const busy = u.stun > 0 || u.hitstun > 0;
  if (!busy) {
    // 교체
    if (inp.swap != null && a.swapCd[side] === 0 && !u.lunge && !u.leap && !u.lock) {
      if (swapTo(a, side, inp.swap, false)) return;
    }
    // 회피
    if (inp.dodge && u.dodgeCd === 0 && f.mon.status !== "para" && !u.lunge && !u.leap) {
      let [dx, dy] = DIRS[inp.dir] ?? [0, 0];
      if (!dx && !dy) [dx, dy] = [-u.fx, -u.fy];
      u.dodge = 5;
      u.ddx = dx;
      u.ddy = dy;
      u.iframe = 8;
      u.dodgeCd = sec(1.1);
      u.lock = 0;
      u.chain = null;
      if (u.cast) cancelCast(u, sec(0.4));
      u.channel = null;
      a.ev.push({ t: "dodge", side });
    }
    if (a.bag && side === 0) {
      if (inp.ball && a.bag.balls[inp.ball] > 0 && !a.throwing && !u.cast && !u.channel) {
        a.bag.balls[inp.ball]--;
        a.throwing = { ball: inp.ball, x0: u.x, y0: u.y, x1: o.x, y1: o.y, t: 0, total: 16, aim: ringAim(a.tick) };
        a.ev.push({ t: "throw", ball: inp.ball });
      }
      if (inp.item && a.bag.items[inp.item] > 0 && !u.channel && !u.cast) u.channel = { kind: "item", item: inp.item, t: 0, total: 18 };
      if (inp.run && !u.channel && !u.cast) {
        u.channel = { kind: "run", t: 0, total: 36 };
        a.ev.push({ t: "text", s: "도망칠 틈을 보는 중…" });
      }
    }
    // 기술
    const k = inp.skill;
    if (k != null && k >= 0 && k < 4 && !u.cast && !u.lunge && !u.leap && !u.chain && !u.lock && !u.channel && u.dodge === 0 && u.cd[k] === 0 && f.mon.moves[k]) {
      const id = f.mon.moves[k].id;
      const sk = skillOf(id);
      const spd = f.stats.spd * stageMul(f.stages.spd);
      u.cast = { slot: k, move: id, t: 0, total: windupOf(sk, moveOf(id).power, spd), tx: o.x, ty: o.y, dx: u.fx, dy: u.fy };
      a.ev.push({ t: "cast", side, move: id });
    }
  }
  // 움직이기
  if (u.dodge > 0) {
    u.x += (u.ddx * 560) / TPS;
    u.y += (u.ddy * 560) / TPS;
    u.dodge--;
  } else if (u.lunge) {
    tickLunge(a, side, rng);
  } else if (u.leap) {
    tickLeap(a, side, rng);
  } else if (!busy && !u.lock) {
    const [dx, dy] = DIRS[inp.dir] ?? [0, 0];
    const v = (moveSpeed(f) * (u.cast ? 0.35 : u.channel ? 0.15 : 1)) / TPS;
    u.x += dx * v;
    u.y += dy * v;
  }
  clampPos(u);
  // 시전 · 연발 · 집중
  if (u.cast && !busy) {
    u.cast.t++;
    if (u.cast.t >= u.cast.total) release(a, side, rng);
  }
  if (u.burst) {
    if (--u.burst.t <= 0) {
      spawnShot(a, side, u.burst.move, u.burst.n, 0);
      u.burst.n++;
      u.burst.left--;
      u.burst.t = 4;
      if (u.burst.left <= 0) u.burst = null;
    }
  }
  if (u.chain) {
    if (--u.chain.t <= 0) {
      const dx = o.x - u.x;
      const dy = o.y - u.y;
      if (dx * dx + dy * dy <= 150 * 150) hit(a, side, moveOf(u.chain.move), u.chain.n, rng);
      u.chain.n++;
      u.chain.left--;
      u.chain.t = 4;
      if (u.chain.left <= 0) u.chain = null;
    }
  }
  if (u.follow) {
    if (--u.follow.t <= 0) {
      placeZone(a, side, u.follow.move, o.x, o.y, u.follow.n, 0);
      u.follow.n++;
      u.follow.left--;
      u.follow.t = 13;
      if (u.follow.left <= 0) u.follow = null;
    }
  }
  if (u.channel && !busy) {
    if (++u.channel.t >= u.channel.total) finishChannel(a, side);
  }
}

function clampPos(u: Unit) {
  u.x = clamp(u.x, BODY_R + 6, ARENA_W - BODY_R - 6);
  u.y = clamp(u.y, BODY_R + 30, ARENA_H - BODY_R - 6);
}

function separate(a: Arena) {
  const [p, q] = a.units;
  if (activeOf(a.b, 0).mon.hp <= 0 || activeOf(a.b, 1).mon.hp <= 0) return;
  if (p.lunge || q.lunge || p.leap || q.leap) return; // 몸통 기술은 뚫고 지나간다
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const min = BODY_R * 2 - 4;
  if (d >= min) return;
  const [nx, ny] = d > 1e-6 ? [dx / d, dy / d] : [0, 1];
  const push = (min - d) / 2;
  p.x -= nx * push;
  p.y -= ny * push;
  q.x += nx * push;
  q.y += ny * push;
  clampPos(p);
  clampPos(q);
}

function cancelCast(u: Unit, cd: number) {
  if (!u.cast) return;
  u.cd[u.cast.slot] = Math.max(u.cd[u.cast.slot], cd);
  u.cast = null;
}

function hitsOf(mv: Move, rng: Rng) {
  return mv.hits ? rint(rng, mv.hits[0], mv.hits[1]) : 1;
}

function release(a: Arena, side: 0 | 1, rng: Rng) {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const c = u.cast!;
  u.cast = null;
  const mv = moveOf(c.move);
  const sk = skillOf(c.move);
  const f = activeOf(a.b, side);
  const foeSide = (side ? 0 : 1) as 0 | 1;
  u.cd[c.slot] = f.mon.status === "para" ? Math.round(sk.cd * 1.4) : sk.cd;
  const count = sk.n || hitsOf(mv, rng);
  const beam = sk.shape === "beam";
  a.ev.push({ t: "release", side, move: mv.id, x: u.x, y: u.y, tx: beam ? u.x + c.dx * sk.range : o.x, ty: beam ? u.y + c.dy * sk.range : o.y });
  const dx = o.x - u.x;
  const dy = o.y - u.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  switch (sk.shape) {
    case "dash":
    case "combo":
      u.lunge = { move: mv.id, t: sk.dist, dx: u.fx, dy: u.fy, hits: sk.shape === "combo" ? 1 : count, done: false, more: sk.shape === "combo" ? count - 1 : 0 };
      break;
    case "leap":
      u.leap = { move: mv.id, t: 0, total: 15, x0: u.x, y0: u.y, x1: o.x, y1: o.y };
      break;
    case "fan": {
      const dot = d > 0 ? (dx * c.dx + dy * c.dy) / d : 1;
      if (d <= sk.r + BODY_R && dot >= sk.cos) for (let n = 1; n <= count; n++) if (!hit(a, side, mv, n, rng, sk.frac)) break;
      break;
    }
    case "shot":
    case "orb":
    case "wave":
      if (sk.spread > 0) {
        for (let n = 0; n < count; n++) spawnShot(a, side, mv.id, n + 1, (n - (count - 1) / 2) * sk.spread);
      } else {
        spawnShot(a, side, mv.id, 1, 0);
        if (count > 1) u.burst = { move: mv.id, left: count - 1, t: 4, n: 2 };
      }
      break;
    case "beam":
      a.beams.push({ id: a.nid++, side, move: mv.id, x: u.x, y: u.y, dx: c.dx, dy: c.dy, len: sk.range, r: sk.r, t: Math.max(1, sk.sustain), total: Math.max(1, sk.sustain), pulses: sk.pulses, every: sk.every, n: 1, frac: sk.frac });
      u.lock = Math.max(1, sk.sustain);
      break;
    case "rain":
    case "blast":
      if (sk.pattern === "scatter") {
        for (let n = 0; n < count; n++) {
          const rad = n === 0 ? 0 : 30 + rnd(rng) * 62;
          const [ux, uy] = norm(rnd(rng) * 2 - 1, rnd(rng) * 2 - 1); // 삼각함수 없이 아무 방향
          placeZone(a, side, mv.id, o.x + ux * rad, o.y + uy * rad, n + 1, n * 4);
        }
      } else if (sk.pattern === "line") {
        const [ux, uy] = norm(dx, dy);
        for (let n = 0; n < count; n++) placeZone(a, side, mv.id, u.x + ux * (70 + n * 76), u.y + uy * (70 + n * 76), n + 1, n * 5);
      } else if (sk.pattern === "follow") {
        placeZone(a, side, mv.id, o.x, o.y, 1, 0);
        if (count > 1) u.follow = { move: mv.id, left: count - 1, t: 13, n: 2 };
      } else placeZone(a, side, mv.id, o.x, o.y, 1, 0);
      break;
    case "nova":
      a.ev.push({ t: "nova", side, move: mv.id, x: u.x, y: u.y, r: sk.r });
      if (d <= sk.r + BODY_R) for (let n = 1; n <= count; n++) if (!hit(a, side, mv, n, rng, sk.frac)) break;
      break;
    case "self":
      if (mv.heal) {
        const amount = Math.min(f.stats.hp - f.mon.hp, Math.floor(f.stats.hp * mv.heal));
        f.mon.hp += amount;
        a.ev.push({ t: "heal", side, amount });
      }
      if (mv.boost) boost(a, side, mv.boost.stat, mv.boost.by);
      break;
    case "ward":
      a.zones = a.zones.filter((z) => !(z.ward && z.side === side));
      a.zones.push({ id: a.nid++, side, move: mv.id, x: u.x, y: u.y, r: sk.r, t: sk.delay, total: sk.delay, pulses: 0, n: 1, frac: 1, every: 6, pull: 0, ward: true });
      break;
    case "hex": {
      const tf = activeOf(a.b, foeSide);
      const ok = d <= sk.range && o.iframe === 0 && tf.mon.hp > 0 && rnd(rng) * 100 < mv.acc;
      a.ev.push({ t: "nova", side, move: mv.id, x: u.x, y: u.y, r: sk.range });
      if (!ok) a.ev.push({ t: "miss", side: foeSide, x: o.x, y: o.y });
      else {
        if (mv.boost) boost(a, foeSide, mv.boost.stat, mv.boost.by);
        if (mv.inflict) inflict(a, foeSide, mv.inflict.status, 1);
      }
      break;
    }
  }
}

function placeZone(a: Arena, side: 0 | 1, move: string, x: number, y: number, n: number, extra: number) {
  const sk = skillOf(move);
  const zx = clamp(x, 10, ARENA_W - 10);
  const zy = clamp(y, 10, ARENA_H - 10);
  a.zones.push({ id: a.nid++, side, move, x: zx, y: zy, r: sk.r, t: sk.delay + extra, total: sk.delay + extra, pulses: sk.pulses, n, frac: sk.frac, every: sk.every, pull: sk.pull, ward: false });
}

function spawnShot(a: Arena, side: 0 | 1, move: string, n: number, spread: number) {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const sk = skillOf(move);
  let [dx, dy] = norm(o.x - u.x, o.y - u.y);
  let k = spread;
  if (!k && n > 1) k = (n % 2 ? 1 : -1) * 0.09 * Math.ceil((n - 1) / 2);
  if (k) [dx, dy] = norm(dx - dy * k, dy + dx * k);
  const life = Math.ceil((sk.range / sk.speed) * TPS);
  a.shots.push({ id: a.nid++, side, move, x: u.x + dx * (BODY_R + 4), y: u.y + dy * (BODY_R + 4), px: u.x, py: u.y, dx, dy, speed: sk.speed, r: sk.r, life, home: sk.home, n, passed: false, frac: sk.frac, explode: sk.explode, pierce: sk.pierce, done: false });
}

function tickLunge(a: Arena, side: 0 | 1, rng: Rng) {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const l = u.lunge!;
  const step = 540 / TPS;
  const mv = moveOf(l.move);
  const sk = skillOf(l.move);
  const dx = o.x - u.x;
  const dy = o.y - u.y;
  const reach = BODY_R + sk.r + 6;
  if (!l.done && dx * dx + dy * dy <= reach * reach) {
    l.done = true;
    for (let n = 1; n <= l.hits; n++) if (!hit(a, side, mv, n, rng)) break;
    if (l.more > 0) u.chain = { move: l.move, left: l.more, t: 4, n: 2 };
    if (sk.explode) a.ev.push({ t: "pulse", side, move: l.move, x: o.x, y: o.y, r: sk.explode });
    if (!sk.pierce) {
      u.lunge = null;
      u.kx = -l.dx * 160;
      u.ky = -l.dy * 160;
      return;
    }
  }
  u.x += l.dx * step;
  u.y += l.dy * step;
  if (--l.t <= 0) u.lunge = null;
}

function tickLeap(a: Arena, side: 0 | 1, rng: Rng) {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const l = u.leap!;
  l.t++;
  u.iframe = Math.max(u.iframe, 2);
  const k = Math.min(1, l.t / l.total);
  u.x = l.x0 + (l.x1 - l.x0) * k;
  u.y = l.y0 + (l.y1 - l.y0) * k;
  if (l.t < l.total) return;
  u.leap = null;
  const mv = moveOf(l.move);
  const sk = skillOf(l.move);
  a.ev.push({ t: "nova", side, move: l.move, x: u.x, y: u.y, r: sk.r });
  const dx = o.x - u.x;
  const dy = o.y - u.y;
  if (dx * dx + dy * dy <= (sk.r + BODY_R) * (sk.r + BODY_R)) hit(a, side, mv, 1, rng);
}

/** 맞히기 — 무적이면 피했다. 맞으면 시전 · 집중이 끊긴다. 남은 체력이 있으면 true. */
function hit(a: Arena, att: 0 | 1, mv: Move, n: number, rng: Rng, frac = 1): boolean {
  const def = (att ? 0 : 1) as 0 | 1;
  const t = a.units[def];
  const df = activeOf(a.b, def);
  const af = activeOf(a.b, att);
  if (df.mon.hp <= 0) return false;
  if (t.iframe > 0 || t.enter > 0) {
    a.ev.push({ t: "miss", side: def, x: t.x, y: t.y });
    return false;
  }
  const r = damage(af, df, mv, rng);
  const warded = a.zones.some((z) => z.ward && z.side === def && (t.x - z.x) * (t.x - z.x) + (t.y - z.y) * (t.y - z.y) <= z.r * z.r);
  const dmg = Math.max(1, Math.floor(r.dmg * DMG_SCALE * frac * (warded ? 0.5 : 1)));
  const dealt = Math.min(df.mon.hp, dmg);
  df.mon.hp -= dealt;
  a.ev.push({ t: "hit", side: def, dmg: dealt, eff: r.eff, crit: r.crit, move: mv.id, x: t.x, y: t.y });
  if (t.cast) {
    cancelCast(t, sec(0.6));
    a.ev.push({ t: "interrupt", side: def });
  }
  t.chain = null;
  if (t.channel) {
    t.channel = null;
    a.ev.push({ t: "interrupt", side: def });
  }
  t.hitstun = Math.max(t.hitstun, mv.power >= 90 || r.crit ? 7 : 5);
  const [nx, ny] = norm(t.x - a.units[att].x, t.y - a.units[att].y);
  const kb = 110 + mv.power * 2.4 + (r.crit ? 160 : 0) + (r.eff > 1 ? 80 : 0);
  t.kx = nx * kb;
  t.ky = ny * kb;
  if (df.mon.status === "sleep") {
    df.mon.status = undefined;
    t.stun = 0;
    t.statusT = 0;
    a.ev.push({ t: "status", side: def, status: "sleep", on: false });
  }
  if (mv.drain && af.mon.hp > 0) {
    const back = Math.min(af.stats.hp - af.mon.hp, Math.max(1, Math.floor(dealt * mv.drain)));
    if (back > 0) {
      af.mon.hp += back;
      a.ev.push({ t: "heal", side: att, amount: back, drain: true });
    }
  }
  if (mv.recoil && af.mon.hp > 0) {
    const back = Math.min(af.mon.hp, Math.max(1, Math.floor(dealt * mv.recoil)));
    af.mon.hp -= back;
    const u = a.units[att];
    a.ev.push({ t: "hit", side: att, dmg: back, eff: 1, crit: false, recoil: true, x: u.x, y: u.y });
    if (af.mon.hp <= 0) a.ev.push({ t: "faint", side: att });
  }
  if (mv.flinch && df.mon.hp > 0 && rnd(rng) < mv.flinch) t.stun = Math.max(t.stun, sec(0.5));
  if (mv.inflict && df.mon.hp > 0 && mv.power > 0) inflict(a, def, mv.inflict.status, mv.inflict.chance, rng);
  if (df.mon.hp <= 0) {
    a.ev.push({ t: "faint", side: def });
    return false;
  }
  return true;
}

function inflict(a: Arena, side: 0 | 1, st: Status, chance: number, rng?: Rng) {
  const f = activeOf(a.b, side);
  if (f.mon.status || f.mon.hp <= 0) {
    if (chance >= 1) a.ev.push({ t: "text", s: "그러나 아무 일도 없었다" });
    return;
  }
  if (chance < 1 && rng && rnd(rng) >= chance) return;
  const ty = SPECIES[f.mon.species].type;
  if ((st === "burn" && ty === "불꽃") || (st === "para" && ty === "전기")) return;
  f.mon.status = st;
  const u = a.units[side];
  u.statusT = STATUS_T[st];
  u.dotT = sec(1);
  if (st === "sleep") {
    u.stun = STATUS_T.sleep;
    if (u.cast) cancelCast(u, sec(0.4));
    u.channel = null;
  }
  a.ev.push({ t: "status", side, status: st, on: true });
}

function boost(a: Arena, side: 0 | 1, stat: StatKey, by: number) {
  const f = activeOf(a.b, side);
  const before = f.stages[stat];
  f.stages[stat] = clamp(before + by, -6, 6);
  const d = f.stages[stat] - before;
  if (d) a.units[side].buffs.push({ stat, by: d, t: sec(12) });
  a.ev.push({ t: "stat", side, stat, by: d });
}

function updateShots(a: Arena, rng: Rng) {
  const keep: Shot[] = [];
  for (const s of a.shots) {
    s.px = s.x;
    s.py = s.y;
    const foeSide = (s.side ? 0 : 1) as 0 | 1;
    const o = a.units[foeSide];
    const of = activeOf(a.b, foeSide);
    if (s.home && of.mon.hp > 0) {
      const [tx, ty] = norm(o.x - s.x, o.y - s.y);
      [s.dx, s.dy] = norm(s.dx + tx * s.home, s.dy + ty * s.home);
    }
    s.x += (s.dx * s.speed) / TPS;
    s.y += (s.dy * s.speed) / TPS;
    const dx = o.x - s.x;
    const dy = o.y - s.y;
    const rr = s.r + BODY_R - 4 + (s.explode ? s.explode * 0.4 : 0);
    let gone = --s.life <= 0 || s.x < -40 || s.x > ARENA_W + 40 || s.y < -40 || s.y > ARENA_H + 40;
    if (!gone && !s.done && of.mon.hp > 0 && dx * dx + dy * dy <= rr * rr && o.enter === 0) {
      if (o.iframe > 0) {
        if (!s.passed) a.ev.push({ t: "miss", side: foeSide, x: o.x, y: o.y });
        s.passed = true;
      } else {
        const mv = moveOf(s.move);
        if (mv.power > 0) hit(a, s.side, mv, s.n, rng, s.frac);
        else if (rnd(rng) * 100 < mv.acc && mv.inflict) inflict(a, foeSide, mv.inflict.status, 1);
        else a.ev.push({ t: "miss", side: foeSide, x: o.x, y: o.y });
        if (s.explode) a.ev.push({ t: "pulse", side: s.side, move: s.move, x: s.x, y: s.y, r: s.explode });
        if (s.pierce) s.done = true;
        else gone = true;
      }
    }
    if (!gone) keep.push(s);
  }
  a.shots = keep;
}

function updateZones(a: Arena, rng: Rng) {
  const keep: Zone[] = [];
  for (const z of a.zones) {
    if (z.ward) {
      if (--z.t > 0) keep.push(z);
      continue;
    }
    const foeSide = (z.side ? 0 : 1) as 0 | 1;
    const o = a.units[foeSide];
    const of = activeOf(a.b, foeSide);
    if (z.pull && z.n > 1 && of.mon.hp > 0 && o.iframe === 0) {
      // 터지기 시작하면 끌어당긴다
      const [nx, ny] = norm(z.x - o.x, z.y - o.y);
      o.x += nx * z.pull;
      o.y += ny * z.pull;
      clampPos(o);
    }
    if (--z.t <= 0) {
      a.ev.push({ t: "pulse", side: z.side, move: z.move, x: z.x, y: z.y, r: z.r });
      const dx = o.x - z.x;
      const dy = o.y - z.y;
      const rr = z.r + BODY_R * 0.5;
      if (of.mon.hp > 0 && dx * dx + dy * dy <= rr * rr) hit(a, z.side, moveOf(z.move), z.n, rng, z.frac);
      z.pulses--;
      z.n++;
      z.t = z.every;
      z.total = z.every;
      if (z.pulses <= 0) continue;
    }
    keep.push(z);
  }
  a.zones = keep;
}

function updateBeams(a: Arena, rng: Rng) {
  const keep: BeamNow[] = [];
  for (const b of a.beams) {
    const foeSide = (b.side ? 0 : 1) as 0 | 1;
    const o = a.units[foeSide];
    const elapsed = b.total - b.t;
    if (elapsed % b.every === 0 && b.pulses > 0 && activeOf(a.b, foeSide).mon.hp > 0) {
      b.pulses--;
      const ex = o.x - b.x;
      const ey = o.y - b.y;
      const along = ex * b.dx + ey * b.dy;
      const perp = Math.abs(ex * b.dy - ey * b.dx);
      if (along > 0 && along <= b.len && perp <= b.r + BODY_R) hit(a, b.side, moveOf(b.move), b.n, rng, b.frac);
      else if (along > 0 && along <= b.len && perp <= b.r + BODY_R + 40) a.ev.push({ t: "miss", side: foeSide, x: o.x, y: o.y });
      b.n++;
    }
    if (--b.t > 0) keep.push(b);
  }
  a.beams = keep;
}

function updateThrow(a: Arena, rng: Rng) {
  const th = a.throwing;
  if (!th) return;
  if (++th.t < th.total) return;
  a.throwing = null;
  const o = a.units[1];
  const f = activeOf(a.b, 1);
  const dx = o.x - th.x1;
  const dy = o.y - th.y1;
  if (f.mon.hp <= 0 || o.iframe > 0 || dx * dx + dy * dy > 56 * 56) {
    a.ev.push({ t: "text", s: "공이 빗나갔다!" }, { t: "miss", side: 1, x: th.x1, y: th.y1 });
    return;
  }
  const p = catchChance(f, th.ball, th.aim);
  const each = Math.pow(p, 1 / 3);
  let shakes = 0;
  while (shakes < 3 && rnd(rng) < each) shakes++;
  a.capture = { ball: th.ball, x: o.x, y: o.y, t: 0, shakes, caught: shakes === 3 };
  a.shots = a.shots.filter((s) => s.side === 1);
  o.cast = null;
  o.lunge = null;
}

function tickCapture(a: Arena) {
  const c = a.capture!;
  c.t++;
  for (let n = 1; n <= c.shakes; n++) if (c.t === 14 + n * 20) a.ev.push({ t: "shake", n });
  const end = 14 + Math.max(1, c.shakes) * 20 + 14;
  if (c.t < end) return;
  a.capture = null;
  a.ev.push({ t: "capture", caught: c.caught });
  const f = activeOf(a.b, 1);
  if (c.caught) {
    a.b.over = "caught";
    a.b.caught = { ...f.mon, moves: f.mon.moves.map((x) => ({ ...x })) };
    a.ev.push({ t: "text", s: `${josaName(nameOf(f), "을/를")} 잡았다!` }, { t: "end", result: "caught" });
  } else {
    const u = a.units[1];
    u.iframe = sec(0.6);
    u.stun = 0;
    a.ev.push({ t: "text", s: c.shakes === 0 ? "공에서 바로 튀어나왔다!" : c.shakes === 1 ? "아까워! 금방 나왔다" : "조금만 더였는데!" });
  }
}

/** 조사 — josa.ts 를 끌고 오지 않으려고 받침만 본다 */
function josaName(s: string, pair: "을/를" | "은/는" | "이/가"): string {
  const c = s.charCodeAt(s.length - 1);
  const has = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0;
  const [x, y] = pair.split("/");
  return s + (has ? x : y);
}

function finishChannel(a: Arena, side: 0 | 1) {
  const u = a.units[side];
  const ch = u.channel!;
  u.channel = null;
  if (ch.kind === "run") {
    a.b.over = "run";
    a.ev.push({ t: "text", s: "무사히 도망쳤다!" }, { t: "end", result: "run" });
    return;
  }
  const f = activeOf(a.b, side);
  const used = ch.item ? applyItem(f.mon, ch.item) : null;
  if (!used || !a.bag || !ch.item) {
    a.ev.push({ t: "text", s: "써도 소용이 없다" });
    return;
  }
  a.bag.items[ch.item]--;
  const gain = used.hp - f.mon.hp;
  if (ch.item === "cure" && f.mon.status) {
    a.ev.push({ t: "status", side, status: f.mon.status, on: false });
    u.statusT = 0;
    u.stun = 0;
  }
  f.mon = used;
  if (gain > 0) a.ev.push({ t: "heal", side, amount: gain });
}

function timers(a: Arena, side: 0 | 1) {
  const u = a.units[side];
  const f = activeOf(a.b, side);
  for (let k = 0; k < 4; k++) if (u.cd[k] > 0) u.cd[k]--;
  if (u.dodgeCd > 0) u.dodgeCd--;
  if (u.iframe > 0) u.iframe--;
  if (u.hitstun > 0) u.hitstun--;
  if (u.lock > 0) u.lock--;
  if (a.swapCd[side] > 0) a.swapCd[side]--;
  if (u.stun > 0) u.stun--;
  for (const bf of u.buffs) if (--bf.t <= 0) {
    f.stages[bf.stat] = clamp(f.stages[bf.stat] - bf.by, -6, 6);
    a.ev.push({ t: "stat", side, stat: bf.stat, by: -bf.by });
  }
  u.buffs = u.buffs.filter((bf) => bf.t > 0);
  if (f.mon.hp <= 0 || !f.mon.status) return;
  const st = f.mon.status;
  if (st === "burn" || st === "poison") {
    if (--u.dotT <= 0) {
      u.dotT = sec(1);
      const dmg = Math.min(f.mon.hp, Math.max(1, Math.floor(f.stats.hp / (st === "burn" ? 20 : 16))));
      f.mon.hp -= dmg;
      a.ev.push({ t: "hit", side, dmg, eff: 1, crit: false, dot: st, x: u.x, y: u.y });
      if (f.mon.hp <= 0) a.ev.push({ t: "faint", side });
    }
  }
  if (--u.statusT <= 0 && f.mon.hp > 0) {
    f.mon.status = undefined;
    if (st === "sleep") u.stun = 0;
    a.ev.push({ t: "status", side, status: st, on: false });
  }
}

/** 교체 — forced = 쓰러져서 고르는 것(대기 시간 없이) */
function swapTo(a: Arena, side: 0 | 1, to: number, forced: boolean): boolean {
  const s = a.b.sides[side];
  const f = s.team[to];
  if (!f || f.mon.hp <= 0 || to === s.active) return false;
  const old = a.units[side];
  activeOf(a.b, side).stages = { atk: 0, def: 0, spd: 0 };
  s.active = to;
  const u = unit(side, f);
  u.x = u.px = old.x;
  u.y = u.py = old.y;
  u.enter = sec(0.4);
  a.units[side] = u;
  a.swapCd[side] = forced ? sec(2) : sec(5);
  if (side === 0) {
    a.b.needSwap = false;
    if (!a.b.joined.includes(f.mon.id)) a.b.joined.push(f.mon.id);
  }
  a.ev.push({ t: "swap", side, to });
  return true;
}

function resolve(a: Arena) {
  const b = a.b;
  const alive = (side: 0 | 1) => b.sides[side].team.some((f) => f.mon.hp > 0);
  if (activeOf(b, 1).mon.hp <= 0) {
    if (!alive(1)) {
      b.over = "win";
      a.ev.push({ t: "end", result: "win" });
      return;
    }
    if (a.foeNext === 0) a.foeNext = sec(1);
    else if (--a.foeNext <= 0) {
      a.foeNext = 0;
      const next = b.sides[1].team.findIndex((f) => f.mon.hp > 0);
      swapTo(a, 1, next, true);
      a.ev.push({ t: "text", s: `${josaName(b.sides[1].name, "은/는")} ${josaName(nameOf(b.sides[1].team[next]), "을/를")} 내보냈다!` });
    }
  }
  if (activeOf(b, 0).mon.hp <= 0) {
    if (!alive(0)) {
      b.over = "lose";
      a.ev.push({ t: "text", s: "눈앞이 캄캄해졌다…" }, { t: "end", result: "lose" });
      return;
    }
    b.needSwap = true;
    a.units[0].cast = null;
    a.units[0].lunge = null;
    a.units[0].leap = null;
    a.units[0].chain = null;
    a.units[0].follow = null;
    a.units[0].burst = null;
  }
}

/* ───────── 컴퓨터 ───────── */

/** 컴퓨터의 한 틱 — 몇 틱마다 생각하고, 그 사이엔 정한 방향으로 간다. 야생은 굼뜨고 대전 상대는 날래다. */
export function think(a: Arena, side: 0 | 1, rng: Rng, sharp = a.mode === "duel"): ArenaInput {
  const u = a.units[side];
  const o = a.units[side ? 0 : 1];
  const f = activeOf(a.b, side);
  const of = activeOf(a.b, side ? 0 : 1);
  if (f.mon.hp <= 0 || of.mon.hp <= 0) return { dir: 0 };
  if (u.ai.think > 0) {
    u.ai.think--;
    return { dir: u.ai.dir };
  }
  u.ai.think = sharp ? 4 : 8;
  const dx = o.x - u.x;
  const dy = o.y - u.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const out: ArenaInput = { dir: 0 };
  // 피하기 — 날아오는 탄 · 곧 떨어질 원 · 겨누는 광선
  let threat: [number, number] | null = null;
  for (const s of a.shots) {
    if (s.side === side) continue;
    const rx = u.x - s.x;
    const ry = u.y - s.y;
    const along = rx * s.dx + ry * s.dy;
    const perp = rx * s.dy - ry * s.dx;
    if (along > 0 && along < 150 && Math.abs(perp) < s.r + BODY_R + 6) threat = [s.dy * Math.sign(perp || 1), -s.dx * Math.sign(perp || 1)];
  }
  for (const z of a.zones) {
    if (z.side === side) continue;
    const rx = u.x - z.x;
    const ry = u.y - z.y;
    if (rx * rx + ry * ry < (z.r + BODY_R) * (z.r + BODY_R)) threat = norm(rx || 1, ry);
  }
  const oc = o.cast;
  if (oc && skillOf(oc.move).shape === "beam" && oc.total - oc.t < 8) threat = [-oc.dy, oc.dx];
  if (threat && u.dodgeCd === 0 && rnd(rng) < (sharp ? 0.55 : 0.2)) {
    const flip = rnd(rng) < 0.5 && !a.zones.length ? -1 : 1;
    out.dodge = true;
    out.dir = dirOf(threat[0] * flip, threat[1] * flip, 0.1);
  }
  // 기술 고르기
  let want = 200;
  if (!u.cast && !u.lunge && !u.leap && !u.chain && !u.lock && !out.dodge && rnd(rng) < (sharp ? 0.75 : 0.45)) {
    const ready = f.mon.moves.map((m, i) => ({ id: m.id, i })).filter(({ i }) => u.cd[i] === 0);
    const scored = ready.map(({ id, i }) => {
      const mv = MOVES[id];
      const sk = skillOf(id);
      let w = mv.power > 0 ? (mv.power * (mv.hits ? (mv.hits[0] + mv.hits[1]) / 2 : 1) * effectiveness(mv.type, SPECIES[of.mon.species].type)) / 10 : 4;
      if (mv.heal) w = f.mon.hp < f.stats.hp * 0.4 ? 30 : 0.2;
      if (mv.inflict && mv.power === 0 && of.mon.status) w = 0.2;
      if (mv.boost && mv.boost.self && f.stages[mv.boost.stat] >= 2) w = 0.2;
      if (dist > sk.range + BODY_R) w *= MELEE.includes(sk.shape) ? 0.15 : 0.05;
      return { i, w: w + 0.5 };
    });
    const total = scored.reduce((s, x) => s + x.w * x.w, 0);
    let x = rnd(rng) * total;
    for (const s of scored) if ((x -= s.w * s.w) < 0) {
      const sk = skillOf(f.mon.moves[s.i].id);
      if (dist <= sk.range + BODY_R || sk.shape === "dash" || sk.shape === "combo" || sk.shape === "fan") out.skill = s.i;
      if (MELEE.includes(sk.shape)) want = 70;
      break;
    }
  } else {
    const melee = f.mon.moves.some((m, i) => u.cd[i] < sec(0.5) && MELEE.includes(skillOf(m.id).shape) && MOVES[m.id].power > 0);
    want = melee && rnd(rng) < 0.5 ? 80 : 190;
  }
  if (!out.dodge) {
    if (rnd(rng) < 0.12) u.ai.strafe = -u.ai.strafe;
    const [nx, ny] = norm(dx, dy);
    const radial = dist > want + 20 ? 1 : dist < want - 20 ? -1 : 0;
    let mx = nx * radial + -ny * u.ai.strafe * 0.8;
    let my = ny * radial + nx * u.ai.strafe * 0.8;
    // 벽 · 원을 피해서
    if (u.x < 70) mx += 1;
    if (u.x > ARENA_W - 70) mx -= 1;
    if (u.y < 90) my += 1;
    if (u.y > ARENA_H - 70) my -= 1;
    if (threat) {
      mx += threat[0] * 1.5;
      my += threat[1] * 1.5;
    }
    out.dir = dirOf(mx, my, 0.2);
  }
  u.ai.dir = out.dir;
  return out;
}

/* ───────── 대전 입력 기록 ───────── */

/** [틱, 방향, 행동(0 없음 · 1 기술 · 2 회피 · 3 교체), 값] — 방향이 바뀌거나 행동이 있을 때만 적는다 */
export type LogEntry = [number, number, number, number];
export const LOG_MAX = 9000;

/** 대전에서 받는 입력 — 이동 · 기술 · 회피 · 교체만(공 · 가방 · 도망 없음) */
export function duelInput(i: ArenaInput): ArenaInput {
  const out: ArenaInput = { dir: Number.isInteger(i.dir) && i.dir >= 0 && i.dir <= 8 ? i.dir : 0 };
  if (Number.isInteger(i.skill) && i.skill! >= 0 && i.skill! < 4) out.skill = i.skill;
  else if (i.dodge) out.dodge = true;
  else if (Number.isInteger(i.swap) && i.swap! >= 0 && i.swap! < 6) out.swap = i.swap;
  return out;
}

const entryOf = (tick: number, i: ArenaInput): LogEntry =>
  i.skill != null ? [tick, i.dir, 1, i.skill] : i.dodge ? [tick, i.dir, 2, 0] : i.swap != null ? [tick, i.dir, 3, i.swap] : [tick, i.dir, 0, 0];

/** 이 틱에 넣을 입력을 기록한다(stepArena 바로 전에 부른다). 마지막 방향을 돌려준다. */
export function record(log: LogEntry[], lastDir: number, tick: number, i: ArenaInput): number {
  const e = entryOf(tick, i);
  if ((e[2] !== 0 || e[1] !== lastDir) && log.length < LOG_MAX) log.push(e);
  return i.dir;
}

const inputOf = (e: LogEntry): ArenaInput => duelInput(e[2] === 1 ? { dir: e[1], skill: e[3] } : e[2] === 2 ? { dir: e[1], dodge: true } : e[2] === 3 ? { dir: e[1], swap: e[3] } : { dir: e[1] });

/** 서버 판정 — 시작 판과 입력 기록으로 처음부터 다시 돌린다. 기록이 끊겨 끝나지 않으면 over 가 비어 있다. */
export function replayDuel(start: Battle, log: readonly LogEntry[]): Arena {
  const a = newArena(JSON.parse(JSON.stringify(start)) as Battle, null);
  let i = 0;
  let dir = 0;
  let guard = 0;
  while (!a.b.over && a.tick < a.limit && guard++ < DUEL_TICKS * 3) {
    while (i < log.length && log[i][0] < a.tick) i++;
    if (a.b.needSwap) {
      if (i < log.length && log[i][0] === a.tick) {
        const inp = inputOf(log[i++]);
        dir = inp.dir;
        stepArena(a, inp);
        continue;
      }
      break;
    }
    let inp: ArenaInput = { dir };
    if (i < log.length && log[i][0] === a.tick) {
      inp = inputOf(log[i++]);
      dir = inp.dir;
    }
    stepArena(a, inp);
  }
  return a;
}

/** 기록 모양 검사(서버) */
export function validLog(x: unknown): x is LogEntry[] {
  if (!Array.isArray(x) || x.length > LOG_MAX) return false;
  let last = 0;
  for (const e of x) {
    if (!Array.isArray(e) || e.length !== 4 || !e.every((v) => Number.isInteger(v))) return false;
    if (e[0] < last || e[0] > DUEL_TICKS || e[1] < 0 || e[1] > 8 || e[2] < 0 || e[2] > 3 || e[3] < 0 || e[3] > 5) return false;
    last = e[0];
  }
  return true;
}
