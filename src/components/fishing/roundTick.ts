/* 낚시 한 판의 박자(33ms)마다 도는 방식별 처리 — 2026-11-20 [사용자: 리뷰 "방식별(찌 · 루어 · 뜰채 · 심해 · 집어등) 조작을 따로 떼어 내는 정리" → 진행]
 * 예전엔 FishingGame 의 한 useEffect 안에 214줄로 이어져 있었다. 내용은 그대로 옮겼고(줄 단위로 같다), 화면은 여기서 고른 함수 하나만 부른다(tickRound).
 * 규칙은 여전히 lib/fishing · lib/fishingmodes · lib/fishinglight(순수) — 여기는 그 상태를 한 칸 넘기고 화면 · 연출 · 끝 처리를 부르는 자리다.
 * 상태는 화면의 ref · setState 를 그대로 받는다(TickCtx) — 새 상태를 만들지 않는다. */
import type { FishFx } from "@/lib/fishingfx";
import type { IslandRow } from "@/lib/couple";
import type { IslandState } from "@/lib/island";
import { GRADES } from "@/lib/aquarium";
import { BOSS_PHASE_NAME, bossPhase, bossTune, catchArt, deepestOf, fightLevel, fightQuality, noteDeepest, shadowSize, startFight, stepFight, traceTick, type CastSpin, type CastTrace, type Fight, type FightTune, type FishCatch, type FishResult, type GearResult, type MethodKey } from "@/lib/fishing";
import { bossLeft, bossOf } from "@/lib/fishingworld";
import { lightBand, lightFightTune, lightHook, lightQuality, lightTotalQuality, stepLight, type Light, type LightTune } from "@/lib/fishinglight";
import { HERD_TIME_S, deepGrabbing, deepQuality, deepSurvivedGrab, herdBest, lureQuality, lureRing, stepDeep, stepHerd, stepLure, stepSway, swayQuality, triggerHerdDash, type Deep, type DeepTune, type Herd, type HerdTune, type Lure, type LureTune, type Sway, type SwayTune } from "@/lib/fishingmodes";
import type { LostKey, Phase, StampTone } from "@/components/FishingGame";

export type TickCtx = {
  pausedRef: { current: boolean };
  roundEnded: { current: boolean };
  fxRef: { current: FishFx | null };
  keySpin: { current: boolean };
  castAngRef: { current: number };
  traceRef: { current: CastTrace };
  spinRef: { current: CastSpin };
  lureRef: { current: Lure | null };
  lureTuneRef: { current: LureTune | null };
  fishRef: { current: FishCatch | null };
  lightStrike: { current: boolean };
  lightRef: { current: Light | null };
  lightTuneRef: { current: LightTune | null };
  holdRef: { current: boolean };
  lightQ: { current: { gather: number; hook: number } };
  effRef: { current: { power: number; line: number } };
  planFeverRef: { current: () => void };
  tuneRef: { current: FightTune | null };
  fightRef: { current: Fight | null };
  herdRef: { current: Herd | null };
  herdTuneRef: { current: HerdTune | null };
  herdCaught: { current: boolean };
  /** 뜰채로 붙잡았다 — 판을 끝내는 표시(올리는 쪽은 화면에 둔다: 판을 시작할 때 화면이 다시 내린다) */
  markHerdCaught: () => void;
  herdAt: { current: { x: number; y: number } };
  herdDashRef?: { current: boolean };
  gradeRef: { current: number };
  timers: { current: ReturnType<typeof setTimeout>[] };
  methodRef: { current: MethodKey };
  swayRef: { current: Sway | null };
  swayTuneRef: { current: SwayTune | null };
  rodXRef: { current: number };
  coopAskRef: { current: (dist: number) => void };
  deepRef: { current: Deep | null };
  deepTuneRef: { current: DeepTune | null };
  spinAcc: { current: number };
  backAcc: { current: number };
  spinNow: { current: number };
  backNow: { current: number };
  releasingRef: { current: number };
  reelDir: { current: number };
  reelDirShown: { current: number };
  deepMeters: { current: number };
  rowRef: { current: IslandRow | null };
  fightHpRef: { current: number };
  bossChunkRef: { current: number };
  bossPhaseRef: { current: 0 | 1 | 2 };
  bossEffRef: { current: { power: number; line: number } };
  setSpinLive: (v: CastSpin | null) => void;
  setCharge: (v: number) => void;
  setLureS: (v: Lure | null) => void;
  setLightS: (v: Light | null) => void;
  setPerfectHook: (v: boolean) => void;
  setFight: (v: Fight | null) => void;
  setPhase: (v: Phase) => void;
  setHerdS: (v: Herd | null) => void;
  setFish: (v: FishCatch | null) => void;
  setSwayS: (v: Sway | null) => void;
  setReleasing: (v: boolean) => void;
  setReelDirS: (v: number) => void;
  setDeepS: (v: Deep | null) => void;
  setSpin: (v: number) => void;
  setDeepRecord: (v: number) => void;
  setBossRage: (v: 0 | 1 | 2) => void;
  loseRound: (key: LostKey) => void;
  landRound: (q: number) => void;
  feverNow: (dist: number, quality: number) => boolean;
  /** 심해 판이 피버로 넘어갈 때 남겨 둔 '끌어올릴 때 할 일' — 피버를 이기면 화면이 부른다 */
  deepPend: { current: (() => void) | null };
  showStamp: (text: string, tone: StampTone) => void;
  act: <R extends FishResult | GearResult>(make: (st: IslandState) => R, queued?: boolean) => Promise<R | null>;
  buzz: (p: number | number[]) => void;
  dice: () => number;
  clock: () => number;
};

