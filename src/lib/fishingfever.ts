/* 피버타임 (2026-11-02) — [사용자: "차라리 피버타임을 가지고 서로 다른 그림을 오른쪽 왼쪽에 배치하고 뭐 10초 안에 같은 방향으로 맞추기 같은 미니게임"]
 * 물고기를 5번 끌어올리면 게이지가 찬다. 10초 동안 가운데 물고기와 같은 그림이 있는 쪽을 누르거나 그쪽으로 민다.
 * 맞히면 콤보, 틀리면 콤보가 끊기고 1초를 잃는다. 조금 지나면 닮은 물고기(같은 계열)끼리 나와서 눈으로 봐야 한다.
 * 순수 함수 — 화면은 components/FishFever. 같은 seed 면 같은 문제다. 보상은 하루 하트 상한 안에서 준다(fishing.ts finishFever). */
import { familyOf, fishArtKey } from "./aquarium.ts";
import { rng, type FishSpot } from "./fishing.ts";

export const FEVER_NEED = 5;
export const FEVER_SECONDS = 10;
export const FEVER_WRONG_PENALTY_S = 1;
/** 이만큼 맞힌 뒤부터 닮은 물고기가 나온다 */
export const FEVER_HARD_FROM = 6;

export type FeverSide = "left" | "right";
export type FeverRound = { left: string; right: string; target: string; answer: FeverSide };

/** 이 낚시터에서 나오는 물고기의 그림들 — 계열별로 */
function formsOf(spot: FishSpot): string[][] {
  return spot.pool.map(([k]) => {
    const f = familyOf(k);
    if (!f) return [];
    // 다 큰 품종들만 — 치어와 다 큰 놈은 한 종뿐인 계열(만타 등)에서 거의 같은 그림이라 눈으로 못 가른다
    return [...new Set(f.finals.map((x) => fishArtKey({ family: k, stage: 2, species: x.key })))];
  }).filter((x) => x.length > 0);
}

/** i 번째 문제. 왼쪽과 오른쪽은 항상 다른 그림이다. */
export function feverRound(spot: FishSpot, seed: number, i: number): FeverRound {
  const r = rng((Math.imul(seed, 31) + Math.imul(i + 1, 2654435761)) >>> 0);
  const groups = formsOf(spot);
  const pick = (list: string[]) => list[Math.floor(r() * list.length) % list.length];
  let a: string, b: string;
  // 처음엔 다른 계열끼리, 조금 지나면 같은 계열의 다른 품종끼리(눈으로 봐야 한다). 계열이 하나뿐이면 그 안에서.
  const close = groups.filter((g) => g.length >= 2);
  if ((i >= FEVER_HARD_FROM || groups.length < 2) && close.length > 0) {
    const list = close[Math.floor(r() * close.length) % close.length];
    a = pick(list);
    b = pick(list.filter((x) => x !== a));
  } else {
    const first = Math.floor(r() * groups.length) % groups.length;
    const second = (first + 1 + Math.floor(r() * (groups.length - 1))) % groups.length;
    a = pick(groups[first]);
    b = pick(groups[second]);
  }
  const answer: FeverSide = r() < 0.5 ? "left" : "right";
  const other = a;
  return answer === "left" ? { left: b, right: other, target: b, answer } : { left: other, right: b, target: b, answer };
}

export type Fever = { left: number; hits: number; misses: number; combo: number; best: number; round: number; done: boolean };
export const startFever = (): Fever => ({ left: FEVER_SECONDS, hits: 0, misses: 0, combo: 0, best: 0, round: 0, done: false });
export function tickFever(f: Fever, dt: number): Fever {
  if (f.done) return f;
  const left = Math.max(0, f.left - dt);
  return { ...f, left, done: left <= 0 };
}
/** 고른 쪽 판정 — 맞든 틀리든 다음 문제로 넘어간다(한 문제에 묶이지 않게) */
export function answerFever(f: Fever, picked: FeverSide, answer: FeverSide): Fever {
  if (f.done) return f;
  if (picked === answer) {
    const combo = f.combo + 1;
    return { ...f, hits: f.hits + 1, combo, best: Math.max(f.best, combo), round: f.round + 1 };
  }
  const left = Math.max(0, f.left - FEVER_WRONG_PENALTY_S);
  return { ...f, left, misses: f.misses + 1, combo: 0, round: f.round + 1, done: left <= 0 };
}
/** 누른 자리 · 민 방향 → 고른 쪽. 24px 넘게 밀었으면 민 방향, 아니면 누른 쪽 */
export function feverPick(startX: number, endX: number, width: number): FeverSide {
  const d = endX - startX;
  if (Math.abs(d) > 24) return d < 0 ? "left" : "right";
  return endX < width / 2 ? "left" : "right";
}
/** 피버 보상 — 맞힌 수 + 콤보. 천장이 있고, 지급은 하루 하트 상한 안에서 */
export const feverCoins = (hits: number, best: number) => Math.min(150, hits * 5 + best * 2);
export const feverXp = (hits: number) => hits * 2;
