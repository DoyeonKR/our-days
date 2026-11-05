/* 낚시 방식 셋 — 루어 · 뜰채 · 심해 (2026-11-02) [사용자: "낚시 게임 방식도 더 여러방면으로 추가해줘"]
 * 찌낚시(fishing.ts 의 stepFight)와 손이 하는 일이 달라야 방식이 다른 것이다. 숫자만 바꾼 힘겨루기는 방식이 아니다.
 *  · 루어 — 박자에 맞춰 톡톡 쳐서 물고기를 꾀고(tapLure), 물면 좌우로 끌며 물고기 반대쪽에 낚싯대를 둔다(stepSway).
 *  · 뜰채 — 헤엄치는 그림자를 보고 앞서 겨눠 내리친다(scoopPos · plunge). 깊이 들어간 놈은 못 건진다. 한 판에 세 번.
 *  · 심해 — 손가락으로 릴을 돌린다(stepDeep). 초록 속도를 지키고, 물고기가 파고들면 멈춘다.
 * 전부 순수 함수다 — 입력(탭 시각 · 끌기 위치 · 회전 속도)만 받는다. fishingmodes.test 의 자동 플레이가 난이도를 잠근다. */
import { rng, rollCatch, type FishCatch, type FishSpot, type FishStat } from "./fishing.ts";
import type { FishMoment } from "./fishingworld.ts";

type Eff = Pick<Record<FishStat, number>, "power" | "line">;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ── 루어 1막: 유인 ──────────────────────────────────── */

export type LureTune = { beat: number; window: number; great: number; gain: number; miss: number; skip: number; retrieve: number };
export type LureStatus = "on" | "strike" | "empty";
export type Lure = { t: number; nextBeat: number; interest: number; line: number; combo: number; hits: number; beats: number; rngState: number; status: LureStatus };

export function lureTune(d: number, eff: Eff): LureTune {
  return {
    beat: Math.max(0.56, 1 - d * 0.055),
    window: Math.max(0.075, 0.158 - d * 0.012 + eff.line * 0.0012),
    great: Math.max(0.04, 0.06 - d * 0.004),
    gain: Math.max(0.12, 0.255 - d * 0.018),
    miss: 0.21,
    skip: 0.1,
    retrieve: 0.075 / (1 + eff.power * 0.012),
  };
}
export const startLure = (seed: number, tune: LureTune): Lure => ({ t: 0, nextBeat: tune.beat * 1.4, interest: 0, line: 1, combo: 0, hits: 0, beats: 0, rngState: seed >>> 0, status: "on" });
/** 다음 박자까지 남은 비율(1 → 0). 화면이 조여드는 고리를 그린다. 0 근처가 칠 때다. */
export const lureRing = (l: Lure, tune: LureTune) => clamp((l.nextBeat - l.t) / tune.beat, 0, 1);

function nextBeatAfter(l: Lure, tune: LureTune, d: number): Pick<Lure, "nextBeat" | "rngState"> {
  const r = rng(l.rngState);
  // 귀한 놈일수록 박자가 흔들린다 — 외워서 칠 수 없게
  const swing = 1 + (r() - 0.5) * Math.min(0.5, d * 0.07);
  return { nextBeat: l.nextBeat + tune.beat * swing, rngState: (l.rngState * 31 + 17) >>> 0 };
}

export function stepLure(l: Lure, dt: number, tune: LureTune, d: number): Lure {
  if (l.status !== "on") return l;
  const n = { ...l, t: l.t + dt };
  if (n.t > n.nextBeat + tune.window) {
    // 박자를 그냥 흘렸다 — 관심이 식고 루어는 그만큼 들어온다
    Object.assign(n, nextBeatAfter(n, tune, d));
    n.interest = Math.max(0, n.interest - tune.skip);
    n.combo = 0;
    n.beats += 1;
    n.line -= tune.retrieve;
    if (n.line <= 0) n.status = "empty";
  }
  return n;
}