/** 한 박자 — 단계(던지기 · 루어 박자 · 집어등 · 뜰채)가 먼저, 그다음은 방식(루어 끌기 · 심해 · 찌와 나머지) */
export function tickRound(k: TickCtx, phase: Phase, dt: number, elapsed: number, now: number): void {
  if (phase === "charge") return tickCharge(k, dt, elapsed, now);
  if (phase === "lure") return tickLureBeat(k, dt);
  if (phase === "glow") return tickLantern(k, dt);
  if (phase === "aim") return tickHerd(k, dt);
  const how = k.methodRef.current;
  if (how === "lure") return tickLureFight(k, dt);
  if (how === "deep") return tickDeep(k, dt);
  tickFight(k, dt, how);
}

/** 던지기 — 돌리기 · 튕김을 칸마다 센다 */
export function tickCharge(k: TickCtx, dt: number, elapsed: number, now: number): void {
  const { fxRef, keySpin, castAngRef, traceRef, spinRef, setSpinLive, setCharge } = k;
  const fxn = fxRef.current;
  // 프레임이 밀려도(0.1초 넘게) 모인 각도를 같은 비율로 줄여 센다 — 빠르기가 부풀지 않게(stepSpinFrame). 칸마다 상태를 남겨 둔다(튕김 창 앞을 잰다)
  const keyAngle = keySpin.current ? elapsed * 2.6 * Math.PI * 2 : undefined;
  if (keyAngle !== undefined) castAngRef.current += dt * 2.6 * Math.PI * 2;
  const next = traceTick(traceRef.current, spinRef.current, elapsed, now, keyAngle);
  spinRef.current = next;
  setSpinLive(next);
  setCharge(next.energy);
  fxn?.set({ castAng: castAngRef.current });
  return;
}

/** 루어 1막 — 박자 맞춰 치기 */
export function tickLureBeat(k: TickCtx, dt: number): void {
  const { fxRef, lureRef, lureTuneRef, fishRef, setLureS, loseRound } = k;
  const fxn = fxRef.current;
  const cur = lureRef.current, tune = lureTuneRef.current, c = fishRef.current;
  if (!cur || !tune || !c) return;
  const next = stepLure(cur, dt, tune, fightLevel(c));
  lureRef.current = next;
  setLureS(next);
  fxn?.set({ beat: lureRing(next, tune), beatHot: Math.abs(next.t - next.nextBeat) <= tune.window, interest: next.interest, line: next.line });
  if (next.status === "empty") loseRound("empty");
  return;
}

