// 공방 확장 lock — 단계 요리 · 찬장 · 요리 효과 · 주문 게시판. [2026-09-23]
// [사용자 요청 "공방 … 너무 기능도 없고 반복적인 것만 … 더 많은 요리들 그걸로 할 수 있는것들이 더 많아져야해"]
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CROPS,
  DAY_MS,
  PRODUCTS,
  activeBuffs,
  buffAmount,
  claimVisit,
  collectCraft,
  craftCheck,
  craftReady,
  createIsland,
  cropOf,
  cropStage,
  dishPayout,
  farmSkill,
  fulfillOrder,
  harvest,
  huntOf,
  huntTick,
  isCropKey,
  isLegendProduct,
  orderReady,
  plant,
  productOf,
  qualityPreview,
  seasonOf,
  skillXpFor,
  startCraft,
  stockOf,
  todayOrders,
  pantryAction,
  type IslandState,
  type ProductKey,
} from "./island.ts";

const T0 = Date.UTC(2026, 8, 25, 3, 0, 0); // 가을(KST)
const H = 3_600_000;

function kitchen(skill = 10): IslandState {
  const s = createIsland("콩", null, T0);
  s.coins = 100_000;
  s.farm.skillXp = skillXpFor(skill);
  return s;
}
/** 조리대 0 에 만들고 다 될 때까지 기다린 시각. */
function cook(s: IslandState, key: ProductKey, t: number): { s: IslandState; t: number } {
  const next = startCraft(s, 0, key, t);
  assert.notEqual(next, s, `${key} 를 시작하지 못했다`);
  let done = t;
  while (!craftReady(next.farm.craft[0], done)) done += 15 * 60_000;
  return { s: next, t: done };
}

const NEW = [
  "flour", "ricecake", "gochujang", "kimchi", "bibimbap", "gimbap", "tteokbokki", "hobakjuk", "gamjajeon",
  "muguk", "ssambap", "sikhye", "makgeolli", "gunbam", "goguma", "bread", "applepie", "citrustea", "berryjam",
  "greentea", "applejuice", "ratatouille", "peasoup",
] as const;

test("요리 23종 — 효과는 요리에만, 재료(밀가루 등)·전설에는 없다", () => {
  for (const k of NEW) assert.ok(PRODUCTS.some((p) => p.key === k), `${k} 가 없다`);
  for (const p of PRODUCTS) {
    if (p.cat === "ingredient" || isLegendProduct(p)) assert.ok(!p.effect, `${p.name}: 재료·전설에 효과`);
    else assert.ok(p.effect, `${p.name}: 요리인데 효과가 없다 — 먹일 이유가 숫자뿐이다`);
  }
});

test("★ 요리는 재료보다 비싸게 팔린다 — 덜 벌면 공방이 죽는다(재료값 합 기준)", () => {
  const value = (k: string): number => (isCropKey(k) ? cropOf(k).sell : productOf(k as ProductKey).sell);
  for (const p of PRODUCTS) {
    if (isLegendProduct(p)) continue;
    const raw = Object.entries(p.recipe).reduce((a, [k, n]) => a + value(k) * (n ?? 0), 0);
    assert.ok(p.sell > raw, `${p.name}: 판매 ${p.sell} ≤ 재료 ${raw}`);
  }
});

test("★ 단계 요리 — 밀 → 밀가루(찬장) → 식빵. 찬장의 제품이 재료로 빠진다", () => {
  let s = kitchen();
  s.farm.barn.wheat = { qty: 4, star: 3 };
  let r = cook(s, "flour", T0);
  s = collectCraft(r.s, 0, r.t, "store");
  r = cook(s, "flour", r.t);
  s = collectCraft(r.s, 0, r.t, "store");
  assert.equal(stockOf(s, "flour").qty, 2, "밀가루 두 포대가 찬장에");
  assert.ok(craftCheck(s, productOf("bread")).ok, "밀가루 2 로 식빵을 만들 수 있다");
  r = cook(s, "bread", r.t);
  assert.equal(stockOf(r.s, "flour").qty, 0, "식빵을 만들면 찬장의 밀가루가 빠진다");
  assert.equal(r.s.farm.barn.wheat?.qty ?? 0, 0);
});