export type TapGrade = "great" | "good" | "miss";
/** 탭 — 박자 안이면 관심이 오른다. 연달아 맞히면 더 오른다. 박자 밖이면 놀라서 식는다. */
export function tapLure(l: Lure, tune: LureTune, d: number): { lure: Lure; grade: TapGrade } {
  if (l.status !== "on") return { lure: l, grade: "miss" };
  const off = Math.abs(l.t - l.nextBeat);
  const n = { ...l, ...(off <= tune.window ? nextBeatAfter(l, tune, d) : {}) };
  n.line -= tune.retrieve;
  let grade: TapGrade = "miss";
  if (off <= tune.window) {
    grade = off <= tune.great ? "great" : "good";
    n.combo += 1;
    n.hits += 1;
    n.beats += 1;
    n.interest += tune.gain * (grade === "great" ? 1.35 : 1) * (1 + Math.min(3, n.combo - 1) * 0.1);
  } else {
    n.combo = 0;
    n.interest = Math.max(0, n.interest - tune.miss);
  }
  if (n.interest >= 1) n.status = "strike";
  else if (n.line <= 0) n.status = "empty";
  return { lure: n, grade };
}
export const lureQuality = (l: Pick<Lure, "hits" | "beats">) => (l.beats <= 0 ? 0 : Math.min(1, l.hits / l.beats));

/* ── 루어 2막: 좌우로 끌기 ─────────────────────────────── */

/** 물린 직후 — 손가락을 올릴 시간을 준다. 이 동안은 줄이 안 팽팽해진다. */
export const SWAY_GRACE_S = 1.3;
export type SwayTune = { reel: number; strain: number; ease: number; run: number; moveEvery: number; speed: number; warn: number };
export type SwayStatus = "on" | "landed" | "snapped" | "escaped";
/** fishX · rod 는 -1(왼쪽) ~ 1(오른쪽). 물고기 반대쪽으로 끌어야 들어온다. */
export type Sway = { dist: number; tension: number; fishX: number; toX: number; nextSide: number; warnLeft: number; moveIn: number; t: number; good: number; rngState: number; status: SwayStatus };

export function swayTune(d: number, eff: Eff): SwayTune {
  return {
    reel: (0.15 * (1 + eff.power * 0.035)) / (1 + d * 0.17),
    strain: (1.25 * (1 + d * 0.1)) / (1 + eff.line * 0.03),
    ease: 0.55,
    run: 0.12 * (1 + d * 0.08),
    moveEvery: Math.max(1, 2.1 - d * 0.16),
    speed: 2.4 + d * 0.3,
    warn: Math.max(0.22, 0.42 - d * 0.03),
  };
}
export function startSway(seed: number, tune: SwayTune): Sway {
  const r = rng(seed);
  const side = r() < 0.5 ? -1 : 1;
  return { dist: 1, tension: 0.2, fishX: 0, toX: side, nextSide: side, warnLeft: 0, moveIn: tune.moveEvery, t: 0, good: 0, rngState: (seed * 37 + 5) >>> 0, status: "on" };
}
export function stepSway(s: Sway, dt: number, rod: number, tune: SwayTune): Sway {
  if (s.status !== "on") return s;
  const n = { ...s, t: s.t + dt };
  if (n.warnLeft > 0) {
    n.warnLeft -= dt;
    if (n.warnLeft <= 0) {
      n.toX = n.nextSide;
      n.moveIn = tune.moveEvery;
    }
  } else {
    n.moveIn -= dt;
    if (n.moveIn <= 0) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 19) >>> 0;
      // 대개 반대쪽으로 튀지만 가끔 같은 쪽으로 더 파고든다(속임수)
      n.nextSide = (r() < 0.8 ? -Math.sign(n.toX || 1) : Math.sign(n.toX || 1)) * (0.7 + r() * 0.3);
      n.warnLeft = tune.warn;
    }
  }
  const dx = n.toX - n.fishX;
  n.fishX += clamp(dx, -tune.speed * dt, tune.speed * dt);
  const opp = -clamp(rod, -1, 1) * n.fishX; // 1 = 정반대, -1 = 같은 쪽
  if (opp > 0.1) {
    n.dist -= tune.reel * Math.min(1, opp * 1.6) * dt;
    n.tension -= tune.ease * dt;
    n.good += dt;
  } else if (n.t > SWAY_GRACE_S) {
    n.tension += tune.strain * (0.35 + Math.max(0, -opp) * 0.9) * dt;
    n.dist += tune.run * Math.max(0, -opp) * dt;
  }
  n.tension = clamp(n.tension, 0, 1.2);
  if (n.tension >= 1) n.status = "snapped";
  else if (n.dist <= 0) n.status = "landed";
  else if (n.dist >= 1.3) n.status = "escaped";
  return n;
}
export const swayQuality = (s: Pick<Sway, "good" | "t">) => (s.t <= 0 ? 0 : Math.min(1, s.good / s.t));

