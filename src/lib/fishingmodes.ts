/* 낚시 방식 셋 — 루어 · 뜰채 · 심해 (2026-11-02) [사용자: "낚시 게임 방식도 더 여러방면으로 추가해줘"]
 * 찌낚시(fishing.ts 의 stepFight)와 손이 하는 일이 달라야 방식이 다른 것이다. 숫자만 바꾼 힘겨루기는 방식이 아니다.
 *  · 루어 — 박자에 맞춰 톡톡 쳐서 물고기를 꾀고(tapLure), 물면 좌우로 끌며 물고기 반대쪽에 낚싯대를 둔다(stepSway).
 *  · 뜰채 — 그물을 끌고 다니며 달아나는 물고기를 물가 · 구석으로 몰아 붙잡는다(stepHerd, 2026-11-14 — 타이밍이 아니라 길).
 *  · 심해 — 손가락으로 릴을 돌린다(stepDeep). 초록 속도를 지키고, 물고기가 파고들면 멈춘다.
 * 전부 순수 함수다 — 입력(탭 시각 · 끌기 위치 · 회전 속도)만 받는다. fishingmodes.test 의 자동 플레이가 난이도를 잠근다. */
import { rng, rollCatch, softStat, type FishCatch, type FishSpot, type FishStat } from "./fishing.ts";
import type { FishMoment } from "./fishingworld.ts";

type Eff = Pick<Record<FishStat, number>, "power" | "line">;
/** 장비 · 능력치는 갈수록 덜 붙는다 — 찌낚시와 같은 곡선(fishing.ts softStat, 2026-11-10) */
const soft = (e: Eff): Eff => ({ power: softStat(e.power), line: softStat(e.line) });
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/* ── 루어 1막: 유인 ──────────────────────────────────── */

export type LureTune = { beat: number; window: number; great: number; gain: number; miss: number; skip: number; retrieve: number };
export type LureStatus = "on" | "strike" | "empty";
export type Lure = { t: number; nextBeat: number; interest: number; line: number; combo: number; hits: number; beats: number; rngState: number; status: LureStatus };