test("★ 여러 단계를 거친 요리가 더 세다 — 떡볶이(떡+고추장) > 재료를 그냥 먹이기", () => {
  const p = dishPayout("tteokbokki", 3).careXp;
  const cake = dishPayout("ricecake", 3).careXp;
  const paste = dishPayout("gochujang", 3).careXp;
  assert.ok(p > cake + paste, `떡볶이 ${p} ≤ 떡 ${cake} + 고추장 ${paste}`);
});

test("찬장 — 보관한 요리를 나중에 먹이기·팔기·선물로 쓴다", () => {
  let s = kitchen();
  s.farm.barn.tea = { qty: 2, star: 3 };
  const r = cook(s, "greentea", T0);
  s = collectCraft(r.s, 0, r.t, "store");
  assert.equal(stockOf(s, "greentea").qty, 1);
  const coins = s.coins;
  const sold = pantryAction(s, "greentea", "sell", r.t);
  assert.ok(sold.coins > coins, "팔면 코인");
  assert.equal(stockOf(sold, "greentea").qty, 0, "찬장에서 빠진다");
  assert.equal(pantryAction(sold, "greentea", "sell", r.t), sold, "없으면 no-op");
});

test("★ 요리 효과 — 녹차를 먹이면 수확 품질이 오르고, 시간이 지나면 꺼진다", () => {
  let s = kitchen();
  s = plant(s, 0, "pumpkin", T0);
  const before = qualityPreview(s, 0, T0)!.score;
  s.farm.pantry = { greentea: { qty: 1, star: 1 } };
  s = pantryAction(s, "greentea", "treat", T0);
  const on = qualityPreview(s, 0, T0 + H)!;
  assert.equal(on.score, before + 10, `품질 +10 (${JSON.stringify(on.parts)})`);
  assert.equal(activeBuffs(s, T0 + H)[0]?.kind, "quality");
  assert.equal(qualityPreview(s, 0, T0 + 7 * H)!.score, before, "6시간(★1) 뒤엔 꺼진다");
});

test("효과는 쌓이지 않고 갱신된다 — 같은 걸 두 번 먹어도 세기는 그대로", () => {
  let s = kitchen();
  s.farm.pantry = { greentea: { qty: 2, star: 1 } };
  s = pantryAction(s, "greentea", "treat", T0);
  s = pantryAction(s, "greentea", "treat", T0 + H);
  assert.equal(buffAmount(s, "quality", T0 + 2 * H), 10, "두 번 먹어도 +10");
  assert.ok(s.buffs!.quality!.until <= T0 + H + 6 * H + 1, "지속시간은 마지막 것 기준으로 갱신");
});

test("★가 높을수록 효과가 오래간다(★5 = 두 배)", () => {
  let a = kitchen();
  a.farm.pantry = { kimchi: { qty: 1, star: 1 } };
  a = pantryAction(a, "kimchi", "treat", T0);
  let b = kitchen();
  b.farm.pantry = { kimchi: { qty: 1, star: 5 } };
  b = pantryAction(b, "kimchi", "treat", T0);
  const la = a.buffs!.bumper!.until - T0;
  const lb = b.buffs!.bumper!.until - T0;
  assert.equal(lb, la * 2);
});

