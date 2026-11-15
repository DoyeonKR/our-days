import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { breachAt, canBreach, planBreach } from "./breach.ts";

// 범고래 뛰어오르기(2026-11-15) — 수면 위로 통째로 나갔다 들어오고, 수조 안에 머물고, 끝나면 원래 길로
const cases = [
  { start: { x: -4.6, y: 8.5, z: -.4, hx: 1 }, surface: 18.3, floor: -5.3, halfW: 10, L: 4.6, front: 4.5 },
  { start: { x: 9, y: 2, z: 1, hx: 1 }, surface: 11, floor: -5.3, halfW: 9.4, L: 3, front: 2.5 },
  { start: { x: 0, y: 4, z: 0, hx: -1 }, surface: 6.2, floor: -5.3, halfW: 3.5, L: 1.2, front: 2.4 },
];

test("only the orca breaches", () => {
  assert.ok(canBreach("orca"));
  for (const f of ["spotted_seal", "goldfish", "great_white", "octopus"]) assert.ok(!canBreach(f), f);
});

test("breach leaves the water whole, stays inside the tank and comes back smoothly", () => {
  for (const c of cases) {
    const p = planBreach(c.start, c.surface, c.floor, c.halfW, c.L, c.front);
    assert.ok(p.exitT < p.enterT && p.enterT < p.total, "order");
    let maxY = -Infinity, prev = breachAt(p, 0), airFrames = 0;
    assert.equal(prev.x, c.start.x); assert.equal(prev.y, c.start.y);
    for (let t = 1 / 60; t < p.total; t += 1 / 60) {
      const b = breachAt(p, t);
      maxY = Math.max(maxY, b.y);
      assert.ok(Math.abs(b.x) <= c.halfW + 1e-6, `x inside ${b.x}`);
      assert.ok(b.y >= c.floor, `above floor ${b.y}`);
      // 한 프레임에 몸길이의 40% 넘게 튀지 않는다(공중 · 솟구침 빠르기 포함)
      assert.ok(Math.hypot(b.x - prev.x, b.y - prev.y, b.z - prev.z) < .4 * c.L, `jump at ${t.toFixed(2)}`);
      if (b.air) { airFrames++; assert.ok(b.y >= c.surface - 1e-6, "air is above water"); assert.ok(Math.abs(b.hx) > .2, "never straight up"); }
      prev = b;
    }
    assert.ok(maxY >= c.surface + .8 * c.L, "whole body clears the surface");
    assert.ok(airFrames > 50, "about a second in the air");
    // 수면에서 나가고 들어온다(물보라 자리)
    assert.ok(Math.abs(breachAt(p, p.exitT).y - c.surface) < .05);
    assert.ok(Math.abs(breachAt(p, p.enterT).y - c.surface) < .05);
    // 끝나면 원래 길과 섞는 몫이 0
    assert.ok(breachAt(p, p.total - 1e-3).w < .01);
    assert.equal(breachAt(p, p.total).phase, "done");
  }
});

test("scene wires the breach with splashes on exit and entry", () => {
  const src = readFileSync(new URL("./scene.ts", import.meta.url), "utf8");
  assert.match(src, /canBreach\(m\.family\)/);
  assert.match(src, /splash\.burst\(pl\.exitX[^)]*false/);
  assert.match(src, /splash\.burst\(pl\.enterX[^)]*true/);
  const sp = readFileSync(new URL("./splash.ts", import.meta.url), "utf8");
  // 셰이더 원문은 ASCII 만
  const shaders = [...sp.matchAll(/(?:vertex|fragment)Shader:\s*"([^"]*)"/g)].map((m) => m[1]).join("");
  assert.ok(shaders.length > 100);
  assert.ok(/^[\x00-\x7f]*$/.test(shaders), "shader ascii");
});
