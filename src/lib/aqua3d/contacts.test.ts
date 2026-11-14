// 물고기끼리 몸이 겹치지 않는다(2026-11-14) [사용자: "물고기 개체끼리 겹치면 안돼 물리엔진처럼"]
// 화면과 같은 한 프레임(stepFish)을 북적이는 수조에서 돌려, 몸통 캡슐(world.resolveContacts 와 같은 치수)이 서로 파고든 프레임을 센다.
// 예전(separate 만)은 보정이 천천히 따라가 몇 초씩 겹친 채였다. 밀어내기가 순간 이동을 만들지 않는지도 본다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FISH_BASE_CM } from "../aquarium.ts";
import type { Course } from "./habits.ts";
import { WORLD, fishLength, resolveContacts, schoolsOf, tankTall, wideScale } from "./world.ts";
import { stepFish, type StepFish } from "./fishstep.ts";
import { rockObstacles, substrateHeight } from "./habitat.ts";
import { tankDeep } from "./tunnel.ts";

const adult = (family: string) => fishLength(FISH_BASE_CM[family] ?? 20, family);
/** 두 몸통 캡슐이 파고든 깊이(0 이면 안 닿음) — resolveContacts 와 같은 치수(반지름 0.13L · 바닥 0.17L · 반길이 0.4L) */
function penetration(p: Float32Array, h: Float32Array, L: Float32Array, pin: Float32Array, i: number, j: number) {
  const seg = (k: number, s: number) => { const l = Math.hypot(h[k * 3], h[k * 3 + 1], h[k * 3 + 2]) || 1; return [p[k * 3] + (h[k * 3] / l) * s, p[k * 3 + 1] + (h[k * 3 + 1] / l) * s, p[k * 3 + 2] + (h[k * 3 + 2] / l) * s]; };
  let best = Infinity;
  for (let a = -4; a <= 4; a++) for (let b = -4; b <= 4; b++) {
    const A = seg(i, (a / 4) * L[i] * 0.4), B = seg(j, (b / 4) * L[j] * 0.4);
    best = Math.min(best, Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]));
  }
  const r = (k: number) => L[k] * (pin[k] > 0.5 ? 0.17 : 0.13);
  return Math.max(0, r(i) + r(j) - best);
}

function crowd(tier: number, families: string[], seconds: number, withContacts = true) {
  (globalThis as { __noContacts?: boolean }).__noContacts = !withContacts;
  const wide = wideScale(0), tall = tankTall(tier), deep = tankDeep(tier), sub = Math.min(tier, 6);
  const obstacles = rockObstacles(tier, wide, deep);
  const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / wide, z / deep, sub) - WORLD.floor) * tall;
  const fish = families.map((family, i) => ({ id: 100 + i * 7, family, length: adult(family) }));
  const n = fish.length, schools = schoolsOf(fish), byId = new Map(fish.map((f) => [f.id, f]));
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0 };
  let frames = 0, overlapped = 0, worstJump = 0;
  const prev = new Float32Array(n * 3);
  const hz = 15;
  for (let k = 0, t = 0; t < seconds; k++, t = k / hz) {
    stepFish(bodies, schools, (id) => byId.get(id)?.length, t, k ? 1 / hz : 0, { wide, tall, deep, heightAt, obstacles, feed: null, hall: null }, b);
    frames++;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (penetration(b.positions, b.heading, b.lengths, b.pinned, i, j) > 0.06 * Math.min(b.lengths[i], b.lengths[j])) overlapped++;
    if (k > 0) for (let i = 0; i < n; i++) worstJump = Math.max(worstJump, Math.hypot(b.positions[i * 3] - prev[i * 3], b.positions[i * 3 + 1] - prev[i * 3 + 1], b.positions[i * 3 + 2] - prev[i * 3 + 2]) / b.lengths[i]);
    prev.set(b.positions);
  }
  return { rate: overlapped / (frames * ((n * (n - 1)) / 2)), worstJump };
}

test("북적이는 수조에서도 몸끼리 파고들지 않는다 — 바닥 물고기 · 무리 · 큰 몸이 섞여도", () => {
  const mix = ["flounder", "flounder", "catfish", "ray", "rockfish", "guppy", "guppy", "guppy", "tetra", "tetra", "koi", "goldfish", "sea_bream", "octopus", "starfish", "clown"];
  for (const tier of [2, 6]) {
    const r = crowd(tier, mix, 60), off = crowd(tier, mix, 60, false);
    assert.ok(r.rate < off.rate * 0.1, `${tier}단계 밀어내기 전 ${(off.rate * 100).toFixed(2)}% → 뒤 ${(r.rate * 100).toFixed(3)}%`);
    assert.ok(r.rate < 0.002, `${tier}단계 겹친 짝 ${(r.rate * 100).toFixed(3)}%`);
    // 밀어내기가 순간 이동을 만들지 않는다(15Hz 한 칸에 몸길이 반 아래)
    assert.ok(r.worstJump < Math.max(0.35, off.worstJump * 1.2), `${tier}단계 한 칸에 몸길이 ${r.worstJump.toFixed(2)}배(밀어내기 없이 ${off.worstJump.toFixed(2)})`);
  }
});

test("밀어내기 — 겹친 두 몸을 정확히 떼고, 무거운 몸은 덜 밀리고, 건너뛴 몸(사냥 장면)은 그대로", () => {
  const pos = new Float32Array([0, 0, 0, 0.1, 0, 0]), head = new Float32Array([1, 0, 0, 1, 0, 0]), L = new Float32Array([1, 1]);
  resolveContacts(pos, L, 2, { heading: head });
  const p2 = new Float32Array([0, 0, 0, 0, 0.05, 0]);
  resolveContacts(p2, L, 2, { heading: head, mass: new Float32Array([0, 1]) });
  assert.equal(p2[1], 0, "안 밀리는 몸은 그대로");
  assert.ok(Math.abs(p2[4] - p2[1]) >= 0.26 - 1e-4, `떨어진 거리 ${p2[4] - p2[1]}`);
  const p3 = new Float32Array([0, 0, 0, 0, 0.05, 0]);
  resolveContacts(p3, L, 2, { heading: head, skip: new Uint8Array([1, 1]) });
  assert.deepEqual([...p3], [...new Float32Array([0, 0, 0, 0, 0.05, 0])]);
});