test("즉시 효과 — 주스는 자라는 밭을 앞당기고, 수프는 펫을 회복시킨다", () => {
  let s = kitchen();
  s = plant(s, 0, "pumpkin", T0);
  const p0 = cropStage(s, s.farm.plots[0], T0 + H).progress;
  s.farm.pantry = { applejuice: { qty: 1, star: 1 }, peasoup: { qty: 1, star: 1 } };
  s = pantryAction(s, "applejuice", "treat", T0 + H);
  const p1 = cropStage(s, s.farm.plots[0], T0 + H).progress;
  assert.ok(p1 > p0, `성장 ${p0.toFixed(3)} → ${p1.toFixed(3)}`);
  s.pet.stats.energy = 10;
  s = pantryAction(s, "peasoup", "treat", T0 + H);
  assert.ok(s.pet.stats.energy >= 10 + 25, `기력 ${s.pet.stats.energy}`);
});

test("판매 효과 — 켜져 있으면 수확 코인이 20% 오른다", () => {
  // 시드는 (이름·시각) 결정적이라 두 섬이 같은 rng 로 같은 ★·풍년을 굴린다 — 차이는 효과뿐이다
  const mk = (buffed: boolean) => {
    let s = kitchen();
    s.farm.sprinkler = true;
    s = plant(s, 0, "pumpkin", T0);
    if (buffed) s.buffs = { sell: { until: T0 + 30 * DAY_MS, amount: 20 } };
    return s;
  };
  const a = mk(false);
  const b = mk(true);
  let t = T0;
  while (!cropStage(a, a.farm.plots[0], t).ripe) t += H;
  const ga = harvest(a, 0, t).coins - a.coins;
  const gb = harvest(b, 0, t).coins - b.coins;
  assert.ok(ga > 0);
  assert.ok(Math.abs(gb - ga * 1.2) <= 1, `수확 ${ga} → 효과 ${gb}`);
});

test("★ 사냥 효과는 겹친 시간 비율만큼만 — 정산을 쪼개 오프라인 상한을 두 번 받지 않는다", () => {
  const base = kitchen();
  base.hunt = { ...huntOf(base, T0), at: T0 };
  const halfBuff = { ...base, buffs: { hunt: { until: T0 + 30 * 60_000, amount: 100 } } } as IslandState;
  const fullBuff = { ...base, buffs: { hunt: { until: T0 + 10 * H, amount: 100 } } } as IslandState;
  const t = T0 + H; // 한 시간 정산 — 반쪽은 30분만 켜져 있었다
  const dmg = (s: IslandState) => {
    const g = huntTick(s, t, false).gain;
    return g.kills;
  };
  const none = dmg(base);
  const half = dmg(halfBuff);
  const full = dmg(fullBuff);
  assert.ok(half >= none && full >= half, `처치 수 ${none} ≤ ${half} ≤ ${full}`);
  assert.ok(full > none, "켜져 있으면 더 잡는다");
});

test("★★ 주문 — 그날 한 번 정해져 저장되고, 만들 수 있는 것만 주문한다", () => {
  let s = kitchen(6);
  s = claimVisit(s, "u1", T0);
  const list = todayOrders(s, T0);
  assert.equal(list.length, 3, "하루 세 건");
  const season = seasonOf(T0);
  const skill = farmSkill(s.farm.skillXp);
  for (const o of list) {
    for (const it of o.items) {
      if (isCropKey(it.key)) {
        const c = cropOf(it.key);
        assert.ok(!c.unique && (c.season === season || s.farm.greenhouse), `${c.name}: 제철이 아니거나 전설`);
      } else {
        const p = productOf(it.key as ProductKey);
        assert.ok(p.minSkill <= skill && !isLegendProduct(p), `${p.name}: 아직 못 만드는 요리`);
      }
    }
    assert.ok(o.coins > 0);
  }
  // 같은 날 다시 열어도, 스킬이 올라도 주문은 그대로
  const again = claimVisit({ ...s, farm: { ...s.farm, skillXp: skillXpFor(15) } }, "u1", T0 + H);
  assert.deepEqual(todayOrders(again, T0 + H).map((o) => o.id), list.map((o) => o.id));
  // 다음 날엔 새 주문
  const next = claimVisit(s, "u1", T0 + DAY_MS);
  assert.notEqual(todayOrders(next, T0 + DAY_MS)[0].id, list[0].id);
});

