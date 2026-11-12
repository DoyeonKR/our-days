/* 밤 집어등 낚시 — 다섯 번째 방식(2026-11-12) [사용자 승인: "밤에만 열리는 다섯 번째 방식입니다. 불빛으로 물고기를 모았다가 터지는 순간 낚아 올립니다"]
 * 손이 하는 일이 다른 넷과 달라야 방식이다:
 *  1막 '모으기' — 누르고 있으면 불이 밝아지고 떼면 어두워진다. 초록 칸(물고기가 좋아하는 밝기)에 두면 무리가 모인다.
 *     너무 밝으면 놀라고(놀람이 차면 흩어진다), 너무 어두우면 모이던 무리가 빠진다. 초록 칸은 천천히 오르내려서 손을 계속 맞춰야 한다.
 *  2막 '터짐' — 무리가 다 모이면 잠깐 뒤(언제인지 모른다) 한꺼번에 불빛으로 솟구친다. 그 짧은 창에 채야(위로 튕기기 · ↑ 키) 걸린다.
 *     창 전에 채면 무리가 놀라 흩어지고, 놓치면 무리가 지나가 버린다 — 막 누르는 손은 못 낚는다.
 *  3막 — 걸리면 찌낚시 힘겨루기(fishing.ts stepFight)를 짧게 한다. 무리 속에서 바로 걸어 올리는 거라 감기는 속도가 빠르다(lightFightTune).
 * 전부 순수 함수다 — 입력({ hold, strike })만 받는다. 시각 · 주사위는 호출자가 넘긴다. fishinglight.test 의 자동 플레이가 난이도를 잠근다.
 * ⚠ fishing.ts 는 이 파일을 부르지 않는다(이 파일이 fishing.ts 를 부른다 — 고리 금지). 밤 판정 lightNight 는 fishingworld.ts 에 있다. */
import { fightTune, rng, softStat, type FightTune, type FishStat } from "./fishing.ts";

type Eff = Pick<Record<FishStat, number>, "power" | "line">;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** rise · fall — 누르고 있을 때 · 뗐을 때 초당 밝기 변화. lo · width — 초록 칸(가운데가 wander 만큼 오르내린다, drift 는 그 빠르기).
 *  gain · loss — 초록 칸에서 초당 모이는 무리 · 어두울 때 빠지는 무리. scare · calm — 너무 밝을 때 쌓이는 놀람 · 아닐 때 풀리는 놀람.
 *  waitMin · waitMax — 다 모인 뒤 터지기까지(초) · window — 터진 뒤 채야 하는 창(초) · limit — 이만큼 지나도 못 모으면 무리가 떠난다 */
export type LightTune = { rise: number; fall: number; lo: number; width: number; wander: number; drift: number; gain: number; loss: number; scare: number; calm: number; waitMin: number; waitMax: number; window: number; limit: number };
/** gather 모으는 중 · ready 다 모였다(곧 터진다) · surge 터졌다(지금 채라) · hooked 걸렸다 · scared 너무 밝아 흩어졌다 · gone 못 모아 떠났다 · missed 창을 놓쳤다 · early 일찍 챘다 */
export type LightStatus = "gather" | "ready" | "surge" | "hooked" | "scared" | "gone" | "missed" | "early";
export type Light = {
  t: number;
  /** 지금 불 밝기 0~1 */
  bright: number;
  /** 모인 무리 0~1 · 놀람 0~1 */
  school: number;
  scare: number;
  /** ready — 터지기까지 남은 초 · surge — 터진 뒤 지난 초 */
  surgeIn: number;
  surgeT: number;
  /** 초록 칸에 머문 시간(솜씨) · 챈 순간의 surgeT(못 챘으면 -1) */
  good: number;
  hookAt: number;
  /** 초록 칸이 오르내리는 박자의 시작점 — 판마다 다르다 */
  phase: number;
  rngState: number;
  status: LightStatus;
};
export type LightInput = { hold: boolean; strike: boolean };
/** 이 비율 안에 채면 '완벽한 챔질' — 찌낚시의 PERFECT_HOOK 과 같은 값 */
export const LIGHT_PERFECT = 0.45;

/** d = 힘겨루기 세기(fightLevel — 등급 + 낚시터 깊이). 귀할수록 초록 칸이 좁고 · 빨리 움직이고 · 창이 짧다. 줄 다루기가 칸과 창을, 힘이 모으는 속도를 덜어 준다 */
export function lightTune(d: number, eff: Eff): LightTune {
  const power = softStat(eff.power), line = softStat(eff.line);
  return {
    // 밝기는 천천히 변한다 — 0.25초 늦게 보는 손이 초록 칸을 넘지 않게. 빨리 변하면 늦게 보는 손이 늘 넘어 '놀람'이 절벽이 됐다(봇: 0.62 · 0.5 에서 서툰 손 5%)
    rise: 0.45,
    fall: 0.38,
    lo: 0.4,
    width: Math.max(0.13, 0.28 - d * 0.015 + line * 0.0026),
    wander: Math.min(0.16, 0.07 + d * 0.012),
    drift: 0.42 + d * 0.03,
    gain: (0.15 * (1 + power * 0.014)) / (1 + d * 0.05),
    loss: 0.07,
    // 놀람은 넘친 만큼 쌓이고 칸 안에선 풀린다 — 0.9 면 서툰 손이 거의 다 흩어지고(10%) 0.45 면 아무도 안 흩어졌다. 그 사이
    scare: (0.65 * (1 + d * 0.06)) / (1 + line * 0.03),
    calm: 0.25,
    waitMin: 0.7,
    waitMax: 2.6,
    // 창 — 사람 반응(0.2~0.35초)은 대개 들어오고 느린 손(0.2~0.5초)은 절반쯤 놓친다. 등급이 오를수록 짧다
    window: Math.max(0.28, 0.52 - d * 0.03 + line * 0.003),
    limit: 40,
  };
}

