// 캐스팅 lock. [사용자 2026-11-02 "화면을 빙글빙글빙글 돌렸다가 휙 던지면 … 몇미터 … 멀리던질 수록 잘 던진거 … 돌리는 속도에 따라"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CAST_BASE, CAST_BOOST_MAX, FLICK_FULL, OVERHEAT_S, OVERHEAT_TO, SPIN_HI, SPOTS, castBoost, castTiming, castCurve, castMeters, castRange, castRating, castScore, fishingOf, headingDelta, rollCatch, spendBait, spinGain, startSpin, stepSpin, type CastSpin } from "./fishing.ts";
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
  assert.ok(castScore(spin(2.6, 3), 0) <= 0.83, "돌리기만으론 끝까지 못 간다");
  assert.ok(castScore(startSpin(), FLICK_FULL) <= 0.53, "튕기기만으로도");
  assert.equal(castScore(startSpin(), 0), CAST_BASE, "그냥 눌러 던지기 — 돌리기를 강요하지 않는다");
  assert.ok(castMeters(CAST_BASE, castRange(0, 1)) >= 11, "그냥 던져도 십여 미터는 간다");
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

test("낚싯대가 최대 거리를 올린다 — 대나무 25m ~ 별빛 60m, 힘을 끝까지 올리면 +12m", () => {
  const maxOf = [0, 1, 2, 3, 4, 5].map((tier) => Math.round(castRange(tier, 0)));
  assert.deepEqual(maxOf, [25, 32, 39, 46, 53, 60]);
  assert.equal(castRange(5, 40), 72);
  const src = readFileSync(join(process.cwd(), "src/components/FishingPanels.tsx"), "utf8");
  assert.match(src, /최대 \$\{Math\.round\(castRange\(RODS\.indexOf\(x\), fs\.stats\.power\)\)\}m/, "장비 목록에 적혀 있다");
});

test("강요하지 않는다 — 안내 문구가 탭을 먼저 말하고, 돌리는 안내 그림이 없고, 안 돌리면 게이지가 안 뜬다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.ok(src.includes("눌러서 던지기 · 돌리면 더 멀리"));
  assert.ok(!src.includes("fish-spin-guide"));
  assert.ok(src.includes("spinLive.turns > 0.5 && ("));
});

test("거리 — 멀리 던질수록 숫자가 크다 · 좋은 낚싯대 · 힘이 멀리 보낸다 · 바나나킥은 제대로 돌렸을 때만", () => {
  assert.ok(castMeters(1, castRange(0, 1)) > castMeters(0.5, castRange(0, 1)));
  assert.ok(castMeters(0, castRange(0, 1)) >= 3);
  assert.ok(castRange(5, 1) > castRange(0, 1) && castRange(0, 40) > castRange(0, 1));
  assert.equal(castRating(0.9, 3), "바나나킥!");
  assert.notEqual(castRating(0.9, 1), "바나나킥!");
  assert.notEqual(castRating(0.5, 5), "바나나킥!");
});

