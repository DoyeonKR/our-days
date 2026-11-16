// 수심 맞추기(2026-11-13) [사용자: "거리말고 수심도 조절할 수 있는 기믹"] — 찌가 내려앉으면 미끼가 표층 → 중층 → 바닥으로 가라앉고,
// 누른 수심에 사는 물고기가 더 잘 문다. 같은 미끼 단계 안에서만 다시 고르므로 미끼 1% 규칙(단계마다의 몫)은 그대로다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BAITS, BOTTOM_FAMILIES, SINKERS, SPOTS, SPOT_DEPTH, SURFACE_FAMILIES, buySinker, familyBaitTier, familyDepth, rollCatch, sinkReach, sinkerOf, spotDepth, zoneAt, type FishDepth } from "./fishing.ts";
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

test("봉돌이 내려갈 깊이를 정한다 — 낚시터 바닥보다 깊이는 못 가고, 심해 방식은 3배 · 봉돌은 하트로 한 단계씩", () => {
  const brook = SPOTS.find((x) => x.key === "brook")!, abyss = SPOTS.find((x) => x.key === "abyss")!;
  assert.equal(sinkReach(0, "float", brook), spotDepth(brook), "얕은 개울은 가벼운 봉돌로도 바닥까지");
  assert.equal(sinkReach(0, "float", abyss), SINKERS[0].reach);
  assert.equal(zoneAt(SINKERS[0].reach, abyss), 0, "가벼운 봉돌로는 심해에서 표층뿐");
  assert.equal(sinkReach(0, "deep", abyss), SINKERS[0].reach * 3);
  assert.equal(zoneAt(sinkReach(SINKERS.length - 1, "float", abyss), abyss), 2, "가장 무거운 봉돌이면 심해 바닥까지");
  for (let i = 1; i < SINKERS.length; i++) assert.ok(SINKERS[i].reach > SINKERS[i - 1].reach && SINKERS[i].price > SINKERS[i - 1].price);
  for (const sp of SPOTS) assert.ok(spotDepth(sp) > 0 && SPOT_DEPTH[sp.key] !== undefined, sp.key);
  const st = { coins: 1000, fishPlus: {} } as never;
  const r = buySinker(st);
  assert.ok(r.ok && sinkerOf(r.state) === 1 && r.state.coins === 1000 - SINKERS[1].price);
  assert.equal(buySinker({ coins: 10, fishPlus: {} } as never).ok, false, "하트가 모자라면 못 산다");
});

test("어군에 맞히면 그 수심 쪽으로 더 세다 · 다른 수심 물고기는 줄어든다", () => {
  const plain = roll("pond", 0), bottom = roll("pond", 0, 2);
  const spot = SPOTS.find((x) => x.key === "pond")!;
  const school = Array.from({ length: N }, (_, i) => rollCatch(spot, 5, 0.5, (Math.imul(i + 1, 2654435761) + 7) >>> 0, { bait: 0, method: "float", depth: 2, school: true }));
  const share = (a: typeof plain) => a.filter((c) => familyDepth(c.family) === 2).length / N;
  assert.ok(share(school) > share(bottom) && share(bottom) > share(plain), `${share(plain).toFixed(2)} → ${share(bottom).toFixed(2)} → 어군 ${share(school).toFixed(2)}`);
});

test("화면 — 뜰채 · 주인 · 특별한 것만 빼고 모든 낚시가 가라앉기를 거친다 · 수심은 봉돌 한계 안에서", () => {
  const src = readFileSync("src/components/FishingGame.tsx", "utf8");
  assert.ok(src.includes("if (c.boss || c.special) { go(flyMs); return; }"), "주인 · 특별한 것만 가라앉기 없이");
  assert.match(src, /phase === "sink"\) \{[^}]*deviceClock\(\) < sinkRef\.current\.t0\) return;\s*stopSink\(\);/, "날아가는 동안의 누름은 무시하고 내려앉은 뒤 누르면 멈춘다");
  assert.ok(src.includes("const reach = sinkReach(sinkerOf(st), method, spot);"), "수심은 봉돌 한계 안에서");
  assert.match(src, /if \(method === "scoop"\) \{\s*beginScoop\(\);/,"뜰채는 던지지 않고 건진다(가라앉기 없음)");
});