/** 집어등 — 불 밝기 지키기 → 솟구칠 때 채기 → 짧은 힘겨루기로 */
export function tickLantern(k: TickCtx, dt: number): void {
  const { fxRef, fishRef, lightStrike, lightRef, lightTuneRef, holdRef, lightQ, effRef, planFeverRef, tuneRef, fightRef, setLightS, setPerfectHook, setFight, setPhase, loseRound, showStamp, buzz, dice } = k;
  const fxn = fxRef.current;
  const cur = lightRef.current, tune = lightTuneRef.current, c = fishRef.current;
  if (!cur || !tune || !c) return;
  const strike = lightStrike.current;
  lightStrike.current = false;
  const next = stepLight(cur, dt, { hold: holdRef.current, strike }, tune);
  lightRef.current = next;
  setLightS(next);
  const band = lightBand(next, tune);
  fxn?.lanternSet(next.bright, band.lo, band.hi, next.school, next.scare);
  if (cur.status !== "surge" && next.status === "surge") {
    fxn?.lanternSurge();
    buzz([30, 20, 60]);
  }
  if (cur.status === "gather" && next.status === "ready") buzz(15);
  if (next.status === "hooked") {
    // 걸렸다 — 3막(짧은 힘겨루기). 감기는 속도가 빠르고 줄은 조금 더 팽팽하다(lightFightTune)
    const h = lightHook(next, tune);
    lightQ.current = { gather: lightQuality(next), hook: h.q };
    fxn?.lanternEnd(true);
    setPerfectHook(h.perfect);
    fxn?.hook(h.perfect);
    showStamp(h.perfect ? "완벽한 챔질!" : "걸렸다!", h.perfect ? "gold" : "hit");
    buzz([25, 20, 90]);
    const ft = lightFightTune(fightLevel(c), effRef.current, c.family);
    planFeverRef.current();
    const f = startFight(Math.floor(dice() * 2 ** 31), ft);
    tuneRef.current = ft;
    fightRef.current = f;
    setFight(f);
    setPhase("fight");
    return;
  }
  const lostKey = next.status === "scared" ? "lightScare" : next.status === "gone" ? "lightGone" : next.status === "early" ? "lightEarly" : next.status === "missed" ? "lightMiss" : null;
  if (lostKey) {
    fxn?.lanternEnd(false);
    loseRound(lostKey);
  }
  return;
}

/** 뜰채 v2 — 여울 포켓 · 물살 · 휘두르기 대시 · 황금 거품 */
export function tickHerd(k: TickCtx, dt: number): void {
  const { fxRef, roundEnded, fishRef, herdRef, herdTuneRef, herdCaught, markHerdCaught, herdAt, herdDashRef, gradeRef, timers, setPerfectHook, setHerdS, setFish, loseRound, landRound, feverNow, showStamp, buzz } = k;
  const fxn = fxRef.current;
  let cur = herdRef.current;
  const tune = herdTuneRef.current;
  if (!cur || !tune || roundEnded.current || herdCaught.current) return;
  const at = herdAt.current;
  if (herdDashRef?.current) {
    herdDashRef.current = false;
    const dashed = triggerHerdDash(cur, at.x, at.y, tune);
    if (dashed !== cur) {
      cur = dashed;
      buzz(22);
    }
  }
  const prevBonus = cur.bonuses ?? 0;
  const next = stepHerd(cur, dt, at.x, at.y, tune);
  herdRef.current = next;
  setHerdS(next);
  // 개발 빌드에서만 — 콘솔 · 자동 확인에서 판 상태를 본다(배포 빌드엔 이 분기가 없다)
  if (process.env.NODE_ENV !== "production") (window as { __fishHerd?: Herd }).__fishHerd = next;
  if ((next.bonuses ?? 0) > prevBonus) {
    showStamp("황금 거품! +2초", "gold");
    buzz([20, 20, 45]);
  }
  fxn?.setShoal(next.fish.map((f) => ({ id: f.id, x: f.x, y: f.y, h: Math.atan2(f.vy, f.vx || 1e-6), z: 1, reach: true, size: shadowSize(f.haul), grade: GRADES.indexOf(f.haul.grade), junk: !!f.haul.junk })));
  fxn?.aim({ x: next.nx, y: next.ny, r: tune.netR });
  const best = herdBest(next);
  fxn?.setHerdV2({ pockets: next.pockets, flow: next.flow, bubble: next.bubble, lureAt: next.lureAt, dashing: (next.dashLeft ?? 0) > 0, progress: best.p });
  if (next.status === "on" && best.i >= 0 && !next.fish[best.i].haul.junk) {
    const c = next.fish[best.i].haul;
    fishRef.current = c;
    gradeRef.current = GRADES.indexOf(c.grade);
    if (feverNow(1 - best.p, Math.max(0, Math.min(1, 1.15 - next.t / (HERD_TIME_S * 0.8))))) { setFish(c); fxn?.aim(null); fxn?.setShoal([]); return; }
  }
  if (next.status === "caught") {
    markHerdCaught();
    const c = next.fish[next.caught].haul;
    fishRef.current = c;
    gradeRef.current = GRADES.indexOf(c.grade);
    setFish(c);
    const good = next.quality >= 0.75;
    setPerfectHook(good);
    fxn?.plunge(next.nx, next.ny, tune.netR, 0.2);
    fxn?.netLand(true, gradeRef.current);
    showStamp(good ? "단숨에!" : "건졌다!", good ? "gold" : "hit");
    buzz([30, 30, 110]);
    timers.current.push(setTimeout(() => {
      fxRef.current?.aim(null);
      fxRef.current?.setShoal([]);
      landRound(next.quality);
    }, 650));
  } else if (next.status === "out") {
    fxn?.aim(null);
    fxn?.setShoal([]);
    loseRound("time");
  }
  return;
}

