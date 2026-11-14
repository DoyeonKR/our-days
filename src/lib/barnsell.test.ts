// 창고 재료 그냥 팔기(2026-11-14) [사용자: "섬에서 농작물 그냥 팔 수 있도록 적정가 측정 · 음식 값에 비례해서 더 저렴하게"]
import assert from "node:assert/strict";
import { test } from "node:test";
import { CROPS, PRODUCTS, GOODS, barnSellPrice, createIsland, dishPayout, sellBarn } from "./island.ts";

test("작물은 거둘 때 판매가를 받았으니 창고 몫은 그보다 싸다 · ★가 높을수록 비싸다", () => {
  for (const c of CROPS) {
    assert.ok(barnSellPrice(c.key, 1) < c.sell, c.key);
    assert.ok(barnSellPrice(c.key, 5) > barnSellPrice(c.key, 1), c.key);
  }
  for (const g of GOODS) assert.ok(barnSellPrice(g.key, 3) > 0 && barnSellPrice(g.key, 3) < g.sell * 2, g.key);
  assert.equal(barnSellPrice("nothing", 3), 0);
});

test("요리를 파는 쪽이 늘 재료를 그냥 파는 것보다 낫다(요리는 값에 비례, 재료는 더 싸게)", () => {
  for (const p of PRODUCTS) for (const star of [1, 3, 5]) {
    const raw = Object.entries(p.recipe).reduce((n, [k, q]) => n + barnSellPrice(k, star) * (q as number), 0);
    assert.ok(dishPayout(p.key, star).coins > raw, `${p.key} ★${star}: 요리 ${dishPayout(p.key, star).coins} > 재료 ${raw}`);
  }
});

test("sellBarn — 판 만큼 줄고 코인이 들어온다 · 가진 것보다 많이 못 판다 · 없으면 그대로", () => {
  const s0 = createIsland("콩", null, 0);
  s0.farm.barn.carrot = { qty: 3, star: 2 };
  const s1 = sellBarn(s0, "carrot", 2, 1000);
  assert.equal(s1.farm.barn.carrot?.qty, 1);
  assert.equal(s1.coins - s0.coins, barnSellPrice("carrot", 2) * 2);
  const s2 = sellBarn(s1, "carrot", 99, 1000);
  assert.equal(s2.farm.barn.carrot, undefined);
  assert.equal(sellBarn(s2, "carrot", 1, 1000), s2);
});

test("주문은 늘 재료를 그냥 파는 것보다 후하다 · 퇴비는 여전히 싼 작물의 선택", async () => {
  const { refreshOrders, todayOrders, dishPayout: dp, cropOf, TUNING } = await import("./island.ts");
  let s = createIsland("콩", null, 0);
  s.farm.skillXp = 1e6;
  const DAY = 86400000;
  let seen = 0;
  for (let d = 0; d < 40; d++) {
    s = refreshOrders(s, d * DAY + 1000);
    for (const o of todayOrders(s, d * DAY + 1000)) {
      seen++;
      const raw = o.items.reduce((n, it) => n + (barnSellPrice(it.key, it.star) || (PRODUCTS.some((p) => p.key === it.key) ? dp(it.key as never, it.star).coins : 0)) * it.qty, 0);
      assert.ok(o.coins > raw, `${o.id}: 주문 ${o.coins} > 그냥 팔기 ${raw}`);
    }
  }
  assert.ok(seen > 40, `주문을 봤다(${seen})`);
  // 퇴비(작물 3 → 비료 2)와 그냥 팔기 — 가장 싼 작물은 퇴비가 낫다
  const cheapest = [...CROPS].sort((a, b) => a.sell - b.sell)[0];
  assert.ok(barnSellPrice(cheapest.key, 3) * 3 < TUNING.farm.fertilizer * 2, cropOf(cheapest.key).name);
});
