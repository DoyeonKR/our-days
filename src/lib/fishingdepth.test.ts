// 수심 맞추기(2026-11-13) [사용자: "거리말고 수심도 조절할 수 있는 기믹"] — 찌가 내려앉으면 미끼가 표층 → 중층 → 바닥으로 가라앉고,
// 누른 수심에 사는 물고기가 더 잘 문다. 같은 미끼 단계 안에서만 다시 고르므로 미끼 1% 규칙(단계마다의 몫)은 그대로다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BAITS, BOTTOM_FAMILIES, SPOTS, SURFACE_FAMILIES, depthOf, familyBaitTier, familyDepth, rollCatch, type FishDepth } from "./fishing.ts";
import { FAMILIES } from "./aquarium.ts";
import { habitOf } from "./aqua3d/habits.ts";

const N = 4000;
const roll = (spotKey: string, bait: number, depth?: FishDepth) => {
  const spot = SPOTS.find((s) => s.key === spotKey)!;
  return Array.from({ length: N }, (_, i) => rollCatch(spot, 5, 0.5, (Math.imul(i + 1, 2654435761) + 7) >>> 0, { bait, method: "float", ...(depth === undefined ? {} : { depth }) }));
};

test("수심을 안 주면 한 판도 달라지지 않는다 · 주면 미끼 단계의 몫은 그대로다", () => {
  for (const spot of SPOTS) {
    const bait = Math.min(BAITS.length - 1, 3);
    const plain = roll(spot.key, bait), again = roll(spot.key, bait);
    assert.deepEqual(plain.map((c) => c.family), again.map((c) => c.family), spot.key);
    for (const d of [0, 1, 2] as const) {
      const deep = roll(spot.key, bait, d);
      for (let i = 0; i < N; i++) {
        assert.equal(familyBaitTier(deep[i].family), familyBaitTier(plain[i].family), `${spot.key} ${d}: 단계가 바뀌었다`);
        assert.equal(deep[i].stage, plain[i].stage, `${spot.key} ${d}: 다 큰 모습 뽑기가 바뀌었다`);
      }
    }
  }
});

test("맞춘 수심의 물고기가 더 잘 문다 — 그 수심 계열이 있는 낚시터에서", () => {
  let checked = 0;
  for (const spot of SPOTS) {
    for (const d of [0, 2] as const) {
      const plain = roll(spot.key, 0), deep = roll(spot.key, 0, d);
      const share = (a: typeof plain) => a.filter((c) => familyDepth(c.family) === d).length / N;
      if (share(plain) === 0 || share(plain) > 0.9) continue;
      checked++;
      // 나머지 몫(그 수심이 아닌 물고기)이 40% 넘게 줄어든다 — 원래 몫이 큰 곳도 같은 잣대로
      assert.ok(share(deep) - share(plain) > 0.4 * (1 - share(plain)) * Math.min(1, share(plain) * 4), `${spot.key} ${["표층", "중층", "바닥"][d]}: ${share(plain).toFixed(2)} → ${share(deep).toFixed(2)}`);
    }
  }
  assert.ok(checked >= 8, `견준 낚시터가 너무 적다(${checked})`);
});

test("사는 수심은 수조의 습성과 같은 갈래다 — 바닥에 붙는 종은 바닥, 높이 사는 종은 표층", () => {
  for (const f of FAMILIES) {
    const h = habitOf(f.key) as { hug?: number; den?: boolean; lo: number; hi: number };
    const mid = (h.lo + h.hi) / 2;
    const want = h.hug !== undefined || h.den || mid <= -2.2 ? 2 : mid >= 1 ? 0 : 1;
    if (f.key === "clown" || f.key === "sea_turtle") continue; // 흰동가리(말미잘 곁) · 바다거북(숨 쉬러 오르내림)은 중층으로 둔다
    assert.equal(familyDepth(f.key), want, f.key);
  }
  for (const k of [...SURFACE_FAMILIES, ...BOTTOM_FAMILIES]) assert.ok(FAMILIES.some((f) => f.key === k), `없는 계열 ${k}`);
});

test("가라앉는 정도 → 수심 · 화면은 찌낚시에서만 가라앉기를 연다", () => {
  assert.equal(depthOf(0), 0); assert.equal(depthOf(0.5), 1); assert.equal(depthOf(1), 2);
  const src = readFileSync("src/components/FishingGame.tsx", "utf8");
  assert.match(src, /if \(method !== "float" \|\| c\.boss \|\| c\.special\) \{ startWait\(flyMs\); return; \}/);
  assert.match(src, /phase === "sink"\) \{\s*stopSink\(\);/);
});