test("멀리 던지면 실제로 좋다 — 귀한 물고기 · 다 큰 물고기가 잘 온다 · 잘 던져도 미끼 상한은 못 넘는다", () => {
  const stats = (cast: number) => {
    let rare = 0, adult = 0, top = 0;
    for (let i = 0; i < 6000; i++) {
      const c = rollCatch(SPOTS.find((x) => x.key === "seomjin")!, 3, cast, i * 113 + 1, { bait: 3 });
      if (c.family !== SPOTS.find((x) => x.key === "seomjin")!.pool[0][0]) rare++;
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
  const a = spendBait(s0, SPOTS.find((x) => x.key === "brook")!, "float", "bait_worm", "2026-11-02", 30.5);
  assert.ok(a.ok && fishingOf(a.state).bestCast === 30.5);
  if (!a.ok) return;
  const b = spendBait(a.state, SPOTS.find((x) => x.key === "brook")!, "float", "bait_worm", "2026-11-02", 12);
  assert.ok(b.ok && fishingOf(b.state).bestCast === 30.5);
});

test("화면 — 거리를 보여 주고 · 돌린 방향으로 휘어 날고 · 뜰채는 그대로 탭 · 짧게 눌러도 던져진다", () => {
  const src = readFileSync(join(process.cwd(), "src/components/FishingGame.tsx"), "utf8");
  assert.ok(src.includes("fish-throw") && src.includes("thrown.m.toFixed(1)"));
  assert.ok(src.includes("score, curve, boost)") && src.includes("const curve = castCurve(spin)"), "휘는 힘은 돌린 솜씨로");
  assert.ok(src.includes("const flyMs = fx?.cast(") && src.includes("}, flyMs + at);") && src.includes("}, flyMs + plan.waitMs);"), "입질 · 간 보기는 찌가 내려앉은 뒤부터 센다");
  assert.ok(src.includes("thrown.rating"), "거리 옆에 한마디 — 글자판을 또 찍지 않는다");
  assert.ok(src.includes('method === "scoop"') && src.includes("beginScoop()"));
  assert.match(src, /function release\(\) \{\s+if \(phase === "charge"\)/, "놓으면 언제든 던진다");
});

test("바나나킥 — 휘는 힘은 돌린 솜씨로 · 그냥 누르면 곧게 · 방향은 돌린 쪽 · 끝까지 돌리면 슈퍼", () => {
  assert.equal(castCurve(startSpin()), 0, "탭은 곧게 난다");
  const spin = (rps: number, secs: number) => {
    let s: CastSpin = startSpin();
    for (let t = 0; t < secs; t += 1 / 60) s = stepSpin(s, (rps * Math.PI * 2) / 60, 1 / 60);
    return s;
  };
  const short = castCurve(spin(3, 0.4)), long = castCurve(spin(3, 1.8)), wild = castCurve(spin(6, 1.8)), back = castCurve(spin(-3, 1.8));
  assert.ok(short >= 0.55 && short < 0.75, `한 바퀴 남짓도 예전의 보통 던지기만큼은 휜다 (${short})`);
  assert.equal(castCurve(spin(3, 0.1)), 0, "반 바퀴도 안 돌리면 곧게");
  assert.ok(long > 0.8 && long <= 1, `고르게 오래 돌리면 크게 (${long})`);
  assert.ok(wild < long, `너무 빠르게 막 돌리면 덜 휜다 (${wild})`);
  assert.ok(back < 0 && Math.abs(back + long) < 1e-9, "반대로 돌리면 반대로 같은 만큼");
  for (const v of [short, long, wild, back]) assert.ok(Math.abs(v) <= 1);
  assert.equal(castRating(0.97, 3.5), "바나나킥!", "끝까지 돌리기만 해선 슈퍼가 아니다 — 가득 찬 순간에 튕겨야(boost)");
  assert.equal(castRating(0.97, 3.5, 1.12), "슈퍼 바나나킥!");
  assert.equal(castRating(0.97, 3.5, 1.25), "퍼펙트 바나나킥!");
  assert.equal(castRating(0.97, 2.5), "바나나킥!");
  assert.equal(castRating(0.9, 3), "바나나킥!", "옛 경계는 그대로");
});

test("돌리기만 하면 늘지 않는다 — 가득 찬 채 계속 돌리면 과열로 확 줄고, 너무 빠르면 줄고, 들쭉날쭉하면 덜 찬다 [사용자 2026-11-12]", () => {
  const at = (secs: number) => spin(2.6, secs);
  let full = startSpin(), secs = 0;
  while (full.energy < 0.995 && secs < 5) { full = stepSpin(full, 2.6 * Math.PI * 2 * DT, DT); secs += DT; }
  assert.ok(secs > 1.6 && secs < 2.6, `알맞게 돌리면 2초 남짓에 가득 (${secs})`);
  // 계속 돌리면 OVERHEAT_S 안에 과열 — 힘이 OVERHEAT_TO 근처로 떨어진다
  const burnt = spin(2.6, OVERHEAT_S + 0.1, full);
  assert.ok((burnt.burns ?? 0) >= 1 && burnt.energy < 0.8, `과열 (${burnt.energy})`);
  assert.ok(OVERHEAT_TO <= 0.4);
  assert.ok(castScore(burnt, FLICK_FULL) < castScore(full, FLICK_FULL) - 0.1, "과열되면 거리가 준다");
  // 오래 돌린다고 길어지지 않는다 — 5초 돌린 것이 가득 찬 순간보다 짧다
  assert.ok(castMeters(castScore(at(5), FLICK_FULL), 40, castBoost(at(5), FLICK_FULL)) < castMeters(castScore(full, FLICK_FULL), 40, castBoost(full, FLICK_FULL)));
  // 너무 빠르면 쌓였던 힘이 빠진다
  const fast = spin(SPIN_HI + 2, 1.5, full);
  assert.ok(fast.energy < 0.5, `너무 빠름 (${fast.energy})`);
  // 들쭉날쭉 — 평균은 같아도(1.2 ↔ 4 바퀴) 고르게 돈 것보다 덜 찬다
  let rough = startSpin();
  for (let t = 0; t < 2.4; t += DT) rough = stepSpin(rough, (Math.floor(t * 4) % 2 ? 4 : 1.2) * Math.PI * 2 * DT, DT);
  assert.ok(rough.energy < spin(2.6, 2.4).energy - 0.3, `들쭉날쭉 (${rough.energy})`);
});

test("더 멀리 — 가득 찬 순간에 세게 튕기면 낚싯대 끝보다 25% 더 · 늦게 놓거나 약하게 튕기면 보너스 없음", () => {
  let s = startSpin();
  while (s.energy < 0.995) s = stepSpin(s, 2.6 * Math.PI * 2 * DT, DT);
  assert.ok(castTiming(s) > 0.9);
  const best = castBoost(s, FLICK_FULL);
  assert.ok(best > 1 + CAST_BOOST_MAX * 0.9, `정점 ${best}`);
  assert.ok(castBoost(s, FLICK_FULL * 0.5) === 1, "약하게 튕기면 없음");
  const late = spin(2.6, OVERHEAT_S * 0.75, s);
  assert.ok(castBoost(late, FLICK_FULL) < best - 0.12, "늦게 놓으면 줄어든다");
  assert.equal(castBoost(spin(2.6, 1), FLICK_FULL), 1, "덜 찼으면 없음");
  const range = castRange(5, 40);
  assert.ok(castMeters(1, range, best) > 88, `별빛 낚싯대 최대 ${castMeters(1, range, best)}m`);
  assert.equal(castRating(castScore(s, FLICK_FULL), s.turns, best), "퍼펙트 바나나킥!");
});
