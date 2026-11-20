// 고래상어 기믹 — 2026-11-17 [사용자: "고래상어는 최고 상위 등급으로 올리고 … 자기보다 몸집이 작은 개체들이 모두 자기를 따라오도록"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WHALE_ESCORT, WHALE_ESCORT_MAX, escortSlot } from "./fishstep.ts";
import { FAMILIES } from "../aquarium.ts";

test("whale shark is the top grade (태초)", () => {
  const f = FAMILIES.find((x) => x.key === "whale_shark")!;
  assert.equal(f.finals[0].grade, "태초");
});

test("escort slots sit behind the whale, spread around it, and never on top of each other", () => {
  const WL = 4, L = 0.6, pts: [number, number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const s = escortSlot(i, WL, L, 10);
    assert.ok(s.back > WL * 0.3, `slot ${i} behind the whale (${s.back})`);
    assert.ok(Math.hypot(s.side, s.up) < WL * 1.2, `slot ${i} stays close`);
    pts.push([s.back, s.side, s.up]);
  }
  let near = Infinity;
  for (let a = 0; a < pts.length; a++) for (let b = a + 1; b < pts.length; b++) near = Math.min(near, Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1], pts[a][2] - pts[b][2]));
  assert.ok(near > L * 0.5, `closest two slots ${near}`);
  // 천천히 흔들린다 — 같은 자리라도 시각이 바뀌면 조금 움직인다
  const a = escortSlot(3, WL, L, 0), b = escortSlot(3, WL, L, 2);
  assert.ok(Math.abs(a.back - b.back) + Math.abs(a.up - b.up) > 0.01);
});

test("every frame runs the escort after the paths and only for smaller fish (starfish · den · resting mammals stay put)", () => {
  const src = readFileSync(new URL("./fishstep.ts", import.meta.url), "utf8");
  assert.match(src, /b\.count = n;\n {2}whaleEscort\(n, fishes, b, elapsed, dt, wide, deep, tall\);/);
  assert.match(src, /if \(L >= WL \|\| m\.family === "starfish" \|\| st\.den \|\| \(st\.haul && st\.rest > 0\.05\)\) continue;/);
  assert.ok(WHALE_ESCORT > 0.5 && WHALE_ESCORT <= 1);
});

// 2026-11-18 [사용자: "고래상어 끌고다니는 무리들은 크기작은 개체 오름차순 최대 5마리만"]
test("only the five smallest eligible fish follow the whale, smallest first", () => {
  assert.equal(WHALE_ESCORT_MAX, 5);
  const src = readFileSync(new URL("./fishstep.ts", import.meta.url), "utf8");
  assert.ok(src.includes("ESCORT.sort((a, c) => b.lengths[a] - b.lengths[c] || a - c);"), "작은 몸부터");
  assert.ok(src.includes("if (ESCORT.length > WHALE_ESCORT_MAX) ESCORT.length = WHALE_ESCORT_MAX;"), "최대 5마리");
  assert.ok(src.includes("slot = ESCORT.indexOf(k)") && src.includes("escortSlot(slot, WL, L, elapsed)"), "작은 순서대로 자리");
});

// 2026-11-20 — 대형 자리는 천천히 따라가고(한 프레임에 건너뛰지 않는다) 대형에 들고 날 때 섞는다
test("escorts follow their slot smoothly — no frame jumps when the whale turns or the escort set changes", async () => {
  const { stepFish, ESCORT_TAU, ESCORT_IN, ESCORT_MAX_LPS } = await import("./fishstep.ts");
  const { schoolsOf } = await import("./world.ts");
  assert.ok(ESCORT_TAU > 0.2 && ESCORT_IN >= 0.5 && ESCORT_MAX_LPS <= 4);
  const fish = [{ id: 1, family: "whale_shark", length: 5.2 }, { id: 2, family: "koi", length: 2.1 }, { id: 3, family: "bluefin_tuna", length: 2.4 }, { id: 4, family: "guppy", length: 0.9 }];
  const n = fish.length, schools = schoolsOf(fish);
  const bodies = fish.map((f) => [f.id, { family: f.family, key: f.family, length: f.length, phase: 0, course: {} as never }] as [number, never]);
  const b = { positions: new Float32Array(n * 3), heading: new Float32Array(n * 3), lengths: new Float32Array(n), pinned: new Float32Array(n), offsets: new Float32Array(n * 3), rolls: new Float32Array(n), courses: [] as never[], count: 0 };
  const prev = new Float32Array(n * 3); let worst = 0;
  for (let k = 0; k < 30 * 240; k++) {
    const t = k / 30;
    stepFish(bodies, schools, (id) => fish.find((f) => f.id === id)?.length, t, k ? 1 / 30 : 0, { wide: 2.5, tall: 2.175, deep: 1.9, heightAt: () => -5, obstacles: [], feed: null, hall: null }, b as never);
    if (k > 30) for (let i = 1; i < n; i++) worst = Math.max(worst, Math.hypot(b.positions[i * 3] - prev[i * 3], b.positions[i * 3 + 1] - prev[i * 3 + 1], b.positions[i * 3 + 2] - prev[i * 3 + 2]) * 30 / fish[i].length);
    prev.set(b.positions);
  }
  assert.ok(worst < 6, `escort fastest ${worst.toFixed(1)} body lengths/s`);
});