/** 루어 2막 — 물고기 반대쪽으로 끌기 */
export function tickLureFight(k: TickCtx, dt: number): void {
  const { fxRef, lureRef, swayRef, swayTuneRef, rodXRef, coopAskRef, setSwayS, loseRound, landRound, feverNow, buzz } = k;
  const fxn = fxRef.current;
  const cur = swayRef.current, tune = swayTuneRef.current;
  if (!cur || !tune) return;
  const next = stepSway(cur, dt, rodXRef.current, tune);
  swayRef.current = next;
  setSwayS(next);
  fxn?.set({ tension: next.tension, dist: next.dist, rodX: rodXRef.current, fishX: next.fishX });
  if (cur.warnLeft <= 0 && next.warnLeft > 0) {
    fxn?.warn("surge");
    buzz(15);
  }
  if (next.status === "on" && feverNow(next.dist, (lureQuality(lureRef.current ?? { hits: 0, beats: 0 }) + swayQuality(next)) / 2)) return;
  if (next.status === "on") coopAskRef.current(next.dist);
  if (next.status === "landed") landRound((lureQuality(lureRef.current ?? { hits: 0, beats: 0 }) + swayQuality(next)) / 2);
  else if (next.status === "snapped") loseRound("swaySnap");
  else if (next.status === "escaped") loseRound("escaped");
  return;
}

/** 심해 — 릴 돌리기 · 줄 풀기 · 대왕오징어 습격 */
export function tickDeep(k: TickCtx, dt: number): void {
  const { fxRef, keySpin, fishRef, coopAskRef, deepRef, deepTuneRef, spinAcc, backAcc, spinNow, backNow, releasingRef, reelDir, reelDirShown, deepMeters, rowRef, setFish, setReleasing, setReelDirS, setDeepS, setSpin, setDeepRecord, loseRound, landRound, feverNow, showStamp, act, buzz, clock } = k;
  const fxn = fxRef.current;
  const cur = deepRef.current, tune = deepTuneRef.current;
  if (!cur || !tune) return;
  const raw = keySpin.current ? 1.35 : spinAcc.current / (Math.PI * 2) / Math.max(0.001, dt);
  const rawBack = backAcc.current / (Math.PI * 2) / Math.max(0.001, dt);
  spinAcc.current = 0;
  backAcc.current = 0;
  // 손을 멈추면 곧바로 멈춘 것으로 — 내려갈 땐 빨리 따라간다(파고들기 예고에 멈췄는데 0.3초 늦게 멈춤으로 쳐서 장력을 먹었다)
  spinNow.current += (raw - spinNow.current) * Math.min(1, dt * (raw < spinNow.current ? 18 : 7));
  backNow.current += (rawBack - backNow.current) * Math.min(1, dt * (rawBack < backNow.current ? 18 : 7));
  const rps = spinNow.current < 0.03 ? 0 : spinNow.current;
  const back = backNow.current < 0.03 ? 0 : backNow.current;
  const rel = back > 0.18;
  if (+rel !== releasingRef.current) { releasingRef.current = +rel; setReleasing(rel); if (rel) buzz(10); }
  if (reelDir.current !== reelDirShown.current) { reelDirShown.current = reelDir.current; setReelDirS(reelDir.current); }
  const next = stepDeep(cur, dt, rps, tune, back);
  deepRef.current = next;
  setDeepS(next);
  setSpin(rps);
  fxn?.set({ tension: next.tension, dist: next.depth, spin: rps - back, deepM: deepMeters.current, grab: deepGrabbing(next) });
  if (cur.grab !== 2 && next.grab === 2) { showStamp("대왕오징어가 덮쳐요!", "miss"); buzz([60, 40, 60, 40, 120]); }
  if (cur.grab === 3 && next.grab === 4) showStamp("버텨 냈다!", "gold");
  if (cur.warnLeft <= 0 && next.warnLeft > 0) {
    fxn?.warn("dive");
    buzz(15);
  }
  if (cur.diveLeft <= 0 && next.diveLeft > 0) {
    fxn?.surge("surge");
    buzz([35, 30, 35]);
  } else if (cur.diveLeft > 0 && next.diveLeft <= 0) {
    fxn?.surgeEnd();
  }
  // 습격을 버텨 냈으면 대물(cm 1.25배) · 가장 깊은 기록 — 끌어올릴 때(그 깊이 · 그 판의 습격으로 정한다).
  //   피버로 넘어가면 피버를 이겼을 때 같은 걸 한다(k.deepPend — 2026-11-23: 예전엔 피버로 끝난 심해 판이 깊이 기록 · 대물을 건너뛰었다)
  const survived = deepSurvivedGrab(next), m = Math.round(deepMeters.current);
  const finish = () => {
    const c = fishRef.current;
    if (c && !c.junk && survived && c.cm) { const big = { ...c, cm: Math.round(c.cm * 1.25 * 10) / 10 }; fishRef.current = big; setFish(big); }
    const fin = fishRef.current, row0 = rowRef.current;
    if (fin && !fin.junk && !fin.special && row0 && m > (deepestOf(row0.state)?.m ?? 0)) {
      const rec = { m, family: fin.family, key: catchArt(fin), at: clock() };
      setDeepRecord(m);
      void act((s) => ({ ok: true as const, state: noteDeepest(s, rec).state }), true);
    }
  };
  if (next.status === "on" && feverNow(next.depth, deepQuality(next))) { k.deepPend.current = finish; return; }
  if (next.status === "on") coopAskRef.current(next.depth);
  if (next.status === "landed") {
    finish();
    landRound(deepQuality(next));
  }
  else if (next.status === "snapped") loseRound("spinSnap");
  else if (next.status === "slack") loseRound("idle");
  else if (next.status === "escaped") loseRound("escaped");
  return;
}

