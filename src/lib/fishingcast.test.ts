// 캐스팅 lock. [사용자 2026-11-02 "화면을 빙글빙글빙글 돌렸다가 휙 던지면 … 몇미터 … 멀리던질 수록 잘 던진거 … 돌리는 속도에 따라"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FLICK_FULL, SPOTS, castMeters, castRange, castRating, castScore, fishingOf, headingDelta, rollCatch, spendBait, spinGain, startSpin, stepSpin, type CastSpin } from "./fishing.ts";
import { GRADES } from "./aquarium.ts";
import { createIsland } from "./island.ts";

const DT = 1 / 30;
/** rps 로 seconds 동안 돌린 결과 */
function spin(rps: number, seconds: number, from: CastSpin = startSpin()): CastSpin {
  let s = from;
  for (let t = 0; t < seconds; t += DT) s = stepSpin(s, rps * Math.PI * 2 * DT, DT);
  return s;
}
/** 진짜 손가락처럼 좌표로 원을 그려 각도를 낸다 */
function circleAngle(radius: number, rps: number, seconds: number): number {
  let sum = 0, prev: { x: number; y: number } | null = null, last = { x: radius, y: 0 };
  for (let t = DT; t < seconds; t += DT) {
    const a = t * rps * Math.PI * 2;
    const p = { x: Math.cos(a) * radius, y: Math.sin(a) * radius };
    const v = { x: p.x - last.x, y: p.y - last.y };
    if (prev) sum += headingDelta(prev.x, prev.y, v.x, v.y);
    prev = v;
    last = p;
  }
  return sum;
}

test("돌린 각도는 원의 크기와 상관없다 · 방향이 부호로 나온다 · 경계를 넘어도 튀지 않는다", () => {
  const big = circleAngle(120, 2, 2), small = circleAngle(30, 2, 2);
  assert.ok(Math.abs(big - small) < 0.01);
  assert.ok(Math.abs(big / (Math.PI * 2) - 4) < 0.2, String(big));
  assert.ok(circleAngle(60, -2, 1) < 0);
  assert.ok(Math.abs(headingDelta(-1, 0.01, -1, -0.01)) < 0.1, "±180도 경계");
});

test("돌리는 속도가 거리를 가른다 — 느림 < 알맞음 > 너무 빠름 · 튕김 없이는 끝까지 못 간다", () => {
  const score = (rps: number) => castScore(spin(rps, 2.4), FLICK_FULL);
  assert.ok(score(2.6) > 0.95, "알맞게 돌리고 튕기면 끝까지");
  assert.ok(score(0.8) < score(2.6) - 0.3, "너무 느림");
  assert.ok(score(7) < score(2.6) - 0.1, "너무 빠름");
  assert.ok(spinGain(0.2) === 0 && spinGain(3) === 1 && spinGain(8) < 1);
  assert.ok(castScore(spin(2.6, 3), 0) <= 0.701, "돌리기만");
  assert.ok(castScore(startSpin(), FLICK_FULL) <= 0.2, "튕기기만");
  assert.ok(castScore(spin(2.6, 0.5), FLICK_FULL) < castScore(spin(2.6, 2.4), FLICK_FULL), "오래 돌릴수록");
});

test("막 흔들면 안 쌓인다 · 방향을 뒤집으면 줄고 · 돌리다 멈추면 빠진다", () => {
  let wiggle = startSpin();
  for (let t = 0; t < 3; t += DT) wiggle = stepSpin(wiggle, (Math.sin(t * 40) > 0 ? 1 : -1) * 0.6, DT);
  assert.ok(wiggle.energy < 0.25, String(wiggle.energy));
  const full = spin(2.6, 2);
  const stopped = spin(0, 1.5, full);
  assert.ok(stopped.energy < full.energy - 0.3);
  assert.ok(stepSpin({ ...full, rate: 0.5 }, -2.6 * Math.PI * 2 * DT * 8, DT).energy < full.energy);
});

test("거리 — 멀리 던질수록 숫자가 크다 · 좋은 낚싯대 · 힘이 멀리 보낸다 · 살짝 던져도 몇 미터는 간다 · 바나나킥은 제대로 돌렸을 때만", () => {
  assert.ok(castMeters(1, castRange(0, 1)) > castMeters(0.5, castRange(0, 1)));
  assert.ok(castMeters(0, castRange(0, 1)) >= 3);
  assert.ok(castRange(5, 1) > castRange(0, 1) && castRange(0, 40) > castRange(0, 1));
  assert.equal(castRating(0.9, 3), "바나나킥!");
  assert.notEqual(castRating(0.9, 1), "바나나킥!");
  assert.notEqual(castRating(0.2, 5), "바나나킥!");
});

test("멀리 던지면 실제로 좋다 — 귀한 물고기 · 다 큰 물고기가 잘 온다 · 잘 던져도 미끼 상한은 못 넘는다", () => {
  const stats = (cast: number) => {
    let rare = 0, adult = 0, top = 0;
    for (let i = 0; i < 6000; i++) {
      const c = rollCatch(SPOTS[2], 3, cast, i * 113 + 1, { bait: 3 });
      if (c.family !== SPOTS[2].pool[0][0]) rare++;
      if (c.stage === 2) adult++;
      top = Math.max(top, GRADES.indexOf(c.grade));
    }
    return { rare, adult, top };
  };
  const near = stats(0.1), far = stats(1);
  assert.ok(far.rare > near.rare * 1.1, `${near.rare} ${far.rare}`);
  assert.ok(far.adult > near.adult * 1.3, `${near.adult} ${far.adult}`);
  assert.ok(far.top <= 4, "황금 떡밥 상한");
});

test("최장 기록 — 넘으면 남고 못 넘으면 그대로 · 옛 저장분은 0", () => {
  const s0 = createIsland("콩", null, 0);
  assert.equal(fishingOf(s0).bestCast, 0);
  const a = spendBait(s0, SPOTS[0], "float", "bait_worm", "2026-11-02", 30.5);
  assert.ok(a.ok && fishingOf(a.state).bestCast === 30.5);
  if (!a.ok) return;
  const b = spendBait(a.state, SPOTS[0], "float", "bait_worm", "2026-11-02", 12);
  assert.ok(b.ok && fishingOf(b.state).bestCast === 30.5);
});

test("화면 — 거리를 보여 주고 · 돌린 방향으로 휘어 날고 · 뜰채는 그대로 탭 · 짧게 눌러도 던져진다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.ok(src.includes("fish-throw") && src.includes("thrown.m.toFixed(1)"));
  assert.ok(src.includes("score, spin.dir)"), "휘는 방향");
  assert.ok(src.includes("바나나킥!"));
  assert.ok(src.includes('method === "scoop"') && src.includes("beginScoop()"));
  assert.match(src, /function release\(\) \{\s+if \(phase === "charge"\)/, "놓으면 언제든 던진다");
});
