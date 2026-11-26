import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BEACH_TOP, beachShift, beachStart, hardscapeStones, hasBeach, shoreLocal, substrateHeight } from "./habitat.ts";
import { tankAxes } from "./tiers.ts";
import { tankTall } from "./world.ts";
import { tankDeep } from "./tunnel.ts";
import { haulBlend, type Course } from "./habits.ts";
import { WORLD, fishLength, schoolsOf, wideScale } from "./world.ts";
import { FISH_BASE_CM } from "../aquarium.ts";
import { stepFish, type StepFish } from "./fishstep.ts";
import { rockObstacles } from "./habitat.ts";

// 모래사장(2026-11-15) — 8단계(심해 대수족관)부터 오른쪽으로 얕아지는 경사 · 수면 위 모래사장 · 포유류는 거기서 쉰다
const SURFACE = 5.56;

test("beach appears from the deep-sea aquarium (tier 8) up", () => {
  assert.equal(hasBeach(6), false); assert.equal(hasBeach(7), false);
  assert.equal(hasBeach(8), true); assert.equal(hasBeach(9), true);
  assert.equal(hasBeach(10), "hall"); assert.equal(hasBeach(11), "hall");
});

test("floor rises to the right into a beach above the water and stays clear of the tunnel and dome", () => {
  for (const beach of [true, "hall"] as const) {
    const x0 = beachStart(beach);
    // 2026-11-18 — 해변은 뒤쪽 오른편. 앞유리 쪽으로 올수록 물러나 앞유리 앞엔 물만 남는다(beachShift)
    for (const z of [-2.5, -1.2]) {
      assert.equal(substrateHeight(-3, z, 6, beach), substrateHeight(-3, z, 6), "left side unchanged");
      let prev = -Infinity;
      for (let x = x0; x <= 4.3 + beachShift(z); x += 0.1) { const h = substrateHeight(x, z, 6, beach); assert.ok(h >= prev - 0.06, `${beach} rises at ${x.toFixed(1)}`); prev = h; }
      assert.ok(substrateHeight(4.6, z, 6, beach) > SURFACE + 0.1, "beach top above water");
    }
    // 터널 · 돔(가운데 반지름 .9 안)은 그대로
    if (beach === "hall") for (const x of [-0.9, 0, 0.9]) assert.equal(substrateHeight(x, 0, 6, beach), substrateHeight(x, 0, 6));
    // 물가 — 그 높이에서 모래가 시작하는 자리
    assert.ok(substrateHeight(4.9, 2.9, 6, beach) < SURFACE - 3, "앞유리 쪽엔 모래사장이 없다 — 물이 앞을 채운다");
    for (const y of [-2, 0, 3, 5]) { const sx = shoreLocal(y, 0, beach); assert.ok(Math.abs(substrateHeight(sx, 0, 6, beach) - y) < 0.05 || sx === x0, `shore ${y}`); }
  }
  assert.ok(BEACH_TOP > SURFACE);
});

// 2026-11-18 [사용자: "수조도 좀 더 와이드하게 만들어서 경사를 완만하게 하고 해변을 사용자가 더 편하게 볼 수 있게"] — 물가 경사가 35 ~ 42° 였다
test("the waterline slope is gentle (≤ 25°) in world space on every beach tier", () => {
  for (const t of [8, 9, 10, 11]) {
    const b = hasBeach(t), a = tankAxes(t, tankTall(t), tankDeep(t)), z = -1.5, sx = shoreLocal(SURFACE, z, b), d = 0.05;
    const slope = (substrateHeight(sx + d, z, 6, b) - substrateHeight(sx - d, z, 6, b)) / (2 * d), deg = Math.atan(slope * a.tall / a.x) * 180 / Math.PI;
    assert.ok(deg < 25, `tier ${t} waterline ${deg.toFixed(1)}°`);
  }
});

test("stones on the slope are removed (they would be buried)", () => {
  for (const t of [8, 10]) for (const st of hardscapeStones(t)) assert.ok(st.at[0] < beachStart(hasBeach(t)) + 0.6, `tier ${t} stone at ${st.at[0]}`);
});