/** 찌 · 집어등 · 주인 — 누르고 떼는 힘겨루기 */
export function tickFight(k: TickCtx, dt: number, how: MethodKey): void {
  const { fxRef, fishRef, holdRef, lightQ, tuneRef, fightRef, coopAskRef, fightHpRef, bossChunkRef, bossPhaseRef, bossEffRef, setFight, setBossRage, loseRound, landRound, feverNow, showStamp, buzz } = k;
  const fxn = fxRef.current;
const cur = fightRef.current, tune = tuneRef.current;
if (!cur || !tune) return;
const next = stepFight(cur, dt, holdRef.current, tune);
fightRef.current = next;
setFight(next);
fxn?.set({ tension: next.tension, dist: next.dist });
if (cur.warnLeft <= 0 && next.warnLeft > 0) {
  fxn?.warn(next.event);
  buzz(15);
}
if (cur.surgeLeft <= 0 && next.surgeLeft > 0) {
  fxn?.surge(next.event);
  buzz(next.event === "jump" ? 25 : [35, 30, 35]);
} else if (cur.surgeLeft > 0 && next.surgeLeft <= 0) {
  fxn?.surgeEnd();
}
// 주인이 체력 3분의 2 · 3분의 1 밑으로 밀리면 화가 난다 — 그 자리에서 힘겨루기가 거칠어진다
const fb = bossOf(fishRef.current?.boss);
if (fb && next.status === "on") {
  const p = bossPhase(bossLeft(fightHpRef.current, bossChunkRef.current || fb.chunk, next.dist));
  if (p > bossPhaseRef.current) {
    bossPhaseRef.current = p;
    tuneRef.current = bossTune(fb, bossEffRef.current, p === 2 ? 0.2 : 0.5);
    setBossRage(p);
    fxn?.rage(p);
    showStamp(`${fb.name} ${BOSS_PHASE_NAME[p]}!`, "miss");
    buzz([60, 40, 60, 40, 160]);
  }
}
// 집어등은 모으기 · 챔질 솜씨도 같이 센다(점수 · 포획 확률의 quality)
const fq = how === "light" ? lightTotalQuality(lightQ.current.gather, lightQ.current.hook, fightQuality(next)) : fightQuality(next);
if (next.status === "on" && feverNow(next.dist, fq)) return;
if (next.status === "on") coopAskRef.current(next.dist);
if (next.status === "landed") {
  const b = bossOf(fishRef.current?.boss);
  if (b && bossLeft(fightHpRef.current, bossChunkRef.current || b.chunk, 0) > 0) loseRound("bossBroke");
  else landRound(fq);
} else if (next.status === "slack") loseRound("slack");
else if (next.status !== "on") loseRound(next.status);
}