test("★ 주문 처리 — 물건을 건네고 팔 때보다 후하게 받는다, 두 번은 안 된다", () => {
  let s = kitchen(6);
  s = claimVisit(s, "u1", T0);
  const o = todayOrders(s, T0)[0];
  assert.ok(!orderReady(s, o), "전제: 아직 물건이 없다");
  for (const it of o.items) {
    if (isCropKey(it.key)) s.farm.barn[it.key] = { qty: it.qty, star: Math.max(it.star, 3) };
    else s.farm.pantry = { ...(s.farm.pantry ?? {}), [it.key]: { qty: it.qty, star: Math.max(it.star, 3) } };
  }
  assert.ok(orderReady(s, o));
  const value = o.items.reduce((a, it) => a + (isCropKey(it.key) ? cropOf(it.key).sell : productOf(it.key as ProductKey).sell) * it.qty, 0);
  const before = s.coins;
  const after = fulfillOrder(s, o.id, T0);
  assert.equal(after.coins - before, o.coins);
  assert.ok(o.coins > value, `주문 보상 ${o.coins} ≤ 그냥 판 값 ${value}`);
  for (const it of o.items) assert.equal(stockOf(after, it.key).qty, 0, `${it.key} 가 빠졌다`);
  assert.equal(fulfillOrder(after, o.id, T0), after, "같은 주문을 두 번 받을 수 없다");
});

test("주문 ★ 요구 — 품질이 모자라면 건넬 수 없다", () => {
  let s = kitchen(12); // 스킬 10+ = ★3 요구
  s = claimVisit(s, "u1", T0);
  const o = todayOrders(s, T0)[0];
  for (const it of o.items) {
    const box = isCropKey(it.key) ? s.farm.barn : (s.farm.pantry ??= {});
    box[it.key] = { qty: it.qty, star: it.star - 1 };
  }
  assert.ok(!orderReady(s, o), "★가 모자라면 안 된다");
});

test("구버전 섬(찬장·효과·주문 없음)도 그대로 돈다 — 무마이그레이션", () => {
  const s = kitchen();
  delete (s.farm as { pantry?: unknown }).pantry;
  delete (s as { buffs?: unknown }).buffs;
  delete (s as { orders?: unknown }).orders;
  assert.equal(buffAmount(s, "sell", T0), 0);
  assert.deepEqual(todayOrders(s, T0), []);
  const v = claimVisit(s, "u1", T0);
  assert.equal(todayOrders(v, T0).length, 3);
  assert.ok(CROPS.length > 0);
});

test("화면 계약 — 공방 판정은 엔진 하나로, 수령은 4택(보관 포함), 가공 시트는 레시피북", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const game = readFileSync(join(import.meta.dirname, "..", "components", "IslandGame.tsx"), "utf8");
  // 재료 판정을 화면에서 따로 세면 '버튼은 켜졌는데 아무 일 없는' 사고가 난다(골드비료·전설 씨앗 전례)
  assert.match(game, /PRODUCTS\.filter\(\(p\) => craftCheck\(s, p\)\.ok\)/, "공방 배지가 엔진 판정(craftCheck)을 안 쓴다");
  assert.ok(!/cropOf\(ck as CropKey\)/.test(game), "레시피 재료를 작물로만 가정한다 — 단계 요리(밀가루)에서 터진다");
  assert.match(game, /use: "store", label: "보관"/, "조리대 수령에 '보관'이 없다 — 주문·단계 요리에 쓸 방법이 없다");
  assert.match(game, /<RecipeBook[\s\S]*?startCraft\(x, slot, key/, "가공 시트가 레시피북을 안 쓴다");
  assert.match(game, /refreshOrders\(x, Date\.now\(\)\)/, "주문 칸이 빈 날 주문을 채우지 않는다(자정 넘김·방문 누락)");
});
