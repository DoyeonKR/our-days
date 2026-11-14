// 들어올리기 엔진(stepLift) — 2026-11-05 뜰채 2막으로 만들었고, 2026-11-14 뜰채가 몰아서 건지기(fishingherd.test)로 바뀐 뒤엔
// 함께 끌어올리기(fishcoop — 상대를 돕는 짧은 들어올리기)만 쓴다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { LIFT_EDGE, LIFT_SLIP_S, liftQuality, liftTune, startLift, stepLift, type Lift } from "./fishingmodes.ts";

const DT = 1 / 30;

/** 0.24초 늦게 보고, 예고를 보면 미리 반대로 기대는 사람 흉내 */
function play(d: number, eff: number, seed: number, mode: "human" | "still" | "nohold"): Lift {
  const tune = liftTune(d, { power: eff, line: eff });
  let l = startLift(seed, tune);
  const seen: Lift[] = [];
  let c = 0;
  while (l.status === "on") {
    seen.push(l);
    const x = seen[Math.max(0, seen.length - 1 - 7)];
    const want = mode === "human" ? -(x.tilt * 1.5 + x.vel * 0.35) - (x.warnLeft > 0 ? x.side * 0.45 : 0) : 0;
    c += (Math.max(-1, Math.min(1, want)) - c) * Math.min(1, DT * 9);
    l = stepLift(l, DT, mode !== "nohold", c, tune);
  }
  return l;
}
const rate = (f: (s: number) => boolean, n = 200) => { let k = 0; for (let i = 0; i < n; i++) if (f(i * 7 + 1)) k++; return k / n; };

test("들어올리기 — 버티면 올라오고, 가만히 있으면 몸부림에 튀어 나가고, 안 누르면 안 올라온다", () => {
  assert.ok(rate((s) => play(1.5, 3, s, "human").status === "landed") > 0.9, "흔한 물고기는 대부분 건진다");
  assert.ok(rate((s) => play(1.5, 3, s, "still").status === "dropped") > 0.6, "반대쪽으로 안 끌면 놓친다");
  const idle = play(1.5, 3, 5, "nohold");
  assert.equal(idle.status, "dropped");
  assert.equal(idle.h, 0, "누르지 않으면 안 올라온다");
});

test("들어올리기 — 귀할수록 어렵고, 줄 다루기 · 힘이 덜어 준다 · 한 등급 차이로 절벽이 생기지 않는다", () => {
  const at = (d: number, eff: number) => rate((s) => play(d, eff, s, "human").status === "landed");
  let prev = 1;
  for (let d = 1; d <= 6; d++) {
    const now = at(d + 0.5, 3);
    assert.ok(now <= prev + 0.05, `d${d}`);
    assert.ok(prev - now < 0.5, `d${d}: ${prev} → ${now}`);
    prev = now;
  }
  assert.ok(at(5.5, 15) > at(5.5, 3) + 0.3, "능력치가 오르면 귀한 놈도 건진다");
});

test("들어올리기 — 끝에 닿아도 잠깐은 버틸 틈 · 기울수록 늦게 올라온다 · 솜씨는 수평에 머문 비율 · 같은 입력 같은 결과", () => {
  assert.ok(LIFT_EDGE < 1 && LIFT_SLIP_S > 0.3);
  const tune = liftTune(2, { power: 3, line: 3 });
  const tilted = stepLift({ ...startLift(1, tune), tilt: 0.95, vel: 0 }, DT, true, 0, tune);
  assert.equal(tilted.status, "on", "끝에 닿는 순간 바로 놓치지 않는다");
  const level = stepLift({ ...startLift(1, tune), tilt: 0, vel: 0, nextKick: 9 }, 0.5, true, 0, tune);
  const lean = stepLift({ ...startLift(1, tune), tilt: 0.7, vel: 0, nextKick: 9 }, 0.5, true, -0.7 * tune.spring / tune.grip, tune);
  assert.ok(level.h > lean.h, "기울면 덜 올라온다");
  const a = play(2.5, 4, 99, "human"), b = play(2.5, 4, 99, "human");
  assert.deepEqual(a, b);
  assert.ok(liftQuality(a) >= 0 && liftQuality(a) <= 1);
});

test("들어올리기 — 몸부림을 못 막아 기운 동안엔 그물이 도로 내려간다(누르고만 있어선 안 올라온다) [사용자 2026-11-12]", () => {
  const tune = liftTune(3, { power: 3, line: 3 });
  const base = { ...startLift(1, tune), h: 0.5, nextKick: 9 };
  const yanked = stepLift({ ...base, tilt: 0.95, vel: 0, kickLeft: 0.4, side: 1 }, 0.2, true, 0, tune);
  assert.ok(yanked.h < 0.5, `끌려 내려간다 ${yanked.h}`);
  const held = stepLift({ ...base, tilt: 0, vel: 0, kickLeft: 0.4, side: 1 }, 0.2, true, -1, tune);
  assert.ok(held.h > 0.5, `막으면 올라온다 ${held.h}`);
  const loose = stepLift({ ...base, tilt: 0, vel: 0 }, 0.5, false, 0, tune);
  assert.ok(loose.h < 0.5, "손을 떼면 가라앉는다");
});