export function lureTune(d: number, eff: Eff): LureTune {
  eff = soft(eff);
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
/** landS — 루어가 물에 닿기까지(초, fx.cast 가 돌려준 나는 시간 + 멈칫). 시계를 −landS 에서 시작해 첫 박자는 내려앉은 뒤 beat × 1.4 에 온다.
 *  2026-11-13 — 예전엔 던진 순간부터 세서, 퍼펙트로 오래 나는(약 1.44초 + 멈칫) 루어가 공중에 있는 동안 첫 박자(난이도 3 이면 약 1.31초)가 지나가 보지도 못하고 놓친 것으로 쳤다 */
export const startLure = (seed: number, tune: LureTune, landS = 0): Lure => ({ t: -Math.max(0, landS), nextBeat: tune.beat * 1.4, interest: 0, line: 1, combo: 0, hits: 0, beats: 0, rngState: seed >>> 0, status: "on" });
/** 루어가 물에 닿았나 — 닿기 전 탭은 치지 않는다(빗나감으로 쳐서 줄 · 관심을 깎지 않게) */
export const lureLanded = (l: Pick<Lure, "t">) => l.t >= 0;
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
  eff = soft(eff);
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

/* ── 뜰채 그물 ──────────────────────────────────────── */

/** 그물 반지름(화면 너비 비율) — 좋은 뜰채일수록 넓다. 몰아서 건지기(herdTune)와 함께 끌어올리기 화면이 쓴다 */
export const netRadius = (netTier: number) => 0.078 + netTier * 0.009;

/* ── 뜰채 2막: 들어올리기 ────────────────────────────────── */

/** 건진 물고기가 그물 안에서 몸부림친다 — 누르고 있으면 올라오고, 손가락을 기울어진 반대쪽으로 끌어 그물을 수평으로 버틴다.
 *  기울기가 끝(±1)에 닿으면 그물에서 튀어 나간다. 몸부림 전에 어느 쪽으로 칠지 잠깐 예고한다(warnLeft · side). */
export type LiftTune = { rise: number; sink: number; drag: number; kick: number; kickEvery: number; kickLen: number; warn: number; grip: number; spring: number; damp: number; wobble: number };
export type LiftStatus = "on" | "landed" | "dropped";
/** h 0(물속) → 1(물 밖) · tilt -1(왼쪽 끝) ~ 1(오른쪽 끝) · slip 끝 가까이(LIFT_EDGE 밖)에 머문 시간 — LIFT_SLIP_S 가 차면 튀어 나간다 */
export type Lift = { h: number; tilt: number; vel: number; t: number; good: number; slip: number; kickLeft: number; warnLeft: number; nextKick: number; side: number; rngState: number; status: LiftStatus };
export const LIFT_SAFE = 0.35;
export const LIFT_EDGE = 0.8;
/** 끝에 닿는 순간 바로 놓치면 반응이 늦은 사람에게 절벽이 된다(시뮬레이션: 한 단계 차이로 95% → 12%) — 잠깐은 버틸 틈을 준다 */
export const LIFT_SLIP_S = 0.7;
export function liftTune(d: number, eff: Eff): LiftTune {
  eff = soft(eff);
  return {
    rise: (0.24 * (1 + eff.power * 0.02)) / (1 + d * 0.12),
    sink: 0.1,
    // 끌어내림(2026-11-12 [사용자: "줄어드는 로직도 뜰채 낚시도 변경해"]) — 몸부림을 못 막아 그물이 기운 동안엔 물고기가 그물을 물속으로 도로 끌어내린다. 누르고만 있어선 안 올라온다
    drag: 0.3,
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
  const lean = Math.max(0, Math.abs(n.tilt) - LIFT_SAFE) / (1 - LIFT_SAFE); // 수평(LIFT_SAFE 안)이면 0
  n.h = clamp(n.h + ((hold ? tune.rise * (1 - 0.7 * Math.min(1, Math.abs(n.tilt))) : -tune.sink) - (n.kickLeft > 0 ? (tune.drag ?? 0) * Math.min(1, lean) : 0)) * dt, 0, 1);
  if (Math.abs(n.tilt) < LIFT_SAFE) n.good += dt;
  n.slip = Math.abs(n.tilt) > LIFT_EDGE ? n.slip + dt : Math.max(0, n.slip - dt * 0.5);
  if (n.slip >= LIFT_SLIP_S) n.status = "dropped";
  else if (n.h >= 1) n.status = "landed";
  else if (n.t >= 30) n.status = "dropped";
  return n;
}
export const liftQuality = (l: Pick<Lift, "good" | "t">) => (l.t <= 0 ? 0 : Math.min(1, l.good / l.t));

/* ── 심해: 릴 돌리기 ──────────────────────────────────── */

export type DeepTune = { lo: number; hi: number; reel: number; sink: number; strain: number; ease: number; diveEvery: number; diveLen: number; dive: number; warn: number; wander: number };
export type DeepStatus = "on" | "landed" | "snapped" | "slack" | "escaped";
export type Deep = { depth: number; tension: number; t: number; idle: number; diveLeft: number; warnLeft: number; nextDive: number; good: number; rngState: number; status: DeepStatus };
export const DEEP_METERS = 120;

export function deepTune(d: number, eff: Eff): DeepTune {
  eff = soft(eff);
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

/* ── 뜰채: 몰아서 건지기 (2026-11-14) ──────────────────────
 * [사용자: "모든 낚시게임이 다 타이밍 류 낚시게임인데 뜰채 낚시 방법을 개편하고 변경하자"]
 * 예전 뜰채(떠오를 때 앞서 내리치기 → 몸부림 예고에 반대로 버티기)는 둘 다 '언제 누르나'였다. 이제는 '어디로 모나'다:
 *  · 손가락이 그물을 끌고 다닌다(그물은 손가락보다 조금 위 · 빠르기 상한이 있다 — 휙 옮겨 덮치지 못한다).
 *  · 물고기는 그물이 다가오면 달아난다. 흔한 물고기 말고는 그물보다 빠르다 — 쫓기만 해서는 안 잡히고,
 *    물가 · 구석으로 몰아 달아날 길을 막아야 한다. 오래 쫓기면 지쳐서 느려진다(끈질기게 몰면 결국 잡힌다).
 *  · 그물 안에 잠깐(dwell) 붙잡아 두면 건진다. 빠져나가면 진행이 되돌아간다. 시간 안에 못 건지면 흩어진다.
 *  · 반응 속도보다 길(어느 쪽에서 다가가 어디로 모나)이 성공을 가른다 — fishingherd.test 가 봇 둘로 잠근다.
 * 물고기 뽑기는 예전 뜰채와 같은 seed · 같은 rollCatch(method "scoop" · junk) — 다 큰 놈 없음 · 쓰레기는 빛 고리 없는 그림자. 순수 · 고정 걸음. */
export const HERD_TIME_S = 25;
/** 물고기가 헤엄치는 수면 칸(화면 비율) — 예전 뜰채와 같은 칸. 세로 거리는 1.25 를 곱해 잰다(4:5) */
export const HERD_AREA = { x: [0.12, 0.88], y: [0.46, 0.86] } as const;
const HERD_STEP = 1 / 60;
const HY = 1.25;
export type HerdTune = { netSpeed: number; netR: number };
export type HerdFish = { id: number; haul: FishCatch; x: number; y: number; vx: number; vy: number; stam: number; dwell: number; need: number; flee: number; fleeR: number; tire: number; wx: number; wy: number; ph: number; side: number };
export type HerdStatus = "on" | "caught" | "out";
export type Herd = { t: number; left: number; nx: number; ny: number; fish: HerdFish[]; status: HerdStatus; caught: number; quality: number; acc: number };

export function herdTune(netTier: number, eff: Eff): HerdTune {
  eff = soft(eff);
  return { netSpeed: 0.3 * (1 + eff.power * 0.012), netR: netRadius(netTier) * 1.05 + eff.line * 0.0006 };
}
/** 판을 연다 — 물고기 4~5마리, 그물은 아래 가운데 물가 */
export function startHerd(spot: FishSpot, luck: number, bait: number, seed: number, when?: FishMoment): Herd {
  const r = rng(seed);
  const n = 4 + (luck >= 20 ? 1 : 0);
  const fish = Array.from({ length: n }, (_, id): HerdFish => {
    const haul = rollCatch(spot, luck, 0.5, (seed + (id + 1) * 7919) >>> 0, { bait, method: "scoop", junk: true, when });
    const d = haul.difficulty;
    const junk = !!haul.junk;
    return {
      id, haul,
      x: 0.25 + r() * 0.5, y: 0.5 + r() * 0.2, vx: 0, vy: 0, stam: 1, dwell: 0,
      need: junk ? 0.45 : 0.75 + d * 0.07,
      // 흔한 물고기(d 1~1.5)는 그물과 비슷한 빠르기 — 쫓아도 잡힌다. 귀할수록 빠르고 일찍 눈치챈다
      flee: junk ? 0.08 : 0.34 + d * 0.03,
      fleeR: junk ? 0.1 : 0.2 + d * 0.012,
      // 귀할수록 덜 지친다 — 쫓기만 해서는(지쳐서 붙잡히기) 시간 안에 못 건진다. 물가로 몰아야 한다
      tire: junk ? 0.2 : 0.075 / (1 + d * 0.14),
      wx: 0.4 + r() * 0.5, wy: 0.5 + r() * 0.6, ph: r() * 6.28, side: r() < 0.5 ? -1 : 1,
    };
  });
  return { t: 0, left: HERD_TIME_S, nx: 0.5, ny: 0.8, fish, status: "on", caught: -1, quality: 0, acc: 0 };
}
/** 구석 — 두 벽까지 이만큼 안(거리 단위) */
export const HERD_PIN = 0.07;
/** 이만큼 지치면 트인 물에서도 붙잡힌다 */
export const HERD_TIRED = 0.2;
/** 구석에 몰렸나 — 가로 벽과 세로 벽 둘 다에 붙었다(벽 하나면 벽을 따라 미끄러져 빠져나간다) */
export const herdPinned = (f: Pick<HerdFish, "x" | "y">) =>
  Math.min(f.x - HERD_AREA.x[0], HERD_AREA.x[1] - f.x) <= HERD_PIN && Math.min((f.y - HERD_AREA.y[0]) * HY, (HERD_AREA.y[1] - f.y) * HY) <= HERD_PIN;
/** 그물 중심과의 거리(세로 1.25 배) */
export const herdDist = (f: Pick<HerdFish, "x" | "y">, x: number, y: number) => Math.hypot(f.x - x, (f.y - y) * HY);

function herdTick(h: Herd, tx: number, ty: number, tune: HerdTune) {
  const dt = HERD_STEP;
  h.t += dt;
  h.left -= dt;
  // 그물 — 손가락 쪽으로, 빠르기 상한
  const gx = clamp(tx, HERD_AREA.x[0], HERD_AREA.x[1]), gy = clamp(ty, HERD_AREA.y[0], HERD_AREA.y[1]);
  const ex = gx - h.nx, ey = (gy - h.ny) * HY, ed = Math.hypot(ex, ey);
  const step = Math.min(ed, tune.netSpeed * dt);
  if (ed > 1e-6) { h.nx += (ex / ed) * step; h.ny += (ey / ed) * step / HY; }
  const [x0, x1] = HERD_AREA.x, [y0, y1] = HERD_AREA.y;
  for (const f of h.fish) {
    const dx = f.x - h.nx, dy = (f.y - h.ny) * HY, d = Math.hypot(dx, dy) || 1e-6;
    let wx: number, wy: number, sp: number;
    const scared = d < f.fleeR;
    if (scared) {
      // 달아난다 — 그물 반대쪽 + 물고기마다 정해진 쪽으로 조금 비껴서(늘 똑같이 곧게 달아나지 않게)
      wx = dx / d + (-dy / d) * 0.35 * f.side;
      wy = dy / d + (dx / d) * 0.35 * f.side;
      // 물가를 꺼린다 — 트인 물로 가려 한다. 그래서 구석에 몰아넣어야 갇힌다(가장자리에 혼자 붙지 않는다)
      // 그물이 코앞이면 그냥 도망친다(그래서 물가로 밀어붙일 수 있다)
      const m = 0.14, aw = 1.4 * Math.min(1, d / f.fleeR) ** 2;
      if (f.x - x0 < m) wx += (1 - (f.x - x0) / m) * aw;
      if (x1 - f.x < m) wx -= (1 - (x1 - f.x) / m) * aw;
      if ((f.y - y0) * HY < m) wy += (1 - ((f.y - y0) * HY) / m) * aw;
      if ((y1 - f.y) * HY < m) wy -= (1 - ((y1 - f.y) * HY) / m) * aw;
      sp = f.flee * (0.45 + 0.55 * f.stam) * (0.55 + 0.45 * (1 - d / f.fleeR));
      f.stam = Math.max(0, f.stam - dt * f.tire);
    } else {
      // 느긋하게 떠돈다
      wx = Math.sin(h.t * f.wx + f.ph); wy = Math.cos(h.t * f.wy + f.ph * 1.7) * 0.6;
      sp = 0.06;
      f.stam = Math.min(1, f.stam + dt * 0.05);
    }
    const wl = Math.hypot(wx, wy) || 1;
    const vx = (wx / wl) * sp, vy = (wy / wl) * sp;
    const k = Math.min(1, dt * (scared ? 9 : 3));
    f.vx += (vx - f.vx) * k;
    f.vy += (vy - f.vy) * k;
    // 벽 — 막힌 쪽 빠르기는 버리고 벽을 따라 미끄러진다(구석이면 갇힌다)
    let x = f.x + f.vx * dt, y = f.y + (f.vy * dt) / HY;
    if (x < x0) { x = x0; if (f.vx < 0) f.vx = 0; } else if (x > x1) { x = x1; if (f.vx > 0) f.vx = 0; }
    if (y < y0) { y = y0; if (f.vy < 0) f.vy = 0; } else if (y > y1) { y = y1; if (f.vy > 0) f.vy = 0; }
    f.x = x; f.y = y;
    // 트인 물에선 그물 밑으로 빠져나간다 — 물가(벽)에 밀어붙였거나 지쳤을 때만 그물 안에 붙잡힌다
    const inside = herdDist(f, h.nx, h.ny) <= tune.netR && (herdPinned(f) || f.stam < HERD_TIRED);
    f.dwell = inside ? f.dwell + dt : Math.max(0, f.dwell - dt * 1.5);
  }
}
/** dt 만큼 — 손가락이 가리키는 곳(tx, ty, 화면 비율)으로 그물을 끈다. 고정 걸음(1/60초)이라 화면 틱 · 테스트가 같은 결과. 순수 */
export function stepHerd(s: Herd, dt: number, tx: number, ty: number, tune: HerdTune): Herd {
  if (s.status !== "on") return s;
  const h: Herd = { ...s, fish: s.fish.map((f) => ({ ...f })) };
  h.acc += Math.min(0.25, Math.max(0, dt));
  while (h.acc >= HERD_STEP && h.status === "on") {
    h.acc -= HERD_STEP;
    herdTick(h, tx, ty, tune);
    const got = h.fish.findIndex((f) => f.dwell >= f.need);
    if (got >= 0) {
      h.status = "caught";
      h.caught = got;
      // 솜씨 — 빨리 건질수록. 20초 판의 절반 안이면 거의 만점
      h.quality = clamp(1.15 - h.t / (HERD_TIME_S * 0.8), 0, 1);
    } else if (h.left <= 0) h.status = "out";
  }
  return h;
}
/** 지금 가장 오래 붙잡아 둔 물고기와 그 진행(0~1) */
export function herdBest(h: Herd): { i: number; p: number } {
  let i = -1, p = 0;
  h.fish.forEach((f, k) => { const v = f.dwell / f.need; if (v > p) { p = v; i = k; } });
  return { i, p: Math.min(1, p) };
}
