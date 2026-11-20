// 심해 덤 — 2026-11-20 [사용자: 리뷰 "심해 낚시가 손해예요 … 보상이 그만큼 따라오지 않아요" → "이렇게만 진행해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import { BAITS, DEEP_VALUE, SPOTS, catchValue, methodOf, rollCatch, spotDepth, spotMinBait } from "./fishing.ts";
import { DEEP_MIN_WATER } from "./fishing.ts";

const net = (spotKey: string, m: "float" | "deep") => {
  const sp = SPOTS.find((x) => x.key === spotKey)!;
  const bait = spotMinBait(sp), b = BAITS.indexOf(bait), per = bait.price / bait.uses;
  let s = 0;
  const n = 3000;
  for (let i = 0; i < n; i++) s += catchValue(rollCatch(sp, 10, 0.6, i * 7919 + 13, { bait: b, method: m }));
  return s / n - per * methodOf(m).baitCost;
};

test("deep catches carry the deep tag and sell for DEEP_VALUE times a float catch of the same fish", () => {
  const sp = SPOTS.find((x) => spotDepth(x) >= DEEP_MIN_WATER)!;
  const c = rollCatch(sp, 10, 0.6, 7, { method: "deep" });
  if (!c.junk) {
    assert.equal(c.deep, true);
    const plain = { ...c, deep: undefined };
    assert.ok(Math.abs(catchValue(c) / catchValue(plain) - DEEP_VALUE) < 1e-9);
  }
  assert.equal(rollCatch(sp, 10, 0.6, 7, { method: "float" }).deep, undefined);
});

test("per cast, deep fishing nets more hearts than float fishing at every deep-enough spot, even paying two baits", () => {
  for (const sp of SPOTS) {
    if (spotDepth(sp) < DEEP_MIN_WATER) continue;
    const f = net(sp.key, "float"), d = net(sp.key, "deep");
    assert.ok(d > f, `${sp.key}: 심해 ${d.toFixed(1)} · 찌 ${f.toFixed(1)}`);
    // 그래도 두 배를 넘게 벌지는 않는다 — 찌가 죽지 않게
    assert.ok(d < f * 1.6, `${sp.key}: 심해가 지나치게 번다 ${d.toFixed(1)} vs ${f.toFixed(1)}`);
  }
});

test("junk never gets the deep bonus", () => {
  const sp = SPOTS.find((x) => spotDepth(x) >= DEEP_MIN_WATER)!;
  for (let i = 0; i < 400; i++) { const c = rollCatch(sp, 0, 0.3, i, { method: "deep", junk: true }); if (c.junk) assert.equal(c.deep, undefined); }
});
