/* 피버타임 (2026-11-02) — [사용자: "물고기를 낚는 도중에 피버타임이 시전되고 … 실패하면 무조건 놓치는거고 … 확률 3%" → "무조건 더 희귀한건 아니고 등급업될 확률이 있는거야 등급업 확률은 1~5% … 10초 안에 10문제를 모두 맞히는거야"]
 * 한 판마다 3% 확률로 힘겨루기 도중에 끼어든다(뜰채는 건지는 순간). 10초 안에 가운데 물고기와 같은 그림이 있는 쪽을 10번 연달아 맞힌다.
 * 다 맞히면 그 물고기를 바로 끌어올리고, 1~5% 확률로 등급이 한 칸 오른다(시간이 많이 남을수록 높다). 한 번이라도 틀리거나 시간이 지나면 그 자리에서 놓친다.
 * ⚠ 1차판은 게이지를 모아 시작하는 별도 미니게임이었고, 2차 초안은 성공하면 무조건 귀해졌다. 둘 다 요청과 달랐다. 순수 함수 — 화면은 components/FishFever. */
import { GRADES, familyOf, fishArtKey, speciesOf } from "./aquarium.ts";
import { BAITS, rng, rollCatch, type FishCatch, type FishSpot } from "./fishing.ts";

export const FEVER_CHANCE = 0.03;
export const FEVER_SECONDS = 10;
export const FEVER_ROUNDS = 10;
/** 이 번째 문제부터 닮은 물고기가 나온다 */
export const FEVER_HARD_FROM = 6;
export const UPGRADE_MIN = 0.01;
export const UPGRADE_MAX = 0.05;
/** 이만큼 남기고 끝내면 등급업 확률이 최대다 */
const UPGRADE_FULL_LEFT_S = 5;

/** 이번 판에 터지나 — r 은 0~1 */
export const rollFever = (r: number) => r < FEVER_CHANCE;

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
  // 처음엔 다른 계열끼리, 뒤쪽 문제는 같은 계열의 다른 품종끼리(눈으로 봐야 한다). 계열이 하나뿐이면 그 안에서.
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
  return answer === "left" ? { left: b, right: a, target: b, answer } : { left: a, right: b, target: b, answer };
}

/** 이 낚시터 피버에 나올 수 있는 그림 전부 — 미리 받아 둔다 */
export const feverArts = (spot: FishSpot): string[] => formsOf(spot).flat();
/** 이번 판 10문제에 나오는 그림 */
export function feverRoundArts(spot: FishSpot, seed: number): string[] {
  const set = new Set<string>();
  for (let i = 0; i < FEVER_ROUNDS; i++) {
    const r = feverRound(spot, seed, i);
    set.add(r.left);
    set.add(r.right);
  }
  return [...set];
}

export type Fever = { left: number; hits: number; status: "on" | "won" | "lost" };
export const startFever = (): Fever => ({ left: FEVER_SECONDS, hits: 0, status: "on" });
export function tickFever(f: Fever, dt: number): Fever {
  if (f.status !== "on") return f;
  const left = Math.max(0, f.left - dt);
  return { ...f, left, status: left <= 0 ? "lost" : "on" };
}
/** 고른 쪽 판정 — 틀리면 그 자리에서 끝, 다 맞히면 성공 */
export function answerFever(f: Fever, picked: FeverSide, answer: FeverSide): Fever {
  if (f.status !== "on") return f;
  if (picked !== answer) return { ...f, status: "lost" };
  const hits = f.hits + 1;
  return { ...f, hits, status: hits >= FEVER_ROUNDS ? "won" : "on" };
}
/** 누른 자리 · 민 방향 → 고른 쪽. 24px 넘게 밀었으면 민 방향, 아니면 누른 쪽 */
export function feverPick(startX: number, endX: number, width: number): FeverSide {
  const d = endX - startX;
  if (Math.abs(d) > 24) return d < 0 ? "left" : "right";
  return endX < width / 2 ? "left" : "right";
}

/** 등급업 확률 1~5% — 빨리 끝낼수록 높다 */
export const upgradeChance = (left: number) => UPGRADE_MIN + (UPGRADE_MAX - UPGRADE_MIN) * Math.max(0, Math.min(1, left / UPGRADE_FULL_LEFT_S));

/** 성공한 물고기의 등급을 한 칸 올린 모습. 같은 계열의 다음 품종을 먼저 찾고, 없으면 이 낚시터의 다른 계열에서 찾는다. 미끼 상한을 못 넘고, 오를 곳이 없으면 그대로다. */
export function upgradeCatch(c: FishCatch, spot: FishSpot, bait: number, luck: number, seed: number): FishCatch {
  const cap = BAITS[Math.min(BAITS.length - 1, bait)].maxGrade;
  const now = GRADES.indexOf(c.grade);
  if (c.junk) return rollCatch(spot, luck, 1, seed, { bait });
  const speciesAbove = (family: string) => familyOf(family)?.finals.find((x) => GRADES.indexOf(x.grade) > now && GRADES.indexOf(x.grade) <= cap);
  const keys = [c.family, ...spot.pool.map(([k]) => k).filter((k) => k !== c.family)];
  for (const family of keys) {
    const next = speciesAbove(family);
    if (next) return { family, stage: 2, species: next.key, grade: next.grade, difficulty: GRADES.indexOf(speciesOf(next.key)?.grade ?? next.grade) + 1 };
  }
  return c;
}
