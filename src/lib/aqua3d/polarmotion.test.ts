// 바다코끼리 · 황제펭귄 고유 움직임(2026-11-26) [사용자: "신규 개체들 움직임과 디테일 업그레이드 해줘 충분히"]
// 잠그는 것: 바다코끼리는 숨 사이에 모래로 내려가 주둥이를 박고 기며 먼지를 일으킨다(기울기 35° 안) · 펭귄은 주기마다 내달리고(거품 줄) 한 프레임에 0.3 넘게 안 뛴다 ·
//   같은 시각 = 같은 자리 · 쉼터에선 두 자세가 거둬진다
import test from "node:test";
import assert from "node:assert/strict";
import { FISH_BASE_CM } from "../aquarium.ts";
import { fishCourse, fishLength } from "./world.ts";
import { FISH_HABITS, haulBlend, type Course } from "./habits.ts";

const run = (key: string, scale: number, secs = 300) => {
  const L = fishLength(FISH_BASE_CM[key], key);
  let nose = 0, full = 0, noseFloor = 0, puff = 0, burst = 0, n = 0, maxStep = 0, maxTilt = 0;
  for (const id of [1, 2, 3]) {
    let prev = { ...fishCourse(id, 0, L, key, scale, {}) };
    for (let t = 1 / 30; t < secs; t += 1 / 30) {
      const c = fishCourse(id, t, L, key, scale, {});
      n++;
      maxStep = Math.max(maxStep, Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z));
      maxTilt = Math.max(maxTilt, (Math.abs(Math.atan2(c.dy, Math.hypot(c.dx, c.dz))) * 180) / Math.PI);
      if ((c.nose ?? 0) > 0.9) nose++;
      if ((c.nose ?? 0) > 0.995) { full++; if (c.y < -5.3 + L * 0.36 && c.ground > 0.99) noseFloor++; if (c.puff >= 0) puff++; }
      if ((c.burst ?? 0) > 0.5) burst++;
      prev = { ...c };
    }
  }
  return { L, nose: nose / n, noseFloor: noseFloor / Math.max(1, full), puff: puff / Math.max(1, full), burst: burst / n, maxStep, maxTilt };
};

test("바다코끼리 — 숨 사이마다 모래로 내려가 주둥이를 박고 기며 모래 먼지를 일으킨다, 머리는 35° 안으로만 든다", () => {
  assert.equal(FISH_HABITS.walrus.forage, true);
  const r = run("walrus", 1.6);
  assert.ok(r.nose > 0.08 && r.nose < 0.4, `주둥이 박은 몫 ${r.nose}`);
  assert.ok(r.noseFloor > 0.95, `박은 동안 모래 위 ${r.noseFloor}`);
  assert.ok(r.puff > 0.5, `먼지 ${r.puff}`);
  assert.ok(r.maxTilt <= 36, `기울기 ${r.maxTilt}`);
  assert.ok(r.maxStep < 0.3, `한 프레임 ${r.maxStep}`);
});

test("바다코끼리 — 모래로 내려가고 오르는 길은 비스듬하다(승강기처럼 곧게 가라앉지 않는다) · 높은 수조에서도", () => {
  // 2026-11-26 처음 판은 9초에 내려가며 길도 늦춰 61 ~ 82° 로 곧게 가라앉았다. 내려가기 한 번의 평균 각(위아래 거리 ÷ 옆 거리, 월드)을 잰다
  const L = fishLength(FISH_BASE_CM.walrus, "walrus");
  for (const tall of [1, 3]) {
    const ramps: number[] = [];
    for (const id of [1, 2, 3, 4, 5, 6]) {
      const pts: number[][] = [];
      for (let t = 0; t < 1100; t += 0.25) { const c = fishCourse(id, t, L, "walrus", 1.6, { tall }); pts.push([c.x, c.y * tall, c.z, c.nose ?? 0]); }
      for (let i = 0; i < pts.length - 1; i++) {
        if (!(pts[i][3] > 0.03 && pts[i][3] < 0.97)) continue;
        let j = i, v = 0, h = 0;
        while (j < pts.length - 1 && pts[j + 1][3] > 0.03 && pts[j + 1][3] < 0.97) { j++; v += Math.abs(pts[j][1] - pts[j - 1][1]); h += Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][2] - pts[j - 1][2]); }
        if (v > 0.5) ramps.push((Math.atan2(v, h) * 180) / Math.PI);
        i = j;
      }
    }
    ramps.sort((a, b) => a - b);
    assert.ok(ramps.length > 20, `내려가기 수 ${ramps.length}`);
    assert.ok(ramps[ramps.length >> 1] < 35, `tall ${tall} 가운데 각 ${ramps[ramps.length >> 1]}`);
  }
});

test("황제펭귄 — 주기마다 내달린다(1.7배), 넓은 수조에서도 한 프레임 0.3 안", () => {
  assert.ok((FISH_HABITS.emperor_penguin.burst ?? 0) > 0);
  const r = run("emperor_penguin", 1.6);
  assert.ok(r.burst > 0.06 && r.burst < 0.25, `내달리는 몫 ${r.burst}`);
  assert.ok(r.maxStep < 0.3, `한 프레임 ${r.maxStep}`);
  // 다른 물고기는 두 칸을 안 쓴다
  const c = fishCourse(1, 40, 1, "guppy", 1, {});
  assert.equal(c.nose ?? 0, 0); assert.equal(c.burst ?? 0, 0);
});

test("같은 시각 = 같은 자리 · 쉼터에서는 주둥이 박기 · 질주를 거둔다", () => {
  const L = fishLength(FISH_BASE_CM.walrus, "walrus");
  const a = { ...fishCourse(2, 123.4, L, "walrus", 1, {}) }; fishCourse(9, 50, 1, "emperor_penguin", 1, {});
  const b = fishCourse(2, 123.4, L, "walrus", 1, {});
  assert.deepEqual([a.x, a.y, a.z, a.nose, a.burst], [b.x, b.y, b.z, b.nose, b.burst]);
  const out = { x: 0, y: -4, z: 0, dx: 1, dy: 0, dz: 0, effort: 1, turn: 0, amp: 1, pulse: 0, ground: 1, puff: 1, hover: 0, nose: 1, burst: 1 } as Course;
  for (let t = 0; t < 400; t += 0.5) {
    const o = { ...out }, R = haulBlend(4, t, L, 1, -5.3, { rock: null, share: 0 }, o);
    if (R >= 1) { assert.equal(o.nose, 0); assert.equal(o.burst, 0); return; }
  }
  assert.fail("쉬는 때를 못 찾았다");
});