/* ── 뜰채 ────────────────────────────────────────────── */

export const SCOOP_SHOTS = 3;
export const SCOOP_TIME_S = 18;
/** 내리친 뒤 물에 닿기까지 — 이만큼 앞서 노려야 한다 */
export const PLUNGE_S = 0.34;
/** 물고기는 이 수면 칸을 헤엄친다(화면 비율). 가로 x, 세로 y. */
const SWIM = { x: [0.14, 0.86], y: [0.48, 0.84] } as const;

export type ScoopFish = { id: number; haul: FishCatch; cx: number; cy: number; ax: number; ay: number; wx: number; wy: number; px: number; py: number; wz: number; pz: number; deepAt: number };
export type Scoop = { clock: number; left: number; shots: number; fish: ScoopFish[]; startled: number; status: "on" | "caught" | "out"; caught: number; quality: number };

/** 수면에 뜬 물고기 — 등급이 높을수록 빠르고 자주 깊이 들어간다. 다 큰 놈은 수면에 안 올라온다(METHODS.scoop.adult = 0). */
export function startScoop(spot: FishSpot, luck: number, bait: number, seed: number, when?: FishMoment): Scoop {
  const r = rng(seed);
  const n = 4 + (luck >= 20 ? 1 : 0);
  const fish = Array.from({ length: n }, (_, id): ScoopFish => {
    const haul = rollCatch(spot, luck, 0.5, (seed + (id + 1) * 7919) >>> 0, { bait, method: "scoop", junk: true, when });
    const d = haul.difficulty;
    const speed = 1.02 + d * 0.13;
    return {
      id, haul,
      cx: 0.3 + r() * 0.4, cy: 0.58 + r() * 0.15,
      ax: 0.14 + r() * 0.16, ay: 0.06 + r() * 0.06,
      wx: (0.7 + r() * 0.6) * speed, wy: (1 + r() * 0.8) * speed,
      px: r() * 6.28, py: r() * 6.28,
      wz: 0.45 + r() * 0.5 + d * 0.05, pz: r() * 6.28,
      // 떠오름 창 — 늘 건질 수 있는 깊이에 있으면 첫 탭에 끝난다(2026-11-05 실측: 한 판 1.2초). 수면 가까이 떠오를 때만 건진다. 귀할수록 잠깐만 뜬다
      deepAt: Math.min(SURFACE_MAX, SURFACE_AT + d * 0.035),
    };
  });
  return { clock: 0, left: SCOOP_TIME_S, shots: SCOOP_SHOTS, fish, startled: 0, status: "on", caught: -1, quality: 0 };
}

/** 그 시각의 자리 — z 는 수면에 가까운 정도(0~1), reach 면 건질 수 있다 */
export function scoopPos(f: ScoopFish, clock: number) {
  const x = clamp(f.cx + Math.sin(clock * f.wx + f.px) * f.ax + Math.sin(clock * f.wx * 2.3 + f.py) * f.ax * 0.3, SWIM.x[0], SWIM.x[1]);
  const y = clamp(f.cy + Math.sin(clock * f.wy + f.py) * f.ay, SWIM.y[0], SWIM.y[1]);
  const vx = Math.cos(clock * f.wx + f.px) * f.ax * f.wx;
  const vy = Math.cos(clock * f.wy + f.py) * f.ay * f.wy;
  const z = 0.5 + 0.5 * Math.sin(clock * f.wz + f.pz);
  return { x, y, h: Math.atan2(vy * 1.25, vx), z, reach: z >= f.deepAt };
}