test("marine mammals rest on the beach top facing the water", () => {
  const c: Course = { x: -3, y: 0, z: 0, dx: 1, dy: 0, dz: 0, effort: 1, turn: 0, amp: 1, pulse: 0, ground: 0, puff: -1, hover: 0 };
  // 쉬는 때를 찾는다
  let t = 0; for (; t < 400; t += 0.5) { const cc = { ...c }; if (haulBlend(3, t, 2, 2.6, WORLD.floor, { rock: { x: 12, z: 0, r: 2, h: BEACH_TOP - WORLD.floor, kind: "beach" }, share: 0, deep: 1.6, tall: 2 }, cc) >= 0.999) break; }
  const out = { ...c };
  haulBlend(3, t, 2, 2.6, WORLD.floor, { rock: { x: 12, z: 0, r: 2, h: BEACH_TOP - WORLD.floor, kind: "beach" }, share: 0, deep: 1.6, tall: 2 }, out);
  assert.ok(Math.abs(out.x - 12) < 0.01 && out.y > BEACH_TOP && out.dx < 0, `rest ${out.x} ${out.y} ${out.dx}`);
});

test("fish stay on the water side of the shore; the scene passes the shore and beach", () => {
  const step = readFileSync(new URL("./fishstep.ts", import.meta.url), "utf8");
  assert.match(step, /if \(b\.shore\) \{ const lim = b\.shore\(y - L \* 0\.2, z\) - L \* 0\.45/);
  assert.match(step, /if \(beach\) \{ const map/);
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(scene, /motion\.shore=habitat\?\.shoreX;motion\.beach=habitat\?\.beachRest\?/);
});

// 2026-11-18 [사용자: "수조 안의 개체들이 해변 절벽에서 계속 군집하는 경향이 있어 수영 알고리즘의 변경이 필요"] — 예전엔 물가를 넘은 길을 물가 선에 붙여
// 8 · 9단계 물고기-프레임의 44% 가 물가 몸길이 0.3 안에 쌓였고(오른쪽 끝 10% 칸에 49%) 한 칸에 몸길이 33배/초로 튀었다. 이제 길을 물 폭에 맞춰 줄인다(fishstep.shoreSquash)
const adult = (f: string) => fishLength(FISH_BASE_CM[f] ?? 20, "adult" as never);
function measure(tier: number, families: string[], seconds: number) {
  const ax = tankAxes(tier, tankTall(tier), tankDeep(tier)), wide = wideScale(0) * ax.x, tall = ax.tall, deep = ax.deep, beach = hasBeach(tier);
  const heightAt = (x: number, z: number) => WORLD.floor + (substrateHeight(x / wide, z / deep, Math.min(tier, 6), beach) - WORLD.floor) * tall;
  const shore = (y: number, z = 0) => shoreLocal(WORLD.floor + (y - WORLD.floor) / tall, z / deep, beach) * wide;
  const obstacles = rockObstacles(tier, wide, deep);
  const fish = families.map((family, i) => ({ id: 100 + i * 7, family, length: adult(family) }));
  const n = fish.length, schools = schoolsOf(fish), byId = new Map(fish.map((f) => [f.id, f]));
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as Course }] as [number, StepFish]);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as Course[], count: 0, shore };
  let fr = 0, nearShore = 0; const sp: number[] = []; const prev = new Float32Array(n * 3); const bins = new Array(10).fill(0);
  for (let k = 0, t = 0; t < seconds; k++, t = k / 15) {
    stepFish(bodies, schools, (id) => byId.get(id)?.length, t, k ? 1 / 15 : 0, { wide, tall, deep, heightAt, obstacles, feed: null, hall: null }, b);
    for (let i = 0; i < n; i++) {
      const x = b.positions[i * 3], y = b.positions[i * 3 + 1], z = b.positions[i * 3 + 2], L = b.lengths[i];
      const lim = shore(y - L * 0.2, z) - L * 0.45, left = -5 * wide;
      if (k > 0) sp.push(Math.hypot(x - prev[i * 3], y - prev[i * 3 + 1], z - prev[i * 3 + 2]) * 15 / L); prev[i * 3] = x; prev[i * 3 + 1] = y; prev[i * 3 + 2] = z;
      fr++; if (lim - x < Math.max(0.12, L * 0.3)) nearShore++;
      const u = Math.max(0, Math.min(0.999, (x - left) / Math.max(0.01, lim - left))); bins[Math.floor(u * 10)]++;
    }
  }
  sp.sort((a, c) => a - c); return { p99: sp[Math.floor(sp.length * 0.99)].toFixed(2), max: sp[sp.length - 1].toFixed(2), nearShore: nearShore / fr, bins: bins.map((v) => +(v / fr).toFixed(3)) };
}
test("fish spread through the water instead of piling up on the beach slope", () => {
  const mix = ["guppy", "guppy", "guppy", "tetra", "tetra", "tetra", "koi", "goldfish", "sea_bream", "rockfish", "flounder", "catfish", "ray", "octopus", "clown", "anchovy", "anchovy", "anchovy", "mackerel", "salmon"];
  for (const tier of [8, 10]) {
    const r = measure(tier, mix, 120);
    assert.ok(r.nearShore < 0.05, `${tier}단계 물가에 붙은 몫 ${(r.nearShore * 100).toFixed(1)}%`);
    assert.ok(Math.max(...r.bins) < 0.3, `${tier}단계 한 칸에 몰림 ${r.bins.join(" ")}`);
    assert.ok(+r.max < 15, `${tier}단계 한 칸 최고 빠르기 ${r.max} L/s`);
  }
});

