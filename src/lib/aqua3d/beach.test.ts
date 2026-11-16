import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BEACH_TOP, beachStart, hardscapeStones, hasBeach, shoreLocal, substrateHeight } from "./habitat.ts";
import { haulBlend, type Course } from "./habits.ts";
import { WORLD } from "./world.ts";

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
    for (const z of [-2.5, 0, 2.5]) {
      assert.equal(substrateHeight(-3, z, 6, beach), substrateHeight(-3, z, 6), "left side unchanged");
      let prev = -Infinity;
      for (let x = x0; x <= 4.3; x += 0.1) { const h = substrateHeight(x, z, 6, beach); assert.ok(h >= prev - 0.06, `${beach} rises at ${x.toFixed(1)}`); prev = h; }
      assert.ok(substrateHeight(4.6, z, 6, beach) > SURFACE + 0.1, "beach top above water");
    }
    // 터널 · 돔(가운데 반지름 .9 안)은 그대로
    if (beach === "hall") for (const x of [-0.9, 0, 0.9]) assert.equal(substrateHeight(x, 0, 6, beach), substrateHeight(x, 0, 6));
    // 물가 — 그 높이에서 모래가 시작하는 자리
    for (const y of [-2, 0, 3, 5]) { const sx = shoreLocal(y, 0, beach); assert.ok(Math.abs(substrateHeight(sx, 0, 6, beach) - y) < 0.05 || sx === x0, `shore ${y}`); }
  }
  assert.ok(BEACH_TOP > SURFACE);
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
  assert.match(step, /if \(b\.shore\) \{ const lim = b\.shore\(y - L \* 0\.2\) - L \* 0\.45/);
  assert.match(step, /if \(beach\) \{ const map/);
  const scene = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(scene, /motion\.shore=habitat\?\.shoreX;motion\.beach=habitat\?\.beachRest\?/);
});