/** 놀라면 시계가 빨라진다 — 헛손질 뒤엔 다 같이 도망치듯 헤엄친다 */
export function stepScoop(s: Scoop, dt: number): Scoop {
  if (s.status !== "on") return s;
  const startled = Math.max(0, s.startled - dt);
  const left = s.left - dt;
  return { ...s, clock: s.clock + dt * (startled > 0 ? 1.8 : 1), startled, left, status: left <= 0 ? "out" : "on" };
}

export const netRadius = (netTier: number) => 0.078 + netTier * 0.009;
/** 떠오름 문턱(z 0~1, 높을수록 수면) — 한 마리가 건질 깊이에 있는 시간은 대략 acos(2·문턱 − 1)/π. 0.8 이면 30% 남짓 */
export const SURFACE_AT = 0.8;
const SURFACE_MAX = 0.9;

/* ── 뜰채 2막: 들어올리기 ────────────────────────────────── */

/** 건진 물고기가 그물 안에서 몸부림친다 — 누르고 있으면 올라오고, 손가락을 기울어진 반대쪽으로 끌어 그물을 수평으로 버틴다.
 *  기울기가 끝(±1)에 닿으면 그물에서 튀어 나간다. 몸부림 전에 어느 쪽으로 칠지 잠깐 예고한다(warnLeft · side). */
