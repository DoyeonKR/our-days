// 고래상어 기믹 — 2026-11-17 [사용자: "고래상어는 최고 상위 등급으로 올리고 … 자기보다 몸집이 작은 개체들이 모두 자기를 따라오도록"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WHALE_ESCORT, escortSlot } from "./fishstep.ts";
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