export function startLight(seed: number, tune: LightTune): Light {
  const r = rng(seed);
  void tune;
  return { t: 0, bright: 0.12, school: 0, scare: 0, surgeIn: 0, surgeT: 0, good: 0, hookAt: -1, phase: r() * Math.PI * 2, rngState: (seed * 47 + 13) >>> 0, status: "gather" };
}

/** 지금 초록 칸 — 천천히 오르내린다(위아래 끝은 0.12 ~ 0.95 안) */
export function lightBand(l: Pick<Light, "t" | "phase">, tune: LightTune) {
  const mid = tune.lo + tune.width / 2 + Math.sin(l.t * tune.drift + l.phase) * tune.wander;
  const lo = clamp(mid - tune.width / 2, 0.12, 0.95 - tune.width);
  return { lo, hi: lo + tune.width };
}

/** 한 칸 진행. 순수. strike 는 '이번 칸에 새로 챘다'(위로 튕긴 순간 — 화면은 누르기를 채기로 치지 않는다) — 누르고 있는 동안 내내 true 가 아니다 */
export function stepLight(l: Light, dt: number, input: LightInput, tune: LightTune): Light {
  if (l.status !== "gather" && l.status !== "ready" && l.status !== "surge") return l;
  const n: Light = { ...l, t: l.t + dt };
  n.bright = clamp(n.bright + (input.hold ? tune.rise : -tune.fall) * dt, 0, 1);
  if (input.strike) {
    if (n.status === "surge") {
      n.hookAt = n.surgeT;
      n.status = "hooked";
    } else n.status = "early"; // 다 모이기 전에 채면 무리가 놀라 흩어진다 — 막 누르는 손은 못 낚는다
    return n;
  }
  if (n.status === "surge") {
    // 솟구치는 동안은 밝기를 안 본다 — 손이 채는 데 가 있다
    n.surgeT += dt;
    if (n.surgeT > tune.window) n.status = "missed";
    return n;
  }
  const band = lightBand(n, tune);
  if (n.bright > band.hi) {
    const over = n.bright - band.hi;
    n.scare += tune.scare * (0.5 + over * 4) * dt;
    n.school = Math.max(0, n.school - tune.loss * 0.5 * dt);
  } else {
    n.scare = Math.max(0, n.scare - tune.calm * dt);
    if (n.bright >= band.lo) {
      n.good += dt;
      if (n.status === "gather") n.school = Math.min(1, n.school + tune.gain * dt);
    } else {
      const under = band.lo - n.bright;
      n.school = Math.max(0, n.school - tune.loss * (0.5 + under * 3) * dt);
    }
  }
  if (n.scare >= 1) {
    n.status = "scared";
    return n;
  }
  if (n.status === "gather") {
    if (n.school >= 1) {
      const r = rng(n.rngState);
      n.rngState = (n.rngState * 31 + 37) >>> 0;
      n.surgeIn = tune.waitMin + r() * (tune.waitMax - tune.waitMin);
      n.status = "ready";
    } else if (n.t >= tune.limit) n.status = "gone";
  } else if (n.status === "ready") {
    // 다 모인 뒤 너무 어두우면 무리가 빠져 다시 모아야 한다 — 터질 때까지 불을 지켜야 한다
    if (n.school < 0.85) n.status = "gather";
    else {
      n.surgeIn -= dt;
      if (n.surgeIn <= 0) {
        n.surgeT = 0;
        n.status = "surge";
      }
    }
  }
  return n;
}

/** 모으기 솜씨 0~1 — 초록 칸에 머문 비율 */
export const lightQuality = (l: Pick<Light, "good" | "t">) => (l.t <= 0 ? 0 : Math.min(1, l.good / l.t));
/** 챔질 — 창 안 어디서 챘나. 빠를수록 좋다(1 → 0) · 완벽한 챔질인가 */
export function lightHook(l: Pick<Light, "hookAt">, tune: Pick<LightTune, "window">) {
  if (l.hookAt < 0) return { q: 0, perfect: false };
  return { q: clamp(1 - l.hookAt / tune.window, 0, 1), perfect: l.hookAt <= tune.window * LIGHT_PERFECT };
}
/** 판 전체의 솜씨 — 모으기 · 챔질 · 힘겨루기의 평균(catchPoints · captureChance 에 넘긴다) */
export const lightTotalQuality = (gather: number, hook: number, fight: number) => clamp((gather + hook + fight) / 3, 0, 1);

/** 3막 — 찌낚시 힘겨루기를 그대로 쓰되 감기는 속도가 빠르고(LIGHT_REEL) 줄은 조금 더 팽팽해진다(LIGHT_STRAIN — 무리 속에서 걸린 놈이 몸부림친다).
 *  짧고 거칠다. 거리(dist)는 1 에서 시작한다 — 짧게 잘라 시작하면 피버(남은 거리 45~70% 에서 끼어든다)가 첫 칸에 바로 터진다.
 *  봇(fishinglight.test): 팽팽함 1.08 → 1.1 에서 끌어올림이 6% 떨어진다 — 이 근처는 가파르니 고치면 봇을 다시 돌린다 */
export const LIGHT_REEL = 1.8;
export const LIGHT_STRAIN = 1.1;
export function lightFightTune(d: number, eff: Eff, family?: string): FightTune {
  const t = fightTune(d, eff, family);
  return { ...t, reel: t.reel * LIGHT_REEL, tensionUp: t.tensionUp * LIGHT_STRAIN };
}