export type LiftTune = { rise: number; sink: number; kick: number; kickEvery: number; kickLen: number; warn: number; grip: number; spring: number; damp: number; wobble: number };
export type LiftStatus = "on" | "landed" | "dropped";
/** h 0(물속) → 1(물 밖) · tilt -1(왼쪽 끝) ~ 1(오른쪽 끝) · slip 끝 가까이(LIFT_EDGE 밖)에 머문 시간 — LIFT_SLIP_S 가 차면 튀어 나간다 */
export type Lift = { h: number; tilt: number; vel: number; t: number; good: number; slip: number; kickLeft: number; warnLeft: number; nextKick: number; side: number; rngState: number; status: LiftStatus };
export const LIFT_SAFE = 0.35;
export const LIFT_EDGE = 0.8;
/** 끝에 닿는 순간 바로 놓치면 반응이 늦은 사람에게 절벽이 된다(시뮬레이션: 한 단계 차이로 95% → 12%) — 잠깐은 버틸 틈을 준다 */
export const LIFT_SLIP_S = 0.7;
export function liftTune(d: number, eff: Eff): LiftTune {
  return {
    rise: (0.24 * (1 + eff.power * 0.02)) / (1 + d * 0.12),
    sink: 0.08,
    // 몸부림 세기는 등급에 완만하게만 — 0.14 로 키우면 고급부터 절벽처럼 0% 가 됐다(시뮬레이션). 줄 다루기가 덜어 준다
    kick: (4.4 * (1 + d * 0.05)) / (1 + eff.line * 0.03),
    kickEvery: Math.max(0.85, 1.9 - d * 0.12),
    kickLen: 0.45 + d * 0.05,
    warn: Math.max(0.25, 0.45 - d * 0.025),
    grip: 2.8,
    spring: 0.75,
    damp: 1.5,
    wobble: 0.22 + d * 0.04,
  };
}
export function startLift(seed: number, tune: LiftTune): Lift {
  const r = rng(seed);
  return { h: 0, tilt: 0, vel: 0, t: 0, good: 0, slip: 0, kickLeft: 0, warnLeft: 0, nextKick: tune.kickEvery * (0.5 + r() * 0.5), side: r() < 0.5 ? -1 : 1, rngState: (seed * 43 + 9) >>> 0, status: "on" };
}
/** 한 칸 — hold 면 들어 올린다. counter(-1~1)는 손가락이 가운데에서 벗어난 정도: 왼쪽으로 끌면 그물이 왼쪽으로 기운다. 순수. */
export function stepLift(l: Lift, dt: number, hold: boolean, counter: number, tune: LiftTune): Lift {
  if (l.status !== "on") return l;
  const n = { ...l, t: l.t + dt };
  if (n.kickLeft > 0) n.kickLeft = Math.max(0, n.kickLeft - dt);
  else if (n.warnLeft > 0) {
    n.warnLeft = Math.max(0, n.warnLeft - dt);
    if (n.warnLeft <= 0) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 29) >>> 0;
      n.kickLeft = tune.kickLen * (0.8 + r() * 0.4);
      n.nextKick = tune.kickEvery * (0.7 + r() * 0.6);
    }
  } else {
    n.nextKick -= dt;
    if (n.nextKick <= 0) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 31) >>> 0;
      // 대개 반대쪽으로 친다 — 한쪽만 버티면 되는 놀이가 되지 않게. 가끔 같은 쪽으로 연달아
      n.side = r() < 0.75 ? -n.side : n.side;
      n.warnLeft = tune.warn;
    }
  }
  const fish = (n.kickLeft > 0 ? n.side * tune.kick : 0) + Math.sin(n.t * 2.3 + (l.rngState % 97)) * tune.wobble;
  const c = clamp(counter, -1, 1);
  n.vel += (fish + c * tune.grip - n.tilt * tune.spring - n.vel * tune.damp) * dt;
  n.tilt += n.vel * dt;
  if (Math.abs(n.tilt) > 1.1) {
    n.tilt = Math.sign(n.tilt) * 1.1; // 그물이 뒤집히지는 않는다 — 끝에 걸린 채 버티는 동안 slip 이 찬다
    n.vel = 0;
  }
  // 기울수록 잘 안 올라간다 — 수평을 지키는 게 곧 빨리 건지는 길이다
  n.h = clamp(n.h + (hold ? tune.rise * (1 - 0.7 * Math.min(1, Math.abs(n.tilt))) : -tune.sink) * dt, 0, 1);
  if (Math.abs(n.tilt) < LIFT_SAFE) n.good += dt;
  n.slip = Math.abs(n.tilt) > LIFT_EDGE ? n.slip + dt : Math.max(0, n.slip - dt * 0.5);
  if (n.slip >= LIFT_SLIP_S) n.status = "dropped";
  else if (n.h >= 1) n.status = "landed";
  else if (n.t >= 30) n.status = "dropped";
  return n;
}
export const liftQuality = (l: Pick<Lift, "good" | "t">) => (l.t <= 0 ? 0 : Math.min(1, l.good / l.t));