test("절벽 · 해변 구분(2026-11-20) — 가파른 모래사장 경사는 바위 절벽, 물 밑은 물 색에 잠기고, 물 밖은 일렁임을 받지 않는다 · 셰이더 원문에 새로 넣은 줄은 ASCII", () => {
  const src = readFileSync(new URL("./habitat.ts", import.meta.url), "utf8");
  assert.match(src, /float steep=beachK\*\(1\.-smoothstep\(\.55,\.78,vAquaN\.y\)\);/, "기울기로 바위 · 모래를 가른다");
  assert.match(src, /vAquaN = normalize\(normal \/ aquaS\)/, "늘인 수조 그대로의 기울기");
  assert.match(src, /shader\.uniforms\.aquaWaterTint = WATER_LIGHT\.aquaRimColor;/, "물 밑은 장면의 물 색");
  assert.match(src, /\*aquaClarity\*\(1\.-aquaDry\)/, "물 밖 땅엔 일렁임 없음");
  const block = src.slice(src.indexOf("float steep=beachK"), src.indexOf("aquaDry=beachK*above2;"));
  assert.ok(/^[\x00-\x7f]*$/.test(block), "절벽 셰이더 줄에 ASCII 밖 글자");
});

// 2026-11-26 [사용자: "해변애있은 모든 개채에대해 반영해야해"] — 해변 쉼터를 여럿이 나눠 쓰면 앞쪽 · 왼쪽으로 비켜났는데, 해변은 앞으로 올수록 오른쪽으로 물러나
//   큰 몸(바다사자 · 바다코끼리 · 북극곰)이 해변 밖 물 위 허공에 떠 있었다. 이제 몸 가운데가 그 앞뒤 자리의 모래 턱 너머에 온다
test("해변 쉼터는 나눠 써도 그 앞뒤 자리의 모래 턱 위 — 허공에 뜨지 않는다", async () => {
  const H = await import("./habits.ts"), B = await import("./habitat.ts");
  assert.equal(H.BEACH_Z0, B.BEACH_Z0); assert.equal(H.BEACH_ZK, B.BEACH_ZK);
  assert.ok(Math.abs(H.BEACH_DRY_X - (B.BEACH_X0 + B.BEACH_BANK + 0.2)) < 1e-9, "모래 턱 = 둑 끝 + 0.2");
  for (const tier of [8, 9, 10, 11]) {
    const ax = tankAxes(tier, tankTall(tier), tankDeep(tier)), W = wideScale(0) * ax.x, D = ax.deep, Tl = ax.tall;
    for (const length of [2.2, 4, 6.3, 8.3]) for (let share = 0; share < 9; share++) {
      const out = { x: 0, y: 0, z: 0, dx: 1, dy: 0, dz: 0, turn: 0, amp: 1, effort: 1, hover: 0, ground: 0 } as unknown as Course;
      let t = 0; for (; t < 600; t += 0.5) { const cc = { ...out }; if (haulBlend(3, t, length, W, WORLD.floor, { rock: { x: 4.65 * W, z: -1.5 * D, r: 2, h: BEACH_TOP - WORLD.floor, kind: "beach" }, share, deep: D, tall: Tl }, cc) >= 0.999) break; }
      haulBlend(3, t, length, W, WORLD.floor, { rock: { x: 4.65 * W, z: -1.5 * D, r: 2, h: BEACH_TOP - WORLD.floor, kind: "beach" }, share, deep: D, tall: Tl }, out);
      const sand = substrateHeight(out.x / W, out.z, tier, hasBeach(tier));
      assert.ok(sand > 5.2, `${tier}단계 몸길이 ${length} 나눔 ${share}: 쉬는 자리 아래가 모래(${sand.toFixed(2)})`);
    }
  }
});