/** 내리쳤다 — (x, y) 는 화면 비율, 호출자는 PLUNGE_S 뒤의 시계로 부른다. 그물 안 가까운 놈부터 건진다. 가로세로 비가 4:5 라 세로에 1.25 를 곱한다. */
export function plunge(s: Scoop, x: number, y: number, radius: number): Scoop {
  if (s.status !== "on") return s;
  let best = -1, bestD = Infinity;
  s.fish.forEach((f, i) => {
    const p = scoopPos(f, s.clock);
    if (!p.reach) return;
    const d = Math.hypot(p.x - x, (p.y - y) * 1.25);
    if (d <= radius && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  if (best >= 0) return { ...s, status: "caught", caught: best, quality: clamp(1 - bestD / radius, 0, 1) };
  const shots = s.shots - 1;
  return { ...s, shots, startled: 1.3, status: shots <= 0 ? "out" : "on" };
}

/* ── 심해: 릴 돌리기 ──────────────────────────────────── */

export type DeepTune = { lo: number; hi: number; reel: number; sink: number; strain: number; ease: number; diveEvery: number; diveLen: number; dive: number; warn: number; wander: number };
export type DeepStatus = "on" | "landed" | "snapped" | "slack" | "escaped";
export type Deep = { depth: number; tension: number; t: number; idle: number; diveLeft: number; warnLeft: number; nextDive: number; good: number; rngState: number; status: DeepStatus };
export const DEEP_METERS = 120;

export function deepTune(d: number, eff: Eff): DeepTune {
  const width = Math.max(0.45, 0.85 - d * 0.04 + eff.line * 0.004);
  const lo = 0.85 + d * 0.035;
  return {
    lo,
    hi: lo + width,
    reel: (0.12 * (1 + eff.power * 0.035)) / (1 + d * 0.1),
    sink: 0.05 * (1 + d * 0.04),
    strain: (0.95 * (1 + d * 0.09)) / (1 + eff.line * 0.03),
    ease: 0.5,
    diveEvery: Math.max(3.6, 6.5 - d * 0.2),
    diveLen: 0.8 + d * 0.05,
    dive: 0.05 * (1 + d * 0.08),
    warn: Math.max(0.35, 0.65 - d * 0.03),
    wander: Math.min(0.28, 0.1 + d * 0.05),
  };
}
export function startDeep(seed: number, tune: DeepTune): Deep {
  const r = rng(seed);
  return { depth: 1, tension: 0.25, t: 0, idle: 0, diveLeft: 0, warnLeft: 0, nextDive: tune.diveEvery * (0.7 + r() * 0.5), good: 0, rngState: (seed * 41 + 3) >>> 0, status: "on" };
}
/** 지금 초록 속도(초당 바퀴) — 천천히 오르내려서 손을 계속 맞춰야 한다 */
export function deepBand(de: Pick<Deep, "t">, tune: DeepTune) {
  const m = Math.sin(de.t * 0.55) * tune.wander;
  return { lo: Math.max(0.55, tune.lo + m), hi: Math.max(0.55, tune.lo + m) + (tune.hi - tune.lo) };
}
/** rps = 초당 바퀴 수(방향 무관) */
export function stepDeep(de: Deep, dt: number, rps: number, tune: DeepTune): Deep {
  if (de.status !== "on") return de;
  const n = { ...de, t: de.t + dt };
  const band = deepBand(n, tune);
  const spinning = rps > 0.18;
  if (n.diveLeft > 0) {
    // 파고드는 중 — 돌리면 줄이 끊어진다. 멈추고 버틴다.
    n.diveLeft = Math.max(0, n.diveLeft - dt);
    n.depth += tune.dive * dt;
    n.tension += spinning ? tune.strain * (1.5 + rps * 0.5) * dt : -tune.ease * dt;
    n.idle = 0;
  } else if (n.warnLeft > 0) {
    n.warnLeft = Math.max(0, n.warnLeft - dt);
    if (n.warnLeft <= 0) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 23) >>> 0;
      n.diveLeft = tune.diveLen * (0.8 + r() * 0.4);
      n.nextDive = tune.diveEvery * (0.75 + r() * 0.5);
    }
  } else {
    n.nextDive -= dt;
    if (n.nextDive <= 0) n.warnLeft = tune.warn;
  }
  if (n.diveLeft <= 0) {
    if (rps > band.hi) {
      n.tension += tune.strain * (0.28 + (rps - band.hi) * 0.6) * dt;
      n.depth -= tune.reel * 1.15 * dt;
    } else if (rps >= band.lo) {
      n.tension -= tune.ease * 0.4 * dt;
      n.depth -= tune.reel * dt;
      n.good += dt;
    } else {
      n.tension -= tune.ease * dt;
      n.depth += tune.sink * (1 - rps / band.lo) * dt;
    }
    n.idle = spinning ? 0 : n.idle + dt;
  }
  n.tension = clamp(n.tension, 0, 1.2);
  if (n.tension >= 1) n.status = "snapped";
  else if (n.depth <= 0) n.status = "landed";
  else if (n.idle >= 3.2) n.status = "slack";
  else if (n.depth >= 1.25 || n.t >= 90) n.status = "escaped";
  return n;
}
export const deepQuality = (de: Pick<Deep, "good" | "t">) => (de.t <= 0 ? 0 : Math.min(1, de.good / de.t));
